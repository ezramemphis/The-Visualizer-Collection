// ===============================
// VISUALIZER Q — STRANGE ATTRACTOR FIELD
// Multiple particles walking the Lorenz / Thomas attractor simultaneously
// Audio continuously morphs the attractor constants (σ, ρ, β for Lorenz)
// causing the chaotic basin to reshape, fold, and bifurcate in real time
// Beat triggers basin reset — particles scatter and re-converge
// Projection plane, trail length, speed, all in dev panel
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
  // Attractor
  attractorType:   0,     // 0=Lorenz, 1=Thomas, 2=Dadras, 3=Halvorsen
  particleCount:   6,
  trailLength:     280,
  stepSize:        0.006, // integration step
  stepsPerFrame:   3,     // multiple steps per frame

  // Lorenz params (base — audio morphs these)
  lorenzSigma:     10.0,
  lorenzRho:       28.0,
  lorenzBeta:      2.667,

  // Thomas params
  thomasB:         0.208,

  // Audio morphing
  bassToRho:       18,    // bass adds to rho (dramatic bifurcation)
  midToSigma:      6,     // mid shifts sigma
  highToBeta:      1.5,   // high shifts beta
  audioMorphSpeed: 0.15,  // lerp speed toward audio target

  // Projection
  projX:           0,     // 0=XY, 1=XZ, 2=YZ, 3=rotating
  projRotSpeed:    0.003, // rotation speed when projX=3
  projScale:       9,     // world→screen scale
  projOffsetZ:     25,    // Z offset for perspective feel
  perspective:     1,     // 0=ortho 1=perspective

  // Beat response
  beatThreshold:   0.62,
  beatReset:       1,     // scatter particles on beat
  beatScatter:     8,     // scatter force
  beatFlash:       1,

  // Visual
  bgAlpha:         0.08,
  lineWidth:       1.2,
  trailFade:       1,     // 1=alpha fades along trail
  glowMode:        1,     // glow on near-center segments
  glowBlur:        6,
  colorMode:       0,     // 0=per-particle 1=velocity 2=z-height

  // Color
  hueBase:         200,
  hueSpread:       260,
  hueTimeSpeed:    0.2,
  saturation:      95,
  lightness:       58,
};

registerSceneSettings(settings);

/* ======================================================
 PARTICLE TRAILS
====================================================== */
const MAX_PARTICLES = 20;
const MAX_TRAIL     = 600;

// Flat typed arrays: [particle][point][xyz]
const trailX = new Float32Array(MAX_PARTICLES * MAX_TRAIL);
const trailY = new Float32Array(MAX_PARTICLES * MAX_TRAIL);
const trailZ = new Float32Array(MAX_PARTICLES * MAX_TRAIL);
const trailLen = new Int32Array(MAX_PARTICLES);  // current fill
const headIdx  = new Int32Array(MAX_PARTICLES);  // ring buffer head

// Current attractor state per particle
const px = new Float32Array(MAX_PARTICLES);
const py = new Float32Array(MAX_PARTICLES);
const pz = new Float32Array(MAX_PARTICLES);

// Smoothed attractor params
let smoothSigma = 10.0, smoothRho = 28.0, smoothBeta = 2.667;
let smoothB     = 0.208;

function initParticle(i) {
  px[i] = (Math.random() - 0.5) * 2 + 0.1;
  py[i] = (Math.random() - 0.5) * 2;
  pz[i] = 20 + Math.random() * 10;
  trailLen[i] = 0;
  headIdx[i]  = 0;
}

function initAllParticles() {
  const n = Math.floor(settings.particleCount);
  for (let i = 0; i < n; i++) initParticle(i);
}
initAllParticles();

/* ======================================================
 ATTRACTOR DERIVATIVES
====================================================== */
function lorenz(x, y, z) {
  const dx = smoothSigma * (y - x);
  const dy = x * (smoothRho - z) - y;
  const dz = x * y - smoothBeta * z;
  return [dx, dy, dz];
}

function thomas(x, y, z) {
  const b = smoothB;
  const dx = Math.sin(y) - b * x;
  const dy = Math.sin(z) - b * y;
  const dz = Math.sin(x) - b * z;
  return [dx, dy, dz];
}

