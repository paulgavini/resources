const clamp01 = (v) => Math.max(0, Math.min(1, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randNorm = (std) => (Math.random() * 2 - 1 + Math.random() * 2 - 1) * 0.5 * std * 3.4641; // ~triangular approx

const el = (id) => document.getElementById(id);

const worldCanvas = el('world');
const chartCanvas = el('chart');
const ctx = worldCanvas.getContext('2d');
const cctx = chartCanvas.getContext('2d');

const geneSpeedEl = el('geneSpeed');
const geneSizeEl = el('geneSize');
const geneSenseEl = el('geneSense');
const speedVal = el('speedVal');
const sizeVal = el('sizeVal');
const senseVal = el('senseVal');
const sumVal = el('sumVal');

const startBtn = el('startBtn');
const pauseBtn = el('pauseBtn');
const resetBtn = el('resetBtn');
const speedBtn = el('speedBtn');
const infoBtn = el('infoBtn');
const researchBtn = el('researchBtn');

const initPopEl = el('initPop');
const foodRateEl = el('foodRate');
const mutationEl = el('mutation');
const foodEnergyEl = el('foodEnergy');
const metabolismEl = el('metabolism');
const reproThreshEl = el('reproThresh');

const popVal = el('popVal');
const avgSpeed = el('avgSpeed');
const avgSize = el('avgSize');
const avgSense = el('avgSense');
const birthsEl = el('births');
const deathsEl = el('deaths');
const tickVal = el('tickVal');
const inspectorEl = el('inspector');
let selected = null;

let running = false;
let tick = 0;
let births = 0;
let deaths = 0;

const W = worldCanvas.width;
const H = worldCanvas.height;

let organisms = [];
let food = [];

const history = { pop: [], sp: [], sz: [], se: [] };
const maxHistory = 600;

const params = () => ({
  initPop: parseInt(initPopEl.value, 10),
  foodRate: parseFloat(foodRateEl.value),
  mutation: parseFloat(mutationEl.value),
  foodEnergy: parseFloat(foodEnergyEl.value),
  metabolism: parseFloat(metabolismEl.value),
  reproThresh: parseFloat(reproThreshEl.value)
});

function normalizeGenes(gs, gz, ge) {
  // Use raw slider values directly (no normalization)
  return [gs, gz, ge];
}

function geneToTraits(g) {
  const [s, z, e] = g; // speed, size, sense
  const speed = 0.5 + s * 2.0;     // px/tick
  const sizeR = 2 + z * 6;         // px radius
  const sense = 20 + e * 120;      // px
  return { speed, sizeR, sense };
}

function organismFromGenes(g, x, y) {
  const t = geneToTraits(g);
  return {
    x, y,
    vx: rand(-1, 1),
    vy: rand(-1, 1),
    g: [...g],
    e: 40 + t.sizeR * 2,
    age: 0,
    foodCount: 0,
    mateCooldown: 0
  };
}

function spawnInitial() {
  organisms = [];
  food = [];
  births = 0;
  deaths = 0;
  tick = 0;
  history.pop = []; history.sp = []; history.sz = []; history.se = [];
  const gs = parseFloat(geneSpeedEl.value);
  const gz = parseFloat(geneSizeEl.value);
  const ge = parseFloat(geneSenseEl.value);
  const [s, z, e] = normalizeGenes(gs, gz, ge);
  const n = params().initPop;
  for (let i = 0; i < n; i++) {
    const x = rand(20, W - 20);
    const y = rand(20, H - 20);
    organisms.push(organismFromGenes([s, z, e], x, y));
  }
}

function addFood(ratePerSecond) {
  let toAdd = ratePerSecond / 60; // approx per tick
  let carry = toAdd;
  while (carry > 0) {
    if (carry >= 1 || Math.random() < carry) {
      food.push({ x: rand(5, W - 5), y: rand(5, H - 5) });
    }
    carry -= 1;
  }
  // cap to avoid runaway
  if (food.length > 3000) food.splice(0, food.length - 3000);
}

function step(dt) {
  const p = params();
  addFood(p.foodRate);
  const newBorn = [];
  const fEnergy = p.foodEnergy;
  const baseM = p.metabolism;
  const reproT = p.reproThresh;
  const mut = p.mutation;

  // spatial hashing lite for food
  const cell = 20;
  const cols = Math.ceil(W / cell);
  const rows = Math.ceil(H / cell);
  const grid = new Array(cols * rows).fill(null).map(() => []);
  for (let i = 0; i < food.length; i++) {
    const fx = food[i].x | 0, fy = food[i].y | 0;
    const cx = Math.min(cols - 1, Math.max(0, (fx / cell) | 0));
    const cy = Math.min(rows - 1, Math.max(0, (fy / cell) | 0));
    grid[cy * cols + cx].push(i);
  }

  for (let i = organisms.length - 1; i >= 0; i--) {
    const o = organisms[i];
    const t = geneToTraits(o.g);
    o.age += dt;
    // If Size gene is zero, organism dies immediately
    if (o.g[1] <= 0) { organisms.splice(i, 1); deaths++; continue; }
    if (o.mateCooldown > 0) o.mateCooldown = Math.max(0, o.mateCooldown - dt);

    // seek nearest food within sense
    let target = null; let td2 = t.sense * t.sense;
    const cx = Math.min(cols - 1, Math.max(0, (o.x / cell) | 0));
    const cy = Math.min(rows - 1, Math.max(0, (o.y / cell) | 0));
    for (let yy = Math.max(0, cy - 3); yy <= Math.min(rows - 1, cy + 3); yy++) {
      for (let xx = Math.max(0, cx - 3); xx <= Math.min(cols - 1, cx + 3); xx++) {
        const bucket = grid[yy * cols + xx];
        for (let k = 0; k < bucket.length; k++) {
          const f = food[bucket[k]]; if (!f) continue;
          const dx = f.x - o.x; const dy = f.y - o.y; const d2 = dx*dx + dy*dy;
          if (d2 < td2) { td2 = d2; target = f; }
        }
      }
    }

    // consider seeking mate when energetic
    let mateTarget = null;
    if (o.e > reproT * 0.8) {
      let bestD2 = t.sense * t.sense;
      for (let j = 0; j < organisms.length; j++) {
        if (j === i) continue;
        const p2 = organisms[j];
        if (p2.e <= reproT || p2.mateCooldown > 0) continue;
        const dx = p2.x - o.x; const dy = p2.y - o.y; const d2 = dx*dx + dy*dy;
        if (d2 < bestD2) { bestD2 = d2; mateTarget = p2; }
      }
    }

    if (mateTarget) {
      const dx = mateTarget.x - o.x; const dy = mateTarget.y - o.y; const d = Math.hypot(dx, dy) || 1;
      o.vx += (dx / d) * 0.6; o.vy += (dy / d) * 0.6;
    } else if (target) {
      const dx = target.x - o.x; const dy = target.y - o.y; const d = Math.hypot(dx, dy) || 1;
      o.vx += (dx / d) * 0.6; o.vy += (dy / d) * 0.6;
    } else {
      o.vx += rand(-0.2, 0.2); o.vy += rand(-0.2, 0.2);
    }
    // limit velocity to trait speed
    const v = Math.hypot(o.vx, o.vy) || 1;
    const maxV = t.speed;
    if (v > maxV) { o.vx = (o.vx / v) * maxV; o.vy = (o.vy / v) * maxV; }

    o.x += o.vx; o.y += o.vy;
    if (o.x < 0) { o.x = 0; o.vx *= -0.6; }
    if (o.y < 0) { o.y = 0; o.vy *= -0.6; }
    if (o.x > W) { o.x = W; o.vx *= -0.6; }
    if (o.y > H) { o.y = H; o.vy *= -0.6; }

    // metabolism cost
    const geneCost = baseM * (0.5 + 1.6*o.g[0] + 1.2*o.g[1] + 1.4*o.g[2]);
    const moveCost = 0.0025 * v * v;
    o.e -= (geneCost + moveCost) * 10 * dt;

    // eat food
    const sr = t.sizeR;
    let ate = false;
    if (target) {
      const dx = target.x - o.x; const dy = target.y - o.y;
      if (dx*dx + dy*dy <= sr*sr) {
        // remove the specific target (find by identity)
        const idx = food.indexOf(target);
        if (idx >= 0) { food.splice(idx, 1); ate = true; }
      }
    } else {
      // random local sweep
      for (let j = 0; j < food.length; j++) {
        const f = food[j];
        const dx = f.x - o.x; const dy = f.y - o.y;
        if (dx*dx + dy*dy <= sr*sr) { food.splice(j, 1); ate = true; break; }
      }
    }
    if (ate) { o.e += fEnergy * (0.8 + 0.4 * o.g[1]); o.foodCount++; }

    // death
    if (o.e <= 0) {
      organisms.splice(i, 1);
      deaths++;
    }
  }
  // Pairing for sexual reproduction
  const paired = new Set();
  for (let i = 0; i < organisms.length; i++) {
    const a = organisms[i];
    if (a.e <= reproT || a.mateCooldown > 0 || paired.has(i)) continue;
    let bestJ = -1; let bestD2 = Infinity;
    const ta = geneToTraits(a.g);
    for (let j = 0; j < organisms.length; j++) {
      if (j === i || paired.has(j)) continue;
      const b = organisms[j];
      if (b.e <= reproT || b.mateCooldown > 0) continue;
      const tb = geneToTraits(b.g);
      const dx = b.x - a.x; const dy = b.y - a.y; const d2 = dx*dx + dy*dy;
      const mateRange = (ta.sizeR + tb.sizeR) * 0.8;
      if (d2 <= mateRange * mateRange && d2 < bestD2) { bestD2 = d2; bestJ = j; }
    }
    if (bestJ >= 0) {
      const b = organisms[bestJ];
      const w1 = 1 + a.foodCount; const w2 = 1 + b.foodCount;
      let g0 = (a.g[0]*w1 + b.g[0]*w2) / (w1+w2) + randNorm(mut);
      let g1 = (a.g[1]*w1 + b.g[1]*w2) / (w1+w2) + randNorm(mut);
      let g2 = (a.g[2]*w1 + b.g[2]*w2) / (w1+w2) + randNorm(mut);
      g0 = clamp01(g0); g1 = clamp01(g1); g2 = clamp01(g2);
      // Do not re-normalize; keep raw values
      const childG = [g0, g1, g2];
      const donate = 0.4;
      const childE = a.e*donate + b.e*donate;
      a.e *= (1-donate); b.e *= (1-donate);
      const child = organismFromGenes(childG, (a.x+b.x)*0.5 + rand(-3,3), (a.y+b.y)*0.5 + rand(-3,3));
      child.e = childE;
      newBorn.push(child);
      births++;
      a.mateCooldown = 2.0; b.mateCooldown = 2.0;
      paired.add(i); paired.add(bestJ);
    }
  }
  if (newBorn.length) organisms.push(...newBorn);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  // food
  ctx.fillStyle = '#8ef0a4';
  for (let i = 0; i < food.length; i++) {
    const f = food[i];
    ctx.fillRect(f.x - 1, f.y - 1, 2, 2);
  }
  // organisms
  for (let i = 0; i < organisms.length; i++) {
    const o = organisms[i];
    const t = geneToTraits(o.g);
    const r = t.sizeR;
    const hue = 210 * o.g[0] + 120 * o.g[2];
    ctx.fillStyle = `hsl(${hue.toFixed(0)},70%,60%)`;
    ctx.beginPath();
    ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
    ctx.fill();
    // direction marker
    ctx.strokeStyle = '#ffffff20';
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(o.x + (o.vx * 2), o.y + (o.vy * 2));
    ctx.stroke();
    if (selected === o) {
      ctx.strokeStyle = '#fffb';
      ctx.beginPath();
      ctx.arc(o.x, o.y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function updateStats() {
  const n = organisms.length || 1;
  let sp = 0, sz = 0, se = 0;
  for (let i = 0; i < organisms.length; i++) {
    sp += organisms[i].g[0];
    sz += organisms[i].g[1];
    se += organisms[i].g[2];
  }
  sp /= n; sz /= n; se /= n;
  popVal.textContent = organisms.length.toString();
  avgSpeed.textContent = sp.toFixed(2);
  avgSize.textContent = sz.toFixed(2);
  avgSense.textContent = se.toFixed(2);
  birthsEl.textContent = births.toString();
  deathsEl.textContent = deaths.toString();
  tickVal.textContent = tick.toString();

  history.pop.push(organisms.length);
  history.sp.push(sp);
  history.sz.push(sz);
  history.se.push(se);
  if (history.pop.length > maxHistory) {
    for (const k of Object.keys(history)) history[k].splice(0, history[k].length - maxHistory);
  }
}

function drawChart() {
  const w = chartCanvas.width;
  const h = chartCanvas.height;
  cctx.clearRect(0, 0, w, h);
  const len = history.pop.length;
  if (!len) return;
  const start = Math.max(0, len - maxHistory);
  const view = len - start;
  const xFor = (i) => (i / Math.max(1, maxHistory - 1)) * (w - 30) + 20;

  const maxPop = Math.max(1, ...history.pop);
  const yPop = (v) => h - 10 - (v / maxPop) * (h - 20);
  const yGene = (v) => h - 10 - v * (h - 20);

  // axes
  cctx.strokeStyle = '#304055';
  cctx.beginPath(); cctx.moveTo(15, 10); cctx.lineTo(15, h - 10); cctx.lineTo(w - 10, h - 10); cctx.stroke();

  const drawSeries = (arr, color, ymap) => {
    cctx.strokeStyle = color; cctx.beginPath();
    for (let i = 0; i < view; i++) {
      const x = xFor(i); const y = ymap(arr[start + i]);
      if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
    }
    cctx.stroke();
  };

  drawSeries(history.pop, '#49a6ff', yPop);
  drawSeries(history.sp, '#ffb649', yGene);
  drawSeries(history.sz, '#9d7cff', yGene);
  drawSeries(history.se, '#8ef0a4', yGene);

  cctx.fillStyle = '#a7b4c3';
  cctx.font = '12px Inter, sans-serif';
  cctx.fillText('Population (blue)', 22, 18);
  cctx.fillText('Speed (orange)  Size (violet)  Sense (green)', 140, 18);
}

// Speed control (number of fixed steps per frame)
const speeds = [1, 2, 4, 8];
let speedIndex = 0; // 0 -> 1x
let speedSteps = speeds[speedIndex];

function loop(ts) {
  if (!running) return;
  for (let i = 0; i < speedSteps; i++) {
    step(1/60); // fixed dt to align with food spawn assumption
    tick++;
  }
  draw();
  updateStats();
  if (tick % 3 === 0) drawChart();
  requestAnimationFrame(loop);
}

function setGenesUI() {
  const gs = parseFloat(geneSpeedEl.value);
  const gz = parseFloat(geneSizeEl.value);
  const ge = parseFloat(geneSenseEl.value);
  speedVal.textContent = gs.toFixed(2);
  sizeVal.textContent = gz.toFixed(2);
  senseVal.textContent = ge.toFixed(2);
  const s = gs + gz + ge;
  sumVal.textContent = s.toFixed(2);
}

geneSpeedEl.addEventListener('input', setGenesUI);
geneSizeEl.addEventListener('input', setGenesUI);
geneSenseEl.addEventListener('input', setGenesUI);

startBtn.addEventListener('click', () => {
  if (running) return;
  spawnInitial();
  running = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  requestAnimationFrame(loop);
});

pauseBtn.addEventListener('click', () => {
  running = !running;
  pauseBtn.textContent = running ? 'Pause' : 'Resume';
  if (running) {
    requestAnimationFrame(loop);
  }
});

resetBtn.addEventListener('click', () => {
  running = false;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'Pause';
  spawnInitial();
  draw();
  updateStats();
  drawChart();
  selected = null; updateInspector();
});

// initial paint
setGenesUI();
spawnInitial();
draw();
updateStats();
drawChart();
updateInspector();

// Speed toggle button cycles 1x/2x/4x/8x
function updateSpeedLabel() {
  if (speedBtn) speedBtn.textContent = `Speed: ${speeds[speedIndex]}x`;
}
if (speedBtn) {
  speedBtn.addEventListener('click', () => {
    speedIndex = (speedIndex + 1) % speeds.length;
    speedSteps = speeds[speedIndex];
    updateSpeedLabel();
  });
  updateSpeedLabel();
}

// Info button opens the guide in a new tab
if (infoBtn) {
  infoBtn.addEventListener('click', () => {
    window.open('info.html', '_blank');
  });
}

// Research button opens investigations page
if (researchBtn) {
  researchBtn.addEventListener('click', () => {
    window.open('research.html', '_blank');
  });
}

// Inspector helpers
function updateInspector() {
  if (!inspectorEl) return;
  if (!selected || !organisms.includes(selected)) {
    inspectorEl.textContent = 'Pause, then click an organism to inspect genes.';
    return;
  }
  inspectorEl.textContent = `Selected — Genes: Speed ${selected.g[0].toFixed(2)}, Size ${selected.g[1].toFixed(2)}, Sense ${selected.g[2].toFixed(2)} | Energy ${selected.e.toFixed(1)} | Age ${selected.age.toFixed(1)}s | Ate ${selected.foodCount}`;
}

worldCanvas.addEventListener('click', (ev) => {
  if (running) return; // only inspect when paused
  const rect = worldCanvas.getBoundingClientRect();
  const scaleX = worldCanvas.width / rect.width;
  const scaleY = worldCanvas.height / rect.height;
  const x = (ev.clientX - rect.left) * scaleX;
  const y = (ev.clientY - rect.top) * scaleY;
  let best = null; let bestD2 = 15 * 15;
  for (let i = 0; i < organisms.length; i++) {
    const o = organisms[i];
    const dx = o.x - x; const dy = o.y - y; const d2 = dx*dx + dy*dy;
    if (d2 < bestD2) { bestD2 = d2; best = o; }
  }
  selected = best;
  draw();
  updateInspector();
});

// Clear selection when resuming
pauseBtn.addEventListener('click', () => {
  if (running) { selected = null; updateInspector(); }
});

// Override inspector text with ASCII-safe punctuation to avoid mojibake
function updateInspector() {
  if (!inspectorEl) return;
  if (!selected || !organisms.includes(selected)) {
    inspectorEl.textContent = 'Pause, then click an organism to inspect genes.';
    return;
  }
  inspectorEl.textContent = `Selected - Genes: Speed ${selected.g[0].toFixed(2)}, Size ${selected.g[1].toFixed(2)}, Sense ${selected.g[2].toFixed(2)} | Energy ${selected.e.toFixed(1)} | Age ${selected.age.toFixed(1)}s | Ate ${selected.foodCount}`;
}
