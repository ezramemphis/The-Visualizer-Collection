// ===============================
// VISUALIZER — CORRUPTED FRACTAL SIGNAL TREE
// SIGNAL CORRUPTION ENGINE
// ===============================

import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let width = canvas.width;
let height = canvas.height;
let frame = 0;

/* AUDIO */

function avg(s,e){
let v=0;
for(let i=s;i<e;i++)v+=freqData[i]||0;
return (v/(e-s))/255;
}

/* SETTINGS */

const settings={

depth:9,
baseLength:140,
lengthDecay:.75,

angleSpread:.7,
midChaos:.6,

bassGrow:220,

branchWidth:2,

leafSize:3,
sparkCount:60,

rotationSpeed:0,

corruption:0,
signalWarp:120,

glitchAmount:6,
glitchSlices:4,

hueSpeed:5,

trailDecay:.07,
feedback:.35,

bloom:1.2,
chromaShift:0,
vignette:.3

};

registerSceneSettings(settings);

/* BUFFER */

const buffer=document.createElement("canvas");
const bctx=buffer.getContext("2d");

function resize(){
width=canvas.width;
height=canvas.height;
buffer.width=width;
buffer.height=height;
}

window.addEventListener("resize",resize);
resize();

/* DEV PANEL */

let devPanel;

function createDevPanel(){

devPanel=document.createElement("div");

Object.assign(devPanel.style,{
position:"fixed",
top:"5px",
left:"5px",
background:"rgba(0,0,0,.85)",
color:"#fff",
padding:"8px",
fontSize:"12px",
fontFamily:"sans-serif",
zIndex:9999,
display:"none",
maxHeight:"95vh",
overflowY:"auto"
});

devPanel.innerHTML=`

<b>FRACTAL CORRUPTION</b><hr>

Depth <input type="range" id="depth" min="3" max="13"><br>
Base Length <input type="range" id="baseLength" min="40" max="300"><br>
Length Decay <input type="range" id="lengthDecay" min="0.4" max="0.9" step="0.01"><br>

Angle Spread <input type="range" id="angleSpread" min="0" max="2" step="0.01"><br>
Mid Chaos <input type="range" id="midChaos" min="0" max="2" step="0.01"><br>

Bass Grow <input type="range" id="bassGrow" min="0" max="400"><br>

Branch Width <input type="range" id="branchWidth" min="1" max="8"><br>

<hr>

Rotation Speed <input type="range" id="rotationSpeed" min="0" max="0.05" step="0.001"><br>

Corruption <input type="range" id="corruption" min="0" max="4" step="0.01"><br>
Signal Warp <input type="range" id="signalWarp" min="0" max="300"><br>

<hr>

Glitch Amount <input type="range" id="glitchAmount" min="0" max="20"><br>
Glitch Slices <input type="range" id="glitchSlices" min="0" max="20"><br>

<hr>

Spark Count <input type="range" id="sparkCount" min="0" max="200"><br>
Leaf Size <input type="range" id="leafSize" min="1" max="10"><br>

<hr>

Trail <input type="range" id="trailDecay" min="0.01" max="0.3" step="0.01"><br>
Feedback <input type="range" id="feedback" min="0" max="0.8" step="0.01"><br>

<hr>

Bloom <input type="range" id="bloom" min="0" max="3" step="0.1"><br>
Chroma Shift <input type="range" id="chromaShift" min="0" max="20"><br>
Vignette <input type="range" id="vignette" min="0" max="0.7" step="0.01"><br>

`;

document.body.appendChild(devPanel);

Object.keys(settings).forEach(key=>{
const el=devPanel.querySelector(`#${key}`);
if(!el)return;
el.value=settings[key];
el.oninput=e=>settings[key]=parseFloat(e.target.value);
});
}

createDevPanel();

/* FRACTAL */

