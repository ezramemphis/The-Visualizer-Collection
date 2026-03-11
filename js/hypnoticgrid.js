// ===============================
// VISUALIZER O — HYPNOTIC LATTICE
// Infinite perspective grid of frequency-driven columns
// Camera flies through the lattice driven by audio
// Zero allocations: all columns stored in flat typed arrays
// Columns depth-sorted and drawn back-to-front in one pass
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
  // Grid layout
  gridCols: 16,          // columns across
  gridRows: 16,          // rows deep
  gridSpacing: 70,       // world units between columns
  columnHeight: 120,     // max column height

  // Camera
  camHeight: 80,
  camFOV: 600,
  camSpeed: 1.2,         // forward speed (Z)
  camBobAmp: 20,         // vertical bob amplitude
  camBobSpeed: 0.012,
  camSwayAmp: 15,        // side sway
  camSwaySpeed: 0.009,
  bassCamKick: 40,       // bass kicks camera up

  // Audio
  bassHeightMult: 2.5,
  midHeightMult: 1.2,
  highHeightMult: 0.8,
  spectralColumns: 1,    // each column maps to a freq band

  // Rendering
  bgAlpha: 0.15,
  drawTop: 1,            // draw column top face
  drawSides: 1,          // draw column side faces
  topAlpha: 0.7,
  sideAlpha: 0.4,
  minColumnH: 4,         // columns always at least this tall
  horizonFade: 1,        // fade out distant columns

  // Color
  hueBase: 200,
  huePerColumn: 0,       // hue per column index
  hueHeightShift: 80,    // taller columns shift hue
  hueTimeSpeed: 0.08,
  saturation: 85,
  lightness: 55,
};

registerSceneSettings(settings);

/* ======================================================
 CAMERA STATE
====================================================== */
let camZ = 0;
let camX = 0;
let camY = 0;
let camKickVel = 0;

/* ======================================================
 COLUMN CACHE — flat arrays
====================================================== */
// We'll recompute column heights from audio each frame
// No persistent particle state needed — pure analytics

