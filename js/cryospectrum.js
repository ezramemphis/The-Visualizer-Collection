import { canvas, ctx, analyser, freqData, timeData, devPanelActive } from "./visualizer.js";

/* =========================================================
   CANVAS
========================================================= */

let width = canvas.width;
let height = canvas.height;

function resize(){
  width = canvas.width;
  height = canvas.height;
}

window.addEventListener("resize", resize);

function avg(s,e){
  let v=0;
  for(let i=s;i<e;i++) v+=freqData[i];
  return v/(e-s)/255;
}

/* =========================================================
   SETTINGS
========================================================= */

const settings = {
  nodeCount: 80,
  radiusMin: 60,
  radiusMax: 260,
  nodeSize: 3,
  orbitSpeed: 0.002,
  globalRotation: 0.001,
  pulseAmount: 40,
  connectionDist: 180,
  connectionWidth: 1,
  hueStart: 180,
  hueRange: 180,
  hueShiftSpeed: 0.4,
  saturation: 80,
  lightness: 65,
  glowAlpha: 0.7,
  bgAlpha: 0.08
};

/* =========================================================
   DEV PANEL
========================================================= */

let devPanel;

function createDevPanel(){
  devPanel = document.createElement("div");

  Object.assign(devPanel.style,{
    position:"fixed",
    top:"5px",
    left:"5px",
    padding:"6px 10px",
    background:"rgba(0,0,0,0.7)",
    color:"#fff",
    fontFamily:"sans-serif",
    fontSize:"12px",
    borderRadius:"4px",
    zIndex:9999,
    display:"none",
    maxHeight:"95vh",
    overflowY:"auto"
  });

  devPanel.innerHTML=`
  <div style="font-weight:bold;font-size:10px;margin-bottom:6px">
  DEV PANEL
  </div>

  Node Count <input id="devNodeCount" type="range" class="slider-main" min="20" max="200" value="${settings.nodeCount}"><br>
  Node Size <input id="devNodeSize" type="range" class="slider-main" min="1" max="10" step="0.5" value="${settings.nodeSize}"><br>
  Orbit Speed <input id="devOrbitSpeed" type="range" class="slider-main" min="0.0005" max="0.01" step="0.0005" value="${settings.orbitSpeed}"><br>
  Rotation <input id="devGlobalRot" type="range" class="slider-main" min="0" max="0.01" step="0.0005" value="${settings.globalRotation}"><br>
  Pulse <input id="devPulse" type="range" class="slider-main" min="0" max="200" value="${settings.pulseAmount}"><br>
  Connection Dist <input id="devConnDist" type="range" class="slider-main" min="50" max="400" value="${settings.connectionDist}"><br>
  Connection Width <input id="devConnWidth" type="range" class="slider-main" min="0.1" max="5" step="0.1" value="${settings.connectionWidth}"><br>
  Hue Start <input id="devHueStart" type="range" class="slider-main" min="0" max="360" value="${settings.hueStart}"><br>
  Hue Shift <input id="devHueShift" type="range" class="slider-main" min="0" max="2" step="0.05" value="${settings.hueShiftSpeed}"><br>
  Saturation <input id="devSat" type="range" class="slider-main" min="0" max="100" value="${settings.saturation}"><br>
  Lightness <input id="devLight" type="range" class="slider-main" min="0" max="100" value="${settings.lightness}"><br>
  Glow <input id="devGlow" type="range" class="slider-main" min="0" max="1" step="0.01" value="${settings.glowAlpha}"><br>
  BG Fade <input id="devBgAlpha" type="range" class="slider-main" min="0" max="1" step="0.01" value="${settings.bgAlpha}">
  `;

  document.body.appendChild(devPanel);

  const bind=(id,key,parser=parseFloat)=> {
    document.getElementById(id).addEventListener("input",e=>{
      settings[key]=parser(e.target.value);
      if(key==="nodeCount") initNodes();
    });
  };

  bind("devNodeCount","nodeCount",parseInt);
  bind("devNodeSize","nodeSize");
  bind("devOrbitSpeed","orbitSpeed");
  bind("devGlobalRot","globalRotation");
  bind("devPulse","pulseAmount");
  bind("devConnDist","connectionDist");
  bind("devConnWidth","connectionWidth");
  bind("devHueStart","hueStart",parseInt);
  bind("devHueShift","hueShiftSpeed");
  bind("devSat","saturation",parseInt);
  bind("devLight","lightness",parseInt);
  bind("devGlow","glowAlpha");
  bind("devBgAlpha","bgAlpha");
}

createDevPanel();

/* =========================================================
   NODE SYSTEM
========================================================= */

let nodes=[];
let frame=0;

class Node{
  constructor(){
    this.angle=Math.random()*Math.PI*2;
    this.baseRadius=settings.radiusMin+
      Math.random()*(settings.radiusMax-settings.radiusMin);
    this.sizeOffset=Math.random()*5;
    this.colorOffset=Math.random()*settings.hueRange;
  }

