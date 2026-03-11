// ===============================
// VISUALIZER D — PLASMA CELL DIVISION ENGINE
// Metaballs that split, merge, and mutate with audio — rendered via pixel shader
// ===============================

import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let width = canvas.width;
let height = canvas.height;
let frame = 0;

/* ======================================================
 AUDIO
====================================================== */

function avg(s, e) {
  let v = 0;
  const len = Math.max(1, e - s);
  for (let i = s; i < e; i++) v += freqData[i] || 0;
  return (v / len) / 255;
}

/* ======================================================
 SETTINGS
====================================================== */

const settings = {
  // Cells
  cellCount: 7,
  cellSpeed: 0.8,
  cellSize: 90,
  splitThreshold: 0.65,  // bass level that triggers split
  mergeDistance: 60,

  // Metaball field
  fieldResolution: 3,    // pixel skip (lower = sharper but slower)
  threshold: 0.8,
  fieldSmooth: 1.2,

  // Motion
  orbitSpeed: 0.006,
  bassKick: 60,
  breatheSpeed: 0.02,
  wobbleAmount: 0.3,

  // Rendering
  bgAlpha: 0.12,
  glowRadius: 40,
  drawField: 1,          // 0=contours only, 1=filled field
  contourLines: 5,

  // Color
  hueShift: 0.4,
  hueOffset: 0,
  chromaBleed: 1,
  saturation: 100,
  lightness: 55,
};

registerSceneSettings(settings);

/* ======================================================
 CELL SYSTEM
====================================================== */

class Cell {
  constructor(x, y, radius, hue) {
    this.x = x || width / 2 + (Math.random() - 0.5) * 300;
    this.y = y || height / 2 + (Math.random() - 0.5) * 300;
    this.vx = (Math.random() - 0.5) * settings.cellSpeed;
    this.vy = (Math.random() - 0.5) * settings.cellSpeed;
    this.radius = radius || settings.cellSize * (0.6 + Math.random() * 0.8);
    this.targetRadius = this.radius;
    this.hue = hue !== undefined ? hue : Math.random() * 360;
    this.phase = Math.random() * Math.PI * 2;
    this.orbitAngle = Math.random() * Math.PI * 2;
    this.orbitRadius = 80 + Math.random() * 200;
    this.life = 1.0;
    this.age = 0;
  }

  update(bass, mid, high, frame) {
    this.age++;
    this.orbitAngle += settings.orbitSpeed * (1 + mid * 2);

    // Breathing
    const breathe = Math.sin(frame * settings.breatheSpeed + this.phase) * settings.wobbleAmount;
    this.radius += (this.targetRadius * (1 + breathe) - this.radius) * 0.05;
    this.targetRadius += (settings.cellSize - this.targetRadius) * 0.01;

    // Bass kick
    this.vx += (Math.random() - 0.5) * bass * settings.bassKick * 0.05;
    this.vy += (Math.random() - 0.5) * bass * settings.bassKick * 0.05;

    // Center pull
    const cx = width / 2, cy = height / 2;
    this.vx += (cx - this.x) * 0.0004;
    this.vy += (cy - this.y) * 0.0004;

    this.vx *= 0.97;
    this.vy *= 0.97;
    this.x += this.vx;
    this.y += this.vy;

    // Wrap
    if (this.x < -200) this.x = width + 200;
    if (this.x > width + 200) this.x = -200;
    if (this.y < -200) this.y = height + 200;
    if (this.y > height + 200) this.y = -200;

    this.hue = (this.hue + settings.hueShift) % 360;
  }

  // Metaball field contribution at point (px, py)
  field(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    const distSq = dx * dx + dy * dy;
    const r = this.radius * settings.fieldSmooth;
    return (r * r) / (distSq + 0.001);
  }
}

/* ======================================================
 INIT
====================================================== */

let cells = [];

function initCells() {
  cells = [];
  for (let i = 0; i < settings.cellCount; i++) {
    const angle = (i / settings.cellCount) * Math.PI * 2;
    const r = 180;
    cells.push(new Cell(
      width / 2 + Math.cos(angle) * r,
      height / 2 + Math.sin(angle) * r,
      settings.cellSize * (0.7 + Math.random() * 0.6),
      (i / settings.cellCount) * 360
    ));
  }
}

/* ======================================================
 RESIZE
====================================================== */

function resize() {
  width = canvas.width;
  height = canvas.height;
  initCells();
}
window.addEventListener("resize", resize);
initCells();

/* ======================================================
 DEV PANEL
====================================================== */

