import { ctx, canvas, analyser, freqData } from "./visualizer.js";

let t = 0;
let frame = 0;

// Memory canvas for burn/ghosting
const memCanvas = document.createElement("canvas");
const memCtx = memCanvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  memCanvas.width = canvas.width;
  memCanvas.height = canvas.height;
}
resize();
window.addEventListener("resize", resize);

function avg(start, end) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += freqData[i];
  return sum / (end - start) / 255;
}

function rand(n) { return (Math.random() - 0.5) * n; }

function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);

  const bass = avg(0, 8);
  const mid = avg(8, 60);
  const high = avg(60, 160);

  frame++;

  // ---- Base phosphor smear ----
  ctx.globalAlpha = 0.1 + bass * 0.05;
  ctx.drawImage(memCanvas, rand(mid * 50), rand(mid * 50));
  ctx.globalAlpha = 1;

  // ---- flickering dark background ----
  ctx.fillStyle = `rgba(0,0,0,${0.05 + bass*0.05})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  // ---- organic glitchy wave shapes ----
  const lines = 25 + Math.floor(high * 50);
  for (let i = 0; i < lines; i++) {
    const angle = t * 0.05 + i * 0.6;
    const radius = 50 + Math.sin(angle * 3 + frame*0.02) * 300 * bass;

    const x = Math.cos(angle) * radius + Math.sin(frame * 0.01 + i) * 40 * high;
    const y = Math.sin(angle) * radius + Math.cos(frame * 0.01 + i) * 40 * high;

    ctx.strokeStyle = `hsla(${frame*2 + i*15},100%,${50 + high*40}%,${0.2 + mid*0.5})`;
    ctx.lineWidth = 1 + bass*5;

    ctx.beginPath();
    ctx.moveTo(x + rand(high*20), y + rand(high*20));
    ctx.lineTo(x + Math.sin(frame*0.03+i)*50, y + Math.cos(frame*0.03+i)*50);
    ctx.stroke();
  }

  // ---- CRT horizontal scan wobble ----
  const wobble = Math.sin(frame*0.03)*10 + bass*15;
  ctx.transform(1, 0, 0.02*bass, 1, 0, wobble);

  // ---- pixel shatter / signal drop effect ----
  if(bass + high > 0.9){
    for(let s=0; s<5; s++){
      const y = Math.random()*canvas.height;
      const h = 2 + Math.random()*30;
      const xOff = rand(200*bass);
      ctx.drawImage(canvas, 0, y, canvas.width, h, xOff, y, canvas.width, h);
    }
  }

  // ---- RGB chromatic split ----
  ctx.globalCompositeOperation = "screen";
  ctx.drawImage(canvas, bass*10, 0);
  ctx.drawImage(canvas, -bass*10, 0);
  ctx.globalCompositeOperation = "source-over";

  ctx.restore();

  // ---- update memory canvas for burn effect ----
  memCtx.globalAlpha = 0.9;
  memCtx.drawImage(canvas, 0, 0);
  memCtx.globalAlpha = 1;

  t += 0.03 + bass*0.2;
}

draw();
