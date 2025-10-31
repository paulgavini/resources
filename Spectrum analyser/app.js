(() => {
  const $ = (sel) => document.querySelector(sel);
  const canvas = $('#spectrum');
  const ctx = canvas.getContext('2d');
  const btnToggle = $('#btn-toggle');
  const btnRefresh = document.querySelector('#btn-refresh');
  const selDevice = document.querySelector('#input-device');
  const selFft = $('#fft-size');
  const rngSmoothing = $('#smoothing');
  const chkLog = $('#log-scale');
  const hoverReadout = $('#hover-readout');
  const sampleRateEl = $('#sample-rate');
  const nyquistEl = $('#nyquist');
  const cursorInfoEl = $('#cursor-info');
  const bandwidthEl = document.querySelector('#bandwidth');
  const peaksListEl = document.querySelector('#peaks-list');
  // no user-facing peak controls in this version

  let audioCtx = null;
  let analyser = null;
  let mediaStream = null;
  let sourceNode = null;
  let freqData = null; // Float32Array (in dB)
  let running = false;
  let selectedDeviceId = '';

  // Render state
  let rafId = 0;
  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let hoverX = null; // canvas-space px
  const DISPLAY_MIN_HZ = 20;
  const DISPLAY_MAX_HZ = 20000; // cap view at 20 kHz even if Nyquist is higher
  let MAX_PEAK_LABELS = 5;
  let peakLabels = []; // DOM nodes for on-canvas labels
  let minProminenceDb = 8; // fixed threshold
  let avgFrames = 4;      // fixed averaging window
  let avgFreqData = null; // running average spectrum (Float32Array)

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function formatHz(hz) {
    if (!isFinite(hz) || hz < 0) return '–';
    if (hz >= 1000) return `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)} kHz`;
    return `${hz.toFixed(hz >= 100 ? 0 : 1)} Hz`;
  }

  function magToString(db) {
    if (!isFinite(db)) return '– dB';
    return `${db.toFixed(1)} dB`;
  }

  function xToFrequency(x) {
    if (!analyser || !audioCtx) return 0;
    const widthCss = canvas.getBoundingClientRect().width;
    const nyquist = audioCtx.sampleRate / 2;
    const minHz = DISPLAY_MIN_HZ;
    const maxHz = Math.min(DISPLAY_MAX_HZ, nyquist);
    const clampedX = Math.max(0, Math.min(widthCss, x));
    if (chkLog.checked) {
      const min = minHz;
      const max = maxHz;
      const ratio = clampedX / widthCss;
      const freq = min * Math.pow(max / min, ratio);
      return Math.max(0, Math.min(maxHz, freq));
    } else {
      const ratio = clampedX / widthCss;
      return minHz + ratio * (maxHz - minHz);
    }
  }

  function frequencyToBin(freq) {
    if (!analyser || !audioCtx) return 0;
    const nyq = audioCtx.sampleRate / 2;
    const bin = Math.round((freq / nyq) * (analyser.frequencyBinCount - 1));
    return Math.max(0, Math.min(analyser.frequencyBinCount - 1, bin));
  }

  function binToX(bin) {
    const widthCss = canvas.getBoundingClientRect().width;
    if (!analyser || !audioCtx) return 0;
    const nyquist = audioCtx.sampleRate / 2;
    const freq = (bin * audioCtx.sampleRate) / analyser.fftSize;
    const minHz = DISPLAY_MIN_HZ;
    const maxHz = Math.min(DISPLAY_MAX_HZ, nyquist);
    if (chkLog.checked) {
      const min = minHz;
      const max = maxHz;
      const ratio = Math.log(freq / min) / Math.log(max / min);
      return Math.max(0, Math.min(widthCss, ratio * widthCss));
    } else {
      const ratio = (freq - minHz) / (maxHz - minHz);
      return Math.max(0, Math.min(widthCss, ratio * widthCss));
    }
  }

  function drawBackground() {
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    // Gradient baseline fill
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(76, 201, 240, 0.18)');
    grad.addColorStop(1, 'rgba(76, 201, 240, 0.02)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawSpectrum() {
    if (!analyser || !freqData) return;
    analyser.getFloatFrequencyData(freqData);
    // Build/maintain a running average to reduce noise
    if (!avgFreqData || avgFreqData.length !== freqData.length) {
      avgFreqData = new Float32Array(freqData.length);
      for (let i = 0; i < avgFreqData.length; i++) avgFreqData[i] = freqData[i];
    } else {
      const alpha = Math.max(0.05, 1 / Math.max(1, avgFrames));
      for (let i = 0; i < freqData.length; i++) {
        avgFreqData[i] = avgFreqData[i] + alpha * (freqData[i] - avgFreqData[i]);
      }
    }

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    drawBackground();

    const nyq = audioCtx.sampleRate / 2;
    const viewMinHz = DISPLAY_MIN_HZ;
    const viewMaxHz = Math.min(DISPLAY_MAX_HZ, nyq);
    const minDb = analyser.minDecibels;
    const maxDb = analyser.maxDecibels;

    // Draw spectrum as a continuous line (polyline)
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#7dd3fc';
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const freq = xToFrequency(x);
      const bin = frequencyToBin(freq);
      const db = avgFreqData[bin];
      const norm = (db - minDb) / (maxDb - minDb); // 0..1
      const magY = Math.max(0, Math.min(1, norm));
      const y = height - magY * height;
      if (x === 0) ctx.moveTo(0.5, y);
      else ctx.lineTo(x + 0.5, y);
    }
    ctx.stroke();

    // Axis labels (few ticks to avoid clutter)
    drawXAxisTicks(viewMinHz, viewMaxHz, width, height);

    // Peak detection and labels
    const peaks = detectTopPeaks(avgFreqData, audioCtx.sampleRate, analyser.fftSize, viewMinHz, viewMaxHz, MAX_PEAK_LABELS, minProminenceDb);
    drawPeakMarkers(peaks, height);
    updatePeaksList(peaks);
    estimateAndDisplayBandwidth(peaks, viewMaxHz);

    // Hover marker
    if (hoverX != null) {
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hoverX + 0.5, 0);
      ctx.lineTo(hoverX + 0.5, height);
      ctx.stroke();
    }
  }

  function drawXAxisTicks(viewMinHz, viewMaxHz, width, height) {
    ctx.font = '12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto';
    ctx.fillStyle = '#9aa3b2';
    ctx.strokeStyle = 'rgba(154,163,178,0.35)';
    ctx.lineWidth = 1;

    const ticks = [];
    if (chkLog.checked) {
      // Decade ticks: 20, 50, 100, 200, 500, 1k, 2k, 5k, 10k, 20k
      let f = DISPLAY_MIN_HZ;
      const bases = [1, 2, 5];
      while (f <= viewMaxHz) {
        for (const b of bases) {
          const t = f * b;
          if (t >= viewMinHz && t <= viewMaxHz) ticks.push(t);
        }
        f *= 10;
      }
    } else {
      const span = viewMaxHz - viewMinHz;
      const step = niceStep(span / 8);
      for (let f = viewMinHz; f <= viewMaxHz + 1; f += step) ticks.push(f);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const f of ticks) {
      const x = binToX(Math.round((f / audioCtx.sampleRate) * analyser.fftSize));
      ctx.beginPath();
      ctx.moveTo(x + 0.5, height - 18);
      ctx.lineTo(x + 0.5, height - 14);
      ctx.stroke();
      ctx.fillText(formatHz(f), x, height - 2);
    }
  }

  function niceStep(raw) {
    const exp = Math.floor(Math.log10(raw));
    const base = Math.pow(10, exp);
    const n = raw / base;
    if (n < 1.5) return 1 * base;
    if (n < 3.5) return 2 * base;
    if (n < 7.5) return 5 * base;
    return 10 * base;
  }

  // Peak detection (with quadratic interpolation for sub-bin accuracy)
  function detectTopPeaks(data, sampleRate, fftSize, minHz, maxHz, topN, minPromDb) {
    const nyq = sampleRate / 2;
    const minBin = Math.max(1, Math.floor((minHz / nyq) * (fftSize / 2)));
    const maxBin = Math.min(fftSize / 2 - 2, Math.ceil((maxHz / nyq) * (fftSize / 2)));
    // Pre-smooth a copied slice to reduce spurious bin-to-bin noise
    const sliceLen = maxBin - minBin + 1;
    const work = new Float32Array(sliceLen);
    for (let i = 0; i < sliceLen; i++) work[i] = data[minBin + i];
    // One pass triangle smoothing (0.25, 0.5, 0.25)
    for (let i = 1; i < sliceLen - 1; i++) {
      work[i] = 0.25 * work[i - 1] + 0.5 * work[i] + 0.25 * work[i + 1];
    }
    // Estimate noise floor as 20th percentile of the window
    const sorted = Array.from(work);
    sorted.sort((a, b) => a - b);
    const qIndex = Math.floor(sorted.length * 0.2);
    const noiseFloor = sorted[Math.max(0, Math.min(sorted.length - 1, qIndex))];
    const candidates = [];
    const localWin = 5; // +- bins for local baseline
    for (let i = minBin + 1; i <= maxBin - 1; i++) {
      const a = work[i - minBin - 1], b = work[i - minBin], c = work[i - minBin + 1];
      if (b > a && b > c) {
        // Parabolic interpolation around the peak (use original data for precision)
        const ao = data[i - 1], bo = data[i], co = data[i + 1];
        const denom = (a - 2 * b + c);
        const delta = denom !== 0 ? 0.5 * (a - c) / denom : 0; // -0.5..0.5 typically
        const peakBin = i + delta;
        const freq = (peakBin * sampleRate) / fftSize;
        const mag = bo - 0.25 * (ao - co) * delta; // interpolated dB (from original bins)
        // Local baseline (mean of neighbors excluding center)
        let sum = 0, count = 0;
        for (let k = i - localWin; k <= i + localWin; k++) {
          if (k < minBin || k > maxBin || k === i) continue;
          sum += data[k]; count++;
        }
        const localBase = count ? sum / count : noiseFloor;
        const prominence = mag - Math.max(localBase, noiseFloor);
        if (freq >= minHz && freq <= maxHz && isFinite(mag) && prominence >= (minPromDb || 0)) {
          candidates.push({ bin: peakBin, freq, mag });
        }
      }
    }
    // Sort by magnitude and pick top N, enforcing spacing to avoid near-duplicates
    candidates.sort((p, q) => q.mag - p.mag);
    const result = [];
    const minSeparationHz = Math.max(5, sampleRate / fftSize * 3);
    for (const p of candidates) {
      if (result.length >= topN) break;
      if (result.every(r => Math.abs(r.freq - p.freq) > minSeparationHz)) {
        result.push(p);
      }
    }
    // Sort by frequency ascending for nicer labeling
    result.sort((a, b) => a.freq - b.freq);
    return result;
  }

  function drawPeakMarkers(peaks, height) {
    // Clear old DOM labels
    for (const el of peakLabels) el.remove();
    peakLabels = [];
    if (!peaks || !peaks.length) return;
    ctx.save();
    ctx.fillStyle = '#e9d5ff';
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 1;
    for (const p of peaks) {
      const x = binToX(Math.round(p.bin));
      // Marker line
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 8);
      ctx.lineTo(x + 0.5, height - 24);
      ctx.stroke();
      // DOM label positioned over canvas
      const label = document.createElement('div');
      label.className = 'peak-label';
      label.textContent = `${formatHz(p.freq)}`;
      label.style.left = `${x}px`;
      label.style.top = `16px`;
      canvas.parentElement.appendChild(label);
      peakLabels.push(label);
    }
    ctx.restore();
  }

  function updatePeaksList(peaks) {
    if (!peaksListEl) return;
    if (!peaks || !peaks.length) { peaksListEl.textContent = '–'; return; }
    peaksListEl.textContent = peaks.map(p => formatHz(p.freq)).join(', ');
  }

  function estimateAndDisplayBandwidth(peaks, viewMaxHz) {
    if (!bandwidthEl || !analyser || !audioCtx) return;
    // Heuristic: highest strong peak defines practical bandwidth
    const strong = peaks.filter(p => p.mag > analyser.minDecibels + 20);
    const maxPeak = strong.length ? strong[strong.length - 1].freq : 0;
    const nyq = audioCtx.sampleRate / 2;
    const cap = Math.min(viewMaxHz, nyq);
    const text = maxPeak ? `${formatHz(maxPeak)} (practical), limit ${formatHz(cap)}` : `limit ${formatHz(cap)}`;
    bandwidthEl.textContent = text;
  }

  function updateControlsFromAnalyser() {
    if (!analyser) return;
    selFft.value = analyser.fftSize.toString();
    rngSmoothing.value = String(analyser.smoothingTimeConstant);
  }

  function applyAnalyserSettings() {
    if (!analyser) return;
    const nextFft = parseInt(selFft.value, 10);
    if (Number.isInteger(nextFft) && analyser.fftSize !== nextFft) {
      analyser.fftSize = nextFft;
      freqData = new Float32Array(analyser.frequencyBinCount);
    }
    analyser.smoothingTimeConstant = parseFloat(rngSmoothing.value);
  }

  async function start() {
    if (running) return;
    try {
      mediaStream = await getUserMediaWithPrefs(selectedDeviceId);
    } catch (err) {
      alert('Microphone access denied or unavailable.');
      console.error(err);
      return;
    }
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 96000 });
    } catch {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = parseInt(selFft.value, 10) || 4096;
    analyser.smoothingTimeConstant = parseFloat(rngSmoothing.value) || 0.7;
    // Expand dynamic range so very low magnitudes still map on-screen
    analyser.minDecibels = -140;
    analyser.maxDecibels = 0;

    sourceNode = audioCtx.createMediaStreamSource(mediaStream);
    sourceNode.connect(analyser);

    freqData = new Float32Array(analyser.frequencyBinCount);

    running = true;
    btnToggle.textContent = 'Stop Microphone';
    sampleRateEl.textContent = `${audioCtx.sampleRate.toFixed(0)} Hz`;
    nyquistEl.textContent = formatHz(audioCtx.sampleRate / 2);
    updateControlsFromAnalyser();

    tick();
  }

  function stop() {
    if (!running) return;
    running = false;
    btnToggle.textContent = 'Start Microphone';
    cancelAnimationFrame(rafId);
    rafId = 0;
    try { sourceNode && sourceNode.disconnect(); } catch {}
    try { analyser && analyser.disconnect && analyser.disconnect(); } catch {}
    if (mediaStream) {
      for (const track of mediaStream.getTracks()) track.stop();
    }
    mediaStream = null;
    sourceNode = null;
    analyser = null;
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  }

  function tick() {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    drawSpectrum();
    updateHoverReadout();
  }

  function updateHoverReadout() {
    if (hoverX == null || !analyser || !audioCtx || !freqData) {
      hoverReadout.hidden = true;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const freq = xToFrequency(hoverX);
    const bin = frequencyToBin(freq);
    const db = freqData[bin];

    hoverReadout.hidden = false;
    hoverReadout.textContent = `${formatHz(freq)}  •  ${magToString(db)}`;

    // Position tooltip; keep inside bounds
    let tipX = hoverX + 10;
    let tipY = 24; // top padding
    const tipRect = { width: hoverReadout.offsetWidth || 140, height: hoverReadout.offsetHeight || 24 };
    if (tipX + tipRect.width > width - 4) tipX = hoverX - tipRect.width - 10;
    if (tipY + tipRect.height > height - 4) tipY = height - tipRect.height - 4;
    hoverReadout.style.left = `${tipX}px`;
    hoverReadout.style.top = `${tipY}px`;

    cursorInfoEl.textContent = `${formatHz(freq)}, ${magToString(db)}`;
  }

  // Events
  btnToggle.addEventListener('click', () => {
    if (running) stop(); else start();
  });

  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      await populateDevices();
    });
  }

  if (selDevice) {
    selDevice.addEventListener('change', async () => {
      selectedDeviceId = selDevice.value;
      if (running) {
        stop();
        await start();
      }
    });
  }

  // Peak controls
  // removed: peak control listeners (fixed thresholds)

  selFft.addEventListener('change', () => {
    applyAnalyserSettings();
  });
  rngSmoothing.addEventListener('input', () => {
    applyAnalyserSettings();
  });
  chkLog.addEventListener('change', () => {
    // Redraw with new scale
    drawSpectrum();
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    hoverX = e.clientX - rect.left;
    updateHoverReadout();
  });
  canvas.addEventListener('mouseleave', () => {
    hoverX = null;
    hoverReadout.hidden = true;
    cursorInfoEl.textContent = 'Move over chart';
  });

  // Permissions and devices
  async function ensurePermission() {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
      tmp.getTracks().forEach(t => t.stop());
    } catch (_) {}
  }

  async function populateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter(d => d.kind === 'audioinput');
      if (!selDevice) return;
      selDevice.innerHTML = '';
      for (const d of inputs) {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || `Microphone ${selDevice.length + 1}`;
        selDevice.appendChild(opt);
      }
      if (inputs.length && !selectedDeviceId) {
        selectedDeviceId = inputs[0].deviceId;
      }
      if (selectedDeviceId) selDevice.value = selectedDeviceId;
    } catch (err) {
      console.warn('Could not enumerate devices:', err);
    }
  }

  async function getUserMediaWithPrefs(deviceId) {
    const audio = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
      sampleRate: { ideal: 96000, min: 48000 },
      sampleSize: { ideal: 24 },
      latency: 0
    };
    if (deviceId) audio.deviceId = { exact: deviceId };
    return navigator.mediaDevices.getUserMedia({ audio, video: false });
  }

  (async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      await ensurePermission();
      await populateDevices();
      navigator.mediaDevices.addEventListener?.('devicechange', populateDevices);
    }
  })();

})();
