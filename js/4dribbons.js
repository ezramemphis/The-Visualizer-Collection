// ===============================
// VISUALIZER E — HYPERDIMENSIONAL RIBBON STORM
// 4D-projected rotating ribbons warped through frequency space
// Each ribbon lives in a 4D hypersphere and gets shadow-projected to 2D
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
  let v = 0;
  const len = Math.max(1, e - s);
  for (let i = s; i < e; i++) v += freqData[i] || 0;
  return (v / len) / 255;
}

function band(i) {
  return (freqData[i] || 0) / 255;
}

/* ======================================================
 SETTINGS
====================================================== */

const settings = {
  // Ribbons
  ribbonCount: 18,
  ribbonSegments: 80,
  ribbonWidth: 4,
  ribbonSpread: 1.0,

  // 4D rotation
  rotXY: 0.003,
  rotXZ: 0.002,
  rotXW: 0.0015,
  rotYZ: 0.001,
  rotYW: 0.002,
  rotZW: 0.0025,

  // Projection
  w_dist: 2.5,         // 4D->3D perspective distance
  z_dist: 800,         // 3D->2D perspective distance
  scale: 350,

  // Audio warp
  freqWarpAmp: 120,
  bassInflate: 80,
  midTwist: 0.8,
  highShiver: 0.4,
  spectralStretch: 1.5,

  // Rendering
  bgAlpha: 0.08,
  trailDecay: 1,
  glowLayers: 3,
  mirrorMode: 0,        // 0=off, 1=4-way mirror
  ribbonTaper: 1,       // taper ribbon width toward tips

  // Color
  hueBase: 200,
  huePerRibbon: 20,
  saturation: 95,
  lightness: 60,
  hueAnimSpeed: 0.2,
  iridescence: 1,       // hue shift along ribbon length
};

registerSceneSettings(settings);

/* ======================================================
 4D MATH
====================================================== */

// 6 rotation planes in 4D
class Rot4D {
  constructor() {
    this.angle = { xy: 0, xz: 0, xw: 0, yz: 0, yw: 0, zw: 0 };
  }

  step() {
    this.angle.xy += settings.rotXY;
    this.angle.xz += settings.rotXZ;
    this.angle.xw += settings.rotXW;
    this.angle.yz += settings.rotYZ;
    this.angle.yw += settings.rotYW;
    this.angle.zw += settings.rotZW;
  }

  rotate(x, y, z, w) {
    // XY plane
    let c = Math.cos(this.angle.xy), s = Math.sin(this.angle.xy);
    let nx = c * x - s * y; let ny = s * x + c * y; x = nx; y = ny;

    // XZ plane
    c = Math.cos(this.angle.xz); s = Math.sin(this.angle.xz);
    let nz = c * z - s * x; nx = s * z + c * x; x = nx; z = nz;

    // XW plane
    c = Math.cos(this.angle.xw); s = Math.sin(this.angle.xw);
    let nw = c * w - s * x; nx = s * w + c * x; x = nx; w = nw;

    // YZ plane
    c = Math.cos(this.angle.yz); s = Math.sin(this.angle.yz);
    ny = c * y - s * z; nz = s * y + c * z; y = ny; z = nz;

    // YW plane
    c = Math.cos(this.angle.yw); s = Math.sin(this.angle.yw);
    ny = c * y - s * w; nw = s * y + c * w; y = ny; w = nw;

    // ZW plane
    c = Math.cos(this.angle.zw); s = Math.sin(this.angle.zw);
    nz = c * z - s * w; nw = s * z + c * w; z = nz; w = nw;

    return { x, y, z, w };
  }
}

// 4D perspective projection to 2D
function project4D(p) {
  // 4D -> 3D
  const wScale = settings.w_dist / (settings.w_dist + p.w);
  const x3 = p.x * wScale;
  const y3 = p.y * wScale;
  const z3 = p.z * wScale;

  // 3D -> 2D
  const zScale = settings.z_dist / (settings.z_dist + z3);
  const px = x3 * zScale * settings.scale + width / 2;
  const py = y3 * zScale * settings.scale + height / 2;
  const depth = wScale * zScale; // depth cue

  return { px, py, depth };
}

/* ======================================================
 RIBBON SYSTEM
====================================================== */

class Ribbon {
  constructor(index, total) {
    this.index = index;
    // Base angle on a hypersphere
    const phi = (index / total) * Math.PI * 2;
    const theta = Math.PI * 0.5;
    const psi = (index / total) * Math.PI;

    // 4D hypersphere coordinates for the ribbon center
    this.base4D = {
      x: Math.sin(theta) * Math.cos(phi) * settings.ribbonSpread,
      y: Math.sin(theta) * Math.sin(phi) * settings.ribbonSpread,
      z: Math.cos(theta) * settings.ribbonSpread,
      w: Math.cos(psi) * 0.5
    };

    this.hue = settings.hueBase + index * settings.huePerRibbon;
    this.phase = (index / total) * Math.PI * 2;
  }

