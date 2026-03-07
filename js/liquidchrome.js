// ===============================
// VISUALIZER — LIQUID CHROME TUNNEL
// ===============================

import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let width = canvas.width;
let height = canvas.height;
let frame = 0;

function avg(s,e){
  let v=0;
  const len=Math.max(1,e-s);
  for(let i=s;i<e;i++) v+=freqData[i]||0;
  return (v/len)/255;
}

const settings = {

  tunnelDensity: 180,
  tunnelDepth: 6,
  spinSpeed: 0.01,
  radialWarp: 2.5,
  bassPulse: 8,

  chromaSplit: 4,
  feedbackAmount: 0.85,
  blurStrength: 0.4,
  contrastBoost: 1.2,

  hueSpeed: 1.5,
  brightness: 0.9,

  pixelMelt: 0
};

registerSceneSettings(settings);

/* DEV PANEL */

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
  <b>LIQUID CHROME</b><hr>

  Tunnel Density <input type="range" id="tunnelDensity" min="50" max="400"><br>
  Tunnel Depth <input type="range" id="tunnelDepth" min="1" max="15"><br>
  Spin Speed <input type="range" id="spinSpeed" min="0" max="0.05" step="0.001"><br>
  Radial Warp <input type="range" id="radialWarp" min="0" max="8" step="0.1"><br>
  Bass Pulse <input type="range" id="bassPulse" min="0" max="20"><br>

  <hr><b>FILTERS</b><hr>

  Chroma Split <input type="range" id="chromaSplit" min="0" max="20"><br>
  Feedback <input type="range" id="feedbackAmount" min="0" max="1" step="0.01"><br>
  Blur <input type="range" id="blurStrength" min="0" max="2" step="0.01"><br>
  Contrast <input type="range" id="contrastBoost" min="0.5" max="3" step="0.1"><br>
  Hue Speed <input type="range" id="hueSpeed" min="0" max="5" step="0.1"><br>
  Brightness <input type="range" id="brightness" min="0.2" max="2" step="0.1"><br>
  Pixel Melt <input type="range" id="pixelMelt" min="0" max="100"><br>
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

function draw(){
  requestAnimationFrame(draw);

  if(devPanel)
    devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);

  const bass = avg(0,20);
  const mid  = avg(40,100);
  const high = avg(120,200);

  frame += settings.spinSpeed * 100;

  ctx.save();

  // feedback smear
  ctx.globalAlpha = settings.feedbackAmount;
  ctx.drawImage(canvas,0,0);
  ctx.restore();

  ctx.save();
  ctx.translate(width/2,height/2);
  ctx.globalCompositeOperation="lighter";

  for(let i=0;i<settings.tunnelDensity;i++){

    const t = i/settings.tunnelDensity;
    const depth = t * settings.tunnelDepth;

    const angle =
      t * Math.PI*2 +
      frame*0.02;

    const radius =
      (t*width*0.6) *
      (1 + bass*settings.bassPulse*0.1);

    const warp =
      Math.sin(depth*10 + frame*0.1)
      * settings.radialWarp * mid;

    const x =
      Math.cos(angle + warp) * radius;

    const y =
      Math.sin(angle + warp) * radius;

    const hue =
      (frame*settings.hueSpeed + t*360)%360;

    ctx.strokeStyle =
      `hsla(${hue},90%,60%,${high+0.3})`;

    ctx.lineWidth = 1 + high*3;

    ctx.beginPath();
    ctx.arc(x,y,20*(1-t),0,Math.PI*2);
    ctx.stroke();
  }

  ctx.restore();

  // RGB SPLIT
  if(settings.chromaSplit>0){
    ctx.globalCompositeOperation="lighter";
    ctx.drawImage(canvas, settings.chromaSplit,0);
    ctx.drawImage(canvas,-settings.chromaSplit,0);
  }

  // PIXEL MELT
  if(settings.pixelMelt>0){
    for(let i=0;i<settings.pixelMelt;i++){
      const y = Math.random()*height;
      ctx.drawImage(canvas,0,y,width,2,
                    (Math.random()-0.5)*50,y,width,2);
    }
  }
}

draw();