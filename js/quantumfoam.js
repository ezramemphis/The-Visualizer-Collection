// ===============================
// VISUALIZER F — QUANTUM FOAM
// Spacetime topology: a grid that tears, folds, tunnels, and heals
// Each cell warps independently based on its frequency band
// Voronoi-style stress fractures split the canvas on beats
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
function band(i) { return (freqData[Math.min(i, 255)] || 0) / 255; }

/* ======================================================
 SETTINGS
====================================================== */
const settings = {
  // Grid
  gridW: 40,
  gridH: 30,
  cellPadding: 0.08,

  // Warp
  warpAmplitude: 55,
  warpFrequency: 0.06,
  warpTimeSpeed: 0.007,
  torsionStrength: 0.4,
  rippleSpeed: 0.09,

  // Tears
  tearThreshold: 0.62,
  tearCount: 6,
  tearDecay: 0.04,
  tearGlow: 1,

  // Tunnels
  tunnelCount: 3,
  tunnelRadius: 60,
  tunnelDepth: 200,

  // Rendering
  bgAlpha: 0.13,
  drawEdges: 1,
  drawFill: 1,
  edgeWidth: 0.8,
  depthFog: 0.7,

  // Color
  hueBase: 260,
  hueRange: 120,
  hueTimeSpeed: 0.15,
  saturation: 90,
  lightness: 55,
  tearHue: 30,
};

registerSceneSettings(settings);

/* ======================================================
 GRID MESH
====================================================== */
// Each vertex stores its own warp offset and freq binding
let verts = [];   // [gw+1][gh+1] flattened
let tears = [];   // active tear fractures

function initGrid() {
  verts = [];
  const gw = Math.floor(settings.gridW);
  const gh = Math.floor(settings.gridH);
  for (let j = 0; j <= gh; j++) {
    for (let i = 0; i <= gw; i++) {
      verts.push({
        bx: (i / gw) * width,
        by: (j / gh) * height,
        px: 0, py: 0,   // projected position
        depth: 0,
        freqBand: Math.floor((i / gw) * 180),
        phase: Math.random() * Math.PI * 2,
        phase2: Math.random() * Math.PI * 2,
      });
    }
  }
}

class Tear {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.life = 1.0;
    this.angle = Math.random() * Math.PI * 2;
    this.length = 60 + Math.random() * 120;
    this.width = 3 + Math.random() * 8;
    this.branches = Array.from({ length: 3 }, () => ({
      angle: this.angle + (Math.random() - 0.5) * 1.2,
      length: this.length * (0.3 + Math.random() * 0.5),
      life: 1.0,
    }));
  }
  update() { this.life -= settings.tearDecay; }
  draw() {
    if (this.life <= 0) return;
    const hue = settings.tearHue;
    const drawBranch = (x, y, angle, length, alpha) => {
      const ex = x + Math.cos(angle) * length;
      const ey = y + Math.sin(angle) * length;
      ctx.beginPath();
      ctx.moveTo(x, y);
      // Jagged — step along and jitter
      const steps = 8;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const jx = x + (ex - x) * t + (Math.random() - 0.5) * 12 * (1 - t);
        const jy = y + (ey - y) * t + (Math.random() - 0.5) * 12 * (1 - t);
        ctx.lineTo(jx, jy);
      }
      if (settings.tearGlow) {
        ctx.shadowColor = `hsl(${hue}, 100%, 80%)`;
        ctx.shadowBlur = 15;
      }
      ctx.strokeStyle = `hsla(${hue}, 100%, 80%, ${alpha})`;
      ctx.lineWidth = this.width * this.life;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    drawBranch(this.x, this.y, this.angle, this.length, this.life * 0.9);
    this.branches.forEach(b => {
      drawBranch(this.x, this.y, b.angle, b.length, this.life * 0.6);
    });
  }
}

