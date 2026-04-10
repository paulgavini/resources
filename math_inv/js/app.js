import {
  createBlankAnalysisPoint,
  createBlankGraphCard,
  createBlankImprovementPoint,
  createBlankInvestigationCycle,
  getState,
  replaceState,
  resetState,
  subscribe,
  updateState,
} from "./state.js";
import {
  clearSavedInvestigation,
  exportAsJson,
  importFromJsonText,
  loadFromIndexedDb,
  migrateLegacyLocalStorageToIndexedDb,
  readFileAsText,
  saveToIndexedDb,
} from "./storage.js";
import { getTemplateById, getTemplateList } from "./templates.js";
import { validateAllSections } from "./validation.js";
import {
  buildConclusionParagraph,
  buildIntroductionParagraph,
  buildReportHtml,
} from "./report.js";
import { destroyCharts, renderChart } from "./charts.js";
import { exportReportToWord } from "./word-export.js";
import {
  createUI,
  initialiseColumnSortable,
  initialiseInvestigationSortable,
  renderBoundInputs,
  renderColumnDefinitions,
  renderDataGrid,
  renderExportChecklist,
  renderGraphCards,
  renderImprovementRows,
  renderInvestigationCycles,
  renderLimitationRows,
  renderSidebarStatus,
  renderStrengthRows,
  renderTemplateOptions,
  scrollToSection,
  setActiveSection,
  setConclusionPreview,
  setGraphStatus,
  setIntroductionPreview,
  setReportPreview,
  setReportPreviewToggleState,
  setReportPreviewVisibility,
  setSaveStatus,
  setWorkspacePreviewState,
} from "./ui.js";

const AUTO_SAVE_MS = 15000;
const NUMBER_PATHS = new Set(["data.rowCount"]);

const ui = createUI();
let investigationSortable = null;
let columnSortable = null;
let isDirty = false;
let statusText = "Ready";
let autosaveTimer = null;
let autosaveInProgress = false;
let isReportPreviewEnabled = true;

