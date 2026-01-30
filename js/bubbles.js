import { ctx, canvas, analyser, freqData } from "./visualizer.js";

/* ===============================
   CONFIG
================================ */
const BUBBLE_COUNT = 180;
let frame = 0;
let bubbles = [];

/* ===============================
   HELPERS
================================ */
function avg(start, end) {
  let s = 0;
  for (let i = start; i < end; i++) s += freqData[i];
  return s / (end - start) / 255;
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

/* ===============================
   LAVA BUBBLE
================================ */
class Bubble {
  constructor(size = null) {
    this.r = size ?? rand(6, 45);
    this.x = rand(this.r, canvas.width - this.r);
    this.y = rand(canvas.height + this.r, canvas.height * 1.2);

    this.vx = rand(-0.015, 0.015);
    this.vy = rand(-0.03, -0.012);

    this.mass = this.r * 0.9;
    this.hue = rand(10, 45); // lava tones
  }

  update(speed) {
    /* --- buoyancy (wax heating) --- */
    this.vy -= 0.0005 * this.mass * speed;

    /* --- slow viscous drift --- */
    this.vx += Math.sin(frame * 0.001 + this.y * 0.008) * 0.0006;

    /* --- HEAVY damping (critical) --- */
    this.vx *= 0.985;
    this.vy *= 0.985;

    this.x += this.vx * speed * 0.6;
    this.y += this.vy * speed * 0.6;

    /* --- recycle --- */
    if (this.y + this.r < -50) {
      this.y = canvas.height + this.r + rand(50, 150);
      this.vy = rand(-0.035, -0.015);
    }

    this.x = Math.max(this.r, Math.min(canvas.width - this.r, this.x));
  }

  draw() {
    /* ===== CORE DENSITY ===== */
    const core = ctx.createRadialGradient(
      this.x - this.r * 0.2,
      this.y - this.r * 0.25,
      this.r * 0.15,
      this.x,
      this.y,
      this.r
    );

    core.addColorStop(0, `hsla(${this.hue},90%,55%,0.9)`);
    core.addColorStop(0.55, `hsla(${this.hue + 10},85%,42%,0.65)`);
    core.addColorStop(0.75, `hsla(${this.hue + 20},80%,30%,0.45)`);
    core.addColorStop(1, `hsla(${this.hue + 30},70%,20%,0.15)`);

    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();

    /* ===== SHARP MENISCUS EDGE ===== */
    ctx.strokeStyle = `hsla(${this.hue + 30},80%,60%,0.22)`;
    ctx.lineWidth = Math.max(1, this.r * 0.06);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 0.97, 0, Math.PI * 2);
    ctx.stroke();

    /* ===== SUBTLE HIGHLIGHT ===== */
    ctx.fillStyle = `hsla(${this.hue + 40},100%,70%,0.12)`;
    ctx.beginPath();
    ctx.arc(
      this.x - this.r * 0.28,
      this.y - this.r * 0.32,
      this.r * 0.22,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

/* ===============================
   INIT
================================ */
function init() {
  bubbles.length = 0;

  for (let i = 0; i < 20; i++) bubbles.push(new Bubble(rand(35, 60)));   // big blobs
  for (let i = 0; i < 60; i++) bubbles.push(new Bubble(rand(16, 30)));   // medium
  for (let i = 0; i < 100; i++) bubbles.push(new Bubble(rand(6, 12)));   // micro
}
init();

/* ===============================
   COLLISION + MERGING
================================ */
function handleCollisions() {
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i];
      const b = bubbles[j];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = a.r + b.r;

      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const pressure = overlap / minDist;

        /* --- soft merge --- */
        if (pressure < 0.22 && Math.random() < 0.0015) {
          const newR = Math.sqrt(a.r * a.r + b.r * b.r);
          bubbles[i] = new Bubble(newR);
          bubbles.splice(j, 1);
          return;
        }

        /* --- wax pressure push --- */
        const force = overlap * 0.018;
        a.x -= nx * force;
        a.y -= ny * force;
        b.x += nx * force;
        b.y += ny * force;

        a.vx -= nx * force * 0.08;
        a.vy -= ny * force * 0.08;
        b.vx += nx * force * 0.08;
        b.vy += ny * force * 0.08;
      }
    }
  }
}

/* ===============================
   DRAW LOOP
================================ */
function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);
  frame++;

  const bass = avg(0, 6);
  const mid = avg(20, 60);

  /* --- SIDECHAIN (SUBTLE) --- */
  const speed = 0.5 + mid * 0.9;

  /* --- CLEAN BACKGROUND (NO GHOSTING) --- */
  ctx.fillStyle = "rgba(10,8,12,0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  handleCollisions();

  for (let b of bubbles) {
    b.update(speed);
    b.draw();
  }
}

draw();
