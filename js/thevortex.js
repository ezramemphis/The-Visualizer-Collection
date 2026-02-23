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

/* ===== COLOR SYSTEM ===== */

const COLOR_A = [0,255,255];     // cyan
const COLOR_B = [255,0,180];     // magenta

function lerp(a,b,t){ return a+(b-a)*t; }

function blend(t,a){
  const cycle=(Math.sin(frame*0.01)+1)/2;
  const mix=(t*0.7+cycle*0.3)%1;

  const r=lerp(COLOR_A[0],COLOR_B[0],mix)|0;
  const g=lerp(COLOR_A[1],COLOR_B[1],mix)|0;
  const b=lerp(COLOR_A[2],COLOR_B[2],mix)|0;

  return `rgba(${r},${g},${b},${a})`;
}

/* ===== PARTICLES ===== */

let particles=[];
for(let i=0;i<400;i++){
  particles.push({
    angle:Math.random()*Math.PI*2,
    radius:Math.random()*800+100,
    speed:Math.random()*0.01+0.002,
    size:Math.random()*2+0.5
  });
}

function draw(){

  requestAnimationFrame(draw);

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  const bass=avg(0,12);
  const mid=avg(25,90);
  const high=avg(100,180);

  frame++;

  ctx.globalCompositeOperation="source-over";
  ctx.fillStyle="rgba(0,0,0,0.3)";
  ctx.fillRect(0,0,width,height);

  ctx.save();
  ctx.translate(width/2,height/2);

  /* ==== SPACETIME WOBBLE ==== */
  const wobble=bass*20*Math.sin(frame*0.05);
  ctx.rotate(frame*0.002 + wobble*0.001);

  ctx.globalCompositeOperation="lighter";

  /* ==== VORTEX LAYERS ==== */

  const layers=200;

  for(let i=0;i<layers;i++){

    const depth=(i*15+frame*30)%2600;
    const z=2600-depth;

    const scale=1000/z;
    const baseR=350*scale;

    const rot=frame*0.01+i*0.02;

    ctx.beginPath();

    for(let a=0;a<Math.PI*2;a+=0.12){

      const waveIndex=(a/(Math.PI*2))*timeData.length|0;
      const waveform=(timeData[waveIndex]-128)/128;

      const spiral=baseR*(1 + a*0.05);

      const warp=
        Math.sin(a*8+frame*0.08)*mid*60+
        waveform*120*high;

      const r=spiral+warp;

      const x=Math.cos(a+rot)*r;
      const y=Math.sin(a+rot)*r;

      a===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }

    ctx.strokeStyle=blend(depth/2600,0.2+high*0.6);
    ctx.lineWidth=1+high*3;
    ctx.stroke();
  }

  /* ==== ACCRETION PARTICLES ==== */

  particles.forEach(p=>{
    p.angle+=p.speed+mid*0.02;
    p.radius*=0.995-bass*0.002;

    if(p.radius<50){
      p.radius=Math.random()*800+300;
      p.angle=Math.random()*Math.PI*2;
    }

    const x=Math.cos(p.angle)*p.radius;
    const y=Math.sin(p.angle)*p.radius;

    ctx.fillStyle=blend(p.radius/1000,0.7);
    ctx.beginPath();
    ctx.arc(x,y,p.size+high*3,0,Math.PI*2);
    ctx.fill();
  });

  ctx.restore();
}

draw();