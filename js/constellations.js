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

/* ===== SHARD FIELD ===== */

let points=[];
const POINT_COUNT=120;

for(let i=0;i<POINT_COUNT;i++){
  points.push({
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

  frame++;

  ctx.fillStyle="rgba(0,0,0,0.2)";
  ctx.fillRect(0,0,width,height);

  if(bass>0.7){
    points.forEach(p=>{
      const angle=Math.random()*Math.PI*2;
      p.vx=Math.cos(angle)*20*bass;
      p.vy=Math.sin(angle)*20*bass;
    });
  }

  points.forEach(p=>{
    p.x+=p.vx;
    p.y+=p.vy;
    p.vx*=0.95;
    p.vy*=0.95;

    if(p.x<0||p.x>width) p.vx*=-1;
    if(p.y<0||p.y>height) p.vy*=-1;
  });

  ctx.globalCompositeOperation="lighter";

  for(let i=0;i<points.length;i++){
    for(let j=i+1;j<points.length;j++){
      const dx=points[i].x-points[j].x;
      const dy=points[i].y-points[j].y;
      const d=Math.sqrt(dx*dx+dy*dy);

      if(d<150){
        ctx.strokeStyle=`rgba(${50+mid*200},${100+high*155},255,${0.1})`;
        ctx.lineWidth=1+high*3;
        ctx.beginPath();
        ctx.moveTo(points[i].x,points[i].y);
        ctx.lineTo(points[j].x,points[j].y);
        ctx.stroke();
      }
    }
  }

  ctx.globalCompositeOperation="source-over";
}

draw();