  update(bass,mid){
    this.angle+=settings.orbitSpeed+bass*0.003;

    const pulse=Math.sin(frame*0.02+this.colorOffset)*
      settings.pulseAmount*mid;

    const radius=this.baseRadius+pulse;

    this.x=Math.cos(this.angle)*radius;
    this.y=Math.sin(this.angle)*radius;
  }

  draw(mid,high){
    const hue=(
      settings.hueStart+
      this.colorOffset+
      frame*settings.hueShiftSpeed
    )%360;

    const size=
      settings.nodeSize+
      this.sizeOffset+
      mid*4+
      high*2;

    ctx.fillStyle=
      `hsla(${hue},${settings.saturation}%,${settings.lightness}%,${settings.glowAlpha})`;

    ctx.beginPath();
    ctx.arc(this.x,this.y,size,0,Math.PI*2);
    ctx.fill();
  }
}

function initNodes(){
  nodes=[];
  for(let i=0;i<settings.nodeCount;i++)
    nodes.push(new Node());
}

initNodes();

/* =========================================================
   GLOBAL UTILITY
========================================================= */

function clampCV(min,max,v){
  return min + v*(max-min);
}

function mapMidi(normalized, min, max){
  return min + normalized * (max - min);
}

/* When button releases, drift to random nearby value */
function randomRelax(value, range=0.15){
  const delta = (Math.random()-0.5) * range;
  return Math.max(0, Math.min(1, value + delta));
}

/* =========================================================
   MIDI STATE
========================================================= */

const MIDI_SMOOTHING = 0.15;
const midiMemory = {};

/* =========================================================
   SIDEBAR INDICATOR
========================================================= */

const midiIndicator = document.createElement("div");

Object.assign(midiIndicator.style,{
  position:"fixed",
  right:"0",
  top:"0",
  width:"18px",
  height:"100vh",
  background:"linear-gradient(to bottom,#00aaff,#444)",
  opacity:"0.85",
  zIndex:"9998",
  display:"none"
});

document.body.appendChild(midiIndicator);

const midiIndicatorFill = document.createElement("div");

Object.assign(midiIndicatorFill.style,{
  position:"absolute",
  bottom:"0",
  width:"100%",
  background:"#222",
  transition:"height 0.05s linear"
});

midiIndicator.appendChild(midiIndicatorFill);

/* =========================================================
   MIDI MONITOR PANEL
========================================================= */

const midiMonitor = document.createElement("div");

Object.assign(midiMonitor.style,{
  position:"fixed",
  left:"5px",
  bottom:"5px",
  background:"rgba(0,0,0,0.85)",
  color:"#00ffcc",
  fontFamily:"monospace",
  fontSize:"11px",
  padding:"6px",
  borderRadius:"4px",
  zIndex:"10000",
  minWidth:"230px",
  maxHeight:"220px",
  overflowY:"auto",
  display:"none"
});

document.body.appendChild(midiMonitor);

/* =========================================================
   SMOOTHING ENGINE
========================================================= */

function smooth(oldVal,newVal){
  if(oldVal===undefined) return newVal;
  return oldVal + MIDI_SMOOTHING*(newVal-oldVal);
}

/* =========================================================
   ADSR ENGINE
========================================================= */

class ADSR {

  constructor(){
    this.attack = 0.02;
    this.decay = 0.05;
    this.sustain = 0.7;
    this.release = 1.5;

    this.active = false;
    this.time = 0;

    this.assignedParam = null;
    this.baseMin = 0;
    this.baseMax = 1;

    this.value = 0;
  }

  trigger(){
    this.active = true;
    this.time = 0;
  }

  releaseGate(){
    this.active = false;
    this.time = 0;
  }

  update(dt){

    if(this.active){

      this.time += dt;

      if(this.time < this.attack){
        this.value = this.time / this.attack;
      }
      else if(this.time < this.attack + this.decay){
        const t = (this.time - this.attack) / this.decay;
        this.value = 1 - (1-this.sustain)*t;
      }
      else{
        this.value = this.sustain;
      }

    } else {

      this.time += dt;

      if(this.value > 0){
        this.value *= Math.exp(-dt/this.release);
      }
    }

    if(this.assignedParam){
      settings[this.assignedParam] =
        clampCV(this.baseMin,this.baseMax,this.value);
    }
  }
}

/* =========================================================
   ADSR POOL
========================================================= */

const ADSR_COUNT = 8;
const adsrSlots = [];

for(let i=0;i<ADSR_COUNT;i++)
  adsrSlots.push(new ADSR());

/* =========================================================
   MIDI HANDLER
========================================================= */

