import { ctx, canvas, analyser, freqData, timeData } from "./visualizer.js";

/* ===============================
   STATE
================================ */
let frame = 0;
let phase = 0;

const memoryCanvas = document.createElement("canvas");
const memoryCtx = memoryCanvas.getContext("2d");

function resizeMemory() {
  memoryCanvas.width = canvas.width;
  memoryCanvas.height = canvas.height;
}
resizeMemory();
window.addEventListener("resize", resizeMemory);

function avg(start, end) {
  let s = 0;
  for (let i = start; i < end; i++) s += freqData[i];
  return Math.min(s / (end - start) / 255, 1);
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* ===============================
   DRAW
================================ */
function draw() {
  requestAnimationFrame(draw);
  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);
  frame++;

  const bass = avg(0,6);
  const mid = avg(20,60);
  const high = avg(60,120);

  // background fade
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // memory trails for airy motion
  ctx.globalAlpha = 0.15;
  ctx.drawImage(memoryCanvas,0,0);
  ctx.globalAlpha = 1;
  memoryCtx.clearRect(0,0,canvas.width,canvas.height);

  ctx.save();
  ctx.translate(canvas.width/2, canvas.height/2);

  phase += 0.003 + bass*0.02;

  /* ===============================
     AIRY VORTEX CORE
  ================================ */
  const coreRadius = 50 + bass*180;
  const spikes = 25 + Math.floor(bass*35);

  for(let i=0;i<spikes;i++){
    const angle = (i/spikes)*Math.PI*2 + phase;
    const len = coreRadius + Math.sin(frame*0.01+i)*30*mid;

    const x = Math.cos(angle)*len;
    const y = Math.sin(angle)*len;

    ctx.strokeStyle = `hsla(${200+i*5},80%,70%,0.4)`;
    ctx.lineWidth = 1 + mid*1.8;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(x,y);
    ctx.stroke();
  }

  /* ===============================
     AIR STREAM RIBBONS
  ================================ */
  const ribbonCount = 5;
  for(let r=0;r<ribbonCount;r++){
    ctx.save();
    ctx.rotate(phase*0.6*(r+1));

    ctx.beginPath();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = `hsla(${frame+r*90},85%,70%,0.15)`;

    for(let i=0;i<timeData.length;i+=2){
      const t = i/timeData.length;
      const wave = (timeData[i]/255-0.5)*canvas.height*0.25;

      const x = Math.sin(t*8 + r)* (canvas.width*0.25 + wave*mid);
      const y = Math.cos(t*6 + r)* (canvas.height*0.25 + wave*bass);

      i===0? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }

    ctx.stroke();
    ctx.restore();
  }

  /* ===============================
     FROSTED AIR EDGES
  ================================ */
  const edgeCount = 60 + Math.floor(high*80);
  for(let i=0;i<edgeCount;i++){
    const angle = rand(0,Math.PI*2);
    const radius = coreRadius*0.8 + rand(-20,20)*mid;
    const x = Math.cos(angle)*radius;
    const y = Math.sin(angle)*radius;

    ctx.fillStyle = `hsla(${200+rand(-30,30)},80%,65%,0.05)`;
    ctx.beginPath();
    ctx.arc(x,y,rand(1,3)*high,0,Math.PI*2);
    ctx.fill();
  }

  ctx.restore();

  // write memory feedback
  memoryCtx.globalAlpha = 0.7;
  memoryCtx.drawImage(canvas,0,0);
}

function rand(a,b){return a+Math.random()*(b-a);}
draw();
