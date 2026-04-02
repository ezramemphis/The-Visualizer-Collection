// ===============================
// VISUALIZER — WAVEFORM RIBBON
// A mirrored, color-shifting waveform ribbon that breathes with the music.
// ===============================

import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let width  = canvas.width;
let height = canvas.height;
let frame  = 0;

// We need the time-domain waveform too
const waveData = new Uint8Array(analyser.fftSize || 2048);

/* ======================================================
   AUDIO HELPERS
====================================================== */

function avg(s, e) {
  let v = 0; const len = Math.max(1, e - s);
  for (let i = s; i < e; i++) v += freqData[i] || 0;
  return (v / len) / 255;
}

/* ======================================================
   SETTINGS
====================================================== */

const settings = {
  // --- LAYOUT ---
  yOffset:         0,      // vertical center shift (-1..1 of height)
  ribbonThickness: 120,    // max half-thickness of the ribbon in px
  zoom:            1.0,    // horizontal stretch
  mirror:          1,      // 0=single, 1=top+bottom mirror
  smoothing:       0.75,   // waveform smoothing (0=raw, 0.99=very smooth)

  // --- COLOR ---
  colorMode:       2,      // 0=white, 1=fixed hue, 2=hue cycle
  hue:             200,
  hueCycleSpeed:   0.3,
  saturation:      90,
  lightness:       60,
  fillOpacity:     0.35,   // inside ribbon fill alpha
  strokeOpacity:   0.9,
  strokeWidth:     1.5,

  // --- MOTION ---
  drift:           0.002,  // subtle horizontal drift speed
  vertJitter:      0.0,    // random vertical jitter per frame

  // --- REACTION ---
  bassLift:        40,     // bass pumps the ribbon upward
  highFreqDetail:  1.5,    // treble sharpens waveform detail
  ampScale:        1.0,    // overall amplitude multiplier

  // --- BACKGROUND ---
  bgAlpha:         0.18,   // trail fade (lower = longer trails)
  bgColor:         0,      // 0=black, 1=dark hue tint

  // --- EXTRAS ---
  centerLine:      1,      // draw center baseline (0=off)
  centerLineAlpha: 0.15,
  glow:            1,      // soft glow pass (0=off)
  glowBlur:        12,     // px
  glowAlpha:       0.3,
};

registerSceneSettings(settings);

/* ======================================================
   STATE
====================================================== */

let currentHue = settings.hue;
let driftOffset = 0;

/* ======================================================
   RESIZE
====================================================== */

function resize() { width = canvas.width; height = canvas.height; }
window.addEventListener("resize", resize);
resize();

/* ======================================================
   DEV PANEL
====================================================== */

let devPanel;