  getPoints(rot, bass, mid, high) {
    const segs = Math.floor(settings.ribbonSegments);
    const points = [];

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const angle = t * Math.PI * 2 + this.phase;

      // Base lissajous curve in 4D space
      const freqIdx = Math.floor(t * 200);
      const freqVal = band(freqIdx) * settings.spectralStretch;

      let x = this.base4D.x + Math.cos(angle * 3 + frame * 0.01) * 0.6;
      let y = this.base4D.y + Math.sin(angle * 2 + frame * 0.008) * 0.6;
      let z = this.base4D.z + Math.cos(angle * 5 + frame * 0.006) * 0.4;
      let w = this.base4D.w + Math.sin(angle * 4 + frame * 0.009) * 0.4;

      // Frequency spectrum warping
      const freqWarp = freqVal * settings.freqWarpAmp * 0.001;
      x += Math.sin(angle * 7 + frame * 0.02) * freqWarp;
      y += Math.cos(angle * 5 - frame * 0.015) * freqWarp;

      // Bass inflate (puffs outward from center)
      const r = Math.sqrt(x * x + y * y + z * z + w * w) || 1;
      const inflate = bass * settings.bassInflate * 0.001;
      x += (x / r) * inflate;
      y += (y / r) * inflate;
      z += (z / r) * inflate;
      w += (w / r) * inflate;

      // Mid twist (rotates ribbon around its axis)
      const twist = t * mid * settings.midTwist;
      const cosT = Math.cos(twist), sinT = Math.sin(twist);
      const nx = x * cosT - y * sinT;
      const ny = x * sinT + y * cosT;
      x = nx; y = ny;

      // High frequency shiver
      const shiver = Math.sin(t * 50 + frame * 0.3) * high * settings.highShiver * 0.05;
      x += shiver; y -= shiver;

      // Apply 4D rotation
      const rot4 = rot.rotate(x, y, z, w);
      const proj = project4D(rot4);

      points.push({ ...proj, t, freqVal });
    }

    return points;
  }

  draw(rot, bass, mid, high) {
    const pts = this.getPoints(rot, bass, mid, high);
    if (pts.length < 2) return;

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const t = a.t;

      // Taper ribbon width
      const taper = settings.ribbonTaper
        ? 1 - Math.pow(Math.abs(t - 0.5) * 2, 1.5)
        : 1;

      const w = (settings.ribbonWidth + a.depth * 3 + a.freqVal * 4) * taper;

      // Iridescent hue shift along ribbon
      const iridHue = settings.iridescence ? (this.hue + t * 120 + frame * settings.hueAnimSpeed) % 360 : (this.hue + frame * settings.hueAnimSpeed) % 360;

      const brightness = settings.lightness + a.depth * 25 + mid * 20;
      const alpha = 0.3 + a.depth * 0.4 + bass * 0.3;

      for (let g = 0; g < settings.glowLayers; g++) {
        ctx.beginPath();
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
        ctx.lineWidth = w + g * 3;
        ctx.strokeStyle = `hsla(${iridHue}, ${settings.saturation}%, ${brightness}%, ${alpha / (g + 1)})`;
        ctx.stroke();
      }
    }
  }
}

/* ======================================================
 INIT
====================================================== */

const rot4D = new Rot4D();
let ribbons = [];

function initRibbons() {
  ribbons = Array.from(
    { length: settings.ribbonCount },
    (_, i) => new Ribbon(i, settings.ribbonCount)
  );
}
initRibbons();

/* ======================================================
 RESIZE
====================================================== */

