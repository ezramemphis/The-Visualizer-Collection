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




// Helps with the preview on the home page
const urlParams = new URLSearchParams(window.location.search);
const isPreview = urlParams.get("preview") === "true";

// 👇 Replace this whole function
function hideUIForPreview() {
  if (!isPreview) return;

  const ui = document.querySelector(".ui");
  const fileInput = document.getElementById("fileInput");

  if (ui) ui.style.display = "none";
  if (fileInput) fileInput.remove();
}

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

// ============================
// UNIVERSAL SCENE EXPORT / IMPORT
// ============================

let registeredSettings = null;

/**
 * Call this from any visualizer:
 * registerSceneSettings(settings);
 */
export function registerSceneSettings(settingsObject) {

  registeredSettings = settingsObject;

  if (!isPreview) {
    createSceneIOButtons();
  }

}

function createSceneIOButtons() {

  // Prevent duplicates
  if (document.getElementById("sceneExportBtn")) return;

  const container = document.createElement("div");

  Object.assign(container.style, {
    position: "fixed",
    bottom: "10px",
    left: "10px",
    zIndex: 10000,
    display: "flex",
    gap: "6px"
  });

  // EXPORT BUTTON
  const exportBtn = document.createElement("button");
  exportBtn.id = "sceneExportBtn";
  exportBtn.textContent = "Export Scene";
  styleButton(exportBtn);

  exportBtn.onclick = () => {
    if (!registeredSettings) return;

    const dataStr = JSON.stringify(registeredSettings, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "scene.json";
    a.click();

    URL.revokeObjectURL(url);
  };

  // IMPORT BUTTON
  const importBtn = document.createElement("button");
  importBtn.textContent = "Import Scene";
  styleButton(importBtn);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json";
  fileInput.style.display = "none";

  importBtn.onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file || !registeredSettings) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);

        // Apply values
        Object.keys(imported).forEach(key => {
          if (registeredSettings.hasOwnProperty(key)) {
            registeredSettings[key] = imported[key];

            // Update matching slider in dev panel
            const slider = document.getElementById(key);
            if (slider) slider.value = imported[key];
          }
        });

      } catch (err) {
        console.error("Invalid scene file.");
      }
    };

    reader.readAsText(file);
  };

  container.appendChild(exportBtn);
  container.appendChild(importBtn);
  container.appendChild(fileInput);

  document.body.appendChild(container);
}

function styleButton(btn) {
  Object.assign(btn.style, {
    padding: "6px 10px",
    background: "rgba(0,0,0,0.8)",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px"
  });
}



//////////////////////////////////////////////////////////
// MULTI-WINDOW VISUALIZER SYNC SYSTEM
//////////////////////////////////////////////////////////

const VIS_SYNC_CHANNEL = new BroadcastChannel("visualizer_sync");

/*
State ownership rule:

- One window is the "writer"
- All windows are "listeners"
- Updates are broadcast immediately
*/

let IS_MASTER_VISUALIZER = true;

/*
Detect master window
First visualizer opened becomes master by default.
*/

const VIS_ID = Math.random().toString(36).slice(2);

/*
State broadcast helper
*/

function broadcastState() {
  VIS_SYNC_CHANNEL.postMessage({
    type: "state_sync",
    id: VIS_ID,
    settings: settings,
    lfoPhase: lfoPhase,
    timestamp: performance.now()
  });
}

/*
Listen for external visualizer updates
*/

VIS_SYNC_CHANNEL.onmessage = e => {

  const data = e.data;

  if (!data) return;

  if (data.type === "state_sync") {

    /*
    Avoid self-feedback loops
    */

    if (data.id === VIS_ID) return;

    IS_MASTER_VISUALIZER = false;

    Object.assign(settings, data.settings);

    lfoPhase = data.lfoPhase;

  }
};

/*
Call this whenever dev panel changes settings
*/

function syncVisualizerState() {
  broadcastState();
}



// =======================================================
// PRELOADED SONG LIBRARY
// =======================================================

