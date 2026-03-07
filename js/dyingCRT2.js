import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let t = 0;
let frame = 0;

/* ============================
   MEMORY BUFFER
============================ */

const memCanvas = document.createElement("canvas");
const memCtx = memCanvas.getContext("2d");

/* ============================
   SETTINGS (BIG ONE)
============================ */

const settings = {

  // feedback core
  feedbackAmount: 0.92,
  feedbackZoom: 1.01,
  feedbackRotation: 0.002,

  // beam field
  beamCount: 40,
  beamLength: 300,
  beamThickness: 2,
  beamScatter: 80,

  // signal distortion
  horizontalTear: 0,
  verticalRoll: 0,
  phaseWarp: 0.5,
  curvature: 0.0008,

  // analog artifacts
  scanlineIntensity: 0.2,
  lumaBleed: 2,
  chromaDrift: 5,
  signalNoise: 0.02,

  // collapse engine
  collapseThreshold: 0.85,
  collapseStrength: 40,
  collapseSlices: 6,

  // energy
  timeSpeed: 0.03,
  brightness: 1
};

registerSceneSettings(settings);

/* ============================
   RESIZE
============================ */

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  memCanvas.width = canvas.width;
  memCanvas.height = canvas.height;
}
resize();
window.addEventListener("resize", resize);

/* ============================
   AUDIO
============================ */

function avg(start, end) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += freqData[i];
  return sum / (end - start) / 255;
}

function rand(n) { return (Math.random() - 0.5) * n; }

/* ============================
   DEV PANEL
============================ */

function createPanel(){

  const panel = document.createElement("div");

  Object.assign(panel.style,{
    position:"fixed",
    top:"5px",
    left:"5px",
    padding:"8px",
    background:"rgba(0,0,0,0.85)",
    color:"#fff",
    fontSize:"12px",
    zIndex:9999,
    display:"none",
    maxHeight:"95vh",
    overflowY:"auto"
  });

  panel.innerHTML = `
  <b>DYING CRT — HALLUCINATION MODE</b><hr>

  Feedback Amount <input type="range" id="feedbackAmount" min="0.7" max="0.99" step="0.005"><br>
  Feedback Zoom <input type="range" id="feedbackZoom" min="0.98" max="1.05" step="0.001"><br>
  Feedback Rotation <input type="range" id="feedbackRotation" min="0" max="0.01" step="0.0001"><br>

  <hr><b>BEAMS</b><hr>

  Beam Count <input type="range" id="beamCount" min="5" max="150"><br>
  Beam Length <input type="range" id="beamLength" min="50" max="800"><br>
  Beam Thickness <input type="range" id="beamThickness" min="1" max="10"><br>
  Beam Scatter <input type="range" id="beamScatter" min="0" max="300"><br>

  <hr><b>DISTORTION</b><hr>

  Horizontal Tear <input type="range" id="horizontalTear" min="0" max="200"><br>
  Vertical Roll <input type="range" id="verticalRoll" min="0" max="50"><br>
  Phase Warp <input type="range" id="phaseWarp" min="0" max="3" step="0.1"><br>
  Curvature <input type="range" id="curvature" min="0" max="0.003" step="0.0001"><br>

  <hr><b>ANALOG</b><hr>

  Scanlines <input type="range" id="scanlineIntensity" min="0" max="1" step="0.01"><br>
  Luma Bleed <input type="range" id="lumaBleed" min="0" max="10"><br>
  Chroma Drift <input type="range" id="chromaDrift" min="0" max="20"><br>
  Signal Noise <input type="range" id="signalNoise" min="0" max="0.2" step="0.005"><br>

  <hr><b>COLLAPSE</b><hr>

  Collapse Threshold <input type="range" id="collapseThreshold" min="0" max="1" step="0.01"><br>
  Collapse Strength <input type="range" id="collapseStrength" min="0" max="200"><br>
  Collapse Slices <input type="range" id="collapseSlices" min="0" max="20"><br>

  <hr>

  Time Speed <input type="range" id="timeSpeed" min="0.005" max="0.2" step="0.005"><br>
  Brightness <input type="range" id="brightness" min="0.2" max="2" step="0.05"><br>
  `;

  document.body.appendChild(panel);

  Object.keys(settings).forEach(key=>{
    const el = panel.querySelector(`#${key}`);
    if(!el) return;
    el.value = settings[key];
    el.addEventListener("input", e=>{
      settings[key] = parseFloat(e.target.value);
    });
  });

  return panel;
}

