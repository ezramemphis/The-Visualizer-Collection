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

const urlParams = new URLSearchParams(window.location.search);
const isPreview = urlParams.get("preview") === "true";

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
  phoneMode = false;
  resizeCanvas();
}

window.addEventListener("keydown", async (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");

  // Keyboard toggle: P
window.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "p") {
    e.preventDefault();
    performanceMode ? exitPerformanceMode() : enterPerformanceMode();
  }
});

  if (performanceMode && e.key.toLowerCase() === "l") {
    if (!recording) {
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
    } else {
      mediaRecorder.stop();
      recording = false;
    }
  }

  if (e.code === "Space") {
    e.preventDefault();
    await audioCtx.resume();
    audio.paused ? audio.play() : audio.pause();
  }

  if (e.key === "Escape" && performanceMode) {
    exitPerformanceMode();
  }
});

// ============================
// DEV PANEL TOGGLE
// ============================

export let devPanelActive = false;

// Keyboard toggle: U
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "u") {
    devPanelActive = !devPanelActive;
  }
});

// ============================
// DETACHABLE DEV PANEL SYSTEM
// ============================

/*
  HOW THE DETACH SYSTEM WORKS:
  ─────────────────────────────
  1. A "Detach Panel →" button is appended to every dev panel.
  2. On click, window.open() spawns a minimal blank popup window.
  3. We inject a full HTML document into that popup that:
     - Mirrors all current slider values from the main window
     - Posts messages back to the opener via postMessage whenever a slider changes
  4. The main window listens for those messages and applies them to `settings`.
  5. The popup also receives "settings_sync" messages from the main window
     so the sliders stay live if the main window updates them too.
  6. If the popup is closed, the detach button resets to "Detach Panel →".

  Usage from each visualizer:
     Call attachDetachButton(devPanel, settings) after building your dev panel.
*/

let detachedWindow = null;
let detachBtn = null;

/**
 * Attach a "Detach Panel" button to a dev panel div.
 * @param {HTMLElement} panelEl  — the dev panel container
 * @param {Object}      settings — the settings object to sync
 */
