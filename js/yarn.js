import { ctx, canvas, analyser, freqData, timeData, devPanelActive } from "./visualizer.js";

let frame = 0, width = canvas.width, height = canvas.height;
function resize() { width = canvas.width; height = canvas.height; }
window.addEventListener("resize", resize);
function avg(s, e) { let v = 0; for (let i = s; i < e; i++) v += freqData[i]; return v / (e - s) / 255; }

// ===== DEV PANEL =====
const settings = {
  ribbonCount: 7,
  ribbonWidth: 7,
  ribbonSpeed: 0.01,
  ribbonTwist: 2.9,
  hueStart: 50,
  hueEnd: 160,
  radialAmplitude: 60,
  bgAlpha: 0.1
};

let devPanel;
function createDevPanel() {
  devPanel = document.createElement("div");
  devPanel.style.position = "fixed"; devPanel.style.top = "5px"; devPanel.style.left = "5px";
  devPanel.style.padding = "6px 10px"; devPanel.style.background = "rgba(0,0,0,0.7)";
  devPanel.style.color = "#fff"; devPanel.style.fontFamily = "sans-serif"; devPanel.style.fontSize = "12px";
  devPanel.style.borderRadius = "4px"; devPanel.style.zIndex = 9999; devPanel.style.display = "none";

  devPanel.innerHTML = `
    <div style="margin-bottom:4px;font-weight:bold;font-size:10px;">DEV PANEL</div>
    <label>Ribbon Count: <input type="range" id="devRibbonCount" min="1" max="12" step="1" value="${settings.ribbonCount}"></label><br>
    <label>Ribbon Width: <input type="range" id="devRibbonWidth" min="1" max="50" step="1" value="${settings.ribbonWidth}"></label><br>
    <label>Ribbon Speed: <input type="range" id="devRibbonSpeed" min="0.001" max="0.05" step="0.001" value="${settings.ribbonSpeed}"></label><br>
    <label>Ribbon Twist: <input type="range" id="devRibbonTwist" min="0" max="5" step="0.01" value="${settings.ribbonTwist}"></label><br>
    <label>Hue Start: <input type="range" id="devHueStart" min="0" max="360" step="1" value="${settings.hueStart}"></label><br>
    <label>Hue End: <input type="range" id="devHueEnd" min="0" max="360" step="1" value="${settings.hueEnd}"></label><br>
    <label>Radial Amp: <input type="range" id="devRadialAmp" min="0" max="200" step="1" value="${settings.radialAmplitude}"></label><br>
    <label>BG Alpha: <input type="range" id="devBgAlpha" min="0" max="1" step="0.01" value="${settings.bgAlpha}"></label>
  `;

  document.body.appendChild(devPanel);
  document.getElementById("devRibbonCount").addEventListener("input", e => settings.ribbonCount = parseInt(e.target.value));
  document.getElementById("devRibbonWidth").addEventListener("input", e => settings.ribbonWidth = parseInt(e.target.value));
  document.getElementById("devRibbonSpeed").addEventListener("input", e => settings.ribbonSpeed = parseFloat(e.target.value));
  document.getElementById("devRibbonTwist").addEventListener("input", e => settings.ribbonTwist = parseFloat(e.target.value));
  document.getElementById("devHueStart").addEventListener("input", e => settings.hueStart = parseInt(e.target.value));
  document.getElementById("devHueEnd").addEventListener("input", e => settings.hueEnd = parseInt(e.target.value));
  document.getElementById("devRadialAmp").addEventListener("input", e => settings.radialAmplitude = parseFloat(e.target.value));
  document.getElementById("devBgAlpha").addEventListener("input", e => settings.bgAlpha = parseFloat(e.target.value));
}
createDevPanel();

// ===== DRAW LOOP =====
function draw() {
  requestAnimationFrame(draw);
  devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  const bass = avg(0, 12), mid = avg(20, 90), high = avg(80, 180);
  frame++;

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);

  for (let r = 0; r < settings.ribbonCount; r++) {
    ctx.beginPath();
    const hue = settings.hueStart + ((settings.hueEnd - settings.hueStart) * (r / settings.ribbonCount) + frame) % 360;
    ctx.strokeStyle = `hsla(${hue},100%,50%,0.7)`;
    ctx.lineWidth = settings.ribbonWidth * (0.5 + high);

    for (let i = 0; i < Math.PI * 2; i += 0.03) {
      const idx = (i / (Math.PI * 2) * timeData.length) | 0;
      const waveform = (timeData[idx] - 128) / 128;

      const radialOsc = Math.sin(i * settings.ribbonTwist + frame * settings.ribbonSpeed + r) * settings.radialAmplitude;
      const radius = 120 + i * 50 + radialOsc + waveform * high * 150 + bass * 80;
      const x = Math.cos(i + r * 0.7 + frame * 0.01) * radius;
      const y = Math.sin(i + r * 1.3 + frame * 0.012) * radius;

      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Add secondary ripple layer for crazy depth
  for (let r = 0; r < settings.ribbonCount; r++) {
    ctx.beginPath();
    const hue = (settings.hueStart + (settings.hueEnd - settings.hueStart) * (r / settings.ribbonCount) + frame * 1.5) % 360;
    ctx.strokeStyle = `hsla(${hue},80%,60%,0.4)`;
    ctx.lineWidth = settings.ribbonWidth * 0.5 * (0.5 + mid);

    for (let i = 0; i < Math.PI * 2; i += 0.04) {
      const idx = (i / (Math.PI * 2) * timeData.length) | 0;
      const waveform = (timeData[idx] - 128) / 128;

      const radialOsc = Math.cos(i * settings.ribbonTwist * 1.5 + frame * settings.ribbonSpeed * 1.3 + r) * settings.radialAmplitude * 0.5;
      const radius = 80 + i * 40 + radialOsc + waveform * mid * 120 + bass * 40;
      const x = Math.cos(i + r * 1.1 + frame * 0.008) * radius;
      const y = Math.sin(i + r * 1.6 + frame * 0.009) * radius;

      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

draw();