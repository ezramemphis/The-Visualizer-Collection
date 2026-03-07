import {
  ctx,
  canvas,
  analyser,
  timeData,
  freqData,
  devPanelActive
} from "./visualizer.js";

/* ======================================================
STATE
====================================================== */

let frame = 0;
let width = canvas.width;
let height = canvas.height;

window.addEventListener("resize", () => {
  width = canvas.width;
  height = canvas.height;
});

/* ======================================================
SETTINGS
====================================================== */

const settings = {

  /* ================= MAIN ================= */

  mode: 0,                 // 0=line,1=mirror,2=ribbon,3=radial,4=3d,5=laser
  lineWidth: 2,
  amplitude: 1,
  zoom: 1,
  persistence: 0.15,
  glowStrength: 0.6,
  hueShiftSpeed: 0.6,
  colorSpread: 40,

  mirror: 1,
  ribbonThickness: 40,
  radialRadius: 250,

  bassZoom: 1,
  midWarp: 0.5,

  /* ============== EXPERIMENTAL ============== */

  rgbSplit: 0,
  noiseDistortion: 0,
  phaseShift: .1,
  perspectiveWarp: 0,
  particleSpray: 0,
  verticalDrift: 0,
  chaosJitter: 0,
  vectorBloom: 0.7
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
    background:"rgba(0,0,0,0.9)",
    color:"white",
    fontFamily:"sans-serif",
    fontSize:"12px",
    borderRadius:"8px",
    maxHeight:"95vh",
    overflowY:"auto",
    zIndex:9999,
    display:"none"
  });

  devPanel.innerHTML = `
  <b>OSCILLOSCOPE ENGINE</b>
  <hr>
  <b>MAIN</b><hr>

  Mode
  <input type="range" id="mode" class="slider-main" min="0" max="5" step="1"><br>

  Line Width
  <input type="range" id="lineWidth" class="slider-main" min="0.5" max="10" step="0.1"><br>

  Amplitude
  <input type="range" id="amplitude" class="slider-main" min="0.1" max="3" step="0.1"><br>

  Zoom
  <input type="range" id="zoom" class="slider-main" min="0.5" max="3" step="0.1"><br>

  Persistence
  <input type="range" id="persistence" class="slider-main" min="0" max="0.4" step="0.01"><br>

  Glow Strength
  <input type="range" id="glowStrength" class="slider-main" min="0" max="2" step="0.1"><br>

  Hue Speed
  <input type="range" id="hueShiftSpeed" class="slider-main" min="0" max="3" step="0.1"><br>

  Ribbon Thickness
  <input type="range" id="ribbonThickness" class="slider-main" min="5" max="200"><br>

  Radial Radius
  <input type="range" id="radialRadius" class="slider-main" min="50" max="500"><br>

  <hr>
  <b>EXPERIMENTAL</b><hr>

  RGB Split
  <input type="range" id="rgbSplit" class="slider-exp" min="0" max="20"><br>

  Noise Distortion
  <input type="range" id="noiseDistortion" class="slider-exp" min="0" max="2" step="0.05"><br>

  Phase Shift
  <input type="range" id="phaseShift" class="slider-exp" min="0" max="2" step="0.05"><br>

  Perspective Warp
  <input type="range" id="perspectiveWarp" class="slider-exp" min="0" max="1" step="0.05"><br>

  Particle Spray
  <input type="range" id="particleSpray" class="slider-exp" min="0" max="300"><br>

  Chaos Jitter
  <input type="range" id="chaosJitter" class="slider-exp" min="0" max="20"><br>

  Vector Bloom
  <input type="range" id="vectorBloom" class="slider-exp" min="0" max="2" step="0.1"><br>
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

function getBass(){
  analyser.getByteFrequencyData(freqData);
  let sum = 0;
  for(let i=0;i<20;i++) sum+=freqData[i];
  return (sum/20)/255;
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

  const bass = getBass();

  ctx.fillStyle = `rgba(0,0,0,${settings.persistence})`;
  ctx.fillRect(0,0,width,height);

  ctx.save();
  ctx.translate(width/2,height/2);

  const hue = frame * settings.hueShiftSpeed;

  const slice = width / timeData.length;

  const zoom = settings.zoom + bass * settings.bassZoom;

  for(let layer=0; layer<settings.vectorBloom*3; layer++){

    ctx.beginPath();
    ctx.lineWidth = settings.lineWidth;
    ctx.strokeStyle =
      `hsla(${(hue + layer*settings.colorSpread)%360},100%,60%,${settings.glowStrength})`;

    let x = -width/2;

    for(let i=0;i<timeData.length;i++){

      let v = (timeData[i] - 128)/128;

      v *= settings.amplitude;

      v += Math.sin(i*0.02 + frame*0.05)*settings.noiseDistortion;

      v += Math.sin(frame*0.02 + i*settings.phaseShift)*0.3;

      v += (Math.random()-0.5)*settings.chaosJitter*0.01;

      let y = v * height * 0.4;

      if(settings.mode===3){
        const angle = i/timeData.length * Math.PI*2;
        const r = settings.radialRadius + y*zoom;
        const rx = Math.cos(angle)*r;
        const ry = Math.sin(angle)*r;
        i===0?ctx.moveTo(rx,ry):ctx.lineTo(rx,ry);
        continue;
      }

      y *= zoom;

      if(settings.mode===1 && settings.mirror){
        i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        ctx.lineTo(x,-y);
      }
      else{
        i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }

      x+=slice;
    }

    ctx.stroke();
  }

  ctx.restore();
}

draw();