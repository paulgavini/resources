const pdfInput = document.getElementById("pdfInput");
const eraseModeBtn = document.getElementById("eraseModeBtn");
const clearPageBtn = document.getElementById("clearPageBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
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
const drawCanvas = document.getElementById("drawCanvas");
const swatchButtons = Array.from(document.querySelectorAll(".swatch-button"));

const pdfContext = pdfCanvas.getContext("2d");
const drawContext = drawCanvas.getContext("2d");

const ERASER_SIZE_MULTIPLIER = 3;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 4;

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
  brushColor: colorPicker.value,
  brushSize: Number(brushSize.value),
  zoom: 1,
  drawing: false,
  activeStroke: null,
  renderToken: 0,
  renderScheduled: false,
  activePointers: new Map(),
  pinch: null,
  pan: null
};

function setStatus(message) {
  statusText.textContent = message;
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
    button.classList.toggle("active", button.dataset.color === state.brushColor.toLowerCase());
  });
}

function resetLoadedPdfState() {
  state.pdfDoc = null;
  state.pdfBytes = null;
  state.pageAnnotations.clear();
  state.activeStroke = null;
  state.drawing = false;
  state.zoom = 1;
  state.activePointers.clear();
  state.pinch = null;
  state.pan = null;
  updatePageControls();
  setViewerVisible(false);
  updateCanvasCursor();
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
  updateCanvasCursor();
}

function updateCanvasCursor() {
  if (state.pan) {
    drawCanvas.style.cursor = "grabbing";
    return;
  }

  drawCanvas.style.cursor = 'url("./cursor-arrow-lime.svg") 5 3, auto';
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
  fullscreenBtn.textContent = document.fullscreenElement ? "Exit Full Screen" : "Full Screen";
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
  downloadBtn.disabled = !state.pdfDoc;
}

function resizeDrawLayer(width, height) {
  drawCanvas.width = width;
  drawCanvas.height = height;
}

function resizePdfLayer(width, height) {
  pdfCanvas.width = width;
  pdfCanvas.height = height;
}

function clearDrawLayer() {
  drawContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}

function normalizedBrushSize(width, height, brushPx) {
  return brushPx / Math.min(width, height);
}

function denormalizedBrushSize(width, height, brushRatio) {
  return Math.max(1, brushRatio * Math.min(width, height));
}

function getToolSizePx(mode, sizePx) {
  return mode === "erase" ? sizePx * ERASER_SIZE_MULTIPLIER : sizePx;
}

function cancelActiveStroke() {
  state.activeStroke = null;
  state.drawing = false;
}

function shouldStartPan(event) {
  return (event.pointerType === "pen" || event.pointerType === "mouse") && event.ctrlKey;
}

function beginPan(event) {
  cancelActiveStroke();
  redrawAnnotations();
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
  return true;
}

