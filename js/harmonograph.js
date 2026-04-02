// ===============================
// VISUALIZER G — RADIAL HARMONOGRAPH
// Simulates a double-pendulum harmonograph drawing on rotating paper
// Frequency ratios create slowly-evolving interference patterns
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
  // Pendulum A (drives X)
  freqA: 2.001,         // near-integer = Lissajous, irrational = fills space
  ampA: 0.40,
  dampA: 0.00015,       // decay per tick (0 = no decay, >0 = spiral inward)
  phaseA: 0.0,

  // Pendulum B (drives Y)
  freqB: 3.0,
  ampB: 0.38,
  dampB: 0.0002,
  phaseB: 1.57,         // π/2 default

  // Table rotation (rotating paper)
  tableSpeed: 0.0008,
  tableEnabled: 1,

  // Drawing
  drawSpeed: 0.04,      // t increment per frame
  drawPerFrame: 3,      // line segments per frame
  autoReset: 1,         // auto-reset when amplitude decays too small
  resetThreshold: 0.03,

  // Audio
  bassForcePendA: 0.15,  // bass injects energy into pendulum A
  midForcePendB: 0.1,
  highFreqShift: 0.03,   // high shifts freqA slightly
  bassTableSpin: 0.3,    // bass spins table faster

  // Color
  colorMode: 0,          // 0=age (time), 1=speed, 2=mono
  hueBase: 50,
  hueRange: 200,
  saturation: 85,
  luminance: 62,
  alphaDecay: 1,         // 1=fade as pendulum decays, 0=constant

  // Look
  trailAlpha: 0.025,
  lineWidth: 1.3,
  glowStrength: 0.3,
};

registerSceneSettings(settings);

function resize() { width = canvas.width; height = canvas.height; }
window.addEventListener("resize", resize);