let devPanel;

function createDevPanel() {
  devPanel = document.createElement("div");
  Object.assign(devPanel.style, {
    position: "fixed", top: "5px", left: "5px", padding: "8px",
    background: "rgba(0,0,0,0.85)", color: "#fff", fontFamily: "sans-serif",
    fontSize: "12px", borderRadius: "6px", zIndex: 9999,
    display: "none", maxHeight: "95vh", overflowY: "auto"
  });

  devPanel.innerHTML = `
  <b>PLASMA CELL DIVISION</b><hr>

  Cell Count <input type="range" id="cellCount" class="slider-main" min="2" max="20" step="1"><br>
  Cell Speed <input type="range" id="cellSpeed" class="slider-main" min="0" max="5" step="0.1"><br>
  Cell Size <input type="range" id="cellSize" class="slider-main" min="20" max="250"><br>
  Split Threshold <input type="range" id="splitThreshold" class="slider-main" min="0.2" max="0.99" step="0.01"><br>
  Merge Distance <input type="range" id="mergeDistance" class="slider-main" min="10" max="200"><br>
  <hr><b>FIELD</b><hr>
  Field Resolution <input type="range" id="fieldResolution" class="slider-main" min="1" max="8" step="1"><br>
  Threshold <input type="range" id="threshold" class="slider-main" min="0.1" max="3" step="0.05"><br>
  Field Smooth <input type="range" id="fieldSmooth" class="slider-main" min="0.3" max="3" step="0.05"><br>
  Draw Field <input type="range" id="drawField" class="slider-main" min="0" max="1" step="1"><br>
  Contour Lines <input type="range" id="contourLines" class="slider-main" min="1" max="15" step="1"><br>
  <hr><b>MOTION</b><hr>
  Orbit Speed <input type="range" id="orbitSpeed" class="slider-main" min="0" max="0.03" step="0.001"><br>
  Bass Kick <input type="range" id="bassKick" class="slider-main" min="0" max="200"><br>
  Breathe Speed <input type="range" id="breatheSpeed" class="slider-main" min="0" max="0.1" step="0.002"><br>
  Wobble Amount <input type="range" id="wobbleAmount" class="slider-main" min="0" max="2" step="0.05"><br>
  BG Alpha <input type="range" id="bgAlpha" class="slider-main" min="0.01" max="0.5" step="0.01"><br>
  Glow Radius <input type="range" id="glowRadius" class="slider-main" min="5" max="120"><br>
  <hr><b>COLOR</b><hr>
  Hue Shift <input type="range" id="hueShift" class="slider-main" min="0" max="3" step="0.05"><br>
  Hue Offset <input type="range" id="hueOffset" class="slider-main" min="0" max="360"><br>
  Chroma Bleed <input type="range" id="chromaBleed" class="slider-main" min="0" max="1" step="1"><br>
  Saturation <input type="range" id="saturation" class="slider-main" min="0" max="100"><br>
  Lightness <input type="range" id="lightness" class="slider-main" min="10" max="90"><br>
  `;

  document.body.appendChild(devPanel);

  Object.keys(settings).forEach(key => {
    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;
    el.value = settings[key];
    el.addEventListener("input", e => {
      settings[key] = parseFloat(e.target.value);
      if (key === "cellCount") initCells();
    });
  });
}

createDevPanel();

/* ======================================================
 PIXEL BUFFER
====================================================== */

let imgData, buf;
let lastW = 0, lastH = 0;

function ensureBuffer() {
  if (width !== lastW || height !== lastH) {
    imgData = ctx.createImageData(width, height);
    buf = new Uint8ClampedArray(imgData.data.length);
    lastW = width; lastH = height;
  }
}

/* ======================================================
 SPLIT / MERGE
====================================================== */

let lastBass = 0;

