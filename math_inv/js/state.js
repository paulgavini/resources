const GRAPH_TYPES = new Set([
  "line",
  "scatter",
  "bar",
  "bubble",
  "pie",
  "doughnut",
  "polarArea",
  "radar",
]);
const TRENDLINE_TYPES = new Set([
  "none",
  "linear",
  "quadratic",
  "exponential",
  "logarithmic",
  "power",
  "moving-average",
]);

export function createBlankGraphCard() {
  return {
    graphType: "line",
    trendlineType: "none",
    xColumn: 0,
    yColumns: [1],
    bubbleRadiusColumn: null,
    startAtOrigin: false,
  };
}

export function createBlankInvestigationCycle() {
  return {
    heading: "",
    introduce: "",
    workings: "",
    explanation: "",
  };
}

export function createBlankAnalysisPoint() {
  return {
    factor: "",
    impact: "",
  };
}

export function createBlankImprovementPoint() {
  return {
    improvement: "",
    benefit: "",
  };
}

export function createEmptyRows(rowCount, columnCount) {
  return Array.from({ length: rowCount }, () =>
    Array.from({ length: columnCount }, () => ""),
  );
}

export function createDefaultState() {
  return {
    setup: {
      title: "",
      subject: "Mathematics",
      yearLevel: "",
      teacher: "",
      className: "",
      dueDate: "",
      taskType: "Problem solving",
      problemFocus: "",
    },
    introduction: {
      hook: "",
      problemContext: "",
      fieldOfMathematics: "",
      fieldDescription: "",
      connection: "",
    },
    investigation: {
      cycles: [createBlankInvestigationCycle()],
    },
    data: {
      columns: [
        { name: "Independent variable", unit: "" },
        { name: "Dependent variable", unit: "" },
      ],
      rowCount: 3,
      rows: createEmptyRows(3, 2),
      includeAverage: false,
      includeStandardDeviation: false,
    },
    graphs: {
      cards: [createBlankGraphCard()],
      commentary: "",
    },
    analysis: {
      patternOfResults: "",
      writtenEvidence: "",
      assumptions: "",
      reasonableness: "",
      methodComparison: "",
      strengths: [createBlankAnalysisPoint()],
      limitations: [createBlankAnalysisPoint()],
      improvements: [createBlankImprovementPoint()],
    },
    conclusion: {
      relationBack: "",
      majorFindings: "",
      solutionStatement: "",
    },
    meta: {
      lastSavedAt: "",
      saveMessage: "Not saved yet",
    },
  };
}

let state = createDefaultState();
const listeners = new Set();

function deepClone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeWithDefaults(defaultValue, incomingValue) {
  if (Array.isArray(defaultValue)) {
    if (!Array.isArray(incomingValue)) {
      return deepClone(defaultValue);
    }

    return deepClone(incomingValue);
  }

  if (isObject(defaultValue)) {
    const merged = {};
    const incomingObj = isObject(incomingValue) ? incomingValue : {};
    const keys = new Set([
      ...Object.keys(defaultValue),
      ...Object.keys(incomingObj),
    ]);

    keys.forEach((key) => {
      if (key in defaultValue) {
        merged[key] = mergeWithDefaults(defaultValue[key], incomingObj[key]);
      } else {
        merged[key] = deepClone(incomingObj[key]);
      }
    });

    return merged;
  }

  return incomingValue === undefined ? defaultValue : incomingValue;
}

function toSafeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampColumnIndex(value, maxColumnIndex, fallback) {
  return Math.max(0, Math.min(maxColumnIndex, toSafeInteger(value, fallback)));
}

function normaliseGraphCard(graph, maxColumnIndex) {
  const safeGraph = isObject(graph) ? graph : {};
  const fallbackGraph = createBlankGraphCard();
  const graphType = GRAPH_TYPES.has(safeGraph.graphType)
    ? safeGraph.graphType
    : fallbackGraph.graphType;
  const trendlineType = TRENDLINE_TYPES.has(safeGraph.trendlineType)
    ? safeGraph.trendlineType
    : fallbackGraph.trendlineType;
  const xColumn = clampColumnIndex(
    safeGraph.xColumn,
    maxColumnIndex,
    fallbackGraph.xColumn,
  );

  const rawYColumns = Array.isArray(safeGraph.yColumns)
    ? safeGraph.yColumns
    : safeGraph.yColumn !== undefined
      ? [safeGraph.yColumn]
      : fallbackGraph.yColumns;

  const yColumns = Array.from(
    new Set(
      rawYColumns
        .map((value) => toSafeInteger(value, Number.NaN))
        .filter((value) => Number.isFinite(value))
        .map((value) =>
          clampColumnIndex(value, maxColumnIndex, fallbackGraph.yColumns[0]),
        )
        .filter((value) => value !== xColumn),
    ),
  );

  if (yColumns.length === 0) {
    for (let index = 0; index <= maxColumnIndex; index += 1) {
      if (index !== xColumn) {
        yColumns.push(index);
        break;
      }
    }
  }

  const hasBubbleRadiusColumn =
    safeGraph.bubbleRadiusColumn !== undefined &&
    safeGraph.bubbleRadiusColumn !== null &&
    String(safeGraph.bubbleRadiusColumn).trim() !== "";
  const bubbleRadiusColumn = hasBubbleRadiusColumn
    ? clampColumnIndex(
        safeGraph.bubbleRadiusColumn,
        maxColumnIndex,
        fallbackGraph.yColumns[0],
      )
    : null;

  return {
    graphType,
    trendlineType,
    xColumn,
    yColumns,
    bubbleRadiusColumn,
    startAtOrigin: Boolean(safeGraph.startAtOrigin),
  };
}

