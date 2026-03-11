// ===============================
// VISUALIZER C — NEURAL MYCELIUM ENGINE
// Organic branching network that grows, rots, and pulses with audio
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

/* ======================================================
 SETTINGS
====================================================== */

const settings = {
  // Growth
  nodeCount: 120,
  connectionRadius: 140,
  growthSpeed: 0.008,
  branchDecay: 0.012,

  // Physics
  repelStrength: 0.6,
  attractStrength: 0.003,
  driftSpeed: 0.4,
  bassExplosion: 80,

  // Rendering
  bgAlpha: 0.08,
  lineWidth: 1.2,
  nodeSize: 3.5,
  glowPasses: 3,

  // Color
  hueBase: 120,
  hueSpread: 90,
  saturation: 90,
  lightness: 60,
  pulseOnBeat: 1,

  // Tendrils
  tendrilCount: 8,
  tendrilLength: 60,
  tendrilWaver: 0.04,
};

registerSceneSettings(settings);

/* ======================================================
 NODE SYSTEM
====================================================== */

class Node {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = (Math.random() - 0.5) * width * 0.8 + width / 2;
    this.y = (Math.random() - 0.5) * height * 0.8 + height / 2;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.life = Math.random();
    this.maxLife = 0.8 + Math.random() * 0.2;
    this.age = 0;
    this.freq = Math.floor(Math.random() * 200);
    this.phase = Math.random() * Math.PI * 2;
    this.size = 0.5 + Math.random() * 1.5;
  }

  update(bass, mid, high, frame) {
    this.age += settings.growthSpeed;
    this.life = Math.sin(this.age * Math.PI / this.maxLife);

    // Audio reactive drift
    const wobble = Math.sin(frame * 0.02 + this.phase);
    const wobble2 = Math.cos(frame * 0.015 + this.phase * 1.3);

    this.vx += wobble * settings.driftSpeed * 0.01;
    this.vy += wobble2 * settings.driftSpeed * 0.01;

    // Bass explosion from center
    const cx = width / 2, cy = height / 2;
    const dx = this.x - cx, dy = this.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.vx += (dx / dist) * bass * settings.bassExplosion * 0.005;
    this.vy += (dy / dist) * bass * settings.bassExplosion * 0.005;

    // Damping
    this.vx *= 0.96;
    this.vy *= 0.96;

    this.x += this.vx;
    this.y += this.vy;

    // Boundary wrap
    if (this.x < -50) this.x = width + 50;
    if (this.x > width + 50) this.x = -50;
    if (this.y < -50) this.y = height + 50;
    if (this.y > height + 50) this.y = -50;

    if (this.age > this.maxLife) this.reset();
  }
}

/* ======================================================
 TENDRIL SYSTEM
====================================================== */

class Tendril {
  constructor(x, y, angle) {
    this.points = [{ x, y }];
    this.angle = angle;
    this.life = 1.0;
    this.hue = Math.random() * 360;
  }

  grow(bass, high, frame) {
    if (this.points.length >= settings.tendrilLength) {
      this.points.shift();
    }
    const last = this.points[this.points.length - 1];
    this.angle += (Math.random() - 0.5) * settings.tendrilWaver * (1 + high * 5);
    const speed = 1.5 + bass * 8;
    this.points.push({
      x: last.x + Math.cos(this.angle) * speed,
      y: last.y + Math.sin(this.angle) * speed,
    });
    this.life -= settings.branchDecay;
  }

