import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";

let frame = 0, width = canvas.width, height = canvas.height;
function resize() { width = canvas.width; height = canvas.height; }
window.addEventListener("resize", resize);

function avg(s, e) { let v = 0; for (let i = s; i < e; i++) v += freqData[i]; return v / (e - s) / 255; }

/* ===== PARAMETERS & DEV PANEL ===== */
const settings = {
  useStaticColor: false,  // toggle static color
  staticColor: "#ff00ff", // color when static mode is on
  hueStart: 0,            // start of cycling hue range
  hueEnd: 300,            // end of cycling hue range
  cubeSize: 2,            // cube radius multiplier
  rotSpeed: 0.01,         // rotation speed multiplier
  gridSize: 6,            // number of cubes per axis
  bgAlpha: 0.25           // background alpha
};

let devPanel;
function createDevPanel() {
  devPanel = document.createElement("div");
  devPanel.style.position = "fixed";
  devPanel.style.top = "5px";
  devPanel.style.left = "5px";
  devPanel.style.padding = "6px 10px";
  devPanel.style.background = "rgba(0,0,0,0.7)";
  devPanel.style.color = "#fff";
  devPanel.style.fontFamily = "sans-serif";
  devPanel.style.fontSize = "12px";
  devPanel.style.borderRadius = "4px";
  devPanel.style.zIndex = 9999;
  devPanel.style.display = "none";

  devPanel.innerHTML = `
    <div style="margin-bottom:4px;font-weight:bold;font-size:10px;">DEV PANEL</div>
    <label>Static Color: <input type="checkbox" id="devUseStaticColor"></label><br>
    <label>Choose Color: <input type="color" id="devStaticColor" value="${settings.staticColor}"></label><br>
    <label>Hue Start: <input type="range" id="devHueStart" min="0" max="360" step="1" value="${settings.hueStart}"></label><br>
    <label>Hue End: <input type="range" id="devHueEnd" min="0" max="360" step="1" value="${settings.hueEnd}"></label><br>
    <label>Cube Size: <input type="range" id="devCubeSize" min="1" max="10" step="0.1" value="${settings.cubeSize}"></label><br>
    <label>Rotation Speed: <input type="range" id="devRotSpeed" min="0" max="0.1" step="0.001" value="${settings.rotSpeed}"></label><br>
    <label>Grid Size: <input type="range" id="devGridSize" min="2" max="12" step="1" value="${settings.gridSize}"></label><br>
    <label>BG Alpha: <input type="range" id="devBgAlpha" min="0" max="1" step="0.01" value="${settings.bgAlpha}"></label>
  `;

  document.body.appendChild(devPanel);

  // link inputs to settings
  document.getElementById("devUseStaticColor").addEventListener("input", e => settings.useStaticColor = e.target.checked);
  document.getElementById("devStaticColor").addEventListener("input", e => settings.staticColor = e.target.value);
  document.getElementById("devHueStart").addEventListener("input", e => settings.hueStart = parseInt(e.target.value));
  document.getElementById("devHueEnd").addEventListener("input", e => settings.hueEnd = parseInt(e.target.value));
  document.getElementById("devCubeSize").addEventListener("input", e => settings.cubeSize = parseFloat(e.target.value));
  document.getElementById("devRotSpeed").addEventListener("input", e => settings.rotSpeed = parseFloat(e.target.value));
  document.getElementById("devGridSize").addEventListener("input", e => settings.gridSize = parseInt(e.target.value));
  document.getElementById("devBgAlpha").addEventListener("input", e => settings.bgAlpha = parseFloat(e.target.value));
}
createDevPanel();

/* ===== CUBE GRID ===== */
let cubes = [];
function createCubes() {
  cubes = [];
  for (let x = 0; x < settings.gridSize; x++)
    for (let y = 0; y < settings.gridSize; y++)
      for (let z = 0; z < settings.gridSize; z++)
        cubes.push({ x: x - settings.gridSize / 2, y: y - settings.gridSize / 2, z: z - settings.gridSize / 2 });
}
createCubes();

function project3D(x, y, z, rotX, rotY) {
  let cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  let cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  let y2 = y * cosX - z * sinX;
  let z2 = y * sinX + z * cosX;
  let x2 = x * cosY - z2 * sinY;
  let z3 = x * sinY + z2 * cosY;
  const scale = 400 / (400 + z3);
  return { x: x2 * scale * 50 + width / 2, y: y2 * scale * 50 + height / 2 };
}

/* ===== DRAW LOOP ===== */
function draw() {
  requestAnimationFrame(draw);

  devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);
  const bass = avg(0, 15), mid = avg(20, 90), high = avg(80, 180);
  frame++;

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  if (cubes.length !== Math.pow(settings.gridSize, 3)) createCubes();

  const rotX = frame * settings.rotSpeed + bass * 0.05;
  const rotY = frame * settings.rotSpeed + mid * 0.05;

  cubes.forEach(c => {
    const p = project3D(c.x, c.y, c.z, rotX, rotY);

    // determine color
    let fillColor;
    if (settings.useStaticColor) {
      fillColor = settings.staticColor;
    } else {
      const hueRange = (settings.hueEnd - settings.hueStart + 360) % 360;
      const hue = (settings.hueStart + (frame * 2) % hueRange) % 360;
      fillColor = `hsla(${hue},100%,50%,0.7)`;
    }

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, settings.cubeSize + high * 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

draw();