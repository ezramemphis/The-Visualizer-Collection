import { canvas, ctx, analyser, freqData, devPanelActive } from "./visualizer.js";

// ============================
// CANVAS / NODES SETUP
// ============================
let width = canvas.width;
let height = canvas.height;
function resize() { width = canvas.width; height = canvas.height; }
window.addEventListener("resize", resize);

function avg(s, e) {
  let v = 0;
  for (let i = s; i < e; i++) v += freqData[i];
  return v / (e - s) / 255;
}

let nodes = [];
const NODE_COUNT = 150;
for (let i = 0; i < NODE_COUNT; i++) {
  nodes.push({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
  });
}

// ============================
// DEV PANEL HTML + CONTROLS
// ============================
let devPanel;
const settings = {
  lineColor: "#1b0935",
  lineWidthMult: 2,
  nodeSpeedMult: 3,
  connectionDist: 100,
  bgAlpha: 0.2,
};

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
    <label>Line Color: <input type="color" id="devLineColor" value="${settings.lineColor}"></label><br>
    <label>Line Width Mult: <input type="range" id="devLineWidth" min="0.5" max="5" step="0.1" value="${settings.lineWidthMult}"></label><br>
    <label>Node Speed Mult: <input type="range" id="devNodeSpeed" min="0.5" max="10" step="0.1" value="${settings.nodeSpeedMult}"></label><br>
    <label>Connection Dist: <input type="range" id="devConnDist" min="50" max="400" step="1" value="${settings.connectionDist}"></label><br>
    <label>BG Alpha: <input type="range" id="devBgAlpha" min="0" max="1" step="0.01" value="${settings.bgAlpha}"></label>
  `;

  document.body.appendChild(devPanel);

  // Connect inputs to settings
  document.getElementById("devLineColor").addEventListener("input", e => settings.lineColor = e.target.value);
  document.getElementById("devLineWidth").addEventListener("input", e => settings.lineWidthMult = parseFloat(e.target.value));
  document.getElementById("devNodeSpeed").addEventListener("input", e => settings.nodeSpeedMult = parseFloat(e.target.value));
  document.getElementById("devConnDist").addEventListener("input", e => settings.connectionDist = parseFloat(e.target.value));
  document.getElementById("devBgAlpha").addEventListener("input", e => settings.bgAlpha = parseFloat(e.target.value));
}

createDevPanel();

// ============================
// DRAW LOOP
// ============================
function draw() {
  requestAnimationFrame(draw);

  // Toggle panel visibility
  devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);
  const bass = avg(0, 12);
  const mid = avg(30, 90);
  const high = avg(100, 180);

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  nodes.forEach(n => {
    n.x += n.vx * (1 + bass * settings.nodeSpeedMult);
    n.y += n.vy * (1 + bass * settings.nodeSpeedMult);
    if (n.x < 0 || n.x > width) n.vx *= -1;
    if (n.y < 0 || n.y > height) n.vy *= -1;
  });

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < settings.connectionDist + mid * 200) {
        ctx.strokeStyle = settings.lineColor;
        ctx.lineWidth = 1 + high * settings.lineWidthMult;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

draw();