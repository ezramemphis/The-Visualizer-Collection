// ===============================
// VISUALIZER — GEODESIC SPIRAL (UPGRADED)
// Original spiral/radial line system — fully expanded
// New: Z-axis depth, mirror modes, bloom pulses, secondary geometry,
//      per-line phase drift, chromatic split, beat flash, polar grid,
//      waveform echo trails, and way more dev panel control
// ===============================

import { ctx, canvas, analyser, freqData, timeData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let frame = 0, width = canvas.width, height = canvas.height;
function resize() { width = canvas.width; height = canvas.height; }
window.addEventListener("resize", resize);

function avg(s, e) {
  let v = 0;
  for (let i = s; i < e; i++) v += freqData[i];
  return v / (e - s) / 255;
}

/* ======================================================
 SETTINGS
====================================================== */
const settings = {
  // Core spiral
  lineCount:       70,
  lineDensity:     6,
  radialAmp:       50,
  spiralTwist:     3.5,
  lineWidthBase:   1.5,
  waveAmplitude:   80,
  bgAlpha:         0.15,

  // Spiral shape controls (NEW)
  spiralLoops:     8,       // how many PI loops per line (was hardcoded 8)
  spiralStep:      0.02,    // step size along i (smaller=smoother, slower)
  xFreqMult:       1.0,     // x oscillator frequency multiplier
  yFreqMult:       1.2,     // y oscillator frequency multiplier (asymmetry)
  phasePerLine:    0.2,     // angle offset between lines
  frameSpeedX:     0.01,    // how fast x phase animates
  frameSpeedY:     0.012,   // how fast y phase animates

  // Audio response
  bassRadialBoost: 50,      // how much bass inflates radius
  midLineBoost:    2,       // mid multiplies secondary line width
  highLineBoost:   2,       // high multiplies primary line width
  beatFlash:       0,       // bright flash on beat (was 1 before)
  beatThreshold:   0.62,

  // Secondary layer
  secondaryLines:  1,       // 0=off 1=on
  secDensityMult:  0.8,
  secTwistMult:    1.2,
  secAmpMult:      0.6,
  secLoops:        6,
  secAlpha:        0.3,

  // Depth / Z illusion (NEW)
  depthMode:       1,       // 0=flat 1=pseudo-depth (line width+alpha scale with "z")
  depthAmp:        0.6,     // how strongly depth scales things

  // Mirror modes (NEW)
  mirrorX:         0,       // reflect across X axis
  mirrorY:         0,       // reflect across Y axis
  mirrorRot:       0,       // rotational symmetry count (0=off, 2-8)

  // Chromatic split (NEW)
  chromaSplit:     0,       // 0=off 1=on — RGB offset layers
  chromaOffset:    4,       // pixel offset for R/B channels
  chromaAlpha:     0.4,

  // Polar grid underlay (NEW)
  polarGrid:       0,       // show subtle polar grid
  polarGridRings:  5,
  polarGridSpokes: 12,
  polarGridAlpha:  0.08,

  // Waveform ring (NEW)
  waveRing:        1,       // draw time-domain as a ring
  waveRingRadius:  180,
  waveRingAmp:     60,
  waveRingWidth:   1.2,
  waveRingAlpha:   0.5,
  waveRingHue:     120,

  // Bloom pulses (NEW)
  bloomPulse:      1,       // radial bloom burst on beat
  bloomCount:      3,       // rings per bloom
  bloomSpeed:      4,       // expansion speed

  // Color
  hueStart:        0,
  hueEnd:          360,
  hueAnimSpeed:    1.5,     // hue shift per frame (was hardcoded 1.5)
  saturation:      100,
  lightness:       50,
  secSaturation:   80,
  secLightness:    60,
  colorMode:       0,       // 0=gradient across lines 1=audio-mapped 2=single hue
  singleHue:       200,
};

registerSceneSettings(settings);

/* ======================================================
 BEAT + BLOOM STATE
====================================================== */
let lastBass = 0;
let beatFlashAmt = 0;
const blooms = [];  // { r, alpha }

/* ======================================================
 DEV PANEL
====================================================== */
let devPanel;
function createDevPanel() {
  devPanel = document.createElement("div");
  Object.assign(devPanel.style, {
    position: "fixed", top: "5px", left: "5px",
    padding: "8px 10px",
    background: "rgba(0,0,0,0.85)", color: "#fff",
    fontFamily: "sans-serif", fontSize: "12px",
    borderRadius: "6px", zIndex: 9999,
    display: "none", maxHeight: "95vh", overflowY: "auto", width: "220px",
  });

  devPanel.innerHTML = `
  <b>GEODESIC SPIRAL+</b><hr>
  <b>CORE</b><br>
  Line Count <input type="range" id="lineCount" min="10" max="150" step="1"><br>
  Line Density <input type="range" id="lineDensity" min="1" max="14" step="0.1"><br>
  Radial Amp <input type="range" id="radialAmp" min="0" max="200"><br>
  Spiral Twist <input type="range" id="spiralTwist" min="0" max="10" step="0.05"><br>
  Spiral Loops <input type="range" id="spiralLoops" min="2" max="16" step="0.5"><br>
  Spiral Step <input type="range" id="spiralStep" min="0.005" max="0.06" step="0.005"><br>
  Line Width <input type="range" id="lineWidthBase" min="0.3" max="10" step="0.1"><br>
  Wave Amp <input type="range" id="waveAmplitude" min="0" max="300"><br>
  BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.5" step="0.01"><br>

  <hr><b>SHAPE</b><br>
  X Freq Mult <input type="range" id="xFreqMult" min="0.5" max="4" step="0.05"><br>
  Y Freq Mult <input type="range" id="yFreqMult" min="0.5" max="4" step="0.05"><br>
  Phase Per Line <input type="range" id="phasePerLine" min="0" max="1" step="0.01"><br>
  Frame Speed X <input type="range" id="frameSpeedX" min="0" max="0.05" step="0.001"><br>
  Frame Speed Y <input type="range" id="frameSpeedY" min="0" max="0.05" step="0.001"><br>

  <hr><b>AUDIO RESPONSE</b><br>
  Bass Radial Boost <input type="range" id="bassRadialBoost" min="0" max="150"><br>
  Mid Line Boost <input type="range" id="midLineBoost" min="0" max="6" step="0.1"><br>
  High Line Boost <input type="range" id="highLineBoost" min="0" max="6" step="0.1"><br>
  Beat Flash <input type="range" id="beatFlash" min="0" max="1" step="1"><br>
  Beat Threshold <input type="range" id="beatThreshold" min="0.2" max="0.95" step="0.01"><br>

  <hr><b>SECONDARY LAYER</b><br>
  Secondary Lines <input type="range" id="secondaryLines" min="0" max="1" step="1"><br>
  Sec Density Mult <input type="range" id="secDensityMult" min="0.2" max="2" step="0.05"><br>
  Sec Twist Mult <input type="range" id="secTwistMult" min="0.2" max="3" step="0.05"><br>
  Sec Amp Mult <input type="range" id="secAmpMult" min="0" max="2" step="0.05"><br>
  Sec Loops <input type="range" id="secLoops" min="2" max="14" step="0.5"><br>
  Sec Alpha <input type="range" id="secAlpha" min="0.05" max="1" step="0.05"><br>

  <hr><b>DEPTH ILLUSION</b><br>
  Depth Mode <input type="range" id="depthMode" min="0" max="1" step="1"><br>
  Depth Amp <input type="range" id="depthAmp" min="0" max="1.5" step="0.05"><br>

  <hr><b>MIRROR</b><br>
  Mirror X <input type="range" id="mirrorX" min="0" max="1" step="1"><br>
  Mirror Y <input type="range" id="mirrorY" min="0" max="1" step="1"><br>
  Rotational Sym <input type="range" id="mirrorRot" min="0" max="8" step="1"><br>

  <hr><b>CHROMATIC SPLIT</b><br>
  Chroma Split <input type="range" id="chromaSplit" min="0" max="1" step="1"><br>
  Chroma Offset <input type="range" id="chromaOffset" min="1" max="20"><br>
  Chroma Alpha <input type="range" id="chromaAlpha" min="0.05" max="1" step="0.05"><br>

  <hr><b>POLAR GRID</b><br>
  Polar Grid <input type="range" id="polarGrid" min="0" max="1" step="1"><br>
  Grid Rings <input type="range" id="polarGridRings" min="2" max="16" step="1"><br>
  Grid Spokes <input type="range" id="polarGridSpokes" min="2" max="24" step="1"><br>
  Grid Alpha <input type="range" id="polarGridAlpha" min="0.01" max="0.4" step="0.01"><br>

  <hr><b>WAVEFORM RING</b><br>
  Wave Ring <input type="range" id="waveRing" min="0" max="1" step="1"><br>
  Ring Radius <input type="range" id="waveRingRadius" min="40" max="400"><br>
  Ring Amp <input type="range" id="waveRingAmp" min="0" max="200"><br>
  Ring Width <input type="range" id="waveRingWidth" min="0.3" max="5" step="0.1"><br>
  Ring Alpha <input type="range" id="waveRingAlpha" min="0.05" max="1" step="0.05"><br>
  Ring Hue <input type="range" id="waveRingHue" min="0" max="360"><br>

  <hr><b>BLOOM PULSES</b><br>
  Bloom Pulse <input type="range" id="bloomPulse" min="0" max="1" step="1"><br>
  Bloom Count <input type="range" id="bloomCount" min="1" max="8" step="1"><br>
  Bloom Speed <input type="range" id="bloomSpeed" min="1" max="15"><br>

  <hr><b>COLOR</b><br>
  Color Mode <input type="range" id="colorMode" min="0" max="2" step="1">
  <span id="colorModeLabel" style="font-size:10px;color:#0cf"> gradient</span><br>
  Hue Start <input type="range" id="hueStart" min="0" max="360"><br>
  Hue End <input type="range" id="hueEnd" min="0" max="360"><br>
  Hue Anim Speed <input type="range" id="hueAnimSpeed" min="0" max="6" step="0.1"><br>
  Saturation <input type="range" id="saturation" min="0" max="100"><br>
  Lightness <input type="range" id="lightness" min="10" max="90"><br>
  Sec Saturation <input type="range" id="secSaturation" min="0" max="100"><br>
  Sec Lightness <input type="range" id="secLightness" min="10" max="90"><br>
  Single Hue <input type="range" id="singleHue" min="0" max="360"><br>
  `;

  document.body.appendChild(devPanel);

  const colorModeNames = ["gradient", "audio-map", "single hue"];
  const colorModeLabel = devPanel.querySelector("#colorModeLabel");

  Object.keys(settings).forEach(key => {
    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;
    el.value = settings[key];
    el.addEventListener("input", e => {
      settings[key] = parseFloat(e.target.value);
      if (key === "colorMode" && colorModeLabel)
        colorModeLabel.textContent = " " + (colorModeNames[Math.floor(settings.colorMode)] || "");
    });
  });
}
createDevPanel();

/* ======================================================
 HUE HELPER
====================================================== */
function lineHue(l, lineCount, bass, mid) {
  const mode = Math.floor(settings.colorMode);
  if (mode === 2) {
    return (settings.singleHue + frame * settings.hueAnimSpeed * 0.1) % 360;
  } else if (mode === 1) {
    // audio-mapped: bass shifts hue dramatically
    return (settings.hueStart + bass * 300 + mid * 80 + frame * settings.hueAnimSpeed * 0.5) % 360;
  } else {
    // gradient across lines (original behaviour)
    return (settings.hueStart
      + (settings.hueEnd - settings.hueStart) * (l / lineCount)
      + frame * settings.hueAnimSpeed) % 360;
  }
}

/* ======================================================
 DRAW ONE SPIRAL LINE
====================================================== */
function drawSpiralLine(l, lineCount, bass, mid, high, loops, step, densityMult, twistMult, ampMult, alphaMult, isSecondary) {
  const maxI = Math.PI * loops;
  const hue = isSecondary
    ? (settings.hueEnd - (settings.hueEnd - settings.hueStart) * (l / lineCount) + frame * settings.hueAnimSpeed * 1.5) % 360
    : lineHue(l, lineCount, bass, mid);

  const sat   = isSecondary ? settings.secSaturation : settings.saturation;
  const lit   = isSecondary ? settings.secLightness  : settings.lightness;
  const alpha = isSecondary ? settings.secAlpha * alphaMult : 0.6 * alphaMult;

  ctx.beginPath();

  let firstPt = true;
  for (let i = 0; i < maxI; i += step) {
    const tRaw = i / maxI;
    const idx  = (tRaw * timeData.length) | 0;
    const wave = (timeData[idx] - 128) / 128;

    // Core radial distance — identical to original formula
    const radial =
      i * settings.lineDensity * densityMult
      + Math.sin(i * settings.spiralTwist * twistMult + frame * 0.02 + l) * settings.radialAmp
      + Math.cos(i * 3 + frame * 0.01 * l) * settings.waveAmplitude * ampMult * wave
      + bass * settings.bassRadialBoost;

    // Depth illusion: pseudo-z based on spiral position
    let depthScale = 1;
    if (settings.depthMode) {
      const z = Math.sin(i * 0.5 + l * 0.3 + frame * 0.008);  // -1..1 fake Z
      depthScale = 1 + z * settings.depthAmp * 0.5;
    }

    const x = Math.cos(i * settings.xFreqMult + l * settings.phasePerLine + frame * settings.frameSpeedX) * radial * depthScale;
    const y = Math.sin(i * settings.yFreqMult + l * settings.phasePerLine * 1.3 + frame * settings.frameSpeedY) * radial * depthScale;

    if (firstPt) { ctx.moveTo(x, y); firstPt = false; }
    else ctx.lineTo(x, y);
  }

  // Line width — depth also scales it if enabled
  let lw = settings.lineWidthBase * (0.5 + (isSecondary ? mid * settings.midLineBoost : high * settings.highLineBoost));
  if (settings.depthMode) lw *= (0.7 + Math.sin(l * 0.4 + frame * 0.01) * settings.depthAmp * 0.3);

  ctx.strokeStyle = `hsla(${hue},${sat}%,${lit}%,${alpha})`;
  ctx.lineWidth   = lw;
  ctx.stroke();
}

/* ======================================================
 POLAR GRID
====================================================== */
function drawPolarGrid(bass) {
  const rings  = Math.floor(settings.polarGridRings);
  const spokes = Math.floor(settings.polarGridSpokes);
  const maxR   = Math.min(width, height) * 0.48;

  ctx.strokeStyle = `rgba(255,255,255,${settings.polarGridAlpha + bass * 0.05})`;
  ctx.lineWidth   = 0.5;

  // Rings
  for (let r = 1; r <= rings; r++) {
    ctx.beginPath();
    ctx.arc(0, 0, (r / rings) * maxR, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Spokes
  for (let s = 0; s < spokes; s++) {
    const a = (s / spokes) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * maxR, Math.sin(a) * maxR);
    ctx.stroke();
  }
}

/* ======================================================
 WAVEFORM RING
====================================================== */
function drawWaveRing(high) {
  const R   = settings.waveRingRadius;
  const amp = settings.waveRingAmp;
  const hue = (settings.waveRingHue + frame * 0.4) % 360;
  const n   = timeData.length;

  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const sample = (timeData[i % n] - 128) / 128;
    const r = R + sample * amp * (1 + high);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = `hsla(${hue},100%,65%,${settings.waveRingAlpha})`;
  ctx.lineWidth   = settings.waveRingWidth;
  ctx.stroke();
}

/* ======================================================
 BLOOM BURST
====================================================== */
function spawnBlooms(bass) {
  const count = Math.floor(settings.bloomCount);
  for (let i = 0; i < count; i++) {
    blooms.push({ r: 10 + i * 30, alpha: 0.6 + bass * 0.4 });
  }
}

function drawAndUpdateBlooms(bass) {
  for (let i = blooms.length - 1; i >= 0; i--) {
    const b = blooms[i];
    const hue = (settings.hueStart + b.r * 0.5 + frame * settings.hueAnimSpeed) % 360;
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue},100%,70%,${b.alpha})`;
    ctx.lineWidth   = 2 * b.alpha;
    ctx.stroke();

    b.r     += settings.bloomSpeed * (1 + bass);
    b.alpha -= 0.025;
    if (b.alpha <= 0) blooms.splice(i, 1);
  }
}

/* ======================================================
 ROTATIONAL MIRROR — draw fn repeated N times rotated
====================================================== */
function withMirror(drawFn) {
  const rotSym = Math.floor(settings.mirrorRot);

  if (rotSym >= 2) {
    for (let s = 0; s < rotSym; s++) {
      ctx.save();
      ctx.rotate((s / rotSym) * Math.PI * 2);
      if (settings.mirrorX) ctx.scale(1, -1);
      drawFn();
      ctx.restore();
    }
  } else {
    // No rotational symmetry — just handle X/Y mirrors
    const mx = settings.mirrorX ? -1 : 1;
    const my = settings.mirrorY ? -1 : 1;

    drawFn();

    if (settings.mirrorX) {
      ctx.save(); ctx.scale(-1, 1);  drawFn(); ctx.restore();
    }
    if (settings.mirrorY) {
      ctx.save(); ctx.scale(1, -1);  drawFn(); ctx.restore();
    }
    if (settings.mirrorX && settings.mirrorY) {
      ctx.save(); ctx.scale(-1, -1); drawFn(); ctx.restore();
    }
  }
}

/* ======================================================
 DRAW LOOP
====================================================== */
function draw() {
  requestAnimationFrame(draw);
  if (devPanel) devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  const bass = avg(0,  12);
  const mid  = avg(20, 90);
  const high = avg(80, 180);
  frame++;

  // Beat detection
  if (bass > settings.beatThreshold && lastBass <= settings.beatThreshold) {
    if (settings.beatFlash)  beatFlashAmt = 1.0;
    if (settings.bloomPulse) spawnBlooms(bass);
  }
  lastBass = bass;
  if (beatFlashAmt > 0) beatFlashAmt *= 0.78;

  // Background fade
  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  // Beat flash overlay
  if (beatFlashAmt > 0.02) {
    const hue = (settings.hueStart + frame * settings.hueAnimSpeed) % 360;
    ctx.fillStyle = `hsla(${hue},100%,70%,${beatFlashAmt * 0.12})`;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.globalCompositeOperation = "lighter";

  // Polar grid (underlay)
  if (settings.polarGrid) drawPolarGrid(bass);

  // Chromatic split (draw twice with RGB offset before main)
  if (settings.chromaSplit) {
    const off = settings.chromaOffset;
    ctx.save();
    ctx.globalAlpha = settings.chromaAlpha;

    // Red channel — offset right
    ctx.save();
    ctx.translate(off, 0);
    for (let l = 0; l < settings.lineCount; l++) {
      ctx.globalCompositeOperation = "lighter";
      const hue = lineHue(l, settings.lineCount, bass, mid);
      const lw  = settings.lineWidthBase * 0.4;
      ctx.strokeStyle = `hsla(0,100%,55%,0.25)`;
      ctx.lineWidth = lw;
      // Cheap version: reuse path logic inline (no full re-render, just one sub-pass)
      ctx.beginPath();
      for (let i = 0; i < Math.PI * settings.spiralLoops; i += settings.spiralStep * 2) {
        const idx  = (i / (Math.PI * settings.spiralLoops) * timeData.length) | 0;
        const wave = (timeData[idx] - 128) / 128;
        const radial = i * settings.lineDensity + Math.sin(i * settings.spiralTwist + frame * 0.02 + l) * settings.radialAmp + Math.cos(i * 3 + frame * 0.01 * l) * settings.waveAmplitude * wave + bass * settings.bassRadialBoost;
        const x = Math.cos(i * settings.xFreqMult + l * settings.phasePerLine + frame * settings.frameSpeedX) * radial;
        const y = Math.sin(i * settings.yFreqMult + l * settings.phasePerLine * 1.3 + frame * settings.frameSpeedY) * radial;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Cyan channel — offset left
    ctx.save();
    ctx.translate(-off, 0);
    ctx.strokeStyle = `rgba(0,255,255,0.15)`;
    for (let l = 0; l < settings.lineCount; l++) {
      ctx.lineWidth = settings.lineWidthBase * 0.4;
      ctx.beginPath();
      for (let i = 0; i < Math.PI * settings.spiralLoops; i += settings.spiralStep * 2) {
        const idx  = (i / (Math.PI * settings.spiralLoops) * timeData.length) | 0;
        const wave = (timeData[idx] - 128) / 128;
        const radial = i * settings.lineDensity + Math.sin(i * settings.spiralTwist + frame * 0.02 + l) * settings.radialAmp + Math.cos(i * 3 + frame * 0.01 * l) * settings.waveAmplitude * wave + bass * settings.bassRadialBoost;
        const x = Math.cos(i * settings.xFreqMult + l * settings.phasePerLine + frame * settings.frameSpeedX) * radial;
        const y = Math.sin(i * settings.yFreqMult + l * settings.phasePerLine * 1.3 + frame * settings.frameSpeedY) * radial;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  // PRIMARY SPIRAL LINES — with optional mirror
  withMirror(() => {
    for (let l = 0; l < settings.lineCount; l++) {
      drawSpiralLine(l, settings.lineCount, bass, mid, high,
        settings.spiralLoops, settings.spiralStep, 1, 1, 1, 1, false);
    }
  });

  // SECONDARY LAYER
  if (settings.secondaryLines) {
    withMirror(() => {
      const secCount = Math.floor(settings.lineCount / 2);
      for (let l = 0; l < secCount; l++) {
        drawSpiralLine(l, secCount, bass, mid, high,
          settings.secLoops, settings.spiralStep * 1.5,
          settings.secDensityMult, settings.secTwistMult, settings.secAmpMult,
          1, true);
      }
    });
  }

  // WAVEFORM RING
  if (settings.waveRing) drawWaveRing(high);

  // BLOOM BURSTS
  if (blooms.length) drawAndUpdateBlooms(bass);

  ctx.restore();
}

draw();
