let chartInstances = [];

const GRAPH_TYPE_LABELS = {
  line: "Line",
  scatter: "Scatter",
  bar: "Bar",
  bubble: "Bubble",
  pie: "Pie",
  doughnut: "Doughnut",
  polarArea: "Polar area",
  radar: "Radar",
};

const TRENDLINE_SUPPORTED_TYPES = new Set(["line", "scatter"]);
const PIE_LIKE_GRAPH_TYPES = new Set(["pie", "doughnut", "polarArea"]);

const TRENDLINE_LABELS = {
  linear: "Linear",
  quadratic: "Quadratic",
  exponential: "Exponential",
  logarithmic: "Logarithmic",
  power: "Power",
  "moving-average": "Moving average",
};

const TRENDLINE_COLOUR = "#c12661";
const MOVING_AVERAGE_WINDOW = 3;
const EPSILON = 1e-12;
const RSQUARED_LABEL = "R²";
const TREND_SUMMARY_LINE_HEIGHT = 14;
const TREND_SUMMARY_BOTTOM_PADDING = 58;
const SERIES_COLOURS = [
  { border: "#0a497f", background: "#2787d6" },
  { border: "#0f766e", background: "#1da89a" },
  { border: "#8b5a00", background: "#c98a12" },
  { border: "#8b1e3f", background: "#c74374" },
  { border: "#5b3f9b", background: "#7f62d4" },
  { border: "#8f3f1b", background: "#cb6a32" },
];

function wrapCanvasText(context, text, maxWidth) {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const lines = [];
  let currentLine = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const nextWord = words[index];
    const trialLine = `${currentLine} ${nextWord}`;
    if (context.measureText(trialLine).width <= maxWidth) {
      currentLine = trialLine;
    } else {
      lines.push(currentLine);
      currentLine = nextWord;
    }
  }

  lines.push(currentLine);
  return lines;
}

const trendSummaryOverlayPlugin = {
  id: "trendSummaryOverlay",
  afterDraw(chart, _args, pluginOptions) {
    const text = String(pluginOptions?.text ?? "").trim();
    if (!text || !chart?.ctx || !chart?.chartArea) {
      return;
    }

    const { ctx, chartArea } = chart;
    const xScale = chart.scales?.x;
    const maxTextWidth = Math.max(120, chart.width - 28);

    ctx.save();
    ctx.font = "600 12px Aptos, Calibri, Noto Sans, Segoe UI, sans-serif";
    const lines = wrapCanvasText(ctx, text, maxTextWidth);
    if (lines.length === 0) {
      ctx.restore();
      return;
    }

    ctx.fillStyle = "#1c3c57";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerX = chartArea.left + chartArea.width / 2;
    const preferredStartY = (xScale?.bottom ?? chartArea.bottom) + 14;
    const maxStartY =
      chart.height - 6 - (lines.length - 1) * TREND_SUMMARY_LINE_HEIGHT;
    const startY = Math.min(preferredStartY, maxStartY);

    lines.forEach((line, index) => {
      ctx.fillText(
        line,
        centerX,
        startY + index * TREND_SUMMARY_LINE_HEIGHT,
      );
    });

    ctx.restore();
  },
};

