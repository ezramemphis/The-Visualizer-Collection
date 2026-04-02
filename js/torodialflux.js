// ===============================
// VISUALIZER K — TOROIDAL FLUX
// Torus knot geometry with batched path rendering
// Zero shadow blur, zero pixel buffers, zero per-frame allocations
// All geometry pre-allocated, audio morphs parameters in-place
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
  // Knot geometry
  p: 3,              // torus knot p-winding
  q: 2,              // torus knot q-winding
  segments: 300,     // curve resolution
  tubeRadius: 0.22,  // tube cross-section radius
  tubeSegs: 8,       // cross-section polygon sides
  torusR: 220,       // major radius
  torusr: 90,        // minor radius

  // Audio response
  bassInflate: 60,
  midMorph: 0.4,     // morphs p/q in-place
  highRipple: 0.08,
  spectralWarp: 40,

  // Rotation
  rotX: 0.004,
  rotY: 0.006,
  rotZ: 0.002,
  rotAudioMult: 2,

  // Rendering
  bgAlpha: 0.12,
  lineWidth: 1.4,
  drawTube: 1,       // 0=spine only, 1=tube cross-sections
  depthScale: 1,     // perspective depth

  // Color
  hueBase: 180,
  hueRange: 200,
  hueTimeSpeed: 0.3,
  saturation: 90,
  lightness: 60,
};

registerSceneSettings(settings);

/* ======================================================
 PRE-ALLOCATED GEOMETRY ARRAYS
====================================================== */
const MAX_SEGS = 600;
// Spine points in 3D (x,y,z) + projected (px,py) + depth
const spineX  = new Float32Array(MAX_SEGS);
const spineY  = new Float32Array(MAX_SEGS);
const spineZ  = new Float32Array(MAX_SEGS);
const spinePX = new Float32Array(MAX_SEGS);
const spinePY = new Float32Array(MAX_SEGS);
const spineD  = new Float32Array(MAX_SEGS);  // depth 0..1

// Rotation state (Euler angles)
let rx = 0, ry = 0, rz = 0;

/* ======================================================
 TORUS KNOT MATH
====================================================== */
function torusKnotPoint(t, p, q, R, r, out) {
  const phi = t * Math.PI * 2 * p;
  const theta = t * Math.PI * 2 * q;
  const cx = (R + r * Math.cos(theta)) * Math.cos(phi);
  const cy = (R + r * Math.cos(theta)) * Math.sin(phi);
  const cz = r * Math.sin(theta);
  out[0] = cx; out[1] = cy; out[2] = cz;
}

// Rotate a point around X then Y then Z
function rotatePoint(x, y, z) {
  // X
  let y1 = y * Math.cos(rx) - z * Math.sin(rx);
  let z1 = y * Math.sin(rx) + z * Math.cos(rx);
  // Y
  let x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
  let z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
  // Z
  let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
  let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
  return [x3, y3, z2];
}

