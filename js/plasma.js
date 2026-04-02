// ===============================
// VISUALIZER — PLASMA MEMBRANE
// Organic fluid plasma cells that breathe and pulse with audio
// ===============================

import { ctx, canvas, analyser, freqData, timeData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings, attachDetachButton, initFxFilters } from "./visualizer.js";

let width = canvas.width, height = canvas.height, frame = 0;
window.addEventListener("resize", () => { width = canvas.width; height = canvas.height; });

function avg(s,e){ let v=0; for(let i=s;i<e;i++) v+=freqData[i]||0; return v/Math.max(1,e-s)/255; }

// ======================================================
// SETTINGS
// ======================================================
const settings = {
  // Plasma
  cellCount:       14,
  plasmaScale:     0.003,
  plasmaSpeed:     0.006,
  plasmaComplexity:4,
  plasmaContrast:  1.2,

  // Membrane
  membraneRadius:  120,
  membranePoints:  80,
  membraneThick:   2.0,
  membraneTension: 0.7,

  // Pulse
  bassInflate:     60,
  midWobble:       30,
  highTremor:      0.4,
  beatExplosion:   1,
  beatThreshold:   0.60,

  // Color
  hue1:            180,
  hue2:            280,
  hueSpeed:        0.3,
  saturation:      90,
  lightness:       55,
  glowIntensity:   0.8,
  bgAlpha:         0.10,

  // Structure
  ringCount:       3,
  ringSpacing:     70,
  mirrorMode:      0,
  organicNoise:    0.8,
  cellPulsePhase:  0.4,
};

registerSceneSettings(settings);

// ======================================================
// DEV PANEL
// ======================================================
const devPanel = document.createElement("div");
Object.assign(devPanel.style, {
  position:"fixed",top:"5px",left:"5px",padding:"8px 10px",
  background:"rgba(5,5,15,0.9)",color:"#e0f0ff",fontFamily:"monospace",fontSize:"11px",
  borderRadius:"8px",zIndex:9999,display:"none",maxHeight:"95vh",overflowY:"auto",width:"200px",
  border:"1px solid #ffffff18",backdropFilter:"blur(10px)"
});
devPanel.innerHTML = `
<div style="color:#00ddff;font-weight:bold;letter-spacing:0.1em;margin-bottom:8px">⬡ PLASMA MEMBRANE</div>

<b>PLASMA</b><br>
Cell Count <input type="range" id="cellCount" min="4" max="30" step="1"><br>
Plasma Scale <input type="range" id="plasmaScale" min="0.001" max="0.01" step="0.0005"><br>
Plasma Speed <input type="range" id="plasmaSpeed" min="0" max="0.02" step="0.001"><br>
Complexity <input type="range" id="plasmaComplexity" min="1" max="8" step="1"><br>
Contrast <input type="range" id="plasmaContrast" min="0.5" max="3" step="0.05"><br>

<hr style="border-color:#ffffff18;margin:6px 0">
<b>MEMBRANE</b><br>
Radius <input type="range" id="membraneRadius" min="40" max="300"><br>
Points <input type="range" id="membranePoints" min="20" max="200" step="4"><br>
Thickness <input type="range" id="membraneThick" min="0.5" max="8" step="0.1"><br>
Tension <input type="range" id="membraneTension" min="0" max="2" step="0.05"><br>

<hr style="border-color:#ffffff18;margin:6px 0">
<b>PULSE</b><br>
Bass Inflate <input type="range" id="bassInflate" min="0" max="150"><br>
Mid Wobble <input type="range" id="midWobble" min="0" max="80"><br>
High Tremor <input type="range" id="highTremor" min="0" max="1" step="0.02"><br>
Beat Explosion <input type="range" id="beatExplosion" min="0" max="1" step="1"><br>
Beat Threshold <input type="range" id="beatThreshold" min="0.3" max="0.9" step="0.01"><br>

<hr style="border-color:#ffffff18;margin:6px 0">
<b>COLOR</b><br>
Hue 1 <input type="range" id="hue1" min="0" max="360"><br>
Hue 2 <input type="range" id="hue2" min="0" max="360"><br>
Hue Speed <input type="range" id="hueSpeed" min="0" max="2" step="0.05"><br>
Saturation <input type="range" id="saturation" min="0" max="100"><br>
Lightness <input type="range" id="lightness" min="10" max="90"><br>
Glow <input type="range" id="glowIntensity" min="0" max="2" step="0.05"><br>
BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.5" step="0.01"><br>

<hr style="border-color:#ffffff18;margin:6px 0">
<b>STRUCTURE</b><br>
Ring Count <input type="range" id="ringCount" min="1" max="6" step="1"><br>
Ring Spacing <input type="range" id="ringSpacing" min="30" max="150"><br>
Mirror Mode <input type="range" id="mirrorMode" min="0" max="1" step="1"><br>
Organic Noise <input type="range" id="organicNoise" min="0" max="2" step="0.05"><br>
Cell Pulse Phase <input type="range" id="cellPulsePhase" min="0" max="1" step="0.01"><br>
`;
document.body.appendChild(devPanel);
Object.keys(settings).forEach(k=>{
  const el=devPanel.querySelector(`#${k}`); if(!el)return;
  el.value=settings[k]; el.addEventListener("input",e=>settings[k]=parseFloat(e.target.value));
});
attachDetachButton(devPanel, settings);
initFxFilters();

