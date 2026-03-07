// ===============================
// ZEN TEST SCENE — AUDIO BARS
// Guaranteed Zen-compatible
// ===============================

import { ctx, canvas, analyser, freqData } from "../visualizer.js";

let animationId;
let width, height;

/* ===============================
   INIT
=============================== */

export function init() {

  width = canvas.width;
  height = canvas.height;

  function resize() {
    width = canvas.width;
    height = canvas.height;
  }

  window.addEventListener("resize", resize);
  resize();

  draw();
}

/* ===============================
   DRAW LOOP
=============================== */

function draw() {

  animationId = requestAnimationFrame(draw);

  analyser.getByteFrequencyData(freqData);

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, width, height);

  const bars = 80;
  const step = Math.floor(freqData.length / bars);
  const barWidth = width / bars;

  for (let i = 0; i < bars; i++) {

    const value = freqData[i * step] / 255;
    const barHeight = value * height * 0.9;

    const x = i * barWidth;
    const y = height - barHeight;

    const hue = (i / bars) * 360;

    ctx.fillStyle = `hsl(${hue}, 80%, 55%)`;
    ctx.fillRect(x, y, barWidth - 2, barHeight);
  }
}

/* ===============================
   CLEANUP (VERY IMPORTANT)
=============================== */

export function destroy() {
  cancelAnimationFrame(animationId);
}