function branch(x,y,len,angle,depth,bass,mid,high){

if(depth<=0){

bctx.fillStyle=`hsl(${(frame*settings.hueSpeed)%360},90%,70%)`;

bctx.beginPath();
bctx.arc(x,y,settings.leafSize+high*6,0,Math.PI*2);
bctx.fill();

return;
}

const corruption =
(Math.sin(frame*.05+depth)*settings.corruption);

const warp =
Math.sin(frame*.02+depth)*settings.signalWarp*mid;

const nx =
x + Math.cos(angle+corruption)*len + warp*.01;

const ny =
y + Math.sin(angle+corruption)*len;

bctx.lineWidth=settings.branchWidth*(depth*.15);

bctx.beginPath();
bctx.moveTo(x,y);
bctx.lineTo(nx,ny);
bctx.stroke();

const spread =
settings.angleSpread +
mid*settings.midChaos +
Math.sin(frame*.03+depth)*.2;

branch(nx,ny,len*settings.lengthDecay,angle-spread,depth-1,bass,mid,high);
branch(nx,ny,len*settings.lengthDecay,angle+spread,depth-1,bass,mid,high);

}

/* SPARKS */

function sparks(high){

bctx.fillStyle="white";

for(let i=0;i<settings.sparkCount*high;i++){

const x=Math.random()*width;
const y=Math.random()*height;

bctx.fillRect(x,y,2,2);

}

}

/* GLITCH */

function glitch(){

for(let i=0;i<settings.glitchSlices;i++){

const y=Math.random()*height;
const h=Math.random()*20;

ctx.drawImage(
canvas,
0,y,
width,h,
Math.random()*settings.glitchAmount-10,
y,
width,
h
);

}

}

/* DRAW */

function draw(){

requestAnimationFrame(draw);

if(devPanel)
devPanel.style.display = devPanelActive ? "block":"none";

frame++;

analyser.getByteFrequencyData(freqData);

const bass=avg(0,20);
const mid=avg(40,100);
const high=avg(120,200);

/* TRAILS */

ctx.fillStyle=`rgba(0,0,0,${settings.trailDecay})`;
ctx.fillRect(0,0,width,height);

/* FEEDBACK */

if(settings.feedback>0){

ctx.globalAlpha=settings.feedback;
ctx.drawImage(canvas,0,0);
ctx.globalAlpha=1;

}

/* BUFFER */

bctx.clearRect(0,0,width,height);

bctx.save();

bctx.translate(width/2,height/2);

const len=settings.baseLength+bass*settings.bassGrow;

bctx.strokeStyle=`hsl(${frame*settings.hueSpeed%360},80%,60%)`;

branch(
0,
height/2,
len,
-Math.PI/2 + frame*settings.rotationSpeed,
settings.depth,
bass,
mid,
high
);

sparks(high);

bctx.restore();

/* BLOOM */

if(settings.bloom>0){

ctx.filter=`blur(${settings.bloom*8}px)`;
ctx.globalCompositeOperation="screen";
ctx.drawImage(buffer,0,0);
ctx.filter="none";

}

/* SHARP */

ctx.globalCompositeOperation="lighter";
ctx.drawImage(buffer,0,0);
ctx.globalCompositeOperation="source-over";

/* CHROMA */

if(settings.chromaShift>0){

ctx.globalCompositeOperation="screen";
ctx.globalAlpha=.4;

ctx.drawImage(canvas,settings.chromaShift,0);
ctx.drawImage(canvas,-settings.chromaShift,0);

ctx.globalAlpha=1;
ctx.globalCompositeOperation="source-over";

}

/* GLITCH */

glitch();

/* VIGNETTE */

if(settings.vignette>0){

const g=ctx.createRadialGradient(
width/2,height/2,
width*.3,
width/2,height/2,
width
);

g.addColorStop(0,"rgba(0,0,0,0)");
g.addColorStop(1,`rgba(0,0,0,${settings.vignette})`);

ctx.fillStyle=g;
ctx.fillRect(0,0,width,height);

}

}

draw();