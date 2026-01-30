import { ctx, canvas, analyser, timeData } from "./visualizer.js";

/* ===============================
   SMOOTH OSCILLOSCOPE
================================ */

let frame = 0;

// smoothed amplitude
let ampSmooth = 0;

// tweakables (feel free to adjust)
const ATTACK = 0.15;   // how fast it reacts to peaks
const RELEASE = 0.02;  // how slow it relaxes (higher = smoother)
const FEEDBACK_FADE = 0.08; // trail decay speed

function rmsAmplitude() {
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / timeData.length);
}

export function draw() {
  requestAnimationFrame(draw);
  analyser.getByteTimeDomainData(timeData);
  frame++;

  /* ===============================
     AMPLITUDE SMOOTHING
  ================================ */
  const ampRaw = rmsAmplitude();
  if (ampRaw > ampSmooth) {
    ampSmooth += (ampRaw - ampSmooth) * ATTACK;
  } else {
    ampSmooth += (ampRaw - ampSmooth) * RELEASE;
  }

  /* ===============================
     FEEDBACK FADE (soft trail)
  ================================ */
  ctx.fillStyle = `rgba(0,0,0,${FEEDBACK_FADE})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const centerY = canvas.height / 2;
  const slice = canvas.width / timeData.length;

  /* ===============================
     GLOW UNDERLAY
  ================================ */
  ctx.beginPath();
  ctx.lineWidth = 5 + ampSmooth * 8;
  ctx.strokeStyle = `hsla(${185 + ampSmooth * 60}, 100%, 65%, 0.18)`;

  let x = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    const y =
      centerY +
      v * canvas.height * (0.25 + ampSmooth * 0.25) +
      Math.sin(frame * 0.01 + i * 0.02) * 2;

    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    x += slice;
  }
  ctx.stroke();

  /* ===============================
     MAIN WAVEFORM
  ================================ */
  ctx.beginPath();
  ctx.lineWidth = 1.5 + ampSmooth * 2;
  ctx.strokeStyle = `hsla(${195 + ampSmooth * 80}, 100%, 70%, 0.95)`;

  x = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    const y =
      centerY +
      v * canvas.height * (0.25 + ampSmooth * 0.3);

    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    x += slice;
  }
  ctx.stroke();

  /* ===============================
     SUBTLE HARMONIC GHOST
  ================================ */
  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = `hsla(${215 + ampSmooth * 40}, 100%, 60%, 0.25)`;

  x = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    const y =
      centerY +
      v * canvas.height * 0.15 +
      Math.sin(frame * 0.02 + i * 0.05) * 6;

    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    x += slice;
  }
  ctx.stroke();
}

draw();