function parseNumeric(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateAverage(row, startIndex = 1) {
  const numeric = row
    .slice(startIndex)
    .map((cell) => parseNumeric(cell))
    .filter((value) => value !== null);

  if (numeric.length === 0) {
    return "";
  }

  const average = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  return Number.isFinite(average) ? average.toFixed(2) : "";
}

function calculateStandardDeviation(row, startIndex = 1) {
  const numeric = row
    .slice(startIndex)
    .map((cell) => parseNumeric(cell))
    .filter((value) => value !== null);

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

export function getDisplayColumns(data) {
  const baseColumns = (data.columns ?? []).map((column, index) => ({
    key: `base-${index}`,
    source: "base",
    sourceIndex: index,
    name: column.name || `Column ${index + 1}`,
    unit: column.unit || "",
  }));

  if (data.includeAverage) {
    baseColumns.push({
      key: "average",
      source: "average",
      sourceIndex: -1,
      name: "Average",
      unit: data.columns?.[1]?.unit || "",
    });
  }

  if (data.includeStandardDeviation) {
    baseColumns.push({
      key: "standard-deviation",
      source: "standard-deviation",
      sourceIndex: -1,
      name: "Standard deviation",
      unit: data.columns?.[1]?.unit || "",
    });
  }

  return baseColumns;
}

export function getDisplayCellValue(data, row, columnMeta) {
  if (columnMeta.source === "average") {
    return calculateAverage(row.slice(1), 0);
  }

  if (columnMeta.source === "standard-deviation") {
    return calculateStandardDeviation(row.slice(1), 0);
  }

  return row[columnMeta.sourceIndex] ?? "";
}

function getSeriesColour(index) {
  return SERIES_COLOURS[index % SERIES_COLOURS.length];
}

function withAlpha(hexColour, alphaSuffix = "33") {
  const colour = String(hexColour ?? "");
  if (/^#[0-9a-f]{6}$/i.test(colour)) {
    return `${colour}${alphaSuffix}`;
  }

  return colour;
}

function formatGraphTypeLabel(graphType) {
  return GRAPH_TYPE_LABELS[graphType] ?? graphType;
}

function formatAxisTitle(column) {
  const name = String(column?.name ?? "").trim() || "Axis";
  const unit = String(column?.unit ?? "").trim();
  return unit ? `${name} (${unit})` : name;
}

function formatYAxisTitle(yColumns) {
  if (!Array.isArray(yColumns) || yColumns.length === 0) {
    return "Y-axis";
  }

  if (yColumns.length === 1) {
    return formatAxisTitle(yColumns[0]);
  }

  return "Selected Y-axis columns";
}

function buildScatterSeries(data, rows, xColumn, yColumn) {
  const points = [];

  rows.forEach((row, rowIndex) => {
    const xValue = getDisplayCellValue(data, row, xColumn);
    const yValue = getDisplayCellValue(data, row, yColumn);
    const xNum = parseNumeric(xValue);
    const yNum = parseNumeric(yValue);

    if (xNum === null || yNum === null) {
      return;
    }

    points.push({
      x: xNum,
      y: yNum,
      xRaw: xValue,
      xNum,
      yNum,
      rowIndex,
    });
  });

  return points;
}

function buildBubbleRadiusValues(data, rows, radiusColumn) {
  const rawValues = rows.map((row) =>
    parseNumeric(getDisplayCellValue(data, row, radiusColumn)),
  );
  const validValues = rawValues.filter((value) => value !== null);

  if (validValues.length === 0) {
    return null;
  }

  const minValue = Math.min(...validValues);
  const maxValue = Math.max(...validValues);

  if (Math.abs(maxValue - minValue) < EPSILON) {
    return rawValues.map((value) => (value === null ? null : 8));
  }

  return rawValues.map((value) => {
    if (value === null) {
      return null;
    }

    const ratio = (value - minValue) / (maxValue - minValue);
    return 5 + ratio * 13;
  });
}

function buildBubbleSeries(data, rows, xColumn, yColumn, radiusValues) {
  const points = [];

  rows.forEach((row, rowIndex) => {
    const xValue = getDisplayCellValue(data, row, xColumn);
    const yValue = getDisplayCellValue(data, row, yColumn);
    const xNum = parseNumeric(xValue);
    const yNum = parseNumeric(yValue);
    const radius = radiusValues[rowIndex];

    if (xNum === null || yNum === null || radius === null) {
      return;
    }

    points.push({
      x: xNum,
      y: yNum,
      r: radius,
      xRaw: xValue,
      xNum,
      yNum,
      rowIndex,
    });
  });

  return points;
}

function buildCartesianSeries(data, rows, xColumn, yColumn) {
  const values = [];
  const points = [];

  rows.forEach((row, rowIndex) => {
    const xValue = getDisplayCellValue(data, row, xColumn);
    const yValue = getDisplayCellValue(data, row, yColumn);
    const numericY = parseNumeric(yValue);
    values.push(numericY);

    if (numericY === null) {
      return;
    }

    points.push({
      xRaw: xValue,
      xNum: parseNumeric(xValue),
      yNum: numericY,
      rowIndex,
    });
  });

  return {
    values,
    points,
  };
}

function rowHasNumericYValue(data, row, yColumns) {
  return yColumns.some((yColumn) => parseNumeric(getDisplayCellValue(data, row, yColumn)) !== null);
}

function buildGraphDataset(data, graphConfig) {
  const graphType = String(graphConfig?.graphType ?? "line");
  const displayColumns = getDisplayColumns(data);
  const xColumn = displayColumns[graphConfig?.xColumn];
  const yColumns = (graphConfig?.yColumns ?? [])
    .map((columnIndex) => displayColumns[columnIndex])
    .filter((column) => column && column !== xColumn);
  const bubbleRadiusColumnIndex = Number.parseInt(graphConfig?.bubbleRadiusColumn, 10);
  const bubbleRadiusCandidate = Number.isFinite(bubbleRadiusColumnIndex)
    ? displayColumns[bubbleRadiusColumnIndex]
    : null;
  const bubbleRadiusColumn =
    bubbleRadiusCandidate &&
    bubbleRadiusCandidate !== xColumn &&
    !yColumns.includes(bubbleRadiusCandidate)
      ? bubbleRadiusCandidate
      : null;

  if (!xColumn || yColumns.length === 0) {
    return { ok: false, message: "Select valid X-axis and Y-axis columns for the graph." };
  }

  const rows = data.rows ?? [];

  if (graphType === "scatter") {
    const series = yColumns
      .map((yColumn) => ({
        column: yColumn,
        label: formatAxisTitle(yColumn),
        points: buildScatterSeries(data, rows, xColumn, yColumn),
      }))
      .filter((entry) => entry.points.length > 0);

    if (!series.some((entry) => entry.points.length >= 2)) {
      return {
        ok: false,
        message: "Scatter plots need numeric values for both axes in at least two rows.",
      };
    }

    return {
      ok: true,
      xColumn,
      yColumns,
      labels: [],
      series,
    };
  }

  if (graphType === "bubble") {
    if (!bubbleRadiusColumn) {
      return {
        ok: false,
        message: "Bubble charts need a separate radius column.",
      };
    }

    const radiusValues = buildBubbleRadiusValues(data, rows, bubbleRadiusColumn);
    if (!radiusValues) {
      return {
        ok: false,
        message: "Bubble charts need numeric values in the radius column.",
      };
    }

    const series = yColumns
      .map((yColumn) => ({
        column: yColumn,
        label: formatAxisTitle(yColumn),
        points: buildBubbleSeries(data, rows, xColumn, yColumn, radiusValues),
      }))
      .filter((entry) => entry.points.length > 0);

    if (series.length === 0) {
      return {
        ok: false,
        message: "Bubble charts need numeric X, Y, and radius values in at least one row.",
      };
    }

    return {
      ok: true,
      xColumn,
      yColumns,
      bubbleRadiusColumn,
      labels: [],
      series,
    };
  }

  const useLinearXAxis =
    graphType === "line" &&
    rows
      .map((row) => ({
        row,
        xNumeric: parseNumeric(getDisplayCellValue(data, row, xColumn)),
      }))
      .every(({ row, xNumeric }) => !rowHasNumericYValue(data, row, yColumns) || xNumeric !== null);

  const labels = rows.map((row) => String(getDisplayCellValue(data, row, xColumn)));
  const series = yColumns
    .map((yColumn) => {
      const result = buildCartesianSeries(data, rows, xColumn, yColumn);
      return {
        column: yColumn,
        label: formatAxisTitle(yColumn),
        values: result.values,
        points: result.points,
      };
    })
    .filter((entry) => entry.points.length > 0);

  const populatedRowCount = rows.filter((row) =>
    yColumns.some((yColumn) => parseNumeric(getDisplayCellValue(data, row, yColumn)) !== null),
  ).length;
  const minimumPopulatedRows = PIE_LIKE_GRAPH_TYPES.has(graphType) ? 1 : 2;

  if (series.length === 0 || populatedRowCount < minimumPopulatedRows) {
    return {
      ok: false,
      message:
        minimumPopulatedRows === 1
          ? "Enter at least one row with numeric Y-axis values to draw the graph."
          : "Enter at least two rows with numeric Y-axis values to draw the graph.",
    };
  }

  return {
    ok: true,
    xColumn,
    yColumns,
    labels,
    series,
    useLinearXAxis,
  };
}

function formatPercentage(value) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  const absolute = Math.abs(value);
  if ((absolute > 0 && absolute < 0.001) || absolute >= 10000) {
    return value.toExponential(3);
  }

  return value.toFixed(4).replace(/\.?0+$/, "");
}

function calculateRSquared(actualValues, predictedValues) {
  if (!Array.isArray(actualValues) || !Array.isArray(predictedValues)) {
    return null;
  }

  if (actualValues.length !== predictedValues.length || actualValues.length < 2) {
    return null;
  }

  const mean =
    actualValues.reduce((sum, value) => sum + value, 0) / actualValues.length;
  const sst = actualValues.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const sse = actualValues.reduce(
    (sum, value, index) => sum + (value - predictedValues[index]) ** 2,
    0,
  );

  if (Math.abs(sst) < EPSILON) {
    return Math.abs(sse) < EPSILON ? 1 : 0;
  }

  const rSquared = 1 - sse / sst;
  return Number.isFinite(rSquared) ? rSquared : null;
}

function calculateResidualStandardDeviation(
  actualValues,
  predictedValues,
  parameterCount = 1,
) {
  if (!Array.isArray(actualValues) || !Array.isArray(predictedValues)) {
    return null;
  }

  if (actualValues.length !== predictedValues.length || actualValues.length < 2) {
    return null;
  }

  const sampleSize = actualValues.length;
  const degreesOfFreedom = sampleSize - parameterCount;
  if (degreesOfFreedom <= 0) {
    return null;
  }

  const sse = actualValues.reduce(
    (sum, value, index) => sum + (value - predictedValues[index]) ** 2,
    0,
  );
  const standardDeviation = Math.sqrt(sse / degreesOfFreedom);
  return Number.isFinite(standardDeviation) ? standardDeviation : null;
}

function fitLinearCoefficients(xValues, yValues) {
  const n = xValues.length;
  if (n < 2 || yValues.length !== n) {
    return null;
  }

  const sumX = xValues.reduce((sum, value) => sum + value, 0);
  const sumY = yValues.reduce((sum, value) => sum + value, 0);
  const sumXX = xValues.reduce((sum, value) => sum + value * value, 0);
  const sumXY = xValues.reduce((sum, value, index) => sum + value * yValues[index], 0);
  const denominator = n * sumXX - sumX * sumX;

  if (Math.abs(denominator) < EPSILON) {
    return null;
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function solveLinearSystem(matrix, vector) {
  const size = matrix.length;
  if (size === 0 || vector.length !== size) {
    return null;
  }

  const augmented = matrix.map((row, rowIndex) => [...row, vector[rowIndex]]);

  for (let pivotIndex = 0; pivotIndex < size; pivotIndex += 1) {
    let maxRow = pivotIndex;
    for (let row = pivotIndex + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row][pivotIndex]) >
        Math.abs(augmented[maxRow][pivotIndex])
      ) {
        maxRow = row;
      }
    }

    if (Math.abs(augmented[maxRow][pivotIndex]) < EPSILON) {
      return null;
    }

    if (maxRow !== pivotIndex) {
      [augmented[pivotIndex], augmented[maxRow]] = [
        augmented[maxRow],
        augmented[pivotIndex],
      ];
    }

    const pivotValue = augmented[pivotIndex][pivotIndex];
    for (let col = pivotIndex; col <= size; col += 1) {
      augmented[pivotIndex][col] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivotIndex) {
        continue;
      }

      const factor = augmented[row][pivotIndex];
      for (let col = pivotIndex; col <= size; col += 1) {
        augmented[row][col] -= factor * augmented[pivotIndex][col];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function buildLinearTrendline(points) {
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const coefficients = fitLinearCoefficients(xValues, yValues);

  if (!coefficients) {
    return {
      ok: false,
      message: "Linear trendline needs variation in X values.",
    };
  }

  const values = xValues.map((x) => coefficients.intercept + coefficients.slope * x);
  const interceptSign = coefficients.intercept < 0 ? "-" : "+";
  const equation = `y = ${formatNumber(coefficients.slope)}x ${interceptSign} ${formatNumber(Math.abs(coefficients.intercept))}`;

  return {
    ok: true,
    label: TRENDLINE_LABELS.linear,
    values,
    equation,
    standardDeviation: calculateResidualStandardDeviation(yValues, values, 2),
    rSquared: calculateRSquared(yValues, values),
    curved: false,
  };
}

function buildQuadraticTrendline(points) {
  if (points.length < 3) {
    return {
      ok: false,
      message: "Quadratic trendline needs at least three data points.",
    };
  }

  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);

  const sumX = xValues.reduce((sum, x) => sum + x, 0);
  const sumX2 = xValues.reduce((sum, x) => sum + x ** 2, 0);
  const sumX3 = xValues.reduce((sum, x) => sum + x ** 3, 0);
  const sumX4 = xValues.reduce((sum, x) => sum + x ** 4, 0);
  const sumY = yValues.reduce((sum, y) => sum + y, 0);
  const sumXY = xValues.reduce((sum, x, index) => sum + x * yValues[index], 0);
  const sumX2Y = xValues.reduce(
    (sum, x, index) => sum + x ** 2 * yValues[index],
    0,
  );

  const coefficients = solveLinearSystem(
    [
      [sumX4, sumX3, sumX2],
      [sumX3, sumX2, sumX],
      [sumX2, sumX, xValues.length],
    ],
    [sumX2Y, sumXY, sumY],
  );

  if (!coefficients) {
    return {
      ok: false,
      message: "Quadratic trendline could not be solved for this dataset.",
    };
  }

  const [a, b, c] = coefficients;
  const values = xValues.map((x) => a * x ** 2 + b * x + c);
  const bSign = b < 0 ? "-" : "+";
  const cSign = c < 0 ? "-" : "+";
  const equation = `y = ${formatNumber(a)}x^2 ${bSign} ${formatNumber(Math.abs(b))}x ${cSign} ${formatNumber(Math.abs(c))}`;

  return {
    ok: true,
    label: TRENDLINE_LABELS.quadratic,
    values,
    equation,
    standardDeviation: calculateResidualStandardDeviation(yValues, values, 3),
    rSquared: calculateRSquared(yValues, values),
    curved: true,
  };
}

function buildExponentialTrendline(points) {
  if (points.some((point) => point.y <= 0)) {
    return {
      ok: false,
      message: "Exponential trendline needs all Y values to be greater than 0.",
    };
  }

  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const logYValues = yValues.map((y) => Math.log(y));
  const coefficients = fitLinearCoefficients(xValues, logYValues);

  if (!coefficients) {
    return {
      ok: false,
      message: "Exponential trendline needs variation in X values.",
    };
  }

  const a = Math.exp(coefficients.intercept);
  const b = coefficients.slope;
  const values = xValues.map((x) => a * Math.exp(b * x));
  const equation = `y = ${formatNumber(a)}e^(${formatNumber(b)}x)`;

  return {
    ok: true,
    label: TRENDLINE_LABELS.exponential,
    values,
    equation,
    standardDeviation: calculateResidualStandardDeviation(yValues, values, 2),
    rSquared: calculateRSquared(yValues, values),
    curved: true,
  };
}

function buildLogarithmicTrendline(points) {
  if (points.some((point) => point.x <= 0)) {
    return {
      ok: false,
      message: "Logarithmic trendline needs all X values to be greater than 0.",
    };
  }

  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const logXValues = xValues.map((x) => Math.log(x));
  const coefficients = fitLinearCoefficients(logXValues, yValues);

  if (!coefficients) {
    return {
      ok: false,
      message: "Logarithmic trendline needs variation in X values.",
    };
  }

  const a = coefficients.slope;
  const b = coefficients.intercept;
  const values = xValues.map((x) => a * Math.log(x) + b);
  const interceptSign = b < 0 ? "-" : "+";
  const equation = `y = ${formatNumber(a)}ln(x) ${interceptSign} ${formatNumber(Math.abs(b))}`;

  return {
    ok: true,
    label: TRENDLINE_LABELS.logarithmic,
    values,
    equation,
    standardDeviation: calculateResidualStandardDeviation(yValues, values, 2),
    rSquared: calculateRSquared(yValues, values),
    curved: true,
  };
}

function buildPowerTrendline(points) {
  if (points.some((point) => point.x <= 0 || point.y <= 0)) {
    return {
      ok: false,
      message: "Power trendline needs all X and Y values to be greater than 0.",
    };
  }

  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const logXValues = xValues.map((x) => Math.log(x));
  const logYValues = yValues.map((y) => Math.log(y));
  const coefficients = fitLinearCoefficients(logXValues, logYValues);

  if (!coefficients) {
    return {
      ok: false,
      message: "Power trendline needs variation in X values.",
    };
  }

  const a = Math.exp(coefficients.intercept);
  const b = coefficients.slope;
  const values = xValues.map((x) => a * x ** b);
  const equation = `y = ${formatNumber(a)}x^${formatNumber(b)}`;

  return {
    ok: true,
    label: TRENDLINE_LABELS.power,
    values,
    equation,
    standardDeviation: calculateResidualStandardDeviation(yValues, values, 2),
    rSquared: calculateRSquared(yValues, values),
    curved: true,
  };
}

function buildMovingAverageTrendline(points) {
  const windowSize = Math.min(MOVING_AVERAGE_WINDOW, points.length);
  if (windowSize < 2) {
    return {
      ok: false,
      message: "Moving average trendline needs at least two data points.",
    };
  }

  const yValues = points.map((point) => point.y);
  const values = yValues.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const windowValues = yValues.slice(start, index + 1);
    return windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length;
  });

  return {
    ok: true,
    label: TRENDLINE_LABELS["moving-average"],
    values,
    equation: `y_i = mean(last ${windowSize} y-values)`,
    standardDeviation: calculateResidualStandardDeviation(yValues, values, 1),
    rSquared: calculateRSquared(yValues, values),
    curved: true,
    note: `${windowSize}-point window.`,
  };
}

