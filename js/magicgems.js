// ===============================
// VISUALIZER H — GRAVITY WELL PARTICLE COLLAPSE
// Thousands of particles in orbital mechanics around moving attractors
// Bass spawns supernovae — particles collapse inward then explode outward
// Streaks drawn with velocity-based motion blur
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
  // Particles
  particleCount: 2000,
  spawnRadius: 280,
  particleLife: 180,
  trailLength: 8,

  // Gravity
  attractorCount: 3,
  gravityStrength: 0.9,
  gravityFalloff: 1.8,  // exponent (2=inverse square)
  maxForce: 4,
  orbitTangent: 0.6,    // tangential velocity component

  // Audio response
  bassCollapse: 150,    // inward force on bass
  bassExplosion: 300,   // outward force after collapse
  midSpiral: 0.8,
  highJitter: 0.5,

  // Attractor motion
  attractorOrbitR: 160,
  attractorOrbitSpeed: 0.007,
  attractorPulse: 1,

  // Rendering
  bgAlpha: 0.18,
  particleSize: 1.5,
  streakMode: 1,        // 0=dot, 1=streak
  streakAlpha: 0.6,
  bloomMode: 1,

  // Color
  hueBase: 20,
  hueVelShift: 120,     // hue shift based on speed
  hueTimeSpeed: 0.05,
  saturation: 100,
  lightness: 65,
  ageFade: 1,
};

registerSceneSettings(settings);

/* ======================================================
 PARTICLE POOL (typed arrays for speed)
====================================================== */
const MAX_P = 6000;
const px  = new Float32Array(MAX_P);
const py  = new Float32Array(MAX_P);
const pvx = new Float32Array(MAX_P);
const pvy = new Float32Array(MAX_P);
const page = new Float32Array(MAX_P);
const plife = new Float32Array(MAX_P);
const phue = new Float32Array(MAX_P);
let activeCount = 0;

function spawnParticle(idx, cx, cy) {
  const angle = Math.random() * Math.PI * 2;
  const r = settings.spawnRadius * (0.3 + Math.random() * 0.7);
  px[idx] = cx + Math.cos(angle) * r;
  py[idx] = cy + Math.sin(angle) * r;
  // Initial orbital velocity
  const tangAngle = angle + Math.PI / 2;
  const speed = Math.sqrt(settings.gravityStrength / Math.max(r, 20)) * 20 * settings.orbitTangent;
  pvx[idx] = Math.cos(tangAngle) * speed + (Math.random() - 0.5) * 0.5;
  pvy[idx] = Math.sin(tangAngle) * speed + (Math.random() - 0.5) * 0.5;
  page[idx] = 0;
  plife[idx] = settings.particleLife * (0.5 + Math.random() * 0.5);
  phue[idx] = settings.hueBase + Math.random() * 60;
}

function initParticles() {
  activeCount = Math.min(Math.floor(settings.particleCount), MAX_P);
  const cx = width / 2, cy = height / 2;
  for (let i = 0; i < activeCount; i++) spawnParticle(i, cx, cy);
}

/* ======================================================
 ATTRACTORS
====================================================== */
class Attractor {
  constructor(idx, total) {
    this.angle = (idx / total) * Math.PI * 2;
    this.mass = 1.0;
    this.hue = (idx / total) * 360;
    this.phase = idx * 1.3;
    this.supernova = 0;
    this.supernovaDir = 1;
  }
  x() {
    return width / 2 + Math.cos(this.angle) * settings.attractorOrbitR
           * (settings.attractorPulse ? 1 + Math.sin(frame * 0.023 + this.phase) * 0.3 : 1);
  }
  y() {
    return height / 2 + Math.sin(this.angle) * settings.attractorOrbitR * 0.6
           * (settings.attractorPulse ? 1 + Math.cos(frame * 0.019 + this.phase) * 0.3 : 1);
  }
  update(bass, mid) {
    this.angle += settings.attractorOrbitSpeed * (1 + mid);
    // Supernova countdown after bass hit
    if (this.supernova > 0) this.supernova--;
  }
  triggerSupernova() { this.supernova = 40; this.supernovaDir *= -1; }
}

