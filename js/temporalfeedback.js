import { ctx, canvas, analyser, freqData, timeData } from "./visualizer.js";

/* ===============================
   TEMPORAL FEEDBACK SCULPTURE
================================ */

const DEPTH = 7;
let frame = 0;

const buffers = [...Array(DEPTH)].map(() => {
  const c = document.createElement("canvas");
  c.width = canvas.width;
  c.height = canvas.height;
  return c.getContext("2d");
});

function avg(a, b) {
  let s = 0;
  for (let i = a; i < b; i++) s += freqData[i];
  return s / (b - a) / 255;
}

function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);
  frame++;

  const bass = avg(0, 6);
  const high = avg(80, 140);

  // rotate memory stack
  buffers.unshift(buffers.pop());
  buffers[0].clearRect(0, 0, canvas.width, canvas.height);
  buffers[0].drawImage(canvas, 0, 0);

  // decay present
  ctx.fillStyle = `rgba(6,6,10,${0.15 + high * 0.25})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  const reach = Math.floor(2 + bass * (DEPTH - 2));

  for (let i = 1; i <= reach; i++) {
    const t = i / reach;
    ctx.globalAlpha = (1 - t) * 0.6;

    const offset =
      Math.sin(frame * 0.002 + i) * 40 * bass +
      Math.cos(frame * 0.003 + i) * 20;

    ctx.drawImage(
      buffers[i].canvas,
      -canvas.width / 2 + offset,
      -canvas.height / 2 - offset
    );
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

draw();
