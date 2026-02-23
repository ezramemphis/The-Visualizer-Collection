import {
  ctx, canvas, analyser, freqData, timeData
} from "./visualizer.js";

/* ===============================
   STATE
================================ */

let frame = 0;
let width = canvas.width;
let height = canvas.height;

const memCanvas = document.createElement("canvas");
const memCtx = memCanvas.getContext("2d");

function resize() {
  width = canvas.width;
  height = canvas.height;
  memCanvas.width = width;
  memCanvas.height = height;
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

function rand(n){ return (Math.random()-0.5)*n; }

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

  /* ---- feedback smear ---- */
  ctx.globalAlpha = 0.18;
  ctx.drawImage(memCanvas, rand(bass*50), rand(bass*50));
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0,0,width,height);

  ctx.save();
  ctx.translate(width/2,height/2);

  /* ===============================
     GRANULAR FRACTURE LAYERS
  ================================ */

  const layers = 10;

  for(let layer=0; layer<layers; layer++){

    ctx.save();

    const dir = layer%2===0 ? 1 : -1;

    ctx.rotate(
      frame*0.0015*dir*(1+mid*12) +
      Math.sin(frame*0.01+layer)*bass
    );

    const points = 700;

    ctx.beginPath();

    for(let i=0;i<points;i++){

      const t=i/points;
      const angle=t*Math.PI*2;

      // granular jitter
      const grain =
        Math.sin(angle*40 + frame*0.08)*high*120 +
        Math.cos(angle*22 + frame*0.03)*mid*80;

      const wave =
        (timeData[i % timeData.length]/255 - 0.5) *
        700 * (0.3 + mid);

      const radius =
        120 +
        layer*45 +
        wave +
        grain +
        Math.sin(angle*8 + frame*0.02)*bass*250;

      const x=Math.cos(angle)*radius + rand(high*40);
      const y=Math.sin(angle)*radius + rand(high*40);

      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }

    const hue =
      frame*0.6 +
      layer*40 +
      Math.sin(frame*0.01)*120;

    ctx.strokeStyle =
      `hsla(${hue},100%,60%,${0.08+high*0.7})`;

    ctx.lineWidth =
      0.5 + high*4 + bass*2;

    ctx.stroke();

    ctx.restore();
  }

  /* ===============================
     DIGITAL DUST FIELD
  ================================ */

  const dustCount = 500 + high*2000;

  for(let i=0;i<dustCount;i++){

    const angle=Math.random()*Math.PI*2;
    const dist=Math.random()*width*0.6;

    const x=Math.cos(angle)*dist;
    const y=Math.sin(angle)*dist;

    const size = Math.random()*2 + high*2;

    ctx.fillStyle =
      `hsla(${frame+i},100%,70%,${0.2+high})`;

    ctx.fillRect(x,y,size,size);
  }

  ctx.restore();

  /* ===============================
     BASS SHOCK FRACTURE
  ================================ */

  if(bass > 0.65){

    const slices = 5 + bass*30;

    for(let i=0;i<slices;i++){

      const y=Math.random()*height;
      const h=5 + Math.random()*40;
      const offset = rand(bass*500);

      ctx.drawImage(
        canvas,
        0,y,width,h,
        offset,y,width,h
      );
    }
  }

  /* ===============================
     RGB FAILURE PASS
  ================================ */

  if(high > 0.45){

    ctx.globalCompositeOperation="screen";

    ctx.drawImage(canvas, rand(high*10),0);
    ctx.drawImage(canvas,-rand(high*10),0);

    ctx.globalCompositeOperation="source-over";
  }

  /* ---- store frame ---- */
  memCtx.clearRect(0,0,width,height);
  memCtx.drawImage(canvas,0,0);
}

/* ===============================
   START
================================ */

draw();
