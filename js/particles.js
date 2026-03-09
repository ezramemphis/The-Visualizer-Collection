import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";

/* ======================================================
ALT / VIS — CHAOTIC AUDIO ORGANISM
completely new particle architecture
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

particles: 1400,

baseSpeed: 0.6,
orbitForce: 1.4,
turbulence: 1.2,
bassExplosion: 4,

trailFade: 0.05,
lineWidth: 1.1,

hueSpeed: 0.4,

};

/* ======================================================
AUDIO
====================================================== */

function band(i){
  return freqData[i] / 255;
}

function rms(){

  let s=0;

  for(let i=0;i<freqData.length;i++){
    let v=freqData[i]/255;
    s+=v*v;
  }

  return Math.sqrt(s/freqData.length);

}

function bass(){ return band(5); }
function mids(){ return band(40); }
function highs(){ return band(120); }

/* ======================================================
PARTICLE SYSTEM
====================================================== */

let particles = [];
let attractors = [];

function init(){

particles=[];
attractors=[];

/* particles */

for(let i=0;i<settings.particles;i++){

particles.push({

x:Math.random()*width,
y:Math.random()*height,

vx:0,
vy:0,

life:Math.random()*100,

band:Math.floor(Math.random()*120),

});

}

/* moving attractors */

for(let i=0;i<5;i++){

attractors.push({

x:Math.random()*width,
y:Math.random()*height,

phase:Math.random()*10

});

}

}

init();

/* ======================================================
DEV PANEL
====================================================== */

let panel = document.createElement("div");

Object.assign(panel.style,{
position:"fixed",
top:"10px",
left:"10px",
background:"rgba(0,0,0,0.85)",
color:"#fff",
padding:"10px",
fontFamily:"monospace",
fontSize:"12px",
borderRadius:"6px",
zIndex:9999,
maxHeight:"90vh",
overflowY:"auto",
display:"none"
});

panel.innerHTML=`

<b>CHAOTIC AUDIO ORGANISM</b><hr>

Particles <input id="particles" type="range" min="200" max="4000"><br>

Base Speed <input id="baseSpeed" type="range" min="0" max="3" step="0.1"><br>

Orbit Force <input id="orbitForce" type="range" min="0" max="4" step="0.1"><br>

Turbulence <input id="turbulence" type="range" min="0" max="4" step="0.1"><br>

Bass Explosion <input id="bassExplosion" type="range" min="0" max="10" step="0.2"><br>

Trail Fade <input id="trailFade" type="range" min="0.005" max="0.2" step="0.005"><br>

Line Width <input id="lineWidth" type="range" min="0.1" max="4" step="0.1"><br>

Hue Speed <input id="hueSpeed" type="range" min="0" max="2" step="0.01"><br>

`;

document.body.appendChild(panel);

Object.keys(settings).forEach(key=>{

let el = panel.querySelector("#"+key);
if(!el) return;

el.value=settings[key];

el.addEventListener("input",e=>{

settings[key]=parseFloat(e.target.value);

if(key==="particles") init();

});

});

/* ======================================================
DRAW LOOP
====================================================== */

function draw(){

requestAnimationFrame(draw);

frame++;

panel.style.display = devPanelActive ? "block" : "none";

analyser.getByteFrequencyData(freqData);

let amp = rms();
let b = bass();
let m = mids();
let h = highs();

/* background fade */

ctx.fillStyle=`rgba(0,0,0,${settings.trailFade})`;
ctx.fillRect(0,0,width,height);

/* move attractors */

for(let a of attractors){

a.x += Math.sin(frame*0.01+a.phase)*2;
a.y += Math.cos(frame*0.008+a.phase)*2;

}

/* particle simulation */

for(let p of particles){

let ox=p.x;
let oy=p.y;

/* orbit attractors */

for(let a of attractors){

let dx=a.x-p.x;
let dy=a.y-p.y;

let dist=Math.sqrt(dx*dx+dy*dy)+0.01;

let force=settings.orbitForce/dist;

p.vx += dx*force*0.02;
p.vy += dy*force*0.02;

}

/* turbulence field */

p.vx += Math.sin(p.y*0.01+frame*0.02)*settings.turbulence*m;
p.vy += Math.cos(p.x*0.01+frame*0.02)*settings.turbulence*m;

/* bass explosion */

let cx=width/2;
let cy=height/2;

let dx=p.x-cx;
let dy=p.y-cy;

let dist=Math.sqrt(dx*dx+dy*dy)+0.01;

p.vx += dx/dist * b * settings.bassExplosion;
p.vy += dy/dist * b * settings.bassExplosion;

/* treble sparks */

p.vx += (Math.random()-0.5)*h*2;
p.vy += (Math.random()-0.5)*h*2;

/* integrate */

p.vx*=0.94;
p.vy*=0.94;

p.x+=p.vx*settings.baseSpeed;
p.y+=p.vy*settings.baseSpeed;

/* wrap */

if(p.x<0)p.x+=width;
if(p.x>width)p.x-=width;
if(p.y<0)p.y+=height;
if(p.y>height)p.y-=height;

/* color */

let hue=
(frame*settings.hueSpeed+
p.band*3+
amp*200)%360;

let alpha=Math.min(0.5,0.08+amp*0.4);

/* draw */

ctx.strokeStyle=`hsla(${hue},100%,60%,${alpha})`;

ctx.lineWidth=settings.lineWidth+amp*2;

ctx.beginPath();
ctx.moveTo(ox,oy);
ctx.lineTo(p.x,p.y);
ctx.stroke();

}

}

draw();