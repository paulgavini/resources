import { getDisplayCellValue, getDisplayColumns } from "./charts.js";
import { renderMathNotationHtml } from "./math-notation.js";

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

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function renderInlineText(value) {
  return renderMathNotationHtml(String(value ?? ""));
}

function withFallback(value, fallback = '<span class="empty-text">Not yet completed.</span>') {
  return hasText(value) ? renderInlineText(value) : fallback;
}

function buildParagraphsFromMultiline(value, fallback = "Not yet completed.") {
  const text = String(value ?? "").trim();
  if (!text) {
    return `<p class="empty-text">${escapeHtml(fallback)}</p>`;
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map(
      (chunk) =>
        `<p>${chunk
          .split("\n")
          .map((line) => renderInlineText(line))
          .join("<br />")}</p>`,
    )
    .join("");

  return paragraphs || `<p class="empty-text">${escapeHtml(fallback)}</p>`;
}

function buildList(items, className = "report-list") {
  if (!Array.isArray(items) || items.length === 0) {
    return '<p class="empty-text">Not yet completed.</p>';
  }

  const validItems = items.filter((item) => hasText(item));
  if (validItems.length === 0) {
    return '<p class="empty-text">Not yet completed.</p>';
  }

  return `
    <ul class="${className}">
      ${validItems.map((item) => `<li>${renderInlineText(item)}</li>`).join("")}
    </ul>
  `;
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
        `<th>${renderInlineText(column.name)}${column.unit ? ` (${renderInlineText(column.unit)})` : ""}</th>`,
    )
    .join("");

  const bodyRows = rows
    .map((row) => {
      const safeRow = Array.isArray(row) ? row : [];
      const cells = displayColumns
        .map((column) => `<td>${renderInlineText(getDisplayCellValue(state.data, safeRow, column))}</td>`)
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<table class="report-table"><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table>`;
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
          <h4>${renderInlineText(title)}</h4>
          ${
            imageDataUrl
              ? `<img class="report-graph-image" src="${escapeAttr(imageDataUrl)}" alt="${escapeAttr(title)} preview" />`
              : '<p class="empty-text">Graph preview unavailable until enough numeric data is entered.</p>'
          }
          ${message ? `<p class="report-note">${renderInlineText(message)}</p>` : ""}
        </div>
      `;
    })
    .join("");
}

function buildInvestigationCycles(cycles) {
  if (!Array.isArray(cycles) || cycles.length === 0) {
    return '<p class="empty-text">No investigation cycles yet.</p>';
  }

  const validCycles = cycles.filter(
    (cycle) =>
      hasText(cycle?.heading) ||
      hasText(cycle?.introduce) ||
      hasText(cycle?.workings) ||
      hasText(cycle?.explanation),
  );

  if (validCycles.length === 0) {
    return '<p class="empty-text">No investigation cycles yet.</p>';
  }

  return validCycles
    .map(
      (cycle, index) => `
        <div class="report-cycle">
          <h4>${renderInlineText(cycle.heading || `Cycle ${index + 1}`)}</h4>
          <p><strong>Introduce:</strong> ${withFallback(cycle.introduce)}</p>
          <div>
            <strong>Workings:</strong>
            <pre class="report-workings">${hasText(cycle.workings) ? renderInlineText(cycle.workings) : "Not yet completed."}</pre>
          </div>
          <p><strong>Explain:</strong> ${withFallback(cycle.explanation)}</p>
        </div>
      `,
    )
    .join("");
}

function buildAnalysisRowParagraphs(rows, primaryField, secondaryField) {
  const items = (rows ?? [])
    .filter((row) => hasText(row?.[primaryField]) || hasText(row?.[secondaryField]))
    .map((row) => {
      const lead = hasText(row?.[primaryField]) ? row[primaryField] : "(topic sentence missing)";
      const explanation = hasText(row?.[secondaryField])
        ? row[secondaryField]
        : "(explanation missing)";

      return `${lead}: ${explanation}`;
    });

  return buildList(items);
}

export function buildIntroductionParagraph(introduction) {
  const parts = [
    introduction?.hook,
    introduction?.problemContext,
    introduction?.fieldOfMathematics && introduction?.fieldDescription
      ? `${introduction.fieldOfMathematics}: ${introduction.fieldDescription}`
      : introduction?.fieldOfMathematics || introduction?.fieldDescription,
    introduction?.connection,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  return parts.join(" ");
}

export function buildConclusionParagraph(conclusion) {
  const parts = [
    conclusion?.relationBack,
    conclusion?.majorFindings,
    conclusion?.solutionStatement,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  return parts.join(" ");
}

export function buildReportHtml(state, options = {}) {
  const graphs = Array.isArray(options.graphs) ? options.graphs : [];
  const generatedDate = new Date().toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `
    <div class="report-header">
      <h2 class="report-title">${withFallback(state.setup.title, "Mathematics Investigation")}</h2>
      <div class="report-meta">
        <div><strong>Subject:</strong> ${withFallback(state.setup.subject)}</div>
        <div><strong>Year level:</strong> ${withFallback(state.setup.yearLevel)}</div>
        <div><strong>Teacher:</strong> ${withFallback(state.setup.teacher)}</div>
        <div><strong>Class:</strong> ${withFallback(state.setup.className)}</div>
        <div><strong>Due date:</strong> ${withFallback(state.setup.dueDate)}</div>
        <div><strong>Investigation type:</strong> ${withFallback(state.setup.taskType)}</div>
        <div><strong>Problem focus:</strong> ${withFallback(state.setup.problemFocus)}</div>
        <div><strong>Generated:</strong> ${escapeHtml(generatedDate)}</div>
      </div>
    </div>

    <section class="report-section">
      <h3>Introduction</h3>
      ${buildParagraphsFromMultiline(buildIntroductionParagraph(state.introduction))}
    </section>

    <section class="report-section">
      <h3>Mathematical Investigation</h3>
      ${buildInvestigationCycles(state.investigation?.cycles)}
    </section>

    <section class="report-section">
      <h3>Data Tables</h3>
      ${buildDataTable(state)}
    </section>

    <section class="report-section">
      <h3>Graphs</h3>
      ${buildGraphBlocks(graphs)}
      <p><strong>Graph commentary:</strong> ${withFallback(state.graphs?.commentary)}</p>
    </section>

    <section class="report-section">
      <h3>Analysis</h3>
      <h4>Pattern of results</h4>
      ${buildParagraphsFromMultiline(state.analysis?.patternOfResults)}
      <h4>Written evidence and answer to the problem</h4>
      ${buildParagraphsFromMultiline(state.analysis?.writtenEvidence)}
      <h4>Assumptions</h4>
      ${buildParagraphsFromMultiline(state.analysis?.assumptions)}
      <h4>Reasonableness</h4>
      ${buildParagraphsFromMultiline(state.analysis?.reasonableness)}
      <h4>Method comparison</h4>
      ${buildParagraphsFromMultiline(state.analysis?.methodComparison, "No second method comparison provided.")}
      <h4>Strengths</h4>
      ${buildAnalysisRowParagraphs(state.analysis?.strengths, "factor", "impact")}
      <h4>Limitations / weaknesses</h4>
      ${buildAnalysisRowParagraphs(state.analysis?.limitations, "factor", "impact")}
      <h4>Improvements</h4>
      ${buildAnalysisRowParagraphs(state.analysis?.improvements, "improvement", "benefit")}
    </section>

    <section class="report-section">
      <h3>Conclusion</h3>
      ${buildParagraphsFromMultiline(buildConclusionParagraph(state.conclusion))}
    </section>
  `;
}
