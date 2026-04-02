// ===============================
// VISUALIZER — TUNNEL ZOOM
// Concentric rings fly toward the viewer, pulsing and warping to audio.
// ===============================

import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let width  = canvas.width;
let height = canvas.height;
let frame  = 0;

/* ======================================================
   AUDIO HELPERS
====================================================== */

function avg(s, e) {
  let v = 0; const len = Math.max(1, e - s);
  for (let i = s; i < e; i++) v += freqData[i] || 0;
  return (v / len) / 255;
}

/* ======================================================
   SETTINGS
====================================================== */

const settings = {
  // --- TUNNEL ---
  numRings:       24,      // how many rings exist at once
  ringSpacing:    60,      // px between rings at rest
  tunnelSpeed:    2.0,     // px/frame rings move toward viewer
  bassSpeedBoost: 6.0,     // extra speed on bass hit
  perspective:    0.6,     // 0=flat, 1=strong perspective zoom
  vanishX:        0.0,     // vanishing point X offset (-1..1)
  vanishY:        0.0,     // vanishing point Y offset (-1..1)

  // --- RING SHAPE ---
  sides:          0,       // 0=circle, 3-8=polygon
  twist:          0.0,     // rotation offset per ring (radians)
  twistSpeed:     0.002,   // auto-advance twist
  warpAmp:        0.0,     // radial warp (0=perfect circle, 1=wild)
  warpFreq:       6,       // number of warp bumps around ring
  bassWarpBoost:  1.5,     // bass multiplies warp amplitude

  // --- LINE ---
  lineWidthBase:  1.5,
  lineWidthScale: 1,       // 0=constant, 1=thicker near viewer
  roundCaps:      0,

  // --- COLOR ---
  colorMode:      2,       // 0=white, 1=fixed hue, 2=hue per-ring, 3=hue cycle
  hue:            200,
  hueCycleSpeed:  0.4,
  hueSpread:      120,     // hue range across rings (mode 2)
  saturation:     85,
  lightnessNear:  80,      // lightness of near rings
  lightnessFar:   20,      // lightness of far rings

  // --- FADE ---
  alphaFar:       0.08,    // alpha of most distant ring
  alphaNear:      0.95,    // alpha of closest ring

  // --- BACKGROUND ---
  bgAlpha:        0.2,
  bgColor:        0,       // 0=black, 1=dark hue tint

  // --- EXTRAS ---
  glow:           1,
  glowBlur:       12,
  glowAlpha:      0.3,
  centerDot:      1,       // pulsing dot at vanish point
  centerDotSize:  6,
  scanlines:      0,
  scanlineAlpha:  0.1,
};

registerSceneSettings(settings);

/* ======================================================
   STATE
====================================================== */

let globalHue   = settings.hue;
let ringOffset  = 0;      // rolling offset so rings appear continuous
let twistOffset = 0;

/* ======================================================
   RESIZE
====================================================== */

function resize() { width = canvas.width; height = canvas.height; }
window.addEventListener("resize", resize);
resize();

/* ======================================================
   DEV PANEL
====================================================== */

let devPanel;

