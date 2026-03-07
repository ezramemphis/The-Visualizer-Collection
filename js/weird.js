import { ctx, canvas, analyser, freqData, timeData, devPanelActive } from "./visualizer.js";

/* ======================================================
 STATE
====================================================== */

let frame = 0;
let width = canvas.width;
let height = canvas.height;

let shards = [];
const SHARD_COUNT = 800;

/* ======================================================
 RESIZE
====================================================== */

function resize() {
  width = canvas.width;
  height = canvas.height;
}
window.addEventListener("resize", resize);

/* ======================================================
 HELPERS
====================================================== */

function avg(s, e) {
  let v = 0;
  for (let i = s; i < e; i++) v += freqData[i] || 0;
  return v / Math.max(1, e - s) / 255;
}

function rand(n) {
  return (Math.random() - 0.5) * n;
}

/* ======================================================
 SETTINGS
====================================================== */

const settings = {

  /* MAIN */

  shardCount: 800,
  coreRadiusBase: 60,
  spikeCountBase: 12,

  friction: 0.92,
  wrapMode: 1,

  backgroundAlpha: 0.12,
  globalBrightness: 1,

  /* AUDIO RESPONSE */

  bassForce: 3,
  midSpin: 0.05,
  highSparkDensity: 200,

  /* FIELD */

  vortexStrength: 0.004,
  shardChaos: 1.5,
  shardSpinSpeed: 0.01,

  /* COLOR */

  hueShiftSpeed: 0.5,
  hueSpread: 30,

  /* EXPERIMENTAL */

  crystalPulse: 1,
  refractionWarp: 1,
  sparkEnergy: 1,
  tearGlitchChance: 0.7,
  fieldRadiation: 1,
  temporalNoise: 0.002
};

/* ======================================================
 INIT SHARDS
====================================================== */

function initShards() {
  shards = [];

  for (let i = 0; i < settings.shardCount; i++) {
    shards.push({
      x: rand(width),
      y: rand(height),
      vx: 0,
      vy: 0,
      rot: Math.random() * Math.PI * 2,
      size: 1 + Math.random() * 3
    });
  }
}

initShards();

/* ======================================================
 DEV PANEL
====================================================== */

function createDevPanel() {

  const panel = document.createElement("div");

  Object.assign(panel.style, {
    position: "fixed",
    top: "6px",
    left: "6px",
    padding: "10px",
    background: "rgba(0,0,0,0.9)",
    color: "white",
    fontFamily: "sans-serif",
    fontSize: "12px",
    borderRadius: "8px",
    maxHeight: "95vh",
    overflowY: "auto",
    zIndex: 9999,
    display: "none"
  });

  panel.innerHTML = `
  <b>CRYSTAL SHARD ENGINE</b>

  <hr>
  <b>MAIN</b>

  Shard Count
  <input type="range" id="shardCount" min="200" max="1500"><br>

  Core Radius
  <input type="range" id="coreRadiusBase" min="20" max="200"><br>

  Spike Count
  <input type="range" id="spikeCountBase" min="4" max="60"><br>

  Friction
  <input type="range" id="friction" min="0.7" max="0.99" step="0.01"><br>

  Background Alpha
  <input type="range" id="backgroundAlpha" min="0" max="0.3" step="0.01"><br>

  Bass Force
  <input type="range" id="bassForce" min="0" max="10" step="0.1"><br>

  Mid Spin
  <input type="range" id="midSpin" min="0" max="0.2" step="0.005"><br>

  High Spark Density
  <input type="range" id="highSparkDensity" min="50" max="400"><br>

  <hr>
  <b>EXPERIMENTAL CHAOS</b>

  Vortex Strength
  <input type="range" id="vortexStrength" min="0" max="0.02" step="0.0005"><br>

  Shard Chaos
  <input type="range" id="shardChaos" min="0" max="5" step="0.1"><br>

  Hue Shift Speed
  <input type="range" id="hueShiftSpeed" min="0" max="3" step="0.01"><br>

  Crystal Pulse
  <input type="range" id="crystalPulse" min="0" max="5" step="0.1"><br>
  `;

  document.body.appendChild(panel);

  Object.keys(settings).forEach(key => {
    const el = panel.querySelector(`#${key}`);
    if (!el) return;

    el.value = settings[key];

    el.addEventListener("input", e => {
      settings[key] = parseFloat(e.target.value);

      if (key === "shardCount") initShards();
    });
  });

  return panel;
}

const devPanel = createDevPanel();

if(devPanel)
    devPanel.style.display = devPanelActive ? "block" : "none";

/* ======================================================
 DRAW LOOP
====================================================== */

function draw() {

  requestAnimationFrame(draw);

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  frame++;

  if (devPanel)
    devPanel.style.display = window.devPanelActive ? "block" : "none";

  const bass = avg(0, 12);
  const mid = avg(12, 60);
  const high = avg(60, 160);

  /* BACKGROUND */

  ctx.fillStyle = `rgba(0,0,0,${settings.backgroundAlpha})`;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);

  /* CORE CRYSTAL SPIKES */

  const coreRadius =
    settings.coreRadiusBase +
    bass * 200 * settings.crystalPulse;

  const spikes =
    settings.spikeCountBase +
    Math.floor(mid * 40);

  for (let i = 0; i < spikes; i++) {

    const angle =
      (i / spikes) * Math.PI * 2 +
      frame * settings.shardSpinSpeed;

    const len =
      coreRadius +
      Math.sin(frame * 0.03 + i) *
      bass * 120;

    const x = Math.cos(angle) * len;
    const y = Math.sin(angle) * len;

    ctx.strokeStyle =
      `hsla(${(frame * settings.hueShiftSpeed + i * settings.hueSpread) % 360},90%,60%,0.6)`;

    ctx.lineWidth = 1 + high * 3;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  /* SHARD FIELD */

  for (let s of shards) {

    s.vx += Math.cos(s.rot) *
      bass *
      settings.bassForce +
      rand(high * settings.shardChaos);

    s.vy += Math.sin(s.rot) *
      bass *
      settings.bassForce +
      rand(high * settings.shardChaos);

    s.rot += settings.midSpin + mid * 0.05;

    s.x += s.vx;
    s.y += s.vy;

    s.vx *= settings.friction;
    s.vy *= settings.friction;

    if (settings.wrapMode) {
      if (s.x < -width / 2) s.x = width / 2;
      if (s.x > width / 2) s.x = -width / 2;
      if (s.y < -height / 2) s.y = height / 2;
      if (s.y > height / 2) s.y = -height / 2;
    }

    ctx.fillStyle =
      `hsla(${(frame * 0.7 + s.x * 0.2) % 360},100%,${50 + high * 20}%,0.6)`;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);

    ctx.fillRect(
      -s.size / 2,
      -s.size / 2,
      s.size * 2,
      s.size / 4
    );

    ctx.restore();
  }

  /* HIGH FREQUENCY SPARK FIELD */

  const sparks =
    Math.floor(high * settings.highSparkDensity);

  for (let i = 0; i < sparks; i++) {

    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 400 * high;

    ctx.fillStyle =
      `hsla(${(frame * 2 + i * 5) % 360},100%,70%,${0.2 + high * 0.4})`;

    ctx.fillRect(
      Math.cos(angle) * dist,
      Math.sin(angle) * dist,
      Math.random() * 2 + 0.5,
      Math.random() * 2 + 0.5
    );
  }

  ctx.restore();
}

draw();