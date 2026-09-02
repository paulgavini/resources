const PAGE_SIZES = {
  A4: [210, 297],
  A3: [297, 420],
};

const controls = {
  duplex: document.querySelector("#duplex"),
  margin: document.querySelector("#margin"),
  spacing: document.querySelector("#spacing"),
  majorEvery: document.querySelector("#majorEvery"),
  lineWidth: document.querySelector("#lineWidth"),
  minorColour: document.querySelector("#minorColour"),
  majorColour: document.querySelector("#majorColour"),
  paperColour: document.querySelector("#paperColour"),
};

const stage = document.querySelector("#paperStage");
const previewWell = document.querySelector("#previewWell");
const pageSizeStyle = document.querySelector("#pageSizeStyle");
const presetButtons = [...document.querySelectorAll("[data-spacing]")];
const themeToggle = document.querySelector("#themeToggle");
const marginNumber = document.querySelector("#marginNumber");

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
}

function savedTheme() {
  try {
    return localStorage.getItem("graph-paper-theme");
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem("graph-paper-theme", theme);
  } catch {
    // The theme still applies for this visit when storage is unavailable.
  }
}

function setPreviewZoom(showActualSize) {
  previewWell.classList.toggle("is-actual-size", showActualSize);
  previewWell.setAttribute("aria-pressed", String(showActualSize));
  previewWell.setAttribute(
    "aria-label",
    showActualSize
      ? "Graph paper preview at 100 percent size. Activate to fit the sheet to the panel."
      : "Graph paper preview fitted to the panel. Activate to view at 100 percent size.",
  );
  document.querySelector("#zoomStatusText").textContent = showActualSize ? "Preview: 100%" : "Preview: Fit";
}

function togglePreviewZoom() {
  setPreviewZoom(!previewWell.classList.contains("is-actual-size"));
}

function selected(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

function cleanNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function preciseNumber(value) {
  return String(Number(value.toFixed(2)));
}

function settings() {
  const page = selected("pageSize");
  const orientation = selected("orientation");
  let [width, height] = PAGE_SIZES[page];
  if (orientation === "landscape") [width, height] = [height, width];
  return {
    page,
    orientation,
    width,
    height,
    duplex: controls.duplex.checked,
    margin: Number(controls.margin.value),
    spacing: Number(controls.spacing.value),
    majorEvery: Number(controls.majorEvery.value),
    lineWidth: Number(controls.lineWidth.value),
    minorColour: controls.minorColour.value,
    majorColour: controls.majorColour.value,
    paperColour: controls.paperColour.value,
  };
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]);
}

function geometry(config) {
  const usableWidth = Math.max(0, config.width - config.margin * 2);
  const usableHeight = Math.max(0, config.height - config.margin * 2);
  const availableColumns = Math.floor(usableWidth / config.spacing);
  const availableRows = Math.floor(usableHeight / config.spacing);

  function completeBoldBlocks(availableCells) {
    if (config.majorEvery <= 0 || availableCells < config.majorEvery) return availableCells;
    return Math.floor(availableCells / config.majorEvery) * config.majorEvery;
  }

  const columns = completeBoldBlocks(availableColumns);
  const rows = completeBoldBlocks(availableRows);
  const gridWidth = columns * config.spacing;
  const gridHeight = rows * config.spacing;
  return {
    columns,
    rows,
    gridWidth,
    gridHeight,
    x: (config.width - gridWidth) / 2,
    y: (config.height - gridHeight) / 2,
  };
}