function handleSplitMerge(bass) {
  // Split on beat
  if (bass > settings.splitThreshold && lastBass <= settings.splitThreshold && cells.length < 20) {
    const parent = cells[Math.floor(Math.random() * cells.length)];
    const angle = Math.random() * Math.PI * 2;
    const childR = parent.radius * 0.55;
    const offset = childR;

    const c1 = new Cell(
      parent.x + Math.cos(angle) * offset,
      parent.y + Math.sin(angle) * offset,
      childR, parent.hue
    );
    const c2 = new Cell(
      parent.x - Math.cos(angle) * offset,
      parent.y - Math.sin(angle) * offset,
      childR, (parent.hue + 60) % 360
    );
    c1.vx = Math.cos(angle) * 2;
    c1.vy = Math.sin(angle) * 2;
    c2.vx = -Math.cos(angle) * 2;
    c2.vy = -Math.sin(angle) * 2;
    parent.radius *= 0.6;
    cells.push(c1, c2);
  }

  // Merge nearby cells
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const dx = cells[j].x - cells[i].x;
      const dy = cells[j].y - cells[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < settings.mergeDistance && cells.length > 2) {
        cells[i].radius = Math.min(cells[i].radius + cells[j].radius * 0.3, settings.cellSize * 2);
        cells[i].hue = (cells[i].hue + cells[j].hue) / 2;
        cells.splice(j, 1);
        break;
      }
    }
  }

  // Keep within limits
  while (cells.length > 20) cells.splice(Math.floor(Math.random() * cells.length), 1);
  while (cells.length < 2) cells.push(new Cell());

  lastBass = bass;
}

/* ======================================================
 DRAW
====================================================== */

function draw() {
  requestAnimationFrame(draw);

  if (devPanel) devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);

  const bass = avg(0, 15);
  const mid = avg(15, 80);
  const high = avg(80, 180);

  frame++;

  handleSplitMerge(bass);

  // Update cells
  cells.forEach(c => c.update(bass, mid, high, frame));

  // BG fade
  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  ensureBuffer();
  buf.fill(0);

  const res = Math.max(1, Math.floor(settings.fieldResolution));

  // Compute metaball field pixel by pixel (downsampled)
  for (let py = 0; py < height; py += res) {
    for (let px = 0; px < width; px += res) {
      let totalField = 0;
      let weightedHue = 0;
      let weightedWeight = 0;

      for (const c of cells) {
        const f = c.field(px, py);
        totalField += f;
        weightedHue += c.hue * f;
        weightedWeight += f;
      }

      if (totalField <= 0.01) continue;

      const hue = (settings.hueOffset + weightedHue / weightedWeight) % 360;
      const contourVal = totalField / settings.threshold;
      let alpha = 0;

      if (settings.drawField === 1) {
        // Filled plasma
        if (totalField > settings.threshold * 0.3) {
          const t = Math.min(1, (totalField - settings.threshold * 0.3) / (settings.threshold * 0.7));
          alpha = t * 220;
        }
      }

      // Contour rings
      const numContours = Math.floor(settings.contourLines);
      for (let ci = 1; ci <= numContours; ci++) {
        const band = settings.threshold * (ci / numContours);
        const dist = Math.abs(totalField - band);
        if (dist < 0.08 * settings.threshold) {
          alpha = Math.max(alpha, 255 * (1 - dist / (0.08 * settings.threshold)));
        }
      }

      if (alpha < 2) continue;

      // HSL to RGB
      const s = settings.saturation / 100;
      const l = (settings.lightness + mid * 20) / 100;
      const h = hue / 360;

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
      const g = Math.round(hue2rgb(p, q, h) * 255);
      const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

      // Fill res×res block
      for (let dy = 0; dy < res && py + dy < height; dy++) {
        for (let dx = 0; dx < res && px + dx < width; dx++) {
          const idx = ((py + dy) * width + (px + dx)) * 4;
          buf[idx] = Math.min(255, buf[idx] + r);
          buf[idx + 1] = Math.min(255, buf[idx + 1] + g);
          buf[idx + 2] = Math.min(255, buf[idx + 2] + b);
          buf[idx + 3] = Math.min(255, buf[idx + 3] + alpha);
        }
      }
    }
  }

  imgData.data.set(buf);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.putImageData(imgData, 0, 0);

  // Chroma bleed pass (RGB offset)
  if (settings.chromaBleed) {
    const bleed = bass * 8 + 2;
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.15;
    ctx.drawImage(canvas, bleed, 0);
    ctx.globalAlpha = 0.12;
    ctx.drawImage(canvas, -bleed, bleed);
    ctx.globalAlpha = 1;
  }

  // Glow halos around cell centers
  ctx.globalCompositeOperation = "lighter";
  cells.forEach(c => {
    const grd = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, settings.glowRadius * (1 + bass));
    grd.addColorStop(0, `hsla(${c.hue}, ${settings.saturation}%, ${settings.lightness + 20}%, 0.5)`);
    grd.addColorStop(1, `hsla(${c.hue}, ${settings.saturation}%, ${settings.lightness}%, 0)`);
    ctx.beginPath();
    ctx.arc(c.x, c.y, settings.glowRadius * (1 + bass), 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  });

  ctx.restore();
}

draw();