function formatDateTime(isoString) {
  if (!isoString) {
    return "";
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function updateStatus(message) {
  statusText = message;
  setSaveStatus(ui.saveStatus, statusText);
}

function markDirty() {
  isDirty = true;
  updateStatus("Unsaved changes.");
}

function deepGet(target, path) {
  return path.split(".").reduce((value, key) => (value ? value[key] : undefined), target);
}

function deepSet(target, path, value) {
  const keys = path.split(".");
  const finalKey = keys.pop();
  const destination = keys.reduce((value, key) => value[key], target);
  destination[finalKey] = value;
}

function ensureDataShape(dataState) {
  if (!Array.isArray(dataState.columns) || dataState.columns.length < 2) {
    dataState.columns = [
      { name: "Independent variable", unit: "" },
      { name: "Dependent variable", unit: "" },
    ];
  }

  const columnCount = dataState.columns.length;
  const rowCountRaw = Number.parseInt(dataState.rowCount, 10);
  const rowCount = Number.isFinite(rowCountRaw)
    ? Math.max(1, Math.min(200, rowCountRaw))
    : 3;

  dataState.rowCount = rowCount;

  if (!Array.isArray(dataState.rows)) {
    dataState.rows = [];
  }

  dataState.rows = dataState.rows
    .slice(0, rowCount)
    .map((row) => {
      const safeRow = Array.isArray(row) ? row.slice(0, columnCount) : [];
      while (safeRow.length < columnCount) {
        safeRow.push("");
      }
      return safeRow.map((cell) => (cell === null || cell === undefined ? "" : String(cell)));
    });

  while (dataState.rows.length < rowCount) {
    dataState.rows.push(Array.from({ length: columnCount }, () => ""));
  }
}

function updateStateAndMark(mutator, options = {}) {
  updateState((draft) => {
    mutator(draft);
    ensureDataShape(draft.data);
  });

  if (!options.skipDirty) {
    markDirty();
  }
}

function moveInvestigationCycle(oldIndex, newIndex) {
  if (oldIndex === newIndex) {
    return;
  }

  updateStateAndMark((draft) => {
    const cycles = draft.investigation.cycles;
    const [moved] = cycles.splice(oldIndex, 1);
    cycles.splice(newIndex, 0, moved);
  });
}

function moveItem(array, oldIndex, newIndex) {
  const [moved] = array.splice(oldIndex, 1);
  array.splice(newIndex, 0, moved);
}

function remapColumnIndex(index, oldIndex, newIndex) {
  if (!Number.isInteger(index)) {
    return index;
  }

  if (index === oldIndex) {
    return newIndex;
  }

  if (oldIndex < newIndex && index > oldIndex && index <= newIndex) {
    return index - 1;
  }

  if (oldIndex > newIndex && index >= newIndex && index < oldIndex) {
    return index + 1;
  }

  return index;
}

function moveDataColumn(oldIndex, newIndex) {
  if (oldIndex === newIndex) {
    return;
  }

  updateStateAndMark((draft) => {
    moveItem(draft.data.columns, oldIndex, newIndex);

    draft.data.rows = draft.data.rows.map((row) => {
      const nextRow = [...row];
      moveItem(nextRow, oldIndex, newIndex);
      return nextRow;
    });

    draft.graphs.cards = draft.graphs.cards.map((graph) => {
      const nextGraph = { ...graph };
      nextGraph.xColumn = remapColumnIndex(nextGraph.xColumn, oldIndex, newIndex);
      nextGraph.yColumns = (nextGraph.yColumns ?? []).map((value) =>
        remapColumnIndex(value, oldIndex, newIndex),
      );
      nextGraph.bubbleRadiusColumn =
        nextGraph.bubbleRadiusColumn === null || nextGraph.bubbleRadiusColumn === undefined
          ? null
          : remapColumnIndex(nextGraph.bubbleRadiusColumn, oldIndex, newIndex);
      return nextGraph;
    });
  });
}

function remapRemovedColumnIndex(index, removedIndex) {
  if (!Number.isInteger(index)) {
    return index;
  }

  if (index === removedIndex) {
    return null;
  }

  return index > removedIndex ? index - 1 : index;
}

function removeDataColumn(columnIndex) {
  updateStateAndMark((draft) => {
    draft.data.columns.splice(columnIndex, 1);
    draft.data.rows = draft.data.rows.map((row) => {
      const nextRow = [...row];
      nextRow.splice(columnIndex, 1);
      return nextRow;
    });

    draft.graphs.cards = draft.graphs.cards.map((graph) => {
      const nextGraph = { ...graph };
      nextGraph.xColumn = remapRemovedColumnIndex(nextGraph.xColumn, columnIndex);
      nextGraph.yColumns = (nextGraph.yColumns ?? [])
        .map((value) => remapRemovedColumnIndex(value, columnIndex))
        .filter((value) => value !== null);
      nextGraph.bubbleRadiusColumn =
        nextGraph.bubbleRadiusColumn === null || nextGraph.bubbleRadiusColumn === undefined
          ? null
          : remapRemovedColumnIndex(nextGraph.bubbleRadiusColumn, columnIndex);
      return nextGraph;
    });
  });
}

function parseBoundValue(target) {
  const path = target.dataset.bind;

  if (target.type === "checkbox") {
    return target.checked;
  }

  if (NUMBER_PATHS.has(path)) {
    const parsed = Number.parseInt(target.value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }

    return 1;
  }

  return target.value;
}

function parseArrayFieldValue(target) {
  const valueType = target.dataset.valueType;

  if (target.type === "checkbox") {
    return target.checked;
  }

  if (valueType === "number-list") {
    return Array.from(target.selectedOptions)
      .map((option) => Number.parseInt(option.value, 10))
      .filter((value) => Number.isFinite(value));
  }

  if (valueType === "number") {
    if (target.value === "") {
      return null;
    }

    const parsed = Number.parseInt(target.value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return target.value;
}

function captureActiveFieldSnapshot() {
  const activeElement = document.activeElement;
  if (
    !(
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLSelectElement
    )
  ) {
    return null;
  }

  const hasArrayMeta =
    typeof activeElement.dataset.array === "string" &&
    typeof activeElement.dataset.index === "string";
  const hasTableMeta =
    activeElement.dataset.tableCell === "true" &&
    typeof activeElement.dataset.row === "string" &&
    typeof activeElement.dataset.column === "string";
  const hasBindMeta = typeof activeElement.dataset.bind === "string";

  let meta = null;

  if (hasTableMeta) {
    meta = {
      kind: "table",
      row: activeElement.dataset.row,
      column: activeElement.dataset.column,
    };
  } else if (hasArrayMeta) {
    meta = {
      kind: "array",
      array: activeElement.dataset.array,
      index: activeElement.dataset.index,
      field: activeElement.dataset.field ?? "",
    };
  } else if (hasBindMeta) {
    meta = {
      kind: "bind",
      bind: activeElement.dataset.bind,
    };
  }

  if (!meta) {
    return null;
  }

  const hasSelection =
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement;

  return {
    ...meta,
    selectionStart: hasSelection ? activeElement.selectionStart : null,
    selectionEnd: hasSelection ? activeElement.selectionEnd : null,
    selectionDirection: hasSelection ? activeElement.selectionDirection : null,
  };
}

function findRestoredField(snapshot) {
  if (!snapshot) {
    return null;
  }

  if (snapshot.kind === "bind") {
    return document.querySelector(`[data-bind="${snapshot.bind}"]`);
  }

  if (snapshot.kind === "array") {
    const fieldSelector = snapshot.field
      ? `[data-field="${snapshot.field}"]`
      : ":not([data-field])";
    return document.querySelector(
      `[data-array="${snapshot.array}"][data-index="${snapshot.index}"]${fieldSelector}`,
    );
  }

  if (snapshot.kind === "table") {
    return document.querySelector(
      `[data-table-cell="true"][data-row="${snapshot.row}"][data-column="${snapshot.column}"]`,
    );
  }

  return null;
}

function restoreActiveFieldSnapshot(snapshot) {
  const field = findRestoredField(snapshot);
  if (!field) {
    return;
  }

  field.focus({ preventScroll: true });

  if (
    (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) &&
    snapshot.selectionStart !== null &&
    snapshot.selectionEnd !== null
  ) {
    field.setSelectionRange(
      snapshot.selectionStart,
      snapshot.selectionEnd,
      snapshot.selectionDirection ?? "none",
    );
  }
}

function handleBoundInput(target) {
  const path = target.dataset.bind;
  if (!path) {
    return false;
  }

  updateStateAndMark((draft) => {
    deepSet(draft, path, parseBoundValue(target));
  });

  return true;
}

function handleArrayInput(target) {
  const arrayPath = target.dataset.array;
  const indexValue = Number.parseInt(target.dataset.index, 10);

  if (!arrayPath || Number.isNaN(indexValue)) {
    return false;
  }

  updateStateAndMark((draft) => {
    const array = deepGet(draft, arrayPath);
    if (!Array.isArray(array) || !array[indexValue]) {
      return;
    }

    const field = target.dataset.field;
    if (!field) {
      return;
    }

    array[indexValue][field] = parseArrayFieldValue(target);
  });

  return true;
}

function handleDataCellInput(target) {
  if (target.dataset.tableCell !== "true") {
    return false;
  }

  const rowIndex = Number.parseInt(target.dataset.row, 10);
  const columnIndex = Number.parseInt(target.dataset.column, 10);
  if (Number.isNaN(rowIndex) || Number.isNaN(columnIndex)) {
    return false;
  }

  updateDataCell(rowIndex, columnIndex, target.value);
  return true;
}

function handleInput(event) {
  const target = event.target;
  if (
    !(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    )
  ) {
    return;
  }

  if (handleBoundInput(target)) {
    return;
  }

  if (handleArrayInput(target)) {
    return;
  }

  handleDataCellInput(target);
}

function addTrialColumn(draft) {
  const currentTrials = draft.data.columns.filter((column) =>
    String(column.name ?? "").toLowerCase().includes("trial"),
  ).length;

  draft.data.columns.push({
    name: `Trial ${currentTrials + 1}`,
    unit: draft.data.columns[1]?.unit ?? "",
  });
}

function updateDataCell(rowIndex, columnIndex, value) {
  updateStateAndMark((draft) => {
    if (!draft.data.rows[rowIndex]) {
      return;
    }

    draft.data.rows[rowIndex][columnIndex] = value;
  });
}

function applyReportPreviewUi(options = {}) {
  const { forceVisible = false } = options;
  const isPreviewVisible = forceVisible || isReportPreviewEnabled;
  setReportPreviewToggleState(ui.previewToggleButton, isReportPreviewEnabled);
  setReportPreviewVisibility(ui.previewPanel, isPreviewVisible);
  setWorkspacePreviewState(ui.workspace, isPreviewVisible);
}

async function handleAction(action, trigger) {
  switch (action) {
    case "apply-template": {
      const templateId = ui.templateSelect.value;
      if (!templateId) {
        updateStatus("Select a starter template first.");
        return;
      }

      const template = getTemplateById(templateId);
      if (!template) {
        updateStatus("Template could not be loaded.");
        return;
      }

      replaceState(template);
      isDirty = true;
      updateStatus("Template applied. Save when ready.");
      setActiveSection("setup");
      scrollToSection("setup");
      return;
    }

    case "save-now": {
      try {
        const savedAt = await saveToIndexedDb(getState());
        isDirty = false;
        updateStatus(`Saved to browser database at ${formatDateTime(savedAt)}.`);
      } catch (error) {
        console.error(error);
        updateStatus("Save failed. Check IndexedDB/browser storage availability.");
      }
      return;
    }

    case "load-saved": {
      try {
        const saved = await loadFromIndexedDb();
        if (!saved?.state) {
          updateStatus("No saved investigation found in browser database.");
          return;
        }

        replaceState(saved.state);
        isDirty = false;
        const when = formatDateTime(saved.savedAt);
        updateStatus(
          when ? `Loaded saved investigation from ${when}.` : "Loaded saved investigation.",
        );
      } catch (error) {
        console.error(error);
        updateStatus("Load failed. Check IndexedDB/browser storage availability.");
      }
      return;
    }

    case "export-json": {
      exportAsJson(getState());
      updateStatus("JSON export downloaded.");
      return;
    }

    case "export-word": {
      try {
        const state = getState();
        destroyCharts();
        const graphSnapshots = buildGraphSnapshots(state, { includeImageData: true });
        await exportReportToWord(state, { graphs: graphSnapshots });
        updateStatus("Word export downloaded (.docx).");
      } catch (error) {
        console.error(error);
        updateStatus("Word export failed. Check browser compatibility and try again.");
      }
      return;
    }

    case "import-json": {
      ui.importFileInput.click();
      return;
    }

    case "print-report": {
      if (!isReportPreviewEnabled) {
        const state = getState();
        destroyCharts();
        const graphSnapshots = buildGraphSnapshots(state, { includeImageData: true });
        setReportPreview(
          ui.reportPreview,
          buildReportHtml(state, {
            graphs: graphSnapshots,
          }),
        );
        applyReportPreviewUi({ forceVisible: true });

        window.addEventListener(
          "afterprint",
          () => {
            setReportPreview(ui.reportPreview, "");
            applyReportPreviewUi();
          },
          { once: true },
        );
      }

      window.print();
      return;
    }

    case "toggle-report-preview": {
      isReportPreviewEnabled = !isReportPreviewEnabled;
      updateStatus(
        isReportPreviewEnabled
          ? "Live report preview enabled."
          : "Live report preview disabled.",
      );
      renderApp();
      return;
    }

    case "open-instructions": {
      const opened = window.open("./instructions.html", "_blank");
      if (opened) {
        opened.opener = null;
      } else {
        window.location.href = "./instructions.html";
      }
      return;
    }

    case "clear-data": {
      const confirmed = window.confirm(
        "Clear all current mathematics investigation data and remove saved browser data?",
      );
      if (!confirmed) {
        return;
      }

      try {
        resetState();
        await clearSavedInvestigation();
        isDirty = false;
        updateStatus("All data cleared.");
      } catch (error) {
        console.error(error);
        updateStatus("Could not clear saved data from browser database.");
      }
      return;
    }

    case "add-investigation-cycle": {
      updateStateAndMark((draft) => {
        draft.investigation.cycles.push(createBlankInvestigationCycle());
      });
      return;
    }

    case "remove-investigation-cycle": {
      const index = Number.parseInt(trigger.dataset.index, 10);
      updateStateAndMark((draft) => {
        if (draft.investigation.cycles.length <= 1) {
          draft.investigation.cycles[0] = createBlankInvestigationCycle();
          return;
        }

        draft.investigation.cycles.splice(index, 1);
      });
      return;
    }

    case "add-column": {
      updateStateAndMark((draft) => {
        draft.data.columns.push({ name: `Column ${draft.data.columns.length + 1}`, unit: "" });
      });
      return;
    }

    case "remove-column": {
      const index = Number.parseInt(trigger.dataset.index, 10);
      if (getState().data.columns.length <= 2) {
        updateStatus("At least two columns are required.");
        return;
      }

      removeDataColumn(index);
      return;
    }

    case "add-trial-column": {
      updateStateAndMark((draft) => {
        addTrialColumn(draft);
      });
      return;
    }

    case "add-row": {
      if (getState().data.rowCount >= 200) {
        updateStatus("A maximum of 200 rows is allowed.");
        return;
      }

      updateStateAndMark((draft) => {
        draft.data.rowCount += 1;
        draft.data.rows.push(
          Array.from({ length: draft.data.columns.length }, () => ""),
        );
      });
      return;
    }

    case "add-graph-card": {
      updateStateAndMark((draft) => {
        draft.graphs.cards.push(createBlankGraphCard());
      });
      return;
    }

    case "remove-graph-card": {
      const index = Number.parseInt(trigger.dataset.index, 10);
      updateStateAndMark((draft) => {
        if (draft.graphs.cards.length <= 1) {
          return;
        }

        draft.graphs.cards.splice(index, 1);
      });
      return;
    }

    case "add-strength-row": {
      updateStateAndMark((draft) => {
        draft.analysis.strengths.push(createBlankAnalysisPoint());
      });
      return;
    }

    case "remove-strength-row": {
      const index = Number.parseInt(trigger.dataset.index, 10);
      updateStateAndMark((draft) => {
        if (draft.analysis.strengths.length <= 1) {
          draft.analysis.strengths[0] = createBlankAnalysisPoint();
          return;
        }

        draft.analysis.strengths.splice(index, 1);
      });
      return;
    }

    case "add-limitation-row": {
      updateStateAndMark((draft) => {
        draft.analysis.limitations.push(createBlankAnalysisPoint());
      });
      return;
    }

    case "remove-limitation-row": {
      const index = Number.parseInt(trigger.dataset.index, 10);
      updateStateAndMark((draft) => {
        if (draft.analysis.limitations.length <= 1) {
          draft.analysis.limitations[0] = createBlankAnalysisPoint();
          return;
        }

        draft.analysis.limitations.splice(index, 1);
      });
      return;
    }

    case "add-improvement-row": {
      updateStateAndMark((draft) => {
        draft.analysis.improvements.push(createBlankImprovementPoint());
      });
      return;
    }

    case "remove-improvement-row": {
      const index = Number.parseInt(trigger.dataset.index, 10);
      updateStateAndMark((draft) => {
        if (draft.analysis.improvements.length <= 1) {
          draft.analysis.improvements[0] = createBlankImprovementPoint();
          return;
        }

        draft.analysis.improvements.splice(index, 1);
      });
      return;
    }

    default:
      return;
  }
}

function handleDocumentClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const navTrigger = target.closest("[data-nav-target]");
  if (navTrigger) {
    const sectionId = navTrigger.dataset.navTarget;
    setActiveSection(sectionId);
    scrollToSection(sectionId);
    return;
  }

  const actionTrigger = target.closest("[data-action]");
  if (!actionTrigger) {
    return;
  }

  void handleAction(actionTrigger.dataset.action, actionTrigger);
}

async function handleImportFile(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  const file = input.files?.[0];
  if (!file) {
    return;
  }

  try {
    const raw = await readFileAsText(file);
    const imported = importFromJsonText(raw);
    replaceState(imported);
    isDirty = true;
    updateStatus(`Imported ${file.name}. Save to browser database when ready.`);
  } catch (error) {
    console.error(error);
    updateStatus("Import failed. Please check the JSON file format.");
  } finally {
    input.value = "";
  }
}

function attachSectionObserver() {
  const sections = Array.from(document.querySelectorAll(".section-card"));
  if (sections.length === 0 || typeof IntersectionObserver === "undefined") {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visible?.target?.dataset?.section) {
        setActiveSection(visible.target.dataset.section);
      }
    },
    {
      root: null,
      threshold: [0.2, 0.5, 0.8],
      rootMargin: "-15% 0px -55% 0px",
    },
  );

  sections.forEach((section) => observer.observe(section));
}

function buildGraphSnapshots(state, options = {}) {
  const { includeImageData = true } = options;
  const cards = Array.isArray(state.graphs?.cards) ? state.graphs.cards : [];

  return cards.map((graph, index) => {
    const canvas = ui.graphCards?.querySelector(`[data-graph-canvas="${index}"]`);
    const statusElement = ui.graphCards?.querySelector(`[data-graph-status="${index}"]`);
    const chartResult = renderChart(canvas, state, graph, index);
    const chartImageUrl =
      includeImageData && chartResult.ok && chartResult.imageDataUrl
        ? chartResult.imageDataUrl
        : includeImageData &&
            chartResult.ok &&
            typeof canvas?.toDataURL === "function"
          ? canvas.toDataURL("image/png")
          : "";

    if (statusElement) {
      setGraphStatus(statusElement, chartResult.message, !chartResult.ok);
    }

    return {
      title: `Graph ${index + 1}`,
      ok: chartResult.ok,
      message: chartResult.message,
      imageDataUrl: chartImageUrl,
    };
  });
}

function renderApp() {
  const focusSnapshot = captureActiveFieldSnapshot();
  const state = getState();

  applyReportPreviewUi();
  destroyCharts();
  renderBoundInputs(state);
  renderInvestigationCycles(ui.investigationCycles, state.investigation.cycles);
  renderColumnDefinitions(ui.columnDefinitions, state.data.columns);
  renderDataGrid(ui.dataGridContainer, ui.dataSummary, state.data, updateDataCell);
  renderGraphCards(ui.graphCards, state.graphs, state.data);
  renderStrengthRows(ui.strengthRows, state.analysis.strengths);
  renderLimitationRows(ui.limitationRows, state.analysis.limitations);
  renderImprovementRows(ui.improvementRows, state.analysis.improvements);

  const validationResults = validateAllSections(state);
  renderSidebarStatus(validationResults);
  renderExportChecklist(ui.exportChecklist, validationResults);

  setIntroductionPreview(ui.introductionPreview, buildIntroductionParagraph(state.introduction));
  setConclusionPreview(ui.conclusionPreview, buildConclusionParagraph(state.conclusion));

  const graphSnapshots = buildGraphSnapshots(state, {
    includeImageData: isReportPreviewEnabled,
  });
  if (isReportPreviewEnabled) {
    setReportPreview(
      ui.reportPreview,
      buildReportHtml(state, {
        graphs: graphSnapshots,
      }),
    );
  } else {
    setReportPreview(ui.reportPreview, "");
  }

  if (investigationSortable) {
    investigationSortable.destroy();
  }
  investigationSortable = initialiseInvestigationSortable(
    ui.investigationCycles,
    moveInvestigationCycle,
  );

  if (columnSortable) {
    columnSortable.destroy();
  }
  columnSortable = initialiseColumnSortable(ui.columnDefinitions, moveDataColumn);

  setSaveStatus(ui.saveStatus, statusText);
  restoreActiveFieldSnapshot(focusSnapshot);
}

function initialiseTemplates() {
  const templates = getTemplateList();
  renderTemplateOptions(ui.templateSelect, templates);
}

async function tryLoadExistingData() {
  try {
    const migration = await migrateLegacyLocalStorageToIndexedDb();
    const saved = await loadFromIndexedDb();
    if (!saved?.state) {
      updateStatus("Ready. Autosave to browser database is active every 15 seconds.");
      return;
    }

    replaceState(saved.state, { silent: true });
    isDirty = false;
    const when = formatDateTime(saved.savedAt);

    if (migration.migrated) {
      updateStatus(
        when
          ? `Loaded saved investigation from ${when}. Legacy localStorage data migrated to IndexedDB.`
          : "Loaded saved investigation. Legacy localStorage data migrated to IndexedDB.",
      );
      return;
    }

    updateStatus(
      when ? `Loaded saved investigation from ${when}.` : "Loaded saved investigation.",
    );
    return;
  } catch (error) {
    console.error(error);
    updateStatus("Ready. Could not load browser database. You can continue and save manually.");
  }
}

function startAutosave() {
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
  }

  autosaveTimer = window.setInterval(async () => {
    if (!isDirty || autosaveInProgress) {
      return;
    }

    autosaveInProgress = true;
    try {
      const savedAt = await saveToIndexedDb(getState());
      isDirty = false;
      updateStatus(`Autosaved at ${formatDateTime(savedAt)}.`);
    } catch (error) {
      console.error(error);
      updateStatus("Autosave failed. Try manual save.");
    } finally {
      autosaveInProgress = false;
    }
  }, AUTO_SAVE_MS);
}

async function init() {
  initialiseTemplates();
  await tryLoadExistingData();
  subscribe(renderApp);
  renderApp();

  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleInput);
  document.addEventListener("click", handleDocumentClick);
  ui.importFileInput.addEventListener("change", handleImportFile);

  attachSectionObserver();
  setActiveSection("setup");
  startAutosave();
}

void init();
