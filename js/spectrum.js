import { ctx, canvas, analyser, freqData } from "./visualizer.js";

/* ===============================
   FLOW FIELD
================================ */

const POINTS = 1200;
const points = [];

let frame = 0;

for (let i = 0; i < POINTS; i++) {
  points.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: 0,
    vy: 0,
    band: Math.floor(Math.random() * 64),
    life: Math.random()
  });
}

/* ===============================
   HELPERS
================================ */

function bandEnergy(i) {
  return freqData[i] / 255;
}

function wrap(p) {
  if (p.x < 0) p.x += canvas.width;
  if (p.x > canvas.width) p.x -= canvas.width;
  if (p.y < 0) p.y += canvas.height;
  if (p.y > canvas.height) p.y -= canvas.height;
}

/* ===============================
   DRAW
================================ */

export function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);
  frame++;

  /* ---- soft fade ---- */
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  for (let p of points) {
    const e = bandEnergy(p.band);

    /* ===============================
       FORCE FIELD
    ================================ */

    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.0001;

    const angle =
      Math.atan2(dy, dx) +
      Math.sin(frame * 0.01 + p.band) * e * 2;

    const force =
      (0.2 + e * 2) *
      (0.6 + Math.sin(dist * 0.01 + frame * 0.02));

    p.vx += Math.cos(angle) * force;
    p.vy += Math.sin(angle) * force;

    /* ===============================
       DAMPING
    ================================ */

    p.vx *= 0.92;
    p.vy *= 0.92;

    const ox = p.x;
    const oy = p.y;

    p.x += p.vx;
    p.y += p.vy;

    wrap(p);

    /* ===============================
       DRAW STROKE
    ================================ */

    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);

    const hue =
      180 +
      p.band * 2 +
      e * 120;

    const alpha = Math.min(0.25, speed * 0.1);

    ctx.strokeStyle = `hsla(${hue},100%,60%,${alpha})`;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
}

draw();
