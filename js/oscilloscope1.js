import { ctx, canvas, analyser, timeData } from "./visualizer.js";

export function draw() {
  requestAnimationFrame(draw);

  analyser.getByteTimeDomainData(timeData);

  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#00ffee";

  const slice = canvas.width / timeData.length;

  let x = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = timeData[i] / 255;
    const y = v * canvas.height;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    x += slice;
  }

  ctx.stroke();
}

draw();