let attractors = [];
function initAttractors() {
  attractors = Array.from(
    { length: Math.floor(settings.attractorCount) },
    (_, i) => new Attractor(i, Math.floor(settings.attractorCount))
  );
}

/* ======================================================
 INIT
====================================================== */
initParticles();
initAttractors();

/* ======================================================
 RESIZE
====================================================== */
function resize() {
  width = canvas.width; height = canvas.height;
  initParticles(); initAttractors();
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
  <b>GRAVITY WELL COLLAPSE</b><hr>
  Particle Count <input type="range" id="particleCount" min="100" max="5000" step="100"><br>
  Spawn Radius <input type="range" id="spawnRadius" min="50" max="500"><br>
  Particle Life <input type="range" id="particleLife" min="30" max="600"><br>
  Trail Length <input type="range" id="trailLength" min="1" max="20" step="1"><br>
  <hr><b>GRAVITY</b><hr>
  Attractor Count <input type="range" id="attractorCount" min="1" max="8" step="1"><br>
  Gravity Strength <input type="range" id="gravityStrength" min="0" max="5" step="0.05"><br>
  Gravity Falloff <input type="range" id="gravityFalloff" min="0.5" max="4" step="0.1"><br>
  Max Force <input type="range" id="maxForce" min="0.5" max="20" step="0.5"><br>
  Orbit Tangent <input type="range" id="orbitTangent" min="0" max="2" step="0.05"><br>
  <hr><b>AUDIO</b><hr>
  Bass Collapse <input type="range" id="bassCollapse" min="0" max="400"><br>
  Bass Explosion <input type="range" id="bassExplosion" min="0" max="600"><br>
  Mid Spiral <input type="range" id="midSpiral" min="0" max="3" step="0.1"><br>
  High Jitter <input type="range" id="highJitter" min="0" max="2" step="0.05"><br>
  <hr><b>ATTRACTORS</b><hr>
  Orbit Radius <input type="range" id="attractorOrbitR" min="0" max="400"><br>
  Orbit Speed <input type="range" id="attractorOrbitSpeed" min="0" max="0.05" step="0.001"><br>
  Attractor Pulse <input type="range" id="attractorPulse" min="0" max="1" step="1"><br>
  <hr><b>RENDER</b><hr>
  BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.5" step="0.01"><br>
  Particle Size <input type="range" id="particleSize" min="0.5" max="6" step="0.1"><br>
  Streak Mode <input type="range" id="streakMode" min="0" max="1" step="1"><br>
  Streak Alpha <input type="range" id="streakAlpha" min="0.05" max="1" step="0.05"><br>
  Bloom Mode <input type="range" id="bloomMode" min="0" max="1" step="1"><br>
  <hr><b>COLOR</b><hr>
  Hue Base <input type="range" id="hueBase" min="0" max="360"><br>
  Hue Vel Shift <input type="range" id="hueVelShift" min="0" max="360"><br>
  Hue Time Speed <input type="range" id="hueTimeSpeed" min="0" max="1" step="0.01"><br>
  Saturation <input type="range" id="saturation" min="0" max="100"><br>
  Lightness <input type="range" id="lightness" min="10" max="90"><br>
  Age Fade <input type="range" id="ageFade" min="0" max="1" step="1"><br>
  `;
  document.body.appendChild(devPanel);
  Object.keys(settings).forEach(key => {
    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;
    el.value = settings[key];
    el.addEventListener("input", e => {
      settings[key] = parseFloat(e.target.value);
      if (key === "particleCount") initParticles();
      if (key === "attractorCount") initAttractors();
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

  // Beat: trigger supernovae
  const beatThresh = 0.6;
  if (bass > beatThresh && lastBass <= beatThresh) {
    attractors.forEach(a => a.triggerSupernova());
  }
  lastBass = bass;

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  // Update attractors
  attractors.forEach(a => a.update(bass, mid));

  const count = Math.min(activeCount, Math.floor(settings.particleCount));

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < count; i++) {
    // Age particle
    page[i]++;
    if (page[i] > plife[i]) {
      spawnParticle(i, width / 2, height / 2);
      continue;
    }

    const lifeRatio = page[i] / plife[i];

    // Apply gravity from each attractor
    let fx = 0, fy = 0;
    for (const a of attractors) {
      const ax = a.x(), ay = a.y();
      const dx = ax - px[i];
      const dy = ay - py[i];
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq) || 1;

      // Inverse-power gravity
      const force = Math.min(
        settings.gravityStrength * a.mass / Math.pow(dist, settings.gravityFalloff),
        settings.maxForce
      );

      // Supernova: flip force direction
      const forceDir = a.supernova > 0 ? -a.supernovaDir : 1;
      fx += (dx / dist) * force * forceDir;
      fy += (dy / dist) * force * forceDir;

      // Tangential spiral (mid-driven)
      fx += (-dy / dist) * force * settings.midSpiral * mid * 0.5;
      fy += (dx / dist)  * force * settings.midSpiral * mid * 0.5;
    }

    // Bass: pulse outward from screen center
    const cdx = px[i] - width / 2, cdy = py[i] - height / 2;
    const cdist = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
    if (bass > 0.4) {
      fx += (cdx / cdist) * (bass - 0.4) * settings.bassExplosion * 0.01;
      fy += (cdy / cdist) * (bass - 0.4) * settings.bassExplosion * 0.01;
    }

    // High frequency jitter
    fx += (Math.random() - 0.5) * high * settings.highJitter;
    fy += (Math.random() - 0.5) * high * settings.highJitter;

    pvx[i] += fx;
    pvy[i] += fy;

    // Damping
    pvx[i] *= 0.985;
    pvy[i] *= 0.985;

    const prevX = px[i];
    const prevY = py[i];
    px[i] += pvx[i];
    py[i] += pvy[i];

    // Wrap
    if (px[i] < -100) px[i] = width + 100;
    if (px[i] > width + 100) px[i] = -100;
    if (py[i] < -100) py[i] = height + 100;
    if (py[i] > height + 100) py[i] = -100;

    // Color
    const speed = Math.sqrt(pvx[i] * pvx[i] + pvy[i] * pvy[i]);
    const hue = (phue[i] + frame * settings.hueTimeSpeed + speed * settings.hueVelShift * 0.05) % 360;
    const ageAlpha = settings.ageFade ? Math.sin(lifeRatio * Math.PI) : 1;
    const alpha = ageAlpha * (0.4 + mid * 0.4);

    if (settings.streakMode && (pvx[i] !== 0 || pvy[i] !== 0)) {
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(px[i], py[i]);
      ctx.strokeStyle = `hsla(${hue}, ${settings.saturation}%, ${settings.lightness}%, ${alpha * settings.streakAlpha})`;
      ctx.lineWidth = settings.particleSize * (0.5 + speed * 0.05);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(px[i], py[i], settings.particleSize * ageAlpha, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, ${settings.saturation}%, ${settings.lightness}%, ${alpha})`;
      ctx.fill();
    }

    // Bloom: draw halo
    if (settings.bloomMode && speed > 3) {
      ctx.beginPath();
      ctx.arc(px[i], py[i], settings.particleSize * 4 * (speed / 8), 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, ${settings.saturation}%, ${settings.lightness + 20}%, ${alpha * 0.1})`;
      ctx.fill();
    }
  }

  // Draw attractors as glowing orbs
  attractors.forEach(a => {
    const ax = a.x(), ay = a.y();
    const pulse = a.supernova > 0 ? 1 + (a.supernova / 40) * 3 : 1 + bass * 0.5;
    const r = 15 * pulse;
    const grd = ctx.createRadialGradient(ax, ay, 0, ax, ay, r * 4);
    grd.addColorStop(0, `hsla(${a.hue}, 100%, 90%, 0.9)`);
    grd.addColorStop(1, `hsla(${a.hue}, 100%, 60%, 0)`);
    ctx.beginPath();
    ctx.arc(ax, ay, r * 4, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  });

  ctx.restore();
}

draw();
