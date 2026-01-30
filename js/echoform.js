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
let phase = 0;

const LAYERS = 4;
const RIBBONS = 2;

const memoryCanvas = document.createElement("canvas");
const memoryCtx = memoryCanvas.getContext("2d");

function resizeMemory() {
  memoryCanvas.width = canvas.width;
  memoryCanvas.height = canvas.height;
}
resizeMemory();
window.addEventListener("resize", resizeMemory);

/* ===============================
   HELPERS
================================ */

function avg(start, end) {
  let s = 0;
  for (let i = start; i < end; i++) s += freqData[i];
  return Math.min(s / (end - start) / 255, 1);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/* ===============================
   DRAW
================================ */

function draw() {
  requestAnimationFrame(draw);

  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);

  frame++;

  const bass = avg(0, 6);
  const mid = avg(20, 60);
  const high = avg(60, 120);

  /* ---- background fade ---- */
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  /* ---- subtle feedback ---- */
  ctx.globalAlpha = 0.15;
  ctx.drawImage(memoryCanvas, 0, 0);
  ctx.globalAlpha = 1;

  memoryCtx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  phase += 0.002 + bass * 0.02;

  /* ===============================
     OSCILLOSCOPE RINGS
  ================================ */

  for (let l = 0; l < LAYERS; l++) {
    const radius =
      Math.min(canvas.width, canvas.height) *
      (0.18 + l * 0.1 + bass * 0.15);

    ctx.save();
    ctx.rotate(phase * (l + 1) * 0.4);

    ctx.beginPath();

    const hue = (frame * 0.3 + l * 70) % 360;
    ctx.strokeStyle = `hsla(${hue},90%,60%,${0.15 + mid * 0.3})`;
    ctx.lineWidth = 1 + mid * 2;

    for (let i = 0; i < timeData.length; i++) {
      const t = i / timeData.length;
      const angle = t * Math.PI * 2;

      const wave =
        (timeData[i] / 255 - 0.5) *
        radius *
        (0.4 + mid);

      const r = clamp(radius + wave, radius * 0.6, radius * 1.4);

      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;

      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.restore();
  }

  /* ===============================
     SPECTRAL RIBBONS
  ================================ */

  for (let r = 0; r < RIBBONS; r++) {
    ctx.save();
    ctx.rotate(-phase * (r + 1));

    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `hsla(${frame + r * 120},100%,70%,0.2)`;

    for (let i = 0; i < timeData.length; i += 3) {
      const t = i / timeData.length;

      const wave =
        (timeData[i] / 255 - 0.5) *
        canvas.height *
        0.1;

      const x =
        Math.sin(t * 4 + r) *
        (canvas.width * 0.18 + wave * mid);

      const y =
        Math.cos(t * 3 + r) *
        (canvas.height * 0.18 + wave * bass);

      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  /* ---- write to memory ---- */
  memoryCtx.globalAlpha = 0.6;
  memoryCtx.drawImage(canvas, 0, 0);
}

/* ===============================
   START
================================ */

draw();
