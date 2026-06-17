"use strict";

const PDF_POINTS_PER_MM = 72 / 25.4;
const SVG_NS = "http://www.w3.org/2000/svg";
const CUT_STROKE_COLOUR = "#ff0000";
const MARKER_STROKE_COLOUR = "#000000";
const PDF_CUT_STROKE_COLOUR = "1 0 0 RG";
const PDF_MARKER_STROKE_COLOUR = "0 0 0 RG";

let GRID_COLS = 18;
let GRID_ROWS = 18;
let CELL_MM = 5;
let WIDTH_MM = 90;
let HEIGHT_MM = 90;

const state = {
  mode: "generated",
  path: new Set(),
  history: [],
  entranceRow: 8,
  exitRow: 8,
  lastPlaced: null,
  message: "Ready"
};

const els = {
  preview: document.getElementById("mazePreview"),
  specSummary: document.getElementById("specSummary"),
  specBadge: document.getElementById("specBadge"),
  modeLabel: document.getElementById("modeLabel"),
  mazeSummary: document.getElementById("mazeSummary"),
  designerModeBtn: document.getElementById("designerModeBtn"),
  generateBtn: document.getElementById("generateBtn"),
  clearBtn: document.getElementById("clearBtn"),
  undoBtn: document.getElementById("undoBtn"),
  branchMode: document.getElementById("branchMode"),
  baseWidth: document.getElementById("baseWidth"),
  baseHeight: document.getElementById("baseHeight"),
  pathWidth: document.getElementById("pathWidth"),
  applyDimensionsBtn: document.getElementById("applyDimensionsBtn"),
  strokeWidth: document.getElementById("strokeWidth"),
  validateBtn: document.getElementById("validateBtn"),
  downloadSvgBtn: document.getElementById("downloadSvgBtn"),
  downloadPdfBtn: document.getElementById("downloadPdfBtn"),
  status: document.getElementById("status")
};

let clickTimer = null;

function key(row, col) {
  return `${row},${col}`;
}

function fromKey(cellKey) {
  const [row, col] = cellKey.split(",").map(Number);
  return { row, col };
}

function hasCell(row, col) {
  return state.path.has(key(row, col));
}

function inGrid(row, col) {
  return row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS;
}

function isBorderCell(row, col) {
  return row === 0 || row === GRID_ROWS - 1 || col === 0 || col === GRID_COLS - 1;
}

function startCol() {
  return 1;
}

function finishCol() {
  return GRID_COLS - 2;
}

function neighbours(row, col) {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 }
  ].filter(cell => inGrid(cell.row, cell.col));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function countPathNeighbours(row, col) {
  return neighbours(row, col).filter(cell => hasCell(cell.row, cell.col)).length;
}

function generateMaze() {
  state.mode = "generated";
  state.path = buildGeneratedMazePath();
  state.history = [];
  setGeneratedEndpointsFromPath();
  state.lastPlaced = null;
  state.message = "Generated a maze with a blank outer border to keep the ball bearing inside.";
  render();
}

function addGeneratedCell(row, col) {
  state.path.add(key(row, col));
}

function buildGeneratedMazePath() {
  let bestPath = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const path = buildSafeGeneratedPath();
    const report = getPathPlatformReportFor(path);
    const score = report.rows + report.cols + path.size / 100;

    if (isGeneratedPathUsable(path, report)) {
      return path;
    }

    if (score > bestScore) {
      bestPath = path;
      bestScore = score;
    }
  }

  return bestPath || buildSafeGeneratedPath();
}

function buildSafeGeneratedPath() {
  const path = buildPerfectMazeCore();
  addSafeEdgeStubs(path, finishCol(), GRID_ROWS - 2);
  return path;
}

function buildPerfectMazeCore() {
  const logicalRows = Math.max(1, Math.floor((GRID_ROWS - 2) / 2));
  const logicalCols = Math.max(1, Math.floor((GRID_COLS - 2) / 2));
  const path = new Set();
  const visited = Array.from({ length: logicalRows }, () => Array(logicalCols).fill(false));
  const stack = [{ row: 0, col: 0 }];
  const pathRow = row => row * 2 + 1;
  const pathCol = col => col * 2 + 1;

  visited[0][0] = true;
  path.add(key(1, 1));

  while (stack.length) {
    const current = stack[stack.length - 1];
    const choices = shuffle([
      { row: current.row - 1, col: current.col },
      { row: current.row + 1, col: current.col },
      { row: current.row, col: current.col - 1 },
      { row: current.row, col: current.col + 1 }
    ].filter(cell => (
      cell.row >= 0
      && cell.row < logicalRows
      && cell.col >= 0
      && cell.col < logicalCols
      && !visited[cell.row][cell.col]
    )));

    if (!choices.length) {
      stack.pop();
      continue;
    }

    const next = choices[0];
    const currentRow = pathRow(current.row);
    const currentCol = pathCol(current.col);
    const nextRow = pathRow(next.row);
    const nextCol = pathCol(next.col);

    path.add(key((currentRow + nextRow) / 2, (currentCol + nextCol) / 2));
    path.add(key(nextRow, nextCol));
    visited[next.row][next.col] = true;
    stack.push(next);
  }

  return path;
}

function addSafeEdgeStubs(path, rightCol, bottomRow) {
  const rightCandidates = shuffle([...path].map(fromKey)
    .filter(cell => cell.col === rightCol - 1)
    .map(cell => ({ row: cell.row, col: rightCol })));
  const bottomCandidates = shuffle([...path].map(fromKey)
    .filter(cell => cell.row === bottomRow - 1)
    .map(cell => ({ row: bottomRow, col: cell.col })));
  const rightTarget = Math.max(1, Math.min(4, Math.floor(GRID_ROWS / 5)));
  const bottomTarget = Math.max(1, Math.min(4, Math.floor(GRID_COLS / 5)));

  addSafeStubsFromCandidates(path, rightCandidates, rightTarget);
  addSafeStubsFromCandidates(path, bottomCandidates, bottomTarget);
}

