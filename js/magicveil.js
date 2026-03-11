// ===============================
// VISUALIZER M — LISSAJOUS CATHEDRAL
// Multi-ratio Lissajous figures stacked in 3D, rotated and layered
// Each figure is one continuous path = 1 draw call
// Phase driven by audio gives the "breathing cathedral" effect
// Parametric trails create stunning interference ghost images
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

/* ======================================================
 SETTINGS
====================================================== */
const settings = {
  // Figure structure
  figureCount: 7,
  pointsPerFigure: 400,
  freqRatioBase: 1,
  freqRatioStep: 0.5,    // ratio increment per figure

  // 3D layout
  stackMode: 0,          // 0=flat concentric, 1=3D stacked planes
  planeSpacing: 60,
  planeRotX: 0.4,        // tilt of stacking axis

  // Audio modulation
  bassScaleAmp: 0.25,    // bass scales figure size
  midPhaseSpeed: 2.0,    // mid drives phase offset speed
  highFreqMod: 0.4,      // high adds to frequency ratio
  spectralPhase: 1,      // each figure gets phase from its freq band

  // Rotation
  rotY: 0.004,
  rotZ: 0.002,
  rotAudioBoost: 1.5,

  // Rendering — ALL paths, no per-point ops
  bgAlpha: 0.1,
  lineWidth: 1.2,
  trailCount: 3,         // ghost trail figures behind main
  trailAlphaDecay: 0.5,  // each trail is this fraction of prev alpha
  trailRotOffset: 0.03,  // each trail rotated slightly

  // Color
  hueBase: 160,
  huePerFigure: 25,
  hueTimeSpeed: 0.2,
  saturation: 90,
  lightness: 60,
  depthBrightness: 1,    // brighter figures closer to viewer
};

registerSceneSettings(settings);

/* ======================================================
 PRE-ALLOCATED PATH BUFFERS
====================================================== */
const MAX_FIGS = 20;
const MAX_PTS  = 600;
// [figure][point] — store projected 2D coords
const figPX = Array.from({length: MAX_FIGS}, () => new Float32Array(MAX_PTS));
const figPY = Array.from({length: MAX_FIGS}, () => new Float32Array(MAX_PTS));
const figAlpha = new Float32Array(MAX_FIGS);
const figHue   = new Float32Array(MAX_FIGS);

// Phase accumulators per figure (advances each frame)
const phases = new Float32Array(MAX_FIGS);

/* ======================================================
 ROTATION STATE
====================================================== */
let ry = 0, rz = 0;

function rotateY(x, y, z, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x*c + z*s, y, -x*s + z*c];
}
function rotateZ(x, y, z, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x*c - y*s, x*s + y*c, z];
}

/* ======================================================
 LISSAJOUS POINT
====================================================== */
function lissajousPoint(t, freqA, freqB, phase, scaleX, scaleY) {
  const x = Math.sin(freqA * t + phase) * scaleX;
  const y = Math.sin(freqB * t) * scaleY;
  return [x, y];
}

