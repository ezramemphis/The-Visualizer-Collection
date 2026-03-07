// ===============================
// VISUALIZER C — QUANTUM FLUID FIELD (ULTRA EDITION)
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

  /* PARTICLES */

  particleCount:1500,
  particleSize:2,
  particleLifeMin:80,
  particleLifeMax:260,
  spawnRate:40,

  velocityDrag:0.94,

  /* FLOW FIELD */

  flowScale:0.002,
  flowStrength:3,

  noiseWarp:0.003,

  /* AUDIO REACTION */

  bassTurbulence:6,
  midTurbulence:3,
  highSpin:4,

  energyMult:2.5,

  bassShockwave:4,

  /* GRAVITY */

  vortexPull:0.004,
  vortexCount:3,
  gravityCollapse:0.002,

  /* COLOR SYSTEM */

  colorMode:0, // 0 rainbow 1 single

  hueBase:200,
  hueRangeMin:160,
  hueRangeMax:320,
  hueSpeed:1,

  saturation:90,
  lightness:60,
  alpha:0.9,

  /* TRAILS */

  trailAlpha:0.07,

  /* GLITCH */

  glitchSlices:0

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
PARTICLE SYSTEM
====================================================== */

const particles=[];

function spawnParticle(x,y){

  const life =
    settings.particleLifeMin +
    Math.random()*
    (settings.particleLifeMax-settings.particleLifeMin);

  particles.push({

    x:x ?? Math.random()*width,
    y:y ?? Math.random()*height,

    vx:(Math.random()-0.5)*2,
    vy:(Math.random()-0.5)*2,

    life:life,
    maxLife:life

  });

}

function spawnParticles(){

  particles.length=0;

  for(let i=0;i<settings.particleCount;i++)
    spawnParticle();

}

spawnParticles();

/* ======================================================
VORTEX SYSTEM
====================================================== */

const vortexes=[];

function spawnVortex(){

  vortexes.push({

    x:Math.random()*width,
    y:Math.random()*height,

    strength:
      settings.vortexPull*
      (0.5+Math.random()*2),

    life:400+Math.random()*400

  });

  if(vortexes.length>settings.vortexCount)
    vortexes.shift();

}

/* ======================================================
DEV PANEL
====================================================== */

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

<b>QUANTUM FLUID ULTRA</b><hr>

Particle Count <input type="range" id="particleCount" min="100" max="6000"><br>
Particle Size <input type="range" id="particleSize" min="0.5" max="8" step="0.1"><br>

Life Min <input type="range" id="particleLifeMin" min="20" max="300"><br>
Life Max <input type="range" id="particleLifeMax" min="50" max="500"><br>

Spawn Rate <input type="range" id="spawnRate" min="0" max="200"><br>

Velocity Drag <input type="range" id="velocityDrag" min="0.85" max="0.99" step="0.001"><br>

<hr>

Flow Scale <input type="range" id="flowScale" min="0.0005" max="0.01" step="0.0001"><br>
Flow Strength <input type="range" id="flowStrength" min="0" max="10" step="0.1"><br>

Noise Warp <input type="range" id="noiseWarp" min="0" max="0.02" step="0.0001"><br>

<hr>

Bass Turbulence <input type="range" id="bassTurbulence" min="0" max="20"><br>
Mid Turbulence <input type="range" id="midTurbulence" min="0" max="20"><br>
High Spin <input type="range" id="highSpin" min="0" max="20"><br>

Energy Mult <input type="range" id="energyMult" min="0" max="6" step="0.1"><br>

Bass Shockwave <input type="range" id="bassShockwave" min="0" max="20"><br>

<hr>

Vortex Pull <input type="range" id="vortexPull" min="0" max="0.02" step="0.0001"><br>
Vortex Count <input type="range" id="vortexCount" min="0" max="10"><br>

Gravity Collapse <input type="range" id="gravityCollapse" min="0" max="0.01" step="0.0001"><br>

<hr>

Color Mode <input type="range" id="colorMode" min="0" max="1"><br>

Hue Base <input type="range" id="hueBase" min="0" max="360"><br>
Hue Min <input type="range" id="hueRangeMin" min="0" max="360"><br>
Hue Max <input type="range" id="hueRangeMax" min="0" max="360"><br>
Hue Speed <input type="range" id="hueSpeed" min="0" max="5" step="0.01"><br>

