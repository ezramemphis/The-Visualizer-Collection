// ===============================
// VISUALIZER — GLASS SHARD KALEIDOSCOPE (STABLE EDITION)
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
  let v=0;
  const len=Math.max(1,e-s);
  for(let i=s;i<e;i++) v+=freqData[i]||0;
  return (v/len)/255;
}

/* ======================================================
 SETTINGS
====================================================== */

const settings = {

  // geometry
  shardCount: 16,
  innerRadius: 80,
  outerRadius: 450,
  rotationSpeed: 0.01,
  mirrorIntensity: 1,
  insanity: 1.2,

  // deformation
  bassSpin: 4,
  midFracture: 6,
  highFlicker: 2,

  // color
  hueSpeed: 2,
  saturation: 90,
  lightness: 60,

  // filters
  bloomStrength: 0.6,
  chromaShift: 4,
  crtCurve: 0.15,
  scanlineStrength: 0.2,
  glitchRip: 0
};

registerSceneSettings(settings);

/* ======================================================
 OFFSCREEN BUFFER (PREVENTS WHITE MELTDOWN)
====================================================== */

const buffer = document.createElement("canvas");
const bctx = buffer.getContext("2d");

function resize(){
  width = canvas.width;
  height = canvas.height;

  buffer.width = width;
  buffer.height = height;
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
  <b>GLASS SHARD KALEIDOSCOPE</b><hr>

  Shard Count <input type="range" id="shardCount" min="4" max="64"><br>
  Inner Radius <input type="range" id="innerRadius" min="0" max="300"><br>
  Outer Radius <input type="range" id="outerRadius" min="200" max="900"><br>
  Rotation Speed <input type="range" id="rotationSpeed" min="0" max="0.05" step="0.001"><br>
  Mirror Intensity <input type="range" id="mirrorIntensity" min="0" max="3" step="0.1"><br>
  Insanity <input type="range" id="insanity" min="0.5" max="4" step="0.1"><br>

  <hr><b>AUDIO REACTION</b><hr>

  Bass Spin <input type="range" id="bassSpin" min="0" max="15" step="0.1"><br>
  Mid Fracture <input type="range" id="midFracture" min="0" max="15" step="0.1"><br>
  High Flicker <input type="range" id="highFlicker" min="0" max="10" step="0.1"><br>

  <hr><b>COLOR</b><hr>

  Hue Speed <input type="range" id="hueSpeed" min="0" max="10" step="0.1"><br>
  Saturation <input type="range" id="saturation" min="0" max="100"><br>
  Lightness <input type="range" id="lightness" min="20" max="80"><br>

  <hr><b>FILTERS</b><hr>

  Bloom <input type="range" id="bloomStrength" min="0" max="2" step="0.05"><br>
  Chroma Shift <input type="range" id="chromaShift" min="0" max="20"><br>
  CRT Curve <input type="range" id="crtCurve" min="0" max="0.5" step="0.01"><br>
  Scanlines <input type="range" id="scanlineStrength" min="0" max="1" step="0.01"><br>
  Glitch Rip <input type="range" id="glitchRip" min="0" max="100"><br>
  `;

  document.body.appendChild(devPanel);

  Object.keys(settings).forEach(key=>{
    const el = devPanel.querySelector(`#${key}`);
    if(!el) return;
    el.value=settings[key];
    el.addEventListener("input", e=>{
      settings[key]=parseFloat(e.target.value);
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
  const mid  = avg(40,100);
  const high = avg(120,200);

  frame += settings.rotationSpeed * 100;

  /* ===== DRAW SHARDS TO BUFFER ===== */

  bctx.clearRect(0,0,width,height);

  bctx.save();
  bctx.translate(width/2,height/2);
  bctx.globalCompositeOperation="screen";

  const shards = Math.floor(settings.shardCount);
  const angleStep = (Math.PI*2)/shards;

  for(let i=0;i<shards;i++){

    const baseAngle = i*angleStep;

    const spin =
      frame*0.01 +
      bass*settings.bassSpin;

    const fracture =
      Math.sin(frame*0.05 + i)
      * mid
      * settings.midFracture
      * settings.insanity;

    const angle =
      baseAngle + spin + fracture;

    const inner = settings.innerRadius;
    const outer =
      settings.outerRadius *
      (1 + mid*0.4*settings.insanity);

    const hue =
      (frame*settings.hueSpeed + i*20)%360;

    const light =
      Math.min(75,
        settings.lightness +
        high*settings.highFlicker*20
      );

    bctx.strokeStyle =
      `hsla(${hue},${settings.saturation}%,${light}%,0.9)`;

    bctx.lineWidth = 1 + high*3;

    bctx.beginPath();
    bctx.moveTo(
      Math.cos(angle)*inner,
      Math.sin(angle)*inner
    );

    bctx.lineTo(
      Math.cos(angle+angleStep*settings.mirrorIntensity)*outer,
      Math.sin(angle+angleStep*settings.mirrorIntensity)*outer
    );

    bctx.lineTo(
      Math.cos(angle-angleStep*settings.mirrorIntensity)*outer,
      Math.sin(angle-angleStep*settings.mirrorIntensity)*outer
    );

    bctx.closePath();
    bctx.stroke();
  }

  bctx.restore();

  /* ===== CLEAR MAIN CANVAS ===== */

  ctx.fillStyle="black";
  ctx.fillRect(0,0,width,height);

  /* ===== BLOOM (REAL, CONTROLLED) ===== */

  if(settings.bloomStrength>0){
    ctx.filter = `blur(${settings.bloomStrength*6}px)`;
    ctx.globalCompositeOperation="screen";
    ctx.drawImage(buffer,0,0);
    ctx.filter = "none";
  }

  /* DRAW SHARP LAYER */
  ctx.globalCompositeOperation="lighter";
  ctx.drawImage(buffer,0,0);
  ctx.globalCompositeOperation="source-over";

  /* ===== SAFE CHROMA SHIFT ===== */

  if(settings.chromaShift>0){
    ctx.globalCompositeOperation="screen";
    ctx.globalAlpha=0.4;

    ctx.drawImage(canvas, settings.chromaShift,0);
    ctx.drawImage(canvas,-settings.chromaShift,0);

    ctx.globalAlpha=1;
    ctx.globalCompositeOperation="source-over";
  }

  /* ===== SCANLINES ===== */

  if(settings.scanlineStrength>0){
    ctx.fillStyle=`rgba(0,0,0,${settings.scanlineStrength})`;
    for(let y=0;y<height;y+=4){
      ctx.fillRect(0,y,width,2);
    }
  }

  /* ===== CRT VIGNETTE ===== */

  if(settings.crtCurve>0){
    const gradient = ctx.createRadialGradient(
      width/2,height/2,
      width*0.3,
      width/2,height/2,
      width
    );
    gradient.addColorStop(0,"rgba(0,0,0,0)");
    gradient.addColorStop(1,`rgba(0,0,0,${settings.crtCurve})`);
    ctx.fillStyle=gradient;
    ctx.fillRect(0,0,width,height);
  }

  /* ===== GLITCH RIP ===== */

  if(settings.glitchRip>0){
    for(let i=0;i<settings.glitchRip;i++){
      const y=Math.random()*height;
      ctx.drawImage(canvas,0,y,width,2,
                    (Math.random()-0.5)*80,y,width,2);
    }
  }
}

draw();