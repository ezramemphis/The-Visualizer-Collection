// ===============================
// VISUALIZER S — EPICYCLE MACHINE
// Stacked rotating vectors (Fourier epicycles) whose tip traces a curve
// Each circle's radius, rotation speed, and phase are driven by audio bands
// The tip path accumulates as a trail — complex mechanical flower patterns
// Beat triggers a "clutch" — arms freeze, path resets, new pattern emerges
// Multiple epicycle stacks possible, each with own tuning
// ===============================

import { ctx, canvas, analyser, freqData, timeData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let frame = 0, width = canvas.width, height = canvas.height;
function resize() { width = canvas.width; height = canvas.height; }
window.addEventListener("resize", resize);
function avg(s, e) { let v = 0; for (let i = s; i < e; i++) v += freqData[i]; return v / (e - s) / 255; }

/* ======================================================
 SETTINGS
====================================================== */
const settings = {
  // Stacks
  stackCount:       2,      // how many epicycle stacks
  armCount:         7,      // arms per stack
  baseRadius:       90,     // outermost arm radius
  radiusDecay:      0.62,   // each inner arm = prev * decay
  speedBase:        0.008,  // base rotation speed of arm 0
  speedMult:        1.0,    // each arm's speed * this + harmonic
  harmonicMode:     1,      // 0=free speeds 1=harmonic series (1x,2x,3x...)
  speedAudioMult:   1.5,    // audio multiplies rotation speed

  // Path trail
  trailLength:      420,
  trailFade:        1,
  trailWidth:       1.6,

  // Audio coupling
  bassRadius:       60,     // bass inflates base radius
  midRadius:        30,     // mid inflates inner radii
  highJitter:       8,      // high adds jitter to arm angles
  bassArm:          0,      // which arm gets bass (0=outermost)
  audioSmooth:      0.12,

  // Beat response
  beatThreshold:    0.62,
  beatClutch:       1,      // freeze arms + reset trail on beat
  beatSpin:         1,      // burst rotation speed on beat
  beatSpinAmt:      0.08,

  // Arm visual
  drawArms:         1,      // show the rotating arms
  armAlpha:         0.25,
  armWidth:         0.8,
  armCircles:       1,      // show arm circles
  circleAlpha:      0.12,
  circleWidth:      0.5,
  pivotDot:         1,      // dot at each arm pivot

  // Second stack offset
  stack2PhaseOffset: 1.57,  // π/2 — counter-rotates nicely
  stack2SpeedOffset: 1.0,   // speed multiplier for stack 2
  stack2RadiusMult:  0.85,

  // Visual
  bgAlpha:          0.10,
  glowMode:         1,
  glowBlur:         7,
  glowAlpha:        0.3,
  mirrorRot:        1,      // rotational copies of stacks

  // Color
  hueBase:          30,
  hueSpread:        200,
  hueTimeSpeed:     0.25,
  saturation:       95,
  lightness:        60,
  stack2HueOffset:  180,    // complementary stack 2
  trailColorMode:   0,      // 0=age 1=velocity 2=position-angle
};

registerSceneSettings(settings);

/* ======================================================
 STATE
====================================================== */
const MAX_STACKS    = 4;
const MAX_ARMS      = 16;
const MAX_TRAIL     = 900;

// Per-stack arm angles
const armAngles = new Float32Array(MAX_STACKS * MAX_ARMS);
const armSpeeds = new Float32Array(MAX_STACKS * MAX_ARMS);

// Per-stack trail (ring buffer)
const trailX   = new Float32Array(MAX_STACKS * MAX_TRAIL);
const trailY   = new Float32Array(MAX_STACKS * MAX_TRAIL);
const trailHead = new Int32Array(MAX_STACKS);
const trailLen  = new Int32Array(MAX_STACKS);

// Smoothed audio
let smBass = 0, smMid = 0, smHigh = 0;
let lastBass = 0;
let beatSpinAmt = 0;
let clutchActive = 0;

/* ======================================================
 DEV PANEL
====================================================== */
let devPanel;
function createDevPanel() {
  devPanel = document.createElement("div");
  Object.assign(devPanel.style, {
    position:"fixed",top:"5px",left:"5px",padding:"8px 10px",
    background:"rgba(0,0,0,0.87)",color:"#fff",fontFamily:"sans-serif",
    fontSize:"12px",borderRadius:"6px",zIndex:9999,
    display:"none",maxHeight:"95vh",overflowY:"auto",width:"218px",
  });
  devPanel.innerHTML = `
  <b>EPICYCLE MACHINE</b><hr>
  <b>STACKS</b><br>
  Stack Count <input type="range" id="stackCount" min="1" max="4" step="1"><br>
  Arm Count <input type="range" id="armCount" min="1" max="16" step="1"><br>
  Base Radius <input type="range" id="baseRadius" min="20" max="250"><br>
  Radius Decay <input type="range" id="radiusDecay" min="0.2" max="0.95" step="0.01"><br>
  Speed Base <input type="range" id="speedBase" min="0.001" max="0.04" step="0.001"><br>
  Speed Mult <input type="range" id="speedMult" min="0.5" max="4" step="0.05"><br>
  Harmonic Mode <input type="range" id="harmonicMode" min="0" max="1" step="1">
  <span id="harmonicModeLabel" style="font-size:10px;color:#0cf"> on</span><br>
  Speed Audio Mult <input type="range" id="speedAudioMult" min="0" max="5" step="0.1"><br>
  <hr><b>TRAIL</b><br>
  Trail Length <input type="range" id="trailLength" min="20" max="900" step="10"><br>
  Trail Fade <input type="range" id="trailFade" min="0" max="1" step="1"><br>
  Trail Width <input type="range" id="trailWidth" min="0.3" max="6" step="0.1"><br>
  Trail Color Mode <input type="range" id="trailColorMode" min="0" max="2" step="1">
  <span id="trailColorModeLabel" style="font-size:10px;color:#0cf"> age</span><br>
  <hr><b>AUDIO</b><br>
  Bass Radius <input type="range" id="bassRadius" min="0" max="150"><br>
  Mid Radius <input type="range" id="midRadius" min="0" max="100"><br>
  High Jitter <input type="range" id="highJitter" min="0" max="30"><br>
  Audio Smooth <input type="range" id="audioSmooth" min="0.01" max="0.5" step="0.01"><br>
  <hr><b>BEAT</b><br>
  Beat Threshold <input type="range" id="beatThreshold" min="0.2" max="0.95" step="0.01"><br>
  Beat Clutch <input type="range" id="beatClutch" min="0" max="1" step="1"><br>
  Beat Spin <input type="range" id="beatSpin" min="0" max="1" step="1"><br>
  Beat Spin Amt <input type="range" id="beatSpinAmt" min="0.01" max="0.3" step="0.01"><br>
  <hr><b>ARM VISUAL</b><br>
  Draw Arms <input type="range" id="drawArms" min="0" max="1" step="1"><br>
  Arm Alpha <input type="range" id="armAlpha" min="0.02" max="1" step="0.02"><br>
  Arm Width <input type="range" id="armWidth" min="0.2" max="4" step="0.1"><br>
  Arm Circles <input type="range" id="armCircles" min="0" max="1" step="1"><br>
  Circle Alpha <input type="range" id="circleAlpha" min="0.01" max="0.5" step="0.01"><br>
  Pivot Dot <input type="range" id="pivotDot" min="0" max="1" step="1"><br>
  <hr><b>STACK 2</b><br>
  Phase Offset <input type="range" id="stack2PhaseOffset" min="0" max="6.28" step="0.05"><br>
  Speed Offset <input type="range" id="stack2SpeedOffset" min="0.1" max="3" step="0.05"><br>
  Radius Mult <input type="range" id="stack2RadiusMult" min="0.2" max="1.5" step="0.05"><br>
  <hr><b>RENDER</b><br>
  BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.5" step="0.01"><br>
  Glow Mode <input type="range" id="glowMode" min="0" max="1" step="1"><br>
  Glow Blur <input type="range" id="glowBlur" min="0" max="20"><br>
  Glow Alpha <input type="range" id="glowAlpha" min="0.05" max="1" step="0.05"><br>
  Mirror Rot <input type="range" id="mirrorRot" min="1" max="8" step="1"><br>
  <hr><b>COLOR</b><br>
  Hue Base <input type="range" id="hueBase" min="0" max="360"><br>
  Hue Spread <input type="range" id="hueSpread" min="0" max="360"><br>
  Hue Time Speed <input type="range" id="hueTimeSpeed" min="0" max="2" step="0.05"><br>
  Saturation <input type="range" id="saturation" min="0" max="100"><br>
  Lightness <input type="range" id="lightness" min="10" max="90"><br>
  Stack2 Hue Offset <input type="range" id="stack2HueOffset" min="0" max="360"><br>
  `;
  document.body.appendChild(devPanel);

  const harmonicNames    = ["free","harmonic"];
  const trailColorNames  = ["age","velocity","angle"];
  const hLabel = devPanel.querySelector("#harmonicModeLabel");
  const tLabel = devPanel.querySelector("#trailColorModeLabel");

  Object.keys(settings).forEach(key => {
    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;
    el.value = settings[key];
    el.addEventListener("input", e => {
      settings[key] = parseFloat(e.target.value);
      if (key === "harmonicMode"   && hLabel) hLabel.textContent = " " + harmonicNames[Math.floor(settings.harmonicMode)];
      if (key === "trailColorMode" && tLabel) tLabel.textContent = " " + trailColorNames[Math.floor(settings.trailColorMode)];
    });
  });
}
createDevPanel();

/* ======================================================
 COMPUTE TIP POSITION for stack s at current angles
 Returns { tx, ty } plus draws arms if requested
====================================================== */
function computeAndDrawStack(s, bass, mid, high) {
  const N        = Math.floor(settings.armCount);
  const radMult  = s === 0 ? 1 : settings.stack2RadiusMult;
  const hueOff   = s === 0 ? 0 : settings.stack2HueOffset;
  const hueBase  = (settings.hueBase + hueOff + frame * settings.hueTimeSpeed) % 360;

  let cx = 0, cy = 0;

  for (let k = 0; k < N; k++) {
    const decay  = Math.pow(settings.radiusDecay, k);
    const audioBump = (k === 0 ? smBass * settings.bassRadius : smMid * settings.midRadius * decay);
    const r = (settings.baseRadius * radMult * decay + audioBump)
            * (1 + smHigh * settings.highJitter * 0.02 * Math.sin(frame * 0.3 + k));

    const angle  = armAngles[s * MAX_ARMS + k];
    const nx     = cx + Math.cos(angle) * r;
    const ny     = cy + Math.sin(angle) * r;

    if (settings.drawArms) {
      // Arm circle
      if (settings.armCircles) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hueBase},${settings.saturation}%,${settings.lightness}%,${settings.circleAlpha})`;
        ctx.lineWidth   = settings.circleWidth;
        ctx.stroke();
      }
      // Arm line
      const armHue = (hueBase + (k / N) * settings.hueSpread) % 360;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = `hsla(${armHue},${settings.saturation}%,${settings.lightness}%,${settings.armAlpha})`;
      ctx.lineWidth   = settings.armWidth;
      ctx.stroke();
      // Pivot dot
      if (settings.pivotDot) {
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5 * (1 - k / N * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${armHue},100%,80%,0.5)`;
        ctx.fill();
      }
    }

    cx = nx; cy = ny;
  }

  return { tx: cx, ty: cy };
}

