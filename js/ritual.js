import { ctx, canvas, analyser, freqData } from "./visualizer.js";

let phase = 0;

function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);

  const low = freqData[1] / 255;
  const high = freqData[50] / 255;

  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(phase);

  ctx.strokeStyle = `hsl(${phase * 100},100%,50%)`;
  ctx.lineWidth = 2;

  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 300 + low * 400);
    ctx.stroke();
  }

  ctx.restore();
  phase += 0.005 + high * 0.05;
}

draw();