// ======================================================
// CELLS
// ======================================================
const cells = [];
function initCells(){
  cells.length=0;
  for(let i=0;i<settings.cellCount;i++){
    const angle=Math.random()*Math.PI*2;
    const dist=Math.random()*Math.min(width,height)*0.3;
    cells.push({
      x: width/2 + Math.cos(angle)*dist,
      y: height/2 + Math.sin(angle)*dist,
      vx: (Math.random()-0.5)*0.4,
      vy: (Math.random()-0.5)*0.4,
      phase: Math.random()*Math.PI*2,
      radius: settings.membraneRadius * (0.7+Math.random()*0.6),
      hueOff: Math.random()*60-30
    });
  }
}
initCells();

// ======================================================
// DRAW MEMBRANE CELL
// ======================================================
function drawCell(cell, bass, mid, high, globalHue){
  const pts = Math.floor(settings.membranePoints);
  const R = cell.radius
    + bass * settings.bassInflate
    + Math.sin(frame*0.02 + cell.phase) * mid * settings.midWobble;

  ctx.beginPath();
  for(let i=0;i<=pts;i++){
    const t = i/pts;
    const angle = t*Math.PI*2;

    // Organic noise displacement per point
    const noiseDisp =
      Math.sin(angle * settings.plasmaComplexity + frame*settings.plasmaSpeed + cell.phase)
      * settings.organicNoise * R * 0.25
      + Math.cos(angle * settings.plasmaComplexity*1.7 - frame*settings.plasmaSpeed*0.8)
      * high * settings.highTremor * R * 0.15;

    const r = R + noiseDisp;
    const px = cell.x + Math.cos(angle) * r * settings.membraneTension;
    const py = cell.y + Math.sin(angle) * r;

    i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
  }
  ctx.closePath();

  const hue = (globalHue + cell.hueOff) % 360;
  const hue2 = (hue + (settings.hue2 - settings.hue1)) % 360;

  // Glow
  ctx.shadowBlur = 20 * settings.glowIntensity * (1+bass);
  ctx.shadowColor = `hsl(${hue},${settings.saturation}%,${settings.lightness}%)`;

  // Inner glow gradient
  const grad = ctx.createRadialGradient(cell.x,cell.y,0, cell.x,cell.y,R);
  grad.addColorStop(0, `hsla(${hue2},${settings.saturation}%,${settings.lightness+15}%,0.12)`);
  grad.addColorStop(0.6, `hsla(${hue},${settings.saturation}%,${settings.lightness}%,0.06)`);
  grad.addColorStop(1, `hsla(${hue},${settings.saturation}%,${settings.lightness-10}%,0.0)`);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = `hsla(${hue},${settings.saturation}%,${settings.lightness+10}%,${0.5+bass*0.5})`;
  ctx.lineWidth = settings.membraneThick * (1 + high*settings.highTremor);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// ======================================================
// DRAW RING
// ======================================================
function drawPlasmaRing(ringIdx, bass, mid, high, hue){
  const pts = 256;
  const R = settings.membraneRadius + ringIdx * settings.ringSpacing + bass * 40;
  ctx.beginPath();
  for(let i=0;i<=pts;i++){
    const t=i/pts;
    const angle=t*Math.PI*2;
    const noise =
      Math.sin(angle*5 + frame*0.03 + ringIdx) * mid * 20
      + Math.cos(angle*8 - frame*0.02) * high * 15;
    const r = R + noise;
    const x = width/2 + Math.cos(angle)*r;
    const y = height/2 + Math.sin(angle)*r;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.strokeStyle = `hsla(${(hue+ringIdx*40)%360},${settings.saturation}%,${settings.lightness}%,${0.12+mid*0.1})`;
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

// ======================================================
// DRAW LOOP
// ======================================================
let lastBass=0;
const explosions=[];

function draw(){
  requestAnimationFrame(draw);
  devPanel.style.display = devPanelActive ? "block" : "none";
  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  const bass=avg(0,15), mid=avg(15,80), high=avg(80,180);
  frame++;

  // Beat detection
  if(bass>settings.beatThreshold && lastBass<=settings.beatThreshold && settings.beatExplosion){
    explosions.push({ r:20, alpha:1.0 });
  }
  lastBass=bass;

  ctx.fillStyle=`rgba(0,0,5,${settings.bgAlpha})`;
  ctx.fillRect(0,0,width,height);

  const globalHue = (settings.hue1 + frame*settings.hueSpeed*0.2) % 360;

  ctx.save();
  ctx.globalCompositeOperation="lighter";

  // Plasma rings
  for(let r=0;r<settings.ringCount;r++){
    drawPlasmaRing(r, bass, mid, high, globalHue);
  }

  // Cells
  if(cells.length !== settings.cellCount) initCells();
  cells.forEach((cell,i)=>{
    // Physics
    cell.x += cell.vx * (1+bass*2);
    cell.y += cell.vy * (1+bass*2);
    // Attract to center
    const dx=width/2-cell.x, dy=height/2-cell.y;
    const dist=Math.sqrt(dx*dx+dy*dy);
    cell.vx += dx*0.00005;
    cell.vy += dy*0.00005;
    // Damping
    cell.vx*=0.995; cell.vy*=0.995;
    // Cell-cell repulsion
    cells.forEach((other,j)=>{
      if(i===j)return;
      const ex=cell.x-other.x, ey=cell.y-other.y;
      const ed=Math.max(1,Math.sqrt(ex*ex+ey*ey));
      const minD=(cell.radius+other.radius)*0.5;
      if(ed<minD){
        cell.vx+=(ex/ed)*0.3;
        cell.vy+=(ey/ed)*0.3;
      }
    });
    cell.phase += 0.008 + high*0.02;
    drawCell(cell, bass, mid, high, globalHue);
  });

  // Mirror mode
  if(settings.mirrorMode){
    ctx.save();
    ctx.scale(-1,1);
    ctx.translate(-width,0);
    cells.forEach(cell=>drawCell({...cell, x:width-cell.x}, bass, mid, high, globalHue+60));
    ctx.restore();
  }

  // Explosion rings
  for(let i=explosions.length-1;i>=0;i--){
    const ex=explosions[i];
    ctx.beginPath();
    ctx.arc(width/2,height/2,ex.r,0,Math.PI*2);
    ctx.strokeStyle=`hsla(${globalHue},100%,70%,${ex.alpha})`;
    ctx.lineWidth=3*ex.alpha;
    ctx.stroke();
    ex.r+=8; ex.alpha-=0.04;
    if(ex.alpha<=0) explosions.splice(i,1);
  }

  ctx.restore();
}

draw();