function addSafeStubsFromCandidates(path, candidates, targetCount) {
  let added = 0;

  for (const candidate of candidates) {
    if (added >= targetCount) break;
    if (canAddGeneratedPathCell(path, candidate.row, candidate.col)) {
      path.add(key(candidate.row, candidate.col));
      added += 1;
    }
  }
}

function canAddGeneratedPathCell(path, row, col) {
  if (!isInnerPathCell(row, col) || path.has(key(row, col))) return false;
  if (countPathNeighboursIn(path, row, col) !== 1) return false;
  if (wouldCreateTwoByTwoPathBlockIn(path, row, col)) return false;
  const trial = new Set(path);
  trial.add(key(row, col));
  return !hasEnclosedNonPathRegionFor(trial);
}

function isInnerPathCell(row, col) {
  return row >= 1 && row <= GRID_ROWS - 2 && col >= startCol() && col <= finishCol();
}

function countPathNeighboursIn(path, row, col) {
  return neighbours(row, col).filter(cell => path.has(key(cell.row, cell.col))).length;
}

function wouldCreateTwoByTwoPathBlockIn(path, row, col) {
  const candidateKey = key(row, col);
  for (let checkRow = row - 1; checkRow <= row; checkRow += 1) {
    for (let checkCol = col - 1; checkCol <= col; checkCol += 1) {
      if (checkRow < 0 || checkCol < 0 || checkRow >= GRID_ROWS - 1 || checkCol >= GRID_COLS - 1) continue;
      const cells = [
        key(checkRow, checkCol),
        key(checkRow + 1, checkCol),
        key(checkRow, checkCol + 1),
        key(checkRow + 1, checkCol + 1)
      ];
      if (cells.every(cellKey => cellKey === candidateKey || path.has(cellKey))) return true;
    }
  }
  return false;
}

function isGeneratedPathUsable(path, report = getPathPlatformReportFor(path)) {
  const bottomCount = countCellsInRow(path, GRID_ROWS - 2);
  const rightCount = countCellsInCol(path, finishCol());
  const innerCols = GRID_COLS - 2;
  const innerRows = GRID_ROWS - 2;

  return report.fillsPlatform
    && report.hasLeftStart
    && report.hasRightFinish
    && !hasTwoByTwoPathBlockIn(path)
    && !hasEnclosedNonPathRegionFor(path)
    && bottomCount < innerCols
    && rightCount < innerRows;
}

