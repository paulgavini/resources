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

export function createBlankAnalysisGraph() {
  return {
    graphType: "line",
    trendlineType: "none",
    xColumn: 0,
    yColumns: [1],
    bubbleRadiusColumn: null,
    startAtOrigin: false,
  };
}

export function createDefaultState() {
  return {
    setup: {
      title: "",
      subject: "Science",
      yearLevel: "",
      teacher: "",
      className: "",
      dueDate: "",
      investigationType: "Fair test",
    },
    question: {
      text: "",
    },
    hypothesis: {
      statement: "",
      reasoning: "",
    },
    variables: {
      independent: "",
      dependent: "",
      controlled: [createBlankControlledVariable()],
    },
    risks: [createBlankRiskRow()],
    materials: [createBlankMaterial()],
    method: {
      steps: [""],
    },
    data: {
      columns: [
        { name: "Independent variable", unit: "" },
        { name: "Dependent variable", unit: "" },
      ],
      rowCount: 5,
      rows: createEmptyRows(5, 2),
      includeAverage: false,
      includeStandardDeviation: false,
    },
    analysis: {
      graphs: [createBlankAnalysisGraph()],
      graphCommentary: "",
      trend: "",
      anomalies: "",
      hypothesisSupported: "",
    },
    evaluation: {
      validity: "",
      reliability: "",
      limitations: "",
      improvements: "",
    },
    conclusion: {
      claim: "",
      evidence: "",
      reasoning: "",
    },
    meta: {
      lastSavedAt: "",
      saveMessage: "Not saved yet",
    },
  };
}

let state = createDefaultState();
const listeners = new Set();

export function createBlankControlledVariable() {
  return {
    name: "",
    reason: "",
    controlMethod: "",
  };
}

export function createBlankRiskRow() {
  return {
    hazard: "",
    risk: "",
    precaution: "",
  };
}

export function createBlankMaterial() {
  return {
    item: "",
    quantity: "",
    unit: "",
  };
}

export function createEmptyRows(rowCount, columnCount) {
  return Array.from({ length: rowCount }, () =>
    Array.from({ length: columnCount }, () => ""),
  );
}

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

function normaliseAnalysisGraph(graph, maxColumnIndex) {
  const safeGraph = isObject(graph) ? graph : {};
  const fallbackGraph = createBlankAnalysisGraph();
  const graphType = GRAPH_TYPES.has(safeGraph.graphType)
    ? safeGraph.graphType
    : fallbackGraph.graphType;
  const trendlineType = TRENDLINE_TYPES.has(safeGraph.trendlineType)
    ? safeGraph.trendlineType
    : fallbackGraph.trendlineType;
  const xColumn = clampColumnIndex(safeGraph.xColumn, maxColumnIndex, fallbackGraph.xColumn);

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
        .map((value) => clampColumnIndex(value, maxColumnIndex, fallbackGraph.yColumns[0]))
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

  if (!Array.isArray(merged.variables.controlled) || merged.variables.controlled.length === 0) {
    merged.variables.controlled = [createBlankControlledVariable()];
  }

  merged.variables.controlled = merged.variables.controlled.map((row) => ({
    name: row?.name ?? "",
    reason: row?.reason ?? "",
    controlMethod: row?.controlMethod ?? "",
  }));

  if (!Array.isArray(merged.risks) || merged.risks.length === 0) {
    merged.risks = [createBlankRiskRow()];
  }

  merged.risks = merged.risks.map((row) => ({
    hazard: row?.hazard ?? "",
    risk: row?.risk ?? "",
    precaution: row?.precaution ?? "",
  }));

  if (!Array.isArray(merged.materials) || merged.materials.length === 0) {
    merged.materials = [createBlankMaterial()];
  }

  merged.materials = merged.materials.map((row) => ({
    item: row?.item ?? "",
    quantity: row?.quantity ?? "",
    unit: row?.unit ?? "",
  }));

  if (!Array.isArray(merged.method.steps) || merged.method.steps.length === 0) {
    merged.method.steps = [""];
  }

  merged.method.steps = merged.method.steps.map((step) =>
    typeof step === "string" ? step : "",
  );

  if (!Array.isArray(merged.data.columns) || merged.data.columns.length < 2) {
    merged.data.columns = deepClone(defaults.data.columns);
  }

  merged.data.columns = merged.data.columns.map((column, index) => ({
    name: column?.name || `Column ${index + 1}`,
    unit: column?.unit ?? "",
  }));

  const columnCount = merged.data.columns.length;
  merged.data.rowCount = Math.max(1, Math.min(200, toSafeInteger(merged.data.rowCount, 5)));

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

  const maxColumnIndex = merged.data.includeAverage
    ? merged.data.columns.length + (merged.data.includeStandardDeviation ? 1 : 0)
    : merged.data.columns.length - 1 + (merged.data.includeStandardDeviation ? 1 : 0);

  const candidateAnalysis = isObject(candidateState?.analysis) ? candidateState.analysis : {};
  const rawGraphs =
    Array.isArray(candidateAnalysis.graphs) && candidateAnalysis.graphs.length > 0
      ? candidateAnalysis.graphs
      : [
          {
            graphType: candidateAnalysis.graphType,
            trendlineType: candidateAnalysis.trendlineType,
            xColumn: candidateAnalysis.xColumn,
            yColumns: Array.isArray(candidateAnalysis.yColumns)
              ? candidateAnalysis.yColumns
              : [candidateAnalysis.yColumn],
          },
        ];

  merged.analysis.graphs = rawGraphs
    .map((graph) => normaliseAnalysisGraph(graph, maxColumnIndex))
    .filter((graph) => Array.isArray(graph.yColumns) && graph.yColumns.length > 0);

  if (merged.analysis.graphs.length === 0) {
    merged.analysis.graphs = [normaliseAnalysisGraph(createBlankAnalysisGraph(), maxColumnIndex)];
  }

  delete merged.analysis.graphType;
  delete merged.analysis.trendlineType;
  delete merged.analysis.xColumn;
  delete merged.analysis.yColumn;

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
