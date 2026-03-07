// ===============================
// VISUALIZER B — FRACTAL TERRAIN ENGINE (COLOR + TRUE VORTEX EDITION)
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
  for(let i=s;i<e;i++) v += freqData[i] || 0;
  return (v/len)/255;
}

/* ======================================================
 SETTINGS
====================================================== */

const settings = {

  // main
  terrainScale: 0.1,
  terrainHeight: 80,
  fractalDepth: 3,
  timeFlowSpeed: 0.005,
  lineWidthBase: 1.3,
  bgAlpha: 0.15,

  // COLOR SYSTEM
  oneColorMode: 0,
  singleHue: 200,
  spectralHueShift: 0.5,
  hueMin: 0,
  hueMax: 360,

  // deformation
  bassWarpIntensity: 6,
  chaosNoiseStrength: 0.005,
  vortexPull: 0.002,
  spiralTwist: 0.004,
  depthPulse: 1,
  glitchSlices: 0
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
  <b>FRACTAL TERRAIN</b><hr>

  Terrain Scale <input type="range" id="terrainScale" class="slider-main" min="0.01" max="0.3" step="0.01"><br>
  Terrain Height <input type="range" id="terrainHeight" class="slider-main" min="10" max="200"><br>
  Fractal Depth <input type="range" id="fractalDepth" class="slider-main" min="1" max="8"><br>
  Time Speed <input type="range" id="timeFlowSpeed" class="slider-main" min="0" max="0.1" step="0.001"><br>
  Line Width <input type="range" id="lineWidthBase" class="slider-main" min="0.5" max="5" step="0.1"><br>
  BG Alpha <input type="range" id="bgAlpha" class="slider-main" min="0" max="1" step="0.01"><br>

  <hr><b>COLOR</b><hr>

  One Color Mode <input type="range" id="oneColorMode" class="slider-main" min="0" max="1" step="1"><br>
  Single Hue <input type="range" id="singleHue" class="slider-main" min="0" max="360"><br>
  Hue Shift Speed <input type="range" id="spectralHueShift" class="slider-main" min="0" max="3" step="0.01"><br>

  Hue Range Start <input type="range" id="hueMin" class="slider-main" min="0" max="360"><br>
  Hue Range End <input type="range" id="hueMax" class="slider-main" min="0" max="360"><br>

  <hr><b>DEFORMATION</b><hr>

  Bass Warp <input type="range" id="bassWarpIntensity" class="slider-exp" min="0" max="15" step="0.1"><br>
  Chaos Noise <input type="range" id="chaosNoiseStrength" class="slider-exp" min="0" max="0.03" step="0.0005"><br>
  Vortex Pull <input type="range" id="vortexPull" class="slider-exp" min="0" max="0.01" step="0.0001"><br>
  Spiral Twist <input type="range" id="spiralTwist" class="slider-exp" min="0" max="0.02" step="0.0005"><br>
  Depth Pulse <input type="range" id="depthPulse" class="slider-exp" min="0" max="4" step="0.1"><br>
  Glitch Slices <input type="range" id="glitchSlices" class="slider-exp" min="0" max="60" step="1"><br>
  `;

  document.body.appendChild(devPanel);

  Object.keys(settings).forEach(key=>{
    const el = devPanel.querySelector(`#${key}`);
    if(!el) return;
    el.value = settings[key];
    el.addEventListener("input", e=>{
      settings[key] = parseFloat(e.target.value);
    });
  });
}

createDevPanel();

/* ======================================================
 DRAW
====================================================== */

function draw(){

  requestAnimationFrame(draw);

  if(devPanel)
    devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);

  const bass = avg(0,20);
  const high = avg(90,180);

  frame += settings.timeFlowSpeed * 100;

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0,0,width,height);

  const grid = 120;
  const stepX = width / grid;
  const stepY = height / grid;

  ctx.save();
  ctx.translate(width/2,height/2);
  ctx.globalCompositeOperation = "lighter";

  for(let y=-grid/2;y<grid/2;y++){

    ctx.beginPath();

    for(let x=-grid/2;x<grid/2;x++){

      const nx = x * settings.terrainScale;
      const ny = y * settings.terrainScale;

      let field =
        Math.sin(nx + frame*0.02) +
        Math.cos(ny + frame*0.013);

      let fractal = 0;
      for(let k=1;k<=settings.fractalDepth;k++){
        fractal +=
          Math.sin(nx*k*2 + frame*0.01*k) +
          Math.cos(ny*k*3 + frame*0.008*k);
      }
      fractal /= settings.fractalDepth;

      const radius = Math.sqrt(x*x + y*y);
      const angle = Math.atan2(y,x);

      /* BASS WAVE */
      const bassWarp =
        Math.sin(radius*0.05 - frame*0.1)
        * bass
        * settings.bassWarpIntensity
        * 30;

      /* CHAOS */
      const chaos =
        (Math.sin(x*0.6 + frame*0.4) *
         Math.cos(y*0.5 - frame*0.3))
        * settings.chaosNoiseStrength
        * 1500;

      /* TRUE VORTEX (SINKING GRAVITY WELL) */
      const vortexStrength =
        settings.vortexPull * (1 + bass*5);

      const inwardPull =
        vortexStrength * radius;

      const warpedRadius =
        radius - inwardPull;

      /* SPIRAL (PURE ROTATION DISTORTION) */
      const spiral =
        settings.spiralTwist * radius * (1 + high*3);

      const finalAngle =
        angle + spiral;

      let warpedX =
        Math.cos(finalAngle) * warpedRadius;

      let warpedY =
        Math.sin(finalAngle) * warpedRadius;

      /* DEPTH */
      const depth =
        Math.sin(frame*0.05 + radius*0.1)
        * settings.depthPulse
        * 50;

      const terrain =
        (field + fractal)
        * settings.terrainHeight
        * (high + 0.25)
        + bassWarp
        + chaos
        + depth;

      const px = warpedX * stepX;
      const py = warpedY * stepY - terrain;

      if(x===-grid/2) ctx.moveTo(px,py);
      else ctx.lineTo(px,py);
    }

    /* =====================
       COLOR SYSTEM
    ====================== */

    let hue;

    if(settings.oneColorMode === 1){

      hue = settings.singleHue;

    } else {

      const range = settings.hueMax - settings.hueMin;
      const cycle =
        (frame * settings.spectralHueShift + y*5) % range;

      hue = settings.hueMin + cycle;
    }

    ctx.strokeStyle =
      `hsla(${hue},85%,60%,${high+0.25})`;

    ctx.lineWidth =
      settings.lineWidthBase + high*2;

    ctx.stroke();
  }

  /* GLITCH */
  if(settings.glitchSlices > 0){
    for(let i=0;i<settings.glitchSlices;i++){
      const sliceY = Math.random()*height;
      const sliceH = Math.random()*10 + 2;
      const offset = (Math.random()-0.5)*60;
      ctx.drawImage(canvas, 0, sliceY, width, sliceH,
                             offset, sliceY, width, sliceH);
    }
  }

  ctx.restore();
}

draw();