// ===============================
// VISUALIZER — CAROUSEL ENGINE
// ===============================

import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let width = canvas.width;
let height = canvas.height;
let frame = 0;

/* ======================================================
 AUDIO
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

  carouselRadius: 330,
  poleCount: 20,
  poleHeight: 150,

  rotationSpeed: 0.0012,
  spiralAmount: 2,

  cuboidSize: 0,
  cuboidHeight: 0,

  platformBounce: 30,

  glow: 0.6,
  bgAlpha: 0.2
};

registerSceneSettings(settings);

/* ======================================================
 RESIZE
====================================================== */

function resize(){
  width = canvas.width;
  height = canvas.height;
}

window.addEventListener("resize",resize);
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
    display:"none"
  });

  devPanel.innerHTML = `
  <b>CAROUSEL ENGINE</b><hr>

  Radius <input type="range" id="carouselRadius" min="50" max="500"><br>
  Pole Count <input type="range" id="poleCount" min="4" max="32"><br>
  Pole Height <input type="range" id="poleHeight" min="100" max="600"><br>

  Rotation Speed <input type="range" id="rotationSpeed" min="0" max="0.05" step="0.001"><br>
  Spiral Amount <input type="range" id="spiralAmount" min="0" max="6" step="0.1"><br>

  Cuboid Size <input type="range" id="cuboidSize" min="10" max="120"><br>
  Cuboid Height <input type="range" id="cuboidHeight" min="10" max="200"><br>

  Platform Bounce <input type="range" id="platformBounce" min="0" max="200"><br>

  Glow <input type="range" id="glow" min="0" max="2" step="0.05"><br>
  BG Alpha <input type="range" id="bgAlpha" min="0" max="1" step="0.01"><br>
  `;

  document.body.appendChild(devPanel);

  Object.keys(settings).forEach(key=>{
    const el = devPanel.querySelector(`#${key}`);
    if(!el) return;

    el.value = settings[key];

    el.addEventListener("input",e=>{
      settings[key] = parseFloat(e.target.value);
    });
  });
}

createDevPanel();

/* ======================================================
 FAKE 3D PROJECTION
====================================================== */

function project(x,y,z){

  const scale = 600 / (600 + z);

  return {
    x: x * scale,
    y: y * scale,
    s: scale
  };
}

/* ======================================================
 DRAW
====================================================== */

function draw(){

  requestAnimationFrame(draw);

  if(devPanel)
    devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);

  const bass = avg(0,20);
  const mids = avg(40,100);
  const highs = avg(120,200);

  frame += settings.rotationSpeed * 100;

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0,0,width,height);

  ctx.save();
  ctx.translate(width/2,height/2);

  const bounce =
    Math.sin(frame*0.08) *
    settings.platformBounce *
    bass;

  const radius = settings.carouselRadius;

  /* ===============================
     DRAW POLES
  =============================== */

  for(let i=0;i<settings.poleCount;i++){

    const a =
      i/settings.poleCount * Math.PI*2 +
      frame*settings.rotationSpeed*10;

    const spiral =
      Math.sin(frame*0.2 + i)
      * settings.spiralAmount
      * mids;

    const x =
      Math.cos(a) * radius;

    const z =
      Math.sin(a) * radius;

    const p = project(x,0,z);

    const top = project(x, -settings.poleHeight + bounce, z);
    const bottom = project(x, bounce, z);

    /* GOLD SPIRAL POLE */

    ctx.lineWidth = 6 * p.s;

    const hue = 45 + Math.sin(frame*0.05+i)*10;

    ctx.strokeStyle =
      `hsla(${hue},100%,60%,${0.7 + highs})`;

    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.stroke();

    /* ===============================
       CUBOID "HORSE"
    =============================== */

    const cubeY =
      -settings.cuboidHeight/2 +
      Math.sin(frame*0.1 + i)*30*mids;

    const cp = project(x, cubeY + bounce, z);

    const size =
      settings.cuboidSize *
      cp.s *
      (1 + mids*2);

    ctx.fillStyle =
      `hsla(50,100%,70%,${0.8 + highs})`;

    ctx.fillRect(
      cp.x - size/2,
      cp.y - size/2,
      size,
      size
    );

    /* LIGHT ORB */

    ctx.beginPath();
    ctx.arc(cp.x, cp.y - size,
      size*0.4 + highs*10,
      0,Math.PI*2);

    ctx.fillStyle =
      `hsla(60,100%,80%,${settings.glow})`;

    ctx.fill();
  }

  ctx.restore();
}

draw();