function createDevPanel() {
  devPanel = document.createElement("div");
  Object.assign(devPanel.style, {
    position: "fixed", top: "5px", left: "5px",
    padding: "10px 14px", background: "rgba(0,0,0,0.88)",
    color: "#eee", fontFamily: "monospace", fontSize: "11px",
    borderRadius: "6px", zIndex: 9999,
    display: "none", maxHeight: "95vh", overflowY: "auto",
    lineHeight: "1.9",
  });

  devPanel.innerHTML = `
<b>◉ TUNNEL ZOOM</b><hr>

<b>— TUNNEL —</b><br>
Num Rings         <input type="range" id="numRings"        min="4" max="60" style="width:110px"><br>
Ring Spacing      <input type="range" id="ringSpacing"     min="10" max="200" style="width:110px"><br>
Tunnel Speed      <input type="range" id="tunnelSpeed"     min="0" max="20" step="0.1" style="width:110px"><br>
Bass Speed Boost  <input type="range" id="bassSpeedBoost"  min="0" max="40" step="0.1" style="width:110px"><br>
Perspective       <input type="range" id="perspective"     min="0" max="1" step="0.01" style="width:110px"><br>
Vanish X          <input type="range" id="vanishX"         min="-1" max="1" step="0.01" style="width:110px"><br>
Vanish Y          <input type="range" id="vanishY"         min="-1" max="1" step="0.01" style="width:110px"><br>

<hr><b>— RING SHAPE —</b><br>
Sides <small>(0=circle 3-8=polygon)</small>
                  <input type="range" id="sides"           min="0" max="8" step="1" style="width:110px"><br>
Twist per Ring    <input type="range" id="twist"           min="-0.5" max="0.5" step="0.005" style="width:110px"><br>
Twist Auto Speed  <input type="range" id="twistSpeed"      min="-0.02" max="0.02" step="0.0005" style="width:110px"><br>
Warp Amplitude    <input type="range" id="warpAmp"         min="0" max="1" step="0.01" style="width:110px"><br>
Warp Frequency    <input type="range" id="warpFreq"        min="1" max="20" step="1" style="width:110px"><br>
Bass Warp Boost   <input type="range" id="bassWarpBoost"   min="0" max="5" step="0.05" style="width:110px"><br>

<hr><b>— LINE —</b><br>
Line Width Base   <input type="range" id="lineWidthBase"   min="0.3" max="8" step="0.1" style="width:110px"><br>
Scale with Depth <small>(0/1)</small>
                  <input type="range" id="lineWidthScale"  min="0" max="1" step="1" style="width:110px"><br>
Round Caps <small>(0/1)</small>
                  <input type="range" id="roundCaps"       min="0" max="1" step="1" style="width:110px"><br>

<hr><b>— COLOR —</b><br>
Color Mode <small>(0=white 1=fixed 2=per-ring 3=cycle)</small>
                  <input type="range" id="colorMode"       min="0" max="3" step="1" style="width:110px"><br>
Hue               <input type="range" id="hue"            min="0" max="360" style="width:110px"><br>
Hue Cycle Speed   <input type="range" id="hueCycleSpeed"  min="-3" max="3" step="0.05" style="width:110px"><br>
Hue Spread        <input type="range" id="hueSpread"      min="0" max="360" style="width:110px"><br>
Saturation        <input type="range" id="saturation"     min="0" max="100" style="width:110px"><br>
Lightness Near    <input type="range" id="lightnessNear"  min="10" max="100" style="width:110px"><br>
Lightness Far     <input type="range" id="lightnessFar"   min="0" max="80" style="width:110px"><br>

<hr><b>— FADE —</b><br>
Alpha Far         <input type="range" id="alphaFar"        min="0" max="0.5" step="0.005" style="width:110px"><br>
Alpha Near        <input type="range" id="alphaNear"       min="0.1" max="1" step="0.01" style="width:110px"><br>

<hr><b>— BACKGROUND —</b><br>
BG Trail Alpha    <input type="range" id="bgAlpha"         min="0.01" max="1" step="0.005" style="width:110px"><br>
BG Tint <small>(0=black 1=hue)</small>
                  <input type="range" id="bgColor"         min="0" max="1" step="1" style="width:110px"><br>

<hr><b>— EXTRAS —</b><br>
Glow <small>(0/1)</small>
                  <input type="range" id="glow"            min="0" max="1" step="1" style="width:110px"><br>
Glow Blur         <input type="range" id="glowBlur"        min="0" max="40" style="width:110px"><br>
Glow Alpha        <input type="range" id="glowAlpha"       min="0" max="1" step="0.01" style="width:110px"><br>
Center Dot <small>(0/1)</small>
                  <input type="range" id="centerDot"       min="0" max="1" step="1" style="width:110px"><br>
Center Dot Size   <input type="range" id="centerDotSize"   min="1" max="40" style="width:110px"><br>
Scanlines <small>(0/1)</small>
                  <input type="range" id="scanlines"       min="0" max="1" step="1" style="width:110px"><br>
Scanline Alpha    <input type="range" id="scanlineAlpha"   min="0" max="0.5" step="0.01" style="width:110px"><br>
`;

  document.body.appendChild(devPanel);
  Object.keys(settings).forEach(key => {
    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;
    el.value = settings[key];
    el.addEventListener("input", e => { settings[key] = parseFloat(e.target.value); });
  });
}

createDevPanel();

/* ======================================================
   DRAW RING
====================================================== */

