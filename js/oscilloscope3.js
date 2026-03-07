import { ctx, canvas, analyser, timeData, freqData, devPanelActive } from "./visualizer.js";

/* ======================================================
STATE
====================================================== */

let frame = 0;
let width = canvas.width;
let height = canvas.height;

let ampSmooth = 0;

/* ======================================================
RESIZE
====================================================== */

window.addEventListener("resize", () => {
  width = canvas.width;
  height = canvas.height;
});

/* ======================================================
SETTINGS
====================================================== */

const settings = {

  /* ===== MAIN ===== */

  attack: 0.18,
  release: 0.03,

  trailFade: 0.07,

  waveformHeight: 0.32,
  glowIntensity: 0.7,

  filterStrength: 0.6,
  resonance: 0.4,

  rmDistortion: 0.5,

  bassReactZoom: 0.6,

  ghostLayers: 3,

  noiseInject: 0.02,

  hueBase: 190,

  hueSpread: 120,

  lineWidth: 2,

  /* ===== EXPERIMENTAL ===== */

  vortexFeedback: 0.5,
  spiralWarp: 0.3,
  chaoticPhase: 0.4,

  harmonicEcho: 0.6,
  spectralScatter: 0.5,

  particleSpray: 0.3
};

/* ======================================================
DEV PANEL
====================================================== */

let devPanel;

function createDevPanel(){

  devPanel = document.createElement("div");

  Object.assign(devPanel.style,{
    position:"fixed",
    top:"6px",
    left:"6px",
    padding:"10px",
    background:"rgba(0,0,0,0.92)",
    color:"#fff",
    fontFamily:"sans-serif",
    fontSize:"12px",
    borderRadius:"8px",
    maxHeight:"95vh",
    overflowY:"auto",
    zIndex:9999,
    display:"none"
  });

  devPanel.innerHTML = `
  <b>RM EXPERIMENTAL OSCILLOSCOPE</b>

  <hr>
  <b class="slider-main">MAIN</b><hr>

  Attack
  <input type="range" id="attack" min="0.05" max="0.5" step="0.01"><br>

  Release
  <input type="range" id="release" min="0.005" max="0.1" step="0.001"><br>

  Trail Fade
  <input type="range" id="trailFade" min="0" max="0.2" step="0.01"><br>

  Wave Height
  <input type="range" id="waveformHeight" min="0.1" max="0.8" step="0.01"><br>

  Glow Intensity
  <input type="range" id="glowIntensity" min="0" max="2" step="0.05"><br>

  Filter Strength
  <input type="range" id="filterStrength" min="0" max="1" step="0.01"><br>

  Resonance
  <input type="range" id="resonance" min="0" max="1" step="0.01"><br>

  RM Distortion
  <input type="range" id="rmDistortion" min="0" max="2" step="0.01"><br>

  Ghost Layers
  <input type="range" id="ghostLayers" min="1" max="8" step="1"><br>

  Noise Inject
  <input type="range" id="noiseInject" min="0" max="0.2" step="0.005"><br>

  Hue Base
  <input type="range" id="hueBase" min="0" max="360"><br>

  Hue Spread
  <input type="range" id="hueSpread" min="0" max="360"><br>

  Line Width
  <input type="range" id="lineWidth" min="1" max="8" step="0.1"><br>

  <hr>
  <b class="slider-exp">EXPERIMENTAL</b><hr>

  Vortex Feedback
  <input type="range" id="vortexFeedback" min="0" max="1" step="0.01"><br>

  Spiral Warp
  <input type="range" id="spiralWarp" min="0" max="1" step="0.01"><br>

  Chaotic Phase
  <input type="range" id="chaoticPhase" min="0" max="1" step="0.01"><br>

  Harmonic Echo
  <input type="range" id="harmonicEcho" min="0" max="1" step="0.01"><br>

  Spectral Scatter
  <input type="range" id="spectralScatter" min="0" max="1" step="0.01"><br>

  Particle Spray
  <input type="range" id="particleSpray" min="0" max="1" step="0.01"><br>
  `;

  document.body.appendChild(devPanel);

  Object.keys(settings).forEach(key=>{
    const el = devPanel.querySelector(`#${key}`);
    if(!el) return;

    el.value = settings[key];

    el.addEventListener("input", e=>{
      settings[key] = parseFloat(e.target.value);
    });
  });
}

createDevPanel();

/* ======================================================
AUDIO HELPERS
====================================================== */

function rmsAmplitude(){
  let sum=0;
  for(let i=0;i<timeData.length;i++){
    const v=(timeData[i]-128)/128;
    sum+=v*v;
  }
  return Math.sqrt(sum/timeData.length);
}

/* ======================================================
DRAW
====================================================== */

export function draw(){

  requestAnimationFrame(draw);

  frame++;

  if(devPanel)
    devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);

  const ampRaw = rmsAmplitude();

  /* Smooth amplitude envelope */

  if(ampRaw > ampSmooth){
    ampSmooth += (ampRaw-ampSmooth)*settings.attack;
  }
  else{
    ampSmooth += (ampRaw-ampSmooth)*settings.release;
  }

  /* ===== TRAIL FEEDBACK ===== */

  ctx.fillStyle = `rgba(0,0,0,${settings.trailFade})`;
  ctx.fillRect(0,0,width,height);

  const centerY = height/2;
  const slice = width/timeData.length;

  const bass =
    freqData.slice(0,20)
    .reduce((a,b)=>a+b,0)/20/255;

  const zoom =
    1 + bass * settings.bassReactZoom;

  /* ======================================================
     MULTI LAYER OSCILLOSCOPE FIELD
  ====================================================== */

  for(let layer=0; layer<settings.ghostLayers; layer++){

    const layerOffset =
      Math.sin(frame*0.01 + layer)*20;

    ctx.beginPath();

    ctx.lineWidth =
      settings.lineWidth +
      ampSmooth*3;

    const hue =
      settings.hueBase +
      layer*settings.hueSpread +
      frame*settings.glowIntensity;

    ctx.strokeStyle =
      `hsla(${hue%360},100%,65%,0.9)`;

    let x=0;

    for(let i=0;i<timeData.length;i++){

      let v=(timeData[i]-128)/128;

      /* RM distortion field */

      v += Math.sin(
        i*0.03 +
        frame*0.05 +
        ampSmooth*settings.rmDistortion
      ) * 0.3;

      /* Noise injection */

      v += (Math.random()-0.5)*settings.noiseInject;

      /* Phase chaos */

      v += Math.sin(
        frame*0.02 +
        i*settings.chaoticPhase
      )*0.2;

      let y =
        centerY +
        v * height * settings.waveformHeight * zoom +
        layerOffset;

      if(i===0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);

      x+=slice;
    }

    ctx.stroke();
  }

  /* ======================================================
     HARMONIC PARTICLE SPARK FIELD
  ====================================================== */

  const particles =
    Math.floor(ampSmooth * 300 * settings.particleSpray);

  for(let i=0;i<particles;i++){

    const angle=Math.random()*Math.PI*2;
    const dist=Math.random()*width*0.5;

    ctx.fillStyle=
      `hsla(${(frame*2+i*10)%360},100%,70%,0.6)`;

    ctx.fillRect(
      Math.cos(angle)*dist,
      Math.sin(angle)*dist,
      2,
      2
    );
  }
}

draw();