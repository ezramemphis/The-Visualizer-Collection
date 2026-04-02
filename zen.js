/* ================================================================
   ZEN MODE — ALT/VIS
   Full-featured audio visualization auto-cycling engine
================================================================ */

"use strict";

// ================================================================
// CANVAS + CONTEXT
// ================================================================

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const grainCanvas = document.getElementById("grainCanvas");
const grainCtx = grainCanvas.getContext("2d");

function resizeAll() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  grainCanvas.width = window.innerWidth;
  grainCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeAll);
resizeAll();

// ================================================================
// AUDIO ENGINE
// ================================================================

const audio = new Audio();
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const source = audioCtx.createMediaElementSource(audio);
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;

const freqData = new Uint8Array(analyser.frequencyBinCount);
const timeData = new Uint8Array(analyser.fftSize);

source.connect(analyser);
analyser.connect(audioCtx.destination);

// Audio helpers
function avg(s, e) {
  let v = 0;
  const len = Math.max(1, e - s);
  for (let i = s; i < e; i++) v += freqData[i] || 0;
  return (v / len) / 255;
}

function bass() { return avg(0, 8); }
function mid()  { return avg(8, 60); }
function high() { return avg(60, 128); }

// Beat detection
let lastBass = 0;
let beatThreshold = 0.35;
let beatCooldown = 0;
let isBeat = false;

function detectBeat(dt) {
  const b = bass();
  isBeat = false;
  if (beatCooldown > 0) { beatCooldown -= dt; return; }
  if (b > beatThreshold && b > lastBass * 1.3) {
    isBeat = true;
    beatCooldown = 0.2;
  }
  lastBass = b * 0.8 + lastBass * 0.2;
}

// ================================================================
// SETTINGS (with localStorage persistence)
// ================================================================

const STORAGE_KEY = "altvis_zen_settings_v2";

const DEFAULTS = {
  holdTime: 20,
  fadeDuration: 3,
  bpmSync: 120,
  beatSwitch: false,
  transitionMode: "crossfade",
  sequenceMode: "random",

  vignetteStrength: 0.6,
  scanlines: 0,
  filmGrain: 0,
  chromaticAb: 0,
  hueShift: 0,
  hueRotateSpeed: 0,
  bloom: 0,
  saturation: 1.0,
  contrast: 1.0,
  invert: false,
  mirrorH: false,
  mirrorV: false,

  bassFlash: false,
  beatShake: 0,
  audioZoom: 0,
  glitchBeat: false,

  autoHide: true,
  showName: true,
  loopSingle: false,
};

let S = { ...DEFAULTS };

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) Object.assign(S, JSON.parse(saved));
  } catch(e) {}
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
  } catch(e) {}
}

loadSettings();

// ================================================================
// VISUALIZER LIBRARY — self-contained draw functions
// Each gets: (ctx, canvas, freqData, timeData, frame, dt)
// Must draw to ctx. Should NOT clear canvas (handled by engine).
// ================================================================

const SCENES = [];

function addScene(name, fn) {
  SCENES.push({ name, fn, frame: 0, state: {} });
}

// ── SCENE 1: SPECTRUM GRID ────────────────────────────────────────
addScene("SPECTRUM GRID", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(0, 0, W, H);

  const cols = 64;
  const bw = W / cols;
  for (let i = 0; i < cols; i++) {
    const v = fd[i * 2] / 255;
    const h = v * H * 0.85;
    const hue = (i / cols) * 280 + f * 0.3;
    ctx.fillStyle = `hsla(${hue},80%,55%,0.85)`;
    ctx.fillRect(i * bw, H - h, bw - 1, h);
    ctx.fillStyle = `hsla(${hue},100%,75%,0.3)`;
    ctx.fillRect(i * bw, H - h - 3, bw - 1, 3);
  }
});

// ── SCENE 2: OSCILLOSCOPE ─────────────────────────────────────────
addScene("OSCILLO TRACE", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, 0, W, H);

  const hue = (f * 0.5) % 360;
  ctx.strokeStyle = `hsla(${hue},90%,65%,0.85)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < td.length; i++) {
    const x = (i / td.length) * W;
    const y = ((td[i] / 128) - 1) * H * 0.4 + H / 2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Mirror
  ctx.strokeStyle = `hsla(${hue + 120},80%,55%,0.4)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < td.length; i++) {
    const x = (i / td.length) * W;
    const y = H - (((td[i] / 128) - 1) * H * 0.35 + H / 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
});

// ── SCENE 3: PARTICLE FIELD ───────────────────────────────────────
addScene("PARTICLE FIELD", (ctx, W, H, fd, td, f, dt, state) => {
  if (!state.particles) {
    state.particles = Array.from({ length: 200 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 3 + 1,
      hue: Math.random() * 360
    }));
  }
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0, 0, W, H);

  const b = 0; let bv = 0;
  for (let i = 0; i < 8; i++) bv += fd[i];
  bv = (bv / 8) / 255;

  state.particles.forEach(p => {
    p.x += p.vx * (1 + bv * 8);
    p.y += p.vy * (1 + bv * 8);
    if (p.x < 0) p.x = W;
    if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H;
    if (p.y > H) p.y = 0;

    const fIdx = Math.floor((p.x / W) * fd.length);
    const amp = fd[fIdx] / 255;
    const r = p.r * (1 + amp * 3);
    p.hue = (p.hue + 0.2) % 360;

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue},85%,65%,${0.5 + amp * 0.5})`;
    ctx.fill();

    // Glow
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue},85%,65%,0.05)`;
    ctx.fill();
  });
});

// ── SCENE 4: AUDIO VORTEX ─────────────────────────────────────────
addScene("AUDIO VORTEX", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const rings = 5;
  const spokes = fd.length / rings;

  for (let ring = 0; ring < rings; ring++) {
    ctx.beginPath();
    const baseR = 60 + ring * 60;
    for (let i = 0; i <= spokes; i++) {
      const angle = (i / spokes) * Math.PI * 2 + f * 0.01 * (ring % 2 === 0 ? 1 : -1);
      const amp = fd[ring * Math.floor(spokes) + i] / 255;
      const r = baseR + amp * 80;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    const hue = (ring * 72 + f * 0.5) % 360;
    ctx.strokeStyle = `hsla(${hue},90%,65%,0.8)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
});

// ── SCENE 5: ECHOFORM ─────────────────────────────────────────────
addScene("ECHOFORM", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const n = 128;
  const echoes = 6;

  for (let e2 = 0; e2 < echoes; e2++) {
    const age = e2 / echoes;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = (i / n) * Math.PI * 2 + f * 0.008 + e2 * 0.4;
      const amp = fd[Math.floor(i * fd.length / n)] / 255;
      const r = 80 + amp * 180 * (1 - age * 0.5) + e2 * 30;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    const hue = (f * 0.8 + e2 * 40) % 360;
    ctx.strokeStyle = `hsla(${hue},80%,65%,${(1 - age) * 0.7})`;
    ctx.lineWidth = 2 - age;
    ctx.stroke();
  }
});

// ── SCENE 6: FLOWER ───────────────────────────────────────────────
addScene("FLOWER", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const petals = 8;

  for (let p = 0; p < petals; p++) {
    const baseAngle = (p / petals) * Math.PI * 2 + f * 0.005;
    ctx.beginPath();
    for (let i = 0; i <= 128; i++) {
      const t = (i / 128) * Math.PI * 2;
      const fIdx = Math.floor(i * fd.length / 128);
      const amp = fd[fIdx] / 255;
      const r = (80 + amp * 150) * Math.abs(Math.cos(t * petals / 2));
      const angle = t + baseAngle;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    const hue = (p * (360 / petals) + f * 0.5) % 360;
    ctx.strokeStyle = `hsla(${hue},85%,70%,0.7)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
});

// ── SCENE 7: CRYOSPECTRUM ─────────────────────────────────────────
addScene("CRYOSPECTRUM", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,2,8,0.12)";
  ctx.fillRect(0, 0, W, H);

  const cols = 80;
  const bw = W / cols;
  for (let i = 0; i < cols; i++) {
    const amp = fd[Math.floor(i * fd.length / cols)] / 255;
    const h = amp * H * 0.9;
    const hue = 170 + (i / cols) * 60;
    const grad = ctx.createLinearGradient(0, H, 0, H - h);
    grad.addColorStop(0, `hsla(${hue},90%,70%,0.9)`);
    grad.addColorStop(0.5, `hsla(${hue + 20},80%,85%,0.6)`);
    grad.addColorStop(1, `hsla(${hue + 40},70%,95%,0.1)`);
    ctx.fillStyle = grad;
    ctx.fillRect(i * bw, H - h, bw - 1, h);
  }
});

