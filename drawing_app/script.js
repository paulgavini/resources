const canvas = document.getElementById("drawCanvas");
const colorButtons = Array.from(document.querySelectorAll(".color-btn"));
const eraseBtn = document.getElementById("eraseBtn");
const undoBtn = document.getElementById("undoBtn");
const gridBtn = document.getElementById("gridBtn");
const pasteBtn = document.getElementById("pasteBtn");
const fullScreenBtn = document.getElementById("fullScreenBtn");
const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");
const saveProjectBtn = document.getElementById("saveProjectBtn");
const loadProjectBtn = document.getElementById("loadProjectBtn");
const loadProjectInput = document.getElementById("loadProjectInput");
const placeImageBtn = document.getElementById("placeImageBtn");
const cancelImageBtn = document.getElementById("cancelImageBtn");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const newPageBtn = document.getElementById("newPageBtn");
const deletePageBtn = document.getElementById("deletePageBtn");
const pageInfoEl = document.getElementById("pageInfo");
const statusEl = document.getElementById("status");
const penCursor = document.getElementById("penCursor");
const pasteOverlay = document.getElementById("pasteOverlay");
const pasteOverlayImage = document.getElementById("pasteOverlayImage");
const pasteResizeHandle = document.getElementById("pasteResizeHandle");

const ctx = canvas.getContext("2d");

let dpr = Math.max(1, window.devicePixelRatio || 1);
let isDrawing = false;
let activePenPointerId = null;
let lastPoint = null;
let toolMode = "draw";
let selectedInkColor = "#1f3d66";
let isGridVisible = false;
const undoHistoryLimit = 10;
const maxPages = 15;
const pages = [null];
const pageHistories = [[null]];
let currentPageIndex = 0;
let pageRenderToken = 0;
let isPageTransitioning = false;
let isExportingPdf = false;
let isProjectLoading = false;
let isPastePlacementActive = false;
let placementImage = null;
let placementImageObjectUrl = null;
let placementRect = null;
let placementInteraction = null;

const inkLabels = {
  "#1f3d66": "Default",
  "#7cff00": "Green",
  "#ff0000": "Red"
};

const cmToCssPixels = 96 / 2.54;
const projectSchemaVersion = 1;

function getCanvasCssSize() {
  return {
    width: canvas.width / dpr,
    height: canvas.height / dpr
  };
}

function updateCurrentPageSnapshot() {
  pages[currentPageIndex] = canvas.toDataURL("image/png");
}

function getCurrentHistory() {
  return pageHistories[currentPageIndex];
}

function pushCurrentStateToHistory(snapshot) {
  const history = getCurrentHistory();
  const latest = history[history.length - 1];
  if (latest === snapshot) {
    return;
  }
  history.push(snapshot);
  if (history.length > undoHistoryLimit) {
    history.shift();
  }
}

function replaceHistoryTail(snapshot) {
  const history = getCurrentHistory();
  history[history.length - 1] = snapshot;
}

function drawGridLines(ctx2d, width, height, spacing, color, lineWidth) {
  if (spacing <= 0) {
    return;
  }

  ctx2d.save();
  ctx2d.strokeStyle = color;
  ctx2d.lineWidth = lineWidth;
  ctx2d.beginPath();

  for (let x = 0; x <= width; x += spacing) {
    const xPos = x + 0.5;
    ctx2d.moveTo(xPos, 0);
    ctx2d.lineTo(xPos, height);
  }

  for (let y = 0; y <= height; y += spacing) {
    const yPos = y + 0.5;
    ctx2d.moveTo(0, yPos);
    ctx2d.lineTo(width, yPos);
  }

  ctx2d.stroke();
  ctx2d.restore();
}

function setGridVisible(visible) {
  isGridVisible = Boolean(visible);
  canvas.classList.toggle("show-grid", isGridVisible);
  gridBtn.classList.toggle("is-active", isGridVisible);
}

function revokePlacementImageUrl() {
  if (!placementImageObjectUrl) {
    return;
  }
  URL.revokeObjectURL(placementImageObjectUrl);
  placementImageObjectUrl = null;
}

function updatePlacementOverlay() {
  if (!isPastePlacementActive || !placementRect) {
    pasteOverlay.classList.remove("is-active");
    pasteOverlay.style.left = "0px";
    pasteOverlay.style.top = "0px";
    pasteOverlay.style.width = "0px";
    pasteOverlay.style.height = "0px";
    return;
  }

  pasteOverlay.classList.add("is-active");
  pasteOverlay.style.left = `${placementRect.x}px`;
  pasteOverlay.style.top = `${placementRect.y}px`;
  pasteOverlay.style.width = `${placementRect.width}px`;
  pasteOverlay.style.height = `${placementRect.height}px`;
}