export function normaliseState(candidateState) {
  const defaults = createDefaultState();
  const merged = mergeWithDefaults(defaults, candidateState);

  if (
    !Array.isArray(merged.investigation.cycles) ||
    merged.investigation.cycles.length === 0
  ) {
    merged.investigation.cycles = [createBlankInvestigationCycle()];
  }

  merged.investigation.cycles = merged.investigation.cycles.map((cycle) => ({
    heading: cycle?.heading ?? "",
    introduce: cycle?.introduce ?? "",
    workings: cycle?.workings ?? "",
    explanation: cycle?.explanation ?? "",
  }));

  if (!Array.isArray(merged.data.columns) || merged.data.columns.length < 2) {
    merged.data.columns = deepClone(defaults.data.columns);
  }

  merged.data.columns = merged.data.columns.map((column, index) => ({
    name: column?.name || `Column ${index + 1}`,
    unit: column?.unit ?? "",
  }));

  const columnCount = merged.data.columns.length;
  merged.data.rowCount = Math.max(1, Math.min(200, toSafeInteger(merged.data.rowCount, 3)));

  if (!Array.isArray(merged.data.rows)) {
    merged.data.rows = createEmptyRows(merged.data.rowCount, columnCount);
  }

  merged.data.rows = merged.data.rows
    .slice(0, merged.data.rowCount)
    .map((row) => {
      const safeRow = Array.isArray(row) ? row.slice(0, columnCount) : [];
      while (safeRow.length < columnCount) {
        safeRow.push("");
      }
      return safeRow.map((cell) => (cell === null || cell === undefined ? "" : String(cell)));
    });

  while (merged.data.rows.length < merged.data.rowCount) {
    merged.data.rows.push(Array.from({ length: columnCount }, () => ""));
  }

  merged.data.includeAverage = Boolean(merged.data.includeAverage);
  merged.data.includeStandardDeviation = Boolean(merged.data.includeStandardDeviation);

  const maxColumnIndex =
    merged.data.columns.length -
    1 +
    (merged.data.includeAverage ? 1 : 0) +
    (merged.data.includeStandardDeviation ? 1 : 0);

  const rawGraphCards =
    Array.isArray(candidateState?.graphs?.cards) && candidateState.graphs.cards.length > 0
      ? candidateState.graphs.cards
      : [createBlankGraphCard()];

  merged.graphs.cards = rawGraphCards
    .map((graph) => normaliseGraphCard(graph, maxColumnIndex))
    .filter((graph) => Array.isArray(graph.yColumns) && graph.yColumns.length > 0);

  if (merged.graphs.cards.length === 0) {
    merged.graphs.cards = [normaliseGraphCard(createBlankGraphCard(), maxColumnIndex)];
  }

  if (!Array.isArray(merged.analysis.strengths) || merged.analysis.strengths.length === 0) {
    merged.analysis.strengths = [createBlankAnalysisPoint()];
  }

  merged.analysis.strengths = merged.analysis.strengths.map((row) => ({
    factor: row?.factor ?? "",
    impact: row?.impact ?? "",
  }));

  if (
    !Array.isArray(merged.analysis.limitations) ||
    merged.analysis.limitations.length === 0
  ) {
    merged.analysis.limitations = [createBlankAnalysisPoint()];
  }

  merged.analysis.limitations = merged.analysis.limitations.map((row) => ({
    factor: row?.factor ?? "",
    impact: row?.impact ?? "",
  }));

  if (
    !Array.isArray(merged.analysis.improvements) ||
    merged.analysis.improvements.length === 0
  ) {
    merged.analysis.improvements = [createBlankImprovementPoint()];
  }

  merged.analysis.improvements = merged.analysis.improvements.map((row) => ({
    improvement: row?.improvement ?? "",
    benefit: row?.benefit ?? "",
  }));

  return merged;
}

function notify() {
  const snapshot = getState();
  listeners.forEach((listener) => listener(snapshot));
}

export function getState() {
  return deepClone(state);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateState(mutator, options = {}) {
  const draft = getState();
  mutator(draft);
  state = normaliseState(draft);
  if (!options.silent) {
    notify();
  }
}

export function replaceState(nextState, options = {}) {
  state = normaliseState(nextState);
  if (!options.silent) {
    notify();
  }
}

export function resetState(options = {}) {
  state = createDefaultState();
  if (!options.silent) {
    notify();
  }
}
