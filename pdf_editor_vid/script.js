const pdfInput = document.getElementById("pdfInput");
const newBlankBtn = document.getElementById("newBlankBtn");
const eraseModeBtn = document.getElementById("eraseModeBtn");
const clearPageBtn = document.getElementById("clearPageBtn");
const gridBtn = document.getElementById("gridBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const fitWidthBtn = document.getElementById("fitWidthBtn");
const highlighterModeBtn = document.getElementById("highlighterModeBtn");
const highlighterColorSelect = document.getElementById("highlighterColorSelect");
const audioSourceSelect = document.getElementById("audioSourceSelect");
const recordingScopeSelect = document.getElementById("recordingScopeSelect");
const refreshAudioBtn = document.getElementById("refreshAudioBtn");
const recordBtn = document.getElementById("recordBtn");
const stopRecordBtn = document.getElementById("stopRecordBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const downloadBtn = document.getElementById("downloadBtn");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const colorPicker = document.getElementById("colorPicker");
const brushSize = document.getElementById("brushSize");
const brushSizeValue = document.getElementById("brushSizeValue");
const pageIndicator = document.getElementById("pageIndicator");
const statusText = document.getElementById("statusText");
const emptyState = document.getElementById("emptyState");
const viewerShell = document.getElementById("viewerShell");
const workspace = document.getElementById("workspace");
const pdfCanvas = document.getElementById("pdfCanvas");
const gridCanvas = document.getElementById("gridCanvas");
const drawCanvas = document.getElementById("drawCanvas");
const penCursor = document.getElementById("penCursor");
const swatchButtons = Array.from(document.querySelectorAll(".swatch-button"));

const pdfContext = pdfCanvas.getContext("2d");
const gridContext = gridCanvas.getContext("2d");
const drawContext = drawCanvas.getContext("2d");

const ERASER_SIZE_MULTIPLIER = 3;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 4;
const PEN_TOUCH_SUPPRESSION_MS = 140;
const CM_TO_POINTS = 72 / 2.54;
const GRID_LINE_COLOR = "rgba(133, 144, 159, 0.32)";
const DEFAULT_BLANK_PAGE_SIZE = [595.28, 841.89];
const MIN_BLANK_PAGE_COUNT = 1;
const MAX_BLANK_PAGE_COUNT = 50;
const RECORDING_FPS = 30;
const HIGHLIGHTER_COLORS = {
  yellow: "rgba(255, 238, 73, 0.38)",
  orange: "rgba(255, 169, 64, 0.35)",
  green: "rgba(148, 255, 91, 0.34)"
};
const HIGHLIGHTER_SIZE_MULTIPLIER = 3;

const userAgent = navigator.userAgent || "";
const isIOSDevice =
  /iPad|iPhone|iPod/i.test(userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isWebKitEngine = /WebKit/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent);
const USE_STRICT_TOUCH_SUPPRESSION = isIOSDevice && isWebKitEngine;

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "vendor/pdf.worker.min.js";

const state = {
  pdfBytes: null,
  pdfDoc: null,
  currentPage: 1,
  currentViewport: null,
  sourceFileName: "annotated",
  pageAnnotations: new Map(),
  mode: "draw",
  isGridVisible: false,
  brushColor: colorPicker.value,
  highlighterColor: "yellow",
  brushSize: Number(brushSize.value),
  zoom: 1,
  hasUnsavedChanges: false,
  drawing: false,
  activeStroke: null,
  renderToken: 0,
  renderScheduled: false,
  activePointers: new Map(),
  pinch: null,
  pan: null,
  isPenActive: false,
  touchSuppressionUntil: 0,
  useStrictTouchSuppression: USE_STRICT_TOUCH_SUPPRESSION,
  recording: {
    isRecording: false,
    mediaRecorder: null,
    mediaStream: null,
    audioStream: null,
    compositeCanvas: null,
    compositeContext: null,
    frameRequestId: 0,
    chunks: []
  }
};

if (state.useStrictTouchSuppression) {
  document.body.classList.add("ios-webkit-strict");
}

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function setPenInteractionLock(isActive) {
  if (!state.useStrictTouchSuppression) {
    return;
  }

  if (isActive) {
    state.isPenActive = true;
    state.touchSuppressionUntil = nowMs() + PEN_TOUCH_SUPPRESSION_MS;
    document.body.classList.add("pen-active-session");
    return;
  }

  if (!state.isPenActive) {
    document.body.classList.remove("pen-active-session");
    return;
  }

  state.isPenActive = false;
  state.touchSuppressionUntil = nowMs() + PEN_TOUCH_SUPPRESSION_MS;
  document.body.classList.remove("pen-active-session");
}

function shouldSuppressTouchPointer(event) {
  if (!state.useStrictTouchSuppression || event.pointerType !== "touch") {
    return false;
  }

  return state.isPenActive || nowMs() < state.touchSuppressionUntil;
}

function suppressTouchPointerEvent(event) {
  if (!shouldSuppressTouchPointer(event)) {
    return;
  }

  if (event.cancelable) {
    event.preventDefault();
  }
  event.stopPropagation();
  removePointerRecord(event);
}

function setStatus(message) {
  statusText.textContent = message;
}

function markUnsavedChanges() {
  state.hasUnsavedChanges = true;
}

function clearUnsavedChanges() {
  state.hasUnsavedChanges = false;
}

function stopStreamTracks(stream) {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => {
    track.stop();
  });
}

function canRecordCanvas() {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

function canRecordMp4() {
  return canRecordCanvas() && Boolean(pickRecordingMimeType());
}

function canChooseAudioInput() {
  return Boolean(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices);
}

function getRecordingScope() {
  return recordingScopeSelect && recordingScopeSelect.value === "visible" ? "visible" : "full";
}

function confirmDiscardUnsavedChanges() {
  if (!state.hasUnsavedChanges) {
    return true;
  }

  return window.confirm("You have unsaved changes. Continue without exporting?");
}

function setViewerVisible(isVisible) {
  emptyState.classList.toggle("hidden", isVisible);
  viewerShell.classList.toggle("hidden", !isVisible);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function syncActiveSwatch() {
  swatchButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      state.mode === "draw" && button.dataset.color === state.brushColor.toLowerCase()
    );
  });
}

