const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

/* =========================
   AUDIO SETUP
========================= */

const audioCtx = new AudioContext();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;

const freqData = new Uint8Array(analyser.frequencyBinCount);
const timeData = new Uint8Array(analyser.fftSize);

/* =========================
   SCENE LIST
========================= */

const scenePaths = [
  "/zen/terraincollapse.js",
  "/zen/thevortex.js"
  // add 30+ here
];

/* =========================
   STATE
========================= */

let currentScene = null;
let nextScene = null;

let fadeProgress = 0;      // 0 = new scene invisible, 1 = fully visible
let fadeDuration = 3;      // seconds
let holdDuration = 15;     // seconds per scene
let sceneTimer = 0;

let fadeIn = true;         // first scene fade-in

/* =========================
   LOAD SCENE
========================= */

async function loadScene(path) {
  const module = await import(path + "?t=" + Date.now());
  return module;
}

/* =========================
   SWITCH SCENE
========================= */

async function switchScene() {
  const path = scenePaths[Math.floor(Math.random() * scenePaths.length)];
  nextScene = await loadScene(path);

  if (nextScene.init) nextScene.init({ ctx, canvas, analyser, freqData, timeData });

  fadeProgress = 0;
}

/* =========================
   MAIN LOOP
========================= */

let last = performance.now();

function loop(now) {
  requestAnimationFrame(loop);

  const dt = (now - last) / 1000;
  last = now;

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  sceneTimer += dt;

  // Start fade-in for the first scene
  if (!currentScene) {
    if (!nextScene) switchScene();
    fadeProgress += dt / fadeDuration;
    if (fadeProgress >= 1) {
      currentScene = nextScene;
      nextScene = null;
      fadeProgress = 1;
      fadeIn = false;
      sceneTimer = 0;
    }
  } else {
    // Hold + fade logic
    if (sceneTimer > holdDuration && !nextScene) {
      sceneTimer = 0;
      switchScene();
    }

    // Advance fade if there’s a next scene
    if (nextScene) {
      fadeProgress += dt / fadeDuration;
      if (fadeProgress >= 1) {
        currentScene?.destroy?.();
        currentScene = nextScene;
        nextScene = null;
        fadeProgress = 1;
      }
    }
  }

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Render current scene with proper alpha
  if (currentScene) {
    ctx.save();
    ctx.globalAlpha = fadeIn ? fadeProgress : 1 - (nextScene ? fadeProgress : 0);
    currentScene.update?.(dt);
    currentScene.render?.();
    ctx.restore();
  }

  // Render next scene on top
  if (nextScene) {
    ctx.save();
    ctx.globalAlpha = fadeProgress;
    nextScene.update?.(dt);
    nextScene.render?.();
    ctx.restore();
  }
}

/* =========================
   START LOOP
========================= */

switchScene();
loop(performance.now());