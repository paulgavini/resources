import { getDisplayCellValue, getDisplayColumns } from "./charts.js";
import { parseMathNotation } from "./math-notation.js";
import { buildConclusionParagraph, buildIntroductionParagraph } from "./report.js";

const WORD_FONT_NAME = "Calibri";
const WORD_FONT_SIZE = 20;
const WORD_PAGE_MARGIN = 720;

const WORD_RUN_DEFAULTS = {
  font: WORD_FONT_NAME,
  size: WORD_FONT_SIZE,
};

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function asText(value, fallback = "Not yet completed.") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatColumnLabel(column, fallbackName) {
  const name = String(column?.name ?? "").trim() || fallbackName;
  const unit = String(column?.unit ?? "").trim();
  return unit ? `${name} (${unit})` : name;
}

function toDataUrlBytes(dataUrl) {
  const raw = String(dataUrl ?? "");
  const commaIndex = raw.indexOf(",");
  if (!raw.startsWith("data:image/") || commaIndex < 0) {
    return null;
  }

  const encoded = raw.slice(commaIndex + 1);
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch (error) {
    return null;
  }
}

function slugify(text) {
  const cleaned = String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "maths-investigation";
}

function getDocxApi() {
  if (typeof window === "undefined" || !window.docx) {
    throw new Error("Word export library is not available.");
  }

  return window.docx;
}

function buildNotationRunOptions(text, options = {}) {
  const { fallback = "", ...overrides } = options;
  const raw = String(text ?? "");
  const value = raw.trim().length > 0 ? raw : fallback;

  return parseMathNotation(value).map((segment) => ({
    text: segment.text,
    ...WORD_RUN_DEFAULTS,
    ...(segment.script === "super" ? { superScript: true } : {}),
    ...(segment.script === "sub" ? { subScript: true } : {}),
    ...overrides,
  }));
}

function createTextRun(docxApi, options = {}) {
  const { TextRun } = docxApi;
  return new TextRun({
    ...WORD_RUN_DEFAULTS,
    ...options,
  });
}

function createNotationRuns(docxApi, text, options = {}) {
  const runOptions = buildNotationRunOptions(text, options);

  if (runOptions.length === 0) {
    return [createTextRun(docxApi, { text: "" })];
  }

  return runOptions.map((entry) => createTextRun(docxApi, entry));
}

function labelParagraph(docxApi, label, value) {
  const { Paragraph } = docxApi;
  return new Paragraph({
    children: [
      createTextRun(docxApi, { text: `${label}: `, bold: true }),
      ...createNotationRuns(docxApi, value, { fallback: "Not yet completed." }),
    ],
  });
}

function sectionHeading(docxApi, text) {
  const { HeadingLevel, Paragraph } = docxApi;
  return new Paragraph({
    children: createNotationRuns(docxApi, text),
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 120 },
  });
}

function subHeading(docxApi, text) {
  const { HeadingLevel, Paragraph } = docxApi;
  return new Paragraph({
    children: createNotationRuns(docxApi, text),
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 180, after: 80 },
  });
}

function buildRowsTable(docxApi, headers, rows) {
  const { Table, TableCell, TableRow, Paragraph, WidthType } = docxApi;

  const headerRow = new TableRow({
    children: headers.map(
      (label) =>
        new TableCell({
          children: [
            new Paragraph({
              children: createNotationRuns(docxApi, label, { bold: true }),
            }),
          ],
        }),
    ),
  });

  const bodyRows = rows.map(
    (cells) =>
      new TableRow({
        children: cells.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: createNotationRuns(docxApi, cell),
                }),
              ],
            }),
        ),
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

