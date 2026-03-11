// ===============================
// VISUALIZER N — INTERFERENCE ENGINE
// Polar coordinate standing waves drawn as batched arc segments
// Multiple rotating wave systems interfere to create moiré geometry
// All geometry computed analytically — no particles, no pixel buffers
// Single path per wave system = maximum GPU throughput
// ===============================

import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let width = canvas.width;
let height = canvas.height;
let frame = 0;
let cx = width / 2, cy = height / 2;

/* ======================================================
 AUDIO
====================================================== */
function avg(s, e) {
  let v = 0, len = Math.max(1, e - s);
  for (let i = s; i < e; i++) v += freqData[i] || 0;
  return (v / len) / 255;
}

/* ======================================================
 SETTINGS
====================================================== */
const settings = {
  // Wave systems
  systemCount: 5,
  angularFreq: 6,        // petals per system
  angularFreqStep: 2,    // freq increment per system
  radialFreq: 3,         // radial oscillations
  radialFreqStep: 1,

  // Geometry
  rMin: 40,
  rMax: 280,
  radialSteps: 80,       // rings drawn per system
  angularSteps: 360,     // points per ring (resolution)

  // Audio
  bassRadialPush: 60,
  midAngularMod: 3,
  highPetalMod: 2,
  spectralRadial: 1,     // each ring reacts to its freq band

  // Rotation
  rotSpeeds: [0.003, -0.002, 0.005, -0.001, 0.004],
  rotAudioMult: 2,

  // Rendering — key: draw each system as one polyline path
  bgAlpha: 0.09,
  lineWidth: 0.9,
  skipRings: 2,          // draw every N rings (perf vs density)
  compositeMode: 0,      // 0=lighter, 1=source-over

  // Interference overlay
  drawInterference: 1,
  interferenceAlpha: 0.3,

  // Color
  hueBase: 280,
  huePerSystem: 40,
  hueTimeSpeed: 0.12,
  saturation: 90,
  lightness: 58,
  radialColorShift: 1,   // hue shifts from center outward
};

registerSceneSettings(settings);

/* ======================================================
 ROTATION ACCUMULATORS
====================================================== */
const rotAngles = new Float32Array(10);

/* ======================================================
 PRE-ALLOCATED PATH POINT BUFFER
====================================================== */
const MAX_RING_PTS = 400;
const ptX = new Float32Array(MAX_RING_PTS + 1);
const ptY = new Float32Array(MAX_RING_PTS + 1);