function clearPlacement(keepStatus = false) {
  placementInteraction = null;
  placementRect = null;
  placementImage = null;
  isPastePlacementActive = false;
  pasteOverlayImage.removeAttribute("src");
  updatePlacementOverlay();
  revokePlacementImageUrl();
  if (!keepStatus) {
    statusEl.textContent = drawReadyMessage();
  }
  updatePageControls();
}

async function startImagePlacementFromFile(file) {
  if (!file || isPageTransitioning || isExportingPdf || isProjectLoading) {
    return;
  }

  if (isDrawing) {
    endDraw();
  }

  const objectUrl = URL.createObjectURL(file);
  const image = await loadImageFromDataUrl(objectUrl);
  if (!image) {
    URL.revokeObjectURL(objectUrl);
    return;
  }

  revokePlacementImageUrl();
  placementImageObjectUrl = objectUrl;
  placementImage = image;
  placementInteraction = null;
  pasteOverlayImage.src = objectUrl;

  const size = getCanvasCssSize();
  const naturalWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const naturalHeight = Math.max(1, image.naturalHeight || image.height || 1);
  const maxWidth = Math.max(40, size.width * 0.8);
  const maxHeight = Math.max(40, size.height * 0.8);
  const fitScale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);
  let width = Math.max(40, naturalWidth * fitScale);
  let height = Math.max(40, naturalHeight * fitScale);

  if (width > size.width) {
    const scale = size.width / width;
    width *= scale;
    height *= scale;
  }
  if (height > size.height) {
    const scale = size.height / height;
    width *= scale;
    height *= scale;
  }

  placementRect = {
    x: Math.max(0, (size.width - width) / 2),
    y: Math.max(0, (size.height - height) / 2),
    width,
    height
  };

  isPastePlacementActive = true;
  hideCursor();
  updatePlacementOverlay();
  updatePageControls();
  statusEl.textContent = "Position image, then tap Place Image.";
}

async function commitImagePlacement() {
  if (!isPastePlacementActive || !placementImage || !placementRect || isPageTransitioning || isExportingPdf) {
    return;
  }

  if (isDrawing) {
    endDraw();
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(placementImage, placementRect.x, placementRect.y, placementRect.width, placementRect.height);
  updateCurrentPageSnapshot();
  pushCurrentStateToHistory(pages[currentPageIndex]);
  clearPlacement(true);
  statusEl.textContent = "Image placed.";
}

function cancelImagePlacement() {
  if (!isPastePlacementActive) {
    return;
  }
  clearPlacement(true);
  statusEl.textContent = "Image placement cancelled.";
}

function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      resolve(null);
    };
    image.src = dataUrl;
  });
}

async function collectPdfPageImages(snapshots, pixelWidth, pixelHeight) {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = pixelWidth;
  exportCanvas.height = pixelHeight;
  const exportCtx = exportCanvas.getContext("2d");
  const images = [];

  for (const snapshot of snapshots) {
    exportCtx.fillStyle = "#ffffff";
    exportCtx.fillRect(0, 0, pixelWidth, pixelHeight);

    if (isGridVisible) {
      const spacing = cmToCssPixels * dpr;
      const lineWidth = Math.max(1, Math.round(dpr * 0.75));
      drawGridLines(exportCtx, pixelWidth, pixelHeight, spacing, "rgba(133, 144, 159, 0.32)", lineWidth);
    }

    if (snapshot) {
      const image = await loadImageFromDataUrl(snapshot);
      if (image) {
        exportCtx.drawImage(image, 0, 0, pixelWidth, pixelHeight);
      }
    }

    const jpegDataUrl = exportCanvas.toDataURL("image/jpeg", 0.92);
    const base64 = jpegDataUrl.split(",")[1];
    images.push({
      bytes: base64ToUint8Array(base64),
      pixelWidth,
      pixelHeight
    });
  }

  return images;
}

function formatPdfNumber(value) {
  return Number(value.toFixed(2)).toString();
}