export function attachDetachButton(panelEl, settings) {

  // Remove any previous button if re-called
  const existing = panelEl.querySelector(".detach-btn");
  if (existing) existing.remove();

  detachBtn = document.createElement("button");
  detachBtn.className = "detach-btn";
  detachBtn.textContent = "⬡ Detach Panel →";

  Object.assign(detachBtn.style, {
    display: "block",
    width: "100%",
    marginTop: "10px",
    padding: "7px 0",
    background: "linear-gradient(90deg,#00ffcc22,#7b2fff22)",
    border: "1px solid #00ffcc66",
    borderRadius: "4px",
    color: "#00ffcc",
    fontFamily: "monospace",
    fontSize: "11px",
    letterSpacing: "0.08em",
    cursor: "pointer",
    transition: "all 0.2s"
  });

  detachBtn.onmouseenter = () => {
    detachBtn.style.background = "linear-gradient(90deg,#00ffcc44,#7b2fff44)";
  };
  detachBtn.onmouseleave = () => {
    detachBtn.style.background = "linear-gradient(90deg,#00ffcc22,#7b2fff22)";
  };

  detachBtn.onclick = () => {

    // If already detached and open, focus it
    if (detachedWindow && !detachedWindow.closed) {
      detachedWindow.focus();
      return;
    }

    // Serialize the panel HTML (sliders) and current settings
    const panelHTML = panelEl.innerHTML;
    const settingsJSON = JSON.stringify(settings);

    // Open a popup window — user can drag to second screen
    detachedWindow = window.open(
      "",
      "DevPanel_" + Date.now(),
      "width=280,height=900,resizable=yes,scrollbars=yes"
    );

    if (!detachedWindow) {
      alert("Popup blocked! Please allow popups for this site to detach the panel.");
      return;
    }

    // Build the popup document
    const popupDoc = detachedWindow.document;
    popupDoc.open();
    popupDoc.write(`<!DOCTYPE html>
<html>
<head>
  <title>Dev Panel — Detached</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0a0f;
      color: #e0e0f0;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 10px;
      min-height: 100vh;
    }
    h2 {
      font-size: 11px;
      letter-spacing: 0.15em;
      color: #00ffcc;
      text-transform: uppercase;
      border-bottom: 1px solid #00ffcc44;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    hr {
      border: none;
      border-top: 1px solid #ffffff18;
      margin: 8px 0;
    }
    b {
      color: #7b8fff;
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    label { display: block; margin: 4px 0 2px; color: #aaa; font-size: 11px; }
    input[type="range"] {
      width: 100%;
      accent-color: #00ffcc;
      cursor: pointer;
      height: 4px;
    }
    .panel-wrap {
      /* Inherit inner HTML from main panel */
    }
    .detach-btn { display: none !important; }
    .status-bar {
      position: sticky;
      top: 0;
      background: #0a0a0f;
      padding: 6px 0 8px;
      border-bottom: 1px solid #00ffcc33;
      margin-bottom: 8px;
      font-size: 10px;
      color: #00ffcc99;
      letter-spacing: 0.1em;
    }
    .pulse {
      display: inline-block;
      width: 6px; height: 6px;
      background: #00ffcc;
      border-radius: 50%;
      margin-right: 6px;
      animation: pulse 1s infinite;
    }
    @keyframes pulse {
      0%,100% { opacity: 1; }
      50% { opacity: 0.2; }
    }
  </style>
</head>
<body>
  <div class="status-bar"><span class="pulse"></span>LIVE SYNC — DETACHED PANEL</div>
  <div class="panel-wrap" id="panelWrap">${panelHTML}</div>
  <script>
    const settings = ${settingsJSON};
    const panelWrap = document.getElementById("panelWrap");

    // Remove detach button if it ended up in the clone
    const detachClone = panelWrap.querySelector(".detach-btn");
    if (detachClone) detachClone.remove();

    // Set all slider values from settings
    Object.keys(settings).forEach(key => {
      const el = panelWrap.querySelector("#" + key);
      if (el) el.value = settings[key];
    });

    // When any slider changes, post message to opener
    panelWrap.addEventListener("input", e => {
      if (e.target.type === "range") {
        const key = e.target.id;
        const val = parseFloat(e.target.value);
        settings[key] = val;
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: "devpanel_update", key, val }, "*");
        }
      }
    });

    // Receive sync FROM main window (if main panel also changes)
    window.addEventListener("message", e => {
      if (!e.data || e.data.type !== "settings_sync") return;
      const { key, val } = e.data;
      const el = panelWrap.querySelector("#" + key);
      if (el) el.value = val;
      settings[key] = val;
    });

    // Notify on close
    window.addEventListener("beforeunload", () => {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "devpanel_closed" }, "*");
      }
    });
  <\/script>
</body>
</html>`);
    popupDoc.close();

    detachBtn.textContent = "⬡ Panel Detached ✓";
    detachBtn.style.color = "#7b2fff";
    detachBtn.style.borderColor = "#7b2fff66";

    // Poll for popup close to reset the button
    const pollClose = setInterval(() => {
      if (!detachedWindow || detachedWindow.closed) {
        clearInterval(pollClose);
        detachedWindow = null;
        if (detachBtn) {
          detachBtn.textContent = "⬡ Detach Panel →";
          detachBtn.style.color = "#00ffcc";
          detachBtn.style.borderColor = "#00ffcc66";
        }
      }
    }, 500);
  };

  panelEl.appendChild(detachBtn);

  // Listen for messages from the detached popup
  window.addEventListener("message", (e) => {
    if (!e.data) return;

    if (e.data.type === "devpanel_update") {
      const { key, val } = e.data;
      if (key in settings) {
        settings[key] = val;
        // Update the local dev panel slider if visible
        const localEl = panelEl.querySelector(`#${key}`);
        if (localEl) localEl.value = val;
      }
    }

    if (e.data.type === "devpanel_closed") {
      detachedWindow = null;
      if (detachBtn) {
        detachBtn.textContent = "⬡ Detach Panel →";
        detachBtn.style.color = "#00ffcc";
        detachBtn.style.borderColor = "#00ffcc66";
      }
    }
  });
}