/* ======================================================
 RESIZE
====================================================== */
function resize() {
  width = canvas.width;
  height = canvas.height;
  cx = width / 2;
  cy = height / 2;
}
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
  <b>INTERFERENCE ENGINE</b><hr>
  System Count <input type="range" id="systemCount" min="1" max="8" step="1"><br>
  Angular Freq <input type="range" id="angularFreq" min="1" max="20" step="1"><br>
  Angular Step <input type="range" id="angularFreqStep" min="0" max="8" step="1"><br>
  Radial Freq <input type="range" id="radialFreq" min="1" max="12" step="1"><br>
  Radial Step <input type="range" id="radialFreqStep" min="0" max="6" step="1"><br>
  R Min <input type="range" id="rMin" min="0" max="150"><br>
  R Max <input type="range" id="rMax" min="80" max="500"><br>
  Radial Steps <input type="range" id="radialSteps" min="10" max="150" step="5"><br>
  Angular Steps <input type="range" id="angularSteps" min="60" max="360" step="10"><br>
  Skip Rings <input type="range" id="skipRings" min="1" max="8" step="1"><br>
  <hr><b>AUDIO</b><hr>
  Bass Radial Push <input type="range" id="bassRadialPush" min="0" max="150"><br>
  Mid Angular Mod <input type="range" id="midAngularMod" min="0" max="10" step="0.5"><br>
  High Petal Mod <input type="range" id="highPetalMod" min="0" max="6" step="0.5"><br>
  Spectral Radial <input type="range" id="spectralRadial" min="0" max="1" step="1"><br>
  Rot Audio Mult <input type="range" id="rotAudioMult" min="0" max="6" step="0.1"><br>
  <hr><b>RENDER</b><hr>
  BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.4" step="0.01"><br>
  Line Width <input type="range" id="lineWidth" min="0.3" max="4" step="0.1"><br>
  Composite Mode <input type="range" id="compositeMode" min="0" max="1" step="1"><br>
  Draw Interference <input type="range" id="drawInterference" min="0" max="1" step="1"><br>
  Interference Alpha <input type="range" id="interferenceAlpha" min="0.05" max="1" step="0.05"><br>
  <hr><b>COLOR</b><hr>
  Hue Base <input type="range" id="hueBase" min="0" max="360"><br>
  Hue Per System <input type="range" id="huePerSystem" min="0" max="90"><br>
  Hue Time Speed <input type="range" id="hueTimeSpeed" min="0" max="2" step="0.05"><br>
  Saturation <input type="range" id="saturation" min="0" max="100"><br>
  Lightness <input type="range" id="lightness" min="10" max="90"><br>
  Radial Color Shift <input type="range" id="radialColorShift" min="0" max="1" step="1"><br>
  `;
  document.body.appendChild(devPanel);
  Object.keys(settings).forEach(key => {
    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;
    el.value = settings[key];
    el.addEventListener("input", e => { settings[key] = parseFloat(e.target.value); });
  });
}
createDevPanel();

/* ======================================================
 DRAW ONE WAVE SYSTEM
====================================================== */
function drawSystem(sysIdx, bass, mid, high) {
  const af = settings.angularFreq + sysIdx * settings.angularFreqStep + high * settings.highPetalMod;
  const rf = settings.radialFreq  + sysIdx * settings.radialFreqStep;
  const rot = rotAngles[sysIdx];
  const hueBase2 = (settings.hueBase + sysIdx * settings.huePerSystem + frame * settings.hueTimeSpeed) % 360;

  const rSteps = Math.floor(settings.radialSteps);
  const aSteps = Math.min(Math.floor(settings.angularSteps), MAX_RING_PTS);
  const skip   = Math.max(1, Math.floor(settings.skipRings));
  const rMin = settings.rMin;
  const rMax = settings.rMax + bass * settings.bassRadialPush;

  for (let ri = 0; ri < rSteps; ri += skip) {
    const t = ri / rSteps;
    const baseR = rMin + t * (rMax - rMin);

    // Spectral: this ring reacts to its frequency band
    const freqBand = settings.spectralRadial
      ? Math.floor(t * 200)
      : Math.floor((sysIdx / settings.systemCount) * 180);
    const fv = (freqData[freqBand] || 0) / 255;

    // Radial modulation
    const radialMod = Math.sin(t * rf * Math.PI * 2 + frame * 0.04 + sysIdx)
                    * (20 + fv * 40 + mid * settings.midAngularMod * 10);

    // Build ring path
    ctx.beginPath();

    for (let ai = 0; ai <= aSteps; ai++) {
      const theta = (ai / aSteps) * Math.PI * 2 + rot;
      // Angular wave modulation
      const angMod = Math.sin(theta * af + frame * 0.02 + sysIdx * 0.7)
                   * (8 + fv * 20 + mid * settings.midAngularMod * 5);
      const r = baseR + radialMod + angMod;
      if (ai === 0) ctx.moveTo(cx + Math.cos(theta) * r, cy + Math.sin(theta) * r);
      else          ctx.lineTo(cx + Math.cos(theta) * r, cy + Math.sin(theta) * r);
    }
    ctx.closePath();

    const radialT = settings.radialColorShift ? t : 0.5;
    const hue   = (hueBase2 + radialT * 60) % 360;
    const alpha = 0.3 + fv * 0.5 + t * 0.2;
    ctx.strokeStyle = `hsla(${hue},${settings.saturation}%,${settings.lightness}%,${alpha})`;
    ctx.lineWidth = settings.lineWidth * (0.5 + fv * 0.8);
    ctx.stroke();
  }
}

/* ======================================================
 INTERFERENCE OVERLAY
 (Subtract/overlay second pass with slight offset — creates moiré)
====================================================== */
function drawInterferenceLine(bass, mid) {
  const segs = 128;
  const hue  = (settings.hueBase + 180 + frame * settings.hueTimeSpeed * 0.5) % 360;
  ctx.beginPath();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const theta = t * Math.PI * 2;
    const r = settings.rMin + (settings.rMax * 0.6)
            + Math.sin(theta * 12 + frame * 0.06) * (30 + bass * 50)
            + Math.cos(theta * 7  - frame * 0.04) * (20 + mid  * 40);
    if (i === 0) ctx.moveTo(cx + Math.cos(theta) * r, cy + Math.sin(theta) * r);
    else          ctx.lineTo(cx + Math.cos(theta) * r, cy + Math.sin(theta) * r);
  }
  ctx.closePath();
  ctx.strokeStyle = `hsla(${hue},${settings.saturation}%,${settings.lightness+15}%,${settings.interferenceAlpha})`;
  ctx.lineWidth = settings.lineWidth * 1.5;
  ctx.stroke();
}

/* ======================================================
 DRAW
====================================================== */
const defaultRotSpeeds = [0.003, -0.002, 0.005, -0.001, 0.004, 0.003, -0.003, 0.002];

function draw() {
  requestAnimationFrame(draw);
  if (devPanel) devPanel.style.display = devPanelActive ? "block" : "none";
  analyser.getByteFrequencyData(freqData);

  const bass = avg(0, 15);
  const mid  = avg(15, 80);
  const high = avg(80, 180);
  frame++;

  // Advance rotations
  const sysCount = Math.min(Math.floor(settings.systemCount), 8);
  for (let i = 0; i < sysCount; i++) {
    const spd = defaultRotSpeeds[i] * (1 + bass * settings.rotAudioMult);
    rotAngles[i] += spd;
  }

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = settings.compositeMode === 0 ? "lighter" : "source-over";

  for (let s = 0; s < sysCount; s++) {
    drawSystem(s, bass, mid, high);
  }

  if (settings.drawInterference) {
    drawInterferenceLine(bass, mid);
  }

  ctx.restore();
}

draw();
