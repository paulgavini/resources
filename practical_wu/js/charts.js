let chartInstance = null;

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

  rows.forEach((row) => {
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
  const colour = "#0b5ea8";
  const border = "#0a497f";

  const config = {
    type: graphType,
    data: {},
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
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

  destroyExistingChart();
  chartInstance = new window.Chart(canvas, config);
  chartInstance.update("none");

  return {
    ok: true,
    message: `${graphType[0].toUpperCase()}${graphType.slice(1)} graph updated from data table.`,
    imageDataUrl:
      typeof chartInstance.toBase64Image === "function"
        ? chartInstance.toBase64Image()
        : "",
  };
}

export function destroyChart() {
  destroyExistingChart();
}