const SONG_LIBRARY = [
  {
    title: "Taste",
    artist: "Sabrina Carpenter",
    bpm: 113,
    genre: "pop",
    url: "../music/pop1.mp3"
  },
  {
    title: "24K Magic",
    artist: "Bruno Mars",
    bpm: 107,
    genre: "pop",
    url: "../music/pop2.mp3"
  },
  {
    title: "DAYDREAM",
    artist: "Destin Conrad",
    bpm: 118,
    genre: "rnb",
    url: "../music/rnb1.mp3"
  },
  {
    title: "Digital Love",
    artist: "Daft Punk",
    bpm: 125,
    genre: "electronic",
    url: "../music/electronic1.mp3"
  },
  {
    title: "Husk",
    artist: "Men I Trust",
    bpm: 129,
    genre: "indie",
    url: "../music/indie1.mp3"
  },
  {
    title: "Juna",
    artist: "Clairo",
    bpm: 120,
    genre: "indie",
    url: "../music/juna.mp3"
  },
  {
    title: "Loud",
    artist: "Olivia Dean",
    bpm: 85,
    genre: "pop",
    url: "../music/loud.mp3"
  },
  {
    title: "Older",
    artist: "Lizzy McAlpine",
    bpm: 92,
    genre: "indie",
    url: "../music/older.mp3"
  },
  {
    title: "SUPERMODEL",
    artist: "LAUNDRY DAY",
    bpm: 128,
    genre: "alternative",
    url: "../music/supermodel.mp3"
  },
  {
    title: "DRUM DEMO",
    artist: "Larnell Lewis",
    bpm: 128,
    genre: "jazz",
    url: "../music/drumdemo.mp3"
  },
  {
    title: "ᐳ;0 (ft. vegyn)",
    artist: "Mk.gee",
    bpm: 121,
    genre: "alternative",
    url: "../music/alt1.mp3"
  }
];


// =======================================================
// PLAYLIST UI
// =======================================================

let playlistContainer;
let genreFilterSelect;


// Create UI
function createPlaylistUI() {

  playlistContainer = document.createElement("div");
  genreFilterSelect = document.createElement("select");

  playlistContainer.className = "viz-playlist";

  // Genre filter options
  const genres = [
    "all",
    "pop",
    "rnb",
    "electronic",
    "indie",
    "alternative"
  ];

  genres.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g.toUpperCase();
    genreFilterSelect.appendChild(opt);
  });

  genreFilterSelect.onchange = renderPlaylist;

  document.body.appendChild(genreFilterSelect);
  document.body.appendChild(playlistContainer);

  renderPlaylist();
}


// Render playlist list
function renderPlaylist() {

  if (!playlistContainer) return;

  const filter = genreFilterSelect.value;

  playlistContainer.innerHTML = "";

  const list = SONG_LIBRARY.filter(song => {
    return filter === "all" || song.genre === filter;
  });

  list.forEach(song => {

    const item = document.createElement("div");
    item.className = "viz-song-item";

    item.innerHTML = `
      <div class="viz-song-title">
        ${song.title} - ${song.artist}
      </div>
      <div class="viz-song-meta">
        BPM ${song.bpm} • ${song.genre.toUpperCase()}
      </div>
    `;

    item.onclick = () => {
      loadFileFromURL(song.url);
    };

    playlistContainer.appendChild(item);
  });
}


// Load song from internal library URL
function loadFileFromURL(url) {
  audio.src = url;
  audio.load();
  audio.play();
}


// Initialize UI
if (!isPreview) {
  createPlaylistUI();
}


// =======================================================
// PLAYLIST CSS (Injected)
// =======================================================

const style = document.createElement("style");

style.innerHTML = `

.viz-playlist {
  position: fixed;
  top: 10px;
  right: 10px;

  width: 220px;
  max-height: 320px;
  overflow-y: auto;

  background: rgba(0,0,0,0.75);
  backdrop-filter: blur(6px);

  border-radius: 8px;
  padding: 8px;

  font-family: sans-serif;
  z-index: 9999;
}

.viz-song-item {
  padding: 8px;
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #00ffcc;
}

.viz-song-item:hover {
  background: rgba(0,255,204,0.15);
  transform: translateX(4px);
}

.viz-song-title {
  font-size: 13px;
  font-weight: bold;
}

.viz-song-meta {
  font-size: 11px;
  opacity: 0.7;
}

.viz-playlist::-webkit-scrollbar {
  width: 6px;
}

.viz-playlist::-webkit-scrollbar-thumb {
  background: #00ffcc;
  border-radius: 3px;
}

.viz-playlist select {
  width: 100%;
  margin-bottom: 8px;
  padding: 4px;
  background: black;
  color: #00ffcc;
  border: 1px solid rgba(0,255,204,0.4);
  border-radius: 4px;
}

`;

document.head.appendChild(style);

hideUIForPreview();