// ── SCENE 8: CELLULAR NOISE ───────────────────────────────────────
addScene("CELLULAR NOISE", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(0, 0, W, H);
  if (!state.cells) {
    state.cells = Array.from({ length: 30 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5,
      hue: Math.random() * 360
    }));
  }
  const bv = fd[2] / 255;
  state.cells.forEach(c => {
    c.x += c.vx * (1 + bv * 4);
    c.y += c.vy * (1 + bv * 4);
    if (c.x < 0 || c.x > W) c.vx *= -1;
    if (c.y < 0 || c.y > H) c.vy *= -1;
    c.hue = (c.hue + 0.3) % 360;
  });

  // Draw Voronoi-like nearest-cell coloring (simplified)
  const step = 12;
  for (let px = 0; px < W; px += step) {
    for (let py = 0; py < H; py += step) {
      let minD = Infinity, nearest = null;
      state.cells.forEach(c => {
        const d = Math.hypot(px - c.x, py - c.y);
        if (d < minD) { minD = d; nearest = c; }
      });
      if (nearest) {
        const fIdx = Math.floor((px / W) * fd.length);
        const amp = fd[fIdx] / 255;
        ctx.fillStyle = `hsla(${nearest.hue},70%,${40 + amp*40}%,0.6)`;
        ctx.fillRect(px, py, step, step);
      }
    }
  }
});

// ── SCENE 9: GLITCH FIELD ─────────────────────────────────────────
addScene("GLITCH FIELD", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(0, 0, W, H);

  const bv = fd[1] / 255;
  const slices = Math.floor(bv * 20) + 3;

  for (let i = 0; i < slices; i++) {
    const sy = Math.random() * H;
    const sh = (Math.random() * 0.1 + 0.01) * H;
    const offset = (Math.random() - 0.5) * 80 * bv;
    const hue = Math.random() * 360;
    ctx.fillStyle = `hsla(${hue},90%,60%,0.15)`;
    ctx.fillRect(0, sy, W, sh);
    if (Math.random() < 0.3) {
      try {
        ctx.drawImage(canvas, 0, sy, W, sh, offset, sy, W, sh);
      } catch(e) {}
    }
  }

  // Scan bars
  const bars = 5;
  for (let i = 0; i < bars; i++) {
    const y = ((f * 3 + i * 200) % H);
    ctx.fillStyle = `rgba(0,255,200,${0.03 + bv * 0.1})`;
    ctx.fillRect(0, y, W, 2);
  }
});

// ── SCENE 10: RITUAL ENGINE ───────────────────────────────────────
addScene("RITUAL ENGINE", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(2,0,5,0.1)";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const bv = fd[2] / 255;
  const mv = fd[30] / 255;

  // Draw pentagonal layers
  for (let layer = 0; layer < 6; layer++) {
    const sides = 5 + layer;
    const r = 50 + layer * 55 + bv * 60;
    const rotOffset = f * 0.006 * (layer % 2 === 0 ? 1 : -1);
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2 + rotOffset;
      const amp = fd[Math.floor(i * fd.length / sides)] / 255;
      const rr = r + amp * 40;
      const x = cx + Math.cos(angle) * rr;
      const y = cy + Math.sin(angle) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    const hue = (layer * 50 + f * 0.4) % 360;
    ctx.strokeStyle = `hsla(${hue},80%,55%,${0.6 + mv * 0.4})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Center symbol
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50 + bv * 100);
  grd.addColorStop(0, `hsla(${f % 360},100%,80%,${bv})`);
  grd.addColorStop(1, "transparent");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, 50 + bv * 100, 0, Math.PI * 2);
  ctx.fill();
});

// ── SCENE 11: BUBBLES ─────────────────────────────────────────────
addScene("BUBBLES", (ctx, W, H, fd, td, f, dt, state) => {
  if (!state.bubbles) state.bubbles = [];
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  ctx.fillRect(0, 0, W, H);

  const bv = fd[2] / 255;
  if (Math.random() < 0.1 + bv * 0.4) {
    state.bubbles.push({
      x: Math.random() * W, y: H + 20,
      r: 10 + Math.random() * 60 * (1 + bv),
      vy: -(0.5 + Math.random() * 2),
      hue: Math.random() * 360, alpha: 0.7
    });
  }
  if (state.bubbles.length > 80) state.bubbles.splice(0, 1);

  state.bubbles.forEach((b, i) => {
    b.y += b.vy;
    b.x += Math.sin(f * 0.02 + i) * 0.5;
    b.alpha -= 0.002;
    if (b.alpha <= 0 || b.y < -b.r) state.bubbles.splice(i, 1);

    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    const grd = ctx.createRadialGradient(b.x - b.r*0.3, b.y - b.r*0.3, b.r*0.1, b.x, b.y, b.r);
    grd.addColorStop(0, `hsla(${b.hue},70%,90%,${b.alpha * 0.4})`);
    grd.addColorStop(1, `hsla(${b.hue},80%,55%,${b.alpha * 0.15})`);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = `hsla(${b.hue},80%,70%,${b.alpha * 0.6})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
});

// ── SCENE 12: VOID TUNNEL ─────────────────────────────────────────
addScene("VOID TUNNEL", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const rings = 20;
  const bv = fd[2] / 255;

  for (let i = rings; i >= 1; i--) {
    const t = (i / rings);
    const r = (1 - ((f * 0.005 + t) % 1)) * Math.min(W, H) * 0.7;
    const amp = fd[Math.floor(t * fd.length)] / 255;
    const hue = (i * 18 + f * 0.5) % 360;
    ctx.beginPath();
    ctx.arc(cx, cy, r + amp * 30, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue},80%,60%,${(1 - t) * 0.8})`;
    ctx.lineWidth = 2 + bv * 4;
    ctx.stroke();
  }
});

// ── SCENE 13: LIGHT TUNNEL ────────────────────────────────────────
addScene("LIGHT TUNNEL", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const lines = 48;
  const bv = fd[2] / 255;
  const mv = fd[30] / 255;

  for (let i = 0; i < lines; i++) {
    const angle = (i / lines) * Math.PI * 2 + f * 0.004;
    const startR = 20 + bv * 80;
    const endR = Math.min(W, H) * 0.5;
    const hue = (i * (360 / lines) + f * 0.6) % 360;

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * startR, cy + Math.sin(angle) * startR);
    ctx.lineTo(cx + Math.cos(angle) * endR, cy + Math.sin(angle) * endR);

    const amp = fd[Math.floor(i * fd.length / lines)] / 255;
    ctx.strokeStyle = `hsla(${hue},90%,${50 + amp * 30}%,${0.5 + amp * 0.5})`;
    ctx.lineWidth = 0.5 + amp * 2 + mv * 2;
    ctx.stroke();
  }
});

// ── SCENE 14: MANDALA ENGINE ──────────────────────────────────────
addScene("MANDALA ENGINE", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.07)";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const sym = 8;

  for (let s = 0; s < sym; s++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((s / sym) * Math.PI * 2 + f * 0.005);
    ctx.scale(s % 2 === 0 ? 1 : -1, 1);

    ctx.beginPath();
    for (let i = 0; i < 128; i++) {
      const amp = fd[i] / 255;
      const angle = (i / 128) * Math.PI;
      const r = 50 + amp * 180;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    const hue = (s * 45 + f * 0.4) % 360;
    ctx.strokeStyle = `hsla(${hue},85%,65%,0.7)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
});

