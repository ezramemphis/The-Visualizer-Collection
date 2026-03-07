import { ctx, canvas, analyser, freqData } from "./visualizer.js";

let frame = 0;

let mouse = { x: 0, y: 0 };

window.addEventListener("mousemove", e=>{
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

function avg(s,e){
  let v=0;
  for(let i=s;i<e;i++) v+=freqData[i]||0;
  return v/(e-s)/255;
}

export function draw(){
  requestAnimationFrame(draw);

  analyser.getByteFrequencyData(freqData);

  const bass = avg(0,20);
  const mid = avg(20,80);

  frame++;

  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const cx = mouse.x;
  const cy = mouse.y;

  const blobs = 120 + bass*200;

  ctx.globalCompositeOperation = "lighter";

  for(let i=0;i<blobs;i++){

    const t = frame*0.01 + i;

    const noise =
      Math.sin(t*2 + mid*5)*80 +
      Math.cos(t*3 + bass*6)*80;

    const x =
      cx +
      Math.cos(t)*noise;

    const y =
      cy +
      Math.sin(t)*noise;

    ctx.fillStyle =
      `hsla(${(frame+i*4)%360},80%,60%,0.25)`;

    ctx.beginPath();
    ctx.arc(x,y,2 + bass*6,0,Math.PI*2);
    ctx.fill();
  }
}

draw();