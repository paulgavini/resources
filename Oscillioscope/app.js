const canvas = document.getElementById("scope");
const ctx = canvas.getContext("2d");

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

const gridDivisions = { x: 10, y: 8 };
const state = {
  vPerDiv: parseFloat(vPerDivInput.value),
  tPerDiv: parseFloat(tPerDivInput.value),
  paused: false,
  analyser: null,
  audioContext: null,
  data: null,
  sampleRate: 0,
  samplesToDisplay: 0,
  started: false,
  lastFrequency: 0,
  cursor: { active: false, x: 0, y: 0 },
};

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * window.devicePixelRatio);
  canvas.height = Math.floor(rect.height * window.devicePixelRatio);
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
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
  const { width, height } = canvas;
  const w = width / window.devicePixelRatio;
  const h = height / window.devicePixelRatio;
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

  if (!state.analyser || !state.data) {
    requestAnimationFrame(drawWaveform);
    return;
  }

  if (!state.paused) {
    state.analyser.getFloatTimeDomainData(state.data);
  }

  drawGrid();

  const { width, height } = canvas;
  const w = width / window.devicePixelRatio;
  const h = height / window.devicePixelRatio;
  const mid = h / 2;

  ctx.strokeStyle = "#00e5a8";
  ctx.lineWidth = 2;
  ctx.beginPath();

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
  let endIndex = startIndex + sampleCount;
  if (endIndex > samples.length) {
    endIndex = samples.length;
  }
  const view = samples.subarray(startIndex, endIndex);

  let peak = 0;
  for (let i = 0; i < view.length; i += 1) {
    const value = Math.abs(view[i]);
    if (value > peak) peak = value;
  }

  for (let i = 0; i < sampleCount; i += 1) {
    const x = (i / (sampleCount - 1)) * w;
    const volts = view[i] * (1 / state.vPerDiv);
    const y = mid - volts * (h / gridDivisions.y);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
  if (!state.paused) {
    const freq = estimateFrequency(view, state.sampleRate);
    state.lastFrequency = freq || state.lastFrequency;
  }
  updateFrequencyLabel(state.lastFrequency);
  if (peak > 0) {
    const vpp = 2 * peak * state.vPerDiv;
    updateAmplitudeLabel(vpp);
  } else {
    updateAmplitudeLabel(0);
  }

  if (state.paused && state.cursor.active) {
    const cursorY = state.cursor.y;
    const cursorX = state.cursor.x;
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
    const durationMs = (sampleCount / state.sampleRate) * 1000;
    const timeMs = (cursorX / w) * durationMs;
    updateCursorLabel(`Cursor: ${timeMs.toFixed(2)} ms, ${voltage.toFixed(3)} V`);
  } else {
    updateCursorLabel("Cursor: --");
  }
  requestAnimationFrame(drawWaveform);
}

async function initAudio() {
  try {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await state.audioContext.resume();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const source = state.audioContext.createMediaStreamSource(stream);
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 2048;
    state.data = new Float32Array(state.analyser.fftSize);
    state.sampleRate = state.audioContext.sampleRate;
    source.connect(state.analyser);
    updateTimebase();
    statusEl.textContent = "Live audio running.";
    pauseBtn.disabled = false;
  } catch (err) {
    ctx.fillStyle = "#d6e3f0";
    ctx.font = "16px Trebuchet MS";
    ctx.fillText("Microphone access denied.", 20, 40);
    statusEl.textContent = "Microphone access denied or unavailable.";
  }
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
    const tag = event.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = parseFloat(vPerDivInput.step) || 0.01;
    const minV = parseFloat(vPerDivInput.min);
    const maxV = parseFloat(vPerDivInput.max);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = Math.min(maxV, Math.max(minV, state.vPerDiv + step * direction));
    state.vPerDiv = next;
    vPerDivInput.value = state.vPerDiv.toFixed(2);
    updateLabels();
  });

  startBtn.addEventListener("click", async () => {
    if (state.started) return;
    state.started = true;
    startBtn.disabled = true;
    startBtn.textContent = "Starting...";
    statusEl.textContent = "Requesting microphone...";
    await initAudio();
    startBtn.textContent = "Audio Live";
  });
}

window.addEventListener("resize", () => {
  resizeCanvas();
  drawGrid();
});

resizeCanvas();
updateLabels();
wireControls();
drawGrid();
drawWaveform();
