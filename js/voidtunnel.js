import {
  ctx, canvas, analyser, freqData, timeData
} from "./visualizer.js";

let frame = 0;
let width = canvas.width;
let height = canvas.height;

function resize() {
  width = canvas.width;
  height = canvas.height;
}
window.addEventListener("resize", resize);

function avg(s,e){
  let v=0;
  for(let i=s;i<e;i++) v+=freqData[i];
  return v/(e-s)/255;
}

function draw(){
  requestAnimationFrame(draw);

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  const bass = avg(0,8);
  const mid = avg(20,70);
  const high = avg(80,140);

  frame++;

  ctx.fillStyle="rgba(0,0,0,0.25)";
  ctx.fillRect(0,0,width,height);

  ctx.save();
  ctx.translate(width/2,height/2);

  const rings = 120;

  for(let i=0;i<rings;i++){

    const depth = (frame*8 + i*40)%2000;
    const z = 2000-depth;

    const scale = 800/z;
    const r = (200+bass*400)*scale;

    const twist = frame*0.01 + i*0.2*mid;

    ctx.beginPath();

    for(let a=0;a<Math.PI*2;a+=0.2){
      const wave =
        Math.sin(a*6 + frame*0.05)*mid*40 +
        Math.cos(a*3 + i)*high*30;

      const x=Math.cos(a+twist)*(r+wave);
      const y=Math.sin(a+twist)*(r+wave);

      a===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }

    ctx.strokeStyle=`hsla(${depth*0.15+frame},100%,60%,${0.15+high})`;
    ctx.lineWidth=1+high*2;
    ctx.stroke();
  }

  ctx.restore();
}

draw();
