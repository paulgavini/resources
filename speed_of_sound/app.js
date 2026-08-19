(function speedOfSoundApp() {
  "use strict";

  const M = window.SoundMath;
  const RECORD_SECONDS = 2;
  const PREFERRED_SAMPLE_RATE = 96000;
  const TRIAL_COUNT = 5;
  const MIN_VIEW_SAMPLES = 128;

  const ui = {
    tubeLength: document.getElementById("tubeLength"),
    temperature: document.getElementById("temperature"),
    tubeDiameter: document.getElementById("tubeDiameter"),
    microphoneOffset: document.getElementById("microphoneOffset"),
    travelDistance: document.getElementById("travelDistance"),
    cutoffFrequency: document.getElementById("cutoffFrequency"),
    tubePhysics: document.getElementById("tubePhysics"),
    audioInput: document.getElementById("audioInput"),
    findMicrophonesBtn: document.getElementById("findMicrophonesBtn"),
    inputHint: document.getElementById("inputHint"),
    recordBtn: document.getElementById("recordBtn"),
    status: document.getElementById("status"),
    themeToggle: document.getElementById("themeToggle"),
    canvas: document.getElementById("waveform"),
    emptyWave: document.getElementById("emptyWave"),
    zoomInBtn: document.getElementById("zoomInBtn"),
    zoomOutBtn: document.getElementById("zoomOutBtn"),
    fitBtn: document.getElementById("fitBtn"),
    sensitivity: document.getElementById("sensitivity"),
    sensitivityValue: document.getElementById("sensitivityValue"),
    cropModeBtn: document.getElementById("cropModeBtn"),
    applyCropBtn: document.getElementById("applyCropBtn"),
    undoCropBtn: document.getElementById("undoCropBtn"),
    showFullBtn: document.getElementById("showFullBtn"),
    cursorABtn: document.getElementById("cursorABtn"),
    cursorBBtn: document.getElementById("cursorBBtn"),
    cursorATime: document.getElementById("cursorATime"),
    cursorBTime: document.getElementById("cursorBTime"),
    deltaTime: document.getElementById("deltaTime"),
    liveSpeed: document.getElementById("liveSpeed"),
    sampleRate: document.getElementById("sampleRate"),
    sampleInterval: document.getElementById("sampleInterval"),
    waveScrollRow: document.getElementById("waveScrollRow"),
    waveScrollbar: document.getElementById("waveScrollbar"),
    waveScrollThumb: document.getElementById("waveScrollThumb"),
    trialRows: document.getElementById("trialRows"),
    completedTrials: document.getElementById("completedTrials"),
    averageTime: document.getElementById("averageTime"),
    experimentalSpeed: document.getElementById("experimentalSpeed"),
    acceptedSpeed: document.getElementById("acceptedSpeed"),
    percentageDifference: document.getElementById("percentageDifference"),
    resultsMessage: document.getElementById("resultsMessage"),
    resetBtn: document.getElementById("resetBtn"),
  };

  const context = ui.canvas.getContext("2d");
  const state = {
    samples: null,
    sampleRate: 0,
    recording: false,
    cursorA: null,
    cursorB: null,
    activeCursor: "A",
    domainStart: 0,
    domainEnd: 0,
    viewStart: 0,
    viewEnd: 0,
    cropHistory: [],
    cropSelection: null,
    cropMode: false,
    interaction: null,
    scrollInteraction: null,
    displayGain: 8,
    plot: null,
    trialTimes: Array(TRIAL_COUNT).fill(null),
    audioContext: null,
    mediaStream: null,
    audioNodes: [],
  };

  function setStatus(message, type) {
    ui.status.textContent = message;
    ui.status.className = `status ${type || "info"}`;
  }

  function applyTheme(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    ui.themeToggle.textContent = nextTheme === "dark" ? "Light mode" : "Dark mode";
    ui.themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));
    try { localStorage.setItem("speed-sound-theme", nextTheme); } catch (_) { /* storage may be unavailable */ }
    drawWaveform();
  }

  function canvasColour(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function parseInput(input) {
    const value = Number.parseFloat(input.value);
    return Number.isFinite(value) ? value : NaN;
  }

  function experimentInputsValid() {
    const offsetMillimetres = ui.microphoneOffset.value.trim() === "" ? 0 : parseInput(ui.microphoneOffset);
    return parseInput(ui.tubeLength) > 0 && Number.isFinite(parseInput(ui.temperature)) && Number.isFinite(offsetMillimetres) && offsetMillimetres >= 0;
  }

  function microphoneOffsetMetres() {
    if (ui.microphoneOffset.value.trim() === "") return 0;
    return parseInput(ui.microphoneOffset) / 1000;
  }

  function updateTubePhysics() {
    const length = parseInput(ui.tubeLength);
    const offset = microphoneOffsetMetres();
    const distance = M.roundTripDistance(length, offset);
    ui.travelDistance.textContent = Number.isFinite(distance) ? `${distance.toFixed(3)} m` : "2(L + x)";

    const diameterMillimetres = parseInput(ui.tubeDiameter);
    const accepted = M.acceptedSpeed(parseInput(ui.temperature));
    const referenceSpeed = Number.isFinite(accepted) && accepted > 0 ? accepted : 343;
    const cutoff = M.planeWaveCutoff(diameterMillimetres / 1000, referenceSpeed);
    ui.cutoffFrequency.textContent = Number.isFinite(cutoff) ? `${(cutoff / 1000).toFixed(2)} kHz` : "Enter diameter";

    if (ui.tubeDiameter.value.trim() === "") {
      ui.tubePhysics.textContent = "Diameter is optional. Enter it to estimate the frequency above which higher-order tube modes may distort the echo.";
      ui.tubePhysics.className = "physics-note";
    } else if (!Number.isFinite(diameterMillimetres) || diameterMillimetres <= 0) {
      ui.tubePhysics.textContent = "Enter a positive internal diameter, measured across the inside of the tube.";
      ui.tubePhysics.className = "physics-note warning";
    } else {
      ui.tubePhysics.textContent = `Below approximately ${(cutoff / 1000).toFixed(2)} kHz, only the plane-wave mode propagates. Higher frequencies may broaden or split a sharp echo; diameter is not added to the closed-end distance.`;
      ui.tubePhysics.className = "physics-note";
    }
  }

  function secureAudioContextAvailable() {
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
    return (window.isSecureContext || localHost) && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext);
  }

  async function populateAudioInputs(preferredDeviceId) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
    const previous = preferredDeviceId !== undefined ? preferredDeviceId : ui.audioInput.value;
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput");
    ui.audioInput.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "System default microphone";
    ui.audioInput.appendChild(defaultOption);
    devices.forEach((device, index) => {
      if (!device.deviceId || device.deviceId === "default") return;
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || `Microphone ${index + 1}`;
      ui.audioInput.appendChild(option);
    });
    const matchingOption = Array.from(ui.audioInput.options).some((option) => option.value === previous);
    ui.audioInput.value = matchingOption ? previous : "";
    return devices;
  }

  async function discoverAudioInputs() {
    if (!secureAudioContextAvailable()) {
      setStatus("Microphone discovery requires HTTPS or localhost in a supported browser.", "error");
      return;
    }
    ui.findMicrophonesBtn.disabled = true;
    ui.findMicrophonesBtn.textContent = "Finding…";
    let stream = null;
    try {
      setStatus("Requesting microphone permission to identify available inputs…", "info");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const devices = await populateAudioInputs(ui.audioInput.value);
      const selectableCount = devices.filter((device) => device.deviceId && device.deviceId !== "default").length;
      setStatus(`${selectableCount || devices.length} microphone input${(selectableCount || devices.length) === 1 ? "" : "s"} available. Choose an input before recording.`, "success");
    } catch (error) {
      setStatus(microphoneErrorMessage(error), "error");
    } finally {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      ui.findMicrophonesBtn.disabled = false;
      ui.findMicrophonesBtn.textContent = "Find microphones";
    }
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function runCountdown() {
    for (let count = 3; count >= 1; count -= 1) {
      setStatus(`Get ready… recording starts in ${count}`, "countdown");
      await wait(1000);
    }
  }

  function createSilentSink(audioContext) {
    const sink = audioContext.createGain();
    sink.gain.value = 0;
    sink.connect(audioContext.destination);
    state.audioNodes.push(sink);
    return sink;
  }

  function createHighRateAudioContext(AudioContextClass) {
    try {
      return new AudioContextClass({ sampleRate: PREFERRED_SAMPLE_RATE, latencyHint: "interactive" });
    } catch (_) {
      return new AudioContextClass({ latencyHint: "interactive" });
    }
  }

  async function captureWithWorklet(audioContext, source, sampleLimit) {
    await audioContext.audioWorklet.addModule("recorder-worklet.js");
    const recorder = new AudioWorkletNode(audioContext, "exact-recorder", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { sampleLimit },
    });
    const sink = createSilentSink(audioContext);
    state.audioNodes.push(recorder);

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("The microphone capture timed out.")), 5000);
      recorder.port.onmessage = (event) => {
        if (!event.data || event.data.type !== "complete") return;
        window.clearTimeout(timeout);
        resolve(new Float32Array(event.data.samples));
      };
      recorder.onprocessorerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("The audio recorder stopped unexpectedly."));
      };
      source.connect(recorder);
      recorder.connect(sink);
    });
  }

  function captureWithScriptProcessor(audioContext, source, sampleLimit) {
    const buffer = new Float32Array(sampleLimit);
    let offset = 0;
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const sink = createSilentSink(audioContext);
    state.audioNodes.push(processor);

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("The microphone capture timed out.")), 5000);
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const count = Math.min(input.length, sampleLimit - offset);
        buffer.set(input.subarray(0, count), offset);
        offset += count;
        if (offset >= sampleLimit) {
          window.clearTimeout(timeout);
          processor.onaudioprocess = null;
          resolve(buffer);
        }
      };
      try {
        source.connect(processor);
        processor.connect(sink);
      } catch (error) {
        window.clearTimeout(timeout);
        reject(error);
      }
    });
  }

  async function cleanupAudio() {
    state.audioNodes.forEach((node) => {
      try { node.disconnect(); } catch (_) { /* already disconnected */ }
    });
    state.audioNodes = [];

    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach((track) => track.stop());
      state.mediaStream = null;
    }
    if (state.audioContext && state.audioContext.state !== "closed") {
      try { await state.audioContext.close(); } catch (_) { /* browser is closing */ }
    }
    state.audioContext = null;
  }

  async function recordExactTwoSeconds() {
    if (!secureAudioContextAvailable()) {
      throw new Error("Microphone recording needs a current browser on HTTPS or localhost.");
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    setStatus("Requesting microphone access…", "info");
    const selectedDeviceId = ui.audioInput.value;
    const audioConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
      sampleRate: { ideal: PREFERRED_SAMPLE_RATE },
    };
    if (selectedDeviceId) audioConstraints.deviceId = { exact: selectedDeviceId };
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false,
    });
    state.mediaStream = stream;
    await populateAudioInputs(selectedDeviceId);
    const inputLabel = stream.getAudioTracks()[0] && stream.getAudioTracks()[0].label ? stream.getAudioTracks()[0].label : "selected microphone";

    const audioContext = createHighRateAudioContext(AudioContextClass);
    state.audioContext = audioContext;
    await audioContext.resume();
    const source = audioContext.createMediaStreamSource(stream);
    state.audioNodes.push(source);

    await runCountdown();
    await audioContext.resume();
    const sampleLimit = Math.round(audioContext.sampleRate * RECORD_SECONDS);
    setStatus("Recording now — make one sharp snap or click!", "countdown");

    if (audioContext.audioWorklet && typeof window.AudioWorkletNode === "function") {
      try {
        return { samples: await captureWithWorklet(audioContext, source, sampleLimit), sampleRate: audioContext.sampleRate, inputLabel };
      } catch (error) {
        const moduleFailure = /module|load|fetch|worklet/i.test(String(error && error.message));
        if (!moduleFailure) throw error;
      }
    }
    return { samples: await captureWithScriptProcessor(audioContext, source, sampleLimit), sampleRate: audioContext.sampleRate, inputLabel };
  }

  function initialiseCapture(samples, sampleRate) {
    state.samples = samples;
    state.sampleRate = sampleRate;
    state.domainStart = 0;
    state.domainEnd = samples.length;
    state.viewStart = 0;
    state.viewEnd = samples.length;
    state.cropHistory = [];
    state.cropSelection = null;
    state.cropMode = false;
    state.scrollInteraction = null;
    state.cursorA = Math.round(samples.length * 0.25);
    state.cursorB = Math.round(samples.length * 0.5);
    state.activeCursor = "A";
    ui.emptyWave.classList.add("hidden");
    updateModeButtons();
    updateControls();
    updateReadouts();
    resizeCanvas();
  }

  function microphoneErrorMessage(error) {
    if (!error) return "The microphone could not be started.";
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "Microphone access was denied. Allow microphone access for this site, then try again.";
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") return "No microphone was found on this device.";
    if (error.name === "NotReadableError" || error.name === "TrackStartError") return "The microphone is busy or unavailable. Close other audio apps and try again.";
    return error.message || "The microphone recording failed. Please try again.";
  }

  async function handleRecord() {
    if (state.recording) return;
    state.recording = true;
    ui.recordBtn.disabled = true;
    ui.recordBtn.classList.add("recording");
    ui.recordBtn.textContent = "Preparing…";
    try {
      const capture = await recordExactTwoSeconds();
      initialiseCapture(capture.samples, capture.sampleRate);
      const resolution = 1000000 / capture.sampleRate;
      const rateLabel = capture.sampleRate >= 1000 ? `${(capture.sampleRate / 1000).toFixed(capture.sampleRate % 1000 ? 1 : 0)} kHz` : `${capture.sampleRate} Hz`;
      setStatus(`Captured ${capture.samples.length.toLocaleString()} samples from ${capture.inputLabel} at ${rateLabel} — ${resolution.toFixed(2)} µs per sample. Drag the cursors to measure the echo.`, "success");
    } catch (error) {
      setStatus(microphoneErrorMessage(error), "error");
    } finally {
      await cleanupAudio();
      state.recording = false;
      ui.recordBtn.disabled = false;
      ui.recordBtn.classList.remove("recording");
      ui.recordBtn.textContent = "Record 2 seconds";
    }
  }

  function formatMilliseconds(seconds, digits) {
    return Number.isFinite(seconds) ? `${(seconds * 1000).toFixed(digits)} ms` : "—";
  }

  function currentDeltaSeconds() {
    if (!state.samples || state.cursorA === null || state.cursorB === null) return NaN;
    return M.secondsFromSamples(state.cursorB - state.cursorA, state.sampleRate);
  }

  function updateReadouts() {
    if (!state.samples) {
      ui.cursorATime.textContent = "—";
      ui.cursorBTime.textContent = "—";
      ui.deltaTime.textContent = "—";
      ui.liveSpeed.textContent = "—";
      ui.sampleRate.textContent = "—";
      ui.sampleInterval.textContent = "—";
      return;
    }
    ui.cursorATime.textContent = formatMilliseconds(state.cursorA / state.sampleRate, 3);
    ui.cursorBTime.textContent = formatMilliseconds(state.cursorB / state.sampleRate, 3);
    ui.deltaTime.textContent = formatMilliseconds(currentDeltaSeconds(), 3);
    ui.sampleRate.textContent = `${state.sampleRate.toLocaleString()} Hz`;
    ui.sampleInterval.textContent = `${(1000000 / state.sampleRate).toFixed(2)} µs/sample`;
    renderTrials();
  }

  function setActiveCursor(cursor) {
    state.activeCursor = cursor;
    ui.cursorABtn.classList.toggle("active", cursor === "A");
    ui.cursorBBtn.classList.toggle("active", cursor === "B");
    ui.cursorABtn.setAttribute("aria-pressed", String(cursor === "A"));
    ui.cursorBBtn.setAttribute("aria-pressed", String(cursor === "B"));
  }

  function updateModeButtons() {
    ui.cropModeBtn.setAttribute("aria-pressed", String(state.cropMode));
    ui.canvas.style.cursor = state.cropMode ? "col-resize" : "crosshair";
  }

  function updateControls() {
    const hasCapture = Boolean(state.samples);
    const hasZoom = hasCapture && (state.viewStart > state.domainStart || state.viewEnd < state.domainEnd);
    const cropped = hasCapture && (state.domainStart > 0 || state.domainEnd < state.samples.length);
    [ui.zoomInBtn, ui.zoomOutBtn, ui.fitBtn, ui.cropModeBtn, ui.showFullBtn, ui.cursorABtn, ui.cursorBBtn, ui.sensitivity].forEach((control) => { control.disabled = !hasCapture; });
    ui.applyCropBtn.disabled = !hasCapture || !state.cropSelection || Math.abs(state.cropSelection.end - state.cropSelection.start) < 16;
    ui.undoCropBtn.disabled = !hasCapture || state.cropHistory.length === 0;
    ui.fitBtn.disabled = !hasCapture || !hasZoom;
    ui.zoomOutBtn.disabled = !hasCapture || !hasZoom;
    ui.showFullBtn.disabled = !hasCapture || !cropped;
    updateWaveScrollbar();
  }

  function scrollbarGeometry() {
    const rect = ui.waveScrollbar.getBoundingClientRect();
    const domainSpan = state.domainEnd - state.domainStart;
    const viewSpan = state.viewEnd - state.viewStart;
    const innerWidth = Math.max(0, rect.width - 4);
    const thumbWidth = domainSpan > 0 ? Math.min(innerWidth, Math.max(36, innerWidth * (viewSpan / domainSpan))) : innerWidth;
    const travel = Math.max(0, innerWidth - thumbWidth);
    const availableSamples = Math.max(0, domainSpan - viewSpan);
    const position = availableSamples > 0 ? ((state.viewStart - state.domainStart) / availableSamples) * travel : 0;
    return { rect, viewSpan, thumbWidth, travel, availableSamples, position };
  }

  function updateWaveScrollbar() {
    const canScroll = Boolean(state.samples) && state.viewEnd - state.viewStart < state.domainEnd - state.domainStart;
    ui.waveScrollRow.hidden = !canScroll;
    if (!canScroll) return;
    const geometry = scrollbarGeometry();
    ui.waveScrollThumb.style.width = `${geometry.thumbWidth}px`;
    ui.waveScrollThumb.style.transform = `translateX(${geometry.position}px)`;
    const startMs = (state.viewStart / state.sampleRate) * 1000;
    const endMs = (state.viewEnd / state.sampleRate) * 1000;
    const maximumStartMs = ((state.domainEnd - geometry.viewSpan) / state.sampleRate) * 1000;
    ui.waveScrollbar.setAttribute("aria-valuemin", (state.domainStart / state.sampleRate * 1000).toFixed(3));
    ui.waveScrollbar.setAttribute("aria-valuemax", maximumStartMs.toFixed(3));
    ui.waveScrollbar.setAttribute("aria-valuenow", startMs.toFixed(3));
    ui.waveScrollbar.setAttribute("aria-valuetext", `Showing ${startMs.toFixed(1)} to ${endMs.toFixed(1)} milliseconds`);
  }

  function setViewStart(nextStart) {
    if (!state.samples) return;
    const span = state.viewEnd - state.viewStart;
    const start = Math.round(M.clamp(nextStart, state.domainStart, state.domainEnd - span));
    state.viewStart = start;
    state.viewEnd = start + span;
    updateControls();
    drawWaveform();
  }

  function resizeCanvas() {
    const rect = ui.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    ui.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    ui.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWaveform();
    updateWaveScrollbar();
  }

  function sampleToX(sample) {
    if (!state.plot || state.viewEnd <= state.viewStart) return 0;
    return state.plot.left + ((sample - state.viewStart) / (state.viewEnd - state.viewStart)) * state.plot.width;
  }

  function xToSample(x) {
    const fraction = (x - state.plot.left) / state.plot.width;
    return M.sampleFromFraction(fraction, state.viewStart, state.viewEnd);
  }

  function drawGrid(width, height) {
    context.fillStyle = canvasColour("--canvas-bg");
    context.fillRect(0, 0, width, height);
    const plot = state.plot;
    context.lineWidth = 1;
    context.font = "12px system-ui, sans-serif";
    context.textBaseline = "middle";

    for (let i = 0; i <= 10; i += 1) {
      const x = plot.left + (i / 10) * plot.width;
      context.strokeStyle = i === 0 || i === 10 || i === 5 ? canvasColour("--canvas-grid-strong") : canvasColour("--canvas-grid");
      context.beginPath();
      context.moveTo(x, plot.top);
      context.lineTo(x, plot.bottom);
      context.stroke();
      if (state.samples) {
        const sample = state.viewStart + (i / 10) * (state.viewEnd - state.viewStart);
        const timeMs = (sample / state.sampleRate) * 1000;
        context.fillStyle = canvasColour("--canvas-label");
        context.textAlign = i === 0 ? "left" : i === 10 ? "right" : "center";
        context.fillText(`${timeMs.toFixed(timeMs < 100 ? 1 : 0)} ms`, x, plot.bottom + 22);
      }
    }

    const yValues = [1, 0.5, 0, -0.5, -1];
    yValues.forEach((value) => {
      const y = plot.top + ((1 - value) / 2) * plot.height;
      context.strokeStyle = value === 0 ? canvasColour("--canvas-grid-strong") : canvasColour("--canvas-grid");
      context.beginPath();
      context.moveTo(plot.left, y);
      context.lineTo(plot.right, y);
      context.stroke();
      context.fillStyle = canvasColour("--canvas-label");
      context.textAlign = "right";
      context.fillText(value.toFixed(value === 0 ? 0 : 1), plot.left - 9, y);
    });

    context.save();
    context.translate(14, plot.top + plot.height / 2);
    context.rotate(-Math.PI / 2);
    context.fillStyle = canvasColour("--canvas-label");
    context.textAlign = "center";
    context.fillText("Relative amplitude", 0, 0);
    context.restore();
  }

  function drawEnvelope() {
    const plot = state.plot;
    const pixelColumns = Math.max(1, Math.floor(plot.width));
    const sampleSpan = state.viewEnd - state.viewStart;
    const midY = plot.top + plot.height / 2;
    const scaleY = plot.height * 0.46;

    context.strokeStyle = canvasColour("--wave-colour");
    context.lineWidth = 1.25;
    context.beginPath();
    for (let column = 0; column < pixelColumns; column += 1) {
      const first = Math.floor(state.viewStart + (column / pixelColumns) * sampleSpan);
      const last = Math.max(first + 1, Math.floor(state.viewStart + ((column + 1) / pixelColumns) * sampleSpan));
      let minimum = 1;
      let maximum = -1;
      for (let index = first; index < Math.min(last, state.samples.length); index += 1) {
        const value = M.clamp(state.samples[index] * state.displayGain, -1, 1);
        if (value < minimum) minimum = value;
        if (value > maximum) maximum = value;
      }
      const x = plot.left + column + 0.5;
      context.moveTo(x, midY - maximum * scaleY);
      context.lineTo(x, midY - minimum * scaleY);
    }
    context.stroke();
  }

  function drawCropSelection() {
    if (!state.cropSelection) return;
    const plot = state.plot;
    const start = Math.min(state.cropSelection.start, state.cropSelection.end);
    const end = Math.max(state.cropSelection.start, state.cropSelection.end);
    const x1 = sampleToX(start);
    const x2 = sampleToX(end);
    context.fillStyle = canvasColour("--crop-fill");
    context.fillRect(x1, plot.top, x2 - x1, plot.height);
    context.strokeStyle = canvasColour("--cursor-a");
    context.lineWidth = 2;
    [x1, x2].forEach((x) => {
      context.beginPath();
      context.moveTo(x, plot.top);
      context.lineTo(x, plot.bottom);
      context.stroke();
      context.fillStyle = canvasColour("--cursor-a");
      context.fillRect(x - 4, plot.top + 8, 8, 24);
    });
  }

  function drawCursor(sample, label, color) {
    if (sample < state.viewStart || sample >= state.viewEnd) return;
    const x = sampleToX(sample);
    const plot = state.plot;
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.setLineDash([6, 5]);
    context.beginPath();
    context.moveTo(x, plot.top);
    context.lineTo(x, plot.bottom);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = color;
    context.fillRect(x - 12, plot.top + 5, 24, 22);
    context.fillStyle = canvasColour("--cursor-text");
    context.font = "bold 12px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, x, plot.top + 16);
  }

  function drawWaveform() {
    const rect = ui.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (!width || !height) return;
    state.plot = { left: 62, right: width - 18, top: 19, bottom: height - 44 };
    state.plot.width = Math.max(10, state.plot.right - state.plot.left);
    state.plot.height = Math.max(10, state.plot.bottom - state.plot.top);
    drawGrid(width, height);
    if (!state.samples) return;
    drawEnvelope();
    drawCropSelection();
    drawCursor(state.cursorA, "A", canvasColour("--cursor-a"));
    drawCursor(state.cursorB, "B", canvasColour("--cursor-b"));
  }

  function pointerPosition(event) {
    const rect = ui.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function insidePlot(position) {
    return position.x >= state.plot.left && position.x <= state.plot.right && position.y >= state.plot.top && position.y <= state.plot.bottom;
  }

  function handlePointerDown(event) {
    if (!state.samples || !state.plot) return;
    const position = pointerPosition(event);
    if (!insidePlot(position)) return;
    ui.canvas.setPointerCapture(event.pointerId);
    const sample = xToSample(position.x);

    if (state.cropMode) {
      const selection = state.cropSelection;
      const edgeTolerance = 15;
      if (selection && Math.abs(position.x - sampleToX(selection.start)) <= edgeTolerance) {
        state.interaction = { type: "crop-start" };
      } else if (selection && Math.abs(position.x - sampleToX(selection.end)) <= edgeTolerance) {
        state.interaction = { type: "crop-end" };
      } else {
        state.cropSelection = { start: sample, end: sample };
        state.interaction = { type: "crop-end" };
      }
    } else {
      const distanceA = Math.abs(position.x - sampleToX(state.cursorA));
      const distanceB = Math.abs(position.x - sampleToX(state.cursorB));
      let cursor = state.activeCursor;
      if (Math.min(distanceA, distanceB) <= 22) cursor = distanceA <= distanceB ? "A" : "B";
      setActiveCursor(cursor);
      state[`cursor${cursor}`] = sample;
      state.interaction = { type: "cursor", cursor };
      updateReadouts();
    }
    updateControls();
    drawWaveform();
    event.preventDefault();
  }

  function handlePointerMove(event) {
    if (!state.interaction || !state.samples) return;
    const position = pointerPosition(event);
    const sample = xToSample(position.x);
    const interaction = state.interaction;

    if (interaction.type === "cursor") {
      state[`cursor${interaction.cursor}`] = sample;
      updateReadouts();
    } else if (interaction.type === "crop-start") {
      state.cropSelection.start = sample;
    } else if (interaction.type === "crop-end") {
      state.cropSelection.end = sample;
    }
    updateControls();
    drawWaveform();
    event.preventDefault();
  }

  function endPointerInteraction(event) {
    if (!state.interaction) return;
    state.interaction = null;
    try { ui.canvas.releasePointerCapture(event.pointerId); } catch (_) { /* capture already released */ }
    updateControls();
  }

  function zoom(factor) {
    if (!state.samples) return;
    const currentSpan = state.viewEnd - state.viewStart;
    const domainSpan = state.domainEnd - state.domainStart;
    const nextSpan = Math.round(M.clamp(currentSpan * factor, Math.min(MIN_VIEW_SAMPLES, domainSpan), domainSpan));
    const centre = (state.viewStart + state.viewEnd) / 2;
    let start = Math.round(centre - nextSpan / 2);
    start = M.clamp(start, state.domainStart, state.domainEnd - nextSpan);
    state.viewStart = start;
    state.viewEnd = start + nextSpan;
    updateControls();
    drawWaveform();
  }

  function applyCrop() {
    if (!state.cropSelection) return;
    const start = Math.max(state.domainStart, Math.min(state.cropSelection.start, state.cropSelection.end));
    const end = Math.min(state.domainEnd, Math.max(state.cropSelection.start, state.cropSelection.end) + 1);
    if (end - start < 16) return;
    state.cropHistory.push({ start: state.domainStart, end: state.domainEnd });
    state.domainStart = start;
    state.domainEnd = end;
    state.viewStart = start;
    state.viewEnd = end;
    state.cropSelection = null;
    state.cropMode = false;
    updateModeButtons();
    updateControls();
    drawWaveform();
    setStatus("Crop applied. The original two-second capture is still available with Show full or Undo crop.", "success");
  }

  function undoCrop() {
    const previous = state.cropHistory.pop();
    if (!previous) return;
    state.domainStart = previous.start;
    state.domainEnd = previous.end;
    state.viewStart = previous.start;
    state.viewEnd = previous.end;
    state.cropSelection = null;
    updateControls();
    drawWaveform();
  }

  function showFullCapture() {
    if (!state.samples) return;
    if (state.domainStart !== 0 || state.domainEnd !== state.samples.length) {
      state.cropHistory.push({ start: state.domainStart, end: state.domainEnd });
    }
    state.domainStart = 0;
    state.domainEnd = state.samples.length;
    state.viewStart = 0;
    state.viewEnd = state.samples.length;
    state.cropSelection = null;
    updateControls();
    drawWaveform();
  }

  function toggleCropMode() {
    if (!state.samples) return;
    state.cropMode = !state.cropMode;
    updateModeButtons();
  }

  function moveScrollbarFromPointer(event) {
    if (!state.scrollInteraction || !state.samples) return;
    const geometry = scrollbarGeometry();
    if (geometry.travel <= 0 || geometry.availableSamples <= 0) return;
    const localX = event.clientX - geometry.rect.left - 2 - state.scrollInteraction.dragOffset;
    const fraction = M.clamp(localX / geometry.travel, 0, 1);
    setViewStart(state.domainStart + fraction * geometry.availableSamples);
  }

  function handleScrollbarPointerDown(event) {
    if (ui.waveScrollRow.hidden || !state.samples) return;
    const geometry = scrollbarGeometry();
    const localX = event.clientX - geometry.rect.left - 2;
    const onThumb = event.target === ui.waveScrollThumb;
    const dragOffset = onThumb ? localX - geometry.position : geometry.thumbWidth / 2;
    state.scrollInteraction = { dragOffset };
    ui.waveScrollbar.setPointerCapture(event.pointerId);
    moveScrollbarFromPointer(event);
    event.preventDefault();
  }

  function handleScrollbarPointerMove(event) {
    if (!state.scrollInteraction) return;
    moveScrollbarFromPointer(event);
    event.preventDefault();
  }

  function endScrollbarInteraction(event) {
    if (!state.scrollInteraction) return;
    state.scrollInteraction = null;
    try { ui.waveScrollbar.releasePointerCapture(event.pointerId); } catch (_) { /* capture already released */ }
  }

  function handleScrollbarKey(event) {
    if (ui.waveScrollRow.hidden || !state.samples) return;
    const span = state.viewEnd - state.viewStart;
    let nextStart = state.viewStart;
    if (event.key === "ArrowLeft") nextStart -= Math.max(1, Math.round(span * 0.05));
    else if (event.key === "ArrowRight") nextStart += Math.max(1, Math.round(span * 0.05));
    else if (event.key === "PageUp") nextStart -= Math.max(1, Math.round(span * 0.8));
    else if (event.key === "PageDown") nextStart += Math.max(1, Math.round(span * 0.8));
    else if (event.key === "Home") nextStart = state.domainStart;
    else if (event.key === "End") nextStart = state.domainEnd - span;
    else return;
    setViewStart(nextStart);
    event.preventDefault();
  }

  function handleCanvasKey(event) {
    if (!state.samples) return;
    if (event.key.toLowerCase() === "a") setActiveCursor("A");
    else if (event.key.toLowerCase() === "b") setActiveCursor("B");
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const step = event.ctrlKey || event.metaKey ? 100 : event.shiftKey ? 10 : 1;
      const property = `cursor${state.activeCursor}`;
      state[property] = M.clamp(state[property] + direction * step, 0, state.samples.length - 1);
      updateReadouts();
      drawWaveform();
    } else return;
    event.preventDefault();
  }

  function renderTrials() {
    const delta = currentDeltaSeconds();
    const canSave = Number.isFinite(delta) && delta > 0 && experimentInputsValid();
    const tubeLength = parseInput(ui.tubeLength);
    const offset = microphoneOffsetMetres();
    const liveSpeed = M.trialSpeed(tubeLength, delta, offset);
    ui.liveSpeed.textContent = Number.isFinite(liveSpeed) ? `${liveSpeed.toFixed(1)} m/s` : "—";
    updateTubePhysics();
    ui.trialRows.innerHTML = "";

    state.trialTimes.forEach((time, index) => {
      const row = document.createElement("tr");
      const speed = M.trialSpeed(tubeLength, time, offset);
      row.innerHTML = `
        <td class="trial-number">${index + 1}</td>
        <td class="trial-value">${Number.isFinite(time) ? formatMilliseconds(time, 3) : "—"}</td>
        <td class="trial-value">${Number.isFinite(speed) ? `${speed.toFixed(1)} m/s` : "—"}</td>
        <td><div class="trial-actions"><button class="button save-trial" type="button" data-trial="${index}" ${canSave ? "" : "disabled"}>${Number.isFinite(time) ? "Replace" : "Use current Δt"}</button><button class="button clear-trial" type="button" data-trial="${index}" ${Number.isFinite(time) ? "" : "disabled"}>Clear</button></div></td>`;
      ui.trialRows.appendChild(row);
    });

    const completed = state.trialTimes.filter(Number.isFinite);
    const averageTime = M.average(completed);
    const experimental = M.trialSpeed(tubeLength, averageTime, offset);
    const accepted = M.acceptedSpeed(parseInput(ui.temperature));
    const difference = M.percentageDifference(experimental, accepted);

    ui.completedTrials.textContent = `${completed.length} / ${TRIAL_COUNT}`;
    ui.averageTime.textContent = formatMilliseconds(averageTime, 3);
    ui.experimentalSpeed.textContent = Number.isFinite(experimental) ? `${experimental.toFixed(1)} m/s` : "—";
    ui.acceptedSpeed.textContent = Number.isFinite(accepted) ? `${accepted.toFixed(1)} m/s` : "—";
    ui.percentageDifference.textContent = Number.isFinite(difference) ? `${difference.toFixed(1)}%` : "—";

    if (!experimentInputsValid()) {
      ui.inputHint.textContent = "Enter a positive tube length, room temperature, and a valid non-negative microphone offset.";
      ui.resultsMessage.textContent = "Experiment details are required before a measurement can be saved.";
    } else if (!Number.isFinite(delta) || delta <= 0) {
      ui.inputHint.textContent = "Experiment details are ready.";
      ui.resultsMessage.textContent = "Record a waveform and separate cursors A and B to produce an echo interval.";
    } else if (completed.length < TRIAL_COUNT) {
      ui.inputHint.textContent = "Experiment details are ready.";
      ui.resultsMessage.textContent = `Current Δt is ${formatMilliseconds(delta, 3)}. Save it into a trial row.`;
    } else {
      ui.inputHint.textContent = "Experiment details are ready.";
      ui.resultsMessage.textContent = "All five trials are complete. Compare the experimental and accepted speeds.";
    }
  }

  function saveTrial(index) {
    const delta = currentDeltaSeconds();
    if (!experimentInputsValid() || !Number.isFinite(delta) || delta <= 0) return;
    state.trialTimes[index] = delta;
    renderTrials();
  }

  function clearTrial(index) {
    state.trialTimes[index] = null;
    renderTrials();
  }

  function resetExperiment() {
    if (!window.confirm("Clear the recording, experiment details, cursors, and all five trials?")) return;
    state.samples = null;
    state.sampleRate = 0;
    state.cursorA = null;
    state.cursorB = null;
    state.domainStart = 0;
    state.domainEnd = 0;
    state.viewStart = 0;
    state.viewEnd = 0;
    state.cropHistory = [];
    state.cropSelection = null;
    state.trialTimes.fill(null);
    state.cropMode = false;
    state.scrollInteraction = null;
    state.displayGain = 8;
    ui.sensitivity.value = "8";
    ui.sensitivityValue.textContent = "8×";
    ui.tubeLength.value = "";
    ui.temperature.value = "";
    ui.tubeDiameter.value = "";
    ui.microphoneOffset.value = "0";
    ui.emptyWave.classList.remove("hidden");
    setActiveCursor("A");
    updateModeButtons();
    updateControls();
    updateReadouts();
    renderTrials();
    drawWaveform();
    setStatus("Experiment reset. Ready for a new recording.", "info");
  }

  function wireEvents() {
    ui.themeToggle.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
    ui.findMicrophonesBtn.addEventListener("click", discoverAudioInputs);
    ui.recordBtn.addEventListener("click", handleRecord);
    ui.zoomInBtn.addEventListener("click", () => zoom(0.5));
    ui.zoomOutBtn.addEventListener("click", () => zoom(2));
    ui.fitBtn.addEventListener("click", () => {
      state.viewStart = state.domainStart;
      state.viewEnd = state.domainEnd;
      updateControls();
      drawWaveform();
    });
    ui.sensitivity.addEventListener("input", () => {
      state.displayGain = Number.parseFloat(ui.sensitivity.value) || 1;
      ui.sensitivityValue.textContent = `${state.displayGain.toFixed(0)}×`;
      drawWaveform();
    });
    ui.cropModeBtn.addEventListener("click", toggleCropMode);
    ui.applyCropBtn.addEventListener("click", applyCrop);
    ui.undoCropBtn.addEventListener("click", undoCrop);
    ui.showFullBtn.addEventListener("click", showFullCapture);
    ui.cursorABtn.addEventListener("click", () => setActiveCursor("A"));
    ui.cursorBBtn.addEventListener("click", () => setActiveCursor("B"));
    ui.canvas.addEventListener("pointerdown", handlePointerDown);
    ui.canvas.addEventListener("pointermove", handlePointerMove);
    ui.canvas.addEventListener("pointerup", endPointerInteraction);
    ui.canvas.addEventListener("pointercancel", endPointerInteraction);
    ui.canvas.addEventListener("keydown", handleCanvasKey);
    ui.waveScrollbar.addEventListener("pointerdown", handleScrollbarPointerDown);
    ui.waveScrollbar.addEventListener("pointermove", handleScrollbarPointerMove);
    ui.waveScrollbar.addEventListener("pointerup", endScrollbarInteraction);
    ui.waveScrollbar.addEventListener("pointercancel", endScrollbarInteraction);
    ui.waveScrollbar.addEventListener("keydown", handleScrollbarKey);
    ui.tubeLength.addEventListener("input", renderTrials);
    ui.temperature.addEventListener("input", renderTrials);
    ui.tubeDiameter.addEventListener("input", renderTrials);
    ui.microphoneOffset.addEventListener("input", renderTrials);
    ui.trialRows.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-trial]");
      if (!button) return;
      const index = Number.parseInt(button.dataset.trial, 10);
      if (button.classList.contains("save-trial")) saveTrial(index);
      else clearTrial(index);
    });
    ui.resetBtn.addEventListener("click", resetExperiment);
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pagehide", () => { void cleanupAudio(); });
    window.addEventListener("beforeunload", () => { void cleanupAudio(); });
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", () => { void populateAudioInputs(); });
    }
  }

  if (!M || !context) {
    setStatus("The activity could not start because a required local file is missing.", "error");
    ui.recordBtn.disabled = true;
    return;
  }

  wireEvents();
  applyTheme(document.documentElement.dataset.theme);
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) { void populateAudioInputs(); }
  updateControls();
  updateReadouts();
  renderTrials();
  resizeCanvas();
  if (!secureAudioContextAvailable()) {
    setStatus("The page is ready, but microphone recording requires HTTPS or localhost in a supported browser.", "info");
  }
}());
