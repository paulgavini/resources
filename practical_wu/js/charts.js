let chartInstance = null;

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

  return baseColumns;
}

export function getDisplayCellValue(data, row, columnMeta) {
  if (columnMeta.source === "average") {
    return calculateAverage(row.slice(1), 0);
  }

  return row[columnMeta.sourceIndex] ?? "";
}

function buildChartDataset(state) {
  const displayColumns = getDisplayColumns(state.data);
  const xColumn = displayColumns[state.analysis.xColumn];
  const yColumn = displayColumns[state.analysis.yColumn];

  if (!xColumn || !yColumn) {
    return { ok: false, message: "Select valid columns for the graph axes." };
  }

  const rows = state.data.rows ?? [];
  const points = [];

  rows.forEach((row, rowIndex) => {
    const xValue = getDisplayCellValue(state.data, row, xColumn);
    const yValue = getDisplayCellValue(state.data, row, yColumn);
    const numericY = parseNumeric(yValue);

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

  if (points.length < 2) {
    return {
      ok: false,
      message: "Enter at least two rows with numeric Y-axis values to draw the graph.",
    };
  }

  return {
    ok: true,
    xColumn,
    yColumn,
    points,
  };
}

function destroyExistingChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

function formatAxisTitle(column) {
  const name = String(column?.name ?? "").trim() || "Axis";
  const unit = String(column?.unit ?? "").trim();
  return unit ? `${name} (${unit})` : name;
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

function buildTrendlineDataset(graphType, points, trendlineResult) {
  if (!trendlineResult.ok || trendlineResult.values.length !== points.length) {
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

  if (graphType === "scatter") {
    return {
      ...common,
      data: points.map((point, index) => ({
        x: point.x,
        y: trendlineResult.values[index],
      })),
      showLine: true,
    };
  }

  return {
    ...common,
    data: trendlineResult.values,
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

export function renderChart(canvas, state) {
  if (!canvas) {
    return { ok: false, message: "Chart canvas not found." };
  }

  if (typeof window.Chart === "undefined") {
    return { ok: false, message: "Chart.js failed to load." };
  }

  const dataset = buildChartDataset(state);
  if (!dataset.ok) {
    destroyExistingChart();
    return dataset;
  }

  const graphType = state.analysis.graphType;
  const trendlineType = String(state.analysis.trendlineType ?? "none");
  const colour = "#0b5ea8";
  const border = "#0a497f";

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
        legend: { display: false },
        trendSummaryOverlay: {
          text: "",
        },
      },
      scales: {
        x: {
          title: { display: true, text: formatAxisTitle(dataset.xColumn) },
        },
        y: {
          title: { display: true, text: formatAxisTitle(dataset.yColumn) },
          beginAtZero: false,
        },
      },
    },
  };

  if (graphType === "scatter") {
    const scatterPoints = dataset.points
      .filter((point) => point.xNum !== null)
      .map((point) => ({ x: point.xNum, y: point.yNum }));

    if (scatterPoints.length < 2) {
      destroyExistingChart();
      return {
        ok: false,
        message: "Scatter plots need numeric values for both axes in at least two rows.",
      };
    }

    config.data = {
      datasets: [
        {
          label: "Data",
          data: scatterPoints,
          backgroundColor: colour,
          borderColor: border,
          pointRadius: 5,
        },
      ],
    };
  } else {
    const labels = dataset.points.map((point) => String(point.xRaw));
    const values = dataset.points.map((point) => point.yNum);

    config.data = {
      labels,
      datasets: [
        {
          label: "Data",
          data: values,
          borderColor: border,
          backgroundColor: graphType === "bar" ? "#2787d6" : colour,
          fill: false,
          tension: 0.2,
          pointRadius: 4,
        },
      ],
    };
  }

  let trendlineSummaryText = "";

  if (trendlineType !== "none") {
    if (graphType !== "bar") {
      const trendContext = buildTrendContext(graphType, dataset.points);
      if (trendContext.ok) {
        const trendlineResult = buildTrendlineResult(
          trendlineType,
          trendContext.points,
        );
        if (trendlineResult.ok) {
          const trendlineDataset = buildTrendlineDataset(
            graphType,
            trendContext.points,
            trendlineResult,
          );

          if (trendlineDataset) {
            config.data.datasets.push(trendlineDataset);
            config.options.plugins.legend.display = true;
            trendlineSummaryText = buildTrendlineSummaryText(trendlineResult);
          }
        }
      }
    }
  }

  config.options.plugins.trendSummaryOverlay.text = trendlineSummaryText;
  config.options.layout.padding.bottom = trendlineSummaryText
    ? TREND_SUMMARY_BOTTOM_PADDING
    : 0;

  destroyExistingChart();
  chartInstance = new window.Chart(canvas, config);
  chartInstance.update("none");

  const baseMessage = `${graphType[0].toUpperCase()}${graphType.slice(1)} graph updated from data table.`;
  const message = baseMessage;

  return {
    ok: true,
    message,
    imageDataUrl:
      typeof chartInstance.toBase64Image === "function"
        ? chartInstance.toBase64Image()
        : "",
  };
}

export function destroyChart() {
  destroyExistingChart();
}