/* ======================================================
 TUNNELS
====================================================== */
class Tunnel {
  constructor() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.radius = settings.tunnelRadius;
    this.depth = settings.tunnelDepth;
    this.rings = 12;
    this.phase = Math.random() * Math.PI * 2;
    this.hue = Math.random() * 360;
  }
  draw(bass, mid) {
    for (let r = this.rings; r >= 1; r--) {
      const t = r / this.rings;
      const radius = this.radius * t * (1 + bass * 0.5);
      const alpha = (1 - t) * 0.4 + mid * 0.2;
      const hue = (this.hue + frame * 0.3 + r * 15) % 360;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, ${settings.saturation}%, ${settings.lightness + 15}%, ${alpha})`;
      ctx.lineWidth = 1 + (1 - t) * 2;
      ctx.stroke();
    }
  }
}

/* ======================================================
 INIT
====================================================== */
initGrid();
let tunnels = Array.from({ length: Math.floor(settings.tunnelCount) }, () => new Tunnel());

/* ======================================================
 RESIZE
====================================================== */
function resize() {
  width = canvas.width;
  height = canvas.height;
  initGrid();
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
  <b>QUANTUM FOAM</b><hr>
  Grid W <input type="range" id="gridW" min="10" max="80" step="1"><br>
  Grid H <input type="range" id="gridH" min="8" max="60" step="1"><br>
  Warp Amplitude <input type="range" id="warpAmplitude" min="0" max="150"><br>
  Warp Frequency <input type="range" id="warpFrequency" min="0.01" max="0.3" step="0.005"><br>
  Warp Time Speed <input type="range" id="warpTimeSpeed" min="0" max="0.05" step="0.001"><br>
  Torsion Strength <input type="range" id="torsionStrength" min="0" max="2" step="0.05"><br>
  Ripple Speed <input type="range" id="rippleSpeed" min="0" max="0.3" step="0.005"><br>
  <hr><b>TEARS</b><hr>
  Tear Threshold <input type="range" id="tearThreshold" min="0.2" max="0.95" step="0.01"><br>
  Tear Count <input type="range" id="tearCount" min="0" max="20" step="1"><br>
  Tear Decay <input type="range" id="tearDecay" min="0.005" max="0.1" step="0.005"><br>
  Tear Glow <input type="range" id="tearGlow" min="0" max="1" step="1"><br>
  Tear Hue <input type="range" id="tearHue" min="0" max="360"><br>
  <hr><b>TUNNELS</b><hr>
  Tunnel Count <input type="range" id="tunnelCount" min="0" max="10" step="1"><br>
  Tunnel Radius <input type="range" id="tunnelRadius" min="10" max="200"><br>
  <hr><b>RENDER</b><hr>
  BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.5" step="0.01"><br>
  Draw Edges <input type="range" id="drawEdges" min="0" max="1" step="1"><br>
  Draw Fill <input type="range" id="drawFill" min="0" max="1" step="1"><br>
  Edge Width <input type="range" id="edgeWidth" min="0.2" max="4" step="0.1"><br>
  Depth Fog <input type="range" id="depthFog" min="0" max="1" step="0.05"><br>
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
    el.addEventListener("input", e => {
      settings[key] = parseFloat(e.target.value);
      if (key === "gridW" || key === "gridH") initGrid();
      if (key === "tunnelCount") tunnels = Array.from({ length: Math.floor(settings.tunnelCount) }, () => new Tunnel());
    });
  });
}
createDevPanel();

/* ======================================================
 DRAW
====================================================== */
let lastBass = 0;

function draw() {
  requestAnimationFrame(draw);
  if (devPanel) devPanel.style.display = devPanelActive ? "block" : "none";
  analyser.getByteFrequencyData(freqData);

  const bass = avg(0, 15);
  const mid  = avg(15, 80);
  const high = avg(80, 180);
  frame++;

  // Beat: spawn tears
  if (bass > settings.tearThreshold && lastBass <= settings.tearThreshold) {
    for (let i = 0; i < Math.floor(settings.tearCount); i++) {
      tears.push(new Tear(Math.random() * width, Math.random() * height));
    }
  }
  lastBass = bass;
  tears = tears.filter(t => t.life > 0);

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  const gw = Math.floor(settings.gridW);
  const gh = Math.floor(settings.gridH);
  const t  = frame * settings.warpTimeSpeed;

  // Update vertex positions
  for (let j = 0; j <= gh; j++) {
    for (let i = 0; i <= gw; i++) {
      const v = verts[j * (gw + 1) + i];
      if (!v) continue;

      const f  = band(v.freqBand);
      const nx = i * settings.warpFrequency;
      const ny = j * settings.warpFrequency;

      // Multi-octave warp
      const wx = Math.sin(nx + t + v.phase) * settings.warpAmplitude * f
               + Math.sin(nx * 2.3 + t * 1.7) * settings.warpAmplitude * 0.4 * mid;
      const wy = Math.cos(ny + t * 0.8 + v.phase2) * settings.warpAmplitude * f
               + Math.cos(ny * 1.8 - t * 1.3) * settings.warpAmplitude * 0.4 * high;

      // Torsion — rotational distortion from center
      const cx = v.bx - width / 2, cy = v.by - height / 2;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const torsionAngle = settings.torsionStrength * (dist / 400) * bass
                         + Math.sin(dist * settings.rippleSpeed - t * 5) * 0.3;
      const cosTor = Math.cos(torsionAngle), sinTor = Math.sin(torsionAngle);

      v.px = v.bx + cosTor * wx - sinTor * wy;
      v.py = v.by + sinTor * wx + cosTor * wy;
      v.depth = f + bass * 0.5;
    }
  }

  // Draw grid cells
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const v00 = verts[j       * (gw + 1) + i];
      const v10 = verts[j       * (gw + 1) + i + 1];
      const v01 = verts[(j + 1) * (gw + 1) + i];
      const v11 = verts[(j + 1) * (gw + 1) + i + 1];
      if (!v00 || !v10 || !v01 || !v11) continue;

      const avgDepth = (v00.depth + v10.depth + v01.depth + v11.depth) / 4;
      const hue = (settings.hueBase + frame * settings.hueTimeSpeed
                 + (i / gw) * settings.hueRange
                 + avgDepth * 60) % 360;
      const fog = settings.depthFog ? 1 - avgDepth * 0.5 : 1;
      const alpha = Math.max(0, Math.min(1, 0.3 + avgDepth * 0.5)) * fog;

      // Fill quad
      if (settings.drawFill) {
        ctx.beginPath();
        ctx.moveTo(v00.px, v00.py);
        ctx.lineTo(v10.px, v10.py);
        ctx.lineTo(v11.px, v11.py);
        ctx.lineTo(v01.px, v01.py);
        ctx.closePath();
        ctx.fillStyle = `hsla(${hue}, ${settings.saturation}%, ${settings.lightness}%, ${alpha * 0.35})`;
        ctx.fill();
      }

      // Edges
      if (settings.drawEdges) {
        ctx.beginPath();
        ctx.moveTo(v00.px, v00.py);
        ctx.lineTo(v10.px, v10.py);
        ctx.lineTo(v11.px, v11.py);
        ctx.lineTo(v01.px, v01.py);
        ctx.closePath();
        ctx.strokeStyle = `hsla(${hue}, ${settings.saturation}%, ${settings.lightness + 20}%, ${alpha})`;
        ctx.lineWidth = settings.edgeWidth;
        ctx.stroke();
      }
    }
  }

  // Tunnels
  tunnels.forEach(tn => tn.draw(bass, mid));

  // Tears (on top, additive)
  tears.forEach(t => t.draw());

  ctx.restore();
}

draw();
