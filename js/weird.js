import { ctx, canvas, analyser, freqData } from "./visualizer.js";

let rot = 0;
let t = 0;

export function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);

  const bass = freqData[2] / 255;
  const mid = freqData[30] / 255;
  const high = freqData[120] / 255;

  t += 0.01;

  // TRAIL FADE (not boring black)
  ctx.fillStyle = `rgba(0,0,0,0.08)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  // AUDIO ROTATION + SHAKE
  rot += bass * 0.2;
  ctx.rotate(rot);
  ctx.translate(
    Math.sin(t * 10) * bass * 30,
    Math.cos(t * 12) * bass * 30
  );

  // COLOR WARP
  const hue = (t * 80 + bass * 300 + mid * 150) % 360;
  ctx.strokeStyle = `hsl(${hue}, 100%, ${50 + high * 30}%)`;
  ctx.lineWidth = 2 + bass * 6;

  // MULTI RINGS
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      120 + i * 60 + Math.sin(t * 5 + i) * bass * 200,
      t + i,
      Math.PI * 2 + t
    );
    ctx.stroke();
  }

  // RADIAL SPIKES
  ctx.beginPath();
  for (let i = 0; i < 256; i++) {
    const angle = (i / 256) * Math.PI * 2;
    const amp = freqData[i] / 255;
    const r = 200 + amp * 400;

    ctx.lineTo(
      Math.cos(angle) * r,
      Math.sin(angle) * r
    );
  }
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}

draw();