// ── SCENE 15: THE CUBE ────────────────────────────────────────────
addScene("THE CUBE", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const bv = fd[2] / 255;
  const mv = fd[30] / 255;
  const size = 120 + bv * 80;
  const rx = f * 0.012;
  const ry = f * 0.008;

  // 3D cube projection
  const cos = Math.cos, sin = Math.sin;
  const project = (x, y, z) => {
    // rotate Y
    let x2 = x * cos(ry) - z * sin(ry);
    let z2 = x * sin(ry) + z * cos(ry);
    // rotate X
    let y2 = y * cos(rx) - z2 * sin(rx);
    let z3 = y * sin(rx) + z2 * cos(rx);
    const scale = 600 / (600 + z3);
    return [cx + x2 * scale, cy + y2 * scale];
  };

  const s2 = size / 2;
  const verts = [
    [-s2,-s2,-s2],[s2,-s2,-s2],[s2,s2,-s2],[-s2,s2,-s2],
    [-s2,-s2,s2],[s2,-s2,s2],[s2,s2,s2],[-s2,s2,s2]
  ];
  const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const proj = verts.map(v => project(...v));

  edges.forEach(([a, b], i) => {
    const hue = (i * 30 + f * 0.8) % 360;
    ctx.beginPath();
    ctx.moveTo(proj[a][0], proj[a][1]);
    ctx.lineTo(proj[b][0], proj[b][1]);
    ctx.strokeStyle = `hsla(${hue},90%,65%,${0.6 + bv * 0.4})`;
    ctx.lineWidth = 1 + mv * 3;
    ctx.stroke();
  });
});

// ── SCENE 16: GEODESIC ────────────────────────────────────────────
addScene("GEODESIC", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const bv = fd[2] / 255;
  const segments = 16;
  const rings = 8;

  for (let r2 = 0; r2 < rings; r2++) {
    const lat = (r2 / rings - 0.5) * Math.PI;
    const radius = 180 + bv * 80;
    const ringR = Math.cos(lat) * radius;
    const zVal = Math.sin(lat) * radius;
    const zScale = 1 + zVal / 400;

    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const lon = (i / segments) * Math.PI * 2 + f * 0.006;
      const x = cx + Math.cos(lon) * ringR * zScale;
      const y = cy + Math.sin(lon) * ringR * 0.5 + zVal * 0.5;
      const fIdx = Math.floor(i * fd.length / segments);
      const amp = fd[fIdx] / 255;
      const px = x + Math.cos(lon) * amp * 30;
      const py = y + Math.sin(lon) * amp * 30;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    const hue = (r2 * 45 + f * 0.4) % 360;
    ctx.strokeStyle = `hsla(${hue},80%,65%,0.7)`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
});

// ── SCENE 17: PEAKS + VALLEYS ─────────────────────────────────────
addScene("PEAKS + VALLEYS", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 0, W, H);

  const rows = 20;
  for (let row = 0; row < rows; row++) {
    const yBase = (row / rows) * H;
    const depth = row / rows;

    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const x = (i / 200) * W;
      const fIdx = Math.floor((i / 200) * fd.length);
      const amp = fd[fIdx] / 255;
      const noise = Math.sin(i * 0.1 + f * 0.02 + row * 0.5) * 20;
      const y = yBase - amp * 120 * (1 - depth * 0.5) - noise * depth;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    const hue = (row * 15 + f * 0.3) % 360;
    ctx.strokeStyle = `hsla(${hue},75%,65%,${0.4 + depth * 0.6})`;
    ctx.lineWidth = 1 + depth;
    ctx.stroke();
    ctx.lineTo(W, yBase + H);
    ctx.lineTo(0, yBase + H);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fill();
  }
});

// ── SCENE 18: WATERCOLOR ──────────────────────────────────────────
addScene("WATERCOLOR", (ctx, W, H, fd, td, f, dt, state) => {
  if (!state.drops) state.drops = [];
  ctx.fillStyle = "rgba(0,0,0,0.015)";
  ctx.fillRect(0, 0, W, H);

  const bv = fd[2] / 255;
  const mv = fd[30] / 255;

  if (Math.random() < 0.08 + bv * 0.3) {
    const layers = Math.floor(Math.random() * 5) + 3;
    for (let l = 0; l < layers; l++) {
      state.drops.push({
        x: Math.random() * W, y: Math.random() * H,
        r: 30 + Math.random() * 120 * (1 + bv),
        hue: Math.random() * 360, alpha: 0.1 + Math.random() * 0.2,
        life: 1.0, dr: 0.5 + Math.random()
      });
    }
  }
  if (state.drops.length > 200) state.drops.splice(0, 50);

  state.drops.forEach((d, i) => {
    d.r += d.dr;
    d.alpha *= 0.998;
    d.life -= 0.003;
    if (d.life <= 0) { state.drops.splice(i, 1); return; }

    const grd = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
    grd.addColorStop(0, `hsla(${d.hue},60%,70%,${d.alpha})`);
    grd.addColorStop(0.7, `hsla(${d.hue + 20},50%,60%,${d.alpha * 0.5})`);
    grd.addColorStop(1, `hsla(${d.hue + 40},40%,50%,0)`);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  });
});

// ── SCENE 19: KALEIDOSCOPE ────────────────────────────────────────
addScene("KALEIDOSCOPE", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const slices = 12;
  const bv = fd[2] / 255;

  for (let s = 0; s < slices; s++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((s / slices) * Math.PI * 2);
    if (s % 2 === 0) ctx.scale(1, -1);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 0; i < fd.length / 4; i++) {
      const amp = fd[i] / 255;
      const angle = (i / (fd.length / 4)) * (Math.PI * 2 / slices);
      const r = 60 + amp * 180 + Math.sin(f * 0.02 + i * 0.1) * 20;
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    const hue = (s * (360 / slices) + f * 0.6) % 360;
    ctx.fillStyle = `hsla(${hue},80%,60%,0.25)`;
    ctx.fill();
    ctx.strokeStyle = `hsla(${hue},90%,75%,0.5)`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();
  }
});

