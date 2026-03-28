(() => {
  const canvas = document.getElementById("scope");
  const ctx = canvas?.getContext("2d") || null;

  const vPerDivInput = document.getElementById("vPerDiv");
  const tPerDivInput = document.getElementById("tPerDiv");
  const vPerDivLabel = document.getElementById("vPerDivLabel");
  const tPerDivLabel = document.getElementById("tPerDivLabel");
  const freqLabel = document.getElementById("freqLabel");
  const ampLabel = document.getElementById("ampLabel");
  const periodLabel = document.getElementById("periodLabel");
  const cursorLabel = document.getElementById("cursorLabel");
  const pauseBtn = document.getElementById("pauseBtn");
  const startBtn = document.getElementById("startBtn");
  const statusEl = document.getElementById("status");
  const readoutLiveEl = document.getElementById("readoutLive");

  const required = [
    canvas,
    vPerDivInput,
    tPerDivInput,
    vPerDivLabel,
    tPerDivLabel,
    freqLabel,
    ampLabel,
    periodLabel,
    cursorLabel,
    pauseBtn,
    startBtn,
    statusEl,
  ];

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  if (!ctx || required.some((el) => !el)) {
    console.error("Oscilloscope failed to initialize: missing DOM nodes or canvas context.");
    setStatus("Initialization failed: required UI elements are missing.");
    return;
  }

  const gridDivisions = { x: 10, y: 8 };
  const state = {
    vPerDiv: parseFloat(vPerDivInput.value),
    tPerDiv: parseFloat(tPerDivInput.value),
    paused: false,
    analyser: null,
    audioContext: null,
    mediaStream: null,
    sourceNode: null,
    data: null,
    sampleRate: 0,
    samplesToDisplay: 0,
    started: false,
    startInProgress: false,
    lastFrequency: 0,
    lastFrequencyAtMs: 0,
    lastFreqCalcAtMs: 0,
    cursor: { active: false, x: 0, y: 0 },
    readoutLastAnnouncedAtMs: 0,
  };

  const frequencyUpdateIntervalMs = 80;
  const frequencyHoldMs = 1200;
  const readoutAnnounceIntervalMs = 600;

  function isAudioCaptureSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function updateReadoutAnnouncement(freq, vpp, cursorText) {
    if (!readoutLiveEl) return;
    const now = performance.now();
    if (now - state.readoutLastAnnouncedAtMs < readoutAnnounceIntervalMs) return;
    const freqText = freq ? `${freq.toFixed(1)} hertz` : "no stable frequency";
    const vppText = vpp ? `${vpp.toFixed(3)} volts peak to peak` : "no peak to peak reading";
    readoutLiveEl.textContent = `Readout: ${freqText}; ${vppText}; ${cursorText}.`;
    state.readoutLastAnnouncedAtMs = now;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function updateLabels() {
    vPerDivLabel.textContent = `V/div: ${state.vPerDiv.toFixed(3)}`;
    tPerDivLabel.textContent = `ms/div: ${state.tPerDiv.toFixed(2)}`;
  }

  function updateFrequencyLabel(value) {
    if (!value) {
      freqLabel.textContent = "Freq: -- Hz";
      periodLabel.textContent = "Period: -- ms";
      return;
    }
    freqLabel.textContent = `Freq: ${value.toFixed(1)} Hz`;
    periodLabel.textContent = `Period: ${(1000 / value).toFixed(2)} ms`;
  }

  function updateAmplitudeLabel(value) {
    if (!value) {
      ampLabel.textContent = "Vpp: -- V";
      return;
    }
    ampLabel.textContent = `Vpp: ${value.toFixed(3)} V`;
  }

  function updateCursorLabel(text) {
    cursorLabel.textContent = text;
  }

  function updateTimebase() {
    if (!state.sampleRate || !state.analyser || !state.data) return;
    const windowMs = state.tPerDiv * gridDivisions.x;
    const desiredSamples = Math.floor((state.sampleRate * windowMs) / 1000);
    const targetSamples = Math.max(128, desiredSamples);
    let fftSize = 2048;

    while (fftSize < targetSamples) {
      fftSize *= 2;
    }

    if (fftSize > 32768) {
      fftSize = 32768;
    }

    if (state.analyser.fftSize !== fftSize) {
      state.analyser.fftSize = fftSize;
      state.data = new Float32Array(state.analyser.fftSize);
    }

    state.samplesToDisplay = Math.max(128, Math.min(desiredSamples, state.data.length));
  }

  function estimateFrequency(samples, sampleRate) {
    const length = samples.length;
    if (length < 128) return 0;

    let mean = 0;
    for (let i = 0; i < length; i += 1) {
      mean += samples[i];
    }
    mean /= length;

    let sumSquares = 0;
    for (let i = 0; i < length; i += 1) {
      const value = samples[i] - mean;
      sumSquares += value * value;
    }
    const rms = Math.sqrt(sumSquares / length);
    if (rms < 0.005) return 0;

    const minHz = 40;
    const maxHz = 3000;
    const minLag = Math.floor(sampleRate / maxHz);
    const maxLag = Math.floor(sampleRate / minHz);
    const searchMax = Math.min(maxLag, length - 1);
    let bestLag = 0;
    let bestScore = 0;

    for (let lag = minLag; lag <= searchMax; lag += 1) {
      let sum = 0;
      for (let i = 0; i < length - lag; i += 1) {
        const a = samples[i] - mean;
        const b = samples[i + lag] - mean;
        sum += a * b;
      }
      if (sum > bestScore) {
        bestScore = sum;
        bestLag = lag;
      }
    }

    if (!bestLag) return 0;
    const frequency = sampleRate / bestLag;
    if (frequency < minHz || frequency > maxHz) return 0;
    return frequency;
  }

  function drawGrid() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#0c121a";
    ctx.fillRect(0, 0, w, h);

    const xStep = w / gridDivisions.x;
    const yStep = h / gridDivisions.y;

    for (let x = 0; x <= gridDivisions.x; x += 1) {
      ctx.strokeStyle = x % 5 === 0 ? "#2b3f56" : "#1c2a3a";
      ctx.lineWidth = x % 5 === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x * xStep, 0);
      ctx.lineTo(x * xStep, h);
      ctx.stroke();
    }

    for (let y = 0; y <= gridDivisions.y; y += 1) {
      ctx.strokeStyle = y % 4 === 0 ? "#2b3f56" : "#1c2a3a";
      ctx.lineWidth = y % 4 === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(0, y * yStep);
      ctx.lineTo(w, y * yStep);
      ctx.stroke();
    }

    ctx.strokeStyle = "#31455d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }

  function drawWaveform() {
    if (!state.started) {
      drawGrid();
      requestAnimationFrame(drawWaveform);
      return;
    }

    if (!state.analyser || !state.data || !state.sampleRate) {
      requestAnimationFrame(drawWaveform);
      return;
    }

    if (!state.paused) {
      state.analyser.getFloatTimeDomainData(state.data);
    }

    drawGrid();

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const mid = h / 2;

    const samples = state.data;
    const sampleCount = state.samplesToDisplay || samples.length;
    const baseStart = Math.max(0, samples.length - sampleCount);
    let triggerIndex = -1;

    for (let i = baseStart + 1; i < samples.length; i += 1) {
      const prev = samples[i - 1];
      const curr = samples[i];
      if (prev < 0 && curr >= 0) {
        triggerIndex = i;
        break;
      }
    }

    const startIndex = triggerIndex === -1 ? baseStart : triggerIndex;
    const endIndex = Math.min(samples.length, startIndex + sampleCount);
    const view = samples.subarray(startIndex, endIndex);
    const plottedCount = view.length;

    let peak = 0;
    for (let i = 0; i < plottedCount; i += 1) {
      const value = Math.abs(view[i]);
      if (value > peak) peak = value;
    }

    if (plottedCount >= 2) {
      ctx.strokeStyle = "#00e5a8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < plottedCount; i += 1) {
        const x = (i / (plottedCount - 1)) * w;
        const volts = view[i] * (1 / state.vPerDiv);
        const y = mid - volts * (h / gridDivisions.y);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const now = performance.now();
    if (!state.paused && plottedCount >= 128 && now - state.lastFreqCalcAtMs >= frequencyUpdateIntervalMs) {
      const freq = estimateFrequency(view, state.sampleRate);
      state.lastFreqCalcAtMs = now;
      if (freq > 0) {
        state.lastFrequency = freq;
        state.lastFrequencyAtMs = now;
      }
    }

    let displayedFreq = 0;
    if (state.paused) {
      displayedFreq = state.lastFrequency;
    } else if (state.lastFrequencyAtMs && now - state.lastFrequencyAtMs <= frequencyHoldMs) {
      displayedFreq = state.lastFrequency;
    }
    updateFrequencyLabel(displayedFreq);

    let vpp = 0;
    if (peak > 0) {
      vpp = 2 * peak * state.vPerDiv;
      updateAmplitudeLabel(vpp);
    } else {
      updateAmplitudeLabel(0);
    }

    let cursorText = "Cursor: --";
    if (state.paused && state.cursor.active && plottedCount > 0) {
      const cursorY = Math.max(0, Math.min(h, state.cursor.y));
      const cursorX = Math.max(0, Math.min(w, state.cursor.x));

      ctx.strokeStyle = "#1dbb8e";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, cursorY);
      ctx.lineTo(w, cursorY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, h);
      ctx.stroke();
      ctx.setLineDash([]);

      const voltage = (mid - cursorY) * (gridDivisions.y / h) * state.vPerDiv;
      const durationMs = (plottedCount / state.sampleRate) * 1000;
      const timeMs = (cursorX / w) * durationMs;
      cursorText = `Cursor: ${timeMs.toFixed(2)} ms, ${voltage.toFixed(3)} V`;
    }
    updateCursorLabel(cursorText);
    updateReadoutAnnouncement(displayedFreq, vpp, cursorText.replace("Cursor: ", "cursor "));

    requestAnimationFrame(drawWaveform);
  }

  async function initAudio() {
    let audioContext = null;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await audioContext.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      state.audioContext = audioContext;
      state.mediaStream = stream;
      state.sourceNode = source;
      state.analyser = analyser;
      state.data = new Float32Array(analyser.fftSize);
      state.sampleRate = audioContext.sampleRate;
      state.lastFrequency = 0;
      state.lastFrequencyAtMs = 0;
      state.lastFreqCalcAtMs = 0;
      state.cursor.active = false;

      updateTimebase();
      pauseBtn.disabled = false;
      setStatus("Live audio running.");
      return true;
    } catch (err) {
      if (audioContext && audioContext.state !== "closed") {
        try {
          await audioContext.close();
        } catch {}
      }
      state.audioContext = null;
      state.mediaStream = null;
      state.sourceNode = null;
      state.analyser = null;
      state.data = null;
      state.sampleRate = 0;
      pauseBtn.disabled = true;
      state.paused = false;
      pauseBtn.classList.remove("active");
      pauseBtn.textContent = "Pause";
      setStatus("Microphone access denied or unavailable.");
      console.warn("Audio initialization failed", err);
      return false;
    }
  }

  async function teardownAudio() {
    if (state.sourceNode) {
      try {
        state.sourceNode.disconnect();
      } catch {}
    }

    if (state.analyser) {
      try {
        state.analyser.disconnect();
      } catch {}
    }

    if (state.mediaStream) {
      for (const track of state.mediaStream.getTracks()) {
        try {
          track.stop();
        } catch {}
      }
    }

    if (state.audioContext && state.audioContext.state !== "closed") {
      try {
        await state.audioContext.close();
      } catch {}
    }

    state.sourceNode = null;
    state.mediaStream = null;
    state.analyser = null;
    state.audioContext = null;
    state.data = null;
    state.sampleRate = 0;
    state.started = false;
    state.startInProgress = false;
  }

  function getStepPrecision(stepValue) {
    const str = String(stepValue || "");
    const decimal = str.split(".")[1] || "";
    return decimal.length;
  }

  function wireControls() {
    vPerDivInput.addEventListener("input", () => {
      state.vPerDiv = parseFloat(vPerDivInput.value);
      updateLabels();
    });

    tPerDivInput.addEventListener("change", () => {
      state.tPerDiv = parseFloat(tPerDivInput.value);
      updateLabels();
      updateTimebase();
    });

    pauseBtn.addEventListener("click", () => {
      state.paused = !state.paused;
      pauseBtn.classList.toggle("active", state.paused);
      pauseBtn.textContent = state.paused ? "Resume" : "Pause";
      if (!state.paused) state.cursor.active = false;
    });

    canvas.addEventListener("mousemove", (event) => {
      if (!state.paused) return;
      const rect = canvas.getBoundingClientRect();
      state.cursor.active = true;
      state.cursor.x = event.clientX - rect.left;
      state.cursor.y = event.clientY - rect.top;
    });

    canvas.addEventListener("mouseleave", () => {
      state.cursor.active = false;
    });

    window.addEventListener("keydown", (event) => {
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const step = parseFloat(vPerDivInput.step) || 0.01;
      const minV = parseFloat(vPerDivInput.min);
      const maxV = parseFloat(vPerDivInput.max);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = Math.min(maxV, Math.max(minV, state.vPerDiv + step * direction));
      const precision = getStepPrecision(vPerDivInput.step);
      state.vPerDiv = Number(next.toFixed(precision));
      vPerDivInput.value = state.vPerDiv.toFixed(precision);
      updateLabels();
    });

    startBtn.addEventListener("click", async () => {
      if (state.started || state.startInProgress) return;
      state.startInProgress = true;
      startBtn.disabled = true;
      startBtn.textContent = "Starting...";
      setStatus("Requesting microphone...");

      const ok = await initAudio();

      state.startInProgress = false;
      if (ok) {
        state.started = true;
        startBtn.textContent = "Audio Live";
        startBtn.setAttribute("aria-pressed", "true");
      } else {
        state.started = false;
        startBtn.disabled = false;
        startBtn.textContent = "Start Audio";
        startBtn.setAttribute("aria-pressed", "false");
      }
    });
  }

  window.addEventListener("resize", () => {
    resizeCanvas();
    drawGrid();
  });

  window.addEventListener("beforeunload", () => {
    void teardownAudio();
  });

  window.addEventListener("pagehide", () => {
    void teardownAudio();
  });

  if (!isAudioCaptureSupported()) {
    startBtn.disabled = true;
    setStatus("Microphone capture is not supported in this browser.");
  }

  resizeCanvas();
  updateLabels();
  wireControls();
  drawGrid();
  drawWaveform();
})();
