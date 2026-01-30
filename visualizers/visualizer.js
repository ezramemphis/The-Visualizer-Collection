// ============================
// CANVAS SETUP
// ============================
const canvas = document.getElementById("viz");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// ============================
// AUDIO SETUP
// ============================
let audio = new Audio();
let ctxAudio = new AudioContext();
let source = ctxAudio.createMediaElementSource(audio);
let analyser = ctxAudio.createAnalyser();

analyser.fftSize = 256;
const data = new Uint8Array(analyser.frequencyBinCount);

source.connect(analyser);
analyser.connect(ctxAudio.destination);

// ============================
// UI ELEMENTS
// ============================
const playBtn = document.getElementById("play");
const progress = document.getElementById("progress");
const fileInput = document.getElementById("fileInput");

const titleEl = document.getElementById("title");
const artistEl = document.getElementById("artist");
const albumEl = document.getElementById("album");
const coverEl = document.getElementById("cover");

// ============================
// PLAY / PAUSE
// ============================
playBtn.onclick = async () => {
  await ctxAudio.resume();
  audio.paused ? audio.play() : audio.pause();
};

audio.ontimeupdate = () => {
  progress.value = audio.currentTime / audio.duration || 0;
};

progress.oninput = () => {
  audio.currentTime = progress.value * audio.duration;
};

// ============================
// FILE LOADING
// ============================
function loadFile(file) {
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.load();

  extractMetadata(file);
  localStorage.setItem("lastTrack", url);
}

// Drag & Drop
window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("drop", e => {
  e.preventDefault();
  if (e.dataTransfer.files[0]) {
    loadFile(e.dataTransfer.files[0]);
  }
});

// Click to upload
canvas.addEventListener("click", () => fileInput.click());
fileInput.onchange = () => loadFile(fileInput.files[0]);

// ============================
// METADATA EXTRACTION
// ============================
async function extractMetadata(file) {
  titleEl.textContent = file.name;
  artistEl.textContent = "";
  albumEl.textContent = "";
  coverEl.src = "";

  if (window.jsmediatags) {
    jsmediatags.read(file, {
      onSuccess: tag => {
        titleEl.textContent = tag.tags.title || file.name;
        artistEl.textContent = tag.tags.artist || "";
        albumEl.textContent = tag.tags.album || "";

        if (tag.tags.picture) {
          const { data, format } = tag.tags.picture;
          const blob = new Blob([new Uint8Array(data)], { type: format });
          coverEl.src = URL.createObjectURL(blob);
        }
      }
    });
  }
}

// ============================
// SPECTRUM GRID VISUALIZER
// ============================
function draw() {
  requestAnimationFrame(draw);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  analyser.getByteFrequencyData(data);

  const cols = 16;
  const rows = 8;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  let i = 0;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = data[i++] / 255;
      const glow = Math.floor(v * 255);

      ctx.fillStyle = `rgb(0,${glow},${glow})`;
      ctx.fillRect(
        x * cellW,
        canvas.height - (y + 1) * cellH,
        cellW - 4,
        cellH * v
      );
    }
  }
}

draw();