function buildTrendlineResult(type, points) {
  switch (type) {
    case "linear":
      return buildLinearTrendline(points);
    case "quadratic":
      return buildQuadraticTrendline(points);
    case "exponential":
      return buildExponentialTrendline(points);
    case "logarithmic":
      return buildLogarithmicTrendline(points);
    case "power":
      return buildPowerTrendline(points);
    case "moving-average":
      return buildMovingAverageTrendline(points);
    default:
      return {
        ok: false,
        message: "Unknown trendline type.",
      };
  }
}

function buildTrendContext(graphType, points) {
  if (graphType === "scatter") {
    const scatterPoints = points
      .filter((point) => point.xNum !== null)
      .map((point) => ({ x: point.xNum, y: point.yNum }))
      .sort((a, b) => a.x - b.x);

    if (scatterPoints.length < 2) {
      return {
        ok: false,
        message: "Scatter trendlines need numeric X values in at least two rows.",
      };
    }

    return {
      ok: true,
      points: scatterPoints,
      usesRowOrderForX: false,
    };
  }

  const usesRowOrderForX = points.some((point) => point.xNum === null);
  const linePoints = points.map((point, index) => ({
    x: point.xNum ?? index + 1,
    y: point.yNum,
  }));

  return {
    ok: true,
    points: linePoints,
    usesRowOrderForX,
  };
}

