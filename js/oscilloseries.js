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

function draw(){

  requestAnimationFrame(draw);

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  const bass=avg(0,12);
  const mid=avg(30,90);
  const high=avg(100,180);

  frame++;

  ctx.fillStyle="rgba(0,0,0,0.25)";
  ctx.fillRect(0,0,width,height);

  ctx.save();
  ctx.translate(width/2,height);

  ctx.globalCompositeOperation="lighter";

  const columns=80;

  for(let i=0;i<columns;i++){

    const xOffset=(i-columns/2)*15*(1+bass*2);
    ctx.beginPath();

    for(let y=0;y<height;y+=10){

      const idx=Math.floor((y/height)*timeData.length);
      const wave=(timeData[idx]-128)/128;

      const twist=Math.sin(frame*0.02+y*0.01)*mid*200;
      const x=xOffset+wave*200+twist;

      if(y===0) ctx.moveTo(x,-y);
      else ctx.lineTo(x,-y);
    }

    ctx.strokeStyle=`hsla(${200+high*150},100%,60%,0.3)`;
    ctx.lineWidth=1+high*4;
    ctx.stroke();
  }

  ctx.restore();
}

draw();