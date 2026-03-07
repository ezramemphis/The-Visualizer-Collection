// ===============================
// VISUALIZER — AUDIO REACTIVE SIGNAL RITUAL
// GEOMETRIC SUMMONING ENGINE (STABLE)
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
  ringCount: 6,
  baseRadius: 80,
  ringSpacing: 55,
  glyphCount: 24,
  glyphSize: 14,
  rotationSpeed: 0.01,

  // reactivity
  bassArcPower: 8,
  midWaveWarp: 6,
  highFlicker: 1.5,
  ritualIntensity: 1.2,

  // trails
  trailDecay: 0.12,

  // color
  hueSpeed: 2,
  saturation: 85,
  lightness: 60,

  // post
  bloomStrength: 0.6,
  chromaShift: 0,
  vignette: 0.25,
  emberCount: 20
};

registerSceneSettings(settings);

let perspectiveX = 0;
let perspectiveY = 0;
let perspectiveScale = 1;

/* ======================================================
 OFFSCREEN BUFFER
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
  <b>SIGNAL RITUAL</b><hr>

  Ring Count <input type="range" id="ringCount" min="1" max="12"><br>
  Base Radius <input type="range" id="baseRadius" min="20" max="200"><br>
  Ring Spacing <input type="range" id="ringSpacing" min="20" max="120"><br>
  Glyph Count <input type="range" id="glyphCount" min="4" max="60"><br>
  Glyph Size <input type="range" id="glyphSize" min="4" max="40"><br>
  Rotation Speed <input type="range" id="rotationSpeed" min="0" max="0.05" step="0.001"><br>

  <hr><b>AUDIO</b><hr>

  Bass Arc <input type="range" id="bassArcPower" min="0" max="20" step="0.1"><br>
  Mid Warp <input type="range" id="midWaveWarp" min="0" max="20" step="0.1"><br>
  High Flicker <input type="range" id="highFlicker" min="0" max="5" step="0.1"><br>
  Ritual Intensity <input type="range" id="ritualIntensity" min="0.5" max="4" step="0.1"><br>

  <hr><b>TRAILS</b><hr>

  Trail Decay <input type="range" id="trailDecay" min="0.01" max="0.5" step="0.01"><br>

  <hr><b>POST FX</b><hr>

  Bloom <input type="range" id="bloomStrength" min="0" max="2" step="0.05"><br>
  Chroma Shift <input type="range" id="chromaShift" min="0" max="20"><br>
  Vignette <input type="range" id="vignette" min="0" max="0.6" step="0.01"><br>
  Ember Count <input type="range" id="emberCount" min="0" max="100"><br>

  <hr><b>PERSPECTIVE</b><hr>

Perspective X
<input type="range" id="perspectiveX" min="-500" max="500"><br>

Perspective Y
<input type="range" id="perspectiveY" min="-500" max="500">
  `;

  document.body.appendChild(devPanel);

  const px = devPanel.querySelector("#perspectiveX");
const py = devPanel.querySelector("#perspectiveY");

if(px){
  px.value = perspectiveX;
  px.oninput = e => perspectiveX = Number(e.target.value);
}

if(py){
  py.value = perspectiveY;
  py.oninput = e => perspectiveY = Number(e.target.value);
}

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

  /* ===== TRAIL FADE ===== */
  ctx.fillStyle = `rgba(0,0,0,${settings.trailDecay})`;
  ctx.fillRect(0,0,width,height);


// Perspective transform thing
  ctx.fillRect(0,0,width,height);

  ctx.save();
ctx.translate(perspectiveX, perspectiveY);

  /* ===== DRAW TO BUFFER ===== */
  bctx.clearRect(0,0,width,height);
  bctx.save();
  bctx.translate(width/2,height/2);
  bctx.globalCompositeOperation="screen";

  const rings = Math.floor(settings.ringCount);

  for(let r=0;r<rings;r++){

    const radius =
      settings.baseRadius +
      r * settings.ringSpacing;

    const rotation =
      frame*0.02*(r+1) *
      settings.ritualIntensity;

    const hue =
      (frame*settings.hueSpeed + r*40)%360;

    const light =
      Math.min(75,
        settings.lightness +
        high*settings.highFlicker*20
      );

    bctx.strokeStyle =
      `hsla(${hue},${settings.saturation}%,${light}%,0.9)`;

    bctx.lineWidth = 1 + high*2;

    /* SACRED CIRCLE */
    bctx.beginPath();
    bctx.arc(0,0,
      radius * (1 + bass*0.3),
      0,Math.PI*2);
    bctx.stroke();

    /* GLYPH RING */
    const glyphs = Math.floor(settings.glyphCount);

    for(let i=0;i<glyphs;i++){

      const angle =
        (i/glyphs)*Math.PI*2 + rotation;

      const gx =
        Math.cos(angle) * radius;

      const gy =
        Math.sin(angle) * radius;

      bctx.save();
      bctx.translate(gx,gy);
      bctx.rotate(angle);

      const warp =
        Math.sin(frame*0.1 + i)
        * mid
        * settings.midWaveWarp
        * settings.ritualIntensity;

      bctx.beginPath();
      bctx.moveTo(-settings.glyphSize/2,0);
      bctx.lineTo(0,warp);
      bctx.lineTo(settings.glyphSize/2,0);
      bctx.stroke();

      bctx.restore();
    }

    /* BASS ARC FIELD */
    const arcCount = 12;

    for(let i=0;i<arcCount;i++){
      const a = (i/arcCount)*Math.PI*2 + rotation;
      const arcLen =
        bass * settings.bassArcPower;

      bctx.beginPath();
      bctx.arc(0,0,
        radius + arcLen*10,
        a,
        a + 0.2
      );
      bctx.stroke();
    }
  }

  bctx.restore();

  /* ===== BLOOM ===== */
  if(settings.bloomStrength>0){
    ctx.filter = `blur(${settings.bloomStrength*6}px)`;
    ctx.globalCompositeOperation="screen";
    ctx.drawImage(buffer,0,0);
    ctx.filter = "none";
  }

  /* SHARP LAYER */
  ctx.globalCompositeOperation="lighter";
  ctx.drawImage(buffer,0,0);
  ctx.globalCompositeOperation="source-over";

  /* ===== CHROMA SHIFT ===== */
  if(settings.chromaShift>0){
    ctx.globalCompositeOperation="screen";
    ctx.globalAlpha=0.4;
    ctx.drawImage(canvas, settings.chromaShift,0);
    ctx.drawImage(canvas,-settings.chromaShift,0);
    ctx.globalAlpha=1;
    ctx.globalCompositeOperation="source-over";
  }

  /* ===== VIGNETTE ===== */
  if(settings.vignette>0){
    const g = ctx.createRadialGradient(
      width/2,height/2,
      width*0.3,
      width/2,height/2,
      width
    );
    g.addColorStop(0,"rgba(0,0,0,0)");
    g.addColorStop(1,`rgba(0,0,0,${settings.vignette})`);
    ctx.fillStyle=g;
    ctx.fillRect(0,0,width,height);
  }

  /* ===== EMBER PARTICLES ===== */
  if(settings.emberCount>0){
    ctx.fillStyle="rgba(255,120,40,0.8)";
    for(let i=0;i<settings.emberCount;i++){
      const x=Math.random()*width;
      const y=Math.random()*height;
      const size=Math.random()*2;
      ctx.fillRect(x,y,size,size);
    }
  }
}

ctx.restore();
draw();