function shuffle(items) {
  const shuffled = items.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function addBranches() {
  const starts = [...state.path].map(fromKey).filter(cell => cell.col > 1 && cell.col < GRID_COLS - 2);
  const branchCount = Math.min(10, Math.max(4, Math.floor(starts.length / 4)));

  for (let i = 0; i < branchCount; i += 1) {
    const safeSnapshot = new Set(state.path);
    let current = starts[randomInt(0, starts.length - 1)];
    const length = randomInt(1, 4);

    for (let step = 0; step < length; step += 1) {
      const choices = neighbours(current.row, current.col)
        .filter(cell => !hasCell(cell.row, cell.col))
        .filter(cell => cell.row > 0 && cell.row < GRID_ROWS - 1)
        .filter(cell => countPathNeighbours(cell.row, cell.col) === 1);

      if (!choices.length) break;
      current = choices[randomInt(0, choices.length - 1)];
      state.path.add(key(current.row, current.col));
    }

    if (hasEnclosedNonPathRegion()) {
      state.path = safeSnapshot;
    }
  }
}

function clearDesign() {
  state.mode = "designer";
  state.path.clear();
  state.history = [];
  state.lastPlaced = null;
  state.entranceRow = Math.max(1, Math.min(GRID_ROWS - 2, Math.floor(GRID_ROWS / 2)));
  state.exitRow = state.entranceRow;
  state.message = "Designer mode is ready. Start one square in from the left border.";
  render();
}

function undo() {
  const previous = state.history.pop();
  if (!previous) {
    state.message = "Nothing to undo.";
    render();
    return;
  }
  state.path.delete(previous);
  state.lastPlaced = state.history[state.history.length - 1] || null;
  updateEntranceExitFromPath();
  state.message = "Removed the most recent placed square.";
  render();
}

function setDesignerMode(on) {
  state.mode = on ? "designer" : "generated";
  if (on && !state.path.size) {
    state.message = "Designer mode is ready. Start one square in from the left border.";
  } else if (on) {
    setLastPlacedFromExistingPath();
    state.message = "Designer mode is active. New cells must touch the previous placed square unless Branch Mode is on.";
  } else {
    state.message = "Generated maze mode is active.";
  }
  render();
}

function setLastPlacedFromExistingPath() {
  if (state.lastPlaced && state.path.has(state.lastPlaced)) return;
  const rightCells = [...state.path].map(fromKey).filter(cell => cell.col === finishCol());
  const fallbackCells = [...state.path].map(fromKey);
  const chosen = rightCells[0] || fallbackCells[fallbackCells.length - 1];
  state.lastPlaced = chosen ? key(chosen.row, chosen.col) : null;
}

function setLastPlacedNearCell(row, col) {
  const nearby = neighbours(row, col).find(cell => hasCell(cell.row, cell.col));
  if (nearby) {
    state.lastPlaced = key(nearby.row, nearby.col);
    return true;
  }
  return false;
}

function placeCell(row, col) {
  if (state.mode !== "designer") return;
  if (!inGrid(row, col)) return;
  if (isBorderCell(row, col)) {
    state.message = "Keep the outside border blank so the ball bearing cannot fall out.";
    render();
    return;
  }
  const cellKey = key(row, col);
  if (state.path.has(cellKey)) {
    state.message = "That square is already part of the path. Double-click it to remove it.";
    render();
    return;
  }

  if (state.path.size > 0) {
    const branchMode = els.branchMode.checked;
    const connectedToAny = countPathNeighbours(row, col) > 0;
    let connectedToLast = false;

    if (!branchMode && !state.lastPlaced) {
      setLastPlacedNearCell(row, col);
    }

    if (state.lastPlaced) {
      const last = fromKey(state.lastPlaced);
      connectedToLast = Math.abs(last.row - row) + Math.abs(last.col - col) === 1;
    }

    if (!branchMode && !connectedToLast) {
      state.message = "Place the next square beside the previous placed square, or turn on Branch Mode to branch from another path square.";
      render();
      return;
    }

    if (branchMode && !connectedToAny) {
      state.message = "Branch Mode still needs the new square to touch at least one existing path square.";
      render();
      return;
    }
  }

  state.path.add(cellKey);
  state.history.push(cellKey);
  state.lastPlaced = cellKey;
  updateEntranceExitFromPath();
  state.message = "Placed a path square.";
  render();
}

function removeCell(row, col) {
  if (state.mode !== "designer") return;
  const cellKey = key(row, col);
  if (!state.path.has(cellKey)) {
    state.message = "Double-click a placed path square to remove it.";
    render();
    return;
  }

  state.path.delete(cellKey);
  state.history = state.history.filter(item => item !== cellKey);
  state.lastPlaced = state.history[state.history.length - 1] || null;
  if (!state.lastPlaced) {
    setLastPlacedNearCell(row, col);
  }
  updateEntranceExitFromPath();
  state.message = "Removed a placed square.";
  render();
}

function updateEntranceExitFromPath() {
  const leftCells = [...state.path].map(fromKey).filter(cell => cell.col === startCol());
  const rightCells = [...state.path].map(fromKey).filter(cell => cell.col === finishCol());
  state.entranceRow = leftCells.length ? leftCells[0].row : Math.max(1, Math.min(GRID_ROWS - 2, Math.floor(GRID_ROWS / 2)));
  state.exitRow = rightCells.length ? rightCells[0].row : state.entranceRow;
}

function setGeneratedEndpointsFromPath() {
  const rightCells = [...state.path].map(fromKey).filter(cell => cell.col === finishCol());
  const fallbackRow = Math.max(1, Math.min(GRID_ROWS - 2, Math.floor(GRID_ROWS / 2)));
  const finish = rightCells.length ? rightCells[randomInt(0, rightCells.length - 1)] : { row: fallbackRow };

  state.entranceRow = 1;
  state.exitRow = finish.row;
}

function getDesignerWarnings() {
  if (state.mode !== "designer") return [];

  const pathCells = [...state.path].map(fromKey);
  const leftCells = pathCells.filter(cell => cell.col === startCol());
  const rightCells = pathCells.filter(cell => cell.col === finishCol());
  const borderCells = pathCells.filter(cell => isBorderCell(cell.row, cell.col));
  const connected = state.path.size > 0 && getConnectedPathSize() === state.path.size;
  const reachesExit = hasSolvablePath();
  const warnings = [];

  if (!state.path.size) {
    warnings.push("Designer path is empty. Single-click a square one in from the left border to create the start.");
    return warnings;
  }

  if (borderCells.length) {
    warnings.push("The outside border must stay blank so the ball bearing cannot leave the maze.");
  }

  if (!leftCells.length) {
    warnings.push("No start yet. Add at least one path square one in from the left border.");
  }

  if (!rightCells.length) {
    warnings.push("No finish yet. Continue the path until it reaches one square before the right border.");
  }

  if (!connected) {
    warnings.push("Disconnected path. Every placed square must connect back to the main path.");
  }

  if (!reachesExit) {
    warnings.push("Path does not reach the finish. Build a continuous route from the start to the finish.");
  }

  return warnings;
}

function getPointerCell(event) {
  const rect = els.preview.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * WIDTH_MM;
  const y = ((event.clientY - rect.top) / rect.height) * HEIGHT_MM;
  const col = Math.floor(x / CELL_MM);
  const row = Math.floor(y / CELL_MM);
  return { row, col };
}

function render() {
  els.preview.classList.toggle("designer", state.mode === "designer");
  els.modeLabel.textContent = state.mode === "designer" ? "Designer mode" : "Generated maze";
  els.designerModeBtn.textContent = state.mode === "designer" ? "Generated Mode" : "Designer Mode";
  els.mazeSummary.textContent = `${state.path.size} path squares, ${GRID_COLS} x ${GRID_ROWS} grid, start row ${state.entranceRow + 1}, finish row ${state.exitRow + 1}`;
  updateDimensionLabels();
  renderPreviewSvg();
  renderStatus(validateDesign(false), state.message, getDesignerWarnings());
}

function renderPreviewSvg() {
  els.preview.replaceChildren();
  els.preview.setAttribute("viewBox", `0 0 ${formatNumber(WIDTH_MM)} ${formatNumber(HEIGHT_MM)}`);
  els.preview.style.aspectRatio = `${WIDTH_MM} / ${HEIGHT_MM}`;

  const background = document.createElementNS(SVG_NS, "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", formatNumber(WIDTH_MM));
  background.setAttribute("height", formatNumber(HEIGHT_MM));
  background.setAttribute("fill", "#fff");
  els.preview.appendChild(background);

  const grid = document.createElementNS(SVG_NS, "g");
  grid.setAttribute("stroke", "#d9dde3");
  grid.setAttribute("stroke-width", "0.05");
  for (let row = 0; row <= GRID_ROWS; row += 1) {
    const y = row * CELL_MM;
    grid.appendChild(svgLine(0, y, WIDTH_MM, y));
  }
  for (let col = 0; col <= GRID_COLS; col += 1) {
    const x = col * CELL_MM;
    grid.appendChild(svgLine(x, 0, x, HEIGHT_MM));
  }
  els.preview.appendChild(grid);

  const pathGroup = document.createElementNS(SVG_NS, "g");
  pathGroup.setAttribute("fill", state.mode === "designer" ? "#ccece7" : "#e7f4f1");
  for (const cellKey of state.path) {
    const { row, col } = fromKey(cellKey);
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(col * CELL_MM));
    rect.setAttribute("y", String(row * CELL_MM));
    rect.setAttribute("width", String(CELL_MM));
    rect.setAttribute("height", String(CELL_MM));
    pathGroup.appendChild(rect);
  }
  els.preview.appendChild(pathGroup);

  const geometry = getExportGeometry();

  const lineGroup = svgVectorGroup(CUT_STROKE_COLOUR, geometry.strokeWidthMm);
  for (const line of geometry.lines) {
    lineGroup.appendChild(svgLine(line.x1, line.y1, line.x2, line.y2));
  }
  els.preview.appendChild(lineGroup);

  const markerGroup = svgVectorGroup(MARKER_STROKE_COLOUR, geometry.strokeWidthMm);
  for (const marker of geometry.markers) {
    markerGroup.appendChild(svgCircle(marker.cx, marker.cy, marker.r));
  }
  els.preview.appendChild(markerGroup);
}

