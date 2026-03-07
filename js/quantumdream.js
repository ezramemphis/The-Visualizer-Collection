import { ctx, canvas, analyser, timeData } from "./visualizer.js";

/* ======================================================
   STATE
====================================================== */

let frame = 0;

let mouse = {
  x: canvas.width/2,
  y: canvas.height/2
};

window.addEventListener("mousemove",e=>{
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

/* ======================================================
   SETTINGS
====================================================== */

const settings = {

  backgroundFade: 0.06,

  globalScale: 1,

  ringLayers: 120,
  recursionDepth: 5,

  baseRadius: 120,

  audioPush: 300,

  turbulenceStrength: 2.5,
  quantumNoise: 0.3,

  mouseGravity: 0.0008,

  colorCycleSpeed: 2.5,

  bloomIntensity: 0.4,

  chaosPhaseSpeed: 0.02,

  harmonicWarp: 0.25,

  vortexSelfSpin: 0.01,

  spectralSpread: 45
};

/* ======================================================
   DEV PANEL (STACKED MAIN + EXP)
====================================================== */

function createDevPanel(){

  const panel = document.createElement("div");

  Object.assign(panel.style,{
    position:"fixed",
    top:"8px",
    right:"8px",
    width:"240px",
    padding:"10px",
    background:"rgba(0,0,0,0.92)",
    color:"white",
    fontFamily:"sans-serif",
    fontSize:"11px",
    borderRadius:"10px",
    zIndex:9999,
    maxHeight:"95vh",
    overflowY:"auto"
  });

  panel.innerHTML = `
  <b>HALLUCINATION OSCILLATOR</b>
  <hr>

  <div class="main">
  MAIN<hr>

  Background Fade
  <input type="range" id="backgroundFade" min="0.01" max="0.2" step="0.005"><br>

  Global Scale
  <input type="range" id="globalScale" min="0.2" max="2" step="0.05"><br>

  Ring Layers
  <input type="range" id="ringLayers" min="20" max="300"><br>

  Audio Push
  <input type="range" id="audioPush" min="50" max="800"><br>

  Turbulence
  <input type="range" id="turbulenceStrength" min="0" max="6" step="0.1"><br>

  Quantum Noise
  <input type="range" id="quantumNoise" min="0" max="1" step="0.01"><br>
  </div>

  <hr>

  <div class="exp">
  EXPERIMENTAL<hr>

  Mouse Gravity
  <input type="range" id="mouseGravity" min="0" max="0.005" step="0.0001"><br>

  Color Cycle Speed
  <input type="range" id="colorCycleSpeed" min="0" max="6" step="0.1"><br>

  Bloom Intensity
  <input type="range" id="bloomIntensity" min="0" max="1" step="0.01"><br>

  Chaos Phase Speed
  <input type="range" id="chaosPhaseSpeed" min="0" max="0.08" step="0.001"><br>

  Harmonic Warp
  <input type="range" id="harmonicWarp" min="0" max="1" step="0.01"><br>

  Vortex Spin
  <input type="range" id="vortexSelfSpin" min="0" max="0.05" step="0.001"><br>

  Spectral Spread
  <input type="range" id="spectralSpread" min="0" max="120"><br>
  </div>
  `;

  document.body.appendChild(panel);

  Object.keys(settings).forEach(key=>{
    const el = panel.querySelector(`#${key}`);
    if(!el) return;

    el.value = settings[key];

    el.addEventListener("input",e=>{
      settings[key] = parseFloat(e.target.value);
    });
  });

  return panel;
}

const devPanel = createDevPanel();

/* ======================================================
   AUDIO HELPERS
====================================================== */

function rms(){
  let s=0;
  for(let i=0;i<timeData.length;i++){
    const v=(timeData[i]-128)/128;
    s+=v*v;
  }
  return Math.sqrt(s/timeData.length);
}

/* ======================================================
   COLOR FIELD
====================================================== */

function palette(t,offset){

  const h =
    (frame*settings.colorCycleSpeed +
     t*settings.spectralSpread +
     offset) % 360;

  return `hsla(${h},100%,65%,${0.12+settings.bloomIntensity})`;
}

/* ======================================================
   DRAW
====================================================== */

export function draw(){

  requestAnimationFrame(draw);

  analyser.getByteTimeDomainData(timeData);

  frame++;

  const amp = rms();

  /* Background hallucination fade */
  ctx.fillStyle =
    `rgba(0,0,0,${settings.backgroundFade + amp*0.08})`;

  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.save();

  ctx.translate(canvas.width/2,canvas.height/2);
  ctx.scale(settings.globalScale,settings.globalScale);

  ctx.globalCompositeOperation="screen";

  const layers =
    settings.ringLayers +
    amp*180;

  /* ======================================================
     MULTI-LAYER FRACTAL RING FIELD
  ====================================================== */

  for(let i=0;i<layers;i++){

    const phase =
      frame*settings.chaosPhaseSpeed +
      i*0.25;

    const baseRadius =
      settings.baseRadius +
      Math.sin(phase*2)*amp*settings.audioPush +
      Math.cos(phase*3)*150;

    const recursion =
      1 + settings.recursionDepth;

    ctx.beginPath();

    for(let a=0;a<Math.PI*2;a+=0.1){

      let turbulence =
        Math.sin(a*8 + frame*0.02)*amp*
        settings.turbulenceStrength*120;

      let quantum =
        (Math.random()-0.5)*
        settings.quantumNoise*40;

      let mouseDist =
        Math.hypot(
          mouse.x-canvas.width/2,
          mouse.y-canvas.height/2
        );

      let gravityPull =
        settings.mouseGravity *
        mouseDist *
        baseRadius;

      let r =
        baseRadius +
        turbulence +
        quantum -
        gravityPull;

      r *= (1 + Math.sin(a*recursion + frame*0.01)*settings.harmonicWarp);

      const x = Math.cos(a+phase)*r;
      const y = Math.sin(a+phase)*r;

      a===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }

    ctx.strokeStyle = palette(i,amp*200);
    ctx.lineWidth = 1 + amp*5;
    ctx.stroke();
  }

  ctx.restore();
}

draw();