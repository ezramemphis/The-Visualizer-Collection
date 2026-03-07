// ===============================
// VISUALIZER — LIGHT STRING FIELD
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

  stringCount: 24,
  stringTension: 0.08,
  sparkleDensity: 12,

  bassStretch: 40,
  waveSpeed: 0.01,

  hueBase: 180,
  hueSpread: 120,

  bgAlpha: 0.08
};

registerSceneSettings(settings);

/* DEV PANEL */

let devPanel;

function createDevPanel(){

  devPanel = document.createElement("div");

  devPanel.style =
  `position:fixed;top:5px;left:5px;
   padding:8px;background:rgba(0,0,0,0.85);
   color:white;font-size:12px;font-family:sans-serif;
   border-radius:6px;z-index:9999;
   display:none;max-height:95vh;overflow:auto`;

  devPanel.innerHTML = `
  <b>LIGHT STRING FIELD</b><hr>

  String Count <input type="range" id="stringCount" class="slider-main" min="4" max="60"><br>
  String Tension <input type="range" id="stringTension" class="slider-main" min="0.01" max="0.2" step="0.01"><br>
  Sparkle Density <input type="range" id="sparkleDensity" class="slider-main" min="2" max="40"><br>
  Bass Stretch <input type="range" id="bassStretch" class="slider-main" min="0" max="80"><br>
  Wave Speed <input type="range" id="waveSpeed" class="slider-main" min="0" max="0.05" step="0.001"><br>

  Hue Base <input type="range" id="hueBase" class="slider-main" min="0" max="360"><br>
  Hue Spread <input type="range" id="hueSpread" class="slider-main" min="0" max="360"><br>

  BG Alpha <input type="range" id="bgAlpha" class="slider-main" min="0" max="1" step="0.01">
  `;

  document.body.appendChild(devPanel);

  Object.keys(settings).forEach(key=>{
    const el=devPanel.querySelector(`#${key}`);
    if(!el) return;

    el.value=settings[key];

    el.oninput=e=>{
      settings[key]=parseFloat(e.target.value);
    };
  });
}

createDevPanel();

/* DRAW */

function draw(){

  requestAnimationFrame(draw);

  if(devPanel)
    devPanel.style.display =
      devPanelActive ? "block":"none";

  analyser.getByteFrequencyData(freqData);

  const bass=avg(0,30);
  const high=avg(100,180);

  frame+=settings.waveSpeed*100;

  ctx.fillStyle=`rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0,0,width,height);

  ctx.save();
  ctx.globalCompositeOperation="lighter";

  const strings=settings.stringCount;

  for(let s=0;s<strings;s++){

    const y=s*(height/strings);

    ctx.beginPath();

    for(let x=0;x<width;x+=6){

      const audioWarp=
        Math.sin(x*settings.stringTension+
        frame*0.02)*bass*settings.bassStretch;

      const yy=
        y+
        audioWarp+
        Math.sin(frame*0.01+s)*20;

      if(x===0) ctx.moveTo(x,yy);
      else ctx.lineTo(x,yy);
    }

    const hue=
      settings.hueBase+
      (s/settings.stringCount)*settings.hueSpread+
      frame*0.3;

    ctx.strokeStyle=
      `hsla(${hue},80%,60%,${high+0.2})`;

    ctx.lineWidth=1+high*2;

    ctx.stroke();

    // Sparkles
    for(let i=0;i<settings.sparkleDensity;i++){

      const px=Math.random()*width;
      const py=y+Math.random()*50;

      ctx.fillStyle=`rgba(255,255,255,${high})`;
      ctx.fillRect(px,py,2,2);
    }
  }

  ctx.restore();
}

draw();