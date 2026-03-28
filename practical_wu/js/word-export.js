function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function asText(value, fallback = "Not yet completed.") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function parseNumeric(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function averageFromRow(row) {
  const numbers = row
    .slice(1)
    .map((cell) => parseNumeric(cell))
    .filter((value) => value !== null);

  if (numbers.length === 0) {
    return "";
  }

  const average = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  return Number.isFinite(average) ? average.toFixed(2) : "";
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

  return cleaned || "practical-investigation";
}

function getDocxApi() {
  if (typeof window === "undefined" || !window.docx) {
    throw new Error("Word export library is not available.");
  }

  return window.docx;
}

function labelParagraph(docxApi, label, value) {
  const { Paragraph, TextRun } = docxApi;
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: asText(value) }),
    ],
  });
}

function sectionHeading(docxApi, text) {
  const { HeadingLevel, Paragraph } = docxApi;
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 120 },
  });
}

function buildRowsTable(docxApi, headers, rows) {
  const { Table, TableCell, TableRow, Paragraph, TextRun, WidthType } = docxApi;

  const headerRow = new TableRow({
    children: headers.map(
      (label) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: label, bold: true })],
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
              children: [new Paragraph(asText(cell, ""))],
            }),
        ),
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

function generateConclusionParagraph(conclusion) {
  const claim = String(conclusion?.claim ?? "").trim();
  const evidence = String(conclusion?.evidence ?? "").trim();
  const reasoning = String(conclusion?.reasoning ?? "").trim();

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

function addBulletList(children, docxApi, items) {
  const { Paragraph } = docxApi;

  if (!Array.isArray(items) || items.length === 0) {
    children.push(new Paragraph(asText("")));
    return;
  }

  items.forEach((item) => {
    children.push(
      new Paragraph({
        text: asText(item),
        bullet: { level: 0 },
      }),
    );
  });
}

function addMethodList(children, docxApi, steps) {
  const { Paragraph } = docxApi;
  const validSteps = (steps ?? []).filter((step) => hasText(step));

  if (validSteps.length === 0) {
    children.push(new Paragraph(asText("")));
    return;
  }

  validSteps.forEach((step, index) => {
    children.push(new Paragraph(`${index + 1}. ${step}`));
  });
}

function addDataTable(children, docxApi, state) {
  const columns = Array.isArray(state.data?.columns) ? state.data.columns : [];
  const rows = Array.isArray(state.data?.rows) ? state.data.rows : [];
  const includeAverage = Boolean(state.data?.includeAverage);

  if (columns.length === 0) {
    children.push(new docxApi.Paragraph("No data columns yet."));
    return;
  }

  const displayColumns = [...columns];
  if (includeAverage) {
    displayColumns.push({
      name: "Average",
      unit: columns[1]?.unit ?? "",
    });
  }

  const headers = [
    "Row",
    ...displayColumns.map((column, index) =>
      formatColumnLabel(column, `Column ${index + 1}`),
    ),
  ];

  const bodyRows = rows.map((row, rowIndex) => {
    const safeRow = Array.isArray(row) ? row : [];
    const baseCells = columns.map((_, columnIndex) => String(safeRow[columnIndex] ?? ""));
    const averageCell = includeAverage ? [averageFromRow(safeRow)] : [];
    return [String(rowIndex + 1), ...baseCells, ...averageCell];
  });

  children.push(buildRowsTable(docxApi, headers, bodyRows));
}

function addAnalysisGraph(children, docxApi, options) {
  const { AlignmentType, HeadingLevel, ImageRun, Paragraph, TextRun } = docxApi;
  const imageBytes = toDataUrlBytes(options?.chartImageUrl ?? "");

  children.push(
    new Paragraph({
      text: "Graph",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 180, after: 80 },
    }),
  );

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

  if (hasText(options?.chartStatus)) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Graph status: ${options.chartStatus}`, italics: true })],
      }),
    );
  }
}

export async function exportReportToWord(state, options = {}) {
  const docxApi = getDocxApi();
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = docxApi;

  const generatedDate = new Date().toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const children = [];

  children.push(
    new Paragraph({
      text: asText(state.setup?.title, "Practical Investigation"),
      heading: HeadingLevel.TITLE,
    }),
  );
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${generatedDate}`, italics: true })],
      spacing: { after: 160 },
    }),
  );

  children.push(sectionHeading(docxApi, "Investigation Setup"));
  children.push(labelParagraph(docxApi, "Subject", state.setup?.subject));
  children.push(labelParagraph(docxApi, "Year level", state.setup?.yearLevel));
  children.push(labelParagraph(docxApi, "Teacher", state.setup?.teacher));
  children.push(labelParagraph(docxApi, "Class", state.setup?.className));
  children.push(labelParagraph(docxApi, "Due date", state.setup?.dueDate));
  children.push(labelParagraph(docxApi, "Type", state.setup?.investigationType));

  children.push(sectionHeading(docxApi, "Research Question"));
  children.push(new Paragraph(asText(state.question?.text)));

  children.push(sectionHeading(docxApi, "Hypothesis"));
  children.push(labelParagraph(docxApi, "Prediction", state.hypothesis?.statement));
  children.push(labelParagraph(docxApi, "Scientific reasoning", state.hypothesis?.reasoning));

  children.push(sectionHeading(docxApi, "Variables"));
  children.push(labelParagraph(docxApi, "Independent variable", state.variables?.independent));
  children.push(labelParagraph(docxApi, "Dependent variable", state.variables?.dependent));
  children.push(
    new Paragraph({
      text: "Controlled variables",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 180, after: 80 },
    }),
  );

  const controlledVariables = (state.variables?.controlled ?? [])
    .filter(
      (row) =>
        hasText(row?.name) || hasText(row?.reason) || hasText(row?.controlMethod),
    )
    .map(
      (row) =>
        `${asText(row?.name, "(name missing)")}: ${asText(row?.reason, "reason missing")}; ${asText(row?.controlMethod, "control method missing")}`,
    );
  addBulletList(children, docxApi, controlledVariables);

  children.push(sectionHeading(docxApi, "Risk Assessment"));
  const riskRows = (state.risks ?? []).map((risk) => [
    asText(risk?.hazard, ""),
    asText(risk?.risk, ""),
    asText(risk?.precaution, ""),
  ]);
  if (riskRows.length === 0) {
    children.push(new Paragraph("No risk rows yet."));
  } else {
    children.push(buildRowsTable(docxApi, ["Hazard", "Risk", "Precaution"], riskRows));
  }

  children.push(sectionHeading(docxApi, "Materials"));
  const materialItems = (state.materials ?? [])
    .filter((row) => hasText(row?.item))
    .map((row) => {
      const quantity = String(row?.quantity ?? "").trim();
      const unit = String(row?.unit ?? "").trim();
      const amount = [quantity, unit].filter(Boolean).join(" ");
      return amount ? `${row.item} (${amount})` : row.item;
    });
  addBulletList(children, docxApi, materialItems);

  children.push(sectionHeading(docxApi, "Method"));
  addMethodList(children, docxApi, state.method?.steps ?? []);

  children.push(sectionHeading(docxApi, "Data"));
  addDataTable(children, docxApi, state);

  children.push(sectionHeading(docxApi, "Analysis"));
  addAnalysisGraph(children, docxApi, options);
  children.push(labelParagraph(docxApi, "Trend", state.analysis?.trend));
  children.push(labelParagraph(docxApi, "Anomalies", state.analysis?.anomalies));
  children.push(
    labelParagraph(
      docxApi,
      "Hypothesis supported",
      state.analysis?.hypothesisSupported,
    ),
  );

  children.push(sectionHeading(docxApi, "Evaluation"));
  children.push(labelParagraph(docxApi, "Validity", state.evaluation?.validity));
  children.push(labelParagraph(docxApi, "Reliability", state.evaluation?.reliability));
  children.push(labelParagraph(docxApi, "Limitations", state.evaluation?.limitations));
  children.push(labelParagraph(docxApi, "Improvements", state.evaluation?.improvements));

  children.push(sectionHeading(docxApi, "Conclusion"));
  children.push(labelParagraph(docxApi, "Claim", state.conclusion?.claim));
  children.push(labelParagraph(docxApi, "Evidence", state.conclusion?.evidence));
  children.push(labelParagraph(docxApi, "Reasoning", state.conclusion?.reasoning));
  children.push(
    labelParagraph(
      docxApi,
      "CER paragraph",
      generateConclusionParagraph(state.conclusion),
    ),
  );

  const doc = new Document({
    creator: "Practical Investigation Builder",
    title: asText(state.setup?.title, "Practical Investigation"),
    description: "Practical investigation report export",
    sections: [
      {
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileDate = new Date().toISOString().slice(0, 10);
  const filename = `${slugify(state.setup?.title)}-${fileDate}.docx`;

  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  window.document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