function addParagraphs(children, docxApi, text, fallback = "Not yet completed.") {
  const { Paragraph } = docxApi;
  const value = String(text ?? "").trim();
  if (!value) {
    children.push(
      new Paragraph({
        children: createNotationRuns(docxApi, fallback),
      }),
    );
    return;
  }

  value
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .forEach((chunk) => {
      const lines = chunk.split("\n");
      children.push(
        new Paragraph({
          children: lines.flatMap((line, index) => {
            const runOptions = buildNotationRunOptions(line);

            if (runOptions.length === 0) {
              return [createTextRun(docxApi, { text: "", break: index === 0 ? 0 : 1 })];
            }

            return runOptions.map((entry, entryIndex) =>
              createTextRun(docxApi, {
                ...entry,
                break: index > 0 && entryIndex === 0 ? 1 : 0,
              }),
            );
          }),
        }),
      );
    });
}

function addBulletList(children, docxApi, items) {
  const { Paragraph } = docxApi;
  const validItems = (items ?? []).filter((item) => hasText(item));

  if (validItems.length === 0) {
    children.push(new Paragraph("Not yet completed."));
    return;
  }

  validItems.forEach((item) => {
    children.push(
      new Paragraph({
        children: createNotationRuns(docxApi, item),
        bullet: { level: 0 },
      }),
    );
  });
}

function addDataTable(children, docxApi, state) {
  const columns = Array.isArray(state.data?.columns) ? state.data.columns : [];
  const rows = Array.isArray(state.data?.rows) ? state.data.rows : [];

  if (columns.length === 0) {
    children.push(new docxApi.Paragraph("No data columns yet."));
    return;
  }

  const displayColumns = getDisplayColumns(state.data);
  const headers = displayColumns.map((column, index) =>
    formatColumnLabel(column, `Column ${index + 1}`),
  );
  const bodyRows = rows.map((row) =>
    displayColumns.map((column) => String(getDisplayCellValue(state.data, row, column) ?? "")),
  );

  children.push(buildRowsTable(docxApi, headers, bodyRows));
}

function addGraphBlocks(children, docxApi, graphs) {
  const { AlignmentType, ImageRun, Paragraph } = docxApi;

  if (!Array.isArray(graphs) || graphs.length === 0) {
    children.push(new Paragraph("Graph preview unavailable for the current data."));
    return;
  }

  graphs.forEach((graph, index) => {
    const imageBytes = toDataUrlBytes(graph?.imageDataUrl ?? "");
    const title = asText(graph?.title, `Graph ${index + 1}`);

    children.push(subHeading(docxApi, title));

    if (imageBytes) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: imageBytes,
              transformation: {
                width: 560,
                height: 330,
              },
            }),
          ],
        }),
      );
    } else {
      children.push(new Paragraph("Graph preview unavailable for the current data."));
    }

    if (hasText(graph?.message)) {
      children.push(
        new Paragraph({
          children: [
            createTextRun(docxApi, { text: "Graph status: ", italics: true }),
            ...createNotationRuns(docxApi, graph.message, { italics: true }),
          ],
        }),
      );
    }
  });
}

function addInvestigationCycles(children, docxApi, cycles) {
  const validCycles = (cycles ?? []).filter(
    (cycle) =>
      hasText(cycle?.heading) ||
      hasText(cycle?.introduce) ||
      hasText(cycle?.workings) ||
      hasText(cycle?.explanation),
  );

  if (validCycles.length === 0) {
    children.push(new docxApi.Paragraph("No investigation cycles yet."));
    return;
  }

  validCycles.forEach((cycle, index) => {
    children.push(subHeading(docxApi, asText(cycle.heading, `Cycle ${index + 1}`)));
    children.push(labelParagraph(docxApi, "Introduce", cycle.introduce));
    children.push(subHeading(docxApi, "Workings"));
    addParagraphs(children, docxApi, cycle.workings, "Workings not yet completed.");
    children.push(labelParagraph(docxApi, "Explain", cycle.explanation));
  });
}