Saturation <input type="range" id="saturation" min="0" max="100"><br>
Lightness <input type="range" id="lightness" min="0" max="100"><br>
Alpha <input type="range" id="alpha" min="0" max="1" step="0.01"><br>

<hr>

Trail Alpha <input type="range" id="trailAlpha" min="0" max="0.4" step="0.01"><br>

Glitch Slices <input type="range" id="glitchSlices" min="0" max="80"><br>

`;

  document.body.appendChild(devPanel);

  Object.keys(settings).forEach(key=>{

    const el=devPanel.querySelector(`#${key}`);
    if(!el) return;

    el.value=settings[key];

    el.addEventListener("input",e=>{

      settings[key]=parseFloat(e.target.value);

      if(key==="particleCount")
        spawnParticles();

    });

  });

}

createDevPanel();

/* ======================================================
FLOW FIELD
====================================================== */

function flowAngle(x,y,bass,mid,high){

  const n =
    Math.sin(x*settings.flowScale + frame*0.01) +
    Math.cos(y*settings.flowScale + frame*0.013);

  const swirl =
    Math.sin((x+y)*settings.noiseWarp + frame*0.02);

  return n*settings.flowStrength
       + swirl*mid*settings.midTurbulence
       + high*settings.highSpin
       + bass*settings.bassTurbulence;

}

/* ======================================================
DRAW
====================================================== */

function draw(){

  requestAnimationFrame(draw);

  if(devPanel)
    devPanel.style.display =
      devPanelActive ? "block":"none";

  analyser.getByteFrequencyData(freqData);

  const bass = avg(0,20);
  const mid = avg(20,90);
  const high = avg(90,180);

  frame++;

  ctx.fillStyle=`rgba(0,0,0,${settings.trailAlpha})`;
  ctx.fillRect(0,0,width,height);

  ctx.globalCompositeOperation="lighter";

  /* bass vortex spawn */

  if(bass>0.85 && Math.random()<0.2)
    spawnVortex();

  /* beat particle burst */

  if(bass>0.9){

    for(let i=0;i<settings.bassShockwave*5;i++)
      spawnParticle(width/2,height/2);

  }

  /* particle spawn rate */

  for(let i=0;i<settings.spawnRate;i++)
    spawnParticle();

  /* vortex update */

  vortexes.forEach(v=>v.life--);

  /* particles */

  for(let i=particles.length-1;i>=0;i--){

    const p=particles[i];

    const angle =
      flowAngle(p.x,p.y,bass,mid,high);

    const energy =
      0.3 +
      (bass+mid+high)*settings.energyMult;

    p.vx += Math.cos(angle)*energy;
    p.vy += Math.sin(angle)*energy;

    vortexes.forEach(v=>{

      const dx=v.x-p.x;
      const dy=v.y-p.y;

      const dist=Math.sqrt(dx*dx+dy*dy)+1;

      const force=v.strength/dist;

      p.vx += dx*force;
      p.vy += dy*force;

    });

    const cx=width/2;
    const cy=height/2;

    p.vx += (cx-p.x)
            *settings.gravityCollapse
            *bass;

    p.vy += (cy-p.y)
            *settings.gravityCollapse
            *bass;

    p.x+=p.vx;
    p.y+=p.vy;

    p.vx*=settings.velocityDrag;
    p.vy*=settings.velocityDrag;

    p.life--;

    if(p.life<=0){

      particles.splice(i,1);
      continue;

    }

    const lifeFade =
      p.life/p.maxLife;

    let hue;

    if(settings.colorMode===1){

      hue=settings.hueBase;

    } else {

      const range =
        settings.hueRangeMax
        -settings.hueRangeMin;

      hue=
        settings.hueRangeMin+
        ((frame*settings.hueSpeed
        +p.x*0.05)
        %range);

    }

    ctx.fillStyle=
      `hsla(${hue},
       ${settings.saturation}%,
       ${settings.lightness}%,
       ${settings.alpha*lifeFade})`;

    ctx.fillRect(
      p.x,
      p.y,
      settings.particleSize,
      settings.particleSize
    );

  }

  /* glitch */

  if(settings.glitchSlices>0){

    for(let i=0;i<settings.glitchSlices;i++){

      const y=Math.random()*height;
      const h=Math.random()*20+3;
      const offset=(Math.random()-0.5)*80;

      ctx.drawImage(canvas,
        0,y,width,h,
        offset,y,width,h);

    }

  }

}

draw();