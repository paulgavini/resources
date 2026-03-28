import {
  createBlankControlledVariable,
  createBlankMaterial,
  createBlankRiskRow,
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
import { buildReportHtml, generateConclusionParagraph } from "./report.js";
import { renderChart } from "./charts.js";
import { exportReportToWord } from "./word-export.js";
import {
  createUI,
  initialiseMethodSortable,
  renderBoundInputs,
  renderColumnDefinitions,
  renderControlledVariables,
  renderDataGrid,
  renderExportChecklist,
  renderGraphAxisOptions,
  renderMaterials,
  renderMethodSteps,
  renderQuestionFeedback,
  renderRiskRows,
  renderSidebarStatus,
  renderTemplateOptions,
  scrollToSection,
  setActiveSection,
  setConclusionPreview,
  setGraphStatus,
  setReportPreview,
  setSaveStatus,
} from "./ui.js";

const AUTO_SAVE_MS = 15000;
const NUMBER_PATHS = new Set(["data.rowCount", "analysis.xColumn", "analysis.yColumn"]);

const ui = createUI();
let methodSortable = null;
let isDirty = false;
let statusText = "Ready";
let autosaveTimer = null;
let autosaveInProgress = false;

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
  // Keep table dimensions aligned when row/column settings change.
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
    : 5;

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

function moveMethodStep(oldIndex, newIndex) {
  if (oldIndex === newIndex) {
    return;
  }

  updateStateAndMark((draft) => {
    const steps = draft.method.steps;
    const [moved] = steps.splice(oldIndex, 1);
    steps.splice(newIndex, 0, moved);
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

    return path === "data.rowCount" ? 1 : 0;
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
  const restored = findRestoredField(snapshot);
  if (!(restored instanceof HTMLElement)) {
    return;
  }

  restored.focus({ preventScroll: true });

  if (
    (restored instanceof HTMLInputElement || restored instanceof HTMLTextAreaElement) &&
    snapshot.selectionStart !== null &&
    snapshot.selectionEnd !== null
  ) {
    try {
      restored.setSelectionRange(
        snapshot.selectionStart,
        snapshot.selectionEnd,
        snapshot.selectionDirection ?? "none",
      );
    } catch (error) {
      // Some input types do not support text selection ranges.
    }
  }
}

function handleBoundInput(target) {
  const path = target.dataset.bind;
  if (!path) {
    return false;
  }

  const value = parseBoundValue(target);
  updateStateAndMark((draft) => {
    deepSet(draft, path, value);
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

    if (arrayPath === "method.steps") {
      array[indexValue] = target.value;
      return;
    }

    const field = target.dataset.field;
    if (!field) {
      return;
    }

    array[indexValue][field] = target.value;
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

  updateStateAndMark((draft) => {
    if (!draft.data.rows[rowIndex]) {
      return;
    }

    draft.data.rows[rowIndex][columnIndex] = target.value;
  });

  return true;
}

function handleInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
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
        const { chartResult, chartImageUrl } = buildChartSnapshot(state);
        setGraphStatus(ui.graphStatus, chartResult.message, !chartResult.ok);

        await exportReportToWord(state, {
          chartImageUrl,
          chartStatus: chartResult.message,
        });
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
      window.print();
      return;
    }

    case "open-instructions": {
      const opened = window.open("./instructions.html", "_blank", "noopener,noreferrer");
      if (!opened) {
        window.location.href = "./instructions.html";
      }
      return;
    }

    case "clear-data": {
      const confirmed = window.confirm(
        "Clear all current investigation data and remove saved browser data?",
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

    case "add-controlled": {
      updateStateAndMark((draft) => {
        draft.variables.controlled.push(createBlankControlledVariable());
      });
      return;
    }

    case "remove-controlled": {
      const index = Number.parseInt(trigger.dataset.index, 10);
      updateStateAndMark((draft) => {
        if (draft.variables.controlled.length <= 1) {
          draft.variables.controlled[0] = createBlankControlledVariable();
          return;
        }

        draft.variables.controlled.splice(index, 1);
      });
      return;
    }

    case "add-risk-row": {
      updateStateAndMark((draft) => {
        draft.risks.push(createBlankRiskRow());
      });
      return;
    }

    case "remove-risk-row": {
      const index = Number.parseInt(trigger.dataset.index, 10);
      updateStateAndMark((draft) => {
        if (draft.risks.length <= 1) {
          draft.risks[0] = createBlankRiskRow();
          return;
        }

        draft.risks.splice(index, 1);
      });
      return;
    }

    case "add-material": {
      updateStateAndMark((draft) => {
        draft.materials.push(createBlankMaterial());
      });
      return;
    }

    case "remove-material": {
      const index = Number.parseInt(trigger.dataset.index, 10);
      updateStateAndMark((draft) => {
        if (draft.materials.length <= 1) {
          draft.materials[0] = createBlankMaterial();
          return;
        }

        draft.materials.splice(index, 1);
      });
      return;
    }

    case "add-method-step": {
      updateStateAndMark((draft) => {
        draft.method.steps.push("");
      });
      return;
    }

    case "remove-method-step": {
      const index = Number.parseInt(trigger.dataset.index, 10);
      updateStateAndMark((draft) => {
        if (draft.method.steps.length <= 1) {
          draft.method.steps[0] = "";
          return;
        }

        draft.method.steps.splice(index, 1);
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

      updateStateAndMark((draft) => {
        draft.data.columns.splice(index, 1);
      });
      return;
    }

    case "add-trial-column": {
      updateStateAndMark((draft) => {
        addTrialColumn(draft);
      });
      return;
    }

    case "regenerate-data-table": {
      updateStateAndMark((draft) => {
        ensureDataShape(draft.data);
      });
      updateStatus("Data table regenerated.");
      return;
    }

    default:
      return;
  }
}

function handleDocumentClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
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

function renderApp() {
  const focusSnapshot = captureActiveFieldSnapshot();
  const state = getState();

  renderBoundInputs(state);
  renderControlledVariables(ui.controlledRows, state.variables.controlled);
  renderRiskRows(ui.riskRows, state.risks);
  renderMaterials(ui.materialsRows, state.materials);
  renderMethodSteps(ui.methodSteps, state.method.steps);
  renderColumnDefinitions(ui.columnDefinitions, state.data.columns);
  renderDataGrid(ui.dataGridContainer, ui.dataSummary, state.data);
  renderGraphAxisOptions(ui.graphXSelect, ui.graphYSelect, state.data, state.analysis);
  renderQuestionFeedback(ui.questionFeedback, state.question.text);

  const validationResults = validateAllSections(state);
  renderSidebarStatus(validationResults);
  renderExportChecklist(ui.exportChecklist, validationResults);

  const conclusionParagraph = generateConclusionParagraph(state.conclusion);
  setConclusionPreview(ui.conclusionPreview, conclusionParagraph);

  const { chartResult, chartImageUrl } = buildChartSnapshot(state);
  setGraphStatus(ui.graphStatus, chartResult.message, !chartResult.ok);
  setReportPreview(
    ui.reportPreview,
    buildReportHtml(state, {
      chartImageUrl,
      chartStatus: chartResult.message,
    }),
  );

  // Re-initialise sortable after method list rerender.
  if (methodSortable) {
    methodSortable.destroy();
  }
  methodSortable = initialiseMethodSortable(ui.methodSteps, moveMethodStep);

  setSaveStatus(ui.saveStatus, statusText);
  restoreActiveFieldSnapshot(focusSnapshot);
}

function buildChartSnapshot(state) {
  const chartResult = renderChart(ui.chartCanvas, state);
  const chartImageUrl =
    chartResult.ok && chartResult.imageDataUrl
      ? chartResult.imageDataUrl
      : chartResult.ok && typeof ui.chartCanvas?.toDataURL === "function"
      ? ui.chartCanvas.toDataURL("image/png")
      : "";

  return {
    chartResult,
    chartImageUrl,
  };
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