function drawRing(cx, cy, radius, ringIdx, t, bass) {
  if (radius <= 0) return;

  // t = 0 (far) .. 1 (near)
  const n    = Math.round(settings.numRings);
  const warp = settings.warpAmp * (1 + bass * settings.bassWarpBoost);
  const rot  = twistOffset + ringIdx * settings.twist;

  let hue;
  if (settings.colorMode === 0)      hue = 0;
  else if (settings.colorMode === 1) hue = globalHue;
  else if (settings.colorMode === 2) hue = (globalHue + (ringIdx / n) * settings.hueSpread) % 360;
  else                               hue = globalHue;

  const alpha = settings.alphaFar + t * (settings.alphaNear - settings.alphaFar);
  const lightness = settings.lightnessFar + t * (settings.lightnessNear - settings.lightnessFar);

  const color = settings.colorMode === 0
    ? `rgba(255,255,255,${alpha})`
    : `hsla(${hue},${settings.saturation}%,${lightness}%,${alpha})`;

  ctx.strokeStyle = color;
  ctx.lineWidth   = settings.lineWidthBase * (settings.lineWidthScale ? (0.3 + t * 0.7) : 1);
  ctx.lineCap     = settings.roundCaps ? "round" : "butt";

  const sides = Math.round(settings.sides);

  ctx.beginPath();

  if (sides < 3) {
    // circle with optional warp
    if (warp < 0.01) {
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    } else {
      const steps = 120;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2 + rot;
        const bump = 1 + warp * Math.sin(a * settings.warpFreq + frame * 0.05);
        const r = radius * bump;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
  } else {
    // polygon with optional warp
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2 + rot;
      const bump = 1 + warp * Math.sin(a * settings.warpFreq + frame * 0.05);
      const r = radius * bump;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }

  ctx.closePath();
  ctx.stroke();
}

/* ======================================================
   DRAW
====================================================== */

function draw() {
  requestAnimationFrame(draw);
  if (devPanel) devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);
  frame++;

  const bass = avg(0, 20);
  const high = avg(80, 160);

  globalHue   = (settings.hue + frame * settings.hueCycleSpeed) % 360;
  twistOffset += settings.twistSpeed;
  ringOffset  += settings.tunnelSpeed + bass * settings.bassSpeedBoost;

  /* BG */
  ctx.fillStyle = settings.bgColor
    ? `hsla(${globalHue},30%,5%,${settings.bgAlpha})`
    : `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  const cx = width  / 2 + settings.vanishX * width  / 2;
  const cy = height / 2 + settings.vanishY * height / 2;
  const n  = Math.round(settings.numRings);
  const sp = settings.ringSpacing;
  const total = n * sp;

  /* draw back to front so near rings overlap far */
  function renderRings(glowPass) {
    for (let i = n - 1; i >= 0; i--) {
      // raw distance from vanish point
      const rawDist = ((i * sp - (ringOffset % total) + total) % total);
      if (rawDist <= 0) continue;

      // perspective: near rings grow faster
      const perspFrac = settings.perspective;
      const scale = 1 / Math.pow(rawDist / total, perspFrac + 0.001);
      const radius = rawDist * scale * 0.5;

      // clip absurdly large rings
      const maxR = Math.sqrt(width * width + height * height);
      if (radius > maxR * 1.5) continue;

      // depth fraction (0=far, 1=near)
      const t = 1 - rawDist / total;

      // freq-modulate each ring's size slightly
      const binIdx = Math.round((i / n) * 120);
      const freqMod = (freqData[binIdx] || 0) / 255;
      const modRadius = radius * (1 + freqMod * 0.15);

      drawRing(cx, cy, modRadius, i, t, bass);
    }
  }

  /* GLOW PASS */
  if (settings.glow) {
    ctx.save();
    ctx.filter      = `blur(${settings.glowBlur}px)`;
    ctx.globalAlpha = settings.glowAlpha;
    renderRings(true);
    ctx.restore();
    ctx.filter = "none";
  }

  /* MAIN */
  renderRings(false);

  /* CENTER DOT */
  if (settings.centerDot) {
    const r   = settings.centerDotSize * (1 + bass * 2);
    const cStr = settings.colorMode === 0 ? "255,255,255" : hslToRgbStr(globalHue, settings.saturation, 70);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${cStr},0.9)`);
    g.addColorStop(1, `rgba(${cStr},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* SCANLINES */
  if (settings.scanlines) {
    ctx.save();
    ctx.globalAlpha = settings.scanlineAlpha;
    ctx.fillStyle   = "#000";
    for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 2);
    ctx.restore();
  }
}

function hslToRgbStr(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return `${Math.round(f(0)*255)},${Math.round(f(8)*255)},${Math.round(f(4)*255)}`;
}

draw();

export { settings, devPanel };