function addAnalysisRows(children, docxApi, heading, rows, primaryField, secondaryField) {
  children.push(subHeading(docxApi, heading));

  const items = (rows ?? [])
    .filter((row) => hasText(row?.[primaryField]) || hasText(row?.[secondaryField]))
    .map((row) => {
      const lead = hasText(row?.[primaryField]) ? row[primaryField] : "(topic sentence missing)";
      const explanation = hasText(row?.[secondaryField])
        ? row[secondaryField]
        : "(explanation missing)";
      return `${lead}: ${explanation}`;
    });

  addBulletList(children, docxApi, items);
}

export async function exportReportToWord(state, options = {}) {
  const docxApi = getDocxApi();
  const { Document, HeadingLevel, Packer, Paragraph } = docxApi;
  const generatedDate = new Date().toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const children = [
    new Paragraph({
      children: createNotationRuns(docxApi, state.setup?.title, {
        fallback: "Mathematics Investigation",
      }),
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [createTextRun(docxApi, { text: `Generated: ${generatedDate}`, italics: true })],
      spacing: { after: 180 },
    }),
  ];

  children.push(sectionHeading(docxApi, "Investigation Setup"));
  children.push(labelParagraph(docxApi, "Subject", state.setup?.subject));
  children.push(labelParagraph(docxApi, "Year level", state.setup?.yearLevel));
  children.push(labelParagraph(docxApi, "Teacher", state.setup?.teacher));
  children.push(labelParagraph(docxApi, "Class", state.setup?.className));
  children.push(labelParagraph(docxApi, "Due date", state.setup?.dueDate));
  children.push(labelParagraph(docxApi, "Investigation type", state.setup?.taskType));
  children.push(labelParagraph(docxApi, "Problem focus", state.setup?.problemFocus));

  children.push(sectionHeading(docxApi, "Introduction"));
  addParagraphs(children, docxApi, buildIntroductionParagraph(state.introduction));

  children.push(sectionHeading(docxApi, "Mathematical Investigation"));
  addInvestigationCycles(children, docxApi, state.investigation?.cycles);

  children.push(sectionHeading(docxApi, "Data Tables"));
  addDataTable(children, docxApi, state);

  children.push(sectionHeading(docxApi, "Graphs"));
  addGraphBlocks(children, docxApi, options.graphs);
  children.push(labelParagraph(docxApi, "Graph commentary", state.graphs?.commentary));

  children.push(sectionHeading(docxApi, "Analysis"));
  children.push(subHeading(docxApi, "Pattern of results"));
  addParagraphs(children, docxApi, state.analysis?.patternOfResults);
  children.push(subHeading(docxApi, "Written evidence and answer to the problem"));
  addParagraphs(children, docxApi, state.analysis?.writtenEvidence);
  children.push(subHeading(docxApi, "Assumptions"));
  addParagraphs(children, docxApi, state.analysis?.assumptions);
  children.push(subHeading(docxApi, "Reasonableness"));
  addParagraphs(children, docxApi, state.analysis?.reasonableness);
  children.push(subHeading(docxApi, "Method comparison"));
  addParagraphs(
    children,
    docxApi,
    state.analysis?.methodComparison,
    "No second method comparison provided.",
  );
  addAnalysisRows(
    children,
    docxApi,
    "Strengths",
    state.analysis?.strengths,
    "factor",
    "impact",
  );
  addAnalysisRows(
    children,
    docxApi,
    "Limitations / weaknesses",
    state.analysis?.limitations,
    "factor",
    "impact",
  );
  addAnalysisRows(
    children,
    docxApi,
    "Improvements",
    state.analysis?.improvements,
    "improvement",
    "benefit",
  );

  children.push(sectionHeading(docxApi, "Conclusion"));
  addParagraphs(children, docxApi, buildConclusionParagraph(state.conclusion));

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: WORD_RUN_DEFAULTS,
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: WORD_PAGE_MARGIN,
              right: WORD_PAGE_MARGIN,
              bottom: WORD_PAGE_MARGIN,
              left: WORD_PAGE_MARGIN,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const fileDate = new Date().toISOString().slice(0, 10);
  const filename = `${slugify(state.setup?.title)}-${fileDate}.docx`;

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
