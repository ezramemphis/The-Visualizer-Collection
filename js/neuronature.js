import { canvas, ctx, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";
const LFO_ACTIVE = false;   // ← set to false to disable all LFO motion

//////////////////////////////////////////////////////////
// CANVAS SETUP
//////////////////////////////////////////////////////////

let width = canvas.width;
let height = canvas.height;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  width = canvas.width;
  height = canvas.height;
}
window.addEventListener("resize", resize);
resize();

//////////////////////////////////////////////////////////
// SIMPLE GLOBAL LFO ENGINE (FAST + CLEAN)
//////////////////////////////////////////////////////////

let lfoPhase = 0;

const LFO_SPEED = 1; // master speed multiplier

// ranges
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

const DIST_MIN = 80;
const DIST_MAX = 300;

const BG_ALPHA_MIN = 0.05;
const BG_ALPHA_MAX = 0.6;

//////////////////////////////////////////////////////////
// AUDIO HELPER
//////////////////////////////////////////////////////////

function avg(s, e) {
  let v = 0;
  for (let i = s; i < e; i++) v += freqData[i];
  return v / (e - s) / 255;
}

//////////////////////////////////////////////////////////
// SETTINGS
//////////////////////////////////////////////////////////

let lfoTime = 0;
const lfoSpeed = 0.5;      // speed of oscillation
const lfoMinZoom = 0.5;    // minimum zoom
const lfoMaxZoom = 2.5;    // maximum zoom

const settings = {
  lineColor: "#1b0935",
  bgColor: "#000000",
  bgAlpha: 0.2,

  lineWidthMult: 2,
  nodeSpeedMult: 2,
  connectionDist: 100,
  nodeCount: 150,

  chaosField: 0,
  velocityDamping: 0,
  orbitPull: 0,
  connectionFadeBias: 0,

  // NEW EXPERIMENTAL
  nodeSize: 0,               // draws visible node dots
  edgeWrap: 0,               // 0 = bounce, 1 = wrap
  colorShiftSpeed: 0,        // cycles line color over time
  imageOpacity: 1,           // background image alpha
  imageZoom: 1               // background image scale
};

registerSceneSettings(settings);

//////////////////////////////////////////////////////////
// BACKGROUND IMAGE
//////////////////////////////////////////////////////////

let backgroundImage = null;

function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

//////////////////////////////////////////////////////////
// NODE SYSTEM
//////////////////////////////////////////////////////////

let nodes = [];

function rebuildNodes() {
  nodes = [];
  for (let i = 0; i < settings.nodeCount; i++) {
    nodes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2
    });
  }
}
rebuildNodes();

//////////////////////////////////////////////////////////
// DEV PANEL
//////////////////////////////////////////////////////////

let devPanel;

