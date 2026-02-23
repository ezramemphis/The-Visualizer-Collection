import { ctx, canvas, analyser, freqData } from "./visualizer.js";

/* ===============================
   GRID SYSTEM
================================ */
let size = 8;
let cols, rows;
let grid = [];
let nextGrid = [];

function initGrid() {
  cols = Math.floor(canvas.width / size);
  rows = Math.floor(canvas.height / size);
  grid = Array.from({ length: cols * rows }, () =>
    Math.random() > 0.85 ? 1 : 0
  );
  nextGrid = grid.slice();
}

initGrid();

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  initGrid();
});

/* ===============================
   HELPERS
================================ */
function getIndex(x, y) {
  return ((y + rows) % rows) * cols + ((x + cols) % cols);
}

function countNeighbors(x, y) {
  let sum = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      sum += grid[getIndex(x + dx, y + dy)];
    }
  }
  return sum;
}

function avg(arr, start, end) {
  let sum = 0;
  for (let i = Math.floor(start); i < Math.floor(end); i++) {
    sum += arr[i];
  }
  return sum / (end - start);
}

/* ===============================
   AUDIO STATE
================================ */
let frame = 0;
let smoothedBass = 0;
let lastBass = 0;
let beatPulse = 0;
let shockwaves = [];

function detectBeat(bass) {
  smoothedBass = smoothedBass * 0.85 + bass * 0.15;
  const threshold = smoothedBass * 1.25;

  const isBeat = bass > threshold && bass > 0.35;

  if (isBeat && lastBass <= threshold) {
    beatPulse = 1;
    shockwaves.push({ radius: 0, power: bass });
  }

  lastBass = bass;
}

/* ===============================
   BLOOM LAYER (SOFTENED)
================================ */
const bloomCanvas = document.createElement("canvas");
const bloomCtx = bloomCanvas.getContext("2d");

function resizeBloom() {
  bloomCanvas.width = canvas.width;
  bloomCanvas.height = canvas.height;
}
resizeBloom();

/* ===============================
   MAIN LOOP
================================ */
export function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);
  frame++;

  const len = freqData.length;

  const bass = avg(freqData, 0, len * 0.08) / 255;
  const mids = avg(freqData, len * 0.08, len * 0.5) / 255;
  const highs = avg(freqData, len * 0.5, len) / 255;

  const rms =
    Math.sqrt(freqData.reduce((s, v) => s + v * v, 0) / len) / 255;

  detectBeat(bass);
  beatPulse *= 0.88;

  /* ===============================
     CELLULAR EVOLUTION (CALMER)
  ================================ */
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = getIndex(x, y);
      const n = countNeighbors(x, y);
      const alive = grid[i];

      if (Math.random() < bass * 0.08) {
        nextGrid[i] = 1;
        continue;
      }

      if (Math.random() < highs * 0.03) {
        nextGrid[i] = 1 - alive;
        continue;
      }

      const chaos = Math.floor(rms * 2);

      if (alive && (n < 2 || n > 3 + chaos))
        nextGrid[i] = 0;
      else if (!alive && n === 3) nextGrid[i] = 1;
      else nextGrid[i] = alive;
    }
  }

  [grid, nextGrid] = [nextGrid, grid];

  /* ===============================
     TRAIL FADE (SMOOTHER)
  ================================ */
  ctx.fillStyle = `rgba(0,0,0,${0.12 - rms * 0.04})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  /* ===============================
     CAMERA MOTION (SUBTLE)
  ================================ */
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const zoom = 1 + beatPulse * 0.05 + rms * 0.03;
  const rotation = mids * 0.05 * Math.sin(frame * 0.01);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation);
  ctx.scale(zoom, zoom);
  ctx.translate(-centerX, -centerY);

  /* ===============================
     DRAW TO BLOOM LAYER
  ================================ */
  bloomCtx.clearRect(0, 0, canvas.width, canvas.height);

  const hueBase = frame * 0.8 + mids * 200;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = getIndex(x, y);
      if (!grid[i]) continue;

      const px = x * size;
      const py = y * size;

      const dx = px - centerX;
      const dy = py - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const radialPush =
        bass * 40 * Math.exp(-dist * 0.002);

      const wave =
        Math.sin(dist * 0.02 - frame * 0.1) *
        rms *
        25;

      const drawX = px + (dx / dist) * radialPush + wave;
      const drawY = py + (dy / dist) * radialPush + wave;

      const hue =
        (hueBase + dist * 0.05 + highs * 250) % 360;

      const brightness =
        45 + rms * 35 + beatPulse * 15;

      bloomCtx.fillStyle = `hsl(${hue},100%,${brightness}%)`;
      bloomCtx.fillRect(drawX, drawY, size, size);
    }
  }

  /* ===============================
     SOFT BLOOM (1 PASS ONLY)
  ================================ */
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = "blur(6px)";
  ctx.drawImage(bloomCanvas, 0, 0);

  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(bloomCanvas, 0, 0);

  /* ===============================
     SHOCKWAVE RINGS (SOFT)
  ================================ */
  shockwaves.forEach(w => {
    ctx.beginPath();
    ctx.arc(centerX, centerY, w.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.05 * w.power})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    w.radius += 12 + bass * 20;
  });

  shockwaves = shockwaves.filter(w => w.radius < canvas.width);

  ctx.restore();
}

draw();