function svgVectorGroup(stroke, strokeWidth) {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("fill", "none");
  group.setAttribute("stroke", stroke);
  group.setAttribute("stroke-width", formatNumber(strokeWidth));
  group.setAttribute("stroke-linecap", "square");
  group.setAttribute("stroke-linejoin", "miter");
  return group;
}

function svgLine(x1, y1, x2, y2) {
  const line = document.createElementNS(SVG_NS, "line");
  line.setAttribute("x1", formatNumber(x1));
  line.setAttribute("y1", formatNumber(y1));
  line.setAttribute("x2", formatNumber(x2));
  line.setAttribute("y2", formatNumber(y2));
  return line;
}

function svgCircle(cx, cy, r) {
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", formatNumber(cx));
  circle.setAttribute("cy", formatNumber(cy));
  circle.setAttribute("r", formatNumber(r));
  return circle;
}

function getStrokeWidth() {
  const value = Number(els.strokeWidth.value);
  if (!Number.isFinite(value)) return 0.1;
  return Math.max(0.05, Math.min(0.5, value));
}

function applyDimensions() {
  const widthMm = Number(els.baseWidth.value);
  const heightMm = Number(els.baseHeight.value);
  const pathWidthMm = Number(els.pathWidth.value);
  const report = validateDimensionInputs(widthMm, heightMm, pathWidthMm);

  if (!report.ok) {
    state.message = "Dimensions were not applied.";
    renderStatus(validateDesign(false), state.message, report.messages);
    return;
  }

  WIDTH_MM = widthMm;
  HEIGHT_MM = heightMm;
  CELL_MM = pathWidthMm;
  GRID_COLS = report.cols;
  GRID_ROWS = report.rows;
  generateMaze();
  state.message = `Applied ${formatNumber(WIDTH_MM)} mm x ${formatNumber(HEIGHT_MM)} mm base with ${formatNumber(CELL_MM)} mm paths.`;
  render();
}

function validateDimensionInputs(widthMm, heightMm, pathWidthMm) {
  const messages = [];
  const finite = Number.isFinite(widthMm) && Number.isFinite(heightMm) && Number.isFinite(pathWidthMm);

  if (!finite || widthMm <= 0 || heightMm <= 0 || pathWidthMm <= 0) {
    return { ok: false, messages: ["Width, height and path width must be positive numbers."] };
  }

  const colsRaw = widthMm / pathWidthMm;
  const rowsRaw = heightMm / pathWidthMm;
  const cols = Math.round(colsRaw);
  const rows = Math.round(rowsRaw);
  const wholeGrid = Math.abs(colsRaw - cols) < 0.0001 && Math.abs(rowsRaw - rows) < 0.0001;

  if (!wholeGrid) {
    messages.push("Base width and height must divide evenly by the path width so every path stays on-grid.");
  }

  if (cols < 4 || rows < 4) {
    messages.push("The calculated grid must be at least 4 x 4 cells.");
  }

  if (cols > 80 || rows > 80) {
    messages.push("The calculated grid must be 80 x 80 cells or smaller for reliable offline generation.");
  }

  if (cols % 2 !== 0 || rows % 2 !== 0) {
    messages.push("The calculated grid must have an even number of columns and rows for the full-platform generator.");
  }

  return {
    ok: messages.length === 0,
    messages,
    cols,
    rows
  };
}

function updateDimensionLabels() {
  const summary = `${formatNumber(WIDTH_MM)} mm x ${formatNumber(HEIGHT_MM)} mm, ${GRID_COLS} x ${GRID_ROWS} grid, ${formatNumber(CELL_MM)} mm paths`;
  els.specSummary.textContent = `${summary}, offline SVG and PDF export.`;
  els.specBadge.textContent = `${formatNumber(WIDTH_MM)} mm x ${formatNumber(HEIGHT_MM)} mm`;
}