/* ======================================================
 PROJECTION
====================================================== */
function project(wx, wy, wz, camFOV, camYoff) {
  const relZ = wz;
  if (relZ <= 5) return null;
  const s = camFOV / relZ;
  const sx = wx * s + width / 2;
  const sy = (wy + camYoff) * s + height / 2;
  return [sx, sy, s, relZ];
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
  <b>HYPNOTIC LATTICE</b><hr>
  Grid Cols <input type="range" id="gridCols" min="4" max="32" step="1"><br>
  Grid Rows <input type="range" id="gridRows" min="4" max="32" step="1"><br>
  Grid Spacing <input type="range" id="gridSpacing" min="20" max="200"><br>
  Column Height <input type="range" id="columnHeight" min="20" max="400"><br>
  Min Column H <input type="range" id="minColumnH" min="0" max="30"><br>
  <hr><b>CAMERA</b><hr>
  Cam Height <input type="range" id="camHeight" min="10" max="200"><br>
  Cam FOV <input type="range" id="camFOV" min="100" max="1500"><br>
  Cam Speed <input type="range" id="camSpeed" min="0" max="5" step="0.1"><br>
  Bob Amplitude <input type="range" id="camBobAmp" min="0" max="60"><br>
  Bob Speed <input type="range" id="camBobSpeed" min="0" max="0.05" step="0.001"><br>
  Sway Amp <input type="range" id="camSwayAmp" min="0" max="60"><br>
  Sway Speed <input type="range" id="camSwaySpeed" min="0" max="0.05" step="0.001"><br>
  Bass Cam Kick <input type="range" id="bassCamKick" min="0" max="150"><br>
  <hr><b>AUDIO</b><hr>
  Bass Height Mult <input type="range" id="bassHeightMult" min="0" max="6" step="0.1"><br>
  Mid Height Mult <input type="range" id="midHeightMult" min="0" max="4" step="0.1"><br>
  High Height Mult <input type="range" id="highHeightMult" min="0" max="4" step="0.1"><br>
  Spectral Columns <input type="range" id="spectralColumns" min="0" max="1" step="1"><br>
  <hr><b>RENDER</b><hr>
  BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.5" step="0.01"><br>
  Draw Top <input type="range" id="drawTop" min="0" max="1" step="1"><br>
  Draw Sides <input type="range" id="drawSides" min="0" max="1" step="1"><br>
  Top Alpha <input type="range" id="topAlpha" min="0.05" max="1" step="0.05"><br>
  Side Alpha <input type="range" id="sideAlpha" min="0.05" max="1" step="0.05"><br>
  Horizon Fade <input type="range" id="horizonFade" min="0" max="1" step="1"><br>
  <hr><b>COLOR</b><hr>
  Hue Base <input type="range" id="hueBase" min="0" max="360"><br>
  Hue Per Column <input type="range" id="huePerColumn" min="0" max="20"><br>
  Hue Height Shift <input type="range" id="hueHeightShift" min="0" max="180"><br>
  Hue Time Speed <input type="range" id="hueTimeSpeed" min="0" max="2" step="0.05"><br>
  Saturation <input type="range" id="saturation" min="0" max="100"><br>
  Lightness <input type="range" id="lightness" min="10" max="90"><br>
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
 DRAW COLUMN
====================================================== */
function drawColumn(wx, wy, wz, h, hue, depthAlpha) {
  const hw = settings.gridSpacing * 0.42;
  const fov = settings.camFOV;
  const camYOff = -settings.camHeight + camY;

  // 8 corners: bottom-4 and top-4
  const bCorners = [
    [wx - hw, wy,     wz - hw],
    [wx + hw, wy,     wz - hw],
    [wx + hw, wy,     wz + hw],
    [wx - hw, wy,     wz + hw],
  ];
  const tCorners = [
    [wx - hw, wy - h, wz - hw],
    [wx + hw, wy - h, wz - hw],
    [wx + hw, wy - h, wz + hw],
    [wx - hw, wy - h, wz + hw],
  ];

  const proj = p => {
    const relZ = p[2];
    if (relZ <= 5) return null;
    const s = fov / relZ;
    return [p[0] * s + width / 2, (p[1] + camYOff) * s + height / 2];
  };

  const bp = bCorners.map(proj);
  const tp = tCorners.map(proj);
  if (bp.some(p => !p) || tp.some(p => !p)) return;

  const lum = settings.lightness + (h / settings.columnHeight) * 20;

  // TOP face
  if (settings.drawTop && tp[0] && tp[1] && tp[2] && tp[3]) {
    ctx.beginPath();
    ctx.moveTo(tp[0][0], tp[0][1]);
    ctx.lineTo(tp[1][0], tp[1][1]);
    ctx.lineTo(tp[2][0], tp[2][1]);
    ctx.lineTo(tp[3][0], tp[3][1]);
    ctx.closePath();
    ctx.fillStyle = `hsla(${hue},${settings.saturation}%,${Math.min(90, lum + 15)}%,${settings.topAlpha * depthAlpha})`;
    ctx.fill();
    ctx.strokeStyle = `hsla(${hue},${settings.saturation}%,${Math.min(95, lum + 25)}%,${depthAlpha})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // SIDE faces — only draw the two facing camera (front and left/right)
  if (settings.drawSides) {
    // Front face (closest Z edge)
    if (bp[0] && bp[1] && tp[0] && tp[1]) {
      ctx.beginPath();
      ctx.moveTo(bp[0][0], bp[0][1]);
      ctx.lineTo(bp[1][0], bp[1][1]);
      ctx.lineTo(tp[1][0], tp[1][1]);
      ctx.lineTo(tp[0][0], tp[0][1]);
      ctx.closePath();
      ctx.fillStyle = `hsla(${hue},${settings.saturation}%,${lum}%,${settings.sideAlpha * depthAlpha})`;
      ctx.fill();
    }
    // Right face
    if (bp[1] && bp[2] && tp[1] && tp[2]) {
      ctx.beginPath();
      ctx.moveTo(bp[1][0], bp[1][1]);
      ctx.lineTo(bp[2][0], bp[2][1]);
      ctx.lineTo(tp[2][0], tp[2][1]);
      ctx.lineTo(tp[1][0], tp[1][1]);
      ctx.closePath();
      ctx.fillStyle = `hsla(${(hue + 15) % 360},${settings.saturation}%,${lum - 10}%,${settings.sideAlpha * depthAlpha * 0.7})`;
      ctx.fill();
    }
  }
}

/* ======================================================
 DRAW
====================================================== */
// Reusable sort buffer
const MAX_COLS = 1024;
const colBuf = new Float32Array(MAX_COLS * 5); // wx,wy,wz,h,fi
let colCount = 0;

function draw() {
  requestAnimationFrame(draw);
  if (devPanel) devPanel.style.display = devPanelActive ? "block" : "none";
  analyser.getByteFrequencyData(freqData);

  const bass = avg(0, 15);
  const mid  = avg(15, 80);
  const high = avg(80, 180);
  frame++;

  // Camera motion
  camZ += settings.camSpeed * (1 + bass * 0.5);
  camX = Math.sin(frame * settings.camSwaySpeed) * settings.camSwayAmp;

  // Bass cam kick
  camKickVel += bass * settings.bassCamKick * 0.1;
  camKickVel *= 0.88;
  const camBob = Math.sin(frame * settings.camBobSpeed) * settings.camBobAmp;
  camY = camBob + camKickVel;

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  const cols = Math.floor(settings.gridCols);
  const rows = Math.floor(settings.gridRows);
  const spacing = settings.gridSpacing;

  // Build visible column list
  colCount = 0;

  for (let ci = 0; ci < cols; ci++) {
    for (let ri = 0; ri < rows; ri++) {
      // World X centered
      const wx = (ci - cols / 2 + 0.5) * spacing - camX;
      // Tile Z with camera (wrap so lattice is infinite)
      const rawZ = ri * spacing;
      const tileZ = ((rawZ - camZ % spacing + camZ) % (rows * spacing) + rows * spacing) % (rows * spacing) + 5;
      const wz = tileZ;

      if (wz <= 5 || wz > rows * spacing + spacing) continue;

      // Audio height
      const fi = settings.spectralColumns
        ? Math.floor(((ci + ri * cols) / (cols * rows)) * 200)
        : Math.floor((ci / cols) * 180);
      const fv = (freqData[fi] || 0) / 255;

      const h = Math.max(
        settings.minColumnH,
        fv * settings.columnHeight * settings.bassHeightMult * (1 + bass)
        + mid * settings.columnHeight * settings.midHeightMult * 0.3
        + high * settings.columnHeight * settings.highHeightMult * 0.1
      );

      if (colCount < MAX_COLS) {
        const idx = colCount * 5;
        colBuf[idx]   = wx;
        colBuf[idx+1] = 0;
        colBuf[idx+2] = wz;
        colBuf[idx+3] = h;
        colBuf[idx+4] = fi;
        colCount++;
      }
    }
  }

  // Sort back to front by Z (simple insertion sort — small N)
  // Use a JS array for the sort (typed array sort is also fine)
  const sortArr = [];
  for (let i = 0; i < colCount; i++) {
    const idx = i * 5;
    sortArr.push([colBuf[idx], colBuf[idx+1], colBuf[idx+2], colBuf[idx+3], colBuf[idx+4]]);
  }
  sortArr.sort((a, b) => b[2] - a[2]);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const [wx, wy, wz, h, fi] of sortArr) {
    const depthT = 1 - wz / (rows * spacing);
    const depthAlpha = settings.horizonFade ? Math.max(0.05, depthT) : 1;
    const hue = (settings.hueBase + fi * settings.huePerColumn
               + (h / settings.columnHeight) * settings.hueHeightShift
               + frame * settings.hueTimeSpeed) % 360;

    drawColumn(wx, wy, wz, h, hue, depthAlpha);
  }

  ctx.restore();
}

draw();