function resize() {
  width = canvas.width;
  height = canvas.height;
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
  <b>HYPERDIMENSIONAL RIBBON STORM</b><hr>

  Ribbon Count <input type="range" id="ribbonCount" class="slider-main" min="2" max="40" step="1"><br>
  Ribbon Segments <input type="range" id="ribbonSegments" class="slider-main" min="10" max="200"><br>
  Ribbon Width <input type="range" id="ribbonWidth" class="slider-main" min="0.5" max="20" step="0.5"><br>
  Ribbon Spread <input type="range" id="ribbonSpread" class="slider-main" min="0.1" max="3" step="0.05"><br>
  Ribbon Taper <input type="range" id="ribbonTaper" class="slider-main" min="0" max="1" step="1"><br>

  <hr><b>4D ROTATION</b><hr>
  XY Rotation <input type="range" id="rotXY" class="slider-main" min="0" max="0.02" step="0.0005"><br>
  XZ Rotation <input type="range" id="rotXZ" class="slider-main" min="0" max="0.02" step="0.0005"><br>
  XW Rotation <input type="range" id="rotXW" class="slider-main" min="0" max="0.02" step="0.0005"><br>
  YZ Rotation <input type="range" id="rotYZ" class="slider-main" min="0" max="0.02" step="0.0005"><br>
  YW Rotation <input type="range" id="rotYW" class="slider-main" min="0" max="0.02" step="0.0005"><br>
  ZW Rotation <input type="range" id="rotZW" class="slider-main" min="0" max="0.02" step="0.0005"><br>

  <hr><b>PROJECTION</b><hr>
  4D Perspective <input type="range" id="w_dist" class="slider-main" min="0.5" max="8" step="0.1"><br>
  3D Perspective <input type="range" id="z_dist" class="slider-main" min="100" max="2000"><br>
  Scale <input type="range" id="scale" class="slider-main" min="50" max="1000"><br>

  <hr><b>AUDIO WARP</b><hr>
  Freq Warp Amp <input type="range" id="freqWarpAmp" class="slider-main" min="0" max="300"><br>
  Bass Inflate <input type="range" id="bassInflate" class="slider-main" min="0" max="200"><br>
  Mid Twist <input type="range" id="midTwist" class="slider-main" min="0" max="4" step="0.05"><br>
  High Shiver <input type="range" id="highShiver" class="slider-main" min="0" max="2" step="0.05"><br>
  Spectral Stretch <input type="range" id="spectralStretch" class="slider-main" min="0" max="5" step="0.1"><br>

  <hr><b>RENDERING</b><hr>
  BG Alpha <input type="range" id="bgAlpha" class="slider-main" min="0.01" max="0.5" step="0.01"><br>
  Glow Layers <input type="range" id="glowLayers" class="slider-main" min="1" max="6" step="1"><br>
  Mirror Mode <input type="range" id="mirrorMode" class="slider-main" min="0" max="1" step="1"><br>

  <hr><b>COLOR</b><hr>
  Hue Base <input type="range" id="hueBase" class="slider-main" min="0" max="360"><br>
  Hue Per Ribbon <input type="range" id="huePerRibbon" class="slider-main" min="0" max="40"><br>
  Saturation <input type="range" id="saturation" class="slider-main" min="0" max="100"><br>
  Lightness <input type="range" id="lightness" class="slider-main" min="10" max="90"><br>
  Hue Anim Speed <input type="range" id="hueAnimSpeed" class="slider-main" min="0" max="2" step="0.05"><br>
  Iridescence <input type="range" id="iridescence" class="slider-main" min="0" max="1" step="1"><br>
  `;

  document.body.appendChild(devPanel);

  Object.keys(settings).forEach(key => {
    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;
    el.value = settings[key];
    el.addEventListener("input", e => {
      settings[key] = parseFloat(e.target.value);
      if (key === "ribbonCount") initRibbons();
    });
  });
}

createDevPanel();

/* ======================================================
 DRAW
====================================================== */

function draw() {
  requestAnimationFrame(draw);

  if (devPanel) devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);

  const bass = avg(0, 15);
  const mid = avg(15, 80);
  const high = avg(80, 180);

  frame++;

  // Advance 4D rotation — audio modulates all planes
  rot4D.angle.xy += settings.rotXY * (1 + bass * 2);
  rot4D.angle.xz += settings.rotXZ * (1 + mid * 1.5);
  rot4D.angle.xw += settings.rotXW * (1 + high * 3);
  rot4D.angle.yz += settings.rotYZ * (1 + mid);
  rot4D.angle.yw += settings.rotYW * (1 + bass * 1.5);
  rot4D.angle.zw += settings.rotZW * (1 + high * 2);

  // BG fade
  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  if (settings.mirrorMode === 1) {
    // 4-way mirror: draw to offscreen, then tile
    const hw = width / 2, hh = height / 2;

    ctx.save();
    ribbons.forEach(r => r.draw(rot4D, bass, mid, high));
    ctx.restore();

    // Mirror horizontally
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ribbons.forEach(r => r.draw(rot4D, bass, mid, high));
    ctx.restore();

    // Mirror vertically
    ctx.save();
    ctx.translate(0, height);
    ctx.scale(1, -1);
    ribbons.forEach(r => r.draw(rot4D, bass, mid, high));
    ctx.restore();

    // Both
    ctx.save();
    ctx.translate(width, height);
    ctx.scale(-1, -1);
    ribbons.forEach(r => r.draw(rot4D, bass, mid, high));
    ctx.restore();
  } else {
    ribbons.forEach(r => r.draw(rot4D, bass, mid, high));
  }

  // Edge chromatic aberration on bass hit
  if (bass > 0.5) {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = (bass - 0.5) * 0.3;
    ctx.drawImage(canvas, bass * 6, 0);
    ctx.drawImage(canvas, -bass * 4, bass * 3);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

draw();
