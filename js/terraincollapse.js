// ===============================
// VISUALIZER B — FRACTAL TERRAIN ENGINE (STABLE EDITION)
// ===============================

import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let width = canvas.width;
let height = canvas.height;
let frame = 0;

/* ======================================================
 AUDIO HELPER
====================================================== */

function avg(s,e){
  let v = 0;
  const len = Math.max(1,e-s);

  for(let i=s;i<e;i++){
    v += freqData[i] || 0;
  }

  return (v/len)/255;
}

/* ======================================================
 SETTINGS
====================================================== */

let backgroundImage = null;

const settings = {

  terrainScale: 0.1,
  terrainHeight: 80,
  fractalDepth: 3,

  timeFlowSpeed: 0.02,

  lineWidthBase: 1.3,
  bgAlpha: 0.2,

  spectralHueShift: 0.5,

  bassWarpIntensity: 5,
  chaosNoiseStrength: 0,

  vortexPull: 0.0008,
  energyDecay: 0.98,
  spiralTwist: 0.002,
depthPulse: 0.5,
glitchSlices: 0,
};

registerSceneSettings(settings);

/* ======================================================
 RESIZE
====================================================== */

function resize(){
  width = canvas.width;
  height = canvas.height;
}

window.addEventListener("resize", resize);
resize();

/* ======================================================
 DEV PANEL
====================================================== */

let devPanel;

function createDevPanel(){

  devPanel = document.createElement("div");

  Object.assign(devPanel.style,{
    position:"fixed",
    top:"5px",
    left:"5px",
    padding:"8px",
    background:"rgba(0,0,0,0.85)",
    color:"#fff",
    fontFamily:"sans-serif",
    fontSize:"12px",
    borderRadius:"6px",
    zIndex:9999,
    display:"none",
    maxHeight:"95vh",
    overflowY:"auto"
  });

  devPanel.innerHTML = `
  <b>DEV PANEL — FRACTAL TERRAIN</b><hr>
  <b>MAIN</b><hr>

  Terrain Scale <input type="range" id="terrainScale" class="slider-main" min="0.01" max="0.3" step="0.01"><br>
  Terrain Height <input type="range" id="terrainHeight" class="slider-main" min="10" max="200"><br>
  Fractal Depth <input type="range" id="fractalDepth" class="slider-main" min="1" max="8"><br>
  Time Speed <input type="range" id="timeFlowSpeed" class="slider-main" min="0" max="0.1" step="0.001"><br>

  Line Width <input type="range" id="lineWidthBase" class="slider-main" min="0.5" max="5" step="0.1"><br>
  BG Alpha <input type="range" id="bgAlpha" class="slider-main" min="0" max="1" step="0.01"><br>

  <hr><b>EXPERIMENTAL</b><hr>

  Spectral Hue Shift <input type="range" id="spectralHueShift" class="slider-exp" min="0" max="3" step="0.01"><br>
  Bass Warp <input type="range" id="bassWarpIntensity" class="slider-exp" min="0" max="12" step="0.1"><br>
  Chaos Noise <input type="range" id="chaosNoiseStrength" class="slider-exp" min="0" max="0.02" step="0.0005"><br>
  Vortex Pull <input type="range" id="vortexPull" class="slider-exp" min="0" max="0.005" step="0.0001"><br>
  Spiral Twist <input type="range" id="spiralTwist" class="slider-exp" min="0" max="0.02" step="0.0005"><br>
    Depth Pulse <input type="range" id="depthPulse" class="slider-exp" min="0" max="3" step="0.1"><br>
    Glitch Slices <input type="range" id="glitchSlices" class="slider-exp" min="0" max="50" step="1"><br>

  <hr>
  Upload Background Image<br>
  <input type="file" id="bgUpload" accept="image/*">
  `;

  document.body.appendChild(devPanel);

  // Slider binding
  Object.keys(settings).forEach(key=>{
    const el = devPanel.querySelector(`#${key}`);
    if(!el) return;

    el.value = settings[key];

    el.addEventListener("input", e=>{
      settings[key] = parseFloat(e.target.value);
    });
  });

  // Background upload
  const upload = devPanel.querySelector("#bgUpload");

  upload.addEventListener("change", e=>{
    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();

    reader.onload = ev=>{
      const img = new Image();
      img.onload = ()=> backgroundImage = img;
      img.src = ev.target.result;
    };

    reader.readAsDataURL(file);
  });
}

createDevPanel();

/* ======================================================
 TERRAIN ENGINE
====================================================== */

function draw(){

  requestAnimationFrame(draw);
  frame++;

  if(devPanel)
    devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);

  const bass = avg(0,20);
  const high = avg(90,180);

  /* Trail fade background */
  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0,0,width,height);

  const grid = 120;
  const stepX = width / grid;
  const stepY = height / grid;

  ctx.save();
  ctx.translate(width/2,height/2);
  ctx.globalCompositeOperation = "lighter";

  frame += settings.timeFlowSpeed * 100;

  for(let y=-grid/2;y<grid/2;y++){

    ctx.beginPath();

    for(let x=-grid/2;x<grid/2;x++){

      const nx = x * settings.terrainScale;
      const ny = y * settings.terrainScale;

      /* Harmonic wavefield */
      let field =
        Math.sin(nx + frame*settings.timeFlowSpeed) +
        Math.cos(ny + frame*0.013);

      /* Fractal layering */
      let fractal = 0;

      for(let k=1;k<=settings.fractalDepth;k++){
        fractal +=
          Math.sin(nx*k*2 + frame*0.01*k) +
          Math.cos(ny*k*3 + frame*0.008*k);
      }

      fractal /= Math.max(1,settings.fractalDepth);

      /* Smooth bass warp deformation */
      const radius = Math.sqrt(x*x + y*y);

      const bassWarp =
        Math.sin(radius*0.0008 + frame*0.01)
        * bass
        * settings.bassWarpIntensity;

      /* Slow chaos turbulence */
      const chaos =
        (Math.sin(frame*0.003 + x*0.2 + y*0.15))
        * settings.chaosNoiseStrength * 200;

      const terrain =
        (field + fractal)
        * settings.terrainHeight
        * high
        + bassWarp
        + chaos;

      const px = x*stepX;
      const py = y*stepY - terrain;

      if(x===-grid/2) ctx.moveTo(px,py);
      else ctx.lineTo(px,py);
    }

    const hue =
      frame*settings.spectralHueShift + y*6;

    ctx.strokeStyle =
      `hsla(${hue%360},85%,60%,${high+0.25})`;

    ctx.lineWidth =
      settings.lineWidthBase + high*2;

    ctx.stroke();
  }

  ctx.restore();
}

draw();