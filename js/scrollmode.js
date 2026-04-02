// ===============================
// VISUALIZER F — ANALOG VECTOR SCOPE
// Dual-beam CRT: left channel → X axis, right channel → Y axis (XY mode)
// Simulates phosphor persistence, beam intensity, and CRT barrel distortion
// ===============================

import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let width = canvas.width;
let height = canvas.height;
let frame = 0;

function avg(s, e) {
  let v = 0;
  const len = Math.max(1, e - s);
  for (let i = s; i < e; i++) v += freqData[i] || 0;
  return (v / len) / 255;
}

const settings = {
  // Scope mode
  mode: 0,              // 0=XY (Lissajous from real audio), 1=YT (scrolling waveform), 2=polar

  // XY / Lissajous synthesis (when no true stereo available, synthesise from freq bands)
  xBandLow: 0,
  xBandHigh: 20,
  yBandLow: 20,
  yBandHigh: 80,
  xSynthFreq: 1.7,      // synthesised sine frequency for X
  ySynthFreq: 2.3,      // synthesised sine frequency for Y
  useSynthesis: 1,      // 1 = use synthesised sines shaped by audio, 0 = raw freq data

  // Beam
  beamIntensity: 1.0,
  beamWidth: 1.5,
  phosphorDecay: 0.06,  // how fast phosphor fades (higher = faster)

  // CRT effects
  barrelDistortion: 0.15,
  crtScanlines: 0,
  crtNoise: 0.015,
  crtVignette: 0.5,
  crtFlicker: 0.03,

  // Phosphor color
  phosphorType: 0,      // 0=P31 green, 1=amber, 2=P4 white, 3=blue

  // Audio response
  bassIntensity: 0.8,   // bass makes beam brighter / thicker
  midXShape: 0.5,       // mid modulates X synthesis
  highYShape: 0.5,      // high modulates Y synthesis
  audioBloom: 0.4,

  // Misc
  zoom: 0.82,           // overall scale
  rotateScope: 0.0,     // degrees, rotates entire pattern
  rotateSpeed: 0.0,
};

registerSceneSettings(settings);

function resize() { width = canvas.width; height = canvas.height; }
window.addEventListener("resize", resize);

const PHOSPHORS = [
  { h: 118, s: 95, l: 60, name: "P31 Green" },
  { h: 38,  s: 100,l: 60, name: "Amber" },
  { h: 30,  s: 10, l: 88, name: "P4 White" },
  { h: 200, s: 80, l: 70, name: "Blue" },
];