function buildTrendlineDataset(graphType, series, trendlineResult, useLinearXAxis = false) {
  if (!trendlineResult.ok || trendlineResult.values.length !== series.points.length) {
    return null;
  }

  const common = {
    type: "line",
    label: `${trendlineResult.label} trendline`,
    borderColor: TRENDLINE_COLOUR,
    backgroundColor: TRENDLINE_COLOUR,
    borderWidth: 2,
    borderDash: [8, 4],
    pointRadius: 0,
    fill: false,
    tension: trendlineResult.curved ? 0.18 : 0,
  };

  if (graphType === "scatter" || useLinearXAxis) {
    return {
      ...common,
      data: series.points.map((point, index) => ({
        x: point.x ?? point.xNum,
        y: trendlineResult.values[index],
      })),
      showLine: true,
    };
  }

  const valuesByRow = Array.from({ length: series.values.length }, () => null);
  series.points.forEach((point, index) => {
    valuesByRow[point.rowIndex] = trendlineResult.values[index];
  });

  return {
    ...common,
    data: valuesByRow,
  };
}

function buildTrendlineSummaryText(trendlineResult) {
  if (!trendlineResult?.ok) {
    return "";
  }

  const equationText = trendlineResult.equation
    ? `Equation: ${trendlineResult.equation}.`
    : "";
  const standardDeviationText =
    trendlineResult.standardDeviation === null
      ? "SD: N/A."
      : `SD: ${formatNumber(trendlineResult.standardDeviation)}.`;
  const rSquaredText =
    trendlineResult.rSquared === null
      ? `${RSQUARED_LABEL}: N/A.`
      : `${RSQUARED_LABEL}: ${formatPercentage(trendlineResult.rSquared)}.`;

  return [equationText, standardDeviationText, rSquaredText]
    .filter(Boolean)
    .join(" ");
}

