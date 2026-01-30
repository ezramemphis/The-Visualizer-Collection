import { ctx, canvas, analyser, freqData } from "./visualizer.js";

/* ===============================
   MAGICAL AMPLITUDE-REACTIVE FLOW
================================ */

const POINTS = 800;
const points = [];

let frame = 0;

// helper: compute RMS amplitude
function rmsEnergy() {
  let sum = 0;
  for (let i = 0; i < freqData.length; i++) {
    const v = freqData[i] / 255;
    sum += v * v;
  }
  return Math.sqrt(sum / freqData.length);
}

for (let i = 0; i < POINTS; i++) {
  points.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: 0,
    vy: 0,
    band: Math.floor(Math.random() * 64),
    phase: Math.random() * Math.PI * 2
  });
}

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
   DRAW LOOP
================================ */

export function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);
  frame++;

  const amp = rmsEnergy(); // 0-1

  // fade trails slowly (~10 seconds)
  const fadeAlpha = 0.04 * amp + 0.01; // higher amp slightly quicker fade
  ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  for (let p of points) {
    const e = bandEnergy(p.band);

    // amplitude-driven force
    const ampForce = 0.5 + amp * 1.2;

    // gentle swirl / field
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.0001;

    const angle =
      Math.atan2(dy, dx) +
      Math.sin(frame * 0.003 + p.phase) * e * 1.5;

    const force =
      (0.05 + e * 0.8) * ampForce *
      (0.5 + Math.sin(dist * 0.005 + frame * 0.002));

    p.vx += Math.cos(angle) * force;
    p.vy += Math.sin(angle) * force;

    // damping (slightly less with amplitude to feel energetic)
    const damp = lerp(0.93, 0.87, amp);
    p.vx *= damp;
    p.vy *= damp;

    const ox = p.x;
    const oy = p.y;

    p.x += p.vx;
    p.y += p.vy;

    wrap(p);

    // particle stroke
    const speed = Math.hypot(p.vx, p.vy);
    const hue =
      190 + p.band * 1.5 + Math.sin(frame * 0.01 + p.phase) * 20 + amp * 80; // amp shifts colors

    const alpha = Math.min(0.25, speed * 0.08 + e * 0.05 + amp * 0.1); // amp brightens trails

    ctx.strokeStyle = `hsla(${hue},90%,60%,${alpha})`;
    ctx.lineWidth = 1 + amp * 1.5; // stroke grows with amplitude

    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
}

// linear interpolate helper
function lerp(a, b, t) {
  return a + (b - a) * t;
}

draw();
