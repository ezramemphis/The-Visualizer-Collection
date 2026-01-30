import { ctx, canvas, analyser, freqData } from "./visualizer.js";

/* ===============================
   GRID SETUP
================================ */
let size = 12;
let cols = Math.floor(window.innerWidth / size);
let rows = Math.floor(window.innerHeight / size);

let grid = Array.from({ length: cols * rows }, () => Math.random() > 0.7 ? 1 : 0);
let nextGrid = grid.slice();

window.addEventListener("resize", () => {
  cols = Math.floor(window.innerWidth / size);
  rows = Math.floor(window.innerHeight / size);
  grid = Array.from({ length: cols * rows }, () => Math.random() > 0.7 ? 1 : 0);
  nextGrid = grid.slice();
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

let frame = 0;

/* ===============================
   DRAW LOOP
================================ */
export function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);
  frame++;

  // Compute RMS amplitude for global pulse
  const amp = Math.sqrt(freqData.reduce((sum, v) => sum + v * v, 0) / freqData.length) / 255;

  // --- Game of Life style cellular update ---
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = getIndex(x, y);
      const n = countNeighbors(x, y);
      const alive = grid[i];

      // Audio-driven random flip
      if (Math.random() < amp * 0.05) {
        nextGrid[i] = 1 - alive;
        continue;
      }

      // Conway-inspired rules for organic motion
      if (alive && (n < 2 || n > 3)) nextGrid[i] = 0;
      else if (!alive && n === 3) nextGrid[i] = 1;
      else nextGrid[i] = alive;
    }
  }

  // Swap grids
  [grid, nextGrid] = [nextGrid, grid];

  // --- DRAW CELLS ---
  const hueShift = frame * 0.5;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = getIndex(x, y);
      const val = grid[i];
      const brightness = val ? 50 + amp * 50 : 10 + Math.random() * 5;
      ctx.fillStyle = val
        ? `hsl(${(x + y + hueShift) % 360}, 100%, ${brightness}%)`
        : `rgba(0,0,0,0.15)`;
      ctx.fillRect(x * size, y * size, size, size);
    }
  }

  // --- Optional glow overlay for more magic ---
  ctx.fillStyle = `rgba(0,0,0,${0.05})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

draw();
