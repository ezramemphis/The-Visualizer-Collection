// ===============================
// VISUALIZER L — SPHERE
// Icosphere wireframe subdivided 3x, vertex-displaced by frequency bands
// Faces sorted front-to-back and batched into a single path per color
// Zero allocations per frame — all arrays pre-built at init
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
  // Geometry
  subdivisions: 3,       // 1=20 faces, 2=80, 3=320, 4=1280
  radius: 180,

  // Displacement
  displaceAmp: 55,
  displaceFreqScale: 1,  // how many freq bands map to sphere
  displaceNoise: 0.3,    // extra noise displacement

  // Rotation
  rotX: 0.003,
  rotY: 0.007,
  rotAudioMult: 2.5,

  // Projection
  fov: 700,
  perspective: 1,

  // Rendering — key perf trick: batch faces by depth bucket
  bgAlpha: 0.12,
  drawFaces: 1,
  drawEdges: 1,
  edgeWidth: 0.8,
  faceAlpha: 0.12,
  depthBuckets: 6,       // fewer = fewer ctx state changes = faster

  // Pulse
  bassRingPulse: 1,
  ringCount: 4,
  ringSpeed: 0.08,

  // Color
  hueBase: 200,
  hueRange: 160,
  hueTimeSpeed: 0.15,
  saturation: 85,
  lightness: 58,
};

registerSceneSettings(settings);

/* ======================================================
 ICOSPHERE BUILDER (run once at init or subdivisions change)
====================================================== */
let vertices = [];   // [x,y,z] normalized
let faces    = [];   // [i,j,k] indices

function buildIcosphere(subdivs) {
  // Base icosahedron
  const t = (1 + Math.sqrt(5)) / 2;
  const raw = [
    [-1, t,0],[1,t,0],[-1,-t,0],[1,-t,0],
    [0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],
    [t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]
  ];
  vertices = raw.map(v => {
    const l = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
    return [v[0]/l, v[1]/l, v[2]/l];
  });
  faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
  ];

  const midCache = new Map();
  function midpoint(a, b) {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (midCache.has(key)) return midCache.get(key);
    const va = vertices[a], vb = vertices[b];
    const mx = va[0]+vb[0], my = va[1]+vb[1], mz = va[2]+vb[2];
    const l = Math.sqrt(mx*mx+my*my+mz*mz);
    const idx = vertices.length;
    vertices.push([mx/l, my/l, mz/l]);
    midCache.set(key, idx);
    return idx;
  }

  for (let s = 0; s < Math.min(subdivs, 4); s++) {
    const newFaces = [];
    for (const [a,b,c] of faces) {
      const ab = midpoint(a,b), bc = midpoint(b,c), ca = midpoint(c,a);
      newFaces.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);
    }
    faces = newFaces;
  }
}

/* ======================================================
 PRE-ALLOCATED PROJECTION ARRAYS
====================================================== */
let projX, projY, projD, dispR;

function allocArrays() {
  projX = new Float32Array(vertices.length);
  projY = new Float32Array(vertices.length);
  projD = new Float32Array(vertices.length);  // depth
  dispR = new Float32Array(vertices.length);  // displaced radius per vertex
}

let currentSubdivs = -1;
function ensureGeometry() {
  const s = Math.floor(settings.subdivisions);
  if (s !== currentSubdivs) {
    buildIcosphere(s);
    allocArrays();
    currentSubdivs = s;
  }
}

/* ======================================================
 ROTATION STATE
====================================================== */
let rx = 0, ry = 0;