/* ======================================================
 RESIZE
====================================================== */
function resize() { width = canvas.width; height = canvas.height; }
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
  <b>LISSAJOUS CATHEDRAL</b><hr>
  Figure Count <input type="range" id="figureCount" min="1" max="16" step="1"><br>
  Points Per Figure <input type="range" id="pointsPerFigure" min="50" max="500" step="10"><br>
  Freq Ratio Base <input type="range" id="freqRatioBase" min="1" max="5" step="0.5"><br>
  Freq Ratio Step <input type="range" id="freqRatioStep" min="0.1" max="2" step="0.1"><br>
  <hr><b>3D LAYOUT</b><hr>
  Stack Mode <input type="range" id="stackMode" min="0" max="1" step="1"><br>
  Plane Spacing <input type="range" id="planeSpacing" min="10" max="200"><br>
  Plane Rot X <input type="range" id="planeRotX" min="0" max="1.5" step="0.05"><br>
  <hr><b>AUDIO</b><hr>
  Bass Scale Amp <input type="range" id="bassScaleAmp" min="0" max="0.8" step="0.01"><br>
  Mid Phase Speed <input type="range" id="midPhaseSpeed" min="0" max="6" step="0.1"><br>
  High Freq Mod <input type="range" id="highFreqMod" min="0" max="2" step="0.05"><br>
  Spectral Phase <input type="range" id="spectralPhase" min="0" max="1" step="1"><br>
  <hr><b>ROTATION</b><hr>
  Rot Y <input type="range" id="rotY" min="0" max="0.02" step="0.0005"><br>
  Rot Z <input type="range" id="rotZ" min="0" max="0.02" step="0.0005"><br>
  Rot Audio Boost <input type="range" id="rotAudioBoost" min="0" max="5" step="0.1"><br>
  <hr><b>TRAILS</b><hr>
  Trail Count <input type="range" id="trailCount" min="0" max="8" step="1"><br>
  Trail Alpha Decay <input type="range" id="trailAlphaDecay" min="0.1" max="0.9" step="0.05"><br>
  Trail Rot Offset <input type="range" id="trailRotOffset" min="0" max="0.15" step="0.005"><br>
  BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.4" step="0.01"><br>
  Line Width <input type="range" id="lineWidth" min="0.4" max="5" step="0.1"><br>
  <hr><b>COLOR</b><hr>
  Hue Base <input type="range" id="hueBase" min="0" max="360"><br>
  Hue Per Figure <input type="range" id="huePerFigure" min="0" max="60"><br>
  Hue Time Speed <input type="range" id="hueTimeSpeed" min="0" max="2" step="0.05"><br>
  Saturation <input type="range" id="saturation" min="0" max="100"><br>
  Lightness <input type="range" id="lightness" min="10" max="90"><br>
  Depth Brightness <input type="range" id="depthBrightness" min="0" max="1" step="1"><br>
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
 DRAW FIGURE — single beginPath + stroke = 1 draw call
====================================================== */
function drawFigure(figIdx, rotYOffset, alpha) {
  const pts = Math.min(Math.floor(settings.pointsPerFigure), MAX_PTS);
  const fCount = Math.min(Math.floor(settings.figureCount), MAX_FIGS);
  const hue = figHue[figIdx];

  // Build path from pre-computed points (or recompute if needed)
  // We recompute here since rotYOffset varies per trail call
  ctx.beginPath();

  // Scale
  const baseScale = Math.min(width, height) * 0.38;

  for (let i = 0; i <= pts; i++) {
    const t = (i / pts) * Math.PI * 2;
    const [lx, ly] = lissajousPoint(
      t,
      figPX[figIdx][Math.min(i, pts - 1)],  // we'll store freqA/B differently
      figPY[figIdx][Math.min(i, pts - 1)],
      phases[figIdx],
      1, 1
    );
    // Actually just use stored projections + rotYOffset delta
    // Reproject with offset
    const ox = figPX[figIdx][i] - width / 2;
    const oy = figPY[figIdx][i] - height / 2;
    // Apply small extra rotation for trail offset
    const cos = Math.cos(rotYOffset), sin = Math.sin(rotYOffset);
    const nx = ox * cos - oy * 0, ny = oy; // just X rotation for cheapness
    const rx2 = ox * cos + ny * sin;

    if (i === 0) ctx.moveTo(rx2 + width/2, oy + height/2);
    else ctx.lineTo(rx2 + width/2, oy + height/2);
  }

  const lum = settings.depthBrightness
    ? settings.lightness + (figIdx / Math.max(1, Math.floor(settings.figureCount))) * 15
    : settings.lightness;
  ctx.strokeStyle = `hsla(${hue},${settings.saturation}%,${lum}%,${alpha})`;
  ctx.lineWidth = settings.lineWidth;
  ctx.stroke();
}