function makeSvg(config) {
  const grid = geometry(config);
  const minor = [];
  const major = [];

  for (let index = 0; index <= grid.columns; index += 1) {
    const x = grid.x + index * config.spacing;
    const isBoldEdge = index === 0 || index === grid.columns;
    const isBoldInterval = config.majorEvery > 0 && index % config.majorEvery === 0;
    const target = config.majorEvery > 0 && (isBoldEdge || isBoldInterval) ? major : minor;
    target.push(`<path d="M ${x} ${grid.y} V ${grid.y + grid.gridHeight}"/>`);
  }
  for (let index = 0; index <= grid.rows; index += 1) {
    const y = grid.y + index * config.spacing;
    const isBoldEdge = index === 0 || index === grid.rows;
    const isBoldInterval = config.majorEvery > 0 && index % config.majorEvery === 0;
    const target = config.majorEvery > 0 && (isBoldEdge || isBoldInterval) ? major : minor;
    target.push(`<path d="M ${grid.x} ${y} H ${grid.x + grid.gridWidth}"/>`);
  }

  const minorWidth = config.lineWidth;
  const majorWidth = Math.min(0.6, Math.max(minorWidth * 2, minorWidth + 0.08));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${config.width}mm" height="${config.height}mm" viewBox="0 0 ${config.width} ${config.height}" role="img" aria-label="${config.page} ${config.orientation} square graph paper with ${cleanNumber(config.spacing)} millimetre spacing">
  <rect width="${config.width}" height="${config.height}" fill="${escapeXml(config.paperColour)}"/>
  <g fill="none" stroke="${escapeXml(config.minorColour)}" stroke-width="${minorWidth}">${minor.join("")}</g>
  <g fill="none" stroke="${escapeXml(config.majorColour)}" stroke-width="${majorWidth}">${major.join("")}</g>
</svg>`;
}

function render() {
  const config = settings();
  const grid = geometry(config);
  stage.innerHTML = makeSvg(config);
  document.querySelector("#printPages").innerHTML = Array.from(
    { length: config.duplex ? 2 : 1 },
    () => `<div class="print-sheet">${makeSvg(config)}</div>`,
  ).join("");
  stage.style.maxWidth = config.orientation === "landscape" ? "660px" : "510px";
  document.documentElement.style.setProperty("--print-width", `${config.width}mm`);
  document.documentElement.style.setProperty("--print-height", `${config.height}mm`);
  document.documentElement.style.setProperty("--preview-paper-width", `${config.width}mm`);
  document.documentElement.style.setProperty("--preview-paper-height", `${config.height}mm`);
  pageSizeStyle.textContent = `@page { size: ${config.page} ${config.orientation}; margin: 0; }`;

  marginNumber.value = cleanNumber(config.margin);
  document.querySelector("#spacingOutput").textContent = `${cleanNumber(config.spacing)} mm`;
  document.querySelector("#majorOutput").textContent = config.majorEvery === 0 ? "None" : `Every ${config.majorEvery}`;
  document.querySelector("#lineWidthOutput").textContent = `${preciseNumber(config.lineWidth)} mm`;
  document.querySelector("#minorHex").textContent = config.minorColour.toUpperCase();
  document.querySelector("#majorHex").textContent = config.majorColour.toUpperCase();
  document.querySelector("#paperHex").textContent = config.paperColour.toUpperCase();
  document.querySelector("#sheetStat").textContent = `${config.page} · ${config.orientation[0].toUpperCase()}${config.orientation.slice(1)}${config.duplex ? " · 2-sided" : ""}`;
  document.querySelector("#gridStat").textContent = `${grid.columns} × ${grid.rows} squares`;
  document.querySelector("#spacingStat").textContent = `${cleanNumber(config.spacing)} mm`;
  document.querySelector("#areaStat").textContent = `${cleanNumber(grid.gridWidth)} × ${cleanNumber(grid.gridHeight)} mm`;
  const duplexInstruction = config.duplex
    ? ` Enable “Two-sided”${config.orientation === "portrait" ? " with long-edge binding" : " with short-edge binding"}.`
    : "";
  const a3Fallback = config.page === "A3"
    ? " If the dialog still shows A4, select A3 from Paper Size."
    : "";
  document.querySelector("#printNoteText").textContent = `Requested: ${config.page} ${config.orientation}. Choose “Actual size” or 100% for exact squares.${duplexInstruction}${a3Fallback}`;
  document.querySelector("#printButton").textContent = `Print ${config.page} / Save PDF`;

  presetButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.spacing) === config.spacing);
  });
}

function downloadSvg() {
  const config = settings();
  const svg = makeSvg(config);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `graph-paper-${config.page.toLowerCase()}-${config.orientation}-${cleanNumber(config.spacing).replace(".", "-")}mm.svg`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

Object.values(controls).forEach((control) => control.addEventListener("input", render));
marginNumber.addEventListener("input", () => {
  const value = Number(marginNumber.value);
  if (value >= 10 && value <= 40) {
    controls.margin.value = String(value);
    render();
  }
});
marginNumber.addEventListener("change", () => {
  const value = Math.min(40, Math.max(10, Number(marginNumber.value) || 10));
  controls.margin.value = String(value);
  render();
});
document.querySelectorAll('input[type="radio"]').forEach((control) => control.addEventListener("change", render));
presetButtons.forEach((button) => button.addEventListener("click", () => {
  controls.spacing.value = button.dataset.spacing;
  render();
}));
document.querySelector("#downloadButton").addEventListener("click", downloadSvg);
document.querySelector("#printButton").addEventListener("click", () => window.print());
themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  storeTheme(nextTheme);
});
previewWell.addEventListener("click", togglePreviewZoom);
previewWell.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    togglePreviewZoom();
  }
});
document.querySelectorAll("[data-placeholder-link]").forEach((link) => {
  link.addEventListener("click", (event) => event.preventDefault());
});

applyTheme(savedTheme() === "dark" ? "dark" : "light");
render();
