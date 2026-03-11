// ===============================
// VISUALIZER I — LIQUID CRYSTAL
// Wave interference engine: dozens of point wave sources
// Each source driven by a frequency band — superposition draws interference rings
// Phase inversion on beat creates "shatter" patterns
// Rendered via raw pixel buffer for maximum trippy resolution
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
  let v = 0, len = Math.max(1, e - s);
  for (let i = s; i < e; i++) v += freqData[i] || 0;
  return (v / len) / 255;
}
function band(i) { return (freqData[Math.min(i, 255)] || 0) / 255; }

/* ======================================================
 SETTINGS
====================================================== */
const settings = {
  // Sources
  sourceCount: 8,
  sourceOrbitR: 200,
  sourceOrbitSpeed: 0.004,
  sourcePulse: 1,

  // Wave properties
  wavelength: 60,
  waveSpeed: 0.12,
  amplitude: 1.0,
  decay: 0.003,         // amplitude falloff with distance

  // Pixel resolution
  resolution: 3,        // pixel skip (1=full, 3=3x3 blocks)
  threshold: 0.0,       // field value threshold for color mapping

  // Render modes
  renderMode: 0,        // 0=continuous field, 1=contour bands, 2=both
  bandCount: 8,
  bandSharpness: 6,     // higher=sharper band edges

  // Beat response
  phaseInvert: 1,       // invert all phases on beat
  bassAmplify: 2.0,
  beatWavelengthKick: 20,

  // Source motion chaos
  chaosOrbit: 0.3,
  attractToCenter: 0.0002,

  // Rendering
  bgAlpha: 0.15,
  glowPasses: 1,

  // Color — 2 color gradient mapped to field value
  hue0: 180,            // negative field
  hue1: 30,             // positive field
  hueTimeSpeed: 0.08,
  saturation: 100,
  lightness: 55,
  invertField: 0,
};

registerSceneSettings(settings);

/* ======================================================
 WAVE SOURCE SYSTEM
====================================================== */
class WaveSource {
  constructor(idx, total) {
    this.idx = idx;
    this.angle = (idx / total) * Math.PI * 2;
    this.orbitAngle = this.angle;
    this.orbitR = settings.sourceOrbitR * (0.7 + Math.random() * 0.6);
    this.phase = 0;
    this.phaseInverted = false;
    this.freqBand = Math.floor((idx / total) * 180);
    this.hue = (idx / total) * 360;
    this.vx = 0; this.vy = 0;
  }

  get x() {
    return width / 2 + Math.cos(this.orbitAngle) * this.orbitR
           * (settings.sourcePulse ? 1 + Math.sin(frame * 0.017 + this.idx) * settings.chaosOrbit : 1);
  }
  get y() {
    return height / 2 + Math.sin(this.orbitAngle) * this.orbitR * 0.7
           * (settings.sourcePulse ? 1 + Math.cos(frame * 0.013 + this.idx * 1.3) * settings.chaosOrbit : 1);
  }

  update(bass, mid) {
    this.orbitAngle += settings.sourceOrbitSpeed * (1 + mid * 2);
    const f = band(this.freqBand);
    // Phase advances with freq amplitude
    this.phase += settings.waveSpeed * (1 + f * 2 + bass * settings.bassAmplify);
  }

  // Field contribution at (px, py)
  field(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return 0;

    const f = band(this.freqBand);
    const amp = settings.amplitude * (0.4 + f * 0.6) * Math.exp(-dist * settings.decay);
    const wl = settings.wavelength + f * settings.beatWavelengthKick * 0.3;
    const wave = Math.sin((dist / wl) * Math.PI * 2 - this.phase
                          * (this.phaseInverted ? -1 : 1));
    return amp * wave;
  }

  invertPhase() { this.phaseInverted = !this.phaseInverted; }
}

