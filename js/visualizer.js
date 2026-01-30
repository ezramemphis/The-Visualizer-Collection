// ============================
// CANVAS SETUP
// ============================

export const canvas = document.getElementById("viz");

// decide rendering mode
const rendererMode = canvas?.dataset.renderer || "2d";

// only create 2D context if allowed
export const ctx =
  rendererMode === "2d"
    ? canvas.getContext("2d")
    : null;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// ============================
// AUDIO SETUP
// ============================

export const audio = new Audio();
export const audioCtx = new AudioContext();

export const source = audioCtx.createMediaElementSource(audio);
export const analyser = audioCtx.createAnalyser();

analyser.fftSize = 512;

export const freqData = new Uint8Array(analyser.frequencyBinCount);
export const timeData = new Uint8Array(analyser.fftSize);

source.connect(analyser);
analyser.connect(audioCtx.destination);

// ============================
// UI
// ============================

const playBtn = document.getElementById("play");
const progress = document.getElementById("progress");
const fileInput = document.getElementById("fileInput");

playBtn.onclick = async () => {
  await audioCtx.resume();
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

export function loadFile(file) {
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.load();
}

// Drag & drop
window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("drop", e => {
  e.preventDefault();
  if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
});

canvas.addEventListener("click", () => fileInput.click());
fileInput.onchange = () => loadFile(fileInput.files[0]);

// ============================
// PERFORMANCE MODE (SHIFT + CMD + P)
// ============================

let performanceMode = false;

function enterPerformanceMode() {
  performanceMode = true;
  document.body.classList.add("performance-mode");

  if (!document.fullscreenElement) {
    canvas.requestFullscreen?.().catch(() => {});
  }
}

function exitPerformanceMode() {
  performanceMode = false;
  document.body.classList.remove("performance-mode");

  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
  }
}

window.addEventListener("keydown", e => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");

  const combo =
    e.shiftKey &&
    (isMac ? e.metaKey : e.ctrlKey) &&
    e.key.toLowerCase() === "p";

  if (combo) {
    e.preventDefault();
    performanceMode ? exitPerformanceMode() : enterPerformanceMode();
  }

  if (e.key === "Escape" && performanceMode) {
    exitPerformanceMode();
  }
});
