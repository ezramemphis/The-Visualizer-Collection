import {
  ctx, canvas, analyser, freqData, timeData
} from "./visualizer.js";

/* ===============================
   STATE
================================ */

let frame = 0;
let width = canvas.width;
let height = canvas.height;

const particles = [];
const COUNT = 2000;

function resize(){
  width = canvas.width;
  height = canvas.height;
}
resize();
window.addEventListener("resize", resize);

/* ===============================
   INIT PARTICLES
================================ */

for(let i=0;i<COUNT;i++){
  particles.push({
    x:(Math.random()-0.5)*width*2,
    y:(Math.random()-0.5)*height*2,
    vx:0,
    vy:0
  });
}

/* ===============================
   HELPERS
================================ */

function avg(s,e){
  let v=0;
  for(let i=s;i<e;i++) v+=freqData[i];
  return v/(e-s)/255;
}

/* ===============================
   DRAW
================================ */

function draw(){

  requestAnimationFrame(draw);

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  const bass = avg(0,12);
  const lowMid = avg(12,40);
  const mid = avg(40,90);
  const high = avg(90,180);

  frame++;

  /* ---- DARK FADE ---- */
  ctx.fillStyle="rgba(0,0,0,0.10)";
  ctx.fillRect(0,0,width,height);

  ctx.save();
  ctx.translate(width/2,height/2);

  /* ===============================
     COLLAPSING FIELD
  ================================ */

  for(let p of particles){

    const dx = -p.x;
    const dy = -p.y;

    const dist =
      Math.sqrt(dx*dx+dy*dy)+0.001;

    // gravity pull (bass controlled)
    const force =
      (0.02 + bass*0.6) / dist;

    // spiral instability
    const twist =
      Math.sin(frame*0.01 + dist*0.01)
      * mid * 0.4;

    p.vx += dx*force + (-dy*twist);
    p.vy += dy*force + ( dx*twist);

    // damping keeps motion smooth
    p.vx *= 0.96;
    p.vy *= 0.96;

    p.x += p.vx;
    p.y += p.vy;

    // reset if sucked into center
    if(dist < 10 || dist > width*1.2){
      p.x=(Math.random()-0.5)*width*2;
      p.y=(Math.random()-0.5)*height*2;
      p.vx=0;
      p.vy=0;
    }

    const speed =
      Math.sqrt(p.vx*p.vx+p.vy*p.vy);

    const hue =
      200 +
      Math.sin(dist*0.01 + frame*0.005)*50;

    ctx.fillStyle =
      `hsla(${hue},70%,65%,${0.05 + speed*0.15 + high*0.4})`;

    const size =
      1 +
      high*2 +
      speed*0.8;

    ctx.fillRect(p.x,p.y,size,size);
  }

  /* ===============================
     EVENT HORIZON (CENTER FIELD)
  ================================ */

  const pulse =
    30 +
    bass*120 +
    Math.sin(frame*0.05)*mid*30;

  ctx.beginPath();
  ctx.arc(0,0,pulse,0,Math.PI*2);

  ctx.strokeStyle =
    `hsla(${frame*0.4},60%,60%,${0.15+high*0.4})`;

  ctx.lineWidth = 1 + high*2;
  ctx.stroke();

  ctx.restore();

  /* ===============================
     SUBTLE REALITY WARP
  ================================ */

  if(bass > 0.7){

    const y=Math.random()*height;
    const h=10+Math.random()*20;

    ctx.drawImage(
      canvas,
      0,y,width,h,
      (Math.random()-0.5)*bass*120,
      y,width,h
    );
  }
}

/* ===============================
   START
================================ */

draw();
