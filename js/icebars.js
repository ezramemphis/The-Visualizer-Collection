import { ctx, canvas, analyser, freqData } from "./visualizer.js";

const BAR_COUNT = 56;
const smooth = new Float32Array(BAR_COUNT);

// shard particles
const shards = [];

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function drawShard(x, y, h, w, energy) {
  const faces = Math.floor(rand(3, 6));

  ctx.beginPath();
  ctx.moveTo(x, y);

  for (let i = 0; i < faces; i++) {
    const px = x + rand(-w * 0.6, w * 0.6);
    const py = y + rand(-h * 0.1, h * 0.9);
    ctx.lineTo(px, py);
  }

  ctx.lineTo(x + rand(-w * 0.4, w * 0.4), y + h);
  ctx.closePath();

  const light = 200 + energy * 40;

  ctx.fillStyle = `hsla(${light}, 50%, ${55 + energy * 20}%, 0.85)`;
  ctx.fill();

  // fracture highlight
  ctx.strokeStyle = `hsla(${light + 10}, 80%, 80%, 0.35)`;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function spawnShard(x, y, energy) {
  shards.push({
    x,
    y,
    vx: rand(-2, 2),
    vy: rand(-6, -2),
    life: 1,
    size: rand(4, 10),
    rot: rand(0, Math.PI)
  });
}

function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);

  // faster decay so nothing lingers
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const step = Math.floor(freqData.length / BAR_COUNT);
  const barW = canvas.width / BAR_COUNT;
  const baseY = canvas.height * 0.9;

  for (let i = 0; i < BAR_COUNT; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) {
      sum += freqData[i * step + j];
    }

    const energy = sum / step / 255;
    smooth[i] += (energy - smooth[i]) * 0.15;

    const h = smooth[i] * canvas.height * 0.65;
    if (h < 4) continue;

    const x = i * barW + barW * 0.5;
    const y = baseY - h;

    drawShard(x, y, h, barW * 0.6, smooth[i]);

    // eject shards on hits
    if (energy > 0.75 && Math.random() < energy * 0.4) {
      spawnShard(x, y, energy);
    }
  }

  // floating ice shrapnel
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];

    s.vy += 0.2;
    s.x += s.vx;
    s.y += s.vy;
    s.life -= 0.04;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);

    ctx.fillStyle = `hsla(195, 60%, 75%, ${s.life})`;
    ctx.beginPath();
    ctx.moveTo(-s.size, -s.size * 0.3);
    ctx.lineTo(s.size, 0);
    ctx.lineTo(-s.size * 0.2, s.size);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    if (s.life <= 0) shards.splice(i, 1);
  }
}

draw();