function rotateAndProject(vx, vy, vz, r) {
  // Rotate Y
  const cosy = Math.cos(ry), siny = Math.sin(ry);
  const x2 = vx * cosy + vz * siny;
  const z2 = -vx * siny + vz * cosy;
  // Rotate X
  const cosx = Math.cos(rx), sinx = Math.sin(rx);
  const y3 = vy * cosx - z2 * sinx;
  const z3 = vy * sinx + z2 * cosx;
  const xx = x2 * r, yy = y3 * r, zz = z3 * r;
  // Perspective
  if (!settings.perspective) return [xx + width/2, yy + height/2, 0.5];
  const s2 = settings.fov / (settings.fov + zz);
  return [xx * s2 + width/2, yy * s2 + height/2, s2];
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
  <b>GEODESIC STORM</b><hr>
  Subdivisions <input type="range" id="subdivisions" min="1" max="4" step="1"><br>
  Radius <input type="range" id="radius" min="60" max="350"><br>
  <hr><b>DISPLACEMENT</b><hr>
  Displace Amp <input type="range" id="displaceAmp" min="0" max="150"><br>
  Displace Freq Scale <input type="range" id="displaceFreqScale" min="0.1" max="4" step="0.1"><br>
  Displace Noise <input type="range" id="displaceNoise" min="0" max="1" step="0.05"><br>
  <hr><b>ROTATION</b><hr>
  Rot X <input type="range" id="rotX" min="0" max="0.02" step="0.0005"><br>
  Rot Y <input type="range" id="rotY" min="0" max="0.02" step="0.0005"><br>
  Rot Audio Mult <input type="range" id="rotAudioMult" min="0" max="6" step="0.1"><br>
  <hr><b>PROJECTION</b><hr>
  FOV <input type="range" id="fov" min="100" max="2000"><br>
  Perspective <input type="range" id="perspective" min="0" max="1" step="1"><br>
  <hr><b>RENDER</b><hr>
  BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.5" step="0.01"><br>
  Draw Faces <input type="range" id="drawFaces" min="0" max="1" step="1"><br>
  Draw Edges <input type="range" id="drawEdges" min="0" max="1" step="1"><br>
  Edge Width <input type="range" id="edgeWidth" min="0.3" max="4" step="0.1"><br>
  Face Alpha <input type="range" id="faceAlpha" min="0.01" max="0.5" step="0.01"><br>
  Depth Buckets <input type="range" id="depthBuckets" min="2" max="12" step="1"><br>
  Bass Ring Pulse <input type="range" id="bassRingPulse" min="0" max="1" step="1"><br>
  Ring Count <input type="range" id="ringCount" min="1" max="8" step="1"><br>
  Ring Speed <input type="range" id="ringSpeed" min="0.01" max="0.3" step="0.01"><br>
  <hr><b>COLOR</b><hr>
  Hue Base <input type="range" id="hueBase" min="0" max="360"><br>
  Hue Range <input type="range" id="hueRange" min="0" max="360"><br>
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
 RING PULSE OFFSETS (pre-allocated)
====================================================== */
let ringOffsets = [0, 0, 0, 0, 0, 0, 0, 0];

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

  ensureGeometry();

  rx += settings.rotX * (1 + bass * settings.rotAudioMult);
  ry += settings.rotY * (1 + mid  * settings.rotAudioMult);

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  // Project all vertices with frequency displacement
  const R = settings.radius;
  const vCount = vertices.length;
  for (let i = 0; i < vCount; i++) {
    const v = vertices[i];
    // Map vertex index to frequency band
    const fi = Math.floor((i / vCount) * 200 * settings.displaceFreqScale) % 256;
    const fv = (freqData[fi] || 0) / 255;
    // Noise: use vertex position as noise seed (stable, no random())
    const noise = (Math.sin(v[0]*17.3 + frame*0.02) * Math.cos(v[1]*13.7 + frame*0.015)) * settings.displaceNoise;
    const r = R * (1 + fv * settings.displaceAmp/R + noise * settings.displaceAmp/R * 0.3 + bass * 0.15);
    dispR[i] = r;
    const [px, py, d] = rotateAndProject(v[0], v[1], v[2], r);
    projX[i] = px; projY[i] = py; projD[i] = d;
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Compute face depths and bucket them
  const buckets = Math.floor(settings.depthBuckets);
  // Build bucket arrays (reuse arrays)
  const bucketFaces = Array.from({length: buckets}, () => []);

  const fCount = faces.length;
  for (let fi2 = 0; fi2 < fCount; fi2++) {
    const [a,b,c] = faces[fi2];
    const d = (projD[a] + projD[b] + projD[c]) / 3;
    const bucket = Math.min(buckets - 1, Math.floor(d * buckets));
    bucketFaces[bucket].push(fi2);
  }

  // Draw each bucket as batched paths
  for (let bi = 0; bi < buckets; bi++) {
    const bFaces = bucketFaces[bi];
    if (!bFaces.length) continue;
    const t = bi / buckets;
    const hue = (settings.hueBase + t * settings.hueRange + frame * settings.hueTimeSpeed) % 360;
    const alpha = t * 0.6 + 0.2;

    // All faces in bucket — one path for fills, one for strokes
    if (settings.drawFaces) {
      ctx.beginPath();
      for (const fi2 of bFaces) {
        const [a,b,c] = faces[fi2];
        ctx.moveTo(projX[a], projY[a]);
        ctx.lineTo(projX[b], projY[b]);
        ctx.lineTo(projX[c], projY[c]);
        ctx.closePath();
      }
      ctx.fillStyle = `hsla(${hue},${settings.saturation}%,${settings.lightness}%,${settings.faceAlpha * alpha})`;
      ctx.fill();
    }

    if (settings.drawEdges) {
      ctx.beginPath();
      for (const fi2 of bFaces) {
        const [a,b,c] = faces[fi2];
        ctx.moveTo(projX[a], projY[a]);
        ctx.lineTo(projX[b], projY[b]);
        ctx.lineTo(projX[c], projY[c]);
        ctx.closePath();
      }
      ctx.strokeStyle = `hsla(${hue},${settings.saturation}%,${Math.min(90,settings.lightness+15)}%,${alpha})`;
      ctx.lineWidth = settings.edgeWidth;
      ctx.stroke();
    }

    // Clean up for next frame
    bFaces.length = 0;
  }

  // Bass ring pulses — drawn as circles in screenspace (very cheap)
  if (settings.bassRingPulse) {
    const rings = Math.floor(settings.ringCount);
    for (let ri = 0; ri < rings; ri++) {
      ringOffsets[ri] = (ringOffsets[ri] + settings.ringSpeed * (1 + bass * 3)) % 1;
      const t = (ringOffsets[ri] + ri / rings) % 1;
      const r2 = t * R * (1.5 + bass * 0.5);
      const a2 = (1 - t) * 0.5 * (0.3 + bass * 0.5);
      const hue2 = (settings.hueBase + frame * settings.hueTimeSpeed + t * 120) % 360;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, r2, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue2},${settings.saturation}%,${settings.lightness+15}%,${a2})`;
      ctx.lineWidth = 1.5 * (1 - t);
      ctx.stroke();
    }
  }

  ctx.restore();
}

draw();

// testing out this exporting thing
export { settings, devPanel };