// ── SCENE 20: PARTICLE RING ───────────────────────────────────────
addScene("PARTICLE RING", (ctx, W, H, fd, td, f, dt, state) => {
  if (!state.ring) {
    state.ring = Array.from({ length: 300 }, (_, i) => ({
      angle: (i / 300) * Math.PI * 2,
      r: 180, speed: (Math.random() - 0.5) * 0.02,
      hue: Math.random() * 360, size: Math.random() * 3 + 1
    }));
  }
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const bv = fd[2] / 255;

  state.ring.forEach(p => {
    p.angle += p.speed * (1 + bv * 2);
    const fIdx = Math.floor((p.angle / (Math.PI * 2)) * fd.length);
    const amp = fd[Math.abs(fIdx) % fd.length] / 255;
    const r = p.r + amp * 120 + Math.sin(f * 0.01 + p.angle * 3) * 20;

    const x = cx + Math.cos(p.angle) * r;
    const y = cy + Math.sin(p.angle) * r;
    p.hue = (p.hue + 0.3) % 360;

    ctx.beginPath();
    ctx.arc(x, y, p.size * (1 + amp * 2), 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue},90%,70%,${0.5 + amp * 0.5})`;
    ctx.fill();
  });
});

// ── SCENE 21: TOROIDAL FLUX ───────────────────────────────────────
addScene("TOROIDAL FLUX", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const R = 140, r0 = 60;
  const steps = 60, loops = 20;
  const bv = fd[2] / 255;

  for (let loop = 0; loop < loops; loop++) {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = (i / steps) * Math.PI * 2;
      const v = (loop / loops) * Math.PI * 2 + f * 0.008;
      const fIdx = Math.floor(i * fd.length / steps);
      const amp = fd[fIdx] / 255;
      const rr = r0 + amp * 40;
      const x = cx + (R + rr * Math.cos(v)) * Math.cos(u);
      const y = cy + (R + rr * Math.cos(v)) * Math.sin(u) * 0.4 + rr * Math.sin(v) * 0.7;

      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    const hue = (loop * (360 / loops) + f * 0.5) % 360;
    ctx.strokeStyle = `hsla(${hue},85%,65%,0.7)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
});

// ── SCENE 22: HYPNOTIC GRID ───────────────────────────────────────
addScene("HYPNOTIC GRID", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 0, W, H);

  const cols = 20, rows = 12;
  const cw = W / cols, ch = H / rows;
  const bv = fd[2] / 255;

  for (let c = 0; c < cols; c++) {
    for (let r2 = 0; r2 < rows; r2++) {
      const cx2 = c * cw + cw / 2, cy2 = r2 * ch + ch / 2;
      const fIdx = Math.floor(((c + r2 * cols) / (cols * rows)) * fd.length);
      const amp = fd[fIdx] / 255;
      const size = (cw * 0.4) * (amp + 0.1);
      const rot = f * 0.02 + (c + r2) * 0.3 + amp * 2;
      const hue = (c * 18 + r2 * 25 + f * 0.5) % 360;

      ctx.save();
      ctx.translate(cx2, cy2);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.rect(-size, -size, size * 2, size * 2);
      ctx.strokeStyle = `hsla(${hue},80%,65%,${0.4 + amp * 0.6})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
});

// ── SCENE 23: TERRAIN COLLAPSE ────────────────────────────────────
addScene("TERRAIN COLLAPSE", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, 0, W, H);

  const grid = 80;
  const stepX = W / grid;
  const stepY = H / grid;
  const bv = fd[2] / 255;
  const mv = fd[40] / 255;

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.globalCompositeOperation = "lighter";

  for (let row = -grid / 2; row < grid / 2; row++) {
    ctx.beginPath();
    for (let col = -grid / 2; col < grid / 2; col++) {
      const nx = col * 0.08;
      const ny = row * 0.08;
      const field = Math.sin(nx + f * 0.015) + Math.cos(ny + f * 0.01);
      const amp = fd[Math.floor(Math.abs(col * row) % fd.length)] / 255;
      const terrain = field * 60 * (mv + 0.2) + amp * 80 * bv;
      const warpX = col * stepX + Math.sin(row * 0.1 + f * 0.01) * bv * 20;
      const warpY = row * stepY - terrain;

      col === -grid / 2 ? ctx.moveTo(warpX, warpY) : ctx.lineTo(warpX, warpY);
    }
    const hue = (row * 4 + f * 0.4) % 360;
    ctx.strokeStyle = `hsla(${hue},75%,60%,${mv + 0.3})`;
    ctx.lineWidth = 1 + bv;
    ctx.stroke();
  }
  ctx.restore();
});

// ── SCENE 24: SPHERE ──────────────────────────────────────────────
addScene("SPHERE", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const R = 180;
  const segments = 24;
  const bv = fd[2] / 255;

  for (let lat = -segments / 2; lat <= segments / 2; lat++) {
    const phi = (lat / segments) * Math.PI;
    const ringR = Math.cos(phi) * R;
    const zOff = Math.sin(phi) * R * 0.4;

    ctx.beginPath();
    for (let i = 0; i <= segments * 2; i++) {
      const lon = (i / (segments * 2)) * Math.PI * 2 + f * 0.007;
      const fIdx = Math.floor(i * fd.length / (segments * 2));
      const amp = fd[fIdx] / 255;
      const rr = ringR + amp * 40;
      const x = cx + Math.cos(lon) * rr;
      const y = cy + Math.sin(lon) * rr * 0.5 + zOff + amp * 20;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    const hue = (lat * 15 + f * 0.5) % 360;
    ctx.strokeStyle = `hsla(${hue},80%,65%,${0.5 + bv * 0.5})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
});

// ── SCENE 25: RIBBON PAINT ────────────────────────────────────────
addScene("RIBBON PAINT", (ctx, W, H, fd, td, f, dt, state) => {
  if (!state.ribbons) state.ribbons = [];
  ctx.fillStyle = "rgba(0,0,0,0.03)";
  ctx.fillRect(0, 0, W, H);

  const bv = fd[2] / 255;
  const mv = fd[30] / 255;

  if (!state.head) state.head = { x: W / 2, y: H / 2, angle: 0 };
  const h2 = state.head;
  h2.angle += (Math.random() - 0.5) * 0.3 + bv * 0.5;
  h2.x += Math.cos(h2.angle) * (3 + bv * 10);
  h2.y += Math.sin(h2.angle) * (3 + bv * 10);
  if (h2.x < 0) h2.x = W;
  if (h2.x > W) h2.x = 0;
  if (h2.y < 0) h2.y = H;
  if (h2.y > H) h2.y = 0;

  state.ribbons.push({ x: h2.x, y: h2.y, hue: (f * 2) % 360, width: 2 + bv * 8 });
  if (state.ribbons.length > 500) state.ribbons.shift();

  for (let i = 1; i < state.ribbons.length; i++) {
    const r1 = state.ribbons[i - 1], r2 = state.ribbons[i];
    ctx.beginPath();
    ctx.moveTo(r1.x, r1.y);
    ctx.lineTo(r2.x, r2.y);
    ctx.strokeStyle = `hsla(${r2.hue},90%,70%,0.6)`;
    ctx.lineWidth = r2.width;
    ctx.lineCap = "round";
    ctx.stroke();
  }
});

// ── SCENE 26: LIQUID CHROME ───────────────────────────────────────
addScene("LIQUID CHROME", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(2,2,4,0.1)";
  ctx.fillRect(0, 0, W, H);

  const cols = 60;
  const bv = fd[2] / 255;
  const mv = fd[40] / 255;

  for (let c = 0; c < cols; c++) {
    const x = (c / cols) * W;
    ctx.beginPath();
    for (let row = 0; row <= 100; row++) {
      const y = (row / 100) * H;
      const fIdx = Math.floor((c / cols) * fd.length);
      const amp = fd[fIdx] / 255;
      const wave = Math.sin(row * 0.15 + f * 0.02 + c * 0.3) * 30 * amp;
      const px = x + wave;
      row === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
    }
    const luma = 40 + c * 1.5 + bv * 30;
    ctx.strokeStyle = `hsl(${220 + mv * 60},${30 + bv * 40}%,${luma}%)`;
    ctx.lineWidth = W / cols - 1;
    ctx.stroke();
  }
});

