// ===============================
// VISUALIZER — CAROUSEL ENGINE V2
// ===============================

import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let width = canvas.width;
let height = canvas.height;
let frame = 0;

/* ======================================================
AUDIO
====================================================== */

function avg(s,e){
 let v=0;
 const len=Math.max(1,e-s);
 for(let i=s;i<e;i++) v+=freqData[i]||0;
 return (v/len)/255;
}

/* ======================================================
SETTINGS
====================================================== */

const settings={

 radius:320,
 poleCount:20,
 poleHeight:180,

 rotationSpeed:0.0012,

 cuboidSize:26,
 cuboidHeight:60,

 helixAmount:6,

 particleCount:80,
 particleOrbit:260,
 particleSize:2,

 cameraTilt:0.4,

 hueBase:45,
 hueShift:0.4,

 glow:0.6,
 bgAlpha:0.18

};

registerSceneSettings(settings);

/* ======================================================
RESIZE
====================================================== */

function resize(){
 width=canvas.width;
 height=canvas.height;
}
window.addEventListener("resize",resize);
resize();

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
  display:"none"
 });

 let html=`<b>CAROUSEL ENGINE</b><hr>`;

 Object.keys(settings).forEach(k=>{
  html+=`${k}<input type="range" id="${k}" min="0" max="600" step="0.01"><br>`;
 });

 devPanel.innerHTML=html;

 document.body.appendChild(devPanel);

 Object.keys(settings).forEach(key=>{
  const el=devPanel.querySelector(`#${key}`);
  if(!el)return;

  el.value=settings[key];

  el.addEventListener("input",e=>{
   settings[key]=parseFloat(e.target.value);
  });
 });

}

createDevPanel();

/* ======================================================
PROJECTION
====================================================== */

function project(x,y,z){

 const scale=600/(600+z);

 return{
  x:x*scale,
  y:y*scale,
  s:scale
 };

}

/* ======================================================
PARTICLES
====================================================== */

const particles=[];

for(let i=0;i<settings.particleCount;i++){

 particles.push({

  angle:Math.random()*Math.PI*2,
  height:(Math.random()-0.5)*200,
  speed:Math.random()*0.02+0.01

 });

}

/* ======================================================
DRAW
====================================================== */

function draw(){

 requestAnimationFrame(draw);

 if(devPanel)
 devPanel.style.display=devPanelActive?"block":"none";

 analyser.getByteFrequencyData(freqData);

 const bass=avg(0,20);
 const mids=avg(40,100);
 const highs=avg(120,200);

 frame+=settings.rotationSpeed*100;

 ctx.fillStyle=`rgba(0,0,0,${settings.bgAlpha})`;
 ctx.fillRect(0,0,width,height);

 ctx.save();

 ctx.translate(width/2,height/2);

 /* CAMERA TILT */

 const camX=Math.sin(frame*0.4)*settings.cameraTilt*80;
 const camY=Math.cos(frame*0.3)*settings.cameraTilt*60;

 ctx.translate(camX,camY);

 const bounce=
 Math.sin(frame*0.05)
 *settings.cuboidHeight
 *bass;

 /* ===============================
 PLATFORM RING
 =============================== */

 ctx.beginPath();

 for(let a=0;a<Math.PI*2;a+=0.1){

  const x=Math.cos(a)*settings.radius;
  const z=Math.sin(a)*settings.radius;

  const p=project(x,0,z);

  if(a===0) ctx.moveTo(p.x,p.y);
  else ctx.lineTo(p.x,p.y);

 }

 ctx.strokeStyle=`hsla(${settings.hueBase+frame*settings.hueShift},80%,60%,0.4)`;
 ctx.lineWidth=2;
 ctx.stroke();

 /* ===============================
 POLES
 =============================== */

 for(let i=0;i<settings.poleCount;i++){

 const a=
 i/settings.poleCount*Math.PI*2+
 frame*settings.rotationSpeed*12;

 const x=Math.cos(a)*settings.radius;
 const z=Math.sin(a)*settings.radius;

 const top=project(x,-settings.poleHeight+bounce,z);
 const bottom=project(x,bounce,z);

 ctx.strokeStyle=`hsla(${settings.hueBase+10},100%,60%,0.7)`;
 ctx.lineWidth=3;

 ctx.beginPath();
 ctx.moveTo(top.x,top.y);
 ctx.lineTo(bottom.x,bottom.y);
 ctx.stroke();

 /* HELIX LIGHTS */

 for(let h=0;h<settings.poleHeight;h+=10){

 const twist=
 Math.sin(h*0.1+frame*0.5+i)
 *settings.helixAmount;

 const hx=x+Math.cos(twist)*8;
 const hz=z+Math.sin(twist)*8;

 const p=project(hx,-h+bounce,hz);

 ctx.fillStyle=`hsla(${settings.hueBase+frame*settings.hueShift},90%,65%,${0.4+highs})`;

 ctx.fillRect(p.x,p.y,3*p.s,3*p.s);

 }

 /* ===============================
 CUBOID RIDERS
 =============================== */

 const cubeY=
 -settings.poleHeight/2+
 Math.sin(frame*0.15+i)*30*mids;

 const cp=project(x,cubeY+bounce,z);

 const size=
 settings.cuboidSize*
 cp.s*
 (1+mids*2);

 ctx.fillStyle=`hsla(${settings.hueBase+180},80%,70%,0.9)`;

 ctx.fillRect(cp.x-size/2,cp.y-size/2,size,size);

 }

 /* ===============================
 ORBIT PARTICLES
 =============================== */

 particles.forEach(p=>{

 p.angle+=p.speed*(1+highs*2);

 const x=Math.cos(p.angle)*settings.particleOrbit;
 const z=Math.sin(p.angle)*settings.particleOrbit;

 const proj=project(x,p.height,z);

 ctx.beginPath();
 ctx.arc(proj.x,proj.y,settings.particleSize*proj.s*(1+highs),0,Math.PI*2);

 ctx.fillStyle=`hsla(${settings.hueBase+frame*0.5},100%,70%,${settings.glow})`;
 ctx.fill();

 });

 ctx.restore();

}

draw();