function getActiveHighlighterColor() {
  return HIGHLIGHTER_COLORS[state.highlighterColor] || HIGHLIGHTER_COLORS.yellow;
}

function updateHighlighterColorVisibility() {
  if (!highlighterColorSelect) {
    return;
  }

  highlighterColorSelect.classList.toggle("hidden", state.mode !== "highlighter");
  highlighterColorSelect.value = state.highlighterColor;
}

function resetLoadedPdfState() {
  if (state.recording.isRecording) {
    stopRecording();
  }

  state.pdfDoc = null;
  state.pdfBytes = null;
  state.currentViewport = null;
  state.pageAnnotations.clear();
  state.activeStroke = null;
  state.drawing = false;
  state.zoom = 1;
  state.hasUnsavedChanges = false;
  state.activePointers.clear();
  state.pinch = null;
  state.pan = null;
  setPenInteractionLock(false);
  clearGridLayer();
  clearDrawLayer();
  updatePageControls();
  setViewerVisible(false);
  updateCanvasCursor();
  hidePenCursor();
}

function createPageState() {
  return {
    strokes: [],
    redoStack: []
  };
}

function setMode(mode) {
  state.mode = mode;
  eraseModeBtn.classList.toggle("active", mode === "erase");
  highlighterModeBtn.classList.toggle("active", mode === "highlighter");
  syncActiveSwatch();
  updateHighlighterColorVisibility();
  updateCanvasCursor();
}

function setGridVisible(visible) {
  state.isGridVisible = Boolean(visible);
  gridBtn.classList.toggle("active", state.isGridVisible);
  redrawGrid();
}

function updateCanvasCursor() {
  if (state.pan) {
    drawCanvas.style.cursor = "grabbing";
    hidePenCursor();
    return;
  }

  drawCanvas.style.cursor = "none";
}

function showPenCursorAtEvent(event) {
  if (event.pointerType !== "pen") {
    return;
  }

  const rect = drawCanvas.getBoundingClientRect();
  penCursor.style.display = "block";
  penCursor.style.left = `${event.clientX - rect.left}px`;
  penCursor.style.top = `${event.clientY - rect.top}px`;
}

function hidePenCursor() {
  penCursor.style.display = "none";
}

function getPageState(pageNumber) {
  if (!state.pageAnnotations.has(pageNumber)) {
    state.pageAnnotations.set(pageNumber, createPageState());
  }

  return state.pageAnnotations.get(pageNumber);
}

function getPageData(pageNumber) {
  return getPageState(pageNumber).strokes;
}

function updateBrushLabel() {
  brushSizeValue.textContent = `${state.brushSize} px`;
}

function updateFullscreenButton() {
  const isFullscreen = Boolean(document.fullscreenElement);
  fullscreenBtn.textContent = isFullscreen ? "\u2921" : "\u2922";
  fullscreenBtn.setAttribute("aria-label", isFullscreen ? "Exit full screen" : "Enter full screen");
  fullscreenBtn.title = isFullscreen ? "Exit full screen" : "Enter full screen";
}

function updateRecordingControls() {
  const hasPdf = Boolean(state.pdfDoc);
  const isRecording = state.recording.isRecording;
  const audioSelectionAvailable = canChooseAudioInput();
  const mp4RecordingAvailable = canRecordMp4();

  recordBtn.disabled = !hasPdf || isRecording || !mp4RecordingAvailable;
  stopRecordBtn.disabled = !isRecording;
  recordingScopeSelect.disabled = isRecording || !hasPdf;
  audioSourceSelect.disabled = isRecording || !audioSelectionAvailable;
  refreshAudioBtn.disabled = isRecording || !audioSelectionAvailable;
}

function updatePageControls() {
  const totalPages = state.pdfDoc ? state.pdfDoc.numPages : 0;
  const pageState = state.pdfDoc ? getPageState(state.currentPage) : createPageState();
  pageIndicator.textContent = `${totalPages ? state.currentPage : 0} / ${totalPages}`;
  prevPageBtn.disabled = !state.pdfDoc || state.currentPage <= 1;
  nextPageBtn.disabled = !state.pdfDoc || state.currentPage >= totalPages;
  undoBtn.disabled = !state.pdfDoc || pageState.strokes.length === 0;
  redoBtn.disabled = !state.pdfDoc || pageState.redoStack.length === 0;
  clearPageBtn.disabled = !state.pdfDoc || pageState.strokes.length === 0;
  gridBtn.disabled = !state.pdfDoc;
  fitWidthBtn.disabled = !state.pdfDoc;
  downloadBtn.disabled = !state.pdfDoc;
  updateRecordingControls();
}

function resizeDrawLayer(width, height) {
  drawCanvas.width = width;
  drawCanvas.height = height;
}

function resizePdfLayer(width, height) {
  pdfCanvas.width = width;
  pdfCanvas.height = height;
}

function resizeGridLayer(width, height) {
  gridCanvas.width = width;
  gridCanvas.height = height;
}

function clearGridLayer() {
  gridContext.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
}

function clearDrawLayer() {
  drawContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}

function drawGridLines(context, width, height, spacing, color, lineWidth) {
  if (!spacing || spacing <= 0) {
    return;
  }

  context.save();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.beginPath();

  for (let x = 0; x <= width; x += spacing) {
    const xPosition = x + 0.5;
    context.moveTo(xPosition, 0);
    context.lineTo(xPosition, height);
  }

  for (let y = 0; y <= height; y += spacing) {
    const yPosition = y + 0.5;
    context.moveTo(0, yPosition);
    context.lineTo(width, yPosition);
  }

  context.stroke();
  context.restore();
}

function getGridSpacingPxFromScale(scale) {
  if (!scale || scale <= 0) {
    return 0;
  }

  return CM_TO_POINTS * scale;
}

function redrawGrid() {
  clearGridLayer();

  if (!state.isGridVisible || !state.currentViewport) {
    return;
  }

  const spacing = getGridSpacingPxFromScale(state.currentViewport.scale);
  drawGridLines(gridContext, gridCanvas.width, gridCanvas.height, spacing, GRID_LINE_COLOR, 1);
}