function getPdfMediaBox(geometry) {
  return `[0 0 ${formatPdfSize(geometry.widthMm * PDF_POINTS_PER_MM)} ${formatPdfSize(geometry.heightMm * PDF_POINTS_PER_MM)}]`;
}

function getExportLines() {
  const lines = new Map();
  const add = (x1, y1, x2, y2) => {
    const a = `${formatNumber(x1)},${formatNumber(y1)}`;
    const b = `${formatNumber(x2)},${formatNumber(y2)}`;
    const lineKey = a < b ? `${a}|${b}` : `${b}|${a}`;
    lines.set(lineKey, { x1, y1, x2, y2 });
  };

  for (let row = 0; row < GRID_ROWS; row += 1) {
    add(0, row * CELL_MM, 0, (row + 1) * CELL_MM);
    add(WIDTH_MM, row * CELL_MM, WIDTH_MM, (row + 1) * CELL_MM);
  }

  for (let col = 0; col < GRID_COLS; col += 1) {
    add(col * CELL_MM, 0, (col + 1) * CELL_MM, 0);
    add(col * CELL_MM, HEIGHT_MM, (col + 1) * CELL_MM, HEIGHT_MM);
  }

  for (const cellKey of state.path) {
    const { row, col } = fromKey(cellKey);
    const x = col * CELL_MM;
    const y = row * CELL_MM;
    const sides = [
      { neighbour: { row: row - 1, col }, line: [x, y, x + CELL_MM, y] },
      { neighbour: { row: row + 1, col }, line: [x, y + CELL_MM, x + CELL_MM, y + CELL_MM] },
      { neighbour: { row, col: col - 1 }, line: [x, y, x, y + CELL_MM] },
      { neighbour: { row, col: col + 1 }, line: [x + CELL_MM, y, x + CELL_MM, y + CELL_MM] }
    ];

    for (const side of sides) {
      const n = side.neighbour;
      if (!inGrid(n.row, n.col) || !hasCell(n.row, n.col)) {
        add(...side.line);
      }
    }
  }

  return mergeLines([...lines.values()]);
}

function getExportGeometry() {
  return {
    widthMm: WIDTH_MM,
    heightMm: HEIGHT_MM,
    viewBox: `0 0 ${formatNumber(WIDTH_MM)} ${formatNumber(HEIGHT_MM)}`,
    strokeWidthMm: getStrokeWidth(),
    lines: getExportLines(),
    markers: getEndpointMarkers()
  };
}

function getEndpointMarkers() {
  const markers = [];
  const radius = 0.9;

  if (hasCell(state.entranceRow, startCol())) {
    markers.push({
      type: "start",
      cx: startCol() * CELL_MM + CELL_MM / 2,
      cy: state.entranceRow * CELL_MM + CELL_MM / 2,
      r: radius
    });
  }

  if (hasCell(state.exitRow, finishCol())) {
    markers.push({
      type: "finish",
      cx: finishCol() * CELL_MM + CELL_MM / 2,
      cy: state.exitRow * CELL_MM + CELL_MM / 2,
      r: radius
    });
  }

  return markers;
}

function mergeLines(lines) {
  const horizontal = new Map();
  const vertical = new Map();
  const other = [];

  for (const line of lines) {
    if (line.y1 === line.y2) {
      const y = line.y1;
      const x1 = Math.min(line.x1, line.x2);
      const x2 = Math.max(line.x1, line.x2);
      if (!horizontal.has(y)) horizontal.set(y, []);
      horizontal.get(y).push([x1, x2]);
    } else if (line.x1 === line.x2) {
      const x = line.x1;
      const y1 = Math.min(line.y1, line.y2);
      const y2 = Math.max(line.y1, line.y2);
      if (!vertical.has(x)) vertical.set(x, []);
      vertical.get(x).push([y1, y2]);
    } else {
      other.push(line);
    }
  }

  const merged = [];
  for (const [y, spans] of horizontal) {
    for (const [x1, x2] of mergeSpans(spans)) merged.push({ x1, y1: y, x2, y2: y });
  }
  for (const [x, spans] of vertical) {
    for (const [y1, y2] of mergeSpans(spans)) merged.push({ x1: x, y1, x2: x, y2 });
  }
  return merged.concat(other);
}

function mergeSpans(spans) {
  const sorted = spans.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) {
      last[1] = Math.max(last[1], span[1]);
    } else {
      merged.push(span.slice());
    }
  }
  return merged;
}

