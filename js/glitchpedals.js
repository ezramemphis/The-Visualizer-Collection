import {
  ctx, canvas, analyser, freqData, timeData
} from "./visualizer.js";

/* ===============================
   STATE
================================ */

let frame = 0;
let width = canvas.width;
let height = canvas.height;

const memoryCanvas = document.createElement("canvas");
const memoryCtx = memoryCanvas.getContext("2d");

function resize() {
  width = canvas.width;
  height = canvas.height;
  memoryCanvas.width = width;
  memoryCanvas.height = height;
}
resize();
window.addEventListener("resize", resize);

/* ===============================
   HELPERS
================================ */

function avg(s,e){
  let v=0;
  for(let i=s;i<e;i++) v+=freqData[i];
  return v/(e-s)/255;
}

function clamp(v,min,max){
  return Math.max(min,Math.min(max,v));
}

/* ===============================
   DRAW
================================ */

function draw(){

  requestAnimationFrame(draw);

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  frame++;

  const bass = clamp(avg(0,10),0,1);
  const lowMid = clamp(avg(10,40),0,1);
  const mid = clamp(avg(40,90),0,1);
  const high = clamp(avg(90,170),0,1);

  /* ---- DARK BASE ---- */
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0,0,width,height);

  /* ---- SUBTLE FEEDBACK ---- */
  ctx.globalAlpha = 0.08 + bass*0.08;
  ctx.drawImage(memoryCanvas, 0, 0);
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(width/2,height/2);

  /* ===============================
     PRESSURE FIELD LINES
  ================================ */

  const layers = 7;
  const points = 500;

  for(let l=0;l<layers;l++){

    ctx.save();

    // slow rotation — NOT flashy
    ctx.rotate(
      frame*0.0006*(l%2?1:-1) +
      bass*0.15
    );

    ctx.beginPath();

    for(let i=0;i<points;i++){

      const t=i/points;
      const angle=t*Math.PI*2;

      // smooth pressure motion
      const wave =
        Math.sin(angle*4 + frame*0.01 + l)*bass*220 +
        Math.cos(angle*2 + frame*0.004)*mid*160;

      // micro high detail
      const texture =
        Math.sin(angle*30 + frame*0.03)*high*25;

      const radius =
        130 +
        l*55 +
        wave +
        texture +
        (timeData[i % timeData.length]/255 - 0.5)*300*lowMid;

      const x=Math.cos(angle)*radius;
      const y=Math.sin(angle)*radius;

      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }

    // restrained palette
    const hue =
      200 +
      Math.sin(frame*0.002 + l)*40;

    ctx.strokeStyle =
      `hsla(${hue},70%,65%,${0.05 + mid*0.35})`;

    ctx.lineWidth =
      0.6 + high*2;

    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();

  /* ===============================
     SOFT TENSION GLITCH
  ================================ */

  // not flashy — only when strong bass
  if(bass > 0.72){

    const y=Math.random()*height;
    const h=8 + Math.random()*20;

    ctx.drawImage(
      canvas,
      0,y,width,h,
      (Math.random()-0.5)*bass*150,
      y,width,h
    );
  }

  /* ---- STORE MEMORY ---- */
  memoryCtx.clearRect(0,0,width,height);
  memoryCtx.drawImage(canvas,0,0);
}

/* ===============================
   START
================================ */

draw();
