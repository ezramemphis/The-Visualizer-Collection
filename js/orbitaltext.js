// ===============================
// VISUALIZER L-A — SPHERE + TEXT ORBIT: EQUATORIAL BELT
// Text characters orbit the equator of the icosphere in a single ring
// Depth-sorted with the sphere faces — letters pop in/out naturally
// Chrome, neon, ghost, solid, and rainbow text modes
//
// FIX: Characters now face upward by default (readable)
//      textRotation=0 → always upright
//      textRotation=1 → full orbit-tangent tumble
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
  // Sphere
  subdivisions: 3,
  radius: 160,
  displaceAmp: 50,
  displaceFreqScale: 1,
  displaceNoise: 0.3,
  rotX: 0.002,
  rotY: 0.005,
  rotAudioMult: 2.0,
  fov: 700,
  bgAlpha: 0.13,
  drawFaces: 1,
  drawEdges: 1,
  edgeWidth: 0.7,
  faceAlpha: 0.10,
  depthBuckets: 6,
  bassRingPulse: 1,
  ringCount: 3,
  ringSpeed: 0.07,
  hueBase: 200,
  hueRange: 140,
  hueTimeSpeed: 0.12,
  saturation: 85,
  lightness: 55,

  // Text
  textOrbitRadius: 220,
  textOrbitSpeed: 0.008,
  textOrbitAudioBoost: 2,
  textOrbitTilt: 0.0,       // tilt of orbit plane
  textSize: 28,
  textFontFamily: "Bebas Neue",
  textWeight: 700,          // 100–900
  textLetterSpacing: 1.1,
  textMode: 0,              // 0=chrome 1=neon 2=solid 3=ghost 4=rainbow
  textHue: 200,
  textSaturation: 80,
  textLightness: 70,
  textGlowSize: 12,
  textDepthScale: 1,        // perspective size scaling
  textFaceDepth: 1,         // 1=depth sorted with sphere, 0=always on top
  textRotation: 0,          // 0=always upright  1=full orbit tumble
};

registerSceneSettings(settings);

/* ======================================================
 TEXT STATE
====================================================== */
let orbitText = "ALUMENT IS THE WAY";
let orbitAngle = 0;

function createTextInput() {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "fixed", bottom: "14px", left: "50%",
    transform: "translateX(-50%)",
    zIndex: 9999,
    display: "flex", gap: "8px", alignItems: "center",
  });

  const inp = document.createElement("input");
  Object.assign(inp.style, {
    background: "rgba(0,0,0,0.75)",
    border: "1px solid rgba(255,255,255,0.25)",
    color: "#fff",
    fontFamily: "monospace",
    fontSize: "13px",
    padding: "6px 12px",
    borderRadius: "4px",
    width: "340px",
    outline: "none",
    letterSpacing: "0.05em",
  });
  inp.value = orbitText;
  inp.placeholder = "Type orbit text…";
  inp.addEventListener("input", e => { orbitText = e.target.value || " "; });
  inp.addEventListener("keydown", e => e.stopPropagation());

  wrap.appendChild(inp);
  document.body.appendChild(wrap);
}
createTextInput();

/* ======================================================
 ICOSPHERE BUILDER
====================================================== */
let vertices = [], faces = [];