/* ======================================================
 INIT
====================================================== */
let sources = [];
function initSources() {
  sources = Array.from(
    { length: Math.floor(settings.sourceCount) },
    (_, i) => new WaveSource(i, Math.floor(settings.sourceCount))
  );
}
initSources();

/* ======================================================
 PIXEL BUFFER
====================================================== */
let imgData, buf;
let lastBufW = 0, lastBufH = 0;

function ensureBuffer() {
  if (width !== lastBufW || height !== lastBufH) {
    imgData = ctx.createImageData(width, height);
    buf = new Uint8ClampedArray(imgData.data.length);
    lastBufW = width; lastBufH = height;
  }
}

/* ======================================================
 RESIZE
====================================================== */
function resize() { width = canvas.width; height = canvas.height; initSources(); }
window.addEventListener("resize", resize);

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
  <b>LIQUID CRYSTAL</b><hr>
  Source Count <input type="range" id="sourceCount" min="2" max="20" step="1"><br>
  Source Orbit R <input type="range" id="sourceOrbitR" min="20" max="500"><br>
  Source Orbit Speed <input type="range" id="sourceOrbitSpeed" min="0" max="0.03" step="0.001"><br>
  Source Pulse <input type="range" id="sourcePulse" min="0" max="1" step="1"><br>
  Chaos Orbit <input type="range" id="chaosOrbit" min="0" max="1" step="0.05"><br>
  <hr><b>WAVES</b><hr>
  Wavelength <input type="range" id="wavelength" min="10" max="200"><br>
  Wave Speed <input type="range" id="waveSpeed" min="0" max="0.5" step="0.005"><br>
  Amplitude <input type="range" id="amplitude" min="0.1" max="3" step="0.05"><br>
  Decay <input type="range" id="decay" min="0" max="0.02" step="0.0005"><br>
  Bass Amplify <input type="range" id="bassAmplify" min="0" max="8" step="0.1"><br>
  Beat WL Kick <input type="range" id="beatWavelengthKick" min="0" max="80"><br>
  Phase Invert <input type="range" id="phaseInvert" min="0" max="1" step="1"><br>
  <hr><b>RENDER</b><hr>
  Resolution <input type="range" id="resolution" min="1" max="8" step="1"><br>
  Render Mode <input type="range" id="renderMode" min="0" max="2" step="1"><br>
  Band Count <input type="range" id="bandCount" min="2" max="20" step="1"><br>
  Band Sharpness <input type="range" id="bandSharpness" min="1" max="20"><br>
  BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.5" step="0.01"><br>
  Glow Passes <input type="range" id="glowPasses" min="1" max="4" step="1"><br>
  Invert Field <input type="range" id="invertField" min="0" max="1" step="1"><br>
  <hr><b>COLOR</b><hr>
  Hue Neg Field <input type="range" id="hue0" min="0" max="360"><br>
  Hue Pos Field <input type="range" id="hue1" min="0" max="360"><br>
  Hue Time Speed <input type="range" id="hueTimeSpeed" min="0" max="1" step="0.01"><br>
  Saturation <input type="range" id="saturation" min="0" max="100"><br>
  Lightness <input type="range" id="lightness" min="10" max="90"><br>
  `;
  document.body.appendChild(devPanel);
  Object.keys(settings).forEach(key => {
    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;
    el.value = settings[key];
    el.addEventListener("input", e => {
      settings[key] = parseFloat(e.target.value);
      if (key === "sourceCount") initSources();
    });
  });
}
createDevPanel();

/* ======================================================
 HSL to RGB (inline for pixel buffer speed)
====================================================== */
function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(p, q, h + 1/3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1/3) * 255),
  ];
}

/* ======================================================
 DRAW
====================================================== */
let lastBass = 0;

function draw() {
  requestAnimationFrame(draw);
  if (devPanel) devPanel.style.display = devPanelActive ? "block" : "none";
  analyser.getByteFrequencyData(freqData);

  const bass = avg(0, 15);
  const mid  = avg(15, 80);
  const high = avg(80, 180);
  frame++;

  // Beat: phase inversion
  if (settings.phaseInvert && bass > 0.65 && lastBass <= 0.65) {
    const n = Math.floor(Math.random() * sources.length / 2) + 1;
    for (let i = 0; i < n; i++) {
      sources[Math.floor(Math.random() * sources.length)].invertPhase();
    }
  }
  lastBass = bass;

  // Update sources
  sources.forEach(s => s.update(bass, mid));

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  ensureBuffer();
  buf.fill(0);

  const res = Math.max(1, Math.floor(settings.resolution));
  const hue0 = (settings.hue0 + frame * settings.hueTimeSpeed) % 360;
  const hue1 = (settings.hue1 + frame * settings.hueTimeSpeed) % 360;

  for (let sy = 0; sy < height; sy += res) {
    for (let sx = 0; sx < width; sx += res) {

      // Sum all wave sources at this pixel
      let total = 0;
      for (const s of sources) total += s.field(sx, sy);
      if (settings.invertField) total = -total;

      // Map field to color
      let r = 0, g = 0, b = 0, a = 0;
      const norm = Math.max(-1, Math.min(1, total));

      if (settings.renderMode === 0 || settings.renderMode === 2) {
        // Continuous: map -1..1 to hue0..hue1
        const t = (norm + 1) / 2;
        const hue = hue0 + (hue1 - hue0) * t;
        const lum = settings.lightness + Math.abs(norm) * 15;
        const rgb = hslToRgb(hue, settings.saturation, lum);
        r = rgb[0]; g = rgb[1]; b = rgb[2];
        a = Math.abs(norm) * 220 + 20;
      }

      if (settings.renderMode === 1 || settings.renderMode === 2) {
        // Contour bands: sharp rings at integer multiples
        const bands = settings.bandCount;
        const v = (total + 2) * bands; // offset so it's positive
        const frac = v - Math.floor(v);
        const edge = Math.exp(-settings.bandSharpness * Math.min(frac, 1 - frac));
        if (edge > 0.1) {
          const bandHue = (hue0 + Math.floor(v % bands) * (360 / bands) + frame) % 360;
          const rgb2 = hslToRgb(bandHue, settings.saturation, settings.lightness + 15);
          r = Math.min(255, r + rgb2[0] * edge);
          g = Math.min(255, g + rgb2[1] * edge);
          b = Math.min(255, b + rgb2[2] * edge);
          a = Math.max(a, edge * 255);
        }
      }

      if (a < 5) continue;

      for (let dy = 0; dy < res && sy + dy < height; dy++) {
        for (let dx = 0; dx < res && sx + dx < width; dx++) {
          const idx = ((sy + dy) * width + (sx + dx)) * 4;
          buf[idx]     = Math.min(255, buf[idx]     + r);
          buf[idx + 1] = Math.min(255, buf[idx + 1] + g);
          buf[idx + 2] = Math.min(255, buf[idx + 2] + b);
          buf[idx + 3] = Math.min(255, buf[idx + 3] + a);
        }
      }
    }
  }

  imgData.data.set(buf);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.putImageData(imgData, 0, 0);

  // Source glow halos
  sources.forEach(s => {
    const sx = s.x, sy = s.y;
    const f = band(s.freqBand);
    const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, 30 + f * 50);
    grd.addColorStop(0, `hsla(${s.hue}, 100%, 90%, ${0.7 + f * 0.3})`);
    grd.addColorStop(1, `hsla(${s.hue}, 100%, 60%, 0)`);
    ctx.beginPath();
    ctx.arc(sx, sy, 30 + f * 50, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  });

  // Chromatic bleed on bass
  if (bass > 0.5) {
    const offset = (bass - 0.5) * 10;
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.12;
    ctx.drawImage(canvas, offset, 0);
    ctx.drawImage(canvas, -offset, offset * 0.5);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

draw();