// ============================
// UNIVERSAL SCENE EXPORT / IMPORT
// ============================

let registeredSettings = null;

export function registerSceneSettings(settingsObject) {
  registeredSettings = settingsObject;
  if (!isPreview) {
    createSceneIOButtons();
  }
}

function createSceneIOButtons() {
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

  const importBtn = document.createElement("button");
  importBtn.textContent = "Import Scene";
  styleButton(importBtn);

  const fi = document.createElement("input");
  fi.type = "file";
  fi.accept = "application/json";
  fi.style.display = "none";

  importBtn.onclick = () => fi.click();

  fi.onchange = (e) => {
    const file = e.target.files[0];
    if (!file || !registeredSettings) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        Object.keys(imported).forEach(key => {
          if (registeredSettings.hasOwnProperty(key)) {
            registeredSettings[key] = imported[key];
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
  container.appendChild(fi);
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

// ============================
// MULTI-WINDOW SYNC SYSTEM
// ============================

const VIS_SYNC_CHANNEL = new BroadcastChannel("visualizer_sync");
let IS_MASTER_VISUALIZER = true;
const VIS_ID = Math.random().toString(36).slice(2);

export let lfoPhase = 0;

function broadcastState() {
  VIS_SYNC_CHANNEL.postMessage({
    type: "state_sync",
    id: VIS_ID,
    settings: registeredSettings,
    lfoPhase,
    timestamp: performance.now()
  });
}

VIS_SYNC_CHANNEL.onmessage = e => {
  const data = e.data;
  if (!data) return;
  if (data.type === "state_sync") {
    if (data.id === VIS_ID) return;
    IS_MASTER_VISUALIZER = false;
    if (registeredSettings) Object.assign(registeredSettings, data.settings);
    lfoPhase = data.lfoPhase;
  }
};

export function syncVisualizerState() {
  broadcastState();
}

// ============================
// UNIVERSAL FX FILTER OVERLAY
// ============================

/*
  20 post-processing filters that can be toggled globally on any visualizer.
  They operate on the canvas after each frame via a separate overlay canvas.
  Each visualizer should call initFxFilters() once.
*/

export const FX_FILTERS = {
  chromaticAberration: false,
  scanlines:           false,
  vhsGlitch:           false,
  filmGrain:           false,
  colorInvert:         false,
  pixelate:            false,
  kaleidoscope:        false,
  edgeDetect:          false,
  heatmap:             false,
  neon:                false,
  duotone:             false,
  retroCRT:            false,
  mirrorSplit:         false,
  rgbShift:            false,
  oldPhoto:            false,
  posterize:           false,
  colorChannel_R:      false,
  colorChannel_G:      false,
  colorChannel_B:      false,
  strobeFlash:         false,
};

let fxCanvas, fxCtx;
let fxPanelEl = null;
let fxFrame = 0;

export function initFxFilters() {

  // Overlay canvas
  fxCanvas = document.createElement("canvas");
  fxCanvas.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    pointer-events:none;z-index:5000;
  `;
  document.body.appendChild(fxCanvas);
  fxCtx = fxCanvas.getContext("2d");

  function resizeFx() {
    fxCanvas.width  = window.innerWidth;
    fxCanvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeFx);
  resizeFx();

  // FX Panel UI
  fxPanelEl = document.createElement("div");
  Object.assign(fxPanelEl.style, {
    position: "fixed",
    top: "5px",
    right: "240px",
    background: "rgba(5,5,15,0.92)",
    border: "1px solid #ffffff18",
    borderRadius: "8px",
    padding: "10px",
    color: "#fff",
    fontFamily: "monospace",
    fontSize: "11px",
    zIndex: 10001,
    display: "none",
    minWidth: "180px",
    maxHeight: "95vh",
    overflowY: "auto",
    backdropFilter: "blur(12px)"
  });

  fxPanelEl.innerHTML = `
    <div style="color:#ff6af0;font-weight:bold;letter-spacing:0.1em;margin-bottom:8px;font-size:12px">
      ⬡ FX FILTERS
    </div>
    ${Object.keys(FX_FILTERS).map(key => `
      <label style="display:flex;align-items:center;gap:8px;margin:5px 0;cursor:pointer;">
        <input type="checkbox" id="fx_${key}" style="accent-color:#ff6af0">
        <span style="color:#ccc">${key.replace(/([A-Z])/g,' $1').trim()}</span>
      </label>
    `).join("")}
  `;

  document.body.appendChild(fxPanelEl);

  // Wire checkboxes
  Object.keys(FX_FILTERS).forEach(key => {
    const cb = fxPanelEl.querySelector(`#fx_${key}`);
    if (cb) {
      cb.checked = FX_FILTERS[key];
      cb.addEventListener("change", () => {
        FX_FILTERS[key] = cb.checked;
      });
    }
  });

  // Toggle FX panel with Shift+Cmd/Ctrl+F
  window.addEventListener("keydown", (e) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const combo = e.shiftKey && (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "f";
    if (combo) {
      fxPanelEl.style.display = fxPanelEl.style.display === "none" ? "block" : "none";
    }
  });

  // FX render loop
  function renderFx() {
    requestAnimationFrame(renderFx);
    fxFrame++;

    const W = fxCanvas.width;
    const H = fxCanvas.height;
    fxCtx.clearRect(0, 0, W, H);

    if (FX_FILTERS.scanlines) {
      fxCtx.fillStyle = "rgba(0,0,0,0)";
      for (let y = 0; y < H; y += 4) {
        fxCtx.fillStyle = "rgba(0,0,0,0.18)";
        fxCtx.fillRect(0, y, W, 2);
      }
    }

    if (FX_FILTERS.filmGrain) {
      for (let i = 0; i < 3000; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const a = Math.random() * 0.15;
        fxCtx.fillStyle = `rgba(255,255,255,${a})`;
        fxCtx.fillRect(x, y, 1, 1);
      }
    }

    if (FX_FILTERS.vhsGlitch && Math.random() < 0.08) {
      for (let i = 0; i < 5; i++) {
        const gy = Math.random() * H;
        const gh = Math.random() * 6 + 1;
        fxCtx.fillStyle = `rgba(${Math.random()*255|0},${Math.random()*50|0},${Math.random()*255|0},0.25)`;
        fxCtx.fillRect(0, gy, W, gh);
      }
    }

    if (FX_FILTERS.colorInvert) {
      fxCtx.fillStyle = "rgba(255,255,255,1)";
      fxCtx.globalCompositeOperation = "difference";
      fxCtx.fillRect(0, 0, W, H);
      fxCtx.globalCompositeOperation = "source-over";
    }

    if (FX_FILTERS.retroCRT) {
      // Vignette
      const vGrad = fxCtx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.75);
      vGrad.addColorStop(0, "rgba(0,0,0,0)");
      vGrad.addColorStop(1, "rgba(0,0,0,0.6)");
      fxCtx.fillStyle = vGrad;
      fxCtx.fillRect(0, 0, W, H);
      // Curvature lines
      fxCtx.strokeStyle = "rgba(255,255,255,0.03)";
      fxCtx.lineWidth = 1;
      for (let y = 0; y < H; y += 3) {
        fxCtx.beginPath();
        fxCtx.moveTo(0, y);
        fxCtx.lineTo(W, y);
        fxCtx.stroke();
      }
    }

    if (FX_FILTERS.neon) {
      const ng = fxCtx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.min(W,H)*0.5);
      ng.addColorStop(0, "rgba(0,255,180,0.04)");
      ng.addColorStop(1, "rgba(0,0,0,0)");
      fxCtx.fillStyle = ng;
      fxCtx.fillRect(0, 0, W, H);
    }

    if (FX_FILTERS.duotone) {
      fxCtx.fillStyle = "rgba(120,0,220,0.10)";
      fxCtx.globalCompositeOperation = "multiply";
      fxCtx.fillRect(0, 0, W, H);
      fxCtx.fillStyle = "rgba(0,220,180,0.06)";
      fxCtx.fillRect(0, 0, W/2, H);
      fxCtx.globalCompositeOperation = "source-over";
    }

    if (FX_FILTERS.strobeFlash && fxFrame % 8 === 0) {
      fxCtx.fillStyle = "rgba(255,255,255,0.04)";
      fxCtx.fillRect(0, 0, W, H);
    }

    if (FX_FILTERS.oldPhoto) {
      fxCtx.fillStyle = "rgba(180,140,80,0.12)";
      fxCtx.globalCompositeOperation = "multiply";
      fxCtx.fillRect(0, 0, W, H);
      fxCtx.globalCompositeOperation = "source-over";
    }

    if (FX_FILTERS.colorChannel_R) {
      fxCtx.fillStyle = "rgba(255,0,0,0.08)";
      fxCtx.globalCompositeOperation = "screen";
      fxCtx.fillRect(0, 0, W, H);
      fxCtx.globalCompositeOperation = "source-over";
    }
    if (FX_FILTERS.colorChannel_G) {
      fxCtx.fillStyle = "rgba(0,255,80,0.08)";
      fxCtx.globalCompositeOperation = "screen";
      fxCtx.fillRect(0, 0, W, H);
      fxCtx.globalCompositeOperation = "source-over";
    }
    if (FX_FILTERS.colorChannel_B) {
      fxCtx.fillStyle = "rgba(0,80,255,0.08)";
      fxCtx.globalCompositeOperation = "screen";
      fxCtx.fillRect(0, 0, W, H);
      fxCtx.globalCompositeOperation = "source-over";
    }

    // mirrorSplit, pixelate, etc. would need direct canvas pixel manipulation
    // These are implemented as CSS filter hacks on the main canvas for perf
    if (FX_FILTERS.mirrorSplit) {
      canvas.style.transform = canvas.style.transform.includes("scaleX")
        ? "" : "";
      // Draw mirrored left half over right
      fxCtx.save();
      fxCtx.translate(W, 0);
      fxCtx.scale(-1, 1);
      fxCtx.drawImage(canvas, 0, 0, W/2, H, 0, 0, W/2, H);
      fxCtx.restore();
    }

    if (FX_FILTERS.rgbShift) {
      fxCtx.globalAlpha = 0.12;
      fxCtx.globalCompositeOperation = "screen";
      fxCtx.drawImage(canvas, 3, 0);
      fxCtx.drawImage(canvas, -3, 0);
      fxCtx.globalAlpha = 1;
      fxCtx.globalCompositeOperation = "source-over";
    }

    // CSS-based filters applied to main canvas
    let cssFilter = "";
    if (FX_FILTERS.chromaticAberration) cssFilter += "blur(0.3px) ";
    if (FX_FILTERS.pixelate) canvas.style.imageRendering = "pixelated";
    else canvas.style.imageRendering = "";
    if (FX_FILTERS.edgeDetect) cssFilter += "contrast(3) brightness(0.3) ";
    if (FX_FILTERS.heatmap) cssFilter += "hue-rotate(180deg) saturate(3) ";
    if (FX_FILTERS.posterize) cssFilter += "contrast(2) saturate(2) ";
    if (FX_FILTERS.kaleidoscope) cssFilter += "hue-rotate(" + (fxFrame*0.5) + "deg) ";
    canvas.style.filter = cssFilter;
  }

  renderFx();
}


// =======================================================
// PRELOADED SONG LIBRARY
// =======================================================

const SONG_LIBRARY = [
  { title: "AllforNothing Chop", artist: "Ezra Bennett", bpm: 84,  genre: "experimental", url: "../music/ezra/all-for-nothing-chop.wav" },
  { title: "24K Magic",          artist: "Bruno Mars",   bpm: 107, genre: "pop",          url: "../music/pop2.mp3" },
  { title: "DAYDREAM",           artist: "Destin Conrad",bpm: 118, genre: "rnb",          url: "../music/rnb1.mp3" },
  { title: "Digital Love",       artist: "Daft Punk",    bpm: 125, genre: "electronic",   url: "../music/electronic1.mp3" },
  { title: "Husk",               artist: "Men I Trust",  bpm: 129, genre: "indie",        url: "../music/indie1.mp3" },
  { title: "Juna",               artist: "Clairo",       bpm: 120, genre: "indie",        url: "../music/juna.mp3" },
  { title: "Loud",               artist: "Olivia Dean",  bpm: 85,  genre: "pop",          url: "../music/loud.mp3" },
  { title: "Older",              artist: "Lizzy McAlpine",bpm:92,  genre: "indie",        url: "../music/older.mp3" },
  { title: "SUPERMODEL",         artist: "LAUNDRY DAY",  bpm: 128, genre: "alternative",  url: "../music/supermodel.mp3" },
  { title: "DRUM DEMO",          artist: "Larnell Lewis", bpm: 128, genre: "jazz",        url: "../music/drumdemo.mp3" },
  { title: "ᐳ;0 (ft. vegyn)",   artist: "Mk.gee",       bpm: 121, genre: "alternative",  url: "../music/alt1.mp3" }
];

let playlistContainer;
let genreFilterSelect;

function createPlaylistUI() {
  playlistContainer = document.createElement("div");
  genreFilterSelect = document.createElement("select");
  playlistContainer.className = "viz-playlist";

  const genres = ["all","pop","rnb","electronic","indie","alternative","experimental","jazz"];
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

function renderPlaylist() {
  if (!playlistContainer) return;
  const filter = genreFilterSelect.value;
  playlistContainer.innerHTML = "";
  SONG_LIBRARY.filter(s => filter === "all" || s.genre === filter).forEach(song => {
    const item = document.createElement("div");
    item.className = "viz-song-item";
    item.innerHTML = `
      <div class="viz-song-title">${song.title} — ${song.artist}</div>
      <div class="viz-song-meta">BPM ${song.bpm} • ${song.genre.toUpperCase()}</div>
    `;
    item.onclick = () => { audio.src = song.url; audio.load(); audio.play(); };
    playlistContainer.appendChild(item);
  });
}

if (!isPreview) createPlaylistUI();

// ============================
// PLAYLIST + GLOBAL CSS
// ============================

const style = document.createElement("style");
style.innerHTML = `
.viz-playlist {
  position:fixed;top:10px;right:10px;width:220px;max-height:320px;overflow-y:auto;
  background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);border-radius:8px;
  padding:8px;font-family:sans-serif;z-index:9999;
}
.viz-song-item {
  padding:8px;border-radius:6px;margin-bottom:6px;cursor:pointer;
  transition:all 0.2s;color:#00ffcc;
}
.viz-song-item:hover { background:rgba(0,255,204,0.15);transform:translateX(4px); }
.viz-song-title { font-size:13px;font-weight:bold; }
.viz-song-meta  { font-size:11px;opacity:0.7; }
.viz-playlist::-webkit-scrollbar { width:6px; }
.viz-playlist::-webkit-scrollbar-thumb { background:#00ffcc;border-radius:3px; }
.viz-playlist select {
  width:100%;margin-bottom:8px;padding:4px;background:black;
  color:#00ffcc;border:1px solid rgba(0,255,204,0.4);border-radius:4px;
}
`;
document.head.appendChild(style);

hideUIForPreview();