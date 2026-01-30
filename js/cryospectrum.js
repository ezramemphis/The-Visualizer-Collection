import { ctx, canvas, analyser, freqData, timeData } from "./visualizer.js";

/* ===============================
   STATE
================================ */
let frame = 0;
let nodes = [];
const NODE_COUNT = 60;

function rand(a,b){ return a + Math.random()*(b-a); }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function avg(start,end){
  let s=0;
  for(let i=start;i<end;i++) s+=freqData[i];
  return Math.min(s/(end-start)/255,1);
}

/* ===============================
   NODE CLASS
================================ */
class Node {
  constructor() {
    this.angle = rand(0, Math.PI*2);
    this.radius = rand(50, 200);
    this.size = rand(2,6);
    this.orbitSpeed = rand(0.0005,0.002);
    this.colorOffset = rand(0,360);
  }
  update(bass) {
    this.angle += this.orbitSpeed + bass*0.001;
    this.x = Math.cos(this.angle) * this.radius;
    this.y = Math.sin(this.angle) * this.radius;
  }
  draw(mid, high) {
    const hue = (this.colorOffset + frame*0.3) % 360;
    const size = this.size + mid*3 + high*2;
    ctx.fillStyle = `hsla(${hue},80%,70%,0.6)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, size, 0, Math.PI*2);
    ctx.fill();
  }
}

/* ===============================
   INIT NODES
================================ */
for(let i=0;i<NODE_COUNT;i++) nodes.push(new Node());

/* ===============================
   DRAW
================================ */
function draw(){
  requestAnimationFrame(draw);
  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);
  frame++;

  const bass = avg(0,6);
  const mid = avg(20,60);
  const high = avg(60,120);

  // background
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.save();
  ctx.translate(canvas.width/2,canvas.height/2);

  // filament connections
  for(let i=0;i<nodes.length;i++){
    for(let j=i+1;j<nodes.length;j++){
      const n1 = nodes[i];
      const n2 = nodes[j];
      const dx = n2.x-n1.x;
      const dy = n2.y-n1.y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      if(dist<150){
        ctx.strokeStyle = `hsla(${(frame*0.3+n1.colorOffset)%360},70%,70%,${1-dist/150})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(n1.x,n1.y);
        ctx.lineTo(n2.x,n2.y);
        ctx.stroke();
      }
    }
  }

  // update & draw nodes
  for(let n of nodes){
    n.update(bass);
    n.draw(mid, high);
  }

  ctx.restore();
}

draw();