function validateDesign(showFull) {
  const checks = [];
  const add = (ok, text, level = "fail") => checks.push({ ok, text, level: ok ? "ok" : level });

  const pathCells = [...state.path].map(fromKey);
  const leftCells = pathCells.filter(cell => cell.col === startCol());
  const rightCells = pathCells.filter(cell => cell.col === finishCol());
  const borderBlank = pathCells.every(cell => !isBorderCell(cell.row, cell.col));
  const connected = getConnectedPathSize();
  const pathConnected = state.path.size > 0 && connected === state.path.size;
  const reachesExit = hasSolvablePath();
  const exportLines = getExportLines();
  const frameReport = analyseFrameGeometry(exportLines);
  const hasEnclosedRegion = hasEnclosedNonPathRegion();
  const exportReport = validateSharedExportGeometry();
  const oneSquareThick = !hasTwoByTwoPathBlock();
  const platformReport = getPathPlatformReport();
  const endpointMarkers = getEndpointMarkers();

  add(WIDTH_MM > 0 && HEIGHT_MM > 0, `Canvas is ${formatNumber(WIDTH_MM)} mm x ${formatNumber(HEIGHT_MM)} mm.`);
  add(GRID_COLS >= 4 && GRID_ROWS >= 4, `Grid is ${GRID_COLS} x ${GRID_ROWS}.`);
  add(CELL_MM > 0, `Each path square is ${formatNumber(CELL_MM)} mm x ${formatNumber(CELL_MM)} mm.`);
  add(borderBlank, "Outer border squares are blank to contain the ball bearing.");
  add(oneSquareThick, "Path cells are one square thick with no 2 x 2 path blocks.");
  add(state.mode === "designer" || platformReport.fillsPlatform, "Auto-generated maze fills the platform.");
  add(leftCells.length > 0, "Start exists one square in from the left border.");
  add(rightCells.length > 0, "Finish exists one square before the right border.");
  add(reachesExit, "Maze is solvable from start to finish.");
  add(pathConnected, "Cut-out path is one connected removable piece.");
  add(reachesExit, "Path reaches the finish.");
  add(frameReport.continuousOuterFrame, "Outer frame is continuous with no start or finish gaps.");
  add(!hasEnclosedRegion, "White material remains one connected piece after cutting.");
  add(endpointMarkers.length === 2, "Start and finish dots are centred in their cells.");
  add(exportReport.sameLineCount && exportReport.mediaBoxExact && exportReport.vectorOnly, "PDF and SVG use the same geometry list.");
  add(exportReport.cutPathRed && exportReport.markersBlack, "Cut paths export as red lines and start/finish dots export as black.");
  add(exportReport.mediaBoxExact, `PDF MediaBox is exactly ${getPdfMediaBox(getExportGeometry())}.`);
  add(exportReport.vectorOnly, "PDF geometry is drawn with vector path commands only.");

  if (showFull) {
    state.message = checks.every(check => check.ok) ? "Validation passed." : "Validation found issues to fix.";
  }
  return checks;
}

function validateSharedExportGeometry() {
  const geometry = getExportGeometry();
  const svg = buildSvgText(geometry);
  const pdf = buildPdfText(geometry);
  const svgLineCount = (svg.match(/<line /g) || []).length;
  const svgMarkerCount = (svg.match(/<circle /g) || []).length;
  const pdfLineCount = (pdf.match(/ m /g) || []).length;
  const pdfCurveCount = (pdf.match(/ c/g) || []).length;
  const contentStream = getPdfContentStream(pdf);
  const cutPathRed = svg.includes(`stroke="${CUT_STROKE_COLOUR}"`)
    && contentStream.includes(PDF_CUT_STROKE_COLOUR);
  const markersBlack = svg.includes(`stroke="${MARKER_STROKE_COLOUR}"`)
    && contentStream.includes(PDF_MARKER_STROKE_COLOUR);
  const vectorOnly = Boolean(contentStream)
    && !/[^\s\d.\-mlcSwqQRGJj]/.test(contentStream)
    && !/\b(re|f|F|B|BT|ET|Do|cm|v|y|h)\b/.test(contentStream);

  return {
    sameLineCount: svgLineCount === geometry.lines.length
      && svgMarkerCount === geometry.markers.length
      && pdfLineCount === geometry.lines.length + geometry.markers.length
      && pdfCurveCount === geometry.markers.length * 4,
    mediaBoxExact: pdf.includes(`/MediaBox ${getPdfMediaBox(geometry)}`),
    cutPathRed,
    markersBlack,
    vectorOnly
  };
}

function getPdfContentStream(pdf) {
  const match = pdf.match(/stream\n([\s\S]*?)endstream/);
  return match ? match[1] : "";
}

function getConnectedPathSize() {
  if (!state.path.size) return 0;
  const [start] = state.path;
  const queue = [fromKey(start)];
  const seen = new Set([start]);

  while (queue.length) {
    const cell = queue.shift();
    for (const next of neighbours(cell.row, cell.col)) {
      const nextKey = key(next.row, next.col);
      if (state.path.has(nextKey) && !seen.has(nextKey)) {
        seen.add(nextKey);
        queue.push(next);
      }
    }
  }
  return seen.size;
}

function hasSolvablePath() {
  const starts = [...state.path].map(fromKey).filter(cell => cell.col === startCol());
  if (!starts.length) return false;

  const queue = starts.slice();
  const seen = new Set(starts.map(cell => key(cell.row, cell.col)));

  while (queue.length) {
    const cell = queue.shift();
    if (cell.row === state.exitRow && cell.col === finishCol()) return true;
    for (const next of neighbours(cell.row, cell.col)) {
      const nextKey = key(next.row, next.col);
      if (state.path.has(nextKey) && !seen.has(nextKey)) {
        seen.add(nextKey);
        queue.push(next);
      }
    }
  }
  return false;
}

function hasTwoByTwoPathBlock() {
  return hasTwoByTwoPathBlockIn(state.path);
}

function hasTwoByTwoPathBlockIn(path) {
  for (let row = 0; row < GRID_ROWS - 1; row += 1) {
    for (let col = 0; col < GRID_COLS - 1; col += 1) {
      if (
        path.has(key(row, col))
        && path.has(key(row + 1, col))
        && path.has(key(row, col + 1))
        && path.has(key(row + 1, col + 1))
      ) {
        return true;
      }
    }
  }
  return false;
}

function getPathPlatformReport() {
  return getPathPlatformReportFor(state.path);
}