function dadras(x, y, z) {
  const a=3, b=2.7, c=1.7, d=2, e=9;
  const dx = y - a*x + b*y*z;
  const dy = c*y - x*z + z;
  const dz = d*x*y - e*z;
  return [dx, dy, dz];
}

function halvorsen(x, y, z) {
  const a = 1.4;
  const dx = -a*x - 4*y - 4*z - y*y;
  const dy = -a*y - 4*z - 4*x - z*z;
  const dz = -a*z - 4*x - 4*y - x*x;
  return [dx, dy, dz];
}

function deriv(x, y, z) {
  switch (Math.floor(settings.attractorType)) {
    case 1: return thomas(x, y, z);
    case 2: return dadras(x, y, z);
    case 3: return halvorsen(x, y, z);
    default: return lorenz(x, y, z);
  }
}

function rk4Step(x, y, z, h) {
  const [k1x,k1y,k1z] = deriv(x, y, z);
  const [k2x,k2y,k2z] = deriv(x+h/2*k1x, y+h/2*k1y, z+h/2*k1z);
  const [k3x,k3y,k3z] = deriv(x+h/2*k2x, y+h/2*k2y, z+h/2*k2z);
  const [k4x,k4y,k4z] = deriv(x+h*k3x,   y+h*k3y,   z+h*k3z);
  return [
    x + h/6*(k1x+2*k2x+2*k3x+k4x),
    y + h/6*(k1y+2*k2y+2*k3y+k4y),
    z + h/6*(k1z+2*k2z+2*k3z+k4z),
  ];
}

/* ======================================================
 PROJECTION
====================================================== */
let projAngle = 0;

function project(x, y, z) {
  const scale = settings.projScale;
  const type  = Math.floor(settings.projX);

  let ax, ay, az;
  if (type === 3) {
    // rotating projection in XZ plane over time
    const c = Math.cos(projAngle), s = Math.sin(projAngle);
    ax = x * c + z * s;
    ay = y;
    az = -x * s + z * c;
  } else if (type === 1) {
    ax = x; ay = z; az = y;
  } else if (type === 2) {
    ax = y; ay = z; az = x;
  } else {
    ax = x; ay = y; az = z;
  }

  if (settings.perspective) {
    const d  = settings.projOffsetZ + az;
    const sc = scale * 8 / Math.max(1, d);
    return [ax * sc, ay * sc];
  } else {
    return [ax * scale, ay * scale];
  }
}

