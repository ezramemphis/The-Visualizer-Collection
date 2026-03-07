import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";

/* =====================================================
   WATERCOLOR TRIP MODE VISUALIZER
===================================================== */

let frame = 0;
let width = canvas.width;
let height = canvas.height;

/* =====================================================
   RESIZE
===================================================== */

function resize(){
  width = canvas.width;
  height = canvas.height;
}
window.addEventListener("resize", resize);

/* =====================================================
   AUDIO HELPERS
===================================================== */

function avg(s,e){
  let v=0;
  for(let i=s;i<e;i++) v+=freqData[i]||0;
  return (v/Math.max(1,e-s))/255;
}

/* =====================================================
   MOUSE FIELD INTERACTION
===================================================== */

const mouse = {
  x: width/2,
  y: height/2,
  down:false
};

window.addEventListener("mousemove",e=>{
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener("mousedown",()=> mouse.down=true);
window.addEventListener("mouseup",()=> mouse.down=false);

/* =====================================================
   PARTICLE PIGMENT FIELD
===================================================== */

const particles = [];

const SETTINGS = {

  particleCount: 500,
  mouseForce: 1.5,
  fieldNoise: 0.003,
  pigmentFlow: 0.02,
  trailFade: 0.08,

  brushRadius: 220,
  waveStrength: 0.7,

  hueBase: 180,
  hueSpread: 80,

  experimentalChaos: 0.002,
  swirlIntensity: 0.003
};

/* init particles */

function initParticles(){
  particles.length = 0;

  for(let i=0;i<SETTINGS.particleCount;i++){
    particles.push({
      x:(Math.random()-0.5)*width,
      y:(Math.random()-0.5)*height,
      vx:0,
      vy:0,
      hue:SETTINGS.hueBase + Math.random()*SETTINGS.hueSpread,
      size:1+Math.random()*2
    });
  }
}

initParticles();

/* =====================================================
   DEV PANEL
===================================================== */

let devPanel;

function createDevPanel(){

  devPanel = document.createElement("div");

  Object.assign(devPanel.style,{
    position:"fixed",
    top:"6px",
    left:"6px",
    padding:"10px",
    background:"rgba(0,0,0,0.9)",
    color:"white",
    fontFamily:"sans-serif",
    fontSize:"12px",
    borderRadius:"8px",
    maxHeight:"95vh",
    overflowY:"auto",
    display:"none",
    zIndex:9999
  });

  devPanel.innerHTML=`
  <b>WATERCOLOR TRIP ENGINE</b>

  <hr><b class="slider-main">MAIN</b>

  Particle Count
  <input type="range" id="particleCount" min="200" max="1200"><br>

  Mouse Force
  <input type="range" id="mouseForce" min="0.2" max="5" step="0.1"><br>

  Pigment Flow
  <input type="range" id="pigmentFlow" min="0.001" max="0.1" step="0.001"><br>

  Trail Fade
  <input type="range" id="trailFade" min="0" max="0.2" step="0.01"><br>

  Brush Radius
  <input type="range" id="brushRadius" min="50" max="600"><br>

  Wave Strength
  <input type="range" id="waveStrength" min="0" max="2" step="0.05"><br>

  Hue Base
  <input type="range" id="hueBase" min="0" max="360"><br>

  Hue Spread
  <input type="range" id="hueSpread" min="0" max="180"><br>

  <hr><b class="slider-exp">EXPERIMENTAL</b>

  Field Noise
  <input type="range" id="fieldNoise" min="0" max="0.02" step="0.0005"><br>

  Swirl Intensity
  <input type="range" id="swirlIntensity" min="0" max="0.02" step="0.0005"><br>

  Chaos Drift
  <input type="range" id="experimentalChaos" min="0" max="0.01" step="0.0002"><br>
  `;

  document.body.appendChild(devPanel);

  Object.keys(SETTINGS).forEach(key=>{
    const el = devPanel.querySelector(`#${key}`);
    if(!el) return;

    el.value = SETTINGS[key];

    el.addEventListener("input",e=>{
      SETTINGS[key]=parseFloat(e.target.value);

      if(key==="particleCount")
        initParticles();
    });
  });
}

createDevPanel();

/* =====================================================
   DRAW LOOP
===================================================== */

function draw(){

  requestAnimationFrame(draw);

  analyser.getByteFrequencyData(freqData);

  if(devPanel)
    devPanel.style.display = devPanelActive ? "block" : "none";

  frame++;

  const bass = avg(0,20);
  const mid = avg(20,80);
  const high = avg(80,160);

  /* TRAIL BACKGROUND */

  ctx.fillStyle=`rgba(0,0,0,${SETTINGS.trailFade})`;
  ctx.fillRect(0,0,width,height);

  ctx.save();
  ctx.translate(width/2,height/2);

  /* =========================
     PARTICLE WATER PIGMENT FLOW
  ========================= */

  particles.forEach(p=>{

    const dx = mouse.x-width/2 - p.x;
    const dy = mouse.y-height/2 - p.y;

    const dist = Math.sqrt(dx*dx+dy*dy)+0.001;

    const force =
      SETTINGS.mouseForce /
      (dist/SETTINGS.brushRadius+1);

    if(mouse.down){

      p.vx += dx/dist * force * SETTINGS.waveStrength;
      p.vy += dy/dist * force * SETTINGS.waveStrength;
    }

    /* ambient field motion */

    p.vx += Math.sin(p.y*SETTINGS.fieldNoise+frame*0.01)*0.05;
    p.vy += Math.cos(p.x*SETTINGS.fieldNoise+frame*0.01)*0.05;

    p.vx += (Math.random()-0.5)*SETTINGS.experimentalChaos;
    p.vy += (Math.random()-0.5)*SETTINGS.experimentalChaos;

    p.x += p.vx * SETTINGS.pigmentFlow * 50;
    p.y += p.vy * SETTINGS.pigmentFlow * 50;

    p.vx *= 0.95;
    p.vy *= 0.95;

    const hue =
      (SETTINGS.hueBase +
       Math.sin(frame*0.01+p.x*0.01)*SETTINGS.hueSpread) % 360;

    ctx.fillStyle=
      `hsla(${hue},80%,60%,${0.3+high})`;

    ctx.beginPath();
    ctx.arc(p.x,p.y,p.size+mid*2,0,Math.PI*2);
    ctx.fill();
  });

  ctx.restore();
}

draw();