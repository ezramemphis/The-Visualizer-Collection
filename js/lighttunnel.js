import {
  ctx, canvas, analyser, freqData, timeData
} from "./visualizer.js";

let frame = 0;
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

/* ================================
   COLOR CONFIG
================================ */

const USE_TWO_COLOR_MODE = true;

const COLOR_A = [20,120,255];
const COLOR_B = [255,0,150];

function lerp(a,b,t){ return a+(b-a)*t; }

function colorBlend(t, alpha){
  if(!USE_TWO_COLOR_MODE){
    return `hsla(${(t*360 + frame*0.5)%360},100%,60%,${alpha})`;
  }

  const cycle = (Math.sin(frame*0.01)+1)/2;
  const mix = (t*0.5 + cycle*0.5)%1;

  const r = lerp(COLOR_A[0],COLOR_B[0],mix);
  const g = lerp(COLOR_A[1],COLOR_B[1],mix);
  const b = lerp(COLOR_A[2],COLOR_B[2],mix);

  return `rgba(${r|0},${g|0},${b|0},${alpha})`;
}

/* ================================
   SHOCKWAVE SYSTEM
================================ */

let shock = 0;

function triggerShock(power){
  shock = power;
}

/* ================================
   MAIN DRAW
================================ */

function draw(){
  requestAnimationFrame(draw);

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  const bass = avg(0,12);
  const mid = avg(25,90);
  const high = avg(100,180);

  if(bass > 0.65) triggerShock(bass*400);

  frame++;

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle="rgba(0,0,0,0.25)";
  ctx.fillRect(0,0,width,height);

  ctx.globalCompositeOperation = "lighter";

  ctx.save();
  ctx.translate(width/2,height/2);

  const layers = 220;
  const spiralDrift = frame*0.002;

  for(let system=0; system<2; system++){

    const direction = system===0 ? 1 : -1;

    for(let i=0;i<layers;i++){

      const depth = (i*12 + frame*25)%2400;
      const z = 2400-depth;

      const scale = 900/z;
      const baseR = (280 + mid*200)*scale;

      const rotation =
        direction*(frame*0.012 + i*0.018) +
        spiralDrift;

      const alpha = 0.15 + high*0.5;
      const thickness = 0.5 + high*2;

      ctx.beginPath();

      for(let a=0;a<Math.PI*2;a+=0.12){

        const waveIndex = (a/(Math.PI*2))*timeData.length|0;
        const waveform = (timeData[waveIndex]-128)/128;

        const warp =
          Math.sin(a*6 + frame*0.06 + i*0.1)*mid*50 +
          Math.cos(a*3 + i*0.25)*bass*120 +
          waveform*80*high;

        const shockWave = shock*Math.exp(-i*0.02);

        const r = baseR + warp + shockWave;

        const x = Math.cos(a+rotation)*r;
        const y = Math.sin(a+rotation)*r;

        a===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }

      ctx.strokeStyle = colorBlend(depth/2400, alpha);
      ctx.lineWidth = thickness;
      ctx.stroke();
    }
  }

  shock *= 0.92;

  ctx.restore();
}

draw();