function normalizedBrushSize(width, height, brushPx) {
  return brushPx / Math.min(width, height);
}

function denormalizedBrushSize(width, height, brushRatio) {
  return Math.max(1, brushRatio * Math.min(width, height));
}

function getToolSizePx(mode, sizePx) {
  if (mode === "erase") {
    return sizePx * ERASER_SIZE_MULTIPLIER;
  }

  if (mode === "highlighter") {
    return sizePx * HIGHLIGHTER_SIZE_MULTIPLIER;
  }

  return sizePx;
}

function cancelActiveStroke() {
  state.activeStroke = null;
  state.drawing = false;
  setPenInteractionLock(false);
}

function shouldStartPan(event) {
  if (event.pointerType === "touch") {
    return getTouchPointers().length === 1;
  }

  return (event.pointerType === "pen" || event.pointerType === "mouse") && event.ctrlKey;
}

function beginPan(event) {
  cancelActiveStroke();
  redrawAnnotations();
  hidePenCursor();
  state.pan = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: viewerShell.scrollLeft,
    scrollTop: viewerShell.scrollTop
  };
  updateCanvasCursor();
}

function updatePan(event) {
  if (!state.pan || state.pan.pointerId !== event.pointerId) {
    return;
  }

  const deltaX = event.clientX - state.pan.startX;
  const deltaY = event.clientY - state.pan.startY;

  viewerShell.scrollLeft = state.pan.scrollLeft - deltaX;
  viewerShell.scrollTop = state.pan.scrollTop - deltaY;
}

function endPan(event) {
  if (!state.pan || (event && state.pan.pointerId !== event.pointerId)) {
    return false;
  }

  if (event && drawCanvas.hasPointerCapture(event.pointerId)) {
    drawCanvas.releasePointerCapture(event.pointerId);
  }

  state.pan = null;
  updateCanvasCursor();
  if (event && event.pointerType === "pen") {
    showPenCursorAtEvent(event);
  }
  return true;
}

function startStroke(x, y) {
  const width = drawCanvas.width;
  const height = drawCanvas.height;
  const toolSizePx = getToolSizePx(state.mode, state.brushSize);
  const strokeColor = state.mode === "highlighter" ? getActiveHighlighterColor() : state.brushColor;

  state.activeStroke = {
    mode: state.mode,
    color: strokeColor,
    sizeRatio: normalizedBrushSize(width, height, toolSizePx),
    points: [
      {
        x: x / width,
        y: y / height
      }
    ]
  };

  state.drawing = true;
}

function appendPointToStroke(x, y) {
  if (!state.activeStroke) {
    return;
  }

  state.activeStroke.points.push({
    x: x / drawCanvas.width,
    y: y / drawCanvas.height
  });
}

function finishStroke() {
  if (!state.activeStroke) {
    return;
  }

  const stroke = state.activeStroke;
  if (stroke.points.length === 1) {
    stroke.points.push({ ...stroke.points[0] });
  }

  const pageState = getPageState(state.currentPage);
  pageState.strokes.push(stroke);
  pageState.redoStack = [];
  state.activeStroke = null;
  state.drawing = false;
  markUnsavedChanges();
  updatePageControls();
}

function configureStrokeStyle(context, stroke, width, height) {
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = denormalizedBrushSize(width, height, stroke.sizeRatio);
  context.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over";
  context.strokeStyle = stroke.color;
}

function drawStroke(context, stroke, width, height) {
  if (!stroke.points.length) {
    return;
  }

  configureStrokeStyle(context, stroke, width, height);
  context.beginPath();

  stroke.points.forEach((point, index) => {
    const actualX = point.x * width;
    const actualY = point.y * height;

    if (index === 0) {
      context.moveTo(actualX, actualY);
      return;
    }

    context.lineTo(actualX, actualY);
  });

  context.stroke();
}

function redrawAnnotations() {
  clearDrawLayer();

  const strokes = getPageData(state.currentPage);
  strokes.forEach((stroke) => drawStroke(drawContext, stroke, drawCanvas.width, drawCanvas.height));

  if (state.activeStroke) {
    drawStroke(drawContext, state.activeStroke, drawCanvas.width, drawCanvas.height);
  }

  drawContext.globalCompositeOperation = "source-over";
}

function getPointerPosition(event) {
  const rect = drawCanvas.getBoundingClientRect();
  const scaleX = drawCanvas.width / rect.width;
  const scaleY = drawCanvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function isWithinCanvasBounds(x, y) {
  return x >= 0 && y >= 0 && x <= drawCanvas.width && y <= drawCanvas.height;
}

function getViewerMaxPageWidth() {
  const parentWidth = viewerShell.parentElement ? viewerShell.parentElement.clientWidth : 0;
  const workspaceWidth = viewerShell.clientWidth || parentWidth || window.innerWidth || 0;
  const framePadding = 36;

  return Math.max(320, workspaceWidth - framePadding);
}

function getPageScalesForViewer(page) {
  const unscaledViewport = page.getViewport({ scale: 1 });
  const exactFitScale = getViewerMaxPageWidth() / unscaledViewport.width;

  return {
    fitScale: Math.min(2.2, exactFitScale),
    exactFitScale
  };
}

async function renderCurrentPage() {
  if (!state.pdfDoc) {
    return;
  }

  const renderId = ++state.renderToken;
  const page = await state.pdfDoc.getPage(state.currentPage);

  const { fitScale } = getPageScalesForViewer(page);
  const scale = fitScale * state.zoom;
  const viewport = page.getViewport({ scale });

  if (renderId !== state.renderToken) {
    return;
  }

  state.currentViewport = viewport;
  resizePdfLayer(viewport.width, viewport.height);
  resizeGridLayer(viewport.width, viewport.height);
  resizeDrawLayer(viewport.width, viewport.height);

  await page.render({
    canvasContext: pdfContext,
    viewport
  }).promise;

  if (renderId !== state.renderToken) {
    return;
  }

  setViewerVisible(true);
  redrawGrid();
  redrawAnnotations();
  updatePageControls();
  setStatus(`Viewing page ${state.currentPage} of ${state.pdfDoc.numPages} at ${Math.round(state.zoom * 100)}%.`);
}

function scheduleRenderCurrentPage() {
  if (!state.pdfDoc || state.renderScheduled) {
    return;
  }

  state.renderScheduled = true;
  requestAnimationFrame(() => {
    state.renderScheduled = false;
    renderCurrentPage().catch((error) => {
      console.error(error);
      setStatus("Updating the zoomed page view failed.");
    });
  });
}

function setZoom(nextZoom) {
  if (!state.pdfDoc) {
    return;
  }

  state.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  scheduleRenderCurrentPage();
}

function zoomIn() {
  setZoom(state.zoom * 1.2);
}

function zoomOut() {
  setZoom(state.zoom / 1.2);
}

async function fitPageToWidth() {
  if (!state.pdfDoc) {
    return;
  }

  try {
    const page = await state.pdfDoc.getPage(state.currentPage);
    const { fitScale, exactFitScale } = getPageScalesForViewer(page);
    const targetZoom = exactFitScale / fitScale;

    if (!Number.isFinite(targetZoom)) {
      return;
    }

    setZoom(targetZoom);
  } catch (error) {
    console.error(error);
    setStatus("Could not fit this page to full width.");
  }
}

async function loadPdf(file) {
  const bytes = await file.arrayBuffer();
  await loadPdfBytes(bytes, file.name);
}

function getBlankPageCountFromPrompt() {
  const response = window.prompt(
    `How many blank pages do you want? (${MIN_BLANK_PAGE_COUNT}-${MAX_BLANK_PAGE_COUNT})`,
    "1"
  );

  if (response === null) {
    return null;
  }

  const normalized = response.trim();
  if (!/^\d+$/.test(normalized)) {
    return Number.NaN;
  }

  return Number.parseInt(normalized, 10);
}

async function buildBlankPdfBytes(pageCount) {
  const blankPdf = await PDFLib.PDFDocument.create();

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    blankPdf.addPage(DEFAULT_BLANK_PAGE_SIZE);
  }

  return await blankPdf.save();
}

