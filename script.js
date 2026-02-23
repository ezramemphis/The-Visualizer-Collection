// ==========================
// NAVIGATION
// ==========================
document.querySelectorAll(".menu li").forEach(item => {
  item.addEventListener("click", () => {
    const target = item.dataset.target;
    window.location.href = target;
  });

  // Hover sound effect
  item.addEventListener("mouseenter", () => {
    const audio = new Audio("thin_click.wav"); // add your hover sound file path
    audio.volume = 0.5;
    audio.play();
  });
});

// ==========================
// CANVAS SETUP
// ==========================
const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// ==========================
// H1 SUBTLE CRT/VHS EFFECT
// ==========================
const h1 = document.querySelector("h1");

function drawH1CRT() {
  // subtle, ominous glow
  const baseGlow = 1.5 + Math.random() * 1.5; // much lower than before
  const xJitter = (Math.random() - 0.5) * 1.5; // small horizontal jitter
  const yJitter = (Math.random() - 0.5) * 1.5;

  h1.style.textShadow = `
    ${xJitter}px ${yJitter}px ${baseGlow}px #00ffcc,
    ${xJitter/2}px ${yJitter/2}px ${baseGlow/2}px #00ffaa
  `;

  // faint CRT scanlines over H1 on canvas
  const rect = h1.getBoundingClientRect();
  ctx.save();
  ctx.strokeStyle = "rgba(0,255,204,0.08)"; // subtle
  ctx.lineWidth = 1;

  for (let i = 0; i < 2; i++) { // just a couple of faint lines
    const y = rect.top + Math.random() * rect.height;
    ctx.beginPath();
    ctx.moveTo(rect.left, y);
    ctx.lineTo(rect.right, y + (Math.random()*1.5-0.75)); // slight wobble
    ctx.stroke();
  }
  ctx.restore();
}

setInterval(drawH1CRT, 200); // slower, subtle flicker


// ==========================
// AMBIENT CHARACTERS
// ==========================
const CHARS = [];
const CHAR_COUNT = 60;
function randomChar() {
  const chars = "!@#$%^&*<>/?[]{}+=-~☬༒♥✿✪★◇◆◈ ♕♛♔♚♖♗♘♙♜♝♞♤♧♡♢";
  return chars.charAt(Math.floor(Math.random() * chars.length));
}

for (let i=0;i<CHAR_COUNT;i++){
  CHARS.push({
    x: Math.random()*canvas.width,
    y: Math.random()*canvas.height,
    size: 12 + Math.random()*8,
    char: randomChar(),
    speed: 0.2 + Math.random()*0.6,
    opacity: 0.1 + Math.random()*0.25
  });
}

function drawChars() {
  for(let c of CHARS){
    ctx.globalAlpha = c.opacity;
    ctx.fillStyle = "#00ffcc";
    ctx.font = `${c.size}px VT323`;
    ctx.fillText(c.char, c.x, c.y);
    c.y -= c.speed;
    if(c.y < -20){
      c.y = canvas.height + 20;
      c.x = Math.random()*canvas.width;
      c.char = randomChar();
    }
  }
  ctx.globalAlpha = 1;
}

// ==========================
// FLOWER VISUALIZER
// ==========================
let t = 0;
function drawFlower() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  for (let i = 0; i < 120; i++) {
    const angle = i * 0.2 + t;
    const radius = 100 + Math.sin(t + i) * 60;

    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    ctx.fillStyle = `rgba(0,255,200,0.15)`;
    ctx.fillRect(x, y, 2, 2);
  }
  t += 0.01;
}

// ==========================
// MAIN DRAW LOOP
// ==========================
function draw() {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawChars();
  drawFlower();

  requestAnimationFrame(draw);
}

draw();
