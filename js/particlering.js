// =====================================================
// AUDIO CHAOS ATTRACTOR FIELD VISUALIZER — FINAL FIXED VERSION
// =====================================================

import { ctx, canvas, analyser, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

/* =====================================================
 GLOBAL STATE
===================================================== */

let width = canvas.width;
let height = canvas.height;
let frame = 0;

let freqData = new Uint8Array(512);

/* =====================================================
 AUDIO HELPER
===================================================== */

function avg(start,end){

  let v=0;
  let len=Math.max(1,end-start);

  for(let i=start;i<end;i++)
    v+=freqData[i]||0;

  return v/len/255;
}

/* =====================================================
 SETTINGS
===================================================== */

const settings = {

  pointCount:1200,
  stepSpeed:0.004,

  chaosIntensity:1.2,
  dimensionalBias:0.6,
  flowViscosity:0.97,

  audioForce:3,
  bassGravity:2.2,
  midWarp:1.6,
  highSpark:1.9,

  decay:0.06,

  hueBase:220,
  hueSpread:140,

  particleSize:1.5,

  compositeMode:1,

  attractA:1.2,
  attractB:0.9,
  attractC:1.4,
  attractD:0.7,
  attractE:1.1,
  attractF:0.8
};

registerSceneSettings(settings);

/* =====================================================
 DEV PANEL
===================================================== */

let devPanel;

function createDevPanel(){

  devPanel=document.createElement("div");

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

  devPanel.innerHTML=`
  <b>CHAOS FIELD VISUALIZER</b><hr>

  Point Count <input type="range" id="pointCount" min="200" max="3000"><br>
  Step Speed <input type="range" id="stepSpeed" min="0.001" max="0.02" step="0.001"><br>

  Chaos Intensity <input type="range" id="chaosIntensity" min="0" max="5" step="0.01"><br>
  Flow Viscosity <input type="range" id="flowViscosity" min="0" max="1" step="0.01"><br>

  Audio Force <input type="range" id="audioForce" min="0" max="10" step="0.1"><br>

  Decay <input type="range" id="decay" min="0" max="0.2" step="0.005"><br>

  Hue Base <input type="range" id="hueBase" min="0" max="360"><br>
  Hue Spread <input type="range" id="hueSpread" min="0" max="360"><br>

  Particle Size <input type="range" id="particleSize" min="0.5" max="6" step="0.1"><br>

  Composite Mode <input type="range" id="compositeMode" min="0" max="1" step="1"><br>
  `;

  document.body.appendChild(devPanel);

  Object.keys(settings).forEach(key=>{

    const el=devPanel.querySelector(`#${key}`);
    if(!el) return;

    el.value=settings[key];

    el.addEventListener("input",e=>{

      settings[key]=parseFloat(e.target.value);

      if(key==="pointCount")
        rebuildField();

    });

  });
}

createDevPanel();

/* =====================================================
 PARTICLE FIELD
===================================================== */

let points=[];

function rebuildField(){

  points=[];

  for(let i=0;i<settings.pointCount;i++){

    points.push({
      x:(Math.random()-0.5)*2,
      y:(Math.random()-0.5)*2,
      z:(Math.random()-0.5)*2
    });

  }

}

rebuildField();

/* =====================================================
 RESIZE
===================================================== */

window.addEventListener("resize",()=>{

  width=canvas.width;
  height=canvas.height;

  rebuildField();

});

/* =====================================================
 DRAW LOOP
===================================================== */

function draw(){

  requestAnimationFrame(draw);

  if(!analyser) return;

  analyser.getByteFrequencyData(freqData);

  let bass=avg(0,40);
  let mid=avg(40,120);
  let high=avg(120,200);
  let volume=avg(0,freqData.length);

  frame+=settings.stepSpeed*100;

  if(devPanel)
    devPanel.style.display=
      devPanelActive?"block":"none";

  ctx.fillStyle=
    `rgba(0,0,0,${settings.decay})`;

  ctx.fillRect(0,0,width,height);

  ctx.save();

  ctx.translate(width/2,height/2);

  ctx.globalCompositeOperation=
    settings.compositeMode===1
      ?"lighter"
      :"screen";

  let A=settings.attractA+bass*settings.audioForce;
  let B=settings.attractB+mid*settings.audioForce;
  let C=settings.attractC+high*settings.audioForce;

  let chaos=
    settings.chaosIntensity*(1+volume*2);

  for(let p of points){

    let dx=
      Math.sin(p.y*A)*chaos-
      p.z*B+
      bass*settings.bassGravity;

    let dy=
      Math.cos(p.z*C)*chaos+
      p.x*settings.attractD+
      mid;

    let dz=
      Math.sin(p.x)*chaos-
      p.y+
      high*settings.highSpark;

    p.x+=dx*settings.stepSpeed*settings.flowViscosity;
    p.y+=dy*settings.stepSpeed*settings.flowViscosity;
    p.z+=dz*settings.stepSpeed*settings.flowViscosity;

    let perspective=
      1/(3-p.z*settings.dimensionalBias);

    if(!isFinite(perspective)) continue;

    let sx=p.x*perspective*width*0.25;
    let sy=p.y*perspective*height*0.25;

    let hue=
      (settings.hueBase+
      (bass+mid+high)*settings.hueSpread+
      frame*0.5)%360;

    ctx.fillStyle=
      `hsla(${hue},90%,65%,0.6)`;

    ctx.fillRect(
      sx,
      sy,
      settings.particleSize,
      settings.particleSize
    );
  }

  ctx.restore();
}

draw();