function createDevPanel() {

  devPanel = document.createElement("div");

  Object.assign(devPanel.style, {
    position: "fixed",
    top: "5px",
    left: "5px",
    padding: "8px",
    background: "rgba(0,0,0,0.8)",
    color: "#fff",
    fontFamily: "sans-serif",
    fontSize: "12px",
    borderRadius: "6px",
    zIndex: 9999,
    display: "none",
    maxHeight: "95vh",
    overflowY: "auto"
  });

  devPanel.innerHTML = `
  <b>DEV PANEL — NEURO NATURE</b><hr>

  <b>MAIN</b><hr>

  Line Color <input type="color" id="lineColor"><br>
  Background Color <input type="color" id="bgColor"><br>

  Line Width <input type="range" id="lineWidthMult" class="slider-main" min="0.5" max="6" step="0.1"><br>
  Node Speed <input type="range" id="nodeSpeedMult" class="slider-main" min="0" max="10" step="0.1"><br>
  Node Size <input type="range" id="nodeSize" class="slider-main" min="0" max="10" step="0.5"><br>
  Connection Dist <input type="range" id="connectionDist" class="slider-main" min="50" max="400"><br>
  BG Alpha <input type="range" id="bgAlpha" class="slider-main" min="0" max="1" step="0.01"><br>

  <hr><b>EXPERIMENTAL</b><hr>

  Node Count <input type="range" id="nodeCount" class="slider-exp" min="50" max="400"><br>
  Chaos Field <input type="range" id="chaosField" class="slider-exp" min="0" max="5" step="0.01"><br>
  Velocity Damping <input type="range" id="velocityDamping" class="slider-exp" min="0" max="0.2" step="0.001"><br>
  Orbit Pull <input type="range" id="orbitPull" class="slider-exp" min="0" max="0.01" step="0.0001"><br>
  Color Shift Speed <input type="range" id="colorShiftSpeed" class="slider-exp" min="0" max="2" step="0.01"><br>

  Image Opacity <input type="range" id="imageOpacity" class="slider-exp" min="0" max="1" step="0.01"><br>
  Image Zoom <input type="range" id="imageZoom" class="slider-exp" min="0.5" max="3" step="0.1"><br>

  <hr>
  Upload Background Image<br>
  <input type="file" id="bgUpload" accept="image/*">
  `;

  document.body.appendChild(devPanel);

  Object.keys(settings).forEach(key => {
    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;

    el.value = settings[key];

    el.addEventListener("input", e => {
      settings[key] = isNaN(settings[key])
        ? e.target.value
        : parseFloat(e.target.value);

      if (key === "nodeCount") rebuildNodes();
    });
  });

  const upload = devPanel.querySelector("#bgUpload");
  upload.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => backgroundImage = img;
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

createDevPanel();

//////////////////////////////////////////////////////////
// DRAW LOOP
//////////////////////////////////////////////////////////

function draw() {

  requestAnimationFrame(draw);

  if (devPanel)
    devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);

  //////////////////////////////////////////////////////////
  // LFO UPDATE (can be disabled instantly)
  //////////////////////////////////////////////////////////

  if (LFO_ACTIVE) {

    // advance phase (0 → 1 loop)
    lfoPhase += 0.002 * LFO_SPEED;
    if (lfoPhase > 1) lfoPhase -= 1;

    // -------- SINE (zoom) --------
    const sine = Math.sin(lfoPhase * Math.PI * 2);
    const sineNorm = (sine + 1) * 0.5;

    settings.imageZoom =
      ZOOM_MIN + sineNorm * (ZOOM_MAX - ZOOM_MIN);

    // -------- SAW (connection distance) --------
    settings.connectionDist =
      DIST_MIN + lfoPhase * (DIST_MAX - DIST_MIN);

    // -------- SQUARE (bg alpha) --------
    const square = lfoPhase < 0.5 ? 1 : 0;

    settings.bgAlpha =
      BG_ALPHA_MIN + square * (BG_ALPHA_MAX - BG_ALPHA_MIN);

  }


  //////////////////////////////////////////////////////
  // AUDIO VALUES
  //////////////////////////////////////////////////////

  const bass = avg(0, 12);
  const mid = avg(30, 90);
  const high = avg(100, 180);

  //////////////////////////////////////////////////////
  // BACKGROUND LAYER
  //////////////////////////////////////////////////////

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = settings.imageOpacity;

  if (backgroundImage) {
    const zoom = settings.imageZoom;
    const w = width * zoom;
    const h = height * zoom;
    ctx.drawImage(
      backgroundImage,
      (width - w) / 2,
      (height - h) / 2,
      w,
      h
    );
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = hexToRGBA(settings.bgColor, settings.bgAlpha);
  ctx.fillRect(0, 0, width, height);

  //////////////////////////////////////////////////////
  // PHYSICS
  //////////////////////////////////////////////////////

  const speedMult = 1 + bass * settings.nodeSpeedMult;
  const cx = width / 2;
  const cy = height / 2;

  nodes.forEach(n => {

    n.x += n.vx * speedMult;
    n.y += n.vy * speedMult;

    n.x += (Math.random() - 0.5) * settings.chaosField;
    n.y += (Math.random() - 0.5) * settings.chaosField;

    n.vx -= (n.x - cx) * settings.orbitPull;
    n.vy -= (n.y - cy) * settings.orbitPull;

    n.vx *= (1 - settings.velocityDamping);
    n.vy *= (1 - settings.velocityDamping);

    if (settings.edgeWrap) {
      if (n.x < 0) n.x = width;
      if (n.x > width) n.x = 0;
      if (n.y < 0) n.y = height;
      if (n.y > height) n.y = 0;
    } else {
      if (n.x < 0 || n.x > width) n.vx *= -1;
      if (n.y < 0 || n.y > height) n.vy *= -1;
    }
  });

  //////////////////////////////////////////////////////
  // RENDER
  //////////////////////////////////////////////////////

  ctx.globalCompositeOperation = "lighter";

  let dynamicColor = settings.lineColor;

  if (settings.colorShiftSpeed > 0) {
    const hue = (performance.now() * 0.05 * settings.colorShiftSpeed) % 360;
    dynamicColor = `hsl(${hue}, 70%, 60%)`;
  }

  for (let i = 0; i < nodes.length; i++) {

    if (settings.nodeSize > 0) {
      ctx.beginPath();
      ctx.arc(nodes[i].x, nodes[i].y, settings.nodeSize, 0, Math.PI * 2);
      ctx.fillStyle = dynamicColor;
      ctx.fill();
    }

    for (let j = i + 1; j < nodes.length; j++) {

      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d < settings.connectionDist + mid * 200) {

        ctx.strokeStyle = dynamicColor;
        ctx.lineWidth = 1 + high * settings.lineWidthMult;

        ctx.globalAlpha =
          1 - settings.connectionFadeBias * (d / 400);

        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

draw();

// testing out this exporting thing
export { settings, devPanel };