function startStroke(x, y) {
  const width = drawCanvas.width;
  const height = drawCanvas.height;
  const toolSizePx = getToolSizePx(state.mode, state.brushSize);

  state.activeStroke = {
    mode: state.mode,
    color: state.brushColor,
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

async function renderCurrentPage() {
  if (!state.pdfDoc) {
    return;
  }

  const renderId = ++state.renderToken;
  const page = await state.pdfDoc.getPage(state.currentPage);

  const workspaceWidth = viewerShell.clientWidth || viewerShell.parentElement.clientWidth;
  const framePadding = 36;
  const maxWidth = Math.max(320, workspaceWidth - framePadding);
  const unscaledViewport = page.getViewport({ scale: 1 });
  const fitScale = Math.min(2.2, maxWidth / unscaledViewport.width);
  const scale = fitScale * state.zoom;
  const viewport = page.getViewport({ scale });

  if (renderId !== state.renderToken) {
    return;
  }

  state.currentViewport = viewport;
  resizePdfLayer(viewport.width, viewport.height);
  resizeDrawLayer(viewport.width, viewport.height);

  await page.render({
    canvasContext: pdfContext,
    viewport
  }).promise;

  if (renderId !== state.renderToken) {
    return;
  }

  setViewerVisible(true);
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

async function loadPdf(file) {
  const bytes = await file.arrayBuffer();
  await loadPdfBytes(bytes, file.name);
}

async function loadPdfBytes(bytes, fileName) {
  const sourceBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  state.pdfBytes = sourceBytes.slice();
  state.pageAnnotations.clear();
  state.currentPage = 1;
  state.activeStroke = null;
  state.drawing = false;
  state.zoom = 1;
  state.activePointers.clear();
  state.pinch = null;
  state.pan = null;
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

function buildTimestampedFileName(baseName) {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0")
  ];

  return `${baseName}-${parts.join("")}.pdf`;
}

async function canvasToPngBytes(canvas) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    throw new Error("Could not convert annotations to an image.");
  }

  return await blob.arrayBuffer();
}

function renderAnnotationsToCanvas(pageNumber, width, height) {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = width;
  exportCanvas.height = height;

  const exportContext = exportCanvas.getContext("2d");
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
      if (!strokes.length) {
        continue;
      }

      const sourcePage = await state.pdfDoc.getPage(pageNumber);
      const viewport = sourcePage.getViewport({ scale: 2 });
      const overlayCanvas = renderAnnotationsToCanvas(pageNumber, viewport.width, viewport.height);
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

  updatePointerRecord(event);
  drawCanvas.setPointerCapture(event.pointerId);

  if (shouldStartPan(event)) {
    beginPan(event);
    return;
  }

  if (event.pointerType === "touch" && getTouchPointers().length >= 2) {
    beginPinchGesture();
    return;
  }

  if (state.pinch) {
    return;
  }

  const { x, y } = getPointerPosition(event);
  if (!isWithinCanvasBounds(x, y)) {
    return;
  }

  startStroke(x, y);
  redrawAnnotations();
});

drawCanvas.addEventListener("pointermove", (event) => {
  updatePointerRecord(event);

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

function stopDrawing(event) {
  if (event && drawCanvas.hasPointerCapture(event.pointerId)) {
    drawCanvas.releasePointerCapture(event.pointerId);
  }

  if (!state.drawing) {
    return;
  }

  finishStroke();
  redrawAnnotations();
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
  removePointerRecord(event);

  if (endPan(event)) {
    return;
  }

  if (state.pinch) {
    if (drawCanvas.hasPointerCapture(event.pointerId)) {
      drawCanvas.releasePointerCapture(event.pointerId);
    }
    state.pinch = getTouchPointers().length >= 2 ? state.pinch : null;
    return;
  }

  stopDrawing(event);
});

drawCanvas.addEventListener("pointercancel", (event) => {
  removePointerRecord(event);

  if (endPan(event)) {
    return;
  }

  if (state.pinch) {
    if (drawCanvas.hasPointerCapture(event.pointerId)) {
      drawCanvas.releasePointerCapture(event.pointerId);
    }
    state.pinch = getTouchPointers().length >= 2 ? state.pinch : null;
    return;
  }

  stopDrawing(event);
});

drawCanvas.addEventListener("pointerleave", (event) => {
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
});

eraseModeBtn.addEventListener("click", () => setMode("erase"));
undoBtn.addEventListener("click", undoStroke);
redoBtn.addEventListener("click", redoStroke);
clearPageBtn.addEventListener("click", clearCurrentPage);
zoomOutBtn.addEventListener("click", zoomOut);
zoomInBtn.addEventListener("click", zoomIn);
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

  try {
    await loadPdf(file);
  } catch (error) {
    console.error(error);
    resetLoadedPdfState();
    setStatus("Could not open that dropped PDF.");
  }
});

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

document.addEventListener("fullscreenchange", updateFullscreenButton);

updateBrushLabel();
updatePageControls();
updateFullscreenButton();
setMode("draw");
setViewerVisible(false);
syncActiveSwatch();
