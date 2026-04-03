import { validateResearchQuestion, SECTION_ORDER } from "./validation.js";
import { getDisplayCellValue, getDisplayColumns } from "./charts.js";

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

export function createUI() {
  const dom = {
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
          Variable name
          <input type="text" data-array="variables.controlled" data-index="${index}" data-field="name" value="${escapeAttr(row.name)}" />
        </label>
        <label>
          Why must it be controlled?
          <input type="text" data-array="variables.controlled" data-index="${index}" data-field="reason" value="${escapeAttr(row.reason)}" />
        </label>
        <label>
          How will it be controlled?
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
      <div class="dynamic-row material">
        <label>
          Item
          <input type="text" data-array="materials" data-index="${index}" data-field="item" value="${escapeAttr(material.item)}" />
        </label>
        <label>
          Quantity
          <input type="text" data-array="materials" data-index="${index}" data-field="quantity" value="${escapeAttr(material.quantity)}" />
        </label>
        <label>
          Unit
          <input type="text" data-array="materials" data-index="${index}" data-field="unit" value="${escapeAttr(material.unit)}" />
        </label>
        <button class="secondary" type="button" data-action="remove-material" data-index="${index}">Remove</button>
      </div>
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

export function renderColumnDefinitions(container, columns) {
  container.innerHTML = columns
    .map(
      (column, index) => `
      <div class="dynamic-row column">
        <label>
          Column name
          <input type="text" data-array="data.columns" data-index="${index}" data-field="name" value="${escapeAttr(column.name)}" />
        </label>
        <label>
          Unit
          <input type="text" data-array="data.columns" data-index="${index}" data-field="unit" value="${escapeAttr(column.unit)}" />
        </label>
        <button class="secondary" type="button" data-action="remove-column" data-index="${index}">Remove</button>
      </div>
    `,
    )
    .join("");
}

export function renderDataGrid(container, summaryElement, data) {
  const columns = data.columns ?? [];
  const rows = data.rows ?? [];

  if (columns.length === 0) {
    container.innerHTML = '<p class="support-text">Add columns to generate data entry fields.</p>';
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

export function renderAnalysisGraphs(container, analysis, data) {
  const displayColumns = getDisplayColumns(data);
  const graphs = Array.isArray(analysis?.graphs) ? analysis.graphs : [];

  container.innerHTML = graphs
    .map((graph, index) => {
      const xColumn = Number.parseInt(graph.xColumn, 10);
      const selectedYColumns = new Set((graph.yColumns ?? []).map((value) => String(value)));
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
      const multiSelectSize = Math.max(2, Math.min(6, displayColumns.length - 1));

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
              Graph type
              <select data-array="analysis.graphs" data-index="${index}" data-field="graphType">
                <option value="line"${graph.graphType === "line" ? " selected" : ""}>Line</option>
                <option value="scatter"${graph.graphType === "scatter" ? " selected" : ""}>Scatter</option>
                <option value="bar"${graph.graphType === "bar" ? " selected" : ""}>Bar</option>
              </select>
            </label>
            <label>
              Trendline
              <select data-array="analysis.graphs" data-index="${index}" data-field="trendlineType">
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
              X-axis column
              <select
                data-array="analysis.graphs"
                data-index="${index}"
                data-field="xColumn"
                data-value-type="number"
              >${xOptions}</select>
            </label>
            <label>
              Y-axis column(s)
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
            <label class="checkbox-label">
              <input
                type="checkbox"
                data-array="analysis.graphs"
                data-index="${index}"
                data-field="startAtOrigin"
                ${graph.startAtOrigin ? "checked" : ""}
              />
              Force graph to start at 0,0
            </label>
          </div>
          <p class="support-text">
            Hold Ctrl (Windows) or Cmd (Mac) to select multiple Y-axis columns. The selected X-axis column is excluded from the Y-axis list. Trendlines apply when one Y-axis column is selected.
          </p>
          <div class="chart-wrap">
            <canvas data-graph-canvas="${index}" aria-label="Investigation graph ${index + 1}"></canvas>
          </div>
          <p class="support-text" data-graph-status="${index}" aria-live="polite"></p>
        </div>
      `;
    })
    .join("");
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
