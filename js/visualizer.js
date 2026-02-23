// ============================
// CANVAS SETUP
// ============================

export const canvas = document.getElementById("viz");
const rendererMode = canvas?.dataset.renderer || "2d";
export const ctx = rendererMode === "2d" ? canvas.getContext("2d") : null;

let phoneMode = false;

function resizeCanvas() {
  if (!phoneMode) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

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
// UI ELEMENTS
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

window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("drop", e => {
  e.preventDefault();
  if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
});

canvas.addEventListener("click", () => fileInput.click());
fileInput.onchange = () => loadFile(fileInput.files[0]);

// ============================
// PERFORMANCE MODE EXTENSIONS
// ============================

let performanceMode = false;
let recording = false;
let mediaRecorder;
let recordedChunks = [];

// ============================
// PERFORMANCE MODE HANDLERS
// ============================

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

  // exit phone mode if active
  phoneMode = false;
  resizeCanvas();
}

// ============================
// KEYBIND LISTENER
// ============================

window.addEventListener("keydown", async (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");

  // -----------------------------
  // PERFORMANCE MODE: SHIFT+CMD+P
  // -----------------------------
  const combo =
    e.shiftKey &&
    (isMac ? e.metaKey : e.ctrlKey) &&
    e.key.toLowerCase() === "p";

  if (combo) {
    e.preventDefault();
    performanceMode ? exitPerformanceMode() : enterPerformanceMode();
  }

  // -----------------------------
  // RECORD / PRINT VIDEO: L (only in performance)
  // -----------------------------
  if (performanceMode && e.key.toLowerCase() === "l") {
    if (!recording) {
      // create MediaRecorder for canvas + audio
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);

      const combinedStream = new MediaStream([
        ...canvas.captureStream(60).getTracks(),
        ...dest.stream.getTracks()
      ]);

      mediaRecorder = new MediaRecorder(combinedStream, { mimeType: "video/webm" });
      recordedChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "visualizer_recording.webm";
        a.click();
      };

      mediaRecorder.start();
      recording = true;
      console.log("Recording started!");
    } else {
      mediaRecorder.stop();
      recording = false;
      console.log("Recording stopped!");
    }
  }

  // -----------------------------
  // SPACEBAR: PLAY / PAUSE
  // -----------------------------
  if (e.code === "Space") {
    e.preventDefault();
    await audioCtx.resume();
    audio.paused ? audio.play() : audio.pause();
  }

  // -----------------------------
  // ESC: exit performance
  // -----------------------------
  if (e.key === "Escape" && performanceMode) {
    exitPerformanceMode();
  }
});



// ============================
// DEV PANEL TOGGLE
// ============================

export let devPanelActive = false;

// Listen for Shift + Cmd/Ctrl + U to toggle dev panel
window.addEventListener("keydown", (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const combo = e.shiftKey && (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "u";
  if (combo) {
    devPanelActive = !devPanelActive;
  }
});
