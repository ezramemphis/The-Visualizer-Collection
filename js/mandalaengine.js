import {
  ctx, canvas, analyser, freqData, timeData
} from "./visualizer.js";

let frame=0;
let width=canvas.width;
let height=canvas.height;

function resize(){
  width=canvas.width;
  height=canvas.height;
}
window.addEventListener("resize",resize);

function avg(s,e){
  let v=0;
  for(let i=s;i<e;i++) v+=freqData[i];
  return v/(e-s)/255;
}

/* ==== COLOR ==== */

const A=[80,0,255];      // violet
const B=[180,255,0];     // acid green

function lerp(a,b,t){return a+(b-a)*t;}

function blend(t,a){
  const mix=(Math.sin(frame*0.01+t*3)+1)/2;
  const r=lerp(A[0],B[0],mix)|0;
  const g=lerp(A[1],B[1],mix)|0;
  const b=lerp(A[2],B[2],mix)|0;
  return `rgba(${r},${g},${b},${a})`;
}

/* ==== PARTICLE BURSTS ==== */

let bursts=[];

function spawnBurst(power){
  for(let i=0;i<80;i++){
    bursts.push({
      angle:Math.random()*Math.PI*2,
      speed:Math.random()*6+2,
      life:1,
      power
    });
  }
}

function draw(){

  requestAnimationFrame(draw);

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  const bass=avg(0,12);
  const mid=avg(25,90);
  const high=avg(100,180);

  if(bass>0.7) spawnBurst(bass);

  frame++;

  ctx.globalCompositeOperation="source-over";
  ctx.fillStyle="rgba(0,0,0,0.25)";
  ctx.fillRect(0,0,width,height);

  ctx.save();
  ctx.translate(width/2,height/2);

  ctx.globalCompositeOperation="lighter";

  const slices=16+Math.floor(mid*20);
  const radius=250+bass*300;

  for(let i=0;i<slices;i++){

    ctx.save();
    ctx.rotate((Math.PI*2/slices)*i + frame*0.01);
    if(i%2===0) ctx.scale(-1,1);

    ctx.beginPath();
    ctx.moveTo(0,0);

    for(let a=0;a<Math.PI/slices;a+=0.05){

      const waveIndex=(a/(Math.PI*2))*timeData.length|0;
      const waveform=(timeData[waveIndex]-128)/128;

      const r=
        radius+
        Math.sin(a*12+frame*0.05)*mid*120+
        waveform*150*high;

      const x=Math.cos(a)*r;
      const y=Math.sin(a)*r;

      ctx.lineTo(x,y);
    }

    ctx.closePath();
    ctx.strokeStyle=blend(i/slices,0.3+high);
    ctx.lineWidth=1+high*4;
    ctx.stroke();

    ctx.restore();
  }

  /* ==== BURST PARTICLES ==== */

  bursts.forEach((p,i)=>{
    const x=Math.cos(p.angle)*p.speed*(1-p.life)*300;
    const y=Math.sin(p.angle)*p.speed*(1-p.life)*300;

    ctx.fillStyle=blend(p.life, p.life);
    ctx.beginPath();
    ctx.arc(x,y,2+high*4,0,Math.PI*2);
    ctx.fill();

    p.life-=0.02;
    if(p.life<=0) bursts.splice(i,1);
  });

  ctx.restore();
}

draw();