/* ======================================================
 STATE
====================================================== */
let lastBass = 0;
let beatFlashAmt = 0;

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
  <b>STRANGE ATTRACTOR</b><hr>
  <b>ATTRACTOR</b><br>
  Type <input type="range" id="attractorType" min="0" max="3" step="1">
  <span id="attractorTypeLabel" style="font-size:10px;color:#0cf"> Lorenz</span><br>
  Particles <input type="range" id="particleCount" min="1" max="20" step="1"><br>
  Trail Length <input type="range" id="trailLength" min="20" max="600" step="5"><br>
  Step Size <input type="range" id="stepSize" min="0.001" max="0.02" step="0.001"><br>
  Steps/Frame <input type="range" id="stepsPerFrame" min="1" max="12" step="1"><br>
  <hr><b>LORENZ PARAMS</b><br>
  σ Sigma <input type="range" id="lorenzSigma" min="1" max="30" step="0.1"><br>
  ρ Rho <input type="range" id="lorenzRho" min="5" max="60" step="0.2"><br>
  β Beta <input type="range" id="lorenzBeta" min="0.1" max="6" step="0.05"><br>
  Thomas b <input type="range" id="thomasB" min="0.05" max="0.5" step="0.005"><br>
  <hr><b>AUDIO MORPH</b><br>
  Bass→Rho <input type="range" id="bassToRho" min="0" max="50"><br>
  Mid→Sigma <input type="range" id="midToSigma" min="0" max="20"><br>
  High→Beta <input type="range" id="highToBeta" min="0" max="4" step="0.1"><br>
  Morph Speed <input type="range" id="audioMorphSpeed" min="0.01" max="1" step="0.01"><br>
  <hr><b>PROJECTION</b><br>
  Proj Plane <input type="range" id="projX" min="0" max="3" step="1">
  <span id="projXLabel" style="font-size:10px;color:#0cf"> XY</span><br>
  Rot Speed <input type="range" id="projRotSpeed" min="0" max="0.02" step="0.0005"><br>
  Scale <input type="range" id="projScale" min="2" max="30"><br>
  Perspective <input type="range" id="perspective" min="0" max="1" step="1"><br>
  <hr><b>BEAT</b><br>
  Beat Threshold <input type="range" id="beatThreshold" min="0.2" max="0.95" step="0.01"><br>
  Beat Reset <input type="range" id="beatReset" min="0" max="1" step="1"><br>
  Beat Scatter <input type="range" id="beatScatter" min="0" max="30"><br>
  Beat Flash <input type="range" id="beatFlash" min="0" max="1" step="1"><br>
  <hr><b>VISUAL</b><br>
  BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.5" step="0.01"><br>
  Line Width <input type="range" id="lineWidth" min="0.3" max="5" step="0.1"><br>
  Trail Fade <input type="range" id="trailFade" min="0" max="1" step="1"><br>
  Glow Mode <input type="range" id="glowMode" min="0" max="1" step="1"><br>
  Glow Blur <input type="range" id="glowBlur" min="0" max="20"><br>
  Color Mode <input type="range" id="colorMode" min="0" max="2" step="1">
  <span id="colorModeLabel" style="font-size:10px;color:#0cf"> per-particle</span><br>
  <hr><b>COLOR</b><br>
  Hue Base <input type="range" id="hueBase" min="0" max="360"><br>
  Hue Spread <input type="range" id="hueSpread" min="0" max="360"><br>
  Hue Time Speed <input type="range" id="hueTimeSpeed" min="0" max="2" step="0.05"><br>
  Saturation <input type="range" id="saturation" min="0" max="100"><br>
  Lightness <input type="range" id="lightness" min="10" max="90"><br>
  `;
  document.body.appendChild(devPanel);

  const attractorNames = ["Lorenz","Thomas","Dadras","Halvorsen"];
  const projNames      = ["XY","XZ","YZ","Rotating"];
  const colorNames     = ["per-particle","velocity","z-height"];
  const aLabel  = devPanel.querySelector("#attractorTypeLabel");
  const pLabel  = devPanel.querySelector("#projXLabel");
  const cLabel  = devPanel.querySelector("#colorModeLabel");

  Object.keys(settings).forEach(key => {
    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;
    el.value = settings[key];
    el.addEventListener("input", e => {
      settings[key] = parseFloat(e.target.value);
      if (key === "attractorType" && aLabel) aLabel.textContent = " " + attractorNames[Math.floor(settings.attractorType)];
      if (key === "projX"         && pLabel) pLabel.textContent = " " + projNames[Math.floor(settings.projX)];
      if (key === "colorMode"     && cLabel) cLabel.textContent = " " + colorNames[Math.floor(settings.colorMode)];
      if (key === "particleCount") initAllParticles();
    });
  });
}
createDevPanel();

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

  // Smooth attractor params toward audio targets
  const lr = settings.audioMorphSpeed;
  smoothRho   += (settings.lorenzRho   + bass * settings.bassToRho  - smoothRho)   * lr;
  smoothSigma += (settings.lorenzSigma + mid  * settings.midToSigma - smoothSigma) * lr;
  smoothBeta  += (settings.lorenzBeta  + high * settings.highToBeta - smoothBeta)  * lr;
  smoothB     += (settings.thomasB - smoothB) * lr;

  projAngle += settings.projRotSpeed * (1 + mid * 0.5);

  // Beat
  if (bass > settings.beatThreshold && lastBass <= settings.beatThreshold) {
    if (settings.beatFlash) beatFlashAmt = 1.0;
    if (settings.beatReset) {
      const n = Math.floor(settings.particleCount);
      for (let i = 0; i < n; i++) {
        px[i] += (Math.random() - 0.5) * settings.beatScatter;
        py[i] += (Math.random() - 0.5) * settings.beatScatter;
        pz[i] += (Math.random() - 0.5) * settings.beatScatter * 0.5;
        trailLen[i] = 0; headIdx[i] = 0;
      }
    }
  }
  lastBass = bass;
  if (beatFlashAmt > 0) beatFlashAmt *= 0.82;

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  if (beatFlashAmt > 0.02) {
    const hue = (settings.hueBase + frame * settings.hueTimeSpeed) % 360;
    ctx.fillStyle = `hsla(${hue},100%,65%,${beatFlashAmt * 0.1})`;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.globalCompositeOperation = "lighter";

  const n        = Math.floor(settings.particleCount);
  const tLen     = Math.min(Math.floor(settings.trailLength), MAX_TRAIL);
  const h        = settings.stepSize;
  const spf      = Math.floor(settings.stepsPerFrame);
  const colorMode = Math.floor(settings.colorMode);

  for (let i = 0; i < n; i++) {
    // Integrate N steps, push to ring buffer
    for (let s = 0; s < spf; s++) {
      const [nx, ny, nz] = rk4Step(px[i], py[i], pz[i], h);
      // Clamp to avoid blow-up
      px[i] = Math.max(-100, Math.min(100, nx));
      py[i] = Math.max(-100, Math.min(100, ny));
      pz[i] = Math.max(-100, Math.min(100, nz));

      const idx = headIdx[i] % MAX_TRAIL;
      trailX[i * MAX_TRAIL + idx] = px[i];
      trailY[i * MAX_TRAIL + idx] = py[i];
      trailZ[i * MAX_TRAIL + idx] = pz[i];
      headIdx[i]++;
      if (trailLen[i] < MAX_TRAIL) trailLen[i]++;
    }

    // Draw trail
    const len    = Math.min(trailLen[i], tLen);
    const head   = headIdx[i];
    const baseHue = (settings.hueBase + (i / n) * settings.hueSpread + frame * settings.hueTimeSpeed) % 360;

    // Glow pass
    if (settings.glowMode) {
      ctx.beginPath();
      let firstPt = true;
      for (let t = len - 1; t >= 0; t--) {
        const ring = (head - 1 - t + MAX_TRAIL * 2) % MAX_TRAIL;
        const wx = trailX[i * MAX_TRAIL + ring];
        const wy = trailY[i * MAX_TRAIL + ring];
        const wz = trailZ[i * MAX_TRAIL + ring];
        const [sx, sy] = project(wx, wy, wz);
        if (firstPt) { ctx.moveTo(sx, sy); firstPt = false; }
        else ctx.lineTo(sx, sy);
      }
      ctx.shadowColor = `hsl(${baseHue},100%,70%)`;
      ctx.shadowBlur  = settings.glowBlur;
      ctx.strokeStyle = `hsla(${baseHue},${settings.saturation}%,${settings.lightness}%,0.15)`;
      ctx.lineWidth   = settings.lineWidth * 2.5;
      ctx.stroke();
      ctx.shadowBlur  = 0;
    }

    // Crisp trail — segment by segment for fade + color
    for (let t = len - 1; t >= 1; t--) {
      const r0  = (head - 1 - t     + MAX_TRAIL * 2) % MAX_TRAIL;
      const r1  = (head - 1 - t + 1 + MAX_TRAIL * 2) % MAX_TRAIL;
      const wx0 = trailX[i*MAX_TRAIL+r0], wy0 = trailY[i*MAX_TRAIL+r0], wz0 = trailZ[i*MAX_TRAIL+r0];
      const wx1 = trailX[i*MAX_TRAIL+r1], wy1 = trailY[i*MAX_TRAIL+r1], wz1 = trailZ[i*MAX_TRAIL+r1];
      const [sx0, sy0] = project(wx0, wy0, wz0);
      const [sx1, sy1] = project(wx1, wy1, wz1);

      const tFrac = t / len;
      const alpha = settings.trailFade ? tFrac * 0.8 : 0.6;

      let hue = baseHue;
      if (colorMode === 1) {
        // velocity-colored
        const vel = Math.sqrt((wx1-wx0)**2 + (wy1-wy0)**2 + (wz1-wz0)**2);
        hue = (settings.hueBase + vel * 60) % 360;
      } else if (colorMode === 2) {
        // z-height colored
        hue = (settings.hueBase + ((wz0 + 30) / 60) * settings.hueSpread) % 360;
      }

      ctx.beginPath();
      ctx.moveTo(sx0, sy0);
      ctx.lineTo(sx1, sy1);
      ctx.strokeStyle = `hsla(${hue},${settings.saturation}%,${settings.lightness}%,${alpha})`;
      ctx.lineWidth   = settings.lineWidth * (0.4 + tFrac * 0.8);
      ctx.stroke();
    }
  }

  ctx.restore();
}

draw();
