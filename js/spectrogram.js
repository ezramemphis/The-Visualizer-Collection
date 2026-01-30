import { ctx, canvas, analyser, freqData, timeData } from "./visualizer.js";

/* ===============================
   AUDIO TOPOGRAPHY
================================ */

let terrain = [];
const WIDTH = 128;
const DEPTH = 220;

function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);

  terrain.push([...freqData.slice(0, WIDTH)]);
  if (terrain.length > DEPTH) terrain.shift();

  ctx.fillStyle = "rgba(5,8,12,0.25)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height * 0.75);
  ctx.scale(1.2, 0.6);
  ctx.rotate(-0.35);

  for (let z = 0; z < terrain.length; z++) {
    const row = terrain[z];
    const depthFade = z / terrain.length;

    for (let x = 0; x < WIDTH; x++) {
      const h = row[x] / 255;
      const height = h * 120 * (1 - depthFade);

      ctx.fillStyle = `hsla(
        ${200 - h * 180},
        70%,
        ${35 + h * 30}%,
        ${0.8 - depthFade}
      )`;

      ctx.fillRect(
        (x - WIDTH / 2) * 6,
        -z * 4 - height,
        5,
        height
      );
    }
  }

  ctx.restore();
}

draw();