function getPathPlatformReportFor(path) {
  if (!path.size) {
    return { fillsPlatform: false, rows: 0, cols: 0 };
  }

  const cells = [...path].map(fromKey);
  const rows = new Set(cells.map(cell => cell.row));
  const cols = new Set(cells.map(cell => cell.col));
  const minRow = Math.min(...cells.map(cell => cell.row));
  const maxRow = Math.max(...cells.map(cell => cell.row));
  const minCol = Math.min(...cells.map(cell => cell.col));
  const maxCol = Math.max(...cells.map(cell => cell.col));
  const hasLeftStart = cells.some(cell => cell.col === startCol());
  const hasRightFinish = cells.some(cell => cell.col === finishCol());

  return {
    rows: rows.size,
    cols: cols.size,
    hasLeftStart,
    hasRightFinish,
    fillsPlatform: minRow === 1 && maxRow === GRID_ROWS - 2 && minCol === startCol() && maxCol === finishCol() && rows.size >= GRID_ROWS - 2 && cols.size >= GRID_COLS - 2
  };
}

function countCellsInRow(path, row) {
  return [...path].map(fromKey).filter(cell => cell.row === row).length;
}

function countCellsInCol(path, col) {
  return [...path].map(fromKey).filter(cell => cell.col === col).length;
}

function hasEnclosedNonPathRegion() {
  return hasEnclosedNonPathRegionFor(state.path);
}

function hasEnclosedNonPathRegionFor(path) {
  const visited = new Set();

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const startKey = key(row, col);
      if (path.has(startKey) || visited.has(startKey)) continue;

      let touchesEdge = false;
      const queue = [{ row, col }];
      visited.add(startKey);

      while (queue.length) {
        const cell = queue.shift();
        if (cell.row === 0 || cell.row === GRID_ROWS - 1 || cell.col === 0 || cell.col === GRID_COLS - 1) {
          touchesEdge = true;
        }

        for (const next of neighbours(cell.row, cell.col)) {
          const nextKey = key(next.row, next.col);
          if (!path.has(nextKey) && !visited.has(nextKey)) {
            visited.add(nextKey);
            queue.push(next);
          }
        }
      }

      if (!touchesEdge) return true;
    }
  }

  return false;
}

function analyseWallGeometry(lines) {
  const graph = new Map();
  const addNode = node => {
    if (!graph.has(node)) graph.set(node, new Set());
  };
  const addEdge = (a, b) => {
    addNode(a);
    addNode(b);
    graph.get(a).add(b);
    graph.get(b).add(a);
  };

  for (const line of splitLinesToGrid(lines)) {
    const a = `${line.x1},${line.y1}`;
    const b = `${line.x2},${line.y2}`;
    addEdge(a, b);
  }

  const visited = new Set();
  let looseComponents = 0;
  let componentCount = 0;

  for (const node of graph.keys()) {
    if (visited.has(node)) continue;
    componentCount += 1;
    let touchesFrame = false;
    const queue = [node];
    visited.add(node);

    while (queue.length) {
      const current = queue.shift();
      const [x, y] = current.split(",").map(Number);
      if (x === 0 || x === WIDTH_MM || y === 0 || y === HEIGHT_MM) touchesFrame = true;
      for (const next of graph.get(current)) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    if (!touchesFrame) looseComponents += 1;
  }

  return {
    componentCount,
    looseComponents,
    allComponentsTouchFrame: componentCount > 0 && looseComponents === 0
  };
}

function analyseFrameGeometry(lines) {
  const hasLine = (x1, y1, x2, y2) => lines.some(line => (
    (line.x1 === x1 && line.y1 === y1 && line.x2 === x2 && line.y2 === y2)
    || (line.x1 === x2 && line.y1 === y2 && line.x2 === x1 && line.y2 === y1)
  ));

  return {
    continuousOuterFrame: hasLine(0, 0, WIDTH_MM, 0)
      && hasLine(WIDTH_MM, 0, WIDTH_MM, HEIGHT_MM)
      && hasLine(0, HEIGHT_MM, WIDTH_MM, HEIGHT_MM)
      && hasLine(0, 0, 0, HEIGHT_MM)
  };
}

function splitLinesToGrid(lines) {
  const split = [];
  for (const line of lines) {
    if (line.x1 === line.x2) {
      const x = line.x1;
      const yStart = Math.min(line.y1, line.y2);
      const yEnd = Math.max(line.y1, line.y2);
      for (let y = yStart; y < yEnd; y += CELL_MM) {
        split.push({ x1: x, y1: y, x2: x, y2: y + CELL_MM });
      }
    } else if (line.y1 === line.y2) {
      const y = line.y1;
      const xStart = Math.min(line.x1, line.x2);
      const xEnd = Math.max(line.x1, line.x2);
      for (let x = xStart; x < xEnd; x += CELL_MM) {
        split.push({ x1: x, y1: y, x2: x + CELL_MM, y2: y });
      }
    }
  }
  return split;
}

function renderStatus(checks, leadText, warnings = getDesignerWarnings()) {
  const list = document.createElement("ul");
  const lead = document.createElement("li");
  lead.className = warnings.length ? "warn" : "ok";
  lead.textContent = leadText;
  list.appendChild(lead);

  for (const warning of warnings) {
    const item = document.createElement("li");
    item.className = "fail";
    item.textContent = `Warning: ${warning}`;
    list.appendChild(item);
  }

  for (const check of checks) {
    const item = document.createElement("li");
    item.className = check.level;
    item.textContent = `${check.ok ? "OK" : "Check"}: ${check.text}`;
    list.appendChild(item);
  }

  els.status.replaceChildren(list);
}

function buildSvgText(geometry = getExportGeometry()) {
  const strokeWidth = formatNumber(geometry.strokeWidthMm);
  const lines = geometry.lines
    .map(line => `    <line x1="${formatNumber(line.x1)}" y1="${formatNumber(line.y1)}" x2="${formatNumber(line.x2)}" y2="${formatNumber(line.y2)}" />`)
    .join("\n");
  const markers = geometry.markers
    .map(marker => `    <circle cx="${formatNumber(marker.cx)}" cy="${formatNumber(marker.cy)}" r="${formatNumber(marker.r)}" />`)
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(geometry.widthMm)}mm" height="${formatNumber(geometry.heightMm)}mm" viewBox="${geometry.viewBox}">`,
    `  <g fill="none" stroke="${CUT_STROKE_COLOUR}" stroke-width="${strokeWidth}" stroke-linecap="square" stroke-linejoin="miter">`,
    lines,
    "  </g>",
    `  <g fill="none" stroke="${MARKER_STROKE_COLOUR}" stroke-width="${strokeWidth}" stroke-linecap="square" stroke-linejoin="miter">`,
    markers,
    "  </g>",
    "</svg>",
    ""
  ].join("\n");
}