function createDevPanel() {
  devPanel = document.createElement("div");
  Object.assign(devPanel.style, {
    position: "fixed", top: "5px", left: "5px",
    padding: "10px 14px", background: "rgba(0,0,0,0.88)",
    color: "#eee", fontFamily: "monospace", fontSize: "11px",
    borderRadius: "6px", zIndex: 9999,
    display: "none", maxHeight: "95vh", overflowY: "auto",
    lineHeight: "1.9",
  });

  devPanel.innerHTML = `
<b>〜 WAVEFORM RIBBON</b><hr>

<b>— LAYOUT —</b><br>
Y Offset          <input type="range" id="yOffset"         min="-1" max="1" step="0.01" style="width:110px"><br>
Ribbon Thickness  <input type="range" id="ribbonThickness" min="10" max="400" style="width:110px"><br>
Zoom              <input type="range" id="zoom"            min="0.2" max="3" step="0.05" style="width:110px"><br>
Mirror <small>(0=off 1=on)</small>
                  <input type="range" id="mirror"          min="0" max="1" step="1" style="width:110px"><br>
Smoothing         <input type="range" id="smoothing"       min="0" max="0.99" step="0.01" style="width:110px"><br>

<hr><b>— COLOR —</b><br>
Color Mode <small>(0=white 1=fixed 2=cycle)</small>
                  <input type="range" id="colorMode"       min="0" max="2" step="1" style="width:110px"><br>
Hue               <input type="range" id="hue"            min="0" max="360" style="width:110px"><br>
Hue Cycle Speed   <input type="range" id="hueCycleSpeed"  min="0" max="3" step="0.05" style="width:110px"><br>
Saturation        <input type="range" id="saturation"     min="0" max="100" style="width:110px"><br>
Lightness         <input type="range" id="lightness"      min="10" max="100" style="width:110px"><br>
Fill Opacity      <input type="range" id="fillOpacity"    min="0" max="1" step="0.01" style="width:110px"><br>
Stroke Opacity    <input type="range" id="strokeOpacity"  min="0" max="1" step="0.01" style="width:110px"><br>
Stroke Width      <input type="range" id="strokeWidth"    min="0.5" max="8" step="0.1" style="width:110px"><br>

<hr><b>— MOTION —</b><br>
Drift             <input type="range" id="drift"          min="0" max="0.02" step="0.0005" style="width:110px"><br>
Vert Jitter       <input type="range" id="vertJitter"     min="0" max="10" step="0.1" style="width:110px"><br>

<hr><b>— AUDIO REACTION —</b><br>
Bass Lift         <input type="range" id="bassLift"       min="0" max="150" style="width:110px"><br>
High Freq Detail  <input type="range" id="highFreqDetail" min="0" max="5" step="0.1" style="width:110px"><br>
Amp Scale         <input type="range" id="ampScale"       min="0.1" max="5" step="0.05" style="width:110px"><br>

<hr><b>— BACKGROUND —</b><br>
BG Trail Alpha    <input type="range" id="bgAlpha"        min="0.01" max="1" step="0.005" style="width:110px"><br>
BG Tint <small>(0=black 1=hue)</small>
                  <input type="range" id="bgColor"        min="0" max="1" step="1" style="width:110px"><br>

<hr><b>— EXTRAS —</b><br>
Center Line <small>(0/1)</small>
                  <input type="range" id="centerLine"     min="0" max="1" step="1" style="width:110px"><br>
Center Line Alpha <input type="range" id="centerLineAlpha" min="0" max="1" step="0.01" style="width:110px"><br>
Glow <small>(0/1)</small>
                  <input type="range" id="glow"           min="0" max="1" step="1" style="width:110px"><br>
Glow Blur         <input type="range" id="glowBlur"       min="0" max="40" style="width:110px"><br>
Glow Alpha        <input type="range" id="glowAlpha"      min="0" max="1" step="0.01" style="width:110px"><br>
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
   SMOOTHED WAVEFORM BUFFER
====================================================== */

let smoothWave = null;

function getSmoothedWave() {
  analyser.getByteTimeDomainData(waveData);
  const n = waveData.length;
  if (!smoothWave) smoothWave = new Float32Array(n).fill(128);
  const alpha = settings.smoothing;
  for (let i = 0; i < n; i++) {
    smoothWave[i] = alpha * smoothWave[i] + (1 - alpha) * waveData[i];
  }
  return smoothWave;
}

/* ======================================================
   DRAW
====================================================== */

function draw() {
  requestAnimationFrame(draw);
  if (devPanel) devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);
  frame++;

  /* hue */
  if (settings.colorMode === 2) currentHue = (currentHue + settings.hueCycleSpeed) % 360;
  else currentHue = settings.hue;

  const bass = avg(0, 20);
  const high = avg(80, 180);

  driftOffset += settings.drift;

  /* ---- BACKGROUND FADE ---- */
  let bgFill;
  if (settings.bgColor === 1) {
    bgFill = `hsla(${currentHue},40%,8%,${settings.bgAlpha})`;
  } else {
    bgFill = `rgba(0,0,0,${settings.bgAlpha})`;
  }
  ctx.fillStyle = bgFill;
  ctx.fillRect(0, 0, width, height);

  /* ---- CENTER LINE ---- */
  const cy = height / 2 + settings.yOffset * height / 2 +
             (Math.random() - 0.5) * settings.vertJitter;
  if (settings.centerLine) {
    ctx.save();
    ctx.globalAlpha  = settings.centerLineAlpha;
    ctx.strokeStyle  = settings.colorMode === 0
      ? "#fff"
      : `hsl(${currentHue},${settings.saturation}%,${settings.lightness}%)`;
    ctx.lineWidth    = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();
    ctx.restore();
  }

  /* ---- WAVEFORM ---- */
  const wave = getSmoothedWave();
  const n    = wave.length;
  const zoom = settings.zoom;
  // only render middle portion for zoom
  const startI = Math.floor(n * (1 - 1/zoom) / 2);
  const endI   = Math.floor(n * (1 + 1/zoom) / 2);
  const sliceN = endI - startI;

  const getColor = (alpha) => settings.colorMode === 0
    ? `rgba(255,255,255,${alpha})`
    : `hsla(${currentHue},${settings.saturation}%,${settings.lightness}%,${alpha})`;

  function drawRibbon(mirror) {
    const ySign = mirror ? -1 : 1;
    ctx.beginPath();

    // top edge (forward)
    for (let i = 0; i < sliceN; i++) {
      const x = (i / sliceN) * width;
      const sample = (wave[startI + i] - 128) / 128;
      const amp = sample * settings.ribbonThickness * settings.ampScale
                  * (1 + high * settings.highFreqDetail)
                  + bass * settings.bassLift * ySign * -1;
      const y = cy + ySign * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    // bottom edge (backward) → ribbon fill
    for (let i = sliceN - 1; i >= 0; i--) {
      const x = (i / sliceN) * width;
      const y = cy - ySign * 1; // thin center line baseline
      ctx.lineTo(x, y);
    }
    ctx.closePath();

    // fill
    if (settings.fillOpacity > 0) {
      const grad = ctx.createLinearGradient(0, cy - settings.ribbonThickness, 0, cy + settings.ribbonThickness);
      if (settings.colorMode === 0) {
        grad.addColorStop(0, `rgba(255,255,255,${settings.fillOpacity})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
      } else {
        grad.addColorStop(0, `hsla(${currentHue},${settings.saturation}%,${settings.lightness}%,${settings.fillOpacity})`);
        grad.addColorStop(1, `hsla(${currentHue},${settings.saturation}%,${settings.lightness}%,0)`);
      }
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // stroke top edge only
    ctx.beginPath();
    for (let i = 0; i < sliceN; i++) {
      const x = (i / sliceN) * width;
      const sample = (wave[startI + i] - 128) / 128;
      const amp = sample * settings.ribbonThickness * settings.ampScale
                  * (1 + high * settings.highFreqDetail)
                  + bass * settings.bassLift * ySign * -1;
      const y = cy + ySign * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = getColor(settings.strokeOpacity);
    ctx.lineWidth   = settings.strokeWidth;
    ctx.stroke();
  }

  /* glow pass */
  if (settings.glow) {
    ctx.save();
    ctx.filter      = `blur(${settings.glowBlur}px)`;
    ctx.globalAlpha = settings.glowAlpha;
    drawRibbon(false);
    if (settings.mirror) drawRibbon(true);
    ctx.restore();
    ctx.filter = "none";
  }

  /* main ribbon */
  drawRibbon(false);
  if (settings.mirror) drawRibbon(true);
}

draw();

export { settings, devPanel };