// ── SCENE 27: SPECKLES ────────────────────────────────────────────
addScene("SPECKLES", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  ctx.fillRect(0, 0, W, H);

  const bv = fd[2] / 255;
  const count = Math.floor(200 + bv * 800);

  for (let i = 0; i < count; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const fIdx = Math.floor(Math.random() * fd.length);
    const amp = fd[fIdx] / 255;
    const r = 1 + amp * 6;
    const hue = (Math.random() * 360 + f) % 360;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue},80%,70%,${amp * 0.8})`;
    ctx.fill();
  }
});

// ── SCENE 28: FLICKERING ──────────────────────────────────────────
addScene("FLICKERING", (ctx, W, H, fd, td, f, dt, state) => {
  if (!state.flames) {
    state.flames = Array.from({ length: 80 }, () => ({
      x: Math.random() * W,
      y: H + Math.random() * 100,
      vy: -(1 + Math.random() * 3),
      vx: (Math.random() - 0.5) * 1,
      hue: Math.random() * 60, size: 10 + Math.random() * 30,
      life: Math.random()
    }));
  }
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(0, 0, W, H);

  const bv = fd[2] / 255;

  state.flames.forEach(fl => {
    fl.y += fl.vy * (1 + bv * 3);
    fl.x += fl.vx + Math.sin(f * 0.03 + fl.x * 0.01) * 1;
    fl.size *= 0.98;
    fl.life += 0.01;
    if (fl.y < -fl.size || fl.size < 1) {
      fl.x = Math.random() * W;
      fl.y = H + 50;
      fl.size = 10 + Math.random() * 40 * (1 + bv);
      fl.life = 0;
      fl.hue = Math.random() * 60;
    }

    const grd = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, fl.size);
    grd.addColorStop(0, `hsla(${60 + fl.hue},100%,90%,0.9)`);
    grd.addColorStop(0.4, `hsla(${fl.hue},100%,60%,0.7)`);
    grd.addColorStop(1, `hsla(${fl.hue},80%,30%,0)`);
    ctx.beginPath();
    ctx.arc(fl.x, fl.y, fl.size, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  });
});

// ── SCENE 29: RAINBOW SPARKLER ────────────────────────────────────
addScene("RAINBOW SPARKLER", (ctx, W, H, fd, td, f, dt, state) => {
  if (!state.sparks) state.sparks = [];
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, 0, W, H);

  const bv = fd[2] / 255;
  const mx = W / 2 + Math.sin(f * 0.01) * W * 0.3;
  const my = H / 2 + Math.cos(f * 0.007) * H * 0.3;

  const emit = Math.floor(5 + bv * 30);
  for (let i = 0; i < emit; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 8 * (1 + bv);
    state.sparks.push({
      x: mx, y: my,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      hue: Math.random() * 360, life: 1, size: 2 + Math.random() * 3
    });
  }
  if (state.sparks.length > 1000) state.sparks.splice(0, 200);

  state.sparks.forEach((sp, i) => {
    sp.x += sp.vx;
    sp.y += sp.vy;
    sp.vy += 0.1;
    sp.life -= 0.025;
    if (sp.life <= 0) { state.sparks.splice(i, 1); return; }

    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.size * sp.life, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${sp.hue},100%,70%,${sp.life})`;
    ctx.fill();
  });
});

