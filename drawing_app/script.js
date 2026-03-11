const canvas = document.getElementById("drawCanvas");
const colorButtons = Array.from(document.querySelectorAll(".color-btn"));
const eraseBtn = document.getElementById("eraseBtn");
const fullScreenBtn = document.getElementById("fullScreenBtn");
const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");
const penCursor = document.getElementById("penCursor");

const ctx = canvas.getContext("2d");

let dpr = Math.max(1, window.devicePixelRatio || 1);
let isDrawing = false;
let activePenPointerId = null;
let lastPoint = null;
let toolMode = "draw";
let selectedInkColor = "#1f3d66";

const inkLabels = {
  "#1f3d66": "Default",
  "#7cff00": "Green",
  "#ff0000": "Red"
};

function resizeCanvas() {
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
  statusEl.textContent = toolMode === "erase" ? "Eraser ready." : drawReadyMessage();
}

function isPen(event) {
  return event.pointerType === "pen";
}

canvas.addEventListener("pointerenter", (event) => {
  if (!isPen(event)) {
    return;
  }
  const p = getPoint(event);
  showCursorAt(p.x, p.y);
  statusEl.textContent = "Stylus hover detected.";
});

canvas.addEventListener("pointermove", (event) => {
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
  if (!isPen(event)) {
    statusEl.textContent = "Use a stylus pen to draw.";
    return;
  }
  event.preventDefault();

  canvas.setPointerCapture(event.pointerId);
  beginDraw(event);
});

canvas.addEventListener("pointerup", (event) => {
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
  if (!isPen(event)) {
    return;
  }
  if (!isDrawing) {
    hideCursor();
    statusEl.textContent = "Waiting for stylus input...";
  }
});

clearBtn.addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  statusEl.textContent = "Canvas cleared.";
});

colorButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setInkColor(button.dataset.color);
  });
});

eraseBtn.addEventListener("click", () => {
  setToolMode("erase");
});

fullScreenBtn.addEventListener("click", () => {
  toggleFullscreen();
});

saveBtn.addEventListener("click", () => {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;

  const exportCtx = exportCanvas.getContext("2d");
  exportCtx.fillStyle = "#ffffff";
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  exportCtx.drawImage(canvas, 0, 0);

  const link = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.download = `drawing-${stamp}.png`;
  link.href = exportCanvas.toDataURL("image/png");
  link.click();

  statusEl.textContent = "Image saved as PNG.";
});

window.addEventListener("resize", resizeCanvas);
document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("webkitfullscreenchange", updateFullscreenButton);

setStrokeStyle();
resizeCanvas();
setInkColor(selectedInkColor);
updateFullscreenButton();

if (window.PointerEvent) {
  statusEl.textContent = `${inkLabels[selectedInkColor]} ink ready. Hover with stylus (where supported) or start drawing.`;
} else {
  statusEl.textContent = "Pointer Events not supported in this browser.";
}
