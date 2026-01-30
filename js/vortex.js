import { ctx, canvas, analyser, freqData } from "./visualizer.js";

let t = 0;

function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);

  const bass = freqData[2] / 255;
  const mid = freqData[20] / 255;

  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  for (let i = 0; i < 300; i++) {
    const angle = i * 0.15 + t;
    const radius = i * (1 + bass * 3);

    ctx.strokeStyle = `hsl(${i + t * 50},100%,${50 + mid * 30}%)`;
    ctx.beginPath();
    ctx.moveTo(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    );
    ctx.lineTo(
      Math.cos(angle + 0.5) * radius,
      Math.sin(angle + 0.5) * radius
    );
    ctx.stroke();
  }

  ctx.restore();
  t += 0.02 + bass * 0.2;
}

draw();