export function renderChart(canvas, state, graphConfig, graphIndex = 0) {
  if (!canvas) {
    return { ok: false, message: "Chart canvas not found." };
  }

  if (typeof window.Chart === "undefined") {
    return { ok: false, message: "Chart.js failed to load." };
  }

  const graphType = String(graphConfig?.graphType ?? "line");
  const trendlineType = String(graphConfig?.trendlineType ?? "none");
  const startAtOrigin = Boolean(graphConfig?.startAtOrigin);
  const dataset = buildGraphDataset(state.data, graphConfig);

  if (!dataset.ok) {
    return dataset;
  }

  const config = {
    type: graphType,
    plugins: [trendSummaryOverlayPlugin],
    data: {},
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          bottom: 0,
        },
      },
      plugins: {
        legend: {
          display:
            dataset.series.length > 1 || PIE_LIKE_GRAPH_TYPES.has(graphType),
        },
        trendSummaryOverlay: {
          text: "",
        },
      },
    },
  };

  if (graphType === "scatter") {
    config.options.scales = {
      x: {
        title: { display: true, text: formatAxisTitle(dataset.xColumn) },
        type: "linear",
        min: startAtOrigin ? 0 : undefined,
      },
      y: {
        title: { display: true, text: formatYAxisTitle(dataset.yColumns) },
        beginAtZero: startAtOrigin,
        min: startAtOrigin ? 0 : undefined,
      },
    };
    config.data = {
      datasets: dataset.series.map((series, index) => {
        const colour = getSeriesColour(index);
        return {
          label: series.label,
          data: series.points.map((point) => ({ x: point.x, y: point.y })),
          backgroundColor: colour.background,
          borderColor: colour.border,
          pointRadius: 5,
          showLine: false,
        };
      }),
    };
  } else if (graphType === "bubble") {
    config.options.scales = {
      x: {
        title: { display: true, text: formatAxisTitle(dataset.xColumn) },
        type: "linear",
        min: startAtOrigin ? 0 : undefined,
      },
      y: {
        title: { display: true, text: formatYAxisTitle(dataset.yColumns) },
        beginAtZero: startAtOrigin,
        min: startAtOrigin ? 0 : undefined,
      },
    };
    config.data = {
      datasets: dataset.series.map((series, index) => {
        const colour = getSeriesColour(index);
        return {
          label: series.label,
          data: series.points.map((point) => ({ x: point.x, y: point.y, r: point.r })),
          backgroundColor: withAlpha(colour.background, "88"),
          borderColor: colour.border,
          borderWidth: 1,
        };
      }),
    };
  } else if (graphType === "line" && dataset.useLinearXAxis) {
    config.options.scales = {
      x: {
        title: { display: true, text: formatAxisTitle(dataset.xColumn) },
        type: "linear",
        min: startAtOrigin ? 0 : undefined,
      },
      y: {
        title: { display: true, text: formatYAxisTitle(dataset.yColumns) },
        beginAtZero: startAtOrigin,
        min: startAtOrigin ? 0 : undefined,
      },
    };
    config.data = {
      datasets: dataset.series.map((series, index) => {
        const colour = getSeriesColour(index);
        return {
          label: series.label,
          data: series.points.map((point) => ({ x: point.xNum, y: point.yNum })),
          borderColor: colour.border,
          backgroundColor: colour.border,
          fill: false,
          tension: 0.2,
          pointRadius: 4,
          showLine: true,
        };
      }),
    };
  } else if (graphType === "radar") {
    config.options.scales = {
      r: {
        beginAtZero: startAtOrigin,
        min: startAtOrigin ? 0 : undefined,
      },
    };
    config.data = {
      labels: dataset.labels,
      datasets: dataset.series.map((series, index) => {
        const colour = getSeriesColour(index);
        return {
          label: series.label,
          data: series.values,
          borderColor: colour.border,
          backgroundColor: withAlpha(colour.background, "33"),
          pointBackgroundColor: colour.border,
          fill: true,
          pointRadius: 3,
        };
      }),
    };
  } else if (PIE_LIKE_GRAPH_TYPES.has(graphType)) {
    if (graphType === "polarArea") {
      config.options.scales = {
        r: {
          beginAtZero: startAtOrigin,
          min: startAtOrigin ? 0 : undefined,
        },
      };
    }

    config.data = {
      labels: dataset.labels,
      datasets: dataset.series.map((series) => ({
        label: series.label,
        data: series.values.map((value) => (value === null ? 0 : value)),
        backgroundColor: dataset.labels.map(
          (_label, labelIndex) => getSeriesColour(labelIndex).background,
        ),
        borderColor: dataset.labels.map(
          (_label, labelIndex) => getSeriesColour(labelIndex).border,
        ),
        borderWidth: 1,
      })),
    };
  } else {
    config.options.scales = {
      x: {
        title: { display: true, text: formatAxisTitle(dataset.xColumn) },
        type: "category",
      },
      y: {
        title: { display: true, text: formatYAxisTitle(dataset.yColumns) },
        beginAtZero: startAtOrigin,
        min: startAtOrigin ? 0 : undefined,
      },
    };
    config.data = {
      labels: dataset.labels,
      datasets: dataset.series.map((series, index) => {
        const colour = getSeriesColour(index);
        return {
          label: series.label,
          data: series.values,
          borderColor: colour.border,
          backgroundColor: graphType === "bar" ? colour.background : colour.border,
          fill: false,
          tension: 0.2,
          pointRadius: 4,
        };
      }),
    };
  }

  let trendlineSummaryText = "";
  let trendlineSkippedForMultiY = false;
  let trendlineUnsupportedType = false;

  if (trendlineType !== "none" && TRENDLINE_SUPPORTED_TYPES.has(graphType)) {
    if (dataset.series.length === 1) {
      const sourceSeries = dataset.series[0];
      const trendContext = buildTrendContext(graphType, sourceSeries.points);
      if (trendContext.ok) {
        const trendlineResult = buildTrendlineResult(
          trendlineType,
          trendContext.points,
        );
        if (trendlineResult.ok) {
          const trendlineDataset = buildTrendlineDataset(
            graphType,
            sourceSeries,
            trendlineResult,
            graphType === "line" && dataset.useLinearXAxis,
          );

          if (trendlineDataset) {
            config.data.datasets.push(trendlineDataset);
            config.options.plugins.legend.display = true;
            trendlineSummaryText = buildTrendlineSummaryText(trendlineResult);
          }
        }
      }
    } else {
      trendlineSkippedForMultiY = true;
    }
  } else if (trendlineType !== "none") {
    trendlineUnsupportedType = true;
  }

  config.options.plugins.trendSummaryOverlay.text = trendlineSummaryText;
  config.options.layout.padding.bottom = trendlineSummaryText
    ? TREND_SUMMARY_BOTTOM_PADDING
    : 0;

  const chartInstance = new window.Chart(canvas, config);
  chartInstance.update("none");
  chartInstances.push(chartInstance);

  const baseMessage = `${formatGraphTypeLabel(graphType)} graph ${graphIndex + 1} updated from data table.`;
  const notes = [];
  if (trendlineSkippedForMultiY) {
    notes.push("Trendlines are only shown when one Y-axis column is selected.");
  }
  if (trendlineUnsupportedType) {
    notes.push("Trendlines are currently available for line and scatter charts only.");
  }
  if (startAtOrigin) {
    if (graphType === "scatter" || graphType === "bubble" || (graphType === "line" && dataset.useLinearXAxis)) {
      notes.push("Axes have been forced to start at 0 where possible.");
    } else if (graphType === "bar" || graphType === "line" || graphType === "radar" || graphType === "polarArea") {
      notes.push("Compatible numeric scales have been forced to start at 0.");
    } else {
      notes.push("Start-at-zero does not apply to pie or doughnut charts.");
    }
  }
  const message = notes.length > 0 ? `${baseMessage} ${notes.join(" ")}` : baseMessage;

  return {
    ok: true,
    message,
    imageDataUrl:
      typeof chartInstance.toBase64Image === "function"
        ? chartInstance.toBase64Image()
        : "",
  };
}

export function destroyCharts() {
  chartInstances.forEach((chartInstance) => chartInstance.destroy());
  chartInstances = [];
}

export function destroyChart() {
  destroyCharts();
}