function handleMIDI(event){

  const data = event.data;
  if(!data || data.length < 3) return;

  const [status,control,value] = data;

  const normalized = value / 127;

  const visible = devPanelActive;

  midiIndicator.style.display = visible ? "block" : "none";
  midiMonitor.style.display = visible ? "block" : "none";

  midiIndicatorFill.style.height =
    `${(1-normalized)*100}%`;

  midiMonitor.innerHTML = `
MIDI MONITOR
------------
Status: ${status}
Control: ${control}
Raw Value: ${value}
Normalized: ${normalized.toFixed(5)}
Time: ${performance.now().toFixed(2)} ms
`;








/* ================================
   SIMPLE BUTTON → NODE COUNT CONTROL
   status = 153
   control = 0
================================ */

if(status === 153 && control === 0){

  const normalized = (value+20)/ 127;

  const min = 20;
  const max = 200;

  const target = min + normalized*(max-min);

  settings.nodeCount = Math.floor(target);

  initNodes();

  return;
}

/* ================================
   SIMPLE BUTTON → NODE COUNT CONTROL
   status = 153
   control = 1
================================ */

if(status === 177 && control === 51){

  const normalized = value / 127;

  const min = 20;
  const max = 200;

  const target = min + normalized*(max-min);

  settings.orbitSpeed = Math.floor(target);

  initNodes();

  return;
}

if(status === 176 && control === 51){

  const normalized = value / 127;

  const min = 20;
  const max = 200;

  const target = min + normalized*(max-min);

  settings.hueStart = Math.floor(target);

  initNodes();

  return;
}

if(status === 145 && control === 54){

  const normalized = value / 127;
  const min = 20;
  const max = 300;
  const target = min + normalized*(max-min);
  settings.bgAlpha = Math.floor(target);
  initNodes();

  return;
}


if(status === 153 && control === 1){

  const normalized = value + 39 / 127;
  const min = 20;
  const max = 200;
  const target = min + normalized*(max-min);
  settings.lightness = Math.floor(target);
  initNodes();

  return;
}

if(status === 153 && control === 2){

  const normalized = value / 127;
  const min = 20;
  const max = 200;
  const target = min + normalized*(max-min);
  settings.pulseAmount = Math.floor(target);
  initNodes();

  return;
}

if(status === 153 && control === 3){

  const normalized = value / 127;
  const min = 20;
  const max = 200;
  const target = min + normalized*(max-min);
  settings.saturation = Math.floor(target);
  initNodes();

  return;
}

if(status === 153 && control === 4){

  const normalized = value / 127;
  const min = 20;
  const max = 200;
  const target = min + normalized*(max-min);
  settings.glowAlpha = Math.floor(target);
  initNodes();

  return;
}

if(status === 153 && control === 5){

  const normalized = value / 127;
  const min = 20;
  const max = 200;
  const target = min + normalized*(max-min);
  settings.bgAlpha = Math.floor(target);
  initNodes();

  return;
}




  if(status !== 176) return;

  const mapping = {
    21:["orbitSpeed",0.0005,0.01],
    22:["globalRotation",0,0.01],
    23:["pulseAmount",0,200],
    24:["connectionDist",50,400],
    25:["hueShiftSpeed",0,2],
    26:["nodeCount",20,200,true],
    27:["bgAlpha",0,1],
    28:["glowAlpha",0,1],
    29:["saturation",0,100],
    30:["lightness",0,100]
  };

  const mapEntry = mapping[control];
  if(!mapEntry) return;

  const [key,min,max,isInt] = mapEntry;

  const target = min + normalized*(max-min);

  const smoothVal = smooth(midiMemory[control],target);
  midiMemory[control] = smoothVal;

  settings[key] = isInt
    ? Math.floor(smoothVal)
    : smoothVal;

  if(key === "nodeCount")
    initNodes();
}

/* =========================================================
   MIDI INITIALIZATION
========================================================= */

navigator.requestMIDIAccess().then(access=>{

  for(let input of access.inputs.values()){
    console.log("Connected MIDI Device:",input.name);
    input.onmidimessage = handleMIDI;
  }

}).catch(err=>{
  console.error("MIDI Access Failed",err);
});



/* =========================================================
   DRAW LOOP
========================================================= */

function draw(){
  requestAnimationFrame(draw);

  devPanel.style.display=
    devPanelActive?"block":"none";

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  const bass=avg(0,12);
  const mid=avg(30,90);
  const high=avg(100,180);

  frame++;

  ctx.fillStyle=`rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0,0,width,height);

  ctx.save();
  ctx.translate(width/2,height/2);
  ctx.rotate(frame*settings.globalRotation);

  ctx.globalCompositeOperation="lighter";

  for(let i=0;i<nodes.length;i++){
    for(let j=i+1;j<nodes.length;j++){

      const dx=nodes[i].x-nodes[j].x;
      const dy=nodes[i].y-nodes[j].y;
      const dist=Math.sqrt(dx*dx+dy*dy);

      if(dist<settings.connectionDist+bass*200){

        ctx.strokeStyle=
          `hsla(${settings.hueStart},${settings.saturation}%,${settings.lightness}%,${1-dist/settings.connectionDist})`;

        ctx.lineWidth=settings.connectionWidth+high*2;

        ctx.beginPath();
        ctx.moveTo(nodes[i].x,nodes[i].y);
        ctx.lineTo(nodes[j].x,nodes[j].y);
        ctx.stroke();
      }
    }
  }

  for(let n of nodes){
    n.update(bass,mid);
    n.draw(mid,high);
  }

  ctx.restore();
  ctx.globalCompositeOperation="source-over";
}

draw();