async function createBlankPdf() {
  if (!confirmDiscardUnsavedChanges()) {
    return;
  }

  const pageCount = getBlankPageCountFromPrompt();
  if (pageCount === null) {
    return;
  }

  if (!Number.isInteger(pageCount) || pageCount < MIN_BLANK_PAGE_COUNT || pageCount > MAX_BLANK_PAGE_COUNT) {
    setStatus(`Enter a whole number from ${MIN_BLANK_PAGE_COUNT} to ${MAX_BLANK_PAGE_COUNT}.`);
    return;
  }

  setStatus(`Creating blank PDF with ${pageCount} page(s)...`);

  try {
    const blankPdfBytes = await buildBlankPdfBytes(pageCount);
    const fileName = `blank-${pageCount}-page${pageCount === 1 ? "" : "s"}.pdf`;
    await loadPdfBytes(blankPdfBytes, fileName);
    setStatus(`Created blank PDF with ${pageCount} page(s).`);
  } catch (error) {
    console.error(error);
    setStatus("Could not create a blank PDF.");
  }
}

async function loadPdfBytes(bytes, fileName) {
  const sourceBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  state.pdfBytes = sourceBytes.slice();
  state.pageAnnotations.clear();
  state.currentPage = 1;
  state.activeStroke = null;
  state.drawing = false;
  state.zoom = 1;
  state.hasUnsavedChanges = false;
  state.activePointers.clear();
  state.pinch = null;
  state.pan = null;
  setPenInteractionLock(false);
  state.sourceFileName = fileName.replace(/\.pdf$/i, "");

  setStatus("Loading PDF...");

  state.pdfDoc = await pdfjsLib.getDocument({ data: sourceBytes.slice() }).promise;

  updatePageControls();
  await renderCurrentPage();
  setStatus(`Loaded "${fileName}" with ${state.pdfDoc.numPages} page(s).`);
}

async function goToPage(pageNumber) {
  if (!state.pdfDoc) {
    return;
  }

  const boundedPage = Math.min(Math.max(1, pageNumber), state.pdfDoc.numPages);
  if (boundedPage === state.currentPage) {
    return;
  }

  state.currentPage = boundedPage;
  state.activeStroke = null;
  state.drawing = false;
  await renderCurrentPage();
}

function clearCurrentPage() {
  if (!state.pdfDoc) {
    return;
  }

  state.pageAnnotations.set(state.currentPage, createPageState());
  redrawAnnotations();
  markUnsavedChanges();
  updatePageControls();
  setStatus(`Cleared annotations on page ${state.currentPage}.`);
}

function undoStroke() {
  if (!state.pdfDoc) {
    return;
  }

  const pageState = getPageState(state.currentPage);
  const stroke = pageState.strokes.pop();
  if (!stroke) {
    return;
  }

  pageState.redoStack.push(stroke);
  redrawAnnotations();
  markUnsavedChanges();
  updatePageControls();
  setStatus(`Undid the last mark on page ${state.currentPage}.`);
}

function redoStroke() {
  if (!state.pdfDoc) {
    return;
  }

  const pageState = getPageState(state.currentPage);
  const stroke = pageState.redoStack.pop();
  if (!stroke) {
    return;
  }

  pageState.strokes.push(stroke);
  redrawAnnotations();
  markUnsavedChanges();
  updatePageControls();
  setStatus(`Restored the last undone mark on page ${state.currentPage}.`);
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await document.documentElement.requestFullscreen();
  } catch (error) {
    console.error(error);
    setStatus("Fullscreen mode is not available in this browser.");
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildTimestampToken() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0")
  ];

  return parts.join("");
}

function buildTimestampedFileName(baseName) {
  return `${baseName}-${buildTimestampToken()}.pdf`;
}

function buildTimestampedRecordingFileName(baseName, extension = "mp4") {
  return `${baseName}-recording-${buildTimestampToken()}.${extension}`;
}

function ensureCompositeRecordingCanvas(targetWidth = pdfCanvas.width, targetHeight = pdfCanvas.height) {
  if (!state.recording.compositeCanvas) {
    state.recording.compositeCanvas = document.createElement("canvas");
    state.recording.compositeContext = state.recording.compositeCanvas.getContext("2d");
  }

  const canvas = state.recording.compositeCanvas;
  if (!canvas || !state.recording.compositeContext) {
    return null;
  }

  const nextWidth = Math.max(1, Math.round(targetWidth));
  const nextHeight = Math.max(1, Math.round(targetHeight));

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  return canvas;
}

