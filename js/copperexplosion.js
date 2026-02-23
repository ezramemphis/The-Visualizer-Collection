import {
  ctx, canvas, analyser, freqData
} from "./visualizer.js";

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

let particles=[];
const COUNT=3000;

for(let i=0;i<COUNT;i++){
  particles.push({
    x:Math.random()*width,
    y:Math.random()*height,
    vx:0,
    vy:0
  });
}

function draw(){

  requestAnimationFrame(draw);

  analyser.getByteFrequencyData(freqData);

  const bass=avg(0,12);
  const mid=avg(30,90);
  const high=avg(100,180);

  ctx.fillStyle="rgba(0,0,0,0.1)";
  ctx.fillRect(0,0,width,height);

  const cx=width/2;
  const cy=height/2;

  ctx.globalCompositeOperation="lighter";

  particles.forEach(p=>{

    const dx=cx-p.x;
    const dy=cy-p.y;

    const dist=Math.sqrt(dx*dx+dy*dy)+1;

    const gravity=0.05;

    p.vx+=dx/dist*gravity;
    p.vy+=dy/dist*gravity;

    if(bass>0.7){
      p.vx-=dx/dist*bass*2;
      p.vy-=dy/dist*bass*2;
    }

    const swirlAngle=mid*0.05;

    const tx=p.vx;
    p.vx=tx*Math.cos(swirlAngle)-p.vy*Math.sin(swirlAngle);
    p.vy=tx*Math.sin(swirlAngle)+p.vy*Math.cos(swirlAngle);

    p.x+=p.vx;
    p.y+=p.vy;

    ctx.fillStyle=`rgba(255,${150+high*100},${50+mid*200},0.1)`;
    ctx.fillRect(p.x,p.y,2,2);
  });

  ctx.globalCompositeOperation="source-over";
}

draw();