function buildIcosphere(subdivs) {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw = [
    [-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],
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

let projX, projY, projD;
function allocArrays() {
  projX = new Float32Array(vertices.length);
  projY = new Float32Array(vertices.length);
  projD = new Float32Array(vertices.length);
}
let currentSubdivs = -1;
function ensureGeometry() {
  const s = Math.floor(settings.subdivisions);
  if (s !== currentSubdivs) { buildIcosphere(s); allocArrays(); currentSubdivs = s; }
}

/* ======================================================
 ROTATION + PROJECTION
====================================================== */
let rx = 0, ry = 0;

function rotProject(vx, vy, vz, r) {
  const cosy = Math.cos(ry), siny = Math.sin(ry);
  const x2 = vx*cosy + vz*siny, z2 = -vx*siny + vz*cosy;
  const cosx = Math.cos(rx), sinx = Math.sin(rx);
  const y3 = vy*cosx - z2*sinx, z3 = vy*sinx + z2*cosx;
  const xx = x2*r, yy = y3*r, zz = z3*r;
  const s2 = settings.fov / (settings.fov + zz);
  return [xx*s2 + width/2, yy*s2 + height/2, s2, zz];
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
    background: "rgba(0,0,0,0.88)", color: "#fff", fontFamily: "sans-serif",
    fontSize: "12px", borderRadius: "6px", zIndex: 9999,
    display: "none", maxHeight: "95vh", overflowY: "auto", width: "215px",
  });

  devPanel.innerHTML = `
  <b>SPHERE + TEXT: EQUATORIAL</b><hr>
  <b>SPHERE</b><br>
  Subdivisions <input type="range" id="subdivisions" min="1" max="4" step="1"><br>
  Radius <input type="range" id="radius" min="60" max="300"><br>
  Displace Amp <input type="range" id="displaceAmp" min="0" max="120"><br>
  Displace Noise <input type="range" id="displaceNoise" min="0" max="1" step="0.05"><br>
  Rot X <input type="range" id="rotX" min="0" max="0.02" step="0.0005"><br>
  Rot Y <input type="range" id="rotY" min="0" max="0.02" step="0.0005"><br>
  Rot Audio Mult <input type="range" id="rotAudioMult" min="0" max="6" step="0.1"><br>
  BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.5" step="0.01"><br>
  Draw Faces <input type="range" id="drawFaces" min="0" max="1" step="1"><br>
  Draw Edges <input type="range" id="drawEdges" min="0" max="1" step="1"><br>
  Edge Width <input type="range" id="edgeWidth" min="0.3" max="4" step="0.1"><br>
  Face Alpha <input type="range" id="faceAlpha" min="0.01" max="0.5" step="0.01"><br>
  Depth Buckets <input type="range" id="depthBuckets" min="2" max="12" step="1"><br>
  Bass Ring Pulse <input type="range" id="bassRingPulse" min="0" max="1" step="1"><br>
  Ring Count <input type="range" id="ringCount" min="1" max="8" step="1"><br>
  Hue Base <input type="range" id="hueBase" min="0" max="360"><br>
  Hue Range <input type="range" id="hueRange" min="0" max="360"><br>
  Saturation <input type="range" id="saturation" min="0" max="100"><br>
  Lightness <input type="range" id="lightness" min="10" max="90"><br>

  <hr><b>TEXT ORBIT</b><br>
  Orbit Radius <input type="range" id="textOrbitRadius" min="80" max="500"><br>
  Orbit Speed <input type="range" id="textOrbitSpeed" min="0" max="0.04" step="0.0005"><br>
  Orbit Audio Boost <input type="range" id="textOrbitAudioBoost" min="0" max="6" step="0.1"><br>
  Orbit Tilt <input type="range" id="textOrbitTilt" min="-1.5" max="1.5" step="0.05"><br>
  Text Size <input type="range" id="textSize" min="8" max="80"><br>
  Font Weight <input type="range" id="textWeight" min="100" max="900" step="100"><br>
  Letter Spacing <input type="range" id="textLetterSpacing" min="0.5" max="3" step="0.05"><br>

  <b style="font-size:11px;display:block;margin-top:4px">Letter Rotation</b>
  <span style="font-size:10px;color:#888">0 = upright &nbsp;&nbsp; 1 = orbit tumble</span><br>
  <input type="range" id="textRotation" min="0" max="1" step="0.01"><br>

  Text Mode <input type="range" id="textMode" min="0" max="4" step="1">
  <span id="textModeLabel" style="font-size:10px;color:#0cf"> chrome</span><br>
  Text Hue <input type="range" id="textHue" min="0" max="360"><br>
  Text Saturation <input type="range" id="textSaturation" min="0" max="100"><br>
  Text Lightness <input type="range" id="textLightness" min="10" max="100"><br>
  Glow Size <input type="range" id="textGlowSize" min="0" max="40"><br>
  Depth Scale <input type="range" id="textDepthScale" min="0" max="2" step="0.05"><br>
  Face Depth <input type="range" id="textFaceDepth" min="0" max="1" step="1"><br>
  `;

  document.body.appendChild(devPanel);

  const modeNames = ["chrome","neon","solid","ghost","rainbow"];
  const modeLabel = devPanel.querySelector("#textModeLabel");

  Object.keys(settings).forEach(key => {
    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;
    el.value = settings[key];
    el.addEventListener("input", e => {
      settings[key] = parseFloat(e.target.value);
      if (key === "textMode" && modeLabel)
        modeLabel.textContent = " " + (modeNames[Math.floor(settings.textMode)] || "");
    });
  });
}
createDevPanel();

