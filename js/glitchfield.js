import { ctx, canvas, analyser, freqData } from "./visualizer.js";

/* ============================
   STATE
============================ */

const buffer = document.createElement("canvas");
const bctx = buffer.getContext("2d");

function resizeBuffer() {
  buffer.width = canvas.width;
  buffer.height = canvas.height;
}
resizeBuffer();
window.addEventListener("resize", resizeBuffer);

let frame = 0;

/* ============================
   HELPERS
============================ */

function band(start, end) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += freqData[i];
  return sum / (end - start) / 255;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

/* ============================
   DRAW
============================ */

function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);
  frame++;

  const bass = band(0, 6);
  const mid = band(10, 40);
  const high = band(60, 120);

  /* ---- base fade ---- */
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  /* ---- write frame to buffer ---- */
  bctx.clearRect(0, 0, buffer.width, buffer.height);
  bctx.drawImage(canvas, 0, 0);

  /* ============================
     HORIZONTAL TEARING
  ============================ */

  if (Math.random() < mid * 0.6) {
    const slices = Math.floor(rand(3, 12));

    for (let i = 0; i < slices; i++) {
      const y = rand(0, canvas.height);
      const h = rand(5, 40 + bass * 80);
      const shift = rand(-60, 60) * (0.3 + mid);

      ctx.drawImage(
        buffer,
        0,
        y,
        canvas.width,
        h,
        shift,
        y,
        canvas.width,
        h
      );
    }
  }

  /* ============================
     VERTICAL SHREDS
  ============================ */

  if (Math.random() < high * 0.4) {
    const x = rand(0, canvas.width);
    const w = rand(10, 80);
    const yShift = rand(-40, 40);

    ctx.drawImage(
      buffer,
      x,
      0,
      w,
      canvas.height,
      x,
      yShift,
      w,
      canvas.height
    );
  }

  /* ============================
     RGB CHANNEL OFFSET
  ============================ */

  if (Math.random() < high * 0.3) {
    ctx.globalCompositeOperation = "screen";

    ctx.drawImage(buffer, bass * 12, 0);
    ctx.drawImage(buffer, -bass * 8, mid * 6);

    ctx.globalCompositeOperation = "source-over";
  }

  /* ============================
     SCANLINE NOISE
  ============================ */

  ctx.fillStyle = `rgba(255,255,255,${0.02 + high * 0.05})`;
  for (let y = 0; y < canvas.height; y += 3) {
    if (Math.random() < 0.04) {
      ctx.fillRect(0, y, canvas.width, 1);
    }
  }

  /* ============================
     DIGITAL COLOR WASH
  ============================ */

  ctx.fillStyle = `hsla(${frame * 0.5 + bass * 120},100%,50%,0.03)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/* ============================
   GO
============================ */

draw();