/* ======================================================
 DRAW
====================================================== */
function draw() {
  requestAnimationFrame(draw);
  if (devPanel) devPanel.style.display = devPanelActive ? "block" : "none";
  analyser.getByteFrequencyData(freqData);

  const bass = avg(0, 15);
  const mid  = avg(15, 80);
  const high = avg(80, 180);
  frame++;

  ry += settings.rotY * (1 + bass * settings.rotAudioBoost);
  rz += settings.rotZ * (1 + mid  * settings.rotAudioBoost);

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  const fCount = Math.min(Math.floor(settings.figureCount), MAX_FIGS);
  const pts    = Math.min(Math.floor(settings.pointsPerFigure), MAX_PTS);
  const cx = width / 2, cy = height / 2;
  const baseScale = Math.min(width, height) * 0.38;

  // Build all figure projections
  for (let fi = 0; fi < fCount; fi++) {
    // Advance phase
    const freqBand = Math.floor((fi / fCount) * 160);
    const fv = (freqData[freqBand] || 0) / 255;
    const phaseSpeed = settings.midPhaseSpeed * 0.003 * (1 + mid * 2);
    phases[fi] += phaseSpeed + (settings.spectralPhase ? fv * 0.008 : 0);

    const freqA = settings.freqRatioBase + fi * settings.freqRatioStep;
    const freqB = settings.freqRatioBase + fi * settings.freqRatioStep + 1;
    const freqAmod = freqA + high * settings.highFreqMod;
    const scale = baseScale * (1 + (bass * settings.bassScaleAmp) + fv * 0.15);

    figHue[fi] = (settings.hueBase + fi * settings.huePerFigure + frame * settings.hueTimeSpeed) % 360;

    for (let i = 0; i <= pts; i++) {
      const t = (i / pts) * Math.PI * 2;
      const lx = Math.sin(freqAmod * t + phases[fi]);
      const ly = Math.sin(freqB * t);

      // 3D layout
      let x3d, y3d, z3d;
      if (settings.stackMode === 1) {
        // Stacked planes
        const planeZ = (fi - fCount / 2) * settings.planeSpacing;
        x3d = lx * scale * 0.6;
        y3d = ly * scale * 0.6;
        z3d = planeZ;
        // Tilt
        const tiltC = Math.cos(settings.planeRotX), tiltS = Math.sin(settings.planeRotX);
        const ny2 = y3d * tiltC - z3d * tiltS;
        const nz2 = y3d * tiltS + z3d * tiltC;
        y3d = ny2; z3d = nz2;
      } else {
        // Concentric flat
        const ringScale = 0.4 + (fi / fCount) * 0.6;
        x3d = lx * scale * ringScale;
        y3d = ly * scale * ringScale;
        z3d = 0;
      }

      // Apply global rotation
      const [rx2, ry2, rz2] = rotateY(x3d, y3d, z3d, ry);
      const [rx3, ry3, rz3] = rotateZ(rx2, ry2, rz2, rz);

      // Perspective
      const fov = 600;
      const s = fov / (fov + rz3);
      figPX[fi][i] = rx3 * s + cx;
      figPY[fi][i] = ry3 * s + cy;
    }
    figAlpha[fi] = 0.5 + fv * 0.5;
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Draw trails (back to front)
  const trails = Math.floor(settings.trailCount);
  for (let tr = trails; tr >= 0; tr--) {
    const trailAlpha = Math.pow(settings.trailAlphaDecay, tr);
    const trailRot   = tr * settings.trailRotOffset;

    for (let fi = 0; fi < fCount; fi++) {
      const pts2 = Math.min(Math.floor(settings.pointsPerFigure), MAX_PTS);
      const hue = figHue[fi];
      const alpha = figAlpha[fi] * trailAlpha;

      ctx.beginPath();
      for (let i = 0; i <= pts2; i++) {
        const ox = figPX[fi][i] - cx;
        const oy = figPY[fi][i] - cy;
        const cos = Math.cos(trailRot), sin2 = Math.sin(trailRot);
        const nx = ox * cos - oy * sin2;
        const ny2 = ox * sin2 + oy * cos;
        if (i === 0) ctx.moveTo(nx + cx, ny2 + cy);
        else ctx.lineTo(nx + cx, ny2 + cy);
      }
      const lum = settings.depthBrightness
        ? settings.lightness + (fi / fCount) * 20 - tr * 5
        : settings.lightness;
      ctx.strokeStyle = `hsla(${hue},${settings.saturation}%,${Math.max(10,lum)}%,${alpha})`;
      ctx.lineWidth = settings.lineWidth * (1 - tr * 0.15);
      ctx.stroke();
    }
  }

  ctx.restore();
}

draw();
