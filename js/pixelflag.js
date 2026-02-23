import { ctx, canvas, analyser, freqData } from "./visualizer.js";

/* ===============================
   GRID SETUP
================================ */
let size = 10;
let cols = Math.floor(window.innerWidth / size);
let rows = Math.floor(window.innerHeight / size);

let grid = [];
let nextGrid = [];

function initGrid() {
  cols = Math.floor(window.innerWidth / size);
  rows = Math.floor(window.innerHeight / size);
  grid = Array.from({ length: cols * rows }, () =>
    Math.random() > 0.75 ? 1 : 0
  );
  nextGrid = grid.slice();
}

initGrid();

window.addEventListener("resize", initGrid);

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

let frame = 0;
let lastBass = 0;

/* ===============================
   DRAW LOOP
================================ */
export function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);
  frame++;

  const len = freqData.length;

  // 🎵 Frequency Bands
  const bass = avg(freqData, 0, len * 0.08) / 255;
  const mids = avg(freqData, len * 0.08, len * 0.5) / 255;
  const highs = avg(freqData, len * 0.5, len) / 255;

  const energy =
    Math.sqrt(freqData.reduce((s, v) => s + v * v, 0) / len) / 255;

  const beat = bass > 0.6 && lastBass <= 0.6;
  lastBass = bass;

  /* ===============================
     CELLULAR EVOLUTION
  ================================ */
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = getIndex(x, y);
      const n = countNeighbors(x, y);
      const alive = grid[i];

      // 💥 Beat shockwave spawn
      if (beat && Math.random() < 0.15) {
        nextGrid[i] = 1;
        continue;
      }

      // 🔊 Bass mutation
      if (Math.random() < bass * 0.1) {
        nextGrid[i] = 1;
        continue;
      }

      // ⚡ High-frequency flicker
      if (Math.random() < highs * 0.05) {
        nextGrid[i] = 1 - alive;
        continue;
      }

      // 🧬 Energy-based chaos
      const survivalBias = 2 + Math.floor(energy * 2);

      if (alive && (n < survivalBias || n > 3 + survivalBias))
        nextGrid[i] = 0;
      else if (!alive && n === 3) nextGrid[i] = 1;
      else nextGrid[i] = alive;
    }
  }

  [grid, nextGrid] = [nextGrid, grid];

  /* ===============================
     VISUAL DISTORTION
  ================================ */
  const centerX = cols / 2;
  const centerY = rows / 2;

  const waveAmp = 6 * mids;
  const zoom = 1 + bass * 0.05;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);

  // 🌌 Fade trail
  ctx.fillStyle = `rgba(0, 0, 0, ${0.12 - energy * 0.05})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  /* ===============================
     DRAW CELLS
  ================================ */
  const hueShift = frame * 0.8 + bass * 200;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = getIndex(x, y);
      if (!grid[i]) continue;

      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 🌊 Wave distortion
      const offset =
        Math.sin(dist * 0.15 - frame * 0.1) * waveAmp;

      const drawX = x * size + offset;
      const drawY = y * size + offset;

      const hue =
        (hueShift + dist * 2 + highs * 300) % 360;

      const brightness = 40 + energy * 50 + Math.random() * 10;

      ctx.fillStyle = `hsl(${hue}, 100%, ${brightness}%)`;

      ctx.shadowBlur = 15 + energy * 30;
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;

      ctx.fillRect(drawX, drawY, size, size);
    }
  }

  ctx.restore();
}

draw();