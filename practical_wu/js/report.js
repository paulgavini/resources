import { getDisplayCellValue, getDisplayColumns } from "./charts.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function withFallback(value, fallback = "<span class=\"empty-text\">Not yet completed.</span>") {
  return String(value ?? "").trim() ? escapeHtml(value) : fallback;
}

function buildList(items, className = "report-list", ordered = false) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<p class="empty-text">Not yet completed.</p>';
  }

  const tag = ordered ? "ol" : "ul";
  const listItems = items
    .map((item) => `<li>${String(item ?? "").trim() ? escapeHtml(item) : '<span class="empty-text">(blank)</span>'}</li>`)
    .join("");

  return `<${tag} class="${className}">${listItems}</${tag}>`;
}

function buildDataTable(state) {
  const columns = Array.isArray(state.data.columns) ? state.data.columns : [];
  const rows = Array.isArray(state.data.rows) ? state.data.rows : [];

  if (columns.length === 0) {
    return '<p class="empty-text">No data columns yet.</p>';
  }

  const displayColumns = getDisplayColumns(state.data);

  const headers = displayColumns
    .map(
      (column) =>
        `<th>${escapeHtml(column.name)}${column.unit ? ` (${escapeHtml(column.unit)})` : ""}</th>`,
    )
    .join("");

  const bodyRows = rows
    .map((row) => {
      const safeRow = Array.isArray(row) ? row : [];
      const cells = displayColumns
        .map((column) => `<td>${escapeHtml(getDisplayCellValue(state.data, safeRow, column))}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<table class="report-table"><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function buildRiskTable(risks) {
  if (!Array.isArray(risks) || risks.length === 0) {
    return '<p class="empty-text">No risk assessment rows yet.</p>';
  }

  const rows = risks
    .map(
      (risk) =>
        `<tr><td>${withFallback(risk.hazard)}</td><td>${withFallback(risk.risk)}</td><td>${withFallback(risk.precaution)}</td></tr>`,
    )
    .join("");

  return `<table class="report-table"><thead><tr><th>Hazard</th><th>Risk</th><th>Precaution</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function buildMaterialsList(materials) {
  const lines = (materials ?? [])
    .filter((row) => String(row.item ?? "").trim().length > 0)
    .map((row) => {
      const quantity = String(row.quantity ?? "").trim();
      const unit = String(row.unit ?? "").trim();
      const amount = [quantity, unit].filter(Boolean).join(" ");
      return amount ? `${row.item} (${amount})` : row.item;
    });

  return buildList(lines);
}

function buildGraphBlocks(graphs) {
  if (!Array.isArray(graphs) || graphs.length === 0) {
    return `
      <div class="report-graph-block">
        <h4>Graph</h4>
        <p class="empty-text">Graph preview unavailable until enough numeric data is entered.</p>
      </div>
    `;
  }

  return graphs
    .map((graph, index) => {
      const title = String(graph?.title ?? "").trim() || `Graph ${index + 1}`;
      const imageDataUrl = String(graph?.imageDataUrl ?? "");
      const message = String(graph?.message ?? "");

      return `
        <div class="report-graph-block">
          <h4>${escapeHtml(title)}</h4>
          ${
            imageDataUrl
              ? `<img class="report-graph-image" src="${escapeAttr(imageDataUrl)}" alt="${escapeAttr(title)} preview" />`
              : '<p class="empty-text">Graph preview unavailable until enough numeric data is entered.</p>'
          }
          ${message ? `<p class="report-note">${escapeHtml(message)}</p>` : ""}
        </div>
      `;
    })
    .join("");
}

export function generateConclusionParagraph(conclusion) {
  const claim = String(conclusion.claim ?? "").trim();
  const evidence = String(conclusion.evidence ?? "").trim();
  const reasoning = String(conclusion.reasoning ?? "").trim();

  if (!claim && !evidence && !reasoning) {
    return "";
  }

  return [
    claim ? `Claim: ${claim}` : "",
    evidence ? `Evidence: ${evidence}` : "",
    reasoning ? `Reasoning: ${reasoning}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildReportHtml(state, options = {}) {
  const graphs =
    Array.isArray(options.graphs) && options.graphs.length > 0
      ? options.graphs
      : options.chartImageUrl || options.chartStatus
      ? [
          {
            title: "Graph 1",
            imageDataUrl: String(options.chartImageUrl ?? ""),
            message: String(options.chartStatus ?? ""),
          },
        ]
      : [];
  const generatedDate = new Date().toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const controlledVariables = (state.variables.controlled ?? []).map(
    (row) => `${row.name || "(name missing)"}: ${row.reason || "reason missing"}; ${row.controlMethod || "control method missing"}`,
  );

  const methodSteps = state.method.steps ?? [];
  const conclusionParagraph = generateConclusionParagraph(state.conclusion);

  return `
    <div class="report-header">
      <h2 class="report-title">${withFallback(state.setup.title, "Practical Investigation")}</h2>
      <div class="report-meta">
        <div><strong>Subject:</strong> ${withFallback(state.setup.subject)}</div>
        <div><strong>Year level:</strong> ${withFallback(state.setup.yearLevel)}</div>
        <div><strong>Teacher:</strong> ${withFallback(state.setup.teacher)}</div>
        <div><strong>Class:</strong> ${withFallback(state.setup.className)}</div>
        <div><strong>Due date:</strong> ${withFallback(state.setup.dueDate)}</div>
        <div><strong>Type:</strong> ${withFallback(state.setup.investigationType)}</div>
        <div><strong>Generated:</strong> ${escapeHtml(generatedDate)}</div>
      </div>
    </div>

    <section class="report-section">
      <h3>Research Question</h3>
      <p>${withFallback(state.question.text)}</p>
    </section>

    <section class="report-section">
      <h3>Hypothesis</h3>
      <p><strong>Prediction:</strong> ${withFallback(state.hypothesis.statement)}</p>
      <p><strong>Scientific reasoning:</strong> ${withFallback(state.hypothesis.reasoning)}</p>
    </section>

    <section class="report-section">
      <h3>Variables</h3>
      <p><strong>Independent variable:</strong> ${withFallback(state.variables.independent)}</p>
      <p><strong>Dependent variable:</strong> ${withFallback(state.variables.dependent)}</p>
      <p><strong>Controlled variables:</strong></p>
      ${buildList(controlledVariables)}
    </section>

    <section class="report-section">
      <h3>Risk Assessment</h3>
      ${buildRiskTable(state.risks)}
    </section>

    <section class="report-section">
      <h3>Materials</h3>
      ${buildMaterialsList(state.materials)}
    </section>

    <section class="report-section">
      <h3>Method</h3>
      ${buildList(methodSteps, "report-ordered", true)}
    </section>

    <section class="report-section">
      <h3>Data</h3>
      ${buildDataTable(state)}
    </section>

    <section class="report-section">
      <h3>Analysis</h3>
      ${buildGraphBlocks(graphs)}
      <p><strong>What the graphs show:</strong> ${withFallback(state.analysis.graphCommentary)}</p>
      <p><strong>Trend:</strong> ${withFallback(state.analysis.trend)}</p>
      <p><strong>Anomalies:</strong> ${withFallback(state.analysis.anomalies)}</p>
      <p><strong>Hypothesis supported:</strong> ${withFallback(state.analysis.hypothesisSupported)}</p>
    </section>

    <section class="report-section">
      <h3>Evaluation</h3>
      <p><strong>Validity:</strong> ${withFallback(state.evaluation.validity)}</p>
      <p><strong>Reliability:</strong> ${withFallback(state.evaluation.reliability)}</p>
      <p><strong>Limitations:</strong> ${withFallback(state.evaluation.limitations)}</p>
      <p><strong>Improvements:</strong> ${withFallback(state.evaluation.improvements)}</p>
    </section>

    <section class="report-section">
      <h3>Conclusion</h3>
      <p><strong>Claim:</strong> ${withFallback(state.conclusion.claim)}</p>
      <p><strong>Evidence:</strong> ${withFallback(state.conclusion.evidence)}</p>
      <p><strong>Reasoning:</strong> ${withFallback(state.conclusion.reasoning)}</p>
      <p><strong>CER paragraph:</strong> ${withFallback(conclusionParagraph)}</p>
    </section>
  `;
}
