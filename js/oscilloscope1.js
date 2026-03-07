import { ctx, canvas, analyser, timeData } from "./visualizer.js";

/* =====================================================
   DARK CYBER LAB OSCILLOSCOPE
===================================================== */

let frame = 0;
let ampSmooth = 0;

/* tuning */

const ATTACK = 0.12;
const RELEASE = 0.03;
const FEEDBACK_FADE = 0.07;

function rmsAmplitude() {
  let sum = 0;

  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    sum += v * v;
  }

  return Math.sqrt(sum / timeData.length);
}

/* ===================================================== */

export function draw() {

  requestAnimationFrame(draw);

  analyser.getByteTimeDomainData(timeData);
  frame++;

  /* ===============================
     AMPLITUDE SMOOTHING
  =============================== */

  const ampRaw = rmsAmplitude();

  if (ampRaw > ampSmooth)
    ampSmooth += (ampRaw - ampSmooth) * ATTACK;
  else
    ampSmooth += (ampRaw - ampSmooth) * RELEASE;

  /* ===============================
     DARK LAB AMBIENT BACKGROUND
  =============================== */

  ctx.fillStyle = `rgba(0,0,0,${FEEDBACK_FADE})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const width = canvas.width;
  const height = canvas.height;

  const centerY = height / 2;
  const slice = width / timeData.length;

  /* ===============================
     CYBER GRID UNDERLAY
  =============================== */

  ctx.save();

  ctx.strokeStyle = "rgba(0,180,255,0.05)";
  ctx.lineWidth = 1;

  const grid = 60;

  for (let x = 0; x < width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();

  /* ===============================
     SCAN BEAM SWEEP
  =============================== */

  const scanY =
    centerY +
    Math.sin(frame * 0.015) * 40;

  ctx.fillStyle = "rgba(0,220,255,0.05)";
  ctx.fillRect(0, scanY, width, 2);

  /* ===============================
     SIGNAL CORE WAVE
  =============================== */

  const hueBase = 190 + ampSmooth * 80;

  ctx.beginPath();

  ctx.lineWidth = 2 + ampSmooth * 3;

  ctx.strokeStyle =
    `hsla(${hueBase},100%,70%,0.95)`;

  let x = 0;

  for (let i = 0; i < timeData.length; i++) {

    const v = (timeData[i] - 128) / 128;

    const distortion =
      Math.sin(frame * 0.01 + i * 0.03) * 4;

    const y =
      centerY +
      v * height * (0.22 + ampSmooth * 0.25) +
      distortion;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);

    x += slice;
  }

  ctx.stroke();

  /* ===============================
     PLASMA GHOST SIGNAL
  =============================== */

  ctx.beginPath();

  ctx.lineWidth = 1;

  ctx.strokeStyle =
    `hsla(${hueBase + 40},100%,60%,0.25)`;

  x = 0;

  for (let i = 0; i < timeData.length; i++) {

    const v = (timeData[i] - 128) / 128;

    const plasma =
      Math.sin(frame * 0.02 + i * 0.05) * 8;

    const y =
      centerY +
      v * height * 0.12 +
      plasma;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);

    x += slice;
  }

  ctx.stroke();

  /* ===============================
     EDGE GLOW ACCENT
  =============================== */

  ctx.beginPath();

  ctx.lineWidth = 6;

  ctx.strokeStyle =
    `hsla(${hueBase},100%,65%,0.08)`;

  x = 0;

  for (let i = 0; i < timeData.length; i++) {

    const v = (timeData[i] - 128) / 128;

    const y =
      centerY +
      v * height * (0.22 + ampSmooth * 0.25);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);

    x += slice;
  }

  ctx.stroke();
}

draw();