function buildPdfBlobFromImages(images, pageWidth, pageHeight) {
  const chunks = [];
  const offsets = [0];
  const encoder = new TextEncoder();
  let length = 0;

  const pushText = (text) => {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    length += bytes.length;
  };

  const pushBytes = (bytes) => {
    chunks.push(bytes);
    length += bytes.length;
  };

  const startObject = (objectId) => {
    offsets[objectId] = length;
    pushText(`${objectId} 0 obj\n`);
  };

  const endObject = () => {
    pushText("endobj\n");
  };

  const pageObjectIds = [];
  const contentObjectIds = [];
  const imageObjectIds = [];
  let nextObjectId = 3;

  for (let i = 0; i < images.length; i += 1) {
    pageObjectIds.push(nextObjectId);
    nextObjectId += 1;
    contentObjectIds.push(nextObjectId);
    nextObjectId += 1;
    imageObjectIds.push(nextObjectId);
    nextObjectId += 1;
  }

  const totalObjects = nextObjectId - 1;
  const mediaWidth = formatPdfNumber(Math.max(1, pageWidth));
  const mediaHeight = formatPdfNumber(Math.max(1, pageHeight));

  pushText("%PDF-1.4\n%1234\n");

  startObject(1);
  pushText("<< /Type /Catalog /Pages 2 0 R >>\n");
  endObject();

  startObject(2);
  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  pushText(`<< /Type /Pages /Kids [${kids}] /Count ${images.length} >>\n`);
  endObject();

  for (let i = 0; i < images.length; i += 1) {
    const imageName = `Im${i + 1}`;
    const pageObjectId = pageObjectIds[i];
    const contentObjectId = contentObjectIds[i];
    const imageObjectId = imageObjectIds[i];
    const image = images[i];

    startObject(pageObjectId);
    pushText(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${mediaWidth} ${mediaHeight}] /Resources << /XObject << /${imageName} ${imageObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>\n`);
    endObject();

    const contentStream = `q\n${mediaWidth} 0 0 ${mediaHeight} 0 0 cm\n/${imageName} Do\nQ\n`;
    const contentBytes = encoder.encode(contentStream);

    startObject(contentObjectId);
    pushText(`<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushText("endstream\n");
    endObject();

    startObject(imageObjectId);
    pushText(`<< /Type /XObject /Subtype /Image /Width ${image.pixelWidth} /Height ${image.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);
    pushBytes(image.bytes);
    pushText("\nendstream\n");
    endObject();
  }

  const xrefOffset = length;
  pushText(`xref\n0 ${totalObjects + 1}\n`);
  pushText("0000000000 65535 f \n");
  for (let i = 1; i <= totalObjects; i += 1) {
    const offset = String(offsets[i] || 0).padStart(10, "0");
    pushText(`${offset} 00000 n \n`);
  }

  pushText(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob(chunks, { type: "application/pdf" });
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

function isKnownInkColor(value) {
  return Object.prototype.hasOwnProperty.call(inkLabels, value);
}

function normalizeSnapshot(value) {
  if (typeof value !== "string") {
    return null;
  }
  return value.startsWith("data:image/") ? value : null;
}

function normalizeLoadedProject(rawProject) {
  if (!rawProject || typeof rawProject !== "object") {
    return null;
  }

  if (rawProject.schemaVersion && rawProject.schemaVersion > projectSchemaVersion) {
    return null;
  }

  if (!Array.isArray(rawProject.pages) || rawProject.pages.length === 0) {
    return null;
  }

  const normalizedPages = rawProject.pages.slice(0, maxPages).map(normalizeSnapshot);
  if (normalizedPages.length === 0) {
    normalizedPages.push(null);
  }

  const rawHistories = Array.isArray(rawProject.pageHistories) ? rawProject.pageHistories : [];
  const normalizedHistories = normalizedPages.map((pageSnapshot, pageIndex) => {
    const historyCandidate = Array.isArray(rawHistories[pageIndex]) ? rawHistories[pageIndex] : [];
    const history = historyCandidate.map(normalizeSnapshot);

    if (history.length === 0) {
      history.push(pageSnapshot);
    }

    if (history[history.length - 1] !== pageSnapshot) {
      history.push(pageSnapshot);
    }

    while (history.length > undoHistoryLimit) {
      history.shift();
    }

    return history;
  });

  let pageIndex = Number(rawProject.currentPageIndex);
  if (!Number.isFinite(pageIndex)) {
    pageIndex = 0;
  }
  pageIndex = Math.floor(pageIndex);
  pageIndex = Math.max(0, Math.min(normalizedPages.length - 1, pageIndex));

  const color = isKnownInkColor(rawProject.selectedInkColor) ? rawProject.selectedInkColor : "#1f3d66";
  const mode = rawProject.toolMode === "erase" ? "erase" : "draw";
  const grid = Boolean(rawProject.isGridVisible);

  return {
    pages: normalizedPages,
    pageHistories: normalizedHistories,
    currentPageIndex: pageIndex,
    selectedInkColor: color,
    toolMode: mode,
    isGridVisible: grid
  };
}

function buildProjectPayload() {
  updateCurrentPageSnapshot();
  replaceHistoryTail(pages[currentPageIndex]);

  return {
    schemaVersion: projectSchemaVersion,
    savedAt: new Date().toISOString(),
    currentPageIndex,
    selectedInkColor,
    toolMode,
    isGridVisible,
    pages: pages.slice(),
    pageHistories: pageHistories.map((history) => history.slice())
  };
}

async function applyLoadedProject(projectData) {
  if (!projectData) {
    return false;
  }

  if (isPageTransitioning || isExportingPdf || isProjectLoading) {
    return false;
  }

  if (isDrawing) {
    endDraw();
  }

  if (isPastePlacementActive) {
    clearPlacement(true);
  }

  isProjectLoading = true;
  updatePageControls();

  try {
    pages.splice(0, pages.length, ...projectData.pages);
    pageHistories.splice(0, pageHistories.length, ...projectData.pageHistories.map((history) => history.slice()));
    currentPageIndex = projectData.currentPageIndex;

    await drawDataUrlToCanvas(pages[currentPageIndex]);
    setStrokeStyle();
    setInkColor(projectData.selectedInkColor);
    setToolMode(projectData.toolMode);
    setGridVisible(projectData.isGridVisible);
    updateCurrentPageSnapshot();
    replaceHistoryTail(pages[currentPageIndex]);

    statusEl.textContent = `Project loaded (${pages.length} page${pages.length === 1 ? "" : "s"}).`;
    return true;
  } finally {
    isProjectLoading = false;
    updatePageControls();
  }
}

function drawDataUrlToCanvas(dataUrl) {
  const token = ++pageRenderToken;
  const size = getCanvasCssSize();
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, size.width, size.height);
  if (!dataUrl) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (token !== pageRenderToken) {
        resolve();
        return;
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(image, 0, 0, size.width, size.height);
      resolve();
    };
    image.onerror = () => {
      resolve();
    };
    image.src = dataUrl;
  });
}

function getClipboardImageFile(event) {
  if (!event.clipboardData || !event.clipboardData.items) {
    return null;
  }
  const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith("image/"));
  return item ? item.getAsFile() : null;
}

async function getClipboardImageFromApi() {
  if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") {
    return null;
  }

  const clipboardItems = await navigator.clipboard.read();
  for (const item of clipboardItems) {
    const imageType = item.types.find((type) => type.startsWith("image/"));
    if (!imageType) {
      continue;
    }
    const blob = await item.getType(imageType);
    if (blob) {
      return new File([blob], "pasted-image", { type: imageType });
    }
  }

  return null;
}

function onPlacementPointerDown(event) {
  if (!isPastePlacementActive || !placementRect) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();

  const mode = event.target === pasteResizeHandle ? "resize" : "drag";
  placementInteraction = {
    pointerId: event.pointerId,
    mode,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: placementRect.x,
    startY: placementRect.y,
    startWidth: placementRect.width,
    startHeight: placementRect.height
  };
  pasteOverlay.setPointerCapture(event.pointerId);
}

function onPlacementPointerMove(event) {
  if (!placementInteraction || event.pointerId !== placementInteraction.pointerId || !placementRect) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const dx = event.clientX - placementInteraction.startClientX;
  const dy = event.clientY - placementInteraction.startClientY;
  const size = getCanvasCssSize();

  if (placementInteraction.mode === "drag") {
    const maxX = Math.max(0, size.width - placementInteraction.startWidth);
    const maxY = Math.max(0, size.height - placementInteraction.startHeight);
    placementRect.x = Math.min(maxX, Math.max(0, placementInteraction.startX + dx));
    placementRect.y = Math.min(maxY, Math.max(0, placementInteraction.startY + dy));
  } else {
    const minSize = 40;
    const maxWidth = Math.max(minSize, size.width - placementInteraction.startX);
    const maxHeight = Math.max(minSize, size.height - placementInteraction.startY);
    const minScale = Math.max(minSize / placementInteraction.startWidth, minSize / placementInteraction.startHeight);
    const maxScale = Math.min(maxWidth / placementInteraction.startWidth, maxHeight / placementInteraction.startHeight);
    let scale = Math.max(
      (placementInteraction.startWidth + dx) / placementInteraction.startWidth,
      (placementInteraction.startHeight + dy) / placementInteraction.startHeight
    );
    if (!Number.isFinite(scale)) {
      scale = 1;
    }
    scale = Math.min(maxScale, Math.max(minScale, scale));
    placementRect.width = placementInteraction.startWidth * scale;
    placementRect.height = placementInteraction.startHeight * scale;
    placementRect.x = placementInteraction.startX;
    placementRect.y = placementInteraction.startY;
  }

  updatePlacementOverlay();
}

function onPlacementPointerEnd(event) {
  if (!placementInteraction || event.pointerId !== placementInteraction.pointerId) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (pasteOverlay.hasPointerCapture(event.pointerId)) {
    pasteOverlay.releasePointerCapture(event.pointerId);
  }
  placementInteraction = null;
}

function updatePageControls() {
  const busy = isPageTransitioning || isExportingPdf || isProjectLoading;
  const interactionLocked = busy || isPastePlacementActive;
  const history = getCurrentHistory();
  pageInfoEl.textContent = `Page ${currentPageIndex + 1} of ${pages.length}`;
  prevPageBtn.disabled = interactionLocked || currentPageIndex === 0;
  nextPageBtn.disabled = interactionLocked || currentPageIndex === pages.length - 1;
  deletePageBtn.disabled = interactionLocked || pages.length === 1;
  newPageBtn.disabled = interactionLocked || pages.length >= maxPages;
  undoBtn.disabled = interactionLocked || history.length <= 1;
  saveBtn.disabled = interactionLocked;
  saveProjectBtn.disabled = interactionLocked;
  loadProjectBtn.disabled = interactionLocked;
  gridBtn.disabled = interactionLocked;
  pasteBtn.disabled = interactionLocked;
  eraseBtn.disabled = interactionLocked;
  fullScreenBtn.disabled = interactionLocked;
  clearBtn.disabled = interactionLocked;
  colorButtons.forEach((button) => {
    button.disabled = interactionLocked;
  });
  placeImageBtn.hidden = !isPastePlacementActive;
  cancelImageBtn.hidden = !isPastePlacementActive;
  placeImageBtn.disabled = busy || !isPastePlacementActive;
  cancelImageBtn.disabled = busy || !isPastePlacementActive;
}

async function goToPage(index) {
  if (
    index < 0 ||
    index >= pages.length ||
    index === currentPageIndex ||
    isPageTransitioning ||
    isExportingPdf ||
    isProjectLoading ||
    isPastePlacementActive
  ) {
    return;
  }

  isPageTransitioning = true;
  updatePageControls();

  if (isDrawing) {
    endDraw();
  }

  try {
    updateCurrentPageSnapshot();
    currentPageIndex = index;
    await drawDataUrlToCanvas(pages[currentPageIndex]);
    setStrokeStyle();
  } finally {
    isPageTransitioning = false;
    updatePageControls();
  }
}

async function createNewPage() {
  if (isPageTransitioning || isExportingPdf || isProjectLoading || isPastePlacementActive) {
    return;
  }

  if (pages.length >= maxPages) {
    statusEl.textContent = `Page limit reached (${maxPages}).`;
    return;
  }

  isPageTransitioning = true;
  updatePageControls();

  if (isDrawing) {
    endDraw();
  }

  try {
    updateCurrentPageSnapshot();
    pages.splice(currentPageIndex + 1, 0, null);
    pageHistories.splice(currentPageIndex + 1, 0, [null]);
    currentPageIndex += 1;
    await drawDataUrlToCanvas(null);
    setStrokeStyle();
  } finally {
    isPageTransitioning = false;
    updatePageControls();
  }
}

async function deleteCurrentPage() {
  if (pages.length === 1 || isPageTransitioning || isExportingPdf || isProjectLoading || isPastePlacementActive) {
    return;
  }

  if (isDrawing) {
    endDraw();
  }

  const confirmed = window.confirm("Delete this page?");
  if (!confirmed) {
    return;
  }

  isPageTransitioning = true;
  updatePageControls();

  try {
    pages.splice(currentPageIndex, 1);
    pageHistories.splice(currentPageIndex, 1);
    if (currentPageIndex >= pages.length) {
      currentPageIndex = pages.length - 1;
    }

    await drawDataUrlToCanvas(pages[currentPageIndex]);
    setStrokeStyle();
  } finally {
    isPageTransitioning = false;
    updatePageControls();
  }
}

function resizeCanvas() {
  if (isPastePlacementActive) {
    clearPlacement(true);
  }

  const rect = canvas.getBoundingClientRect();
  const previousDpr = dpr;
  const previousCssWidth = canvas.width / previousDpr;
  const previousCssHeight = canvas.height / previousDpr;
  dpr = Math.max(1, window.devicePixelRatio || 1);
  const snapshot = document.createElement("canvas");
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;
  snapshot.getContext("2d").drawImage(canvas, 0, 0);

  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (snapshot.width > 0 && snapshot.height > 0) {
    ctx.drawImage(snapshot, 0, 0, previousCssWidth, previousCssHeight);
  }

  setStrokeStyle();
  updateCurrentPageSnapshot();
  replaceHistoryTail(pages[currentPageIndex]);
  updatePageControls();
}

function setStrokeStyle() {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = selectedInkColor;
  ctx.lineWidth = 3;
}

function drawReadyMessage() {
  return `${inkLabels[selectedInkColor] || "Ink"} ink ready.`;
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function showCursorAt(x, y) {
  penCursor.style.display = "block";
  penCursor.style.left = `${x}px`;
  penCursor.style.top = `${y}px`;
}

function hideCursor() {
  penCursor.style.display = "none";
}

function drawSegment(from, to, pressure = 0.5) {
  const strength = Math.max(0, Math.min(1, pressure));

  if (toolMode === "erase") {
    const minW = 10;
    const maxW = 24;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = minW + (maxW - minW) * strength;
  } else {
    const minW = 1.25;
    const maxW = 4.5;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = selectedInkColor;
    ctx.lineWidth = minW + (maxW - minW) * strength;
  }

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function setToolMode(mode) {
  toolMode = mode;
  eraseBtn.classList.toggle("is-active", mode === "erase");

  if (!isDrawing) {
    statusEl.textContent = mode === "erase" ? "Eraser ready." : drawReadyMessage();
  }
}

function setInkColor(color) {
  selectedInkColor = color;
  colorButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.color === color);
  });
  setStrokeStyle();
  setToolMode("draw");
}

function isFullscreenActive() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function updateFullscreenButton() {
  fullScreenBtn.textContent = isFullscreenActive() ? "Exit Full Screen" : "Full Screen";
}

async function toggleFullscreen() {
  try {
    if (isFullscreenActive()) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      statusEl.textContent = "Exited full screen.";
      return;
    }

    const target = document.documentElement;
    if (target.requestFullscreen) {
      await target.requestFullscreen();
      statusEl.textContent = "Entered full screen.";
    } else if (target.webkitRequestFullscreen) {
      target.webkitRequestFullscreen();
      statusEl.textContent = "Entered full screen.";
    } else {
      statusEl.textContent = "Full screen is not supported in this browser.";
    }
  } catch (_error) {
    statusEl.textContent = "Unable to toggle full screen.";
  } finally {
    updateFullscreenButton();
  }
}

function beginDraw(event) {
  isDrawing = true;
  activePenPointerId = event.pointerId;
  lastPoint = getPoint(event);
  showCursorAt(lastPoint.x, lastPoint.y);
  statusEl.textContent = toolMode === "erase" ? "Erasing..." : `${inkLabels[selectedInkColor] || "Ink"} ink drawing...`;
}

function continueDraw(event) {
  const events = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
  for (const e of events) {
    const p = getPoint(e);
    if (lastPoint) {
      drawSegment(lastPoint, p, e.pressure || 0.5);
    }
    lastPoint = p;
    showCursorAt(p.x, p.y);
  }
}

function endDraw() {
  isDrawing = false;
  activePenPointerId = null;
  lastPoint = null;
  updateCurrentPageSnapshot();
  pushCurrentStateToHistory(pages[currentPageIndex]);
  statusEl.textContent = toolMode === "erase" ? "Eraser ready." : drawReadyMessage();
  updatePageControls();
}

function isPen(event) {
  return event.pointerType === "pen";
}

canvas.addEventListener("pointerenter", (event) => {
  if (isPastePlacementActive || isProjectLoading) {
    return;
  }
  if (!isPen(event)) {
    return;
  }
  const p = getPoint(event);
  showCursorAt(p.x, p.y);
  statusEl.textContent = "Stylus hover detected.";
});

canvas.addEventListener("pointermove", (event) => {
  if (isPastePlacementActive || isProjectLoading) {
    return;
  }
  if (!isPen(event)) {
    return;
  }
  event.preventDefault();

  const p = getPoint(event);
  showCursorAt(p.x, p.y);

  if (isDrawing && event.pointerId === activePenPointerId) {
    continueDraw(event);
  } else {
    statusEl.textContent = "Stylus hover detected.";
  }
});

canvas.addEventListener("pointerdown", (event) => {
  if (isPastePlacementActive || isProjectLoading) {
    return;
  }
  if (!isPen(event)) {
    statusEl.textContent = "Use a stylus pen to draw.";
    return;
  }
  event.preventDefault();

  canvas.setPointerCapture(event.pointerId);
  beginDraw(event);
});

canvas.addEventListener("pointerup", (event) => {
  if (isPastePlacementActive || isProjectLoading) {
    return;
  }
  if (!isPen(event)) {
    return;
  }
  event.preventDefault();

  if (event.pointerId === activePenPointerId) {
    continueDraw(event);
    endDraw();
  }
});

canvas.addEventListener("pointercancel", (event) => {
  if (isPastePlacementActive || isProjectLoading) {
    return;
  }
  if (!isPen(event)) {
    return;
  }
  if (event.pointerId === activePenPointerId) {
    endDraw();
  }
  hideCursor();
  statusEl.textContent = "Stylus input cancelled.";
});

canvas.addEventListener("lostpointercapture", (event) => {
  if (event.pointerId === activePenPointerId) {
    endDraw();
  }
});

canvas.addEventListener("pointerleave", (event) => {
  if (isPastePlacementActive || isProjectLoading) {
    return;
  }
  if (!isPen(event)) {
    return;
  }
  if (!isDrawing) {
    hideCursor();
    statusEl.textContent = "Waiting for stylus input...";
  }
});

clearBtn.addEventListener("click", () => {
  if (isPastePlacementActive || isProjectLoading) {
    return;
  }
  const size = getCanvasCssSize();
  ctx.clearRect(0, 0, size.width, size.height);
  pages[currentPageIndex] = null;
  pushCurrentStateToHistory(null);
  statusEl.textContent = "Canvas cleared.";
  updatePageControls();
});

colorButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (isPastePlacementActive || isProjectLoading) {
      return;
    }
    setInkColor(button.dataset.color);
  });
});

eraseBtn.addEventListener("click", () => {
  if (isPastePlacementActive || isProjectLoading) {
    return;
  }
  setToolMode("erase");
});

gridBtn.addEventListener("click", () => {
  if (isPastePlacementActive || isProjectLoading) {
    return;
  }
  setGridVisible(!isGridVisible);
  if (!isDrawing) {
    statusEl.textContent = isGridVisible ? "1cm grid enabled." : drawReadyMessage();
  }
});

pasteBtn.addEventListener("click", async () => {
  if (isPageTransitioning || isExportingPdf || isProjectLoading || isPastePlacementActive) {
    return;
  }

  try {
    const imageFile = await getClipboardImageFromApi();
    if (!imageFile) {
      statusEl.textContent = "Clipboard image unavailable. Copy an image, then tap Paste.";
      return;
    }
    await startImagePlacementFromFile(imageFile);
  } catch (_error) {
    statusEl.textContent = "Clipboard access blocked. Enable clipboard permissions, then try Paste.";
  }
});

fullScreenBtn.addEventListener("click", () => {
  if (isPastePlacementActive || isProjectLoading) {
    return;
  }
  toggleFullscreen();
});

saveBtn.addEventListener("click", async () => {
  if (isPageTransitioning || isExportingPdf || isProjectLoading || isPastePlacementActive) {
    return;
  }

  if (isDrawing) {
    endDraw();
  }

  isExportingPdf = true;
  updatePageControls();

  try {
    updateCurrentPageSnapshot();
    const snapshots = pages.slice();
    const pixelWidth = Math.max(1, canvas.width);
    const pixelHeight = Math.max(1, canvas.height);
    const cssSize = getCanvasCssSize();
    const pageWidth = Math.max(1, cssSize.width);
    const pageHeight = Math.max(1, cssSize.height);
    const images = await collectPdfPageImages(snapshots, pixelWidth, pixelHeight);
    const pdfBlob = buildPdfBlobFromImages(images, pageWidth, pageHeight);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadBlob(pdfBlob, `drawing-pages-${stamp}.pdf`);
    statusEl.textContent = "All pages exported as PDF.";
  } catch (_error) {
    statusEl.textContent = "Unable to export PDF.";
  } finally {
    isExportingPdf = false;
    updatePageControls();
  }
});

saveProjectBtn.addEventListener("click", () => {
  if (isPageTransitioning || isExportingPdf || isProjectLoading || isPastePlacementActive) {
    return;
  }

  if (isDrawing) {
    endDraw();
  }

  try {
    const payload = buildProjectPayload();
    const json = JSON.stringify(payload);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const blob = new Blob([json], { type: "application/json" });
    downloadBlob(blob, `drawing-project-${stamp}.json`);
    statusEl.textContent = "Project saved.";
  } catch (_error) {
    statusEl.textContent = "Unable to save project.";
  }
});

loadProjectBtn.addEventListener("click", () => {
  if (isPageTransitioning || isExportingPdf || isProjectLoading || isPastePlacementActive) {
    return;
  }
  loadProjectInput.value = "";
  loadProjectInput.click();
});

loadProjectInput.addEventListener("change", async () => {
  const file = loadProjectInput.files && loadProjectInput.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const normalized = normalizeLoadedProject(parsed);
    if (!normalized) {
      statusEl.textContent = "Invalid project file.";
      return;
    }

    const loaded = await applyLoadedProject(normalized);
    if (!loaded) {
      statusEl.textContent = "Unable to load project.";
    }
  } catch (_error) {
    statusEl.textContent = "Unable to load project.";
  } finally {
    loadProjectInput.value = "";
  }
});

undoBtn.addEventListener("click", async () => {
  if (isPageTransitioning || isExportingPdf || isProjectLoading || isPastePlacementActive) {
    return;
  }

  if (isDrawing) {
    endDraw();
  }

  const history = getCurrentHistory();
  if (history.length <= 1) {
    return;
  }

  isPageTransitioning = true;
  updatePageControls();

  try {
    history.pop();
    const previousState = history[history.length - 1];
    pages[currentPageIndex] = previousState;
    await drawDataUrlToCanvas(previousState);
    setStrokeStyle();
  } finally {
    isPageTransitioning = false;
    updatePageControls();
  }
});

placeImageBtn.addEventListener("click", () => {
  commitImagePlacement();
});

cancelImageBtn.addEventListener("click", () => {
  cancelImagePlacement();
});

pasteOverlay.addEventListener("pointerdown", onPlacementPointerDown);
pasteOverlay.addEventListener("pointermove", onPlacementPointerMove);
pasteOverlay.addEventListener("pointerup", onPlacementPointerEnd);
pasteOverlay.addEventListener("pointercancel", onPlacementPointerEnd);
pasteOverlay.addEventListener("lostpointercapture", onPlacementPointerEnd);

document.addEventListener("paste", (event) => {
  const imageFile = getClipboardImageFile(event);
  if (!imageFile) {
    return;
  }
  event.preventDefault();
  startImagePlacementFromFile(imageFile);
});

document.addEventListener("keydown", (event) => {
  if (!isPastePlacementActive) {
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    cancelImagePlacement();
    return;
  }
  if (event.key === "Enter" || event.key === "NumpadEnter") {
    event.preventDefault();
    commitImagePlacement();
  }
});

prevPageBtn.addEventListener("click", () => {
  goToPage(currentPageIndex - 1);
});

nextPageBtn.addEventListener("click", () => {
  goToPage(currentPageIndex + 1);
});

newPageBtn.addEventListener("click", () => {
  createNewPage();
});

deletePageBtn.addEventListener("click", () => {
  deleteCurrentPage();
});

window.addEventListener("resize", resizeCanvas);
document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("webkitfullscreenchange", updateFullscreenButton);

setStrokeStyle();
resizeCanvas();
setGridVisible(false);
setInkColor(selectedInkColor);
updateFullscreenButton();

if (window.PointerEvent) {
  statusEl.textContent = `${inkLabels[selectedInkColor]} ink ready. Hover with stylus (where supported) or start drawing.`;
} else {
  statusEl.textContent = "Pointer Events not supported in this browser.";
}