/* ======================================================
 DRAW TRAIL for stack s
====================================================== */
function drawTrail(s) {
  const hueOff  = s === 0 ? 0 : settings.stack2HueOffset;
  const hueBase = (settings.hueBase + hueOff + frame * settings.hueTimeSpeed) % 360;
  const len     = Math.min(trailLen[s], Math.floor(settings.trailLength));
  const head    = trailHead[s];
  const cMode   = Math.floor(settings.trailColorMode);

  // Glow pass
  if (settings.glowMode && len > 2) {
    ctx.beginPath();
    let first = true;
    for (let t = len - 1; t >= 0; t--) {
      const idx = (head - 1 - t + MAX_TRAIL * 2) % MAX_TRAIL;
      const x   = trailX[s * MAX_TRAIL + idx];
      const y   = trailY[s * MAX_TRAIL + idx];
      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    }
    ctx.shadowColor = `hsl(${hueBase},100%,70%)`;
    ctx.shadowBlur  = settings.glowBlur;
    ctx.strokeStyle = `hsla(${hueBase},100%,70%,${settings.glowAlpha})`;
    ctx.lineWidth   = settings.trailWidth * 2;
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }

  // Per-segment with fade + color
  for (let t = len - 1; t >= 1; t--) {
    const i0  = (head - 1 - t     + MAX_TRAIL * 2) % MAX_TRAIL;
    const i1  = (head - 1 - t + 1 + MAX_TRAIL * 2) % MAX_TRAIL;
    const x0  = trailX[s*MAX_TRAIL+i0], y0 = trailY[s*MAX_TRAIL+i0];
    const x1  = trailX[s*MAX_TRAIL+i1], y1 = trailY[s*MAX_TRAIL+i1];

    const tFrac = t / len;
    const alpha = settings.trailFade ? tFrac * 0.9 : 0.7;

    let hue = hueBase;
    if (cMode === 1) {
      const vel = Math.sqrt((x1-x0)**2 + (y1-y0)**2);
      hue = (hueBase + vel * 3) % 360;
    } else if (cMode === 2) {
      const ang = Math.atan2(y0, x0);
      hue = (hueBase + ((ang + Math.PI) / (Math.PI * 2)) * settings.hueSpread) % 360;
    } else {
      hue = (hueBase + tFrac * settings.hueSpread) % 360;
    }

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = `hsla(${hue},${settings.saturation}%,${settings.lightness}%,${alpha})`;
    ctx.lineWidth   = settings.trailWidth * (0.3 + tFrac * 0.8);
    ctx.stroke();
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

  const bass = avg(0, 12);
  const mid  = avg(20, 90);
  const high = avg(80, 180);
  frame++;

  // Smooth audio
  const sp = settings.audioSmooth;
  smBass = smBass + (bass - smBass) * sp;
  smMid  = smMid  + (mid  - smMid)  * sp;
  smHigh = smHigh + (high - smHigh) * sp;

  // Beat
  if (bass > settings.beatThreshold && lastBass <= settings.beatThreshold) {
    if (settings.beatSpin)   beatSpinAmt = settings.beatSpinAmt;
    if (settings.beatClutch) clutchActive = 22;
  }
  lastBass = bass;
  if (beatSpinAmt > 0) beatSpinAmt *= 0.88;
  if (clutchActive > 0) {
    clutchActive--;
    // Clear trails on clutch start
    if (clutchActive === 21) {
      for (let s = 0; s < MAX_STACKS; s++) { trailLen[s] = 0; trailHead[s] = 0; }
    }
  }

  // Advance arm angles (unless clutched)
  const N = Math.floor(settings.armCount);
  const SC = Math.floor(settings.stackCount);
  for (let s = 0; s < SC; s++) {
    const speedMod = s === 0 ? 1 : settings.stack2SpeedOffset;
    const basePhase = s * settings.stack2PhaseOffset;
    for (let k = 0; k < N; k++) {
      if (clutchActive > 0) continue;
      const harmonic = settings.harmonicMode ? (k + 1) : Math.pow(settings.speedMult, k);
      const spd = settings.speedBase * harmonic * speedMod
                * (1 + smBass * settings.speedAudioMult * 0.5)
                + beatSpinAmt * (k % 2 === 0 ? 1 : -1);
      armAngles[s * MAX_ARMS + k] += spd;
    }
  }

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.globalCompositeOperation = "lighter";

  const mirrorN = Math.max(1, Math.floor(settings.mirrorRot));

  for (let mr = 0; mr < mirrorN; mr++) {
    ctx.save();
    if (mirrorN > 1) ctx.rotate((mr / mirrorN) * Math.PI * 2);

    for (let s = 0; s < SC; s++) {
      // Draw trail
      drawTrail(s);

      // Draw arms + compute tip
      const { tx, ty } = computeAndDrawStack(s, smBass, smMid, smHigh);

      // Push tip to trail ring buffer
      const idx = trailHead[s] % MAX_TRAIL;
      trailX[s * MAX_TRAIL + idx] = tx;
      trailY[s * MAX_TRAIL + idx] = ty;
      trailHead[s]++;
      if (trailLen[s] < MAX_TRAIL) trailLen[s]++;

      // Tip dot
      const hueBase = (settings.hueBase + (s === 0 ? 0 : settings.stack2HueOffset) + frame * settings.hueTimeSpeed) % 360;
      ctx.beginPath();
      ctx.arc(tx, ty, 3 + smBass * 5, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${hueBase},100%,85%)`;
      if (settings.glowMode) {
        ctx.shadowColor = `hsl(${hueBase},100%,80%)`;
        ctx.shadowBlur  = 10;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  ctx.restore();
}

draw();