let devPanel;
function createDevPanel() {
  devPanel = document.createElement("div");
  Object.assign(devPanel.style, {
    position: "fixed", top: "5px", left: "5px",
    padding: "10px", background: "rgba(0,5,0,0.93)",
    color: "#60e870", fontFamily: "monospace", fontSize: "11px",
    borderRadius: "4px", border: "1px solid #1a5a1a",
    zIndex: 9999, display: "none", minWidth: "215px",
  });
  devPanel.innerHTML = `
  <b style="color:#90ff90;letter-spacing:2px">⊙ VECTOR SCOPE</b><hr style="border-color:#1a5a1a">
  <b>MODE</b><br>
  Display Mode <input type="range" id="mode" min="0" max="2" step="1"><br>
  <span style="opacity:0.55;font-size:10px">0=XY 1=YT scroll 2=polar</span><br>
  Use Synthesis <input type="range" id="useSynthesis" min="0" max="1" step="1"><br>
  <b>SYNTHESIS</b><br>
  X Freq <input type="range" id="xSynthFreq" min="0.5" max="8" step="0.1"><br>
  Y Freq <input type="range" id="ySynthFreq" min="0.5" max="8" step="0.1"><br>
  X Band Lo <input type="range" id="xBandLow"  min="0" max="100" step="1"><br>
  X Band Hi <input type="range" id="xBandHigh" min="0" max="100" step="1"><br>
  Y Band Lo <input type="range" id="yBandLow"  min="0" max="100" step="1"><br>
  Y Band Hi <input type="range" id="yBandHigh" min="0" max="100" step="1"><br>
  <hr style="border-color:#1a5a1a"><b>BEAM</b><br>
  Intensity     <input type="range" id="beamIntensity" min="0.1" max="3" step="0.05"><br>
  Width         <input type="range" id="beamWidth" min="0.3" max="5" step="0.1"><br>
  Phosphor Decay <input type="range" id="phosphorDecay" min="0.01" max="0.4" step="0.005"><br>
  <hr style="border-color:#1a5a1a"><b>CRT FX</b><br>
  Barrel Dist  <input type="range" id="barrelDistortion" min="0" max="0.5" step="0.01"><br>
  Scanlines    <input type="range" id="crtScanlines" min="0" max="1" step="1"><br>
  Noise        <input type="range" id="crtNoise" min="0" max="0.1" step="0.005"><br>
  Vignette     <input type="range" id="crtVignette" min="0" max="1" step="0.05"><br>
  Flicker      <input type="range" id="crtFlicker" min="0" max="0.2" step="0.005"><br>
  <hr style="border-color:#1a5a1a"><b>PHOSPHOR</b><br>
  Type <input type="range" id="phosphorType" min="0" max="3" step="1"><br>
  <span style="opacity:0.55;font-size:10px">0=green 1=amber 2=white 3=blue</span><br>
  <hr style="border-color:#1a5a1a"><b>AUDIO</b><br>
  Bass Intensity <input type="range" id="bassIntensity" min="0" max="2" step="0.05"><br>
  Mid X Shape    <input type="range" id="midXShape" min="0" max="2" step="0.05"><br>
  High Y Shape   <input type="range" id="highYShape" min="0" max="2" step="0.05"><br>
  Audio Bloom    <input type="range" id="audioBloom" min="0" max="1.5" step="0.05"><br>
  <hr style="border-color:#1a5a1a"><b>MISC</b><br>
  Zoom         <input type="range" id="zoom" min="0.3" max="1.0" step="0.01"><br>
  Rotate Scope <input type="range" id="rotateScope" min="-180" max="180" step="1"><br>
  Rotate Speed <input type="range" id="rotateSpeed" min="-2" max="2" step="0.05"><br>
  `;
  document.body.appendChild(devPanel);
  Object.keys(settings).forEach(key => {
    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;
    el.value = settings[key];
    el.addEventListener("input", e => settings[key] = parseFloat(e.target.value));
  });
}
createDevPanel();

// rolling YT waveform buffer
const YT_LEN = 512;
const ytBuffer = new Float32Array(YT_LEN);

function applyBarrel(px, py) {
  // barrel distortion from [-1,1] space
  const r2 = px * px + py * py;
  const k = settings.barrelDistortion;
  return [px * (1 + k * r2), py * (1 + k * r2)];
}

