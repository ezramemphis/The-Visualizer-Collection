import { ctx, canvas, analyser, freqData } from "./visualizer.js";

let t = 0;
let frame = 0;

// Memory canvas for feedback trail
const memCanvas = document.createElement("canvas");
const memCtx = memCanvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  memCanvas.width = canvas.width;
  memCanvas.height = canvas.height;
}
resize();
window.addEventListener("resize", resize);

function avg(start, end) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += freqData[i];
  return sum / (end - start) / 255;
}

function rand(n) { return (Math.random() - 0.5) * n; }

function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);

  const bass = avg(0, 8);
  const lowMid = avg(8, 40);
  const mid = avg(40, 90);
  const high = avg(90, 160);

  frame++;

  // ---- Feedback trail ----
  ctx.globalAlpha = 0.15;
  ctx.drawImage(memCanvas, rand(bass * 30), rand(bass * 30));
  ctx.globalAlpha = 1;

  // ---- Background fade ----
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.save();
  ctx.translate(cx, cy);

  const layers = 8;
  for (let layer = 0; layer < layers; layer++) {
    ctx.save();

    const dir = layer % 2 === 0 ? 1 : -1;
    const rotateAmount = frame * 0.002 * dir * (1 + mid * 6);
    ctx.rotate(rotateAmount + Math.sin(frame * 0.01 + layer) * bass * 2);

    const points = 400 + layer * 20;
    ctx.beginPath();

    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 8;
      const wave = Math.sin(angle * 12 + frame * 0.03) * bass * 200;
      const jitter = Math.sin(angle * 40 + t * 0.1) * high * 80;

      const radius = 80 + layer * 40 + wave + jitter;
      const x = Math.cos(angle) * radius + rand(high * 30);
      const y = Math.sin(angle) * radius + rand(high * 30);

      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }

    const hue = (frame * 1.5 + layer * 50 + Math.sin(t * 0.05) * 120) % 360;
    ctx.strokeStyle = `hsla(${hue},100%,60%,${0.05 + high * 0.7})`;
    ctx.lineWidth = 0.5 + high * 4 + bass * 2;
    ctx.stroke();

    ctx.restore();
  }

  // ---- Radial dust particles ----
  const dustCount = 400 + high * 1500;
  for (let i = 0; i < dustCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * canvas.width * 0.6;
    const size = Math.random() * 2 + high * 2;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;

    ctx.fillStyle = `hsla(${frame + i},100%,70%,${0.15 + high})`;
    ctx.fillRect(x, y, size, size);
  }

  ctx.restore();

  // ---- Bass shock slices ----
  if (bass > 0.65) {
    const slices = 5 + bass * 30;
    for (let i = 0; i < slices; i++) {
      const y = Math.random() * canvas.height;
      const h = 5 + Math.random() * 40;
      const offset = rand(bass * 500);
      ctx.drawImage(canvas, 0, y, canvas.width, h, offset, y, canvas.width, h);
    }
  }

  // ---- RGB glitch pass ----
  if (high > 0.45) {
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(canvas, rand(high * 10), 0);
    ctx.drawImage(canvas, -rand(high * 10), 0);
    ctx.globalCompositeOperation = "source-over";
  }

  // ---- update memory canvas ----
  memCtx.clearRect(0, 0, canvas.width, canvas.height);
  memCtx.drawImage(canvas, 0, 0);

  t += 0.03 + bass * 0.15;
}

draw();