let devPanel;
function createDevPanel() {
  devPanel = document.createElement("div");
  Object.assign(devPanel.style, {
    position: "fixed", top: "5px", left: "5px",
    padding: "10px", background: "rgba(8,5,0,0.93)",
    color: "#ffc060", fontFamily: "monospace", fontSize: "11px",
    borderRadius: "4px", border: "1px solid #7a4a00",
    zIndex: 9999, display: "none", minWidth: "215px",
  });
  devPanel.innerHTML = `
  <b style="color:#ffe090;letter-spacing:2px">〜 HARMONOGRAPH 〜</b><hr style="border-color:#7a4a00">
  <b>PENDULUM A (X)</b><br>
  Frequency <input type="range" id="freqA" min="1" max="8" step="0.001"><br>
  Amplitude <input type="range" id="ampA" min="0.05" max="0.48" step="0.01"><br>
  Damping   <input type="range" id="dampA" min="0" max="0.002" step="0.00005"><br>
  Phase A   <input type="range" id="phaseA" min="0" max="6.28" step="0.05"><br>
  <b>PENDULUM B (Y)</b><br>
  Frequency <input type="range" id="freqB" min="1" max="8" step="0.001"><br>
  Amplitude <input type="range" id="ampB" min="0.05" max="0.48" step="0.01"><br>
  Damping   <input type="range" id="dampB" min="0" max="0.002" step="0.00005"><br>
  Phase B   <input type="range" id="phaseB" min="0" max="6.28" step="0.05"><br>
  <b>TABLE</b><br>
  Table Speed   <input type="range" id="tableSpeed" min="-0.005" max="0.005" step="0.0001"><br>
  Table Enabled <input type="range" id="tableEnabled" min="0" max="1" step="1"><br>
  <hr style="border-color:#7a4a00"><b>DRAWING</b><br>
  Draw Speed    <input type="range" id="drawSpeed" min="0.005" max="0.2" step="0.005"><br>
  Per Frame     <input type="range" id="drawPerFrame" min="1" max="10" step="1"><br>
  Auto Reset    <input type="range" id="autoReset" min="0" max="1" step="1"><br>
  Reset Thresh  <input type="range" id="resetThreshold" min="0.01" max="0.15" step="0.005"><br>
  <hr style="border-color:#7a4a00"><b>AUDIO</b><br>
  Bass→Pend A  <input type="range" id="bassForcePendA" min="0" max="0.5" step="0.01"><br>
  Mid→Pend B   <input type="range" id="midForcePendB" min="0" max="0.4" step="0.01"><br>
  High Freq+   <input type="range" id="highFreqShift" min="0" max="0.2" step="0.005"><br>
  Bass Table   <input type="range" id="bassTableSpin" min="0" max="2" step="0.05"><br>
  <hr style="border-color:#7a4a00"><b>COLOR</b><br>
  Color Mode   <input type="range" id="colorMode" min="0" max="2" step="1"><br>
  <span style="opacity:0.55;font-size:10px">0=age 1=speed 2=mono</span><br>
  Hue Base     <input type="range" id="hueBase" min="0" max="360" step="1"><br>
  Hue Range    <input type="range" id="hueRange" min="0" max="360" step="1"><br>
  Saturation   <input type="range" id="saturation" min="0" max="100" step="1"><br>
  Luminance    <input type="range" id="luminance" min="20" max="90" step="1"><br>
  Alpha Decay  <input type="range" id="alphaDecay" min="0" max="1" step="1"><br>
  <hr style="border-color:#7a4a00"><b>LOOK</b><br>
  Trail Alpha  <input type="range" id="trailAlpha" min="0.005" max="0.2" step="0.005"><br>
  Line Width   <input type="range" id="lineWidth" min="0.3" max="4" step="0.1"><br>
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

// Pendulum state
let tPend = 0;
let ampA_cur = 0, ampB_cur = 0;
let tableAngle = 0;
let lastX = null, lastY = null;
let totalAge = 0; // track overall drawing age for color

function resetPendulum() {
  tPend = 0;
  ampA_cur = settings.ampA;
  ampB_cur = settings.ampB;
  lastX = null; lastY = null;
  totalAge = 0;
  // clear canvas
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.fillRect(0, 0, width, height);
}
resetPendulum();

function getPendulumXY(t, audioAmpA, audioAmpB, audioFreqShift) {
  const scale = Math.min(width, height) / 2;
  const fA = settings.freqA + audioFreqShift;
  const fB = settings.freqB;

  const rawX = audioAmpA * Math.sin(fA * t + settings.phaseA);
  const rawY = audioAmpB * Math.sin(fB * t + settings.phaseB);

  // table rotation
  const tableA = tableAngle;
  const rx = rawX * Math.cos(tableA) - rawY * Math.sin(tableA);
  const ry = rawX * Math.sin(tableA) + rawY * Math.cos(tableA);

  return {
    x: width / 2 + rx * scale,
    y: height / 2 + ry * scale,
    speed: Math.sqrt((fA * audioAmpA * Math.cos(fA * t + settings.phaseA))**2 +
                     (fB * audioAmpB * Math.cos(fB * t + settings.phaseB))**2)
  };
}

function draw() {
  requestAnimationFrame(draw);
  if (devPanel) devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);
  const bass = avg(0, 15);
  const mid  = avg(15, 60);
  const high = avg(80, 160);

  frame++;

  // audio injects energy into amplitudes
  ampA_cur += bass * settings.bassForcePendA * 0.005;
  ampB_cur += mid  * settings.midForcePendB  * 0.005;

  // clamp amplitude
  ampA_cur = Math.min(settings.ampA * 1.5, ampA_cur);
  ampB_cur = Math.min(settings.ampB * 1.5, ampB_cur);

  // damping
  const step = settings.drawSpeed;
  const dPF  = Math.round(settings.drawPerFrame);

  // table spins
  if (settings.tableEnabled === 1) {
    tableAngle += settings.tableSpeed + bass * settings.bassTableSpin * 0.002;
  }

  // auto-reset when too small
  if (settings.autoReset === 1 && ampA_cur < settings.resetThreshold && ampB_cur < settings.resetThreshold) {
    resetPendulum();
  }

  // trail fade
  ctx.fillStyle = `rgba(0,0,0,${settings.trailAlpha})`;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "lighter";

  for (let d = 0; d < dPF; d++) {
    // decay amplitudes
    ampA_cur *= (1 - settings.dampA);
    ampB_cur *= (1 - settings.dampB);

    const audioFreqShift = high * settings.highFreqShift;
    const { x, y, speed } = getPendulumXY(tPend, ampA_cur, ampB_cur, audioFreqShift);

    tPend += step / dPF;
    totalAge++;

    if (lastX !== null) {
      const ageFrac = Math.min(1, totalAge / 2000);
      const maxAmp = Math.max(settings.ampA, settings.ampB);
      const currentAmpFrac = (ampA_cur + ampB_cur) / (maxAmp * 2);
      const alpha = settings.alphaDecay === 1
        ? 0.3 + currentAmpFrac * 0.7
        : 1.0;

      const mode = Math.round(settings.colorMode);
      let hue;
      if (mode === 0) hue = settings.hueBase + (ageFrac * settings.hueRange) % 360;
      else if (mode === 1) hue = settings.hueBase + (speed * 100) % settings.hueRange;
      else hue = settings.hueBase;

      hue = hue % 360;

      // glow
      if (settings.glowStrength > 0) {
        ctx.save();
        ctx.filter = `blur(${2 + bass * 3}px)`;
        ctx.globalAlpha = settings.glowStrength * alpha * 0.3;
        ctx.strokeStyle = `hsl(${hue},${settings.saturation}%,${settings.luminance}%)`;
        ctx.lineWidth = settings.lineWidth + 1;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.filter = "none";
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      ctx.strokeStyle = `hsla(${hue},${settings.saturation}%,${settings.luminance}%,${alpha})`;
      ctx.lineWidth = settings.lineWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    lastX = x; lastY = y;
  }

  ctx.globalCompositeOperation = "source-over";
}

draw();