/* ======================================================
 CHROME GRADIENT HELPER (relative to 0,0 inside save block)
====================================================== */
function makeChrome(size, hue) {
  const grd = ctx.createLinearGradient(0, -size * 0.6, 0, size * 0.5);
  grd.addColorStop(0,    `hsl(${hue},8%,100%)`);
  grd.addColorStop(0.18, `hsl(${hue},20%,82%)`);
  grd.addColorStop(0.45, `hsl(${hue},55%,52%)`);
  grd.addColorStop(0.72, `hsl(${hue},22%,78%)`);
  grd.addColorStop(1,    `hsl(${hue},8%,96%)`);
  return grd;
}

/* ======================================================
 DRAW ONE CHARACTER
 textRotation=0  → ctx.rotate(0) → perfectly upright
 textRotation=1  → ctx.rotate(orbitTangent) → tumbling along ring
 Values in between smoothly blend the two
====================================================== */
function drawChar(char, x3d, y3d, z3d, rawOrbitAngle, depth, bass, idx) {
  const fov = settings.fov;
  const s   = fov / (fov + z3d);
  const sx  = x3d * s + width / 2;
  const sy  = y3d * s + height / 2;

  const sizeScale = settings.textDepthScale > 0
    ? (1 - settings.textDepthScale) + s * settings.textDepthScale
    : 1;
  const fontSize = settings.textSize * sizeScale * (1 + bass * 0.25);
  if (fontSize < 2) return;

  // Orbit tangent angle: what makes a letter "lie along" the ring
  const orbitTangent = rawOrbitAngle + Math.PI / 2;
  // Blend: 0 = upright (no rotation), 1 = full tumble
  const finalRotation = orbitTangent * settings.textRotation;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(finalRotation);

  ctx.font           = `${settings.textWeight} ${fontSize}px "${settings.textFontFamily}", sans-serif`;
  ctx.textAlign      = "center";
  ctx.textBaseline   = "middle";

  const alpha = settings.textFaceDepth
    ? Math.max(0.05, Math.min(1, s * 1.6))
    : 1;

  const mode = Math.floor(settings.textMode);
  const hue  = mode === 4 ? (idx * 32 + frame * 0.5) % 360 : settings.textHue;
  const sat  = settings.textSaturation;
  const lit  = settings.textLightness;

  ctx.globalAlpha = alpha;

  if (mode === 0) {
    // CHROME
    ctx.fillStyle = makeChrome(fontSize, hue);
    ctx.fillText(char, 0, 0);
    // Specular shimmer
    ctx.globalAlpha = 0.35 * alpha * Math.max(0, s - 0.3);
    ctx.fillStyle   = "#ffffff";
    ctx.fillText(char, -0.5, -1);

  } else if (mode === 1) {
    // NEON
    ctx.shadowColor = `hsl(${hue},100%,65%)`;
    ctx.shadowBlur  = settings.textGlowSize * sizeScale;
    ctx.fillStyle   = `hsl(${hue},${sat}%,${lit}%)`;
    ctx.fillText(char, 0, 0);
    ctx.shadowBlur  = 0;

  } else if (mode === 2) {
    // SOLID
    ctx.fillStyle = `hsl(${hue},${sat}%,${lit}%)`;
    ctx.fillText(char, 0, 0);

  } else if (mode === 3) {
    // GHOST — outline only
    ctx.globalAlpha = alpha * 0.75;
    ctx.strokeStyle = `hsl(${hue},${sat}%,${lit}%)`;
    ctx.lineWidth   = Math.max(0.5, 0.9 * sizeScale);
    if (settings.textGlowSize > 0) {
      ctx.shadowColor = `hsl(${hue},100%,70%)`;
      ctx.shadowBlur  = settings.textGlowSize * 0.4 * sizeScale;
    }
    ctx.strokeText(char, 0, 0);
    ctx.shadowBlur = 0;

  } else if (mode === 4) {
    // RAINBOW
    if (settings.textGlowSize > 0) {
      ctx.shadowColor = `hsl(${hue},100%,65%)`;
      ctx.shadowBlur  = settings.textGlowSize * 0.5 * sizeScale;
    }
    ctx.fillStyle = `hsl(${hue},100%,65%)`;
    ctx.fillText(char, 0, 0);
    ctx.shadowBlur = 0;
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ======================================================
 RING PULSE OFFSETS
====================================================== */
const ringOffsets = new Float32Array(8);

/* ======================================================
 DRAW LOOP
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
  orbitAngle += settings.textOrbitSpeed * (1 + bass * settings.textOrbitAudioBoost);

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  /* ---- PROJECT SPHERE VERTICES ---- */
  const R      = settings.radius;
  const vCount = vertices.length;
  for (let i = 0; i < vCount; i++) {
    const v  = vertices[i];
    const fi = Math.floor((i / vCount) * 200 * settings.displaceFreqScale) % 256;
    const fv = (freqData[fi] || 0) / 255;
    const noise = Math.sin(v[0]*17.3 + frame*0.02) * Math.cos(v[1]*13.7 + frame*0.015) * settings.displaceNoise;
    const r  = R * (1 + fv * settings.displaceAmp/R + noise * settings.displaceAmp/R * 0.3 + bass * 0.12);
    const [px, py, d] = rotProject(v[0], v[1], v[2], r);
    projX[i] = px; projY[i] = py; projD[i] = d;
  }

  /* ---- BUILD CHAR POSITIONS ---- */
  const text    = orbitText.endsWith(" ") ? orbitText : orbitText + " ";
  const chars   = text.split("");
  const orbitR  = settings.textOrbitRadius;
  const tilt    = settings.textOrbitTilt;
  const arcStep = (Math.PI * 2) / (chars.length * settings.textLetterSpacing);

  const charData = chars.map((ch, idx) => {
    const a = orbitAngle + idx * arcStep;

    // Orbit in XZ plane, tilted around X axis
    const x3d      = Math.cos(a) * orbitR;
    const z3d_flat = Math.sin(a) * orbitR;
    const y3d      = z3d_flat * Math.sin(tilt);
    const z3d      = z3d_flat * Math.cos(tilt);

    // Co-rotate with sphere
    const cosy = Math.cos(ry), siny = Math.sin(ry);
    const x2   = x3d*cosy + z3d*siny;
    const z2   = -x3d*siny + z3d*cosy;
    const cosx = Math.cos(rx), sinx = Math.sin(rx);
    const y3   = y3d*cosx - z2*sinx;
    const z3   = y3d*sinx + z2*cosx;

    const s2 = settings.fov / (settings.fov + z3);

    return { ch, x3d: x2, y3d: y3, z3d: z3, depth: s2, rawOrbitAngle: a, idx };
  });

  /* ---- DEPTH BUCKETS ---- */
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const buckets     = Math.floor(settings.depthBuckets);
  const bucketFaces = Array.from({length: buckets}, () => []);
  const fCount      = faces.length;

  for (let fi2 = 0; fi2 < fCount; fi2++) {
    const [a,b,c] = faces[fi2];
    const d = (projD[a] + projD[b] + projD[c]) / 3;
    bucketFaces[Math.min(buckets-1, Math.floor(d * buckets))].push(fi2);
  }

  const charsByBucket = Array.from({length: buckets}, () => []);
  if (settings.textFaceDepth) {
    charData.forEach(cd => {
      const b = Math.min(buckets-1, Math.max(0, Math.floor(cd.depth * buckets)));
      charsByBucket[b].push(cd);
    });
  }

  /* ---- RENDER BACK → FRONT ---- */
  for (let bi = 0; bi < buckets; bi++) {
    const bFaces = bucketFaces[bi];
    const bChars = charsByBucket[bi];
    const t      = bi / buckets;
    const hue    = (settings.hueBase + t * settings.hueRange + frame * settings.hueTimeSpeed) % 360;
    const alpha  = t * 0.6 + 0.2;

    if (settings.drawFaces && bFaces.length) {
      ctx.beginPath();
      for (const fi2 of bFaces) {
        const [a,b,c] = faces[fi2];
        ctx.moveTo(projX[a], projY[a]);
        ctx.lineTo(projX[b], projY[b]);
        ctx.lineTo(projX[c], projY[c]);
        ctx.closePath();
      }
      ctx.fillStyle = `hsla(${hue},${settings.saturation}%,${settings.lightness}%,${settings.faceAlpha*alpha})`;
      ctx.fill();
    }

    if (settings.drawEdges && bFaces.length) {
      ctx.beginPath();
      for (const fi2 of bFaces) {
        const [a,b,c] = faces[fi2];
        ctx.moveTo(projX[a], projY[a]);
        ctx.lineTo(projX[b], projY[b]);
        ctx.lineTo(projX[c], projY[c]);
        ctx.closePath();
      }
      ctx.strokeStyle = `hsla(${hue},${settings.saturation}%,${Math.min(90, settings.lightness+15)}%,${alpha})`;
      ctx.lineWidth   = settings.edgeWidth;
      ctx.stroke();
    }

    bFaces.length = 0;

    for (const cd of bChars) {
      drawChar(cd.ch, cd.x3d, cd.y3d, cd.z3d, cd.rawOrbitAngle, cd.depth, bass, cd.idx);
    }
    bChars.length = 0;
  }

  // Depth-sort off: draw all chars back→front on top of sphere
  if (!settings.textFaceDepth) {
    charData.sort((a, b) => a.depth - b.depth);
    for (const cd of charData) {
      drawChar(cd.ch, cd.x3d, cd.y3d, cd.z3d, cd.rawOrbitAngle, cd.depth, bass, cd.idx);
    }
  }

  /* ---- RING PULSES ---- */
  if (settings.bassRingPulse) {
    const rings = Math.floor(settings.ringCount);
    for (let ri = 0; ri < rings; ri++) {
      ringOffsets[ri] = (ringOffsets[ri] + settings.ringSpeed * (1 + bass * 3)) % 1;
      const t2   = (ringOffsets[ri] + ri / rings) % 1;
      const r2   = t2 * R * (1.5 + bass * 0.5);
      const a2   = (1 - t2) * 0.4 * (0.3 + bass * 0.5);
      const hue2 = (settings.hueBase + frame * settings.hueTimeSpeed + t2 * 120) % 360;
      ctx.beginPath();
      ctx.arc(width/2, height/2, r2, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue2},${settings.saturation}%,${settings.lightness+15}%,${a2})`;
      ctx.lineWidth   = 1.5 * (1 - t2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

draw();