const devPanel = createPanel();

/* ============================
   DRAW
============================ */

function draw() {

  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(freqData);

  const bass = avg(0, 10);
  const mid  = avg(10, 60);
  const high = avg(60, 160);

  if(devPanel)
    devPanel.style.display = devPanelActive ? "block" : "none";

  frame++;

  /* ============================
     FEEDBACK CORE
  ============================ */

  ctx.save();
  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.rotate(settings.feedbackRotation * frame);
  ctx.scale(settings.feedbackZoom, settings.feedbackZoom);
  ctx.translate(-canvas.width/2, -canvas.height/2);

  ctx.globalAlpha = settings.feedbackAmount;
  ctx.drawImage(memCanvas, 0, 0);
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.fillStyle = `rgba(0,0,0,${0.08})`;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  /* ============================
     BEAM FIELD
  ============================ */

  ctx.save();
  ctx.translate(canvas.width/2, canvas.height/2);

  const beams = settings.beamCount + Math.floor(high*100);

  for(let i=0;i<beams;i++){

    const angle =
      (i/beams)*Math.PI*2 +
      t*settings.phaseWarp;

    const r =
      settings.beamLength *
      (0.3 + bass);

    const x =
      Math.cos(angle)*r +
      rand(settings.beamScatter*mid);

    const y =
      Math.sin(angle)*r +
      rand(settings.beamScatter*mid);

    ctx.strokeStyle =
      `hsla(${(frame*5+i*20)%360},100%,${50+high*40}%,${0.3+mid})`;

    ctx.lineWidth =
      settings.beamThickness + bass*4;

    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(x,y);
    ctx.stroke();
  }

  ctx.restore();

  /* ============================
     HORIZONTAL TEAR
  ============================ */

  if(settings.horizontalTear > 0){
    for(let i=0;i<5;i++){
      const y = Math.random()*canvas.height;
      const h = 2+Math.random()*20;
      const offset = rand(settings.horizontalTear*bass);
      ctx.drawImage(canvas,0,y,canvas.width,h,offset,y,canvas.width,h);
    }
  }

  /* ============================
     VERTICAL ROLL
  ============================ */

  if(settings.verticalRoll > 0){
    const roll = (frame*settings.verticalRoll) % canvas.height;
    ctx.drawImage(canvas,0,roll);
  }

  /* ============================
     SIGNAL COLLAPSE
  ============================ */

  if(bass > settings.collapseThreshold){
    for(let i=0;i<settings.collapseSlices;i++){
      const y = Math.random()*canvas.height;
      const h = 2+Math.random()*30;
      const offset = rand(settings.collapseStrength);
      ctx.drawImage(canvas,0,y,canvas.width,h,offset,y,canvas.width,h);
    }
  }

  /* ============================
     SCANLINES
  ============================ */

  ctx.fillStyle = `rgba(0,0,0,${settings.scanlineIntensity})`;
  for(let y=0;y<canvas.height;y+=2){
    ctx.fillRect(0,y,canvas.width,1);
  }

  /* ============================
     CHROMA DRIFT
  ============================ */

  ctx.globalCompositeOperation = "screen";
  ctx.drawImage(canvas, settings.chromaDrift*bass, 0);
  ctx.drawImage(canvas, -settings.chromaDrift*bass, 0);
  ctx.globalCompositeOperation = "source-over";

  /* ============================
     MEMORY UPDATE
  ============================ */

  memCtx.globalAlpha = settings.feedbackAmount;
  memCtx.drawImage(canvas, 0, 0);
  memCtx.globalAlpha = 1;

  t += settings.timeSpeed + bass*0.1;
}

draw();