function getVisibleRecordingSourceRegion() {
  const viewerRect = viewerShell.getBoundingClientRect();
  const canvasRect = drawCanvas.getBoundingClientRect();

  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    return null;
  }

  const intersectLeft = Math.max(viewerRect.left, canvasRect.left);
  const intersectTop = Math.max(viewerRect.top, canvasRect.top);
  const intersectRight = Math.min(viewerRect.right, canvasRect.right);
  const intersectBottom = Math.min(viewerRect.bottom, canvasRect.bottom);
  const intersectWidth = intersectRight - intersectLeft;
  const intersectHeight = intersectBottom - intersectTop;

  if (intersectWidth <= 0 || intersectHeight <= 0) {
    return null;
  }

  const scaleX = drawCanvas.width / canvasRect.width;
  const scaleY = drawCanvas.height / canvasRect.height;
  const sourceX = clamp((intersectLeft - canvasRect.left) * scaleX, 0, drawCanvas.width);
  const sourceY = clamp((intersectTop - canvasRect.top) * scaleY, 0, drawCanvas.height);
  const sourceWidth = Math.min(drawCanvas.width - sourceX, intersectWidth * scaleX);
  const sourceHeight = Math.min(drawCanvas.height - sourceY, intersectHeight * scaleY);

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return null;
  }

  return {
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight
  };
}

function getRecordingSourceRegion() {
  if (getRecordingScope() !== "visible") {
    return {
      sourceX: 0,
      sourceY: 0,
      sourceWidth: pdfCanvas.width,
      sourceHeight: pdfCanvas.height
    };
  }

  return getVisibleRecordingSourceRegion();
}

function drawRecordingFrame() {
  if (!state.recording.isRecording) {
    return;
  }

  const sourceRegion = getRecordingSourceRegion();
  if (!sourceRegion) {
    state.recording.frameRequestId = requestAnimationFrame(drawRecordingFrame);
    return;
  }

  const recordingCanvas = ensureCompositeRecordingCanvas(sourceRegion.sourceWidth, sourceRegion.sourceHeight);
  const recordingContext = state.recording.compositeContext;
  const outputWidth = recordingCanvas ? recordingCanvas.width : 0;
  const outputHeight = recordingCanvas ? recordingCanvas.height : 0;

  if (!recordingCanvas || !recordingContext || !pdfCanvas.width || !pdfCanvas.height || !outputWidth || !outputHeight) {
    state.recording.frameRequestId = requestAnimationFrame(drawRecordingFrame);
    return;
  }

  recordingContext.clearRect(0, 0, outputWidth, outputHeight);
  recordingContext.drawImage(
    pdfCanvas,
    sourceRegion.sourceX,
    sourceRegion.sourceY,
    sourceRegion.sourceWidth,
    sourceRegion.sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );
  recordingContext.drawImage(
    gridCanvas,
    sourceRegion.sourceX,
    sourceRegion.sourceY,
    sourceRegion.sourceWidth,
    sourceRegion.sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );
  recordingContext.drawImage(
    drawCanvas,
    sourceRegion.sourceX,
    sourceRegion.sourceY,
    sourceRegion.sourceWidth,
    sourceRegion.sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  if (penCursor.style.display !== "none" && penCursor.complete) {
    const drawRect = drawCanvas.getBoundingClientRect();
    if (drawRect.width > 0 && drawRect.height > 0) {
      const left = Number.parseFloat(penCursor.style.left) || 0;
      const top = Number.parseFloat(penCursor.style.top) || 0;
      const cursorWidth = penCursor.clientWidth || penCursor.width || 29;
      const cursorHeight = penCursor.clientHeight || penCursor.height || 29;
      const scaleX = drawCanvas.width / drawRect.width;
      const scaleY = drawCanvas.height / drawRect.height;

      const cursorCanvasX = left * scaleX;
      const cursorCanvasY = top * scaleY;
      const cursorCanvasWidth = cursorWidth * scaleX;
      const cursorCanvasHeight = cursorHeight * scaleY;
      const outputScaleX = outputWidth / sourceRegion.sourceWidth;
      const outputScaleY = outputHeight / sourceRegion.sourceHeight;

      recordingContext.drawImage(
        penCursor,
        (cursorCanvasX - sourceRegion.sourceX) * outputScaleX,
        (cursorCanvasY - sourceRegion.sourceY) * outputScaleY,
        cursorCanvasWidth * outputScaleX,
        cursorCanvasHeight * outputScaleY
      );
    }
  }

  state.recording.frameRequestId = requestAnimationFrame(drawRecordingFrame);
}

function stopRecordingFrameLoop() {
  if (!state.recording.frameRequestId) {
    return;
  }

  cancelAnimationFrame(state.recording.frameRequestId);
  state.recording.frameRequestId = 0;
}

function cleanupRecordingSession() {
  stopRecordingFrameLoop();
  stopStreamTracks(state.recording.mediaStream);
  stopStreamTracks(state.recording.audioStream);

  state.recording.mediaRecorder = null;
  state.recording.mediaStream = null;
  state.recording.audioStream = null;
  state.recording.chunks = [];
  state.recording.isRecording = false;

  updateRecordingControls();
}

function pickRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "video/mp4;codecs=hvc1.1.6.L93.B0,mp4a.40.2",
    "video/mp4;codecs=avc1.640028,mp4a.40.2",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4"
  ];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
}

function getRecordingExtensionForMimeType(mimeType) {
  if (typeof mimeType === "string" && mimeType.toLowerCase().includes("mp4")) {
    return "mp4";
  }

  return "mp4";
}

async function getSelectedAudioStream() {
  const selectedAudioSource = audioSourceSelect.value;
  if (!selectedAudioSource || selectedAudioSource === "none") {
    return null;
  }

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    throw new Error("This browser cannot capture microphone audio.");
  }

  const audioConstraint = selectedAudioSource === "default"
    ? true
    : {
        deviceId: { exact: selectedAudioSource },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      };

  return await navigator.mediaDevices.getUserMedia({
    audio: audioConstraint,
    video: false
  });
}