  draw(high) {
    if (this.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    const hue = (this.hue + frame * 0.5) % 360;
    ctx.strokeStyle = `hsla(${hue}, ${settings.saturation}%, ${settings.lightness}%, ${this.life * 0.6})`;
    ctx.lineWidth = this.life * settings.lineWidth * 1.5;
    ctx.stroke();
  }
}

/* ======================================================
 INIT
====================================================== */

let nodes = [];
let tendrils = [];

function initNodes() {
  nodes = Array.from({ length: settings.nodeCount }, () => new Node());
}

initNodes();

/* ======================================================
 RESIZE
====================================================== */

function resize() {
  width = canvas.width;
  height = canvas.height;
  initNodes();
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
  <b>NEURAL MYCELIUM</b><hr>

  Node Count <input type="range" id="nodeCount" class="slider-main" min="20" max="300" step="1"><br>
  Connection Radius <input type="range" id="connectionRadius" class="slider-main" min="30" max="300"><br>
  Growth Speed <input type="range" id="growthSpeed" class="slider-main" min="0.001" max="0.05" step="0.001"><br>
  Branch Decay <input type="range" id="branchDecay" class="slider-main" min="0.001" max="0.05" step="0.001"><br>
  Repel Strength <input type="range" id="repelStrength" class="slider-main" min="0" max="3" step="0.1"><br>
  Attract Strength <input type="range" id="attractStrength" class="slider-main" min="0" max="0.02" step="0.001"><br>
  Drift Speed <input type="range" id="driftSpeed" class="slider-main" min="0" max="3" step="0.1"><br>
  Bass Explosion <input type="range" id="bassExplosion" class="slider-main" min="0" max="200"><br>
  BG Alpha <input type="range" id="bgAlpha" class="slider-main" min="0.01" max="0.5" step="0.01"><br>
  Line Width <input type="range" id="lineWidth" class="slider-main" min="0.3" max="5" step="0.1"><br>
  Node Size <input type="range" id="nodeSize" class="slider-main" min="1" max="10" step="0.5"><br>
  Glow Passes <input type="range" id="glowPasses" class="slider-main" min="1" max="6" step="1"><br>

  <hr><b>COLOR</b><hr>
  Hue Base <input type="range" id="hueBase" class="slider-main" min="0" max="360"><br>
  Hue Spread <input type="range" id="hueSpread" class="slider-main" min="0" max="180"><br>
  Saturation <input type="range" id="saturation" class="slider-main" min="0" max="100"><br>
  Lightness <input type="range" id="lightness" class="slider-main" min="10" max="90"><br>
  Pulse on Beat <input type="range" id="pulseOnBeat" class="slider-main" min="0" max="1" step="1"><br>

  <hr><b>TENDRILS</b><hr>
  Tendril Count <input type="range" id="tendrilCount" class="slider-main" min="0" max="30" step="1"><br>
  Tendril Length <input type="range" id="tendrilLength" class="slider-main" min="10" max="150"><br>
  Tendril Waver <input type="range" id="tendrilWaver" class="slider-main" min="0" max="0.2" step="0.005"><br>
  `;

  document.body.appendChild(devPanel);

  Object.keys(settings).forEach(key => {
    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;
    el.value = settings[key];
    el.addEventListener("input", e => {
      settings[key] = parseFloat(e.target.value);
      if (key === "nodeCount") initNodes();
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
  const mid = avg(15, 80);
  const high = avg(80, 180);

  frame += 1;

  // Beat detection
  const beatThreshold = 0.55;
  if (bass > beatThreshold && lastBass <= beatThreshold) {
    // Spawn tendrils on beat
    for (let i = 0; i < settings.tendrilCount; i++) {
      const node = nodes[Math.floor(Math.random() * nodes.length)];
      tendrils.push(new Tendril(node.x, node.y, Math.random() * Math.PI * 2));
      if (tendrils.length > 300) tendrils.shift();
    }
  }
  lastBass = bass;

  // Background fade
  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  // Update nodes
  nodes.forEach(n => n.update(bass, mid, high, frame));

  // Update & draw tendrils
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  tendrils = tendrils.filter(t => t.life > 0);
  tendrils.forEach(t => {
    t.grow(bass, high, frame);
    t.draw(high);
  });
  ctx.restore();

  // Draw connections (the mycelium web)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    if (a.life <= 0) continue;

    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      if (b.life <= 0) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > settings.connectionRadius) continue;

      const t = 1 - dist / settings.connectionRadius;
      const alpha = t * Math.min(a.life, b.life) * (0.4 + mid * 0.6);

      const hue = (settings.hueBase + frame * 0.3 + i * (settings.hueSpread / nodes.length)) % 360;

      // Multi-pass glow
      for (let g = 0; g < settings.glowPasses; g++) {
        const gAlpha = alpha / (g + 1) * 0.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);

        // Organic mid-point waver
        const mx = (a.x + b.x) / 2 + Math.sin(frame * 0.02 + i) * 10 * mid;
        const my = (a.y + b.y) / 2 + Math.cos(frame * 0.018 + j) * 10 * mid;
        ctx.quadraticCurveTo(mx, my, b.x, b.y);

        ctx.strokeStyle = `hsla(${hue}, ${settings.saturation}%, ${settings.lightness}%, ${gAlpha})`;
        ctx.lineWidth = (settings.lineWidth + g * 1.5) * t;
        ctx.stroke();
      }

      // Repel nodes that are too close
      if (dist < 40) {
        const force = settings.repelStrength * (1 - dist / 40);
        a.vx -= (dx / dist) * force * 0.01;
        a.vy -= (dy / dist) * force * 0.01;
        b.vx += (dx / dist) * force * 0.01;
        b.vy += (dy / dist) * force * 0.01;
      }
    }
  }

  // Draw nodes
  nodes.forEach((n, i) => {
    if (n.life <= 0) return;
    const hue = (settings.hueBase + frame * 0.3 + i * (settings.hueSpread / nodes.length)) % 360;
    const pulse = settings.pulseOnBeat ? 1 + bass * 2 : 1;
    const r = n.size * settings.nodeSize * n.life * pulse;

    const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3);
    grd.addColorStop(0, `hsla(${hue}, ${settings.saturation}%, ${Math.min(90, settings.lightness + 20)}%, ${n.life * 0.9})`);
    grd.addColorStop(1, `hsla(${hue}, ${settings.saturation}%, ${settings.lightness}%, 0)`);

    ctx.beginPath();
    ctx.arc(n.x, n.y, r * 3, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  });

  ctx.restore();
}

draw();
