// ===============================
// VISUALIZER C — LISSAJOUS SCOPE
// Vintage oscilloscope Lissajous figures driven by audio frequency ratios
// ===============================

import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let width = canvas.width;
let height = canvas.height;
let frame = 0;

function avg(s, e) {
  let v = 0;
  const len = Math.max(1, e - s);
  for (let i = s; i < e; i++) v += freqData[i] || 0;
  return (v / len) / 255;
}

const settings = {
  // Lissajous
  freqRatioA: 3,        // X frequency ratio (integer or float)
  freqRatioB: 2,        // Y frequency ratio
  phaseOffset: 0.5,     // phase delta between X and Y (radians × π)
  phaseSpeed: 0.004,    // auto-drift speed of phase
  amplitude: 0.42,      // 0..1 fraction of canvas half-size

  // Audio mapping
  bassAmplitude: 0.25,  // bass adds to amplitude
  midRatioShift: 0.0,   // mid shifts freq ratio A
  highPhaseJolt: 0.8,   // high jitters phase
  bassPhaseSpeed: 0.5,  // bass multiplies phase drift speed

  // Trail & look
  trailAlpha: 0.04,     // lower = longer phosphor trail
  lineWidth: 1.8,
  phosphorColor: 0,     // 0=green, 1=amber, 2=blue-white, 3=red
  glowStrength: 0.5,    // extra blur pass

  // Resolution
  points: 800,          // number of points per curve
  loopCount: 1,         // how many full loops to draw (1 or 2)
};

registerSceneSettings(settings);

function resize() { width = canvas.width; height = canvas.height; }
window.addEventListener("resize", resize);

// Phosphor color palettes
const PHOSPHORS = [
  { h: 120, s: 100, l: 65 },  // P31 green
  { h: 38,  s: 100, l: 60 },  // amber
  { h: 210, s: 80,  l: 80 },  // blue-white
  { h: 0,   s: 100, l: 55 },  // red
];

/* DEV PANEL */
let devPanel;
function createDevPanel() {
  devPanel = document.createElement("div");
  Object.assign(devPanel.style, {
    position: "fixed", top: "5px", left: "5px",
    padding: "10px", background: "rgba(0,8,2,0.92)",
    color: "#70ff90", fontFamily: "monospace", fontSize: "11px",
    borderRadius: "4px", border: "1px solid #1a4a1a",
    zIndex: 9999, display: "none", minWidth: "210px",
  });
  devPanel.innerHTML = `
  <b style="color:#a0ffb0;letter-spacing:2px">◉ LISSAJOUS SCOPE</b><hr style="border-color:#1a4a1a">
  <b>FIGURE</b><br>
  Freq A  <input type="range" id="freqRatioA" min="1" max="8" step="0.5"><br>
  Freq B  <input type="range" id="freqRatioB" min="1" max="8" step="0.5"><br>
  Phase Offset <input type="range" id="phaseOffset" min="0" max="2" step="0.05"><br>
  Phase Speed  <input type="range" id="phaseSpeed" min="0" max="0.02" step="0.0005"><br>
  Amplitude    <input type="range" id="amplitude" min="0.1" max="0.48" step="0.01"><br>
  Points       <input type="range" id="points" min="200" max="1600" step="50"><br>
  Loop Count   <input type="range" id="loopCount" min="1" max="4" step="1"><br>
  <hr style="border-color:#1a4a1a"><b>AUDIO</b><br>
  Bass Amplitude <input type="range" id="bassAmplitude" min="0" max="0.5" step="0.01"><br>
  Mid Ratio Shift <input type="range" id="midRatioShift" min="0" max="2" step="0.05"><br>
  High Phase Jolt <input type="range" id="highPhaseJolt" min="0" max="3" step="0.05"><br>
  Bass Phase Spd  <input type="range" id="bassPhaseSpeed" min="0" max="3" step="0.05"><br>
  <hr style="border-color:#1a4a1a"><b>LOOK</b><br>
  Trail Alpha  <input type="range" id="trailAlpha" min="0.005" max="0.3" step="0.005"><br>
  Line Width   <input type="range" id="lineWidth" min="0.5" max="5" step="0.1"><br>
  Phosphor     <input type="range" id="phosphorColor" min="0" max="3" step="1"><br>
  <span style="opacity:0.55;font-size:10px">0=green 1=amber 2=blue 3=red</span><br>
  Glow         <input type="range" id="glowStrength" min="0" max="1.5" step="0.05"><br>
  `;
  document.body.appendChild(devPanel);
  Object.keys(settings).forEach(key => {
    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;
    el.value = settings[key];
    el.addEventListener("input", e => settings[key] = parseFloat(e.target.value));
  });
}
createDevPanel();

let phase = 0;

function draw() {
  requestAnimationFrame(draw);
  if (devPanel) devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);
  const bass = avg(0, 15);
  const mid  = avg(15, 60);
  const high = avg(80, 160);

  frame++;

  // drift phase with audio influence
  phase += settings.phaseSpeed * (1 + bass * settings.bassPhaseSpeed);
  phase += high * settings.highPhaseJolt * 0.005;

  // fade trail
  ctx.fillStyle = `rgba(0,0,0,${settings.trailAlpha})`;
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const r  = Math.min(width, height) * (settings.amplitude + bass * settings.bassAmplitude);
  const phs = settings.phaseOffset * Math.PI + phase;
  const fa  = settings.freqRatioA + mid * settings.midRatioShift;
  const fb  = settings.freqRatioB;
  const n   = Math.round(settings.points);
  const loops = Math.round(settings.loopCount);

  const p = PHOSPHORS[Math.round(settings.phosphorColor)];

  // glow under-pass
  if (settings.glowStrength > 0) {
    ctx.save();
    ctx.filter = `blur(${3 + bass * 4}px)`;
    ctx.globalAlpha = settings.glowStrength * 0.3;
    ctx.strokeStyle = `hsl(${p.h},${p.s}%,${p.l}%)`;
    ctx.lineWidth = settings.lineWidth + 1;
    ctx.beginPath();
    for (let i = 0; i <= n * loops; i++) {
      const t = (i / n) * Math.PI * 2;
      const x = cx + Math.sin(fa * t + phs) * r;
      const y = cy + Math.sin(fb * t) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // sharp main trace
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `hsl(${p.h},${p.s}%,${p.l}%)`;
  ctx.lineWidth = settings.lineWidth;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i <= n * loops; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = cx + Math.sin(fa * t + phs) * r;
    const y = cy + Math.sin(fb * t) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.globalCompositeOperation = "source-over";
}

draw();

// testing out this exporting thing
export { settings, devPanel };