function finalizeRecording() {
  const chunks = state.recording.chunks.slice();
  const mimeType = state.recording.mediaRecorder?.mimeType || pickRecordingMimeType() || "video/mp4";
  const extension = getRecordingExtensionForMimeType(mimeType);
  const fileName = buildTimestampedRecordingFileName(state.sourceFileName || "annotated", extension);

  cleanupRecordingSession();

  if (!chunks.length) {
    setStatus("Recording stopped.");
    return;
  }

  downloadBlob(new Blob(chunks, { type: mimeType }), fileName);
  setStatus(`Saved recording as "${fileName}".`);
}

async function startRecording() {
  if (!state.pdfDoc || state.recording.isRecording) {
    return;
  }

  if (!canRecordCanvas()) {
    setStatus("This browser does not support in-app video recording.");
    return;
  }

  if (!pdfCanvas.width || !pdfCanvas.height) {
    setStatus("Render a PDF page before recording.");
    return;
  }

  const sourceRegion = getRecordingSourceRegion();
  if (!sourceRegion) {
    setStatus("Scroll until part of the page is visible before recording.");
    return;
  }

  const mimeType = pickRecordingMimeType();
  if (!mimeType) {
    setStatus("MP4 recording is not supported in this browser.");
    return;
  }

  const recordingCanvas = ensureCompositeRecordingCanvas(sourceRegion.sourceWidth, sourceRegion.sourceHeight);
  if (!recordingCanvas || !state.recording.compositeContext) {
    setStatus("Could not initialize the recording canvas.");
    return;
  }

  const mediaStream = recordingCanvas.captureStream(RECORDING_FPS);
  state.recording.mediaStream = mediaStream;
  state.recording.chunks = [];
  state.recording.isRecording = true;
  updateRecordingControls();
  drawRecordingFrame();

  try {
    const audioStream = await getSelectedAudioStream();
    state.recording.audioStream = audioStream;
    if (audioStream) {
      audioStream.getAudioTracks().forEach((track) => {
        mediaStream.addTrack(track);
      });
    }
  } catch (error) {
    console.error(error);
    cleanupRecordingSession();
    setStatus("Could not access the selected audio source.");
    return;
  }

  try {
    state.recording.mediaRecorder = mimeType
      ? new MediaRecorder(mediaStream, { mimeType })
      : new MediaRecorder(mediaStream);
  } catch (error) {
    console.error(error);
    cleanupRecordingSession();
    setStatus("Could not start recording in this browser.");
    return;
  }

  state.recording.mediaRecorder.addEventListener("dataavailable", (event) => {
    if (!event.data || event.data.size === 0) {
      return;
    }

    state.recording.chunks.push(event.data);
  });

  state.recording.mediaRecorder.addEventListener("stop", finalizeRecording);
  state.recording.mediaRecorder.addEventListener("error", (event) => {
    console.error(event.error || event);
    setStatus("Recording failed.");
    cleanupRecordingSession();
  });

  state.recording.mediaRecorder.start(250);
  const scopeLabel = getRecordingScope() === "visible" ? "visible viewport" : "full page";
  setStatus(
    state.recording.audioStream
      ? `Recording ${scopeLabel} with selected audio source...`
      : `Recording ${scopeLabel} without audio...`
  );
}

function stopRecording() {
  if (!state.recording.isRecording) {
    return;
  }

  const recorder = state.recording.mediaRecorder;
  if (!recorder || recorder.state === "inactive") {
    finalizeRecording();
    return;
  }

  recorder.stop();
  setStatus("Stopping recording...");
}

async function populateAudioSourceOptions(requestPermission = false) {
  const previousSelection = audioSourceSelect.value || "none";
  audioSourceSelect.innerHTML = "";
  audioSourceSelect.append(new Option("Audio: None", "none"));

  if (!canChooseAudioInput()) {
    updateRecordingControls();
    return;
  }

  if (requestPermission && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
    let permissionStream = null;
    try {
      permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (error) {
      console.error(error);
      setStatus("Microphone permission was not granted.");
    } finally {
      stopStreamTracks(permissionStream);
    }
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioInputs = devices.filter((device) => device.kind === "audioinput");

  audioInputs.forEach((device, index) => {
    const label = device.label || `Microphone ${index + 1}`;
    const value = device.deviceId || "default";
    audioSourceSelect.append(new Option(`Audio: ${label}`, value));
  });

  const hasPreviousSelection = Array.from(audioSourceSelect.options).some(
    (option) => option.value === previousSelection
  );
  audioSourceSelect.value = hasPreviousSelection ? previousSelection : "none";
  updateRecordingControls();
}

async function canvasToPngBytes(canvas) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    throw new Error("Could not convert annotations to an image.");
  }

  return await blob.arrayBuffer();
}

function renderAnnotationsToCanvas(pageNumber, width, height, gridScale = 0) {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = width;
  exportCanvas.height = height;

  const exportContext = exportCanvas.getContext("2d");

  if (state.isGridVisible) {
    const spacing = getGridSpacingPxFromScale(gridScale);
    drawGridLines(exportContext, width, height, spacing, GRID_LINE_COLOR, 1);
  }

  const strokes = getPageData(pageNumber);
  strokes.forEach((stroke) => drawStroke(exportContext, stroke, width, height));
  exportContext.globalCompositeOperation = "source-over";

  return exportCanvas;
}

async function exportPdf() {
  if (!state.pdfBytes || !state.pdfDoc) {
    return;
  }

  setStatus("Building annotated PDF...");
  downloadBtn.disabled = true;

  try {
    const outputPdf = await PDFLib.PDFDocument.load(state.pdfBytes.slice());

    for (let pageNumber = 1; pageNumber <= state.pdfDoc.numPages; pageNumber += 1) {
      const strokes = getPageData(pageNumber);
      if (!strokes.length && !state.isGridVisible) {
        continue;
      }

      const sourcePage = await state.pdfDoc.getPage(pageNumber);
      const viewport = sourcePage.getViewport({ scale: 2 });
      const overlayCanvas = renderAnnotationsToCanvas(pageNumber, viewport.width, viewport.height, viewport.scale);
      const overlayBytes = await canvasToPngBytes(overlayCanvas);
      const overlayImage = await outputPdf.embedPng(overlayBytes);

      const outputPage = outputPdf.getPage(pageNumber - 1);
      const { width, height } = outputPage.getSize();

      outputPage.drawImage(overlayImage, {
        x: 0,
        y: 0,
        width,
        height
      });
    }

    const pdfBytes = await outputPdf.save();
    downloadBlob(
      new Blob([pdfBytes], { type: "application/pdf" }),
      buildTimestampedFileName(state.sourceFileName || "annotated")
    );
    clearUnsavedChanges();
    setStatus("Saved annotated PDF.");
  } catch (error) {
    console.error(error);
    setStatus("Saving failed. Check the browser console for details.");
  } finally {
    updatePageControls();
  }
}

pdfInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  if (!confirmDiscardUnsavedChanges()) {
    event.target.value = "";
    return;
  }

  try {
    await loadPdf(file);
  } catch (error) {
    console.error(error);
    resetLoadedPdfState();
    setStatus("Could not open that PDF.");
  } finally {
    event.target.value = "";
  }
});

drawCanvas.addEventListener("pointerdown", (event) => {
  if (!state.pdfDoc) {
    return;
  }

  if (shouldSuppressTouchPointer(event)) {
    if (event.cancelable) {
      event.preventDefault();
    }
    return;
  }

  updatePointerRecord(event);

  if (shouldStartPan(event)) {
    drawCanvas.setPointerCapture(event.pointerId);
    beginPan(event);
    return;
  }

  if (event.pointerType === "touch" && getTouchPointers().length >= 2) {
    drawCanvas.setPointerCapture(event.pointerId);
    beginPinchGesture();
    return;
  }

  if (state.pinch) {
    return;
  }

  if (event.pointerType !== "pen") {
    return;
  }

  if (event.cancelable) {
    event.preventDefault();
  }
  drawCanvas.setPointerCapture(event.pointerId);
  setPenInteractionLock(true);
  showPenCursorAtEvent(event);

  const { x, y } = getPointerPosition(event);
  if (!isWithinCanvasBounds(x, y)) {
    return;
  }

  startStroke(x, y);
  redrawAnnotations();
});

drawCanvas.addEventListener("pointermove", (event) => {
  if (shouldSuppressTouchPointer(event)) {
    if (event.cancelable) {
      event.preventDefault();
    }
    return;
  }

  updatePointerRecord(event);
  showPenCursorAtEvent(event);

  if (event.pointerType === "pen" && event.cancelable) {
    event.preventDefault();
  }

  if (state.pan) {
    updatePan(event);
    return;
  }

  if (state.pinch) {
    updatePinchGesture();
    return;
  }

  if (!state.drawing) {
    return;
  }

  const { x, y } = getPointerPosition(event);
  if (!isWithinCanvasBounds(x, y)) {
    stopDrawing(event);
    return;
  }

  appendPointToStroke(x, y);
  redrawAnnotations();
});

drawCanvas.addEventListener("pointerenter", (event) => {
  showPenCursorAtEvent(event);
});

function stopDrawing(event) {
  if (event && drawCanvas.hasPointerCapture(event.pointerId)) {
    drawCanvas.releasePointerCapture(event.pointerId);
  }

  if (!state.drawing) {
    if (event && event.pointerType === "pen") {
      setPenInteractionLock(false);
    }
    return;
  }

  finishStroke();
  redrawAnnotations();
  if (event && event.pointerType === "pen") {
    setPenInteractionLock(false);
  }
}

function updatePointerRecord(event) {
  if (event.pointerType !== "touch") {
    return;
  }

  state.activePointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY
  });
}

function removePointerRecord(event) {
  if (event.pointerType !== "touch") {
    return;
  }

  state.activePointers.delete(event.pointerId);
}

function getTouchPointers() {
  return Array.from(state.activePointers.values());
}

