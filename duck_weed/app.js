(() => {
  "use strict";

  const MAX_IMAGE_EDGE = 1600;
  const $ = (selector) => document.querySelector(selector);
  const els = {
    canvas: $("#image-canvas"), frame: $(".image-editor-wrap"), placeholder: $("#image-placeholder"),
    zoomOut: $("#zoom-out"), zoomIn: $("#zoom-in"), zoomFit: $("#zoom-fit"),
    file: $("#photo-file"), dishDiameter: $("#dish-diameter"), calibrationHelp: $("#calibration-help"),
    calibrationError: $("#calibration-error"), colourMaskToggle: $("#colour-mask-toggle"), colourMaskStatus: $("#colour-mask-status"),
    autoThreshold: $("#auto-threshold-button"),
    hueMin: $("#hue-min"), hueMax: $("#hue-max"), saturation: $("#saturation-min"), brightness: $("#brightness-min"),
    hueMinValue: $("#hue-min-value"), hueMaxValue: $("#hue-max-value"), saturationValue: $("#saturation-value"),
    brightnessValue: $("#brightness-value"), area: $("#result-area"), coverage: $("#result-coverage"), dishArea: $("#result-dish-area"),
    camera: $("#camera-dialog"), cameraButton: $("#camera-button"), video: $("#camera-video"), cameraMessage: $("#camera-message"),
    capture: $("#capture-photo")
  };

  const defaultThreshold = { hueMin: 38, hueMax: 165, saturation: 30, brightness: 25 };
  let imageBitmap = null;
  let imagePixels = null;
  let circle = null;
  let colourMaskVisible = true;
  let pointerStart = null;
  let cameraStream = null;
  let zoomLevel = 1;

  const fmt = (value, digits = 1) => Number.isFinite(value) ? Number(value).toFixed(digits) : "—";

  function hsb(r8, g8, b8) {
    const r = r8 / 255, g = g8 / 255, b = b8 / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    let hue = 0;
    if (delta) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }
    if (hue < 0) hue += 360;
    return { hue, saturation: max === 0 ? 0 : delta / max * 100, brightness: max * 100 };
  }

  function luminanceAt(data, x, y, width) {
    const index = (y * width + x) * 4;
    return .299 * data[index] + .587 * data[index + 1] + .114 * data[index + 2];
  }

  function estimateCircle(data, width, height) {
    const maxRadius = Math.floor(Math.min(width, height) * .49);
    const minRadius = Math.floor(Math.min(width, height) * .38);
    const centerX = width / 2, centerY = height / 2;
    let best = { score: -1, x: centerX, y: centerY, radius: Math.min(width, height) * .43 };
    const offsets = [-.06, -.03, 0, .03, .06];
    for (const ox of offsets) for (const oy of offsets) {
      const cx = centerX + width * ox, cy = centerY + height * oy;
      for (let radius = minRadius; radius <= maxRadius; radius += Math.max(2, Math.round(maxRadius / 28))) {
        let score = 0, samples = 0;
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 30) {
          const x = Math.round(cx + Math.cos(angle) * radius), y = Math.round(cy + Math.sin(angle) * radius);
          const innerX = Math.round(cx + Math.cos(angle) * (radius - 2)), innerY = Math.round(cy + Math.sin(angle) * (radius - 2));
          const outerX = Math.round(cx + Math.cos(angle) * (radius + 2)), outerY = Math.round(cy + Math.sin(angle) * (radius + 2));
          if (x < 0 || y < 0 || x >= width || y >= height || innerX < 0 || innerY < 0 || outerX < 0 || outerY < 0 || innerX >= width || outerX >= width || innerY >= height || outerY >= height) continue;
          score += Math.abs(luminanceAt(data, innerX, innerY, width) - luminanceAt(data, outerX, outerY, width));
          samples++;
        }
        if (samples > 20 && score / samples > best.score) best = { score: score / samples, x: cx, y: cy, radius };
      }
    }
    return { x: best.x, y: best.y, radius: best.radius };
  }

  function suggestThresholds() {
    if (!imagePixels || !circle) return;
    const { width, height, data } = imagePixels;
    const histogram = new Uint32Array(181);
    const minX = Math.max(0, Math.floor(circle.x - circle.radius)), maxX = Math.min(width - 1, Math.ceil(circle.x + circle.radius));
    const minY = Math.max(0, Math.floor(circle.y - circle.radius)), maxY = Math.min(height - 1, Math.ceil(circle.y + circle.radius));
    const radiusSquared = circle.radius ** 2;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const dx = x + .5 - circle.x, dy = y + .5 - circle.y;
      if (dx * dx + dy * dy > radiusSquared) continue;
      const offset = (y * width + x) * 4;
      const color = hsb(data[offset], data[offset + 1], data[offset + 2]);
      if (color.hue >= 25 && color.hue <= 175 && color.saturation >= 20 && color.brightness >= 12) histogram[Math.round(color.hue)]++;
    }
    const count = histogram.reduce((sum, value) => sum + value, 0);
    if (!count) {
      els.hueMin.value = defaultThreshold.hueMin; els.hueMax.value = defaultThreshold.hueMax;
      els.saturation.value = defaultThreshold.saturation; els.brightness.value = defaultThreshold.brightness;
    } else {
      const percentileHue = (percentile) => {
        let cumulative = 0;
        for (let hue = 0; hue < histogram.length; hue++) {
          cumulative += histogram[hue];
          if (cumulative >= count * percentile) return hue;
        }
        return 120;
      };
      const low = percentileHue(.08), high = percentileHue(.92);
      els.hueMin.value = Math.max(0, Math.min(180, low - 20));
      els.hueMax.value = Math.max(100, Math.min(360, high + 20));
      if (Number(els.hueMin.value) >= Number(els.hueMax.value)) els.hueMax.value = Math.min(360, Number(els.hueMin.value) + 2);
      els.saturation.value = 30; els.brightness.value = 25;
    }
    updateThresholdLabels();
  }

  function updateThresholdLabels() {
    els.hueMinValue.textContent = `${els.hueMin.value}°`;
    els.hueMaxValue.textContent = `${els.hueMax.value}°`;
    els.saturationValue.textContent = `${els.saturation.value}%`;
    els.brightnessValue.textContent = `${els.brightness.value}%`;
  }

  function getThreshold() {
    return { hueMin: Number(els.hueMin.value), hueMax: Number(els.hueMax.value), saturation: Number(els.saturation.value), brightness: Number(els.brightness.value) };
  }

  function analyzeImage() {
    if (!imagePixels || !circle) return null;
    const { width, height, data } = imagePixels;
    const threshold = getThreshold();
    let greenPixels = 0, insidePixels = 0;
    const mask = new Uint8Array(width * height);
    const minX = Math.max(0, Math.floor(circle.x - circle.radius)), maxX = Math.min(width - 1, Math.ceil(circle.x + circle.radius));
    const minY = Math.max(0, Math.floor(circle.y - circle.radius)), maxY = Math.min(height - 1, Math.ceil(circle.y + circle.radius));
    const radiusSquared = circle.radius ** 2;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const dx = x + .5 - circle.x, dy = y + .5 - circle.y;
      if (dx * dx + dy * dy > radiusSquared) continue;
      insidePixels++;
      const offset = (y * width + x) * 4;
      const color = hsb(data[offset], data[offset + 1], data[offset + 2]);
      if (color.hue >= threshold.hueMin && color.hue <= threshold.hueMax && color.saturation >= threshold.saturation && color.brightness >= threshold.brightness) {
        greenPixels++;
        mask[y * width + x] = 1;
      }
    }
    return { mask, greenPixels, insidePixels };
  }

  function updateResults(result) {
    const coverage = result.insidePixels ? 100 * result.greenPixels / result.insidePixels : 0;
    const diameterMm = Number(els.dishDiameter.value);
    const hasDiameter = Number.isFinite(diameterMm) && diameterMm >= 10 && diameterMm <= 1000;
    const mmPerPixel = hasDiameter ? diameterMm / (circle.radius * 2) : null;
    const areaCm2 = mmPerPixel ? result.greenPixels * mmPerPixel ** 2 / 100 : null;
    const dishAreaCm2 = hasDiameter ? Math.PI * (diameterMm / 20) ** 2 : null;
    els.coverage.textContent = fmt(coverage);
    els.area.textContent = areaCm2 === null ? "—" : fmt(areaCm2, 2);
    els.dishArea.textContent = dishAreaCm2 === null ? "—" : fmt(dishAreaCm2, 2);
    els.colourMaskStatus.textContent = `${fmt(coverage)}% of the dish interior matches these thresholds${colourMaskVisible ? " and is highlighted" : " (overlay hidden)"}.`;
    els.colourMaskToggle.disabled = false;
    els.autoThreshold.disabled = false;
    els.colourMaskToggle.setAttribute("aria-checked", String(colourMaskVisible));
    els.colourMaskToggle.textContent = colourMaskVisible ? "On" : "Off";
    els.colourMaskToggle.classList.toggle("is-on", colourMaskVisible);
    els.dishDiameter.disabled = false;
    els.hueMin.disabled = false; els.hueMax.disabled = false; els.saturation.disabled = false; els.brightness.disabled = false;
    if (els.dishDiameter.value && !hasDiameter) {
      els.calibrationHelp.hidden = true;
      els.calibrationError.hidden = false;
      els.calibrationError.textContent = "Enter an inside diameter from 10 to 1000 mm.";
    } else {
      els.calibrationError.hidden = true;
      els.calibrationHelp.hidden = false;
      els.calibrationHelp.textContent = hasDiameter
        ? `Dish diameter: ${fmt(diameterMm, 1)} mm. Area is calibrated from the adjusted circle.`
        : "Coverage is available without a diameter. Enter it to calculate area in cm².";
    }
  }

  function fitCanvasToFrame() {
    if (!imagePixels || !els.canvas.width || !els.canvas.height) return;
    const padding = 24;
    const maxWidth = Math.max(1, els.frame.clientWidth - padding);
    const maxHeight = Math.max(1, els.frame.clientHeight - padding);
    const scale = Math.min(maxWidth / els.canvas.width, maxHeight / els.canvas.height);
    els.canvas.style.width = `${Math.floor(els.canvas.width * scale * zoomLevel)}px`;
    els.canvas.style.height = `${Math.floor(els.canvas.height * scale * zoomLevel)}px`;
    els.zoomOut.disabled = zoomLevel <= .5;
    els.zoomIn.disabled = zoomLevel >= 4;
    els.zoomFit.disabled = false;
    els.zoomFit.textContent = zoomLevel === 1 ? "Fit" : `${Math.round(zoomLevel * 100)}%`;
    els.zoomFit.setAttribute("aria-label", zoomLevel === 1 ? "Image fitted to view" : `Reset zoom; currently ${Math.round(zoomLevel * 100)} percent`);
  }

  function setZoom(value) {
    if (!imagePixels) return;
    const oldZoom = zoomLevel;
    zoomLevel = clamp(value, .5, 4);
    if (zoomLevel === oldZoom) return;
    const ratio = zoomLevel / oldZoom;
    fitCanvasToFrame();
    requestAnimationFrame(() => {
      els.frame.scrollLeft = (els.frame.scrollLeft + els.frame.clientWidth / 2) * ratio - els.frame.clientWidth / 2;
      els.frame.scrollTop = (els.frame.scrollTop + els.frame.clientHeight / 2) * ratio - els.frame.clientHeight / 2;
    });
  }

  function renderAnalysis() {
    if (!imagePixels || !circle) return;
    const { width, height, data } = imagePixels;
    const result = analyzeImage();
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    if (colourMaskVisible) for (let i = 0; i < result.mask.length; i++) if (result.mask[i]) {
      const x = i % width, y = Math.floor(i / width);
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1
        || !result.mask[i - 1] || !result.mask[i + 1] || !result.mask[i - width] || !result.mask[i + width];
      const offset = i * 4, color = edge ? [255, 226, 118] : [55, 190, 100], mix = edge ? .85 : .52;
      output.data[offset] = Math.round(output.data[offset] * (1 - mix) + color[0] * mix);
      output.data[offset + 1] = Math.round(output.data[offset + 1] * (1 - mix) + color[1] * mix);
      output.data[offset + 2] = Math.round(output.data[offset + 2] * (1 - mix) + color[2] * mix);
    }
    const context = els.canvas.getContext("2d");
    context.putImageData(output, 0, 0);
    context.save();
    context.strokeStyle = "#d6f18e"; context.lineWidth = Math.max(2, width / 400); context.setLineDash([10, 7]);
    context.beginPath(); context.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2); context.stroke();
    context.setLineDash([]); context.fillStyle = "#f3c15c";
    context.beginPath(); context.arc(circle.x + circle.radius * .707, circle.y - circle.radius * .707, Math.max(7, width / 100), 0, Math.PI * 2); context.fill();
    context.restore();
    updateResults(result);
  }

  async function loadPhoto(blob) {
    if (!blob || !blob.type.startsWith("image/")) return;
    try {
      if (imageBitmap) imageBitmap.close();
      imageBitmap = await createImageBitmap(blob);
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(imageBitmap.width, imageBitmap.height));
      els.canvas.width = Math.max(1, Math.round(imageBitmap.width * scale));
      els.canvas.height = Math.max(1, Math.round(imageBitmap.height * scale));
      const context = els.canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(imageBitmap, 0, 0, els.canvas.width, els.canvas.height);
      imagePixels = context.getImageData(0, 0, els.canvas.width, els.canvas.height);
      circle = estimateCircle(imagePixels.data, els.canvas.width, els.canvas.height);
      colourMaskVisible = true;
      zoomLevel = 1;
      els.canvas.classList.add("has-image");
      els.placeholder.hidden = true;
      els.dishDiameter.value = "";
      fitCanvasToFrame();
      suggestThresholds();
      renderAnalysis();
    } catch (error) {
      els.calibrationError.hidden = false;
      els.calibrationError.textContent = `Could not read this photo: ${error.message}`;
    }
  }

  function pointOnCanvas(event) {
    const rect = els.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * els.canvas.width / rect.width, y: (event.clientY - rect.top) * els.canvas.height / rect.height };
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  els.canvas.addEventListener("pointerdown", (event) => {
    if (!imagePixels) return;
    event.preventDefault(); els.canvas.setPointerCapture(event.pointerId);
    const point = pointOnCanvas(event);
    const distance = Math.hypot(point.x - circle.x, point.y - circle.y);
    pointerStart = {
      operation: zoomLevel > 1 && distance > circle.radius * 1.08
        ? "pan"
        : Math.abs(distance - circle.radius) < circle.radius * .2 ? "resize" : "move",
      x: point.x, y: point.y, clientX: event.clientX, clientY: event.clientY,
      offsetX: circle.x - point.x, offsetY: circle.y - point.y
    };
  });

  els.canvas.addEventListener("pointermove", (event) => {
    if (!pointerStart) return;
    const point = pointOnCanvas(event);
    if (pointerStart.operation === "pan") {
      els.frame.scrollLeft -= event.clientX - pointerStart.clientX;
      els.frame.scrollTop -= event.clientY - pointerStart.clientY;
      pointerStart.clientX = event.clientX;
      pointerStart.clientY = event.clientY;
    } else if (pointerStart.operation === "resize") {
      const maxRadius = Math.max(8, Math.min(circle.x, els.canvas.width - circle.x, circle.y, els.canvas.height - circle.y));
      circle.radius = clamp(Math.hypot(point.x - circle.x, point.y - circle.y), 8, maxRadius);
    } else {
      circle.x = clamp(point.x + pointerStart.offsetX, circle.radius, els.canvas.width - circle.radius);
      circle.y = clamp(point.y + pointerStart.offsetY, circle.radius, els.canvas.height - circle.radius);
    }
    renderAnalysis();
  });

  ["pointerup", "pointercancel"].forEach((name) => els.canvas.addEventListener(name, () => {
    if (!pointerStart) return;
    pointerStart = null;
    renderAnalysis();
  }));

  function openPhotoPicker() { els.file.click(); }
  $("#upload-button").addEventListener("click", openPhotoPicker);
  $("#placeholder-upload").addEventListener("click", openPhotoPicker);
  els.file.addEventListener("change", () => {
    const file = els.file.files?.[0];
    if (file) loadPhoto(file);
    els.file.value = "";
  });
  els.dishDiameter.addEventListener("input", () => imagePixels && renderAnalysis());
  els.autoThreshold.addEventListener("click", () => {
    if (!imagePixels || !circle) return;
    suggestThresholds();
    renderAnalysis();
  });
  els.zoomOut.addEventListener("click", () => setZoom(zoomLevel / 1.25));
  els.zoomIn.addEventListener("click", () => setZoom(zoomLevel * 1.25));
  els.zoomFit.addEventListener("click", () => setZoom(1));
  els.colourMaskToggle.addEventListener("click", () => {
    if (!imagePixels) return;
    colourMaskVisible = !colourMaskVisible;
    renderAnalysis();
  });
  [els.hueMin, els.hueMax, els.saturation, els.brightness].forEach((input) => input.addEventListener("input", () => {
    if (input === els.hueMin && Number(els.hueMin.value) >= Number(els.hueMax.value)) els.hueMax.value = Math.min(360, Number(els.hueMin.value) + 2);
    if (input === els.hueMax && Number(els.hueMax.value) <= Number(els.hueMin.value)) els.hueMin.value = Math.max(0, Number(els.hueMax.value) - 2);
    updateThresholdLabels();
    renderAnalysis();
  }));

  async function startCamera() {
    els.camera.showModal();
    els.cameraMessage.textContent = "Connecting to camera…";
    els.capture.disabled = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      els.cameraMessage.textContent = "Live camera is not available here. Upload a photo instead. Camera access needs HTTPS or localhost.";
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      els.video.srcObject = cameraStream;
      await els.video.play();
      els.capture.disabled = false;
      els.cameraMessage.textContent = "Keep the complete inside rim in view.";
    } catch (error) {
      els.cameraMessage.textContent = error.name === "NotAllowedError"
        ? "Camera permission was declined. Close this dialog and upload a photo instead."
        : "Could not open the camera. Upload a photo instead.";
    }
  }

  function stopCamera() {
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null; els.video.srcObject = null;
  }

  function capturePhoto() {
    const captured = document.createElement("canvas");
    captured.width = els.video.videoWidth; captured.height = els.video.videoHeight;
    captured.getContext("2d").drawImage(els.video, 0, 0);
    captured.toBlob((blob) => {
      stopCamera(); els.camera.close();
      if (blob) loadPhoto(blob);
    }, "image/jpeg", .94);
  }

  els.cameraButton.addEventListener("click", startCamera);
  els.capture.addEventListener("click", capturePhoto);
  document.querySelectorAll("[data-close-camera]").forEach((button) => button.addEventListener("click", () => {
    stopCamera(); els.camera.close();
  }));
  els.camera.addEventListener("close", stopCamera);
  new ResizeObserver(fitCanvasToFrame).observe(els.frame);
})();