function draw() {
  requestAnimationFrame(draw);
  if (devPanel) devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);
  const bass = avg(0, 15);
  const mid  = avg(15, 60);
  const high = avg(80, 160);

  frame++;
  settings.rotateScope += settings.rotateSpeed;

  const flicker = 1 - Math.random() * settings.crtFlicker;

  // trail / phosphor persistence
  ctx.fillStyle = `rgba(0,0,0,${settings.phosphorDecay})`;
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2, cy = height / 2;
  const scale = Math.min(width, height) * 0.5 * settings.zoom * flicker;
  const p = PHOSPHORS[Math.round(settings.phosphorType)];

  const bassBoost = 1 + bass * settings.bassIntensity;
  const beamAlpha = Math.min(1, settings.beamIntensity * bassBoost * 0.9);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((settings.rotateScope * Math.PI) / 180);
  ctx.translate(-cx, -cy);

  ctx.globalCompositeOperation = "lighter";

  const mode = Math.round(settings.mode);

  // ---- XY MODE ----
  if (mode === 0) {
    const N = 512;
    const xEnergy = avg(settings.xBandLow, settings.xBandHigh);
    const yEnergy = avg(settings.yBandLow, settings.yBandHigh);

    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;

      let rx, ry;
      if (settings.useSynthesis === 1) {
        // synthesise Lissajous shaped by audio energy
        const xmod = 1 + mid * settings.midXShape;
        const ymod = 1 + high * settings.highYShape;
        rx = Math.sin(settings.xSynthFreq * xmod * t + frame * 0.01) * xEnergy;
        ry = Math.sin(settings.ySynthFreq * ymod * t) * yEnergy;
      } else {
        // use raw freq data mapped to X/Y
        const xi = Math.floor((i / N) * (settings.xBandHigh - settings.xBandLow)) + settings.xBandLow;
        const yi = Math.floor((i / N) * (settings.yBandHigh - settings.yBandLow)) + settings.yBandLow;
        rx = ((freqData[xi] || 0) / 255 - 0.5) * 2;
        ry = ((freqData[yi] || 0) / 255 - 0.5) * 2;
      }

      // add noise
      rx += (Math.random() - 0.5) * settings.crtNoise;
      ry += (Math.random() - 0.5) * settings.crtNoise;

      const [bx, by] = applyBarrel(rx, ry);
      const sx = cx + bx * scale;
      const sy = cy + by * scale;
      i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    }

    if (settings.audioBloom > 0) {
      ctx.save();
      ctx.filter = `blur(${2 + bass * 5}px)`;
      ctx.globalAlpha = settings.audioBloom * beamAlpha * 0.4;
      ctx.strokeStyle = `hsl(${p.h},${p.s}%,${p.l}%)`;
      ctx.lineWidth = settings.beamWidth * 2;
      ctx.stroke();
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    ctx.strokeStyle = `hsla(${p.h},${p.s}%,${p.l}%,${beamAlpha})`;
    ctx.lineWidth = settings.beamWidth;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // ---- YT SCROLLING ----
  else if (mode === 1) {
    // shift buffer
    ytBuffer.copyWithin(0, 1);
    ytBuffer[YT_LEN - 1] = (avg(settings.xBandLow, settings.xBandHigh) * 2 - 1)
      * (1 + bass * settings.bassIntensity);

    ctx.beginPath();
    for (let i = 0; i < YT_LEN; i++) {
      const x = cx - scale + (i / YT_LEN) * scale * 2;
      const y = cy - ytBuffer[i] * scale * 0.85;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }

    if (settings.audioBloom > 0) {
      ctx.save(); ctx.filter = `blur(3px)`;
      ctx.globalAlpha = settings.audioBloom * beamAlpha * 0.5;
      ctx.strokeStyle = `hsl(${p.h},${p.s}%,${p.l}%)`;
      ctx.lineWidth = settings.beamWidth + 1;
      ctx.stroke(); ctx.filter = "none"; ctx.globalAlpha = 1; ctx.restore();
    }
    ctx.strokeStyle = `hsla(${p.h},${p.s}%,${p.l}%,${beamAlpha})`;
    ctx.lineWidth = settings.beamWidth;
    ctx.stroke();
  }

  // ---- POLAR ----
  else {
    const N = freqData.length;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const angle = (i / N) * Math.PI * 2;
      const r = ((freqData[i % N] || 0) / 255) * scale;
      const noise = (Math.random() - 0.5) * settings.crtNoise * scale * 0.5;
      const rx = (r + noise) / scale; // normalise for barrel
      const ry = 0;
      // rotate noise
      const bx = (r + noise) * Math.cos(angle);
      const by = (r + noise) * Math.sin(angle);
      const sx = cx + bx;
      const sy = cy + by;
      i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    }

    if (settings.audioBloom > 0) {
      ctx.save(); ctx.filter = `blur(${2 + bass * 4}px)`;
      ctx.globalAlpha = settings.audioBloom * beamAlpha * 0.35;
      ctx.strokeStyle = `hsl(${p.h},${p.s}%,${p.l}%)`;
      ctx.lineWidth = settings.beamWidth + 1;
      ctx.stroke(); ctx.filter = "none"; ctx.globalAlpha = 1; ctx.restore();
    }
    ctx.strokeStyle = `hsla(${p.h},${p.s}%,${p.l}%,${beamAlpha})`;
    ctx.lineWidth = settings.beamWidth;
    ctx.stroke();
  }

  ctx.restore();
  ctx.globalCompositeOperation = "source-over";

  // CRT vignette
  if (settings.crtVignette > 0) {
    const vg = ctx.createRadialGradient(cx, cy, cy * 0.5, cx, cy, cy * 1.1);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(0,0,0,${settings.crtVignette})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, width, height);
  }

  // scanlines
  if (settings.crtScanlines === 1) {
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    for (let sy = 0; sy < height; sy += 3) {
      ctx.fillRect(0, sy, width, 1);
    }
  }
}

draw();