function getPinchDistance(points) {
  if (points.length < 2) {
    return 0;
  }

  const [first, second] = points;
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function beginPinchGesture() {
  const points = getTouchPointers();
  if (points.length < 2) {
    return;
  }

  state.pan = null;
  updateCanvasCursor();
  cancelActiveStroke();
  redrawAnnotations();
  state.pinch = {
    startDistance: getPinchDistance(points),
    startZoom: state.zoom
  };
}

function updatePinchGesture() {
  if (!state.pinch) {
    return;
  }

  const points = getTouchPointers();
  if (points.length < 2) {
    state.pinch = null;
    return;
  }

  const distance = getPinchDistance(points);
  if (!distance || !state.pinch.startDistance) {
    return;
  }

  state.zoom = clamp((distance / state.pinch.startDistance) * state.pinch.startZoom, MIN_ZOOM, MAX_ZOOM);
  scheduleRenderCurrentPage();
}

drawCanvas.addEventListener("pointerup", (event) => {
  if (shouldSuppressTouchPointer(event)) {
    if (event.cancelable) {
      event.preventDefault();
    }
    removePointerRecord(event);
    return;
  }

  removePointerRecord(event);

  if (event.pointerType === "pen" && event.cancelable) {
    event.preventDefault();
  }

  if (endPan(event)) {
    return;
  }

  if (state.pinch) {
    if (drawCanvas.hasPointerCapture(event.pointerId)) {
      drawCanvas.releasePointerCapture(event.pointerId);
    }
    state.pinch = getTouchPointers().length >= 2 ? state.pinch : null;
    if (!state.pinch && event.pointerType !== "pen") {
      hidePenCursor();
    }
    return;
  }

  stopDrawing(event);
  if (event.pointerType !== "pen") {
    hidePenCursor();
  }
});

drawCanvas.addEventListener("pointercancel", (event) => {
  if (shouldSuppressTouchPointer(event)) {
    if (event.cancelable) {
      event.preventDefault();
    }
    removePointerRecord(event);
    return;
  }

  removePointerRecord(event);

  if (event.pointerType === "pen" && event.cancelable) {
    event.preventDefault();
  }

  if (endPan(event)) {
    return;
  }

  if (state.pinch) {
    if (drawCanvas.hasPointerCapture(event.pointerId)) {
      drawCanvas.releasePointerCapture(event.pointerId);
    }
    state.pinch = getTouchPointers().length >= 2 ? state.pinch : null;
    if (!state.pinch) {
      hidePenCursor();
    }
    return;
  }

  stopDrawing(event);
  hidePenCursor();
});

drawCanvas.addEventListener("pointerleave", (event) => {
  if (shouldSuppressTouchPointer(event)) {
    removePointerRecord(event);
    return;
  }

  removePointerRecord(event);

  if (endPan(event)) {
    return;
  }

  if (state.pinch) {
    state.pinch = getTouchPointers().length >= 2 ? state.pinch : null;
    return;
  }

  if (state.drawing && event.buttons === 0) {
    stopDrawing(event);
  }

  if (event.pointerType === "pen" && !state.drawing) {
    hidePenCursor();
  }
});

eraseModeBtn.addEventListener("click", () => setMode("erase"));
highlighterModeBtn.addEventListener("click", () => setMode("highlighter"));
highlighterColorSelect.addEventListener("change", (event) => {
  const selectedColor = event.target.value;
  if (Object.prototype.hasOwnProperty.call(HIGHLIGHTER_COLORS, selectedColor)) {
    state.highlighterColor = selectedColor;
    return;
  }

  state.highlighterColor = "yellow";
  highlighterColorSelect.value = "yellow";
});
newBlankBtn.addEventListener("click", () => {
  createBlankPdf().catch((error) => {
    console.error(error);
    setStatus("Could not create a blank PDF.");
  });
});
undoBtn.addEventListener("click", undoStroke);
redoBtn.addEventListener("click", redoStroke);
clearPageBtn.addEventListener("click", clearCurrentPage);
gridBtn.addEventListener("click", () => {
  if (!state.pdfDoc) {
    return;
  }

  setGridVisible(!state.isGridVisible);
  setStatus(state.isGridVisible ? "1cm grid enabled." : "1cm grid disabled.");
});
zoomOutBtn.addEventListener("click", zoomOut);
zoomInBtn.addEventListener("click", zoomIn);
fitWidthBtn.addEventListener("click", () => {
  fitPageToWidth();
});
refreshAudioBtn.addEventListener("click", () => {
  populateAudioSourceOptions(true).catch((error) => {
    console.error(error);
    setStatus("Could not refresh audio input sources.");
  });
});
recordBtn.addEventListener("click", () => {
  startRecording().catch((error) => {
    console.error(error);
    setStatus("Could not start recording.");
  });
});
stopRecordBtn.addEventListener("click", stopRecording);
fullscreenBtn.addEventListener("click", toggleFullscreen);
downloadBtn.addEventListener("click", exportPdf);
prevPageBtn.addEventListener("click", () => goToPage(state.currentPage - 1));
nextPageBtn.addEventListener("click", () => goToPage(state.currentPage + 1));

colorPicker.addEventListener("input", (event) => {
  state.brushColor = event.target.value.toLowerCase();
  setMode("draw");
  syncActiveSwatch();
});

brushSize.addEventListener("input", (event) => {
  state.brushSize = Number(event.target.value);
  updateBrushLabel();
});

swatchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const color = button.dataset.color;
    if (!color) {
      return;
    }

    state.brushColor = color.toLowerCase();
    colorPicker.value = color;
    setMode("draw");
    syncActiveSwatch();
  });
});

window.addEventListener("resize", () => {
  if (!state.pdfDoc) {
    return;
  }

  renderCurrentPage().catch((error) => {
    console.error(error);
    setStatus("Resizing the page view failed.");
  });
});

function getPdfFromTransfer(dataTransfer) {
  if (!dataTransfer || !dataTransfer.files) {
    return null;
  }

  return Array.from(dataTransfer.files).find(
    (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  ) || null;
}

workspace.addEventListener("dragenter", (event) => {
  if (!getPdfFromTransfer(event.dataTransfer)) {
    return;
  }

  event.preventDefault();
  workspace.classList.add("drag-over");
});

workspace.addEventListener("dragover", (event) => {
  if (!getPdfFromTransfer(event.dataTransfer)) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  workspace.classList.add("drag-over");
});

workspace.addEventListener("dragleave", (event) => {
  if (!workspace.contains(event.relatedTarget)) {
    workspace.classList.remove("drag-over");
  }
});

workspace.addEventListener("drop", async (event) => {
  event.preventDefault();
  const file = getPdfFromTransfer(event.dataTransfer);
  workspace.classList.remove("drag-over");

  if (!file) {
    setStatus("Drop a PDF file to open it.");
    return;
  }

  if (!confirmDiscardUnsavedChanges()) {
    return;
  }

  try {
    await loadPdf(file);
  } catch (error) {
    console.error(error);
    resetLoadedPdfState();
    setStatus("Could not open that dropped PDF.");
  }
});

workspace.addEventListener("selectionstart", (event) => {
  event.preventDefault();
});

if (state.useStrictTouchSuppression) {
  ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach((eventName) => {
    document.addEventListener(eventName, suppressTouchPointerEvent, {
      capture: true,
      passive: false
    });
  });
}

window.addEventListener("keydown", (event) => {
  if (!state.pdfDoc) {
    return;
  }

  const targetTag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
  if (["input", "textarea", "select"].includes(targetTag)) {
    return;
  }

  const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z";
  const isRedo =
    (event.ctrlKey || event.metaKey) &&
    (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"));

  if (isUndo) {
    event.preventDefault();
    undoStroke();
    return;
  }

  if (isRedo) {
    event.preventDefault();
    redoStroke();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!state.hasUnsavedChanges) {
    return;
  }

  event.preventDefault();
  event.returnValue = "You have unsaved changes.";
});

document.addEventListener("fullscreenchange", updateFullscreenButton);

if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === "function") {
  navigator.mediaDevices.addEventListener("devicechange", () => {
    populateAudioSourceOptions().catch((error) => {
      console.error(error);
    });
  });
}

updateBrushLabel();
updatePageControls();
updateFullscreenButton();
setMode("draw");
setGridVisible(false);
setViewerVisible(false);
syncActiveSwatch();
updateHighlighterColorVisibility();
populateAudioSourceOptions().catch((error) => {
  console.error(error);
});