// Perspective projection
function project(x, y, z) {
  const fov = 600 + settings.depthScale * 200;
  const s = fov / (fov + z);
  return [x * s + width / 2, y * s + height / 2, s];
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
  <b>TOROIDAL FLUX</b><hr>
  P Winding <input type="range" id="p" min="1" max="8" step="1"><br>
  Q Winding <input type="range" id="q" min="1" max="8" step="1"><br>
  Segments <input type="range" id="segments" min="60" max="500" step="10"><br>
  Tube Radius <input type="range" id="tubeRadius" min="0.02" max="0.6" step="0.01"><br>
  Tube Sides <input type="range" id="tubeSegs" min="3" max="16" step="1"><br>
  Torus Major R <input type="range" id="torusR" min="60" max="400"><br>
  Torus Minor r <input type="range" id="torusr" min="20" max="200"><br>
  <hr><b>AUDIO</b><hr>
  Bass Inflate <input type="range" id="bassInflate" min="0" max="150"><br>
  Mid Morph <input type="range" id="midMorph" min="0" max="1" step="0.01"><br>
  High Ripple <input type="range" id="highRipple" min="0" max="0.3" step="0.005"><br>
  Spectral Warp <input type="range" id="spectralWarp" min="0" max="100"><br>
  <hr><b>ROTATION</b><hr>
  Rot X <input type="range" id="rotX" min="0" max="0.02" step="0.0005"><br>
  Rot Y <input type="range" id="rotY" min="0" max="0.02" step="0.0005"><br>
  Rot Z <input type="range" id="rotZ" min="0" max="0.02" step="0.0005"><br>
  Rot Audio Mult <input type="range" id="rotAudioMult" min="0" max="6" step="0.1"><br>
  <hr><b>RENDER</b><hr>
  BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.5" step="0.01"><br>
  Line Width <input type="range" id="lineWidth" min="0.5" max="5" step="0.1"><br>
  Draw Tube <input type="range" id="drawTube" min="0" max="1" step="1"><br>
  Depth Scale <input type="range" id="depthScale" min="0" max="3" step="0.1"><br>
  <hr><b>COLOR</b><hr>
  Hue Base <input type="range" id="hueBase" min="0" max="360"><br>
  Hue Range <input type="range" id="hueRange" min="0" max="360"><br>
  Hue Speed <input type="range" id="hueTimeSpeed" min="0" max="2" step="0.05"><br>
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
 DRAW
====================================================== */
const _pt = new Float32Array(3);

function draw() {
  requestAnimationFrame(draw);
  if (devPanel) devPanel.style.display = devPanelActive ? "block" : "none";
  analyser.getByteFrequencyData(freqData);

  const bass = avg(0, 15);
  const mid  = avg(15, 80);
  const high = avg(80, 180);
  frame++;

  // Advance rotation — audio accelerates
  rx += settings.rotX * (1 + bass * settings.rotAudioMult);
  ry += settings.rotY * (1 + mid  * settings.rotAudioMult);
  rz += settings.rotZ * (1 + high * settings.rotAudioMult);

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  const segs = Math.min(Math.floor(settings.segments), MAX_SEGS - 1);
  const p    = settings.p + mid * settings.midMorph * 2;
  const q    = settings.q;
  const R    = settings.torusR + bass * settings.bassInflate;
  const r    = settings.torusr;

  // Build spine
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    torusKnotPoint(t, p, q, R, r, _pt);

    // High-frequency ripple along curve
    const ripple = Math.sin(t * Math.PI * 20 + frame * 0.15) * high * settings.highRipple * R;

    // Spectral warp: frequency bands displace points radially
    const fi = Math.floor(t * 200);
    const fv = (freqData[fi] || 0) / 255;
    const warp = fv * settings.spectralWarp;

    const len = Math.sqrt(_pt[0]*_pt[0] + _pt[1]*_pt[1] + _pt[2]*_pt[2]) || 1;
    const wx = _pt[0] + (_pt[0]/len) * (ripple + warp);
    const wy = _pt[1] + (_pt[1]/len) * (ripple + warp);
    const wz = _pt[2] + (_pt[2]/len) * (ripple + warp);

    const [rx2, ry2, rz2] = rotatePoint(wx, wy, wz);
    spineX[i] = rx2; spineY[i] = ry2; spineZ[i] = rz2;

    const [px2, py2, s] = project(rx2, ry2, rz2);
    spinePX[i] = px2; spinePY[i] = py2;
    spineD[i] = Math.max(0, Math.min(1, (s - 0.3) / 0.7));
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Draw spine as one continuous path per color band
  // Batch into N strips by hue
  const strips = 4;
  for (let s = 0; s < strips; s++) {
    const start = Math.floor((s / strips) * segs);
    const end   = Math.floor(((s + 1) / strips) * segs);
    const t     = s / strips;
    const hue   = (settings.hueBase + t * settings.hueRange + frame * settings.hueTimeSpeed) % 360;
    const avgD  = spineD[start + Math.floor((end - start) / 2)];
    const alpha = 0.4 + avgD * 0.6;

    ctx.beginPath();
    ctx.moveTo(spinePX[start], spinePY[start]);
    for (let i = start + 1; i <= end; i++) {
      ctx.lineTo(spinePX[i], spinePY[i]);
    }
    ctx.strokeStyle = `hsla(${hue},${settings.saturation}%,${settings.lightness}%,${alpha})`;
    ctx.lineWidth = settings.lineWidth * (0.5 + avgD);
    ctx.stroke();
  }

  // Draw tube cross-sections at intervals (not every segment — every N)
  if (settings.drawTube) {
    const step = Math.max(2, Math.floor(segs / 60));
    for (let i = 0; i < segs; i += step) {
      const ni = (i + 1) % segs;
      // Tangent
      const tx = spineX[ni] - spineX[i];
      const ty = spineY[ni] - spineY[i];
      const tz = spineZ[ni] - spineZ[i];
      const tlen = Math.sqrt(tx*tx + ty*ty + tz*tz) || 1;

      // Normal (arbitrary perpendicular)
      let nx2 = -ty, ny2 = tx, nz2 = 0;
      const nlen = Math.sqrt(nx2*nx2 + ny2*ny2) || 1;
      nx2 /= nlen; ny2 /= nlen;

      // Binormal = tangent cross normal
      const bx = (ty/tlen)*nz2 - (tz/tlen)*ny2;
      const by = (tz/tlen)*nx2 - (tx/tlen)*nz2;
      const bz = (tx/tlen)*ny2 - (ty/tlen)*nx2;

      const tr = settings.tubeRadius * R * (0.3 + spineD[i] * 0.7);
      const sides = Math.floor(settings.tubeSegs);
      const t = i / segs;
      const hue = (settings.hueBase + t * settings.hueRange + frame * settings.hueTimeSpeed) % 360;

      ctx.beginPath();
      for (let s2 = 0; s2 <= sides; s2++) {
        const a = (s2 / sides) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const px2 = spineX[i] + (nx2*ca + bx*sa) * tr;
        const py2 = spineY[i] + (ny2*ca + by*sa) * tr;
        const pz2 = spineZ[i] + (nz2*ca + bz*sa) * tr;
        const [ppx, ppy] = project(px2, py2, pz2);
        if (s2 === 0) ctx.moveTo(ppx, ppy);
        else ctx.lineTo(ppx, ppy);
      }
      ctx.strokeStyle = `hsla(${hue},${settings.saturation}%,${settings.lightness+10}%,${0.3 + spineD[i]*0.4})`;
      ctx.lineWidth = settings.lineWidth * 0.6;
      ctx.stroke();
    }
  }

  ctx.restore();
}

draw();

// testing out this exporting thing
export { settings, devPanel };