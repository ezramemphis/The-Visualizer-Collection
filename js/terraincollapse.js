// ===============================
// VISUALIZER B — FRACTAL TERRAIN ENGINE
// ULTRA EXPERIMENTAL EDITION
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
  spiralTwist: 0.002,

  depthPulse: 0.5,
  glitchSlices: 0,

  chromaticAberration: 0,
  scanlineIntensity: 0,
  pixelDrift: 0,
  feedbackAmount: 0,

  kaleidoscope: 0,
  colorChaos: 0,
  noiseOverlay: 0,
  cameraShake: 0

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
    background:"rgba(0,0,0,0.9)",
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

  Terrain Scale <input type="range" id="terrainScale" min="0.01" max="0.3" step="0.01"><br>
  Terrain Height <input type="range" id="terrainHeight" min="10" max="200"><br>
  Fractal Depth <input type="range" id="fractalDepth" min="1" max="8"><br>

  Time Speed <input type="range" id="timeFlowSpeed" min="0" max="0.1" step="0.001"><br>

  Line Width <input type="range" id="lineWidthBase" min="0.5" max="5" step="0.1"><br>
  BG Alpha <input type="range" id="bgAlpha" min="0" max="1" step="0.01"><br>

  <hr><b>EXPERIMENTAL</b><hr>

  Spectral Hue Shift <input type="range" id="spectralHueShift" min="0" max="3" step="0.01"><br>
  Bass Warp <input type="range" id="bassWarpIntensity" min="0" max="12" step="0.1"><br>
  Chaos Noise <input type="range" id="chaosNoiseStrength" min="0" max="0.02" step="0.0005"><br>

  Spiral Twist <input type="range" id="spiralTwist" min="0" max="0.02" step="0.0005"><br>

  Glitch Slices <input type="range" id="glitchSlices" min="0" max="80"><br>

  Chromatic Shift <input type="range" id="chromaticAberration" min="0" max="12" step="0.1"><br>
  Scanlines <input type="range" id="scanlineIntensity" min="0" max="1" step="0.01"><br>
  Pixel Drift <input type="range" id="pixelDrift" min="0" max="40"><br>
  Feedback <input type="range" id="feedbackAmount" min="0" max="0.98" step="0.01"><br>

  Kaleidoscope <input type="range" id="kaleidoscope" min="0" max="1" step="1"><br>
  Color Chaos <input type="range" id="colorChaos" min="0" max="1" step="0.01"><br>
  Noise Overlay <input type="range" id="noiseOverlay" min="0" max="1" step="0.01"><br>
  Camera Shake <input type="range" id="cameraShake" min="0" max="30"><br>

  <hr>
  Upload Background Image<br>
  <input type="file" id="bgUpload" accept="image/*">
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
 DRAW LOOP
====================================================== */

function draw(){

  requestAnimationFrame(draw);
  frame++;

  if(devPanel)
    devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);

  const bass = avg(0,20);
  const high = avg(90,180);

  /* feedback hallucination */

  if(settings.feedbackAmount > 0){

    ctx.globalAlpha = settings.feedbackAmount;

    ctx.drawImage(
      canvas,
      Math.sin(frame*0.02)*10,
      Math.cos(frame*0.015)*10,
      width,
      height
    );

    ctx.globalAlpha = 1;

  }

  /* fade trails */

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0,0,width,height);

  /* camera shake */

  if(settings.cameraShake > 0){

    const shake = settings.cameraShake * bass;

    ctx.translate(
      (Math.random()-0.5)*shake,
      (Math.random()-0.5)*shake
    );

  }

  const grid = 120;
  const stepX = width / grid;
  const stepY = height / grid;

  ctx.save();
  ctx.translate(width/2,height/2);

  if(bass > 0.7)
    ctx.globalCompositeOperation = "difference";
  else
    ctx.globalCompositeOperation = "lighter";

  frame += settings.timeFlowSpeed * 100;

  for(let y=-grid/2;y<grid/2;y++){

    ctx.beginPath();

    for(let x=-grid/2;x<grid/2;x++){

      const nx = x * settings.terrainScale;
      const ny = y * settings.terrainScale;

      let field =
        Math.sin(nx + frame*settings.timeFlowSpeed) +
        Math.cos(ny + frame*0.013);

      let fractal = 0;

      for(let k=1;k<=settings.fractalDepth;k++){

        fractal +=
          Math.sin(nx*k*2 + frame*0.01*k) +
          Math.cos(ny*k*3 + frame*0.008*k);

      }

      fractal /= Math.max(1,settings.fractalDepth);

      const radius = Math.sqrt(x*x + y*y);

      const bassWarp =
        Math.sin(radius*0.0008 + frame*0.01)
        * bass
        * settings.bassWarpIntensity;

      const chaos =
        (Math.sin(frame*0.003 + x*0.2 + y*0.15))
        * settings.chaosNoiseStrength * 200;

      const terrain =
        (field + fractal)
        * settings.terrainHeight
        * (0.3 + high*1.2)
        + bassWarp*1.4
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

  /* =========================
     GLITCH SLICES
  ========================= */

  for(let i=0;i<settings.glitchSlices;i++){

    const sliceY = Math.random()*height;
    const sliceH = Math.random()*20 + 5;
    const shift = (Math.random()-0.5)*120;

    const slice = ctx.getImageData(0,sliceY,width,sliceH);

    ctx.putImageData(slice,shift,sliceY);

  }

  /* =========================
     PIXEL DRIFT
  ========================= */

  if(settings.pixelDrift > 0){

    for(let i=0;i<settings.pixelDrift;i++){

      const y = Math.random()*height;

      ctx.drawImage(
        canvas,
        0,y,width,1,
        Math.sin(frame*0.05+i)*30,
        y,
        width,
        1
      );

    }

  }

  /* =========================
     CHROMATIC ABERRATION
  ========================= */

  if(settings.chromaticAberration > 0){

    const shift = settings.chromaticAberration;

    const img = ctx.getImageData(0,0,width,height);
    const data = img.data;

    for(let i=0;i<data.length;i+=4){

      const x = (i/4)%width;

      const offset = Math.floor(Math.sin(x*0.01+frame*0.02)*shift);

      data[i] = data[i + offset*4] || data[i];

    }

    ctx.putImageData(img,0,0);

  }

  /* =========================
     SCANLINES
  ========================= */

  if(settings.scanlineIntensity > 0){

    ctx.globalCompositeOperation = "multiply";

    for(let y=0;y<height;y+=2){

      ctx.fillStyle =
        `rgba(0,0,0,${settings.scanlineIntensity})`;

      ctx.fillRect(0,y,width,1);

    }

  }

  /* =========================
     NOISE OVERLAY
  ========================= */

  if(settings.noiseOverlay > 0){

    for(let i=0;i<2000;i++){

      ctx.fillStyle =
        `rgba(255,255,255,${Math.random()*settings.noiseOverlay})`;

      ctx.fillRect(
        Math.random()*width,
        Math.random()*height,
        1,
        1
      );

    }

  }

}

draw();

// testing out this exporting thing
export { settings, devPanel };