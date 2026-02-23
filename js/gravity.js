import {
  ctx,
  canvas,
  analyser,
  freqData,
  timeData
} from "./visualizer.js";

/* ===============================
   STATE
================================ */

let frame = 0;
let lastBass = 0;

const PARTICLE_COUNT = 1200;
const particles = [];

let width = canvas.width;
let height = canvas.height;

function resize() {
  width = canvas.width;
  height = canvas.height;
}
window.addEventListener("resize", resize);

/* ===============================
   PARTICLES
================================ */

for (let i = 0; i < PARTICLE_COUNT; i++) {
  particles.push({
    x: (Math.random() - 0.5) * width,
    y: (Math.random() - 0.5) * height,
    z: Math.random() * 1000,
    vx: 0,
    vy: 0
  });
}

/* ===============================
   HELPERS
================================ */

function avg(start, end) {
  let s = 0;
  for (let i = start; i < end; i++) s += freqData[i];
  return s / (end - start) / 255;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/* ===============================
   DRAW
================================ */

function draw() {
  requestAnimationFrame(draw);

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  frame++;

  const bass = clamp(avg(0, 10), 0, 1);
  const mid = clamp(avg(20, 70), 0, 1);
  const high = clamp(avg(80, 160), 0, 1);

  // detect bass impact spike
  const bassHit = bass > lastBass + 0.15;
  lastBass = bass;

  /* ---- background fade ---- */
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);

  // subtle camera warp
  const cameraShake = bass * 30;
  ctx.rotate(Math.sin(frame * 0.01) * bass * 0.2);

  /* ===============================
     PARTICLE FIELD
  ================================ */

  for (let p of particles) {

    // move toward viewer
    p.z -= 5 + bass * 40;

    // respawn when close
    if (p.z < 10) {
      p.x = (Math.random() - 0.5) * width;
      p.y = (Math.random() - 0.5) * height;
      p.z = 1000;
    }

    // perspective projection
    const scale = 300 / p.z;
    const x = p.x * scale;
    const y = p.y * scale;

    const size = scale * (2 + high * 10);

    const hue = (frame * 0.5 + p.z * 0.05) % 360;

    ctx.fillStyle = `hsla(${hue},100%,70%,${0.5 + high})`;

    ctx.fillRect(
      x + (Math.random() - 0.5) * cameraShake,
      y + (Math.random() - 0.5) * cameraShake,
      size,
      size
    );
  }

  /* ===============================
     SHOCKWAVE RINGS ON BASS HIT
  ================================ */

  if (bassHit) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        50 + i * 40,
        0,
        Math.PI * 2
      );

      ctx.strokeStyle = `hsla(${frame},100%,70%,0.8)`;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }

  /* ===============================
     WAVEFORM ENERGY THREAD
  ================================ */

  ctx.beginPath();
  for (let i = 0; i < timeData.length; i += 4) {
    const t = i / timeData.length;
    const angle = t * Math.PI * 2;

    const radius =
      150 +
      (timeData[i] / 255 - 0.5) * 300 * mid;

    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.strokeStyle = `hsla(${frame * 0.7},100%,60%,0.6)`;
  ctx.lineWidth = 2 + bass * 5;
  ctx.stroke();

  ctx.restore();

  /* ===============================
     GLITCH PASS (subtle)
  ================================ */

  if (bass > 0.7) {
    const sliceY = Math.random() * height;
    const sliceH = 20 + mid * 50;
    const offset = (Math.random() - 0.5) * bass * 200;

    ctx.drawImage(
      canvas,
      0, sliceY,
      width, sliceH,
      offset, sliceY,
      width, sliceH
    );
  }
}

/* ===============================
   START
================================ */

draw();