function buildPdfText(geometry = getExportGeometry()) {
  const strokePoints = geometry.strokeWidthMm * PDF_POINTS_PER_MM;
  const commands = [
    "q",
    `${formatPdf(strokePoints)} w`,
    "0 J",
    "0 j",
    PDF_CUT_STROKE_COLOUR
  ];

  for (const line of geometry.lines) {
    const x1 = line.x1 * PDF_POINTS_PER_MM;
    const y1 = (geometry.heightMm - line.y1) * PDF_POINTS_PER_MM;
    const x2 = line.x2 * PDF_POINTS_PER_MM;
    const y2 = (geometry.heightMm - line.y2) * PDF_POINTS_PER_MM;
    commands.push(`${formatPdf(x1)} ${formatPdf(y1)} m ${formatPdf(x2)} ${formatPdf(y2)} l S`);
  }

  commands.push(PDF_MARKER_STROKE_COLOUR);
  for (const marker of geometry.markers) {
    commands.push(pdfCircleCommand(marker, geometry.heightMm));
  }
  commands.push("Q");

  const stream = `${commands.join("\n")}\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox ${getPdfMediaBox(geometry)} /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

function pdfCircleCommand(marker, heightMm) {
  const kappa = 0.5522847498;
  const cx = marker.cx * PDF_POINTS_PER_MM;
  const cy = (heightMm - marker.cy) * PDF_POINTS_PER_MM;
  const r = marker.r * PDF_POINTS_PER_MM;
  const c = r * kappa;

  return [
    `${formatPdf(cx + r)} ${formatPdf(cy)} m`,
    `${formatPdf(cx + r)} ${formatPdf(cy + c)} ${formatPdf(cx + c)} ${formatPdf(cy + r)} ${formatPdf(cx)} ${formatPdf(cy + r)} c`,
    `${formatPdf(cx - c)} ${formatPdf(cy + r)} ${formatPdf(cx - r)} ${formatPdf(cy + c)} ${formatPdf(cx - r)} ${formatPdf(cy)} c`,
    `${formatPdf(cx - r)} ${formatPdf(cy - c)} ${formatPdf(cx - c)} ${formatPdf(cy - r)} ${formatPdf(cx)} ${formatPdf(cy - r)} c`,
    `${formatPdf(cx + c)} ${formatPdf(cy - r)} ${formatPdf(cx + r)} ${formatPdf(cy - c)} ${formatPdf(cx + r)} ${formatPdf(cy)} c S`
  ].join(" ");
}

function downloadSvg() {
  const geometry = getExportGeometry();
  downloadText("laser-cut-maze.svg", buildSvgText(geometry), "image/svg+xml");
}

function downloadPdf(filename = "laser-cut-maze.pdf") {
  const geometry = getExportGeometry();
  downloadPdfFromGeometry(filename, geometry);
}

function downloadPdfFromGeometry(filename, geometry) {
  downloadBytes(filename, asciiBytes(buildPdfText(geometry)), "application/pdf");
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  downloadBlob(filename, blob);
}

function downloadBytes(filename, bytes, type) {
  const blob = new Blob([bytes], { type });
  downloadBlob(filename, blob);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function asciiBytes(text) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function formatNumber(value) {
  return Number(value.toFixed(4)).toString();
}

function formatPdf(value) {
  return value.toFixed(4);
}

function formatPdfSize(value) {
  return value.toFixed(10);
}

els.generateBtn.addEventListener("click", generateMaze);
els.clearBtn.addEventListener("click", clearDesign);
els.undoBtn.addEventListener("click", undo);
els.designerModeBtn.addEventListener("click", () => setDesignerMode(state.mode !== "designer"));
els.applyDimensionsBtn.addEventListener("click", applyDimensions);
els.strokeWidth.addEventListener("input", render);
els.branchMode.addEventListener("change", () => {
  state.message = els.branchMode.checked
    ? "Branch Mode is on. New squares may touch any existing path square."
    : "Branch Mode is off. New squares must touch the previous placed square.";
  render();
});
els.validateBtn.addEventListener("click", () => {
  const checks = validateDesign(true);
  renderStatus(checks, state.message, getDesignerWarnings());
});
els.downloadSvgBtn.addEventListener("click", downloadSvg);
els.downloadPdfBtn.addEventListener("click", () => downloadPdf());

els.preview.addEventListener("click", event => {
  if (state.mode !== "designer") return;
  if (event.detail !== 1) return;
  window.clearTimeout(clickTimer);
  const cell = getPointerCell(event);
  clickTimer = window.setTimeout(() => placeCell(cell.row, cell.col), 180);
});

els.preview.addEventListener("dblclick", event => {
  if (state.mode !== "designer") return;
  event.preventDefault();
  window.clearTimeout(clickTimer);
  const cell = getPointerCell(event);
  removeCell(cell.row, cell.col);
});

generateMaze();