// ── SCENE 30: SIGNAL RITUAL ───────────────────────────────────────
addScene("SIGNAL RITUAL", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const bv = fd[2] / 255;

  // Lissajous-style figure
  for (let layer = 0; layer < 5; layer++) {
    ctx.beginPath();
    const a = 3 + layer, b = 2 + layer;
    const scale = 200 + bv * 100 + layer * 20;
    for (let i = 0; i <= 500; i++) {
      const t = (i / 500) * Math.PI * 2;
      const fIdx = Math.floor(i * fd.length / 500);
      const amp = fd[fIdx] / 255;
      const x = cx + Math.sin(a * t + f * 0.01 * (layer + 1)) * (scale + amp * 50);
      const y = cy + Math.sin(b * t + layer * 0.5) * (scale * 0.7 + amp * 40);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    const hue = (layer * 70 + f * 0.6) % 360;
    ctx.strokeStyle = `hsla(${hue},80%,65%,0.5)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
});

// ── SCENE 31: CORRUPTED BRAIN ─────────────────────────────────────
addScene("CORRUPTED BRAIN", (ctx, W, H, fd, td, f, dt, state) => {
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(0, 0, W, H);

  const bv = fd[2] / 255;
  const mv = fd[40] / 255;

  // Random displacement maps
  const blocks = 30;
  for (let i = 0; i < blocks; i++) {
    const bw = Math.random() * 200 + 50;
    const bh = Math.random() * 40 + 5;
    const bx = Math.random() * W;
    const by = Math.random() * H;
    const offset = (Math.random() - 0.5) * bv * 100;
    const hue = Math.random() * 60 + 100;
    ctx.fillStyle = `hsla(${hue},70%,60%,${0.05 + mv * 0.15})`;
    ctx.fillRect(bx + offset, by, bw, bh);
  }

  // Oscilloscope fragments
  for (let seg = 0; seg < 8; seg++) {
    const yBase = Math.random() * H;
    const xStart = Math.random() * W;
    const len = 100 + Math.random() * 300;
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      const x = xStart + i;
      const fIdx = Math.floor(i * fd.length / len);
      const amp = td[fIdx % td.length] / 128 - 1;
      const y = yBase + amp * 50 * mv;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `hsla(${120 + seg * 20},90%,70%,0.6)`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
});

// ── SCENE 32: SCROLL MODE ─────────────────────────────────────────
addScene("SCROLL MODE", (ctx, W, H, fd, td, f, dt, state) => {
  if (!state.scroll) state.scroll = [];
  const bv = fd[2] / 255;

  // Shift previous frame
  ctx.drawImage(canvas, -3, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(W - 10, 0, 10, H);

  // Draw new column on the right
  const x = W - 4;
  for (let i = 0; i < H; i++) {
    const fIdx = Math.floor((i / H) * fd.length);
    const amp = fd[fIdx] / 255;
    const hue = (fIdx * 2 + f * 0.5) % 360;
    if (amp > 0.05) {
      ctx.fillStyle = `hsla(${hue},90%,${40 + amp * 40}%,${amp})`;
      ctx.fillRect(x, H - i, 4, 1);
    }
  }
});

// ================================================================
// ZEN ENGINE STATE
// ================================================================

let sceneIndex = 0;
let sceneDir = 1;
let currentSceneObj = SCENES[0];
let nextSceneObj = null;

let sceneTimer = 0;
let transitioning = false;
let transitionProgress = 0;
let transitionDuration = 3;

// Off-screen buffers for transitions
let bufA = null, bufB = null;
let bufACtx = null, bufBCtx = null;

function initBuffers() {
  bufA = document.createElement("canvas");
  bufB = document.createElement("canvas");
  bufA.width = bufB.width = canvas.width;
  bufA.height = bufB.height = canvas.height;
  bufACtx = bufA.getContext("2d");
  bufBCtx = bufB.getContext("2d");
}
initBuffers();
window.addEventListener("resize", () => { initBuffers(); resizeAll(); });

// Scene frame counters
SCENES.forEach(sc => { sc.frame = 0; sc.state = {}; });

// ================================================================
// SCENE SELECTION
// ================================================================

function getNextScene() {
  if (S.loopSingle) return currentSceneObj;

  switch (S.sequenceMode) {
    case "sequential":
      sceneIndex = (sceneIndex + 1) % SCENES.length;
      return SCENES[sceneIndex];
    case "ping_pong":
      sceneIndex += sceneDir;
      if (sceneIndex >= SCENES.length || sceneIndex < 0) {
        sceneDir *= -1;
        sceneIndex += sceneDir * 2;
      }
      return SCENES[sceneIndex];
    case "bass_trigger":
    case "random":
    default: {
      let idx;
      do { idx = Math.floor(Math.random() * SCENES.length); }
      while (idx === sceneIndex && SCENES.length > 1);
      sceneIndex = idx;
      return SCENES[idx];
    }
  }
}

// ================================================================
// TRANSITION ENGINE — 20 modes
// ================================================================

function getTransitionMode() {
  if (S.transitionMode === "random") {
    const modes = ["crossfade","flash","dissolve","wipe_left","wipe_right",
      "wipe_up","wipe_down","radial","zoom_in","zoom_out","pixel_dissolve",
      "glitch_cut","burn","checkerboard","ripple","scanline","strobe",
      "chromatic","noise_static"];
    return modes[Math.floor(Math.random() * modes.length)];
  }
  return S.transitionMode;
}

let activeTransMode = "crossfade";

function startTransition() {
  if (transitioning) return;
  transitioning = true;
  transitionProgress = 0;
  transitionDuration = S.fadeDuration;
  nextSceneObj = getNextScene();
  nextSceneObj.frame = 0;
  nextSceneObj.state = {};
  activeTransMode = getTransitionMode();
}

function applyTransition(p, mode) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  switch (mode) {
    case "crossfade":
      ctx.globalAlpha = 1;
      ctx.drawImage(bufA, 0, 0);
      ctx.globalAlpha = p;
      ctx.drawImage(bufB, 0, 0);
      ctx.globalAlpha = 1;
      break;

    case "flash": {
      if (p < 0.5) {
        ctx.globalAlpha = 1;
        ctx.drawImage(bufA, 0, 0);
        ctx.fillStyle = `rgba(255,255,255,${p * 2})`;
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.globalAlpha = 1;
        ctx.drawImage(bufB, 0, 0);
        ctx.fillStyle = `rgba(255,255,255,${(1 - p) * 2})`;
        ctx.fillRect(0, 0, W, H);
      }
      break;
    }

    case "dissolve": {
      ctx.drawImage(bufA, 0, 0);
      // Checkerboard dissolve at pixel level via compositing trick
      ctx.globalAlpha = p;
      ctx.drawImage(bufB, 0, 0);
      ctx.globalAlpha = 1;
      break;
    }

    case "wipe_left": {
      const edge = p * W;
      ctx.drawImage(bufA, 0, 0);
      ctx.drawImage(bufB, 0, 0, edge, H, 0, 0, edge, H);
      break;
    }

    case "wipe_right": {
      const edge2 = (1 - p) * W;
      ctx.drawImage(bufA, 0, 0);
      ctx.drawImage(bufB, edge2, 0, W - edge2, H, edge2, 0, W - edge2, H);
      break;
    }

    case "wipe_up": {
      const edge3 = p * H;
      ctx.drawImage(bufA, 0, 0);
      ctx.drawImage(bufB, 0, 0, W, edge3, 0, 0, W, edge3);
      break;
    }

    case "wipe_down": {
      const y0 = (1 - p) * H;
      ctx.drawImage(bufA, 0, 0);
      ctx.drawImage(bufB, 0, y0, W, H - y0, 0, y0, W, H - y0);
      break;
    }

    case "radial": {
      ctx.drawImage(bufA, 0, 0);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(W / 2, H / 2);
      ctx.arc(W / 2, H / 2, Math.max(W, H), -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(bufB, 0, 0);
      ctx.restore();
      break;
    }

    case "zoom_in": {
      ctx.drawImage(bufA, 0, 0);
      const z = 1 + p * 0.5;
      const ox = (W - W * z) / 2, oy = (H - H * z) / 2;
      ctx.globalAlpha = p;
      ctx.drawImage(bufB, ox, oy, W * z, H * z);
      ctx.globalAlpha = 1;
      break;
    }

    case "zoom_out": {
      const z2 = 1.5 - p * 0.5;
      const ox2 = (W - W * z2) / 2, oy2 = (H - H * z2) / 2;
      ctx.globalAlpha = 1 - p;
      ctx.drawImage(bufA, ox2, oy2, W * z2, H * z2);
      ctx.globalAlpha = p;
      ctx.drawImage(bufB, 0, 0);
      ctx.globalAlpha = 1;
      break;
    }

    case "pixel_dissolve": {
      ctx.drawImage(bufA, 0, 0);
      // Sample pixels from B with threshold based on p
      ctx.save();
      const blockSize = 20;
      for (let bx = 0; bx < W; bx += blockSize) {
        for (let by = 0; by < H; by += blockSize) {
          if (Math.random() < p) {
            ctx.drawImage(bufB, bx, by, blockSize, blockSize, bx, by, blockSize, blockSize);
          }
        }
      }
      ctx.restore();
      break;
    }

    case "glitch_cut": {
      if (p < 0.5) {
        ctx.drawImage(bufA, 0, 0);
        const glitches = Math.floor(p * 20);
        for (let g = 0; g < glitches; g++) {
          const sy = Math.random() * H;
          const sh2 = Math.random() * 30 + 5;
          const off = (Math.random() - 0.5) * 60;
          ctx.drawImage(bufB, 0, sy, W, sh2, off, sy, W, sh2);
        }
      } else {
        ctx.drawImage(bufB, 0, 0);
        const glitches2 = Math.floor((1 - p) * 20);
        for (let g = 0; g < glitches2; g++) {
          const sy = Math.random() * H;
          const sh2 = Math.random() * 30 + 5;
          const off = (Math.random() - 0.5) * 60;
          ctx.drawImage(bufA, 0, sy, W, sh2, off, sy, W, sh2);
        }
      }
      break;
    }

    case "burn": {
      ctx.drawImage(bufA, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = p * 0.5;
      ctx.fillStyle = `rgba(255,140,0,1)`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = p;
      ctx.drawImage(bufB, 0, 0);
      ctx.globalAlpha = 1;
      break;
    }

    case "checkerboard": {
      ctx.drawImage(bufA, 0, 0);
      const cs = 40;
      for (let bx = 0; bx < W; bx += cs) {
        for (let by = 0; by < H; by += cs) {
          const threshold = ((bx + by) / (W + H));
          if (p > threshold) {
            ctx.drawImage(bufB, bx, by, cs, cs, bx, by, cs, cs);
          }
        }
      }
      break;
    }

    case "ripple": {
      ctx.drawImage(bufA, 0, 0);
      ctx.save();
      // Ripple distortion using clip regions
      const rings2 = 12;
      for (let ri = 0; ri < rings2; ri++) {
        const rp = (ri / rings2);
        const rr = (p - rp) * Math.max(W, H) * 1.5;
        if (rr < 0) continue;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, rr, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(bufB, 0, 0);
      }
      ctx.restore();
      break;
    }

    case "scanline": {
      ctx.drawImage(bufA, 0, 0);
      const scanH = H * p;
      for (let sy = 0; sy < scanH; sy += 4) {
        ctx.drawImage(bufB, 0, sy, W, 4, 0, sy, W, 4);
      }
      break;
    }

    case "strobe": {
      const strobeOn = Math.sin(p * Math.PI * 16) > 0;
      if (p < 0.5) {
        ctx.drawImage(strobeOn ? bufB : bufA, 0, 0);
      } else {
        ctx.drawImage(strobeOn ? bufA : bufB, 0, 0);
        ctx.globalAlpha = p;
        ctx.drawImage(bufB, 0, 0);
        ctx.globalAlpha = 1;
      }
      break;
    }

    case "chromatic": {
      ctx.drawImage(bufA, 0, 0);
      const off2 = p * 30;
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = p;
      ctx.drawImage(bufB, -off2, 0);
      ctx.globalAlpha = p * 0.8;
      ctx.drawImage(bufB, off2, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = p * 0.5;
      ctx.drawImage(bufB, 0, off2);
      ctx.globalAlpha = 1;
      break;
    }

    case "noise_static": {
      if (p < 0.4) {
        ctx.globalAlpha = 1 - p / 0.4;
        ctx.drawImage(bufA, 0, 0);
        ctx.globalAlpha = 1;
        // Add noise
        for (let i = 0; i < W * H * p * 0.5; i++) {
          ctx.fillStyle = `rgba(${Math.random()*255},${Math.random()*255},${Math.random()*255},0.5)`;
          ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
        }
      } else {
        const np = (p - 0.4) / 0.6;
        ctx.globalAlpha = np;
        ctx.drawImage(bufB, 0, 0);
        ctx.globalAlpha = 1 - np;
        for (let i = 0; i < W * H * (1 - np) * 0.3; i++) {
          ctx.fillStyle = `rgba(${Math.random()*255},${Math.random()*255},${Math.random()*255},0.5)`;
          ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
        }
        ctx.globalAlpha = 1;
      }
      break;
    }

    default:
      ctx.globalAlpha = 1;
      ctx.drawImage(bufA, 0, 0);
      ctx.globalAlpha = p;
      ctx.drawImage(bufB, 0, 0);
      ctx.globalAlpha = 1;
  }
}

// ================================================================
// EFFECTS PIPELINE
// ================================================================

let globalHue = 0;
let shakeX = 0, shakeY = 0;

function applyPostFX(dt) {
  const W = canvas.width, H = canvas.height;
  const bv = bass();

  // Global hue rotation
  if (S.hueRotateSpeed > 0) {
    globalHue = (globalHue + S.hueRotateSpeed * dt * 100) % 360;
  } else {
    globalHue = S.hueShift;
  }

  // CSS filter on canvas
  let filterStr = "";
  if (S.bloom > 0) filterStr += `blur(${S.bloom * bv}px) `;
  if (S.saturation !== 1.0) filterStr += `saturate(${S.saturation}) `;
  if (S.contrast !== 1.0) filterStr += `contrast(${S.contrast}) `;
  if (S.invert) filterStr += "invert(1) ";
  canvas.style.filter = filterStr.trim() || "none";

  // Mirror H
  if (S.mirrorH) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, 0, 0, W / 2, H, 0, 0, W / 2, H);
    ctx.restore();
  }
  if (S.mirrorV) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.translate(0, H);
    ctx.scale(1, -1);
    ctx.drawImage(canvas, 0, 0, W, H / 2, 0, 0, W, H / 2);
    ctx.restore();
  }

  // Hue overlay
  const hueOverlay = document.getElementById("hueOverlay");
  if (globalHue !== 0) {
    hueOverlay.style.opacity = "0.3";
    hueOverlay.style.backgroundColor = `hsl(${globalHue},100%,50%)`;
  } else {
    hueOverlay.style.opacity = "0";
  }

  // Vignette
  document.getElementById("vignette").style.opacity = S.vignetteStrength;

  // Scanlines
  document.getElementById("scanlines").style.opacity = S.scanlines;

  // Chromatic aberration (CSS filter)
  const caLayer = document.getElementById("caLayer");
  if (S.chromaticAb > 0) {
    caLayer.style.opacity = "1";
    const px = S.chromaticAb * (bv + 0.5);
    caLayer.style.backdropFilter = `url("data:image/svg+xml,...")`;
    // Use canvas offset trick instead
    caLayer.style.opacity = "0";
    // Draw CA directly on canvas
    const amp = S.chromaticAb;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.2;
    ctx.filter = `blur(0px)`;
    // Red channel shift left
    ctx.fillStyle = "rgba(255,0,0,0.1)";
    ctx.drawImage(canvas, -amp * bv, 0);
    ctx.fillStyle = "rgba(0,255,255,0.1)";
    ctx.drawImage(canvas, amp * bv, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Bass flash
  if (S.bassFlash && isBeat) {
    ctx.fillStyle = `rgba(255,255,255,${bv * 0.15})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Beat shake
  if (S.beatShake > 0 && isBeat) {
    shakeX = (Math.random() - 0.5) * S.beatShake;
    shakeY = (Math.random() - 0.5) * S.beatShake;
  }
  shakeX *= 0.8;
  shakeY *= 0.8;
  canvas.style.transform = `translate(${shakeX}px,${shakeY}px)`;

  // Audio zoom
  if (S.audioZoom > 0) {
    const z = 1 + bv * S.audioZoom * 0.1;
    const ox3 = (W - W * z) / 2;
    const oy3 = (H - H * z) / 2;
    ctx.save();
    ctx.drawImage(canvas, 0, 0, W, H, ox3, oy3, W * z, H * z);
    ctx.restore();
  }

  // Glitch on beat
  if (S.glitchBeat && isBeat) {
    const slices2 = 5;
    for (let g = 0; g < slices2; g++) {
      const sy = Math.random() * H;
      const sh2 = Math.random() * 20 + 5;
      const off = (Math.random() - 0.5) * 40;
      try { ctx.drawImage(canvas, 0, sy, W, sh2, off, sy, W, sh2); } catch(e) {}
    }
  }

  // Film grain
  if (S.filmGrain > 0) {
    grainCtx.clearRect(0, 0, grainCanvas.width, grainCanvas.height);
    const imgData = grainCtx.createImageData(grainCanvas.width, grainCanvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.random() * 255 * S.filmGrain;
      d[i] = d[i + 1] = d[i + 2] = g;
      d[i + 3] = 60;
    }
    grainCtx.putImageData(imgData, 0, 0);
    grainCanvas.style.opacity = S.filmGrain;
  } else {
    grainCanvas.style.opacity = "0";
  }
}

// ================================================================
// SCENE INFO DISPLAY
// ================================================================

let sceneInfoTimeout = null;

function showSceneName(name) {
  if (!S.showName) return;
  const el = document.getElementById("sceneInfo");
  document.getElementById("sceneName").textContent = name;
  document.getElementById("sceneSub").textContent = `SCENE ${sceneIndex + 1} OF ${SCENES.length}`;
  el.classList.add("visible");
  clearTimeout(sceneInfoTimeout);
  sceneInfoTimeout = setTimeout(() => el.classList.remove("visible"), 3000);
}

// ================================================================
// ZEN PROGRESS BAR
// ================================================================

function updateZenBar(t) {
  const bar = document.getElementById("zenBar");
  const pct = Math.min(100, (t / S.holdTime) * 100);
  bar.style.width = pct + "%";
}

// ================================================================
// TRANSPORT
// ================================================================

const playBtn = document.getElementById("playBtn");
const progressBar = document.getElementById("progress");
const timeDisplay = document.getElementById("timeDisplay");
const volSlider = document.getElementById("volSlider");
const skipBtn = document.getElementById("skipBtn");
const openBtn = document.getElementById("openBtn");
const fileInput = document.getElementById("fileInput");

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

playBtn.onclick = async () => {
  await audioCtx.resume();
  if (audio.paused) { audio.play(); playBtn.textContent = "⏸ PAUSE"; }
  else { audio.pause(); playBtn.textContent = "▶ PLAY"; }
};

audio.ontimeupdate = () => {
  progressBar.value = audio.currentTime / (audio.duration || 1);
  timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration || 0)}`;
};

progressBar.oninput = () => {
  audio.currentTime = progressBar.value * (audio.duration || 0);
};

volSlider.oninput = () => {
  audio.volume = volSlider.value;
};

skipBtn.onclick = () => {
  if (!transitioning) startTransition();
};

openBtn.onclick = () => fileInput.click();

fileInput.onchange = () => {
  if (fileInput.files[0]) loadAudioFile(fileInput.files[0]);
};

function loadAudioFile(file) {
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.load();
  audio.play();
  audioCtx.resume();
  playBtn.textContent = "⏸ PAUSE";
}

// Drag and drop
window.addEventListener("dragover", e => {
  e.preventDefault();
  document.getElementById("dropOverlay").classList.add("active");
});
window.addEventListener("dragleave", e => {
  if (!e.relatedTarget) document.getElementById("dropOverlay").classList.remove("active");
});
window.addEventListener("drop", e => {
  e.preventDefault();
  document.getElementById("dropOverlay").classList.remove("active");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("audio")) loadAudioFile(file);
});

// Auto-hide transport
let uiTimeout = null;
function resetUITimer() {
  if (!S.autoHide) return;
  const transport = document.getElementById("transport");
  transport.classList.add("visible");
  clearTimeout(uiTimeout);
  uiTimeout = setTimeout(() => transport.classList.remove("visible"), 3000);
}
window.addEventListener("mousemove", e => {
  resetUITimer();
  const cursor = document.getElementById("cursor");
  cursor.style.left = e.clientX + "px";
  cursor.style.top = e.clientY + "px";
});

// ================================================================
// DEV PANEL BINDINGS
// ================================================================

let devPanelActive = false;

function buildDevPanel() {
  const sliders = [
    { id: "dp-holdTime",         key: "holdTime",         unit: "s" },
    { id: "dp-fadeDuration",     key: "fadeDuration",     unit: "s" },
    { id: "dp-bpmSync",          key: "bpmSync",          unit: "" },
    { id: "dp-vignetteStrength", key: "vignetteStrength", unit: "" },
    { id: "dp-scanlines",        key: "scanlines",        unit: "" },
    { id: "dp-filmGrain",        key: "filmGrain",        unit: "" },
    { id: "dp-chromaticAb",      key: "chromaticAb",      unit: "" },
    { id: "dp-hueShift",         key: "hueShift",         unit: "°" },
    { id: "dp-hueRotateSpeed",   key: "hueRotateSpeed",   unit: "" },
    { id: "dp-bloom",            key: "bloom",            unit: "px" },
    { id: "dp-saturation",       key: "saturation",       unit: "" },
    { id: "dp-contrast",         key: "contrast",         unit: "" },
    { id: "dp-beatShake",        key: "beatShake",        unit: "" },
    { id: "dp-audioZoom",        key: "audioZoom",        unit: "" },
  ];

  sliders.forEach(({ id, key, unit }) => {
    const el = document.getElementById(id);
    const valEl = document.getElementById("val-" + id.replace("dp-", ""));
    if (!el) return;
    el.value = S[key];
    if (valEl) valEl.textContent = parseFloat(S[key]).toFixed(1) + unit;
    el.addEventListener("input", () => {
      S[key] = parseFloat(el.value);
      if (valEl) valEl.textContent = parseFloat(S[key]).toFixed(1) + unit;
      saveSettings();
    });
  });

  const toggles = [
    { id: "dp-beatSwitch", key: "beatSwitch" },
    { id: "dp-invert",     key: "invert" },
    { id: "dp-mirrorH",    key: "mirrorH" },
    { id: "dp-mirrorV",    key: "mirrorV" },
    { id: "dp-bassFlash",  key: "bassFlash" },
    { id: "dp-glitchBeat", key: "glitchBeat" },
    { id: "dp-autoHide",   key: "autoHide" },
    { id: "dp-showName",   key: "showName" },
    { id: "dp-loopSingle", key: "loopSingle" },
  ];

  toggles.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = S[key];
    el.addEventListener("change", () => {
      S[key] = el.checked;
      saveSettings();
    });
  });

  const selects = [
    { id: "dp-transitionMode", key: "transitionMode" },
    { id: "dp-sequenceMode",   key: "sequenceMode" },
  ];

  selects.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = S[key];
    el.addEventListener("change", () => {
      S[key] = el.value;
      saveSettings();
    });
  });

  document.getElementById("dp-resetBtn").onclick = () => {
    Object.assign(S, DEFAULTS);
    buildDevPanel();
    saveSettings();
  };

  document.getElementById("dp-saveBtn").onclick = () => {
    saveSettings();
    const btn = document.getElementById("dp-saveBtn");
    btn.textContent = "✓ SAVED";
    setTimeout(() => btn.textContent = "⊛ SAVE PRESET", 1500);
  };
}

buildDevPanel();

// ================================================================
// KEYBINDS
// ================================================================

let perfMode = false;

window.addEventListener("keydown", async e => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");

  // Perf mode: Shift+Cmd/Ctrl+P
  if (e.shiftKey && (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "p") {
    e.preventDefault();
    perfMode = !perfMode;
    document.body.classList.toggle("perf-mode", perfMode);
    if (perfMode && !document.fullscreenElement) canvas.requestFullscreen?.().catch(() => {});
    else if (!perfMode && document.fullscreenElement) document.exitFullscreen?.();
  }

  // Dev panel: Shift+Cmd/Ctrl+U
  if (e.shiftKey && (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "u") {
    e.preventDefault();
    devPanelActive = !devPanelActive;
    document.getElementById("devPanel").classList.toggle("visible", devPanelActive);
  }

  // Play/pause: Space
  if (e.code === "Space") {
    e.preventDefault();
    await audioCtx.resume();
    if (audio.paused) { audio.play(); playBtn.textContent = "⏸ PAUSE"; }
    else { audio.pause(); playBtn.textContent = "▶ PLAY"; }
  }

  // Skip: S
  if (e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey) {
    if (!transitioning) startTransition();
  }

  // Escape
  if (e.key === "Escape") {
    if (perfMode) { perfMode = false; document.body.classList.remove("perf-mode"); }
    if (document.fullscreenElement) document.exitFullscreen?.();
  }

  // Record: L (perf mode)
  if (perfMode && e.key.toLowerCase() === "l") {
    // Video recording
    if (!window._recording) {
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      const stream = new MediaStream([
        ...canvas.captureStream(60).getTracks(),
        ...dest.stream.getTracks()
      ]);
      window._recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      window._chunks = [];
      window._recorder.ondataavailable = ev => { if (ev.data.size > 0) window._chunks.push(ev.data); };
      window._recorder.onstop = () => {
        const blob = new Blob(window._chunks, { type: "video/webm" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "zen_recording.webm";
        a.click();
      };
      window._recorder.start();
      window._recording = true;
    } else {
      window._recorder.stop();
      window._recording = false;
    }
  }
});

// ================================================================
// CURSOR + AUTO-HIDE
// ================================================================

const cursor = document.getElementById("cursor");
window.addEventListener("click", () => cursor.classList.add("big"));
window.addEventListener("mouseup", () => setTimeout(() => cursor.classList.remove("big"), 200));

// ================================================================
// ZEN INTRO SPLASH
// ================================================================

function showSplash() {
  const splash = document.getElementById("zenSplash");
  splash.style.opacity = "1";
  setTimeout(() => { splash.style.opacity = "0"; }, 2200);
  setTimeout(() => { splash.style.display = "none"; }, 3400);
}
showSplash();

// ================================================================
// MAIN LOOP
// ================================================================

let last = performance.now();
let totalFrame = 0;

function loop(now) {
  requestAnimationFrame(loop);

  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  totalFrame++;

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);
  detectBeat(dt);

  const W = canvas.width, H = canvas.height;

  // Beat-switch mode
  if (S.beatSwitch && isBeat && !transitioning) {
    startTransition();
  }

  // Render current scene to bufA
  bufACtx.clearRect(0, 0, W, H);
  if (currentSceneObj) {
    currentSceneObj.frame++;
    currentSceneObj.fn(
      bufACtx, W, H, freqData, timeData,
      currentSceneObj.frame, dt, currentSceneObj.state
    );
  }

  if (!transitioning) {
    // Normal render from bufA
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bufA, 0, 0);

    // Timer
    sceneTimer += dt;
    updateZenBar(sceneTimer);

    if (sceneTimer >= S.holdTime) {
      sceneTimer = 0;
      startTransition();
    }
  } else {
    // Render next scene to bufB
    bufBCtx.clearRect(0, 0, W, H);
    if (nextSceneObj) {
      nextSceneObj.frame++;
      nextSceneObj.fn(
        bufBCtx, W, H, freqData, timeData,
        nextSceneObj.frame, dt, nextSceneObj.state
      );
    }

    transitionProgress += dt / transitionDuration;

    if (transitionProgress >= 1) {
      // Transition complete
      transitioning = false;
      transitionProgress = 0;
      currentSceneObj = nextSceneObj;
      nextSceneObj = null;
      sceneTimer = 0;

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(bufA, 0, 0);

      showSceneName(currentSceneObj.name);
      updateZenBar(0);
    } else {
      applyTransition(transitionProgress, activeTransMode);
    }
  }

  // Post FX
  applyPostFX(dt);
}

// ================================================================
// BOOT
// ================================================================

currentSceneObj = SCENES[0];
currentSceneObj.state = {};
currentSceneObj.frame = 0;
showSceneName(currentSceneObj.name);

resetUITimer();
loop(performance.now());