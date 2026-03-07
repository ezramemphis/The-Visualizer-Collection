// =====================================================
// AUDIO TIME CRYSTAL LATTICE VISUALIZER — EXPANDED DEV PANEL
// =====================================================

import { ctx, canvas, analyser, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let width = canvas.width;
let height = canvas.height;

let frame = 0;

/* =====================================================
 AUDIO BUFFER
===================================================== */

let freqData = new Uint8Array(512);

function avg(a,b){

  let v=0;

  for(let i=a;i<b;i++)
    v+=freqData[i]||0;

  return v/Math.max(1,b-a)/255;
}

/* =====================================================
 SETTINGS — LARGE DEV PANEL
===================================================== */

const settings = {

  decay:0.06,

  latticeSize:60,
  waveDepth:1.4,

  radialFrequency:12,
  angularFrequency:20,

  bassPressure:3.2,
  midFold:1.8,
  highSpark:2.5,

  pulseSpeed:0.02,
  timeFlow:0.006,

  hueBase:200,
  hueSpread:160,

  lineWidth:1.2,

  compositeMode:1,

  // NEW EXPERIMENTAL
  latticeBreathing:1.2,
  chaosNoise:0.4,
  symmetryWarp:0.5,
  resonanceMemory:0.9
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
    top:"10px",
    left:"10px",
    padding:"12px",
    background:"rgba(0,0,0,0.9)",
    color:"#fff",
    fontFamily:"sans-serif",
    fontSize:"12px",
    borderRadius:"8px",
    zIndex:9999,
    display:"none",
    maxHeight:"95vh",
    overflowY:"auto",
    width:"260px"
  });

  devPanel.innerHTML=`
  <b>TIME CRYSTAL LATTICE ENGINE</b><hr>

  Lattice Size
  <input type="range" id="latticeSize" min="20" max="120"><br>

  Wave Depth
  <input type="range" id="waveDepth" min="0" max="5" step="0.1"><br>

  Radial Frequency
  <input type="range" id="radialFrequency" min="1" max="40"><br>

  Angular Frequency
  <input type="range" id="angularFrequency" min="1" max="60"><br>

  Bass Pressure
  <input type="range" id="bassPressure" min="0" max="10" step="0.1"><br>

  Mid Fold
  <input type="range" id="midFold" min="0" max="5" step="0.1"><br>

  High Spark
  <input type="range" id="highSpark" min="0" max="8" step="0.1"><br>

  Pulse Speed
  <input type="range" id="pulseSpeed" min="0" max="0.1" step="0.001"><br>

  Decay
  <input type="range" id="decay" min="0" max="0.2" step="0.005"><br>

  Hue Base
  <input type="range" id="hueBase" min="0" max="360"><br>

  Hue Spread
  <input type="range" id="hueSpread" min="0" max="360"><br>

  Line Width
  <input type="range" id="lineWidth" min="0.5" max="5" step="0.1"><br>

  Composite Mode
  <input type="range" id="compositeMode" min="0" max="1" step="1"><br>

  <hr>
  Experimental<br>

  Lattice Breathing
  <input type="range" id="latticeBreathing" min="0" max="3" step="0.1"><br>

  Chaos Noise
  <input type="range" id="chaosNoise" min="0" max="2" step="0.01"><br>

  Symmetry Warp
  <input type="range" id="symmetryWarp" min="0" max="2" step="0.01"><br>
  `;

  document.body.appendChild(devPanel);

  Object.keys(settings).forEach(key=>{

    const el=devPanel.querySelector(`#${key}`);
    if(!el) return;

    el.value=settings[key];

    el.addEventListener("input",e=>{
      settings[key]=parseFloat(e.target.value);
    });

  });
}

createDevPanel();

/* =====================================================
 FIELD DRAWING
===================================================== */

function drawLattice(bass,mid,high){

  let grid=settings.latticeSize;

  let stepX=width/grid;
  let stepY=height/grid;

  ctx.save();

  ctx.translate(width/2,height/2);

  ctx.globalCompositeOperation=
    settings.compositeMode===1
      ?"lighter":"screen";

  frame+=settings.timeFlow*100;

  for(let y=-grid/2;y<grid/2;y++){

    ctx.beginPath();

    for(let x=-grid/2;x<grid/2;x++){

      let nx=x/grid;
      let ny=y/grid;

      let radial=Math.sqrt(nx*nx+ny*ny);

      let angle=Math.atan2(ny,nx);

      let wave=
        Math.sin(
          radial*settings.radialFrequency +
          frame*settings.pulseSpeed
        ) * settings.waveDepth *
        settings.latticeBreathing;

      let angularWarp=
        Math.sin(
          angle*settings.angularFrequency +
          frame*0.01
        ) * settings.symmetryWarp;

      let distortion=
        wave +
        angularWarp +
        bass*settings.bassPressure*(1+Math.sin(frame*0.02)) +
        mid*Math.cos(radial*5) +
        high*Math.sin(radial*20);

      let px=(nx*width*0.25)+distortion*stepX;
      let py=(ny*height*0.25)-distortion*stepY;

      if(x===-grid/2)
        ctx.moveTo(px,py);
      else
        ctx.lineTo(px,py);
    }

    let hue=
      (settings.hueBase+
      (bass+mid+high)*settings.hueSpread+
      frame)%360;

    ctx.strokeStyle=
      `hsla(${hue},90%,65%,0.6)`;

    ctx.lineWidth=settings.lineWidth+high*2;

    ctx.stroke();
  }

  ctx.restore();
}

/* =====================================================
 MAIN LOOP
===================================================== */

function draw(){

  requestAnimationFrame(draw);

  if(!analyser) return;

  analyser.getByteFrequencyData(freqData);

  let bass=avg(0,40);
  let mid=avg(40,120);
  let high=avg(120,200);

  if(devPanel)
    devPanel.style.display=
      devPanelActive?"block":"none";

  ctx.fillStyle=
    `rgba(0,0,0,${settings.decay})`;

  ctx.fillRect(0,0,width,height);

  drawLattice(bass,mid,high);
}

draw();