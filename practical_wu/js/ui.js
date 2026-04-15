import { validateResearchQuestion, SECTION_ORDER } from "./validation.js";
import { getDisplayCellValue, getDisplayColumns } from "./charts.js";

let dataGridInstance = null;

const GRAPH_TYPE_OPTIONS = [
  { value: "line", label: "Line" },
  { value: "scatter", label: "Scatter" },
  { value: "bar", label: "Bar" },
  { value: "bubble", label: "Bubble" },
  { value: "pie", label: "Pie" },
  { value: "doughnut", label: "Doughnut" },
  { value: "polarArea", label: "Polar area" },
  { value: "radar", label: "Radar" },
];

const HELP_CONTENT = {
  researchQuestion:
    "Write a testable question that links what you will change with what you will measure. SACE expects inquiry questions to guide investigation design, data collection, analysis, and evidence-based conclusions, so define the relationship clearly and avoid vague wording.",
  hypothesis:
    "Write a testable prediction or tentative explanation based on prior science knowledge or observations, not just a guess. A strong hypothesis suggests the likely relationship between the independent and dependent variables.",
  scientificReasoning:
    "Explain the science ideas that make your prediction plausible. Use the relevant concepts, models, or mechanisms so the reader understands why you expect that outcome.",
  independentVariable:
    "This is the factor you deliberately change. In a fair test, change one main factor at a time so any effect can be linked to that variable.",
  dependentVariable:
    "This is the outcome you measure or observe. State it precisely enough that someone can tell exactly what data will be recorded and in what unit.",
  controlledVariables:
    "List the factors that must stay the same so the investigation remains a fair test. Controlling other relevant variables improves validity because it makes it more likely that changes in the results are due to the independent variable.",
  controlledVariableName:
    "Name the factor that must stay constant, such as volume, time, concentration, mass, distance, or surface area.",
  controlledVariableReason:
    "Explain how this factor could affect the dependent variable if it changed during the investigation.",
  controlledVariableControl:
    "Describe the exact action you will take to keep this factor the same in every trial.",
  hazard:
    "Name the source of harm, such as a chemical, flame, glassware, sharp edge, hot object, or spill risk.",
  risk:
    "State what could actually go wrong because of that hazard, such as burns, cuts, skin irritation, or inaccurate handling.",
  precaution:
    "Describe the specific control measure that reduces the risk, such as goggles, tying hair back, careful heating, or cleaning spills immediately.",
  materialItem:
    "List each item specifically enough that another student could gather the same equipment or substance.",
  materialQuantity:
    "Record how many items or how much of the material is needed for the investigation.",
  materialUnit:
    "Add the correct unit where needed, such as mL, g, cm, s, or degrees C.",
  methodSection:
    "Write numbered steps so another student could repeat the investigation. Include equipment setup, what you will change, what you will measure, how many repeats you will do, and the key safety actions.",
  dataAverage:
    "Use this when you collect repeated measurements for the same condition and want one summary value for comparison or graphing. It is most useful when the trial columns are measuring the same thing in the same units.",
  dataStandardDeviation:
    "Use this when you want to show the spread of repeated results. Standard deviation helps indicate how consistent the repeated measurements were.",
  dataColumnSettings:
    "Name each column precisely so it is obvious what is being recorded. Good headings identify the variable, condition, trial, or calculated value clearly.",
  dataColumnName:
    "Use a column heading that tells the reader exactly what this column contains, such as time, trial 1, average force, or temperature.",
  dataColumnUnit:
    "Use the measurement unit that matches the data in the column so graphs and conclusions can be interpreted correctly.",
  dataEntryTable:
    "Enter raw or processed values consistently. Keep units, decimal places, and measurement precision sensible for the instrument and investigation.",
  graphType:
    "Choose the graph type that best matches the data. Line and scatter usually suit relationships between variables, bar suits category comparisons, and bubble adds a third numeric variable through bubble size.",
  trendline:
    "Use a trendline only when it helps interpret the relationship and suits the graph type. In this builder, trendlines are most meaningful when one Y-axis series is selected.",
  xAxisColumn:
    "Select the variable or category that should go on the horizontal axis. In many practical investigations this is the independent variable.",
  yAxisColumns:
    "Select the measured result or results to compare on the vertical axis. You can compare trials, averages, or different dependent measures here.",
  bubbleRadiusColumn:
    "For bubble charts, choose a third numeric variable that should control bubble size. It should not duplicate the X-axis or Y-axis selection.",
  startAtOrigin:
    "Start at zero only when it helps the graph communicate the data fairly. A zero origin can make comparisons clearer, but it can also compress small differences.",
  graphCommentary:
    "Summarise what the graph shows before deeper evaluation. Focus on the main pattern, comparison, relationship, or anomaly supported by the displayed data.",
  trendDescription:
    "Describe the overall relationship shown by the data. Mention whether the dependent variable increases, decreases, levels out, peaks, or changes proportionally.",
  anomalies:
    "Identify results that do not fit the main pattern and suggest scientifically plausible reasons, such as measurement error, uncontrolled variables, or equipment limits.",
  hypothesisSupported:
    "Judge whether the evidence supports, partly supports, or does not support the hypothesis. Base this on the data rather than on whether the result was expected.",
  validity:
    "Validity is about whether the method was a fair and suitable test of the question. Consider controlled variables, measurement quality, range of values, and whether the investigation actually tested what it claimed to test.",
  reliability:
    "Reliability is about consistency. Comment on repeats, spread of results, sample size, and whether the same method would likely produce similar data again.",
  evaluationLimitations:
    "Explain the weaknesses in the method, equipment, sample, or data that reduced confidence in the result, and say how each weakness affected the investigation.",
  evaluationImprovements:
    "Suggest realistic changes that directly address the stated limitations. Strong improvements explain what to change and how that would improve validity, reliability, or measurement quality.",
  claim:
    "State a clear answer to the research question. The claim should match the pattern shown by the results rather than simply repeating the hypothesis.",
  evidence:
    "Support the claim with specific data, averages, graph features, or comparisons. Strong evidence includes numbers, units, and clear references to the results.",
  reasoning:
    "Explain why the evidence supports the claim using scientific ideas. Link the pattern in the data back to the underlying science, not just to the raw numbers.",
};

function getByPath(source, path) {
  return path.split(".").reduce((value, key) => (value ? value[key] : undefined), source);
}

function toDisplayString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function escapeAttr(value) {
  return toDisplayString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeHtml(value) {
  return toDisplayString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderHelpText(label, key) {
  return `<span data-help-key="${escapeAttr(key)}">${escapeHtml(label)}</span>`;
}

function setInputValue(input, value) {
  if (input.type === "checkbox") {
    input.checked = Boolean(value);
    return;
  }

  const displayValue = toDisplayString(value);
  if (input === document.activeElement && input.value === displayValue) {
    return;
  }

  input.value = displayValue;
}

function formatColumnOptionLabel(column) {
  return `${column.name}${column.unit ? ` (${column.unit})` : ""}`;
}

function getPreviewToggleIconMarkup(isEnabled) {
  const label = isEnabled ? "Disable preview" : "Enable preview";
  const icon = isEnabled
    ? `
      <svg class="button-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M1.5 8s2.3-4 6.5-4 6.5 4 6.5 4-2.3 4-6.5 4S1.5 8 1.5 8Z" />
        <circle cx="8" cy="8" r="2" />
      </svg>
    `
    : `
      <svg class="button-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M1.5 8s2.3-4 6.5-4c1.7 0 3.1.6 4.2 1.4" />
        <path d="M14.5 8s-2.3 4-6.5 4c-1.7 0-3.1-.6-4.2-1.4" />
        <path d="M6.7 6.7A2 2 0 0 1 9.3 9.3" />
        <path d="M2.5 2.5l11 11" />
      </svg>
    `;

  return `${icon}<span class="sr-only">${escapeHtml(label)}</span>`;
}

export function createUI() {
  const dom = {
    workspace: document.querySelector(".workspace"),
    editor: document.getElementById("editor"),
    sectionNav: document.getElementById("section-nav"),
    saveStatus: document.getElementById("save-status"),
    templateSelect: document.getElementById("template-select"),
    controlledRows: document.getElementById("controlled-rows"),
    riskRows: document.getElementById("risk-rows"),
    materialsRows: document.getElementById("materials-rows"),
    methodSteps: document.getElementById("method-steps"),
    columnDefinitions: document.getElementById("column-definitions"),
    dataGridContainer: document.getElementById("data-grid-container"),
    dataSummary: document.getElementById("data-summary"),
    analysisGraphs: document.getElementById("analysis-graphs"),
    questionFeedback: document.getElementById("question-feedback"),
    conclusionPreview: document.getElementById("conclusion-paragraph-preview"),
    previewPanel: document.getElementById("preview-panel"),
    previewToggleButton: document.getElementById("toggle-report-preview"),
    reportPreview: document.getElementById("report-preview"),
    exportChecklist: document.getElementById("export-checklist"),
    importFileInput: document.getElementById("import-file"),
  };

  return dom;
}

export function renderBoundInputs(state) {
  document.querySelectorAll("[data-bind]").forEach((input) => {
    const path = input.dataset.bind;
    const value = getByPath(state, path);
    setInputValue(input, value);
  });
}

export function renderTemplateOptions(selectElement, templates) {
  const options = [
    '<option value="">Select template...</option>',
    ...templates.map(
      (template) =>
        `<option value="${escapeAttr(template.id)}">${escapeHtml(template.name)}</option>`,
    ),
  ];

  selectElement.innerHTML = options.join("");
}

export function renderControlledVariables(container, controlledRows) {
  container.innerHTML = controlledRows
    .map(
      (row, index) => `
      <div class="dynamic-row three">
        <label>
          ${renderHelpText("Variable name", "controlledVariableName")}
          <input type="text" data-array="variables.controlled" data-index="${index}" data-field="name" value="${escapeAttr(row.name)}" />
        </label>
        <label>
          ${renderHelpText("Why must it be controlled?", "controlledVariableReason")}
          <input type="text" data-array="variables.controlled" data-index="${index}" data-field="reason" value="${escapeAttr(row.reason)}" />
        </label>
        <label>
          ${renderHelpText("How will it be controlled?", "controlledVariableControl")}
          <input type="text" data-array="variables.controlled" data-index="${index}" data-field="controlMethod" value="${escapeAttr(row.controlMethod)}" />
        </label>
        <button class="secondary" type="button" data-action="remove-controlled" data-index="${index}">Remove</button>
      </div>
    `,
    )
    .join("");
}

export function renderRiskRows(container, risks) {
  container.innerHTML = risks
    .map(
      (risk, index) => `
      <tr>
        <td><input type="text" data-array="risks" data-index="${index}" data-field="hazard" value="${escapeAttr(risk.hazard)}" /></td>
        <td><input type="text" data-array="risks" data-index="${index}" data-field="risk" value="${escapeAttr(risk.risk)}" /></td>
        <td><input type="text" data-array="risks" data-index="${index}" data-field="precaution" value="${escapeAttr(risk.precaution)}" /></td>
        <td><button class="secondary" type="button" data-action="remove-risk-row" data-index="${index}">Remove</button></td>
      </tr>
    `,
    )
    .join("");
}

export function renderMaterials(container, materials) {
  container.innerHTML = materials
    .map(
      (material, index) => `
      <tr>
        <td><input type="text" data-array="materials" data-index="${index}" data-field="item" value="${escapeAttr(material.item)}" /></td>
        <td><input type="text" data-array="materials" data-index="${index}" data-field="quantity" value="${escapeAttr(material.quantity)}" /></td>
        <td><input type="text" data-array="materials" data-index="${index}" data-field="unit" value="${escapeAttr(material.unit)}" /></td>
        <td><button class="secondary" type="button" data-action="remove-material" data-index="${index}">Remove</button></td>
      </tr>
    `,
    )
    .join("");
}

export function renderMethodSteps(container, steps) {
  container.innerHTML = steps
    .map(
      (step, index) => `
      <li class="method-item" data-method-index="${index}">
        <span class="drag-handle" aria-label="Drag to reorder" title="Drag to reorder">::</span>
        <input type="text" data-array="method.steps" data-index="${index}" value="${escapeAttr(step)}" />
        <button class="secondary" type="button" data-action="remove-method-step" data-index="${index}">Remove</button>
      </li>
    `,
    )
    .join("");
}

export function initialiseMethodSortable(container, onReorder) {
  if (!container || typeof window.Sortable === "undefined") {
    return null;
  }

  return window.Sortable.create(container, {
    animation: 120,
    handle: ".drag-handle",
    onEnd(event) {
      if (event.oldIndex === undefined || event.newIndex === undefined) {
        return;
      }
      onReorder(event.oldIndex, event.newIndex);
    },
  });
}

export function initialiseColumnSortable(container, onReorder) {
  if (!container || typeof window.Sortable === "undefined") {
    return null;
  }

  return window.Sortable.create(container, {
    animation: 120,
    handle: ".drag-handle",
    onEnd(event) {
      if (event.oldIndex === undefined || event.newIndex === undefined) {
        return;
      }

      onReorder(event.oldIndex, event.newIndex);
    },
  });
}

export function renderColumnDefinitions(container, columns) {
  container.innerHTML = columns
    .map(
      (column, index) => `
      <div class="dynamic-row column">
        <div class="column-drag-cell">
          <span class="drag-handle" aria-label="Drag to reorder column" title="Drag to reorder column">::</span>
        </div>
        <label>
          ${renderHelpText("Column name", "dataColumnName")}
          <input type="text" data-array="data.columns" data-index="${index}" data-field="name" value="${escapeAttr(column.name)}" />
        </label>
        <label>
          ${renderHelpText("Unit", "dataColumnUnit")}
          <input type="text" data-array="data.columns" data-index="${index}" data-field="unit" value="${escapeAttr(column.unit)}" />
        </label>
        <button class="secondary" type="button" data-action="remove-column" data-index="${index}">Remove</button>
      </div>
    `,
    )
    .join("");
}

function parseNumeric(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateAverageFromValues(values) {
  const numeric = values.map((value) => parseNumeric(value)).filter((value) => value !== null);
  if (numeric.length === 0) {
    return "";
  }

  const average = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  return Number.isFinite(average) ? average.toFixed(2) : "";
}

function calculateStandardDeviationFromValues(values) {
  const numeric = values.map((value) => parseNumeric(value)).filter((value) => value !== null);
  if (numeric.length < 2) {
    return "";
  }

  const mean = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  const variance =
    numeric.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (numeric.length - 1);
  const standardDeviation = Math.sqrt(variance);
  return Number.isFinite(standardDeviation) ? standardDeviation.toFixed(2) : "";
}

function destroyDataGrid() {
  if (dataGridInstance && typeof dataGridInstance.destroy === "function") {
    dataGridInstance.destroy();
  }

  dataGridInstance = null;
}

function renderFallbackTable(container, summaryElement, data) {
  const columns = data.columns ?? [];
  const rows = data.rows ?? [];

  if (columns.length === 0) {
    container.innerHTML = '<p class="support-text">Add columns to generate data entry fields.</p>';
    summaryElement.textContent = "";
    return;
  }

  const displayColumns = getDisplayColumns(data);
  const headCells = displayColumns
    .map(
      (column) =>
        `<th>${escapeHtml(column.name)}${column.unit ? ` (${escapeHtml(column.unit)})` : ""}</th>`,
    )
    .join("");

  const bodyRows = rows
    .map((row, rowIndex) => {
      const cells = displayColumns
        .map((column) => {
          if (column.source === "base") {
            return `<td><input type="text" data-table-cell="true" data-row="${rowIndex}" data-column="${column.sourceIndex}" value="${escapeAttr(row[column.sourceIndex])}" /></td>`;
          }

          return `<td><output>${escapeHtml(getDisplayCellValue(data, row, column))}</output></td>`;
        })
        .join("");

      return `<tr><td><strong>${rowIndex + 1}</strong></td>${cells}</tr>`;
    })
    .join("");

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Row</th>
          ${headCells}
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `;

  const trialCount = columns.filter((column) =>
    String(column.name ?? "").toLowerCase().includes("trial"),
  ).length;
  summaryElement.textContent = `Columns: ${columns.length}. Rows: ${rows.length}. Trial columns: ${trialCount}.`;
}

function createDataCellEditor(onCellEdited, onCellPastedText) {
  return function dataCellEditor(cell, onRendered, success, cancel) {
    const editor = document.createElement("input");
    const initialValue = String(cell.getValue() ?? "");
    editor.type = "text";
    editor.value = initialValue;
    editor.style.width = "100%";
    editor.style.height = "100%";
    editor.style.padding = "0";
    editor.style.margin = "0";
    editor.style.border = "none";
    editor.style.outline = "none";
    editor.style.background = "transparent";
    editor.style.boxSizing = "border-box";
    editor.style.font = "inherit";

    const rowIndex = Number.parseInt(cell.getRow().getData().__index, 10);
    const columnIndex = Number.parseInt(String(cell.getField()).slice(4), 10);
    editor.dataset.tableCell = "true";
    editor.dataset.row = String(rowIndex);
    editor.dataset.column = String(columnIndex);

    const syncValue = () => {
      if (Number.isNaN(rowIndex) || Number.isNaN(columnIndex)) {
        return;
      }

      onCellEdited(rowIndex, columnIndex, editor.value);
    };

    onRendered(() => {
      editor.focus();
      editor.select();
    });

    editor.addEventListener("input", syncValue);
    editor.addEventListener("change", syncValue);
    editor.addEventListener("blur", () => {
      syncValue();
      success(editor.value);
    });
    editor.addEventListener("paste", (event) => {
      if (typeof onCellPastedText !== "function") {
        return;
      }

      const pastedText = event.clipboardData?.getData("text/plain");
      if (typeof pastedText !== "string") {
        return;
      }

      const pasteResult = onCellPastedText(rowIndex, columnIndex, pastedText);
      if (!pasteResult?.handled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      editor.value = String(pasteResult.topLeftValue ?? "");
      success(editor.value);
    });
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        syncValue();
        success(editor.value);
      } else if (event.key === "Escape") {
        if (editor.value !== initialValue) {
          onCellEdited(rowIndex, columnIndex, initialValue);
        }
        cancel();
      }
    });

    return editor;
  };
}

export function renderDataGrid(
  container,
  summaryElement,
  data,
  onCellEdited,
  onCellPastedText,
) {
  destroyDataGrid();

  const columns = data.columns ?? [];
  const rows = data.rows ?? [];

  if (columns.length === 0) {
    container.innerHTML = '<p class="support-text">Add columns to generate data entry fields.</p>';
    summaryElement.textContent = "";
    return;
  }

  if (typeof window.Tabulator === "undefined") {
    renderFallbackTable(container, summaryElement, data);
    return;
  }

  const tableRows = rows.map((row, rowIndex) => {
    const record = {
      __index: rowIndex,
      __row: rowIndex + 1,
    };

    columns.forEach((column, columnIndex) => {
      record[`col_${columnIndex}`] = row[columnIndex] ?? "";
    });

    return record;
  });

  const tabulatorColumns = [
    {
      title: "Row",
      field: "__row",
      hozAlign: "center",
      width: 76,
      frozen: true,
      headerSort: false,
    },
    ...columns.map((column, columnIndex) => ({
      title: formatColumnOptionLabel(column),
      field: `col_${columnIndex}`,
      editor: createDataCellEditor(onCellEdited, onCellPastedText),
      headerSort: false,
      minWidth: 150,
    })),
  ];

  if (data.includeAverage) {
    tabulatorColumns.push({
      title: `Average${columns[1]?.unit ? ` (${columns[1].unit})` : ""}`,
      field: "__average",
      headerSort: false,
      editor: false,
      formatter(cell) {
        const rowData = cell.getRow().getData();
        const values = columns.slice(1).map((_, index) => rowData[`col_${index + 1}`]);
        return calculateAverageFromValues(values);
      },
    });
  }

  if (data.includeStandardDeviation) {
    tabulatorColumns.push({
      title: `Standard deviation${columns[1]?.unit ? ` (${columns[1].unit})` : ""}`,
      field: "__standardDeviation",
      headerSort: false,
      editor: false,
      formatter(cell) {
        const rowData = cell.getRow().getData();
        const values = columns.slice(1).map((_, index) => rowData[`col_${index + 1}`]);
        return calculateStandardDeviationFromValues(values);
      },
    });
  }

  dataGridInstance = new window.Tabulator(container, {
    data: tableRows,
    layout: "fitDataStretch",
    reactiveData: false,
    index: "__index",
    columnDefaults: {
      vertAlign: "middle",
    },
    columns: tabulatorColumns,
    cellEdited(cell) {
      const field = cell.getField();
      if (!field.startsWith("col_")) {
        return;
      }

      const columnIndex = Number.parseInt(field.slice(4), 10);
      const rowIndex = Number.parseInt(cell.getRow().getData().__index, 10);
      if (Number.isNaN(rowIndex) || Number.isNaN(columnIndex)) {
        return;
      }

      onCellEdited(rowIndex, columnIndex, String(cell.getValue() ?? ""));
    },
  });

  const trialCount = columns.filter((column) =>
    String(column.name ?? "").toLowerCase().includes("trial"),
  ).length;
  summaryElement.textContent = `Columns: ${columns.length}. Rows: ${rows.length}. Trial columns: ${trialCount}.`;
}

export function renderAnalysisGraphs(container, analysis, data) {
  const displayColumns = getDisplayColumns(data);
  const graphs = Array.isArray(analysis?.graphs) ? analysis.graphs : [];

  container.innerHTML = graphs
    .map((graph, index) => {
      const xColumn = Number.parseInt(graph.xColumn, 10);
      const selectedYColumns = new Set((graph.yColumns ?? []).map((value) => String(value)));
      const selectedRadiusColumn =
        graph.bubbleRadiusColumn === null || graph.bubbleRadiusColumn === undefined
          ? ""
          : String(graph.bubbleRadiusColumn);
      const supportsTrendline =
        graph.graphType === "line" || graph.graphType === "scatter";
      const graphTypeOptions = GRAPH_TYPE_OPTIONS.map(
        (option) =>
          `<option value="${option.value}"${graph.graphType === option.value ? " selected" : ""}>${escapeHtml(option.label)}</option>`,
      ).join("");
      const xOptions = displayColumns
        .map(
          (column, columnIndex) =>
            `<option value="${columnIndex}"${columnIndex === xColumn ? " selected" : ""}>${escapeHtml(formatColumnOptionLabel(column))}</option>`,
        )
        .join("");
      const yOptions = displayColumns
        .map((column, columnIndex) => ({ column, columnIndex }))
        .filter(({ columnIndex }) => columnIndex !== xColumn)
        .map(
          ({ column, columnIndex }) =>
            `<option value="${columnIndex}"${selectedYColumns.has(String(columnIndex)) ? " selected" : ""}>${escapeHtml(formatColumnOptionLabel(column))}</option>`,
        )
        .join("");
      const excludedRadiusColumns = new Set([
        String(xColumn),
        ...(graph.yColumns ?? []).map((value) => String(value)),
      ]);
      const bubbleRadiusOptions = [
        '<option value="">Select radius column...</option>',
        ...displayColumns
          .map((column, columnIndex) => ({ column, columnIndex }))
          .filter(({ columnIndex }) => !excludedRadiusColumns.has(String(columnIndex)))
          .map(
            ({ column, columnIndex }) =>
              `<option value="${columnIndex}"${selectedRadiusColumn === String(columnIndex) ? " selected" : ""}>${escapeHtml(formatColumnOptionLabel(column))}</option>`,
          ),
      ].join("");
      const multiSelectSize = Math.max(2, Math.min(6, displayColumns.length - 1));
      const trendlineHint = supportsTrendline
        ? "Trendlines apply when one Y-axis column is selected."
        : "Trendlines are only available for line and scatter charts.";
      const bubbleHint =
        graph.graphType === "bubble"
          ? " Bubble charts also need a separate radius column."
          : "";

      return `
        <div class="analysis-graph-card">
          <div class="analysis-graph-header">
            <h3>Graph ${index + 1}</h3>
            ${
              index > 0
                ? `<button class="secondary" type="button" data-action="remove-analysis-graph" data-index="${index}">Delete graph</button>`
                : ""
            }
          </div>
          <div class="grid two-col analysis-graph-controls">
            <label>
              ${renderHelpText("Graph type", "graphType")}
              <select data-array="analysis.graphs" data-index="${index}" data-field="graphType">
                ${graphTypeOptions}
              </select>
            </label>
            <label>
              ${renderHelpText("Trendline", "trendline")}
              <select data-array="analysis.graphs" data-index="${index}" data-field="trendlineType"${supportsTrendline ? "" : " disabled"}>
                <option value="none"${graph.trendlineType === "none" ? " selected" : ""}>None</option>
                <option value="linear"${graph.trendlineType === "linear" ? " selected" : ""}>Linear</option>
                <option value="quadratic"${graph.trendlineType === "quadratic" ? " selected" : ""}>Quadratic</option>
                <option value="exponential"${graph.trendlineType === "exponential" ? " selected" : ""}>Exponential</option>
                <option value="logarithmic"${graph.trendlineType === "logarithmic" ? " selected" : ""}>Logarithmic</option>
                <option value="power"${graph.trendlineType === "power" ? " selected" : ""}>Power</option>
                <option value="moving-average"${graph.trendlineType === "moving-average" ? " selected" : ""}>Moving average</option>
              </select>
            </label>
            <label>
              ${renderHelpText("X-axis column", "xAxisColumn")}
              <select
                data-array="analysis.graphs"
                data-index="${index}"
                data-field="xColumn"
                data-value-type="number"
              >${xOptions}</select>
            </label>
            <label>
              ${renderHelpText("Y-axis column(s)", "yAxisColumns")}
              <select
                class="axis-multiselect"
                multiple
                size="${multiSelectSize}"
                data-array="analysis.graphs"
                data-index="${index}"
                data-field="yColumns"
                data-value-type="number-list"
              >${yOptions}</select>
            </label>
            ${
              graph.graphType === "bubble"
                ? `
                  <label>
                    ${renderHelpText("Bubble radius column", "bubbleRadiusColumn")}
                    <select
                      data-array="analysis.graphs"
                      data-index="${index}"
                      data-field="bubbleRadiusColumn"
                      data-value-type="number"
                    >${bubbleRadiusOptions}</select>
                  </label>
                `
                : ""
            }
            <label class="checkbox-label">
              <input
                type="checkbox"
                data-array="analysis.graphs"
                data-index="${index}"
                data-field="startAtOrigin"
                ${graph.startAtOrigin ? "checked" : ""}
              />
              ${renderHelpText("Force compatible axes to start at zero", "startAtOrigin")}
            </label>
          </div>
          <p class="support-text">Hold Ctrl (Windows) or Cmd (Mac) to select multiple Y-axis columns. ${trendlineHint}${bubbleHint}</p>
          <div class="chart-wrap">
            <canvas data-graph-canvas="${index}" aria-label="Investigation graph ${index + 1}"></canvas>
          </div>
          <p class="support-text" data-graph-status="${index}" aria-live="polite"></p>
        </div>
      `;
    })
    .join("");
}

export function applyHelpText(root = document) {
  root.querySelectorAll("[data-help-key]").forEach((element) => {
    const text = HELP_CONTENT[element.dataset.helpKey];
    if (!text) {
      return;
    }

    element.classList.add("help-target");
    element.setAttribute("data-help", text);
  });
}

export function renderQuestionFeedback(container, questionText) {
  const feedback = validateResearchQuestion(questionText);
  const levelLabelMap = {
    blank: "Blank",
    "too-vague": "Too vague",
    "needs-improvement": "Needs improvement",
    good: "Good",
  };

  container.classList.remove("is-good", "is-needs-improvement", "is-too-vague");
  if (feedback.level === "good") {
    container.classList.add("is-good");
  } else if (feedback.level === "needs-improvement") {
    container.classList.add("is-needs-improvement");
  } else {
    container.classList.add("is-too-vague");
  }

  const positivesHtml =
    feedback.positives.length > 0
      ? `
        <p class="validation-subhead">Strengths</p>
        <ul class="validation-list">
          ${feedback.positives.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      `
      : "";

  const warningsHtml =
    feedback.warnings.length > 0
      ? `
        <p class="validation-subhead">Suggestions</p>
        <ul class="validation-list">
          ${feedback.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      `
      : "";

  container.innerHTML = `
    <div class="validation-heading">
      <strong>Status: ${levelLabelMap[feedback.level] ?? feedback.level}</strong>
      <span class="validation-score">Score: ${feedback.score}</span>
    </div>
    ${positivesHtml}
    ${warningsHtml}
  `;
}

export function renderSidebarStatus(results) {
  document.querySelectorAll("[data-section-state]").forEach((element) => {
    const id = element.dataset.sectionState;
    const result = results[id];
    if (!result) {
      return;
    }

    element.classList.remove("complete", "incomplete");
    element.classList.add(result.complete ? "complete" : "incomplete");
    element.textContent = result.complete ? "Complete" : "Incomplete";
  });
}

export function renderExportChecklist(container, results) {
  const items = SECTION_ORDER
    .filter((sectionId) => sectionId !== "export")
    .map((sectionId) => {
      const result = results[sectionId];
      const label = sectionId[0].toUpperCase() + sectionId.slice(1);
      const mark = result?.complete ? "[Done]" : "[Pending]";
      return `<li>${mark} ${label}</li>`;
    })
    .join("");

  container.innerHTML = items;
}

export function setSaveStatus(element, message) {
  element.textContent = message;
}

export function setGraphStatus(element, message, isError) {
  element.textContent = message;
  element.style.color = isError ? "#b42318" : "#1c4f77";
}

export function setConclusionPreview(element, text) {
  element.textContent = text || "CER paragraph preview will appear here as you complete claim, evidence, and reasoning.";
}

export function setReportPreview(element, html) {
  element.innerHTML = html;
}

export function setReportPreviewVisibility(panel, isVisible) {
  if (!panel) {
    return;
  }

  panel.hidden = !isVisible;
  panel.setAttribute("aria-hidden", isVisible ? "false" : "true");
}

export function setReportPreviewToggleState(button, isEnabled) {
  if (!button) {
    return;
  }

  const label = isEnabled ? "Disable preview" : "Enable preview";
  button.innerHTML = getPreviewToggleIconMarkup(isEnabled);
  button.setAttribute("aria-pressed", isEnabled ? "true" : "false");
  button.setAttribute("aria-label", label);
  button.title = label;
}

export function setWorkspacePreviewState(workspace, isPreviewVisible) {
  if (!workspace) {
    return;
  }

  workspace.classList.toggle("preview-disabled", !isPreviewVisible);
}

export function scrollToSection(sectionId) {
  const section = document.getElementById(`section-${sectionId}`);
  if (section) {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function setActiveSection(sectionId) {
  document.querySelectorAll(".section-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.navTarget === sectionId);
  });
}
