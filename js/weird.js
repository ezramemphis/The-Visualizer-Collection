import { ctx, canvas, analyser, freqData, timeData } from "./visualizer.js";

/* ===============================
   STATE
================================ */
let frame = 0;
let shards = [];
const SHARD_COUNT = 800;
let width = canvas.width;
let height = canvas.height;

function resize() {
  width = canvas.width;
  height = canvas.height;
}
window.addEventListener("resize", resize);

/* ===============================
   INIT SHARDS
================================ */
for (let i = 0; i < SHARD_COUNT; i++) {
  shards.push({
    x: (Math.random() - 0.5) * width,
    y: (Math.random() - 0.5) * height,
    vx: 0,
    vy: 0,
    rot: Math.random() * Math.PI * 2,
    size: 1 + Math.random() * 3
  });
}

/* ===============================
   HELPERS
================================ */
function avg(s, e) {
  let v = 0;
  for (let i = s; i < e; i++) v += freqData[i];
  return v / (e - s) / 255;
}

function rand(n) {
  return (Math.random() - 0.5) * n;
}

/* ===============================
   DRAW
================================ */
function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);
  frame++;

  const bass = avg(0, 10);
  const mid = avg(10, 50);
  const high = avg(50, 160);

  // dark background
  ctx.fillStyle = "rgba(5,5,10,0.12)";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);

  /* ===============================
     CORE VIBRATION CRYSTAL
  ================================ */
  const coreRadius = 60 + bass * 200;
  const spikes = 12 + Math.floor(mid * 30);

  for (let i = 0; i < spikes; i++) {
    const angle = (i / spikes) * Math.PI * 2 + frame * 0.005;
    const len = coreRadius + Math.sin(frame * 0.03 + i) * bass * 120;
    const x = Math.cos(angle) * len;
    const y = Math.sin(angle) * len;
    ctx.strokeStyle = `hsla(${(frame*0.5 + i*30)%360}, 90%, 55%, 0.6)`;
    ctx.lineWidth = 1 + high*2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  /* ===============================
     SHARD FIELD
  ================================ */
  for (let s of shards) {
    // velocity from audio
    s.vx += Math.cos(s.rot) * bass * 3 + rand(high*1.5);
    s.vy += Math.sin(s.rot) * bass * 3 + rand(high*1.5);

    // rotational spin
    s.rot += 0.01 + mid*0.05;

    s.x += s.vx;
    s.y += s.vy;

    // friction
    s.vx *= 0.92;
    s.vy *= 0.92;

    // wrap around edges
    if (s.x < -width/2) s.x = width/2;
    if (s.x > width/2) s.x = -width/2;
    if (s.y < -height/2) s.y = height/2;
    if (s.y > height/2) s.y = -height/2;

    // draw shard
    ctx.fillStyle = `hsla(${(frame*0.7 + s.x*0.2)%360}, 100%, ${50+high*20}%, 0.6)`;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.fillRect(-s.size/2, -s.size/2, s.size*2, s.size/4);
    ctx.restore();
  }

  /* ===============================
     HIGH-FREQ SPARKS
  ================================ */
  const sparks = Math.floor(high*200);
  for (let i = 0; i < sparks; i++) {
    const angle = Math.random()*Math.PI*2;
    const dist = Math.random() * 400 * high;
    const x = Math.cos(angle)*dist;
    const y = Math.sin(angle)*dist;
    const size = Math.random()*2 + 0.5;
    ctx.fillStyle = `hsla(${(frame*2 + i*5)%360}, 100%, 70%, ${0.2+high*0.4})`;
    ctx.fillRect(x, y, size, size);
  }

  /* ===============================
     REFRACTION LINES
  ================================ */
  ctx.beginPath();
  for (let i = 0; i < 200; i++) {
    const t = i/200;
    const angle = t*Math.PI*4 + frame*0.01;
    const radius = 300 + Math.sin(t*15 + frame*0.02)*mid*100;
    const x = Math.cos(angle)*radius;
    const y = Math.sin(angle)*radius;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.strokeStyle = `hsla(${(frame*0.3)%360}, 80%, 60%, 0.15)`;
  ctx.lineWidth = 1 + mid*2;
  ctx.stroke();

  ctx.restore();

  /* ===============================
     GLITCH TEAR (reactive)
  ================================ */
  if (bass > 0.7) {
    const y = Math.random()*height;
    const h = 8 + Math.random()*20;
    ctx.drawImage(
      canvas,
      0, y, width, h,
      rand(bass*300), y, width, h
    );
  }
}

draw();
