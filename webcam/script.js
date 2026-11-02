let viewState = {
  rotation: 0, // 0, 90, 180, 270
  cssZoom: 1,
  panX: 0,
  panY: 0,
  effectiveZoom: 1,
};

let activeStream = null;
let activeTrack = null;

function applyViewTransform() {
  const videoEl = document.getElementById('camera');
  if (!videoEl) return;
  const parts = [];
  if (viewState.panX || viewState.panY) parts.push(`translate(${viewState.panX}px, ${viewState.panY}px)`);
  if (viewState.rotation) parts.push(`rotate(${viewState.rotation}deg)`);
  if (viewState.cssZoom !== 1) parts.push(`scale(${viewState.cssZoom})`);
  videoEl.style.transform = parts.length ? parts.join(' ') : 'none';
}

async function startWebcam(deviceId = null) {
  const videoEl = document.getElementById('camera');
  const statusEl = document.getElementById('status');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusEl.textContent = 'Camera access is not supported in this browser.';
    return false;
  }

  try {
    const videoConstraints = {
      width: { ideal: 1920 },
      pan: true,
      tilt: true,
      zoom: true,
    };
    if (deviceId) {
      videoConstraints.deviceId = { exact: deviceId };
    } else {
      videoConstraints.facingMode = 'user';
    }

    const constraints = {
      video: videoConstraints,
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const previousStream = activeStream;
    videoEl.srcObject = stream;
    activeStream = stream;
    const [track] = stream.getVideoTracks();
    activeTrack = track || null;
    statusEl.textContent = '';

    if (track) {
      setupFocusControls(track);
      setupZoomControls(track);
    }
    if (previousStream && previousStream !== stream) {
      previousStream.getTracks().forEach((previousTrack) => previousTrack.stop());
    }

    await refreshCameraOptions(getActiveDeviceId());
    return true;
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Unable to access the camera: ${err.name || 'Error'}`;
    return false;
  }
}

function getActiveDeviceId() {
  try {
    return activeTrack && activeTrack.getSettings
      ? (activeTrack.getSettings().deviceId || '')
      : '';
  } catch (_) {
    return '';
  }
}

async function refreshCameraOptions(selectedDeviceId = '') {
  const controls = document.getElementById('cameraControls');
  const select = document.getElementById('cameraSelect');
  if (!controls || !select || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === 'videoinput' && device.deviceId);
    const previouslySelected = selectedDeviceId || select.value;
    const labelCounts = new Map();

    select.replaceChildren();
    cameras.forEach((device, index) => {
      const option = document.createElement('option');
      const label = device.label || `Camera ${index + 1}`;
      const count = (labelCounts.get(label) || 0) + 1;
      labelCounts.set(label, count);
      option.value = device.deviceId;
      option.textContent = count > 1 ? `${label} (${count})` : label;
      select.appendChild(option);
    });

    controls.hidden = cameras.length < 2;
    select.disabled = cameras.length < 2;
    if (cameras.length) {
      select.value = cameras.some((camera) => camera.deviceId === previouslySelected)
        ? previouslySelected
        : cameras[0].deviceId;
    }
  } catch (err) {
    console.error('Unable to list cameras', err);
    controls.hidden = true;
  }
}

function setupCameraSelector() {
  const select = document.getElementById('cameraSelect');
  if (!select) return;

  select.addEventListener('change', async () => {
    const requestedDeviceId = select.value;
    const currentDeviceId = getActiveDeviceId();
    if (!requestedDeviceId || requestedDeviceId === currentDeviceId) return;

    select.disabled = true;
    const switched = await startWebcam(requestedDeviceId);
    if (!switched) {
      select.value = currentDeviceId;
      select.disabled = false;
    }
  });
}

function setupRotateControl() {
  const btn = document.getElementById('rotateBtn');
  if (!btn) return;
  // Always rotate +90° each click, cycling through 0/90/180/270
  btn.textContent = 'Rotate 90°';
  btn.addEventListener('click', () => {
    viewState.rotation = (viewState.rotation + 90) % 360;
    applyViewTransform();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  setupCameraSelector();
  startWebcam();
  setupRotateControl();
  setupPanInteractions();
  setupFullscreenControl();
});

function setupFocusControls(track) {
  const statusEl = document.getElementById('status');
  const focusWrap = document.getElementById('focusControls');
  const afToggle = document.getElementById('autofocusToggle');
  const afLabel = afToggle.closest('label');
  const lockBtn = document.getElementById('lockFocusBtn');
  const group = document.getElementById('focusDistanceGroup');
  const slider = document.getElementById('focusSlider');
  const valueEl = document.getElementById('focusValue');

  focusWrap.hidden = true;
  afToggle.onchange = null;
  lockBtn.onclick = null;
  slider.oninput = null;
  afToggle.disabled = false;
  afLabel.hidden = false;
  lockBtn.hidden = false;
  group.hidden = true;

  if (!track || !track.getCapabilities) return;

  let caps, settings;
  try {
    caps = track.getCapabilities();
    settings = track.getSettings ? track.getSettings() : {};
  } catch (_) {
    return; // Some browsers may throw here; silently skip controls
  }

  const supportsFocusMode = Array.isArray(caps.focusMode) && caps.focusMode.length > 0;
  const supportsManualMode = supportsFocusMode && caps.focusMode.includes('manual');
  const autoMode = (caps.focusMode || []).includes('continuous')
    ? 'continuous'
    : ((caps.focusMode || []).includes('auto') ? 'auto' : null);
  const supportsDistance = caps.focusDistance &&
    (typeof caps.focusDistance.min === 'number') &&
    (typeof caps.focusDistance.max === 'number');

  if (!supportsFocusMode && !supportsDistance) {
    return;
  }

  focusWrap.hidden = false;

  if (supportsDistance) {
    const { min, max, step } = caps.focusDistance;
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(typeof step === 'number' && step > 0 ? step : (max - min) / 100);
    const initial = typeof settings.focusDistance === 'number' ? settings.focusDistance : min;
    slider.value = String(initial);
    valueEl.textContent = Number(initial).toFixed(2);
    group.hidden = false;
  }

  if (supportsFocusMode) {
    const currentMode = settings.focusMode || null;
    const isAF = currentMode === 'continuous' || currentMode === 'auto';
    afToggle.checked = isAF;
    afToggle.disabled = !autoMode || !supportsManualMode;
  } else {
    afToggle.disabled = true;
    afLabel.hidden = true;
  }
  lockBtn.hidden = !supportsManualMode;

  async function applyFocus({ mode, distance } = {}) {
    const advanced = [];
    if (mode) advanced.push({ focusMode: mode });
    if (typeof distance === 'number') advanced.push({ focusDistance: distance });
    if (!advanced.length) return;
    try {
      await track.applyConstraints({ advanced });
      statusEl.textContent = '';
    } catch (err) {
      console.error('applyConstraints failed', err);
      statusEl.textContent = `Focus control failed: ${err.name || 'Error'}`;
    }
  }

  afToggle.onchange = async () => {
    if (!supportsFocusMode) return;
    if (afToggle.checked && autoMode) {
      await applyFocus({ mode: autoMode });
    } else if (!afToggle.checked && supportsManualMode) {
      const dist = supportsDistance ? Number(slider.value) : undefined;
      await applyFocus({ mode: 'manual', distance: dist });
    }
  };

  lockBtn.onclick = async () => {
    if (!supportsManualMode) return;
    let current = undefined;
    try {
      const s = track.getSettings ? track.getSettings() : {};
      current = typeof s.focusDistance === 'number' ? s.focusDistance : undefined;
    } catch (_) {}
    if (supportsDistance && typeof current === 'number') {
      slider.value = String(current);
      valueEl.textContent = Number(current).toFixed(2);
    }
    afToggle.checked = false;
    await applyFocus({ mode: 'manual', distance: current });
  };

  if (supportsDistance) {
    slider.oninput = async () => {
      valueEl.textContent = Number(slider.value).toFixed(2);
      if (supportsManualMode) {
        afToggle.checked = false;
      }
      await applyFocus({
        mode: supportsManualMode ? 'manual' : undefined,
        distance: Number(slider.value),
      });
    };
  }
}

function setupZoomControls(track) {
  const statusEl = document.getElementById('status');
  const wrap = document.getElementById('zoomControls');
  const slider = document.getElementById('zoomSlider');
  const valueEl = document.getElementById('zoomValue');
  const resetBtn = document.getElementById('zoomResetBtn');

  wrap.hidden = true;
  slider.oninput = null;
  resetBtn.onclick = null;
  if (!track) return;

  let caps = {};
  let settings = {};
  if (track.getCapabilities) {
    try {
      caps = track.getCapabilities() || {};
      settings = track.getSettings ? track.getSettings() : {};
    } catch (_) {
      // Use CSS zoom when this browser cannot report camera capabilities.
    }
  }

  const hasZoom = caps.zoom && typeof caps.zoom.min === 'number' && typeof caps.zoom.max === 'number';
  wrap.hidden = false; // Always show; fallback to CSS zoom if no native zoom

  const min = hasZoom ? caps.zoom.min : 1;
  const max = hasZoom ? caps.zoom.max : 4;
  const step = hasZoom
    ? (typeof caps.zoom.step === 'number' && caps.zoom.step > 0 ? caps.zoom.step : (max - min) / 100)
    : 0.01;
  const current = hasZoom
    ? (typeof settings.zoom === 'number' ? settings.zoom : Math.min(Math.max(1, min), max))
    : 1;

  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(current);
  valueEl.textContent = Number(current).toFixed(2);
  viewState.effectiveZoom = Number(current) || 1;

  async function applyZoom(value) {
    try {
      if (hasZoom) {
        await track.applyConstraints({ advanced: [{ zoom: value }] });
        statusEl.textContent = '';
        viewState.effectiveZoom = Number(value) || 1;
        viewState.cssZoom = 1;
        clampPanToBounds();
        applyViewTransform();
      } else {
        viewState.cssZoom = Number(value) || 1;
        viewState.effectiveZoom = viewState.cssZoom;
        clampPanToBounds();
        applyViewTransform();
      }
    } catch (err) {
      console.error('applyConstraints zoom failed', err);
      statusEl.textContent = `Zoom control failed: ${err.name || 'Error'}`;
    }
  }

  viewState.cssZoom = 1;
  viewState.panX = 0;
  viewState.panY = 0;
  clampPanToBounds();
  applyViewTransform();

  slider.oninput = async () => {
    const z = Number(slider.value);
    valueEl.textContent = z.toFixed(2);
    await applyZoom(z);
  };

  resetBtn.onclick = async () => {
    const def = hasZoom ? Math.min(Math.max(1, min), max) : 1;
    slider.value = String(def);
    valueEl.textContent = def.toFixed(2);
    viewState.panX = 0;
    viewState.panY = 0;
    await applyZoom(def);
  };
}

function clampPanToBounds() {
  const wrap = document.getElementById('videoWrap');
  if (!wrap) return;
  const scale = viewState.cssZoom; // Only CSS zoom affects transform bounds
  const pannable = scale > 1.0001;
  if (!pannable) {
    viewState.panX = 0;
    viewState.panY = 0;
    wrap.classList.remove('pannable');
    wrap.classList.remove('dragging');
    return;
  }
  wrap.classList.add('pannable');
  const rect = wrap.getBoundingClientRect();
  const maxX = (rect.width * (scale - 1)) / 2;
  const maxY = (rect.height * (scale - 1)) / 2;
  viewState.panX = Math.max(-maxX, Math.min(maxX, viewState.panX));
  viewState.panY = Math.max(-maxY, Math.min(maxY, viewState.panY));
}

function setupPanInteractions() {
  const wrap = document.getElementById('videoWrap');
  if (!wrap) return;
  let dragging = false;
  let startX = 0, startY = 0;
  let startPanX = 0, startPanY = 0;

  const onPointerDown = (e) => {
    clampPanToBounds();
    if (viewState.cssZoom <= 1.0001) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startPanX = viewState.panX;
    startPanY = viewState.panY;
    wrap.classList.add('dragging');
    if (wrap.setPointerCapture) {
      try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
    }
    e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    viewState.panX = startPanX + dx;
    viewState.panY = startPanY + dy;
    clampPanToBounds();
    applyViewTransform();
  };

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    wrap.classList.remove('dragging');
    if (wrap.releasePointerCapture) {
      try { wrap.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  };

  wrap.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => { clampPanToBounds(); applyViewTransform(); });
}

function setupFullscreenControl() {
  const btn = document.getElementById('fullscreenBtn');
  const stage = document.getElementById('stage') || document.body;
  if (!btn || !stage) return;

  function updateLabel() {
    const active = !!document.fullscreenElement;
    btn.textContent = active ? 'Exit Full Screen' : 'Full Screen';
    btn.setAttribute('aria-pressed', String(active));
  }

  btn.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        await stage.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      // No-op; some browsers may block without user gesture or show their own UI
      console.error('Fullscreen toggle failed', e);
    } finally {
      updateLabel();
    }
  });

  document.addEventListener('fullscreenchange', updateLabel);
  updateLabel();
}
