// ===============================
// VISUALIZER L-C — SPHERE + TEXT ORBIT: MULTI-RING HALO
// THREE independent text rings orbiting on different axes simultaneously
// Ring 1: equator, Ring 2: meridian (vertical), Ring 3: tilted 45°
// Each ring has its own text, speed, color, effect
// Extra: holographic scanline effect, glitch mode on beat
// ===============================

import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let width = canvas.width;
let height = canvas.height;
let frame = 0;

function avg(s, e) {
  let v = 0, len = Math.max(1, e - s);
  for (let i = s; i < e; i++) v += freqData[i] || 0;
  return (v / len) / 255;
}

/* ======================================================
 SETTINGS
====================================================== */
const settings = {
  // Sphere
  subdivisions: 3,
  radius: 150,
  displaceAmp: 50,
  displaceNoise: 0.28,
  rotX: 0.002,
  rotY: 0.005,
  rotAudioMult: 1.8,
  bgAlpha: 0.10,
  drawFaces: 1,
  drawEdges: 1,
  edgeWidth: 0.65,
  faceAlpha: 0.08,
  depthBuckets: 6,
  hueBase: 30,
  hueRange: 180,
  hueTimeSpeed: 0.09,
  saturation: 75,
  lightness: 50,

  // Ring 1 — equatorial
  ring1Speed: 0.007,
  ring1Radius: 220,
  ring1Size: 26,
  ring1Hue: 40,
  ring1Mode: 0,     // 0=chrome, 1=neon, 2=holo, 3=glitch, 4=ghost
  ring1AudioBoost: 1.8,

  // Ring 2 — meridional (vertical axis)
  ring2Speed: -0.005,
  ring2Radius: 200,
  ring2Size: 20,
  ring2Hue: 200,
  ring2Mode: 1,
  ring2AudioBoost: 2.2,

  // Ring 3 — tilted
  ring3Speed: 0.009,
  ring3Radius: 240,
  ring3Size: 16,
  ring3Hue: 120,
  ring3Mode: 2,
  ring3AudioBoost: 1.5,
  ring3Tilt: 0.8,   // tilt angle in radians

  // Global text
  letterSpacing: 1.0,
  textFontFamily: "Orbitron",
  textWeight: "700",
  glowSize: 12,
  depthFade: 1,
  saturation2: 90,
  lightness2: 65,

  // Effects
  holoScanlines: 1,
  glitchOnBeat: 0,
  glitchIntensity: 8,
  beatThreshold: 0.6,
};

registerSceneSettings(settings);

/* ======================================================
 TEXT STATE — 3 separate strings
====================================================== */
let ringTexts = [
  "FREQUENCY SPHERE • AUDIO ORBIT • ",
  "SOUND WAVE • RESONANCE • ",
  "∞ INFINITE LOOP • BASS DROP • ",
];
let ringAngles = [0, 0, 0];
let lastBass = 0;
let glitchActive = 0;

function createTextInputs() {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "fixed", bottom: "12px", left: "50%",
    transform: "translateX(-50%)", zIndex: 9999,
    display: "flex", flexDirection: "column", gap: "4px", alignItems: "center",
  });
  const colors = ["#f80", "#0af", "#0f8"];
  const labels = ["Ring 1 (equator):", "Ring 2 (vertical):", "Ring 3 (tilted):"];
  ringTexts.forEach((txt, i) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:6px;align-items:center;";
    const lbl = document.createElement("span");
    lbl.style.cssText = `color:${colors[i]};font-family:monospace;font-size:11px;white-space:nowrap;`;
    lbl.textContent = labels[i];
    const inp = document.createElement("input");
    Object.assign(inp.style, {
      background: "rgba(0,0,0,0.8)",
      border: `1px solid ${colors[i]}44`,
      color: colors[i], fontFamily: "monospace",
      fontSize: "12px", padding: "4px 8px",
      borderRadius: "3px", width: "240px", outline: "none",
    });
    inp.value = txt;
    inp.addEventListener("input", e => { ringTexts[i] = e.target.value || " "; });
    inp.addEventListener("keydown", e => e.stopPropagation());
    row.appendChild(lbl); row.appendChild(inp);
    wrap.appendChild(row);
  });
  document.body.appendChild(wrap);
}
createTextInputs();

/* ======================================================
 ICOSPHERE
====================================================== */
let vertices=[], faces=[];
function buildIcosphere(subdivs){
  const t=(1+Math.sqrt(5))/2;
  const raw=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]];
  vertices=raw.map(v=>{const l=Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);return[v[0]/l,v[1]/l,v[2]/l];});
  faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  const mc=new Map();
  function mid(a,b){const k=a<b?`${a}_${b}`:`${b}_${a}`;if(mc.has(k))return mc.get(k);const va=vertices[a],vb=vertices[b];const mx=va[0]+vb[0],my=va[1]+vb[1],mz=va[2]+vb[2];const l=Math.sqrt(mx*mx+my*my+mz*mz);const idx=vertices.length;vertices.push([mx/l,my/l,mz/l]);mc.set(k,idx);return idx;}
  for(let s=0;s<Math.min(subdivs,4);s++){const nf=[];for(const[a,b,c]of faces){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);nf.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);}faces=nf;}
}
let projX,projY,projD;
function allocArrays(){projX=new Float32Array(vertices.length);projY=new Float32Array(vertices.length);projD=new Float32Array(vertices.length);}
let currentSubdivs=-1;
function ensureGeometry(){const s=Math.floor(settings.subdivisions);if(s!==currentSubdivs){buildIcosphere(s);allocArrays();currentSubdivs=s;}}
let rx=0,ry=0;
function rotProject(vx,vy,vz,r){
  const cosy=Math.cos(ry),siny=Math.sin(ry);
  const x2=vx*cosy+vz*siny,z2=-vx*siny+vz*cosy;
  const cosx=Math.cos(rx),sinx=Math.sin(rx);
  const y3=vy*cosx-z2*sinx,z3=vy*sinx+z2*cosx;
  const xx=x2*r,yy=y3*r,zz=z3*r;
  const s2=700/(700+zz);
  return[xx*s2+width/2,yy*s2+height/2,s2,zz];
}
function resize(){width=canvas.width;height=canvas.height;}
window.addEventListener("resize",resize);

/* ======================================================
 RING ORBIT COMPUTATION
====================================================== */
// axis: "x", "y", "z", or angle in XZ for arbitrary tilt
function buildRingChars(text, angle, radius, axisType, tilt, rx2, ry2, bass, mid, high) {
  const chars = (text + " ").split("");
  const N = chars.length;
  const arcStep = (Math.PI * 2 * settings.letterSpacing) / N;

  return chars.map((ch, idx) => {
    const a = angle + idx * arcStep;

    let x3, y3, z3;
    if (axisType === "y") {
      // Orbit in XY plane (vertical ring — spins around Y axis)
      x3 = Math.cos(a) * radius;
      y3 = Math.sin(a) * radius;
      z3 = 0;
    } else if (axisType === "tilt") {
      // Tilted ring
      const fx = Math.cos(a) * radius;
      const fy = 0;
      const fz = Math.sin(a) * radius;
      // Rotate around Z by tilt
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      x3 = fx * ct - fy * st;
      y3 = fx * st + fy * ct;
      // Rotate around X by tilt for 45° effect
      const ct2 = Math.cos(tilt * 0.7), st2 = Math.sin(tilt * 0.7);
      const ny = y3 * ct2 - fz * st2;
      const nz = y3 * st2 + fz * ct2;
      y3 = ny; z3 = nz;
    } else {
      // Equatorial ring (default — orbit in XZ plane)
      x3 = Math.cos(a) * radius;
      y3 = 0;
      z3 = Math.sin(a) * radius;
    }

    // Co-rotate with sphere
    const cosy=Math.cos(ry2),siny=Math.sin(ry2);
    const xa=x3*cosy+z3*siny, za=-x3*siny+z3*cosy;
    const cosx=Math.cos(rx2),sinx=Math.sin(rx2);
    const ya=y3*cosx-za*sinx, za2=y3*sinx+za*cosx;

    const fov=700;
    const s2=fov/(fov+za2);
    const sx=xa*s2+width/2;
    const sy=ya*s2+height/2;

    const tangentAngle = a + Math.PI/2;
    return { ch, xa, ya, za: za2, sx, sy, depth: s2, tangentAngle, idx };
  });
}

/* ======================================================
 DRAW CHARACTER
====================================================== */
function drawRingChar(cd, mode, hue, size, bass) {
  ctx.save();
  const fov=700;
  const s2=fov/(fov+cd.za);
  const sx=cd.xa*s2+width/2;
  const sy=cd.ya*s2+height/2;
  ctx.translate(sx, sy);
  ctx.rotate(cd.tangentAngle);

  const fs = size * s2;
  if (fs < 2) { ctx.restore(); return; }

  const alpha = settings.depthFade ? Math.max(0.05, Math.min(1, s2 * 1.8)) : 1;
  ctx.font = `${settings.textWeight} ${fs}px "${settings.textFontFamily}", sans-serif`;
  ctx.textAlign="center";
  ctx.textBaseline="middle";

  const sat = settings.saturation2;
  const lit = settings.lightness2;
  const glow = settings.glowSize;

  if (mode === 0) {
    // CHROME
    const grd = ctx.createLinearGradient(0,-fs*0.5,0,fs*0.5);
    grd.addColorStop(0,   `hsl(${hue},8%,100%)`);
    grd.addColorStop(0.2, `hsl(${hue},20%,82%)`);
    grd.addColorStop(0.45,`hsl(${hue},55%,52%)`);
    grd.addColorStop(0.7, `hsl(${hue},20%,78%)`);
    grd.addColorStop(1,   `hsl(${hue},8%,96%)`);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grd;
    ctx.fillText(cd.ch, 0, 0);
    // specular
    ctx.fillStyle = `rgba(255,255,255,${0.35*alpha*s2})`;
    ctx.font = `${settings.textWeight} ${fs*0.96}px "${settings.textFontFamily}", sans-serif`;
    ctx.fillText(cd.ch, -0.5, -1);

  } else if (mode === 1) {
    // NEON
    ctx.shadowColor = `hsl(${hue},100%,65%)`;
    ctx.shadowBlur = glow * s2;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsl(${hue},${sat}%,${lit}%)`;
    ctx.fillText(cd.ch, 0, 0);
    ctx.shadowBlur = 0;

  } else if (mode === 2) {
    // HOLOGRAPHIC — iridescent rainbow with scanlines
    const holoHue = (hue + cd.idx * 8 + frame * 0.5) % 360;
    ctx.globalAlpha = alpha;
    if (settings.holoScanlines) {
      // Scanline flicker
      const scanAlpha = 0.5 + Math.sin(frame * 0.3 + cd.idx) * 0.3;
      const grd2 = ctx.createLinearGradient(0,-fs*0.6,0,fs*0.6);
      grd2.addColorStop(0, `hsla(${holoHue},100%,80%,${scanAlpha})`);
      grd2.addColorStop(0.33,`hsla(${(holoHue+120)%360},100%,70%,${scanAlpha})`);
      grd2.addColorStop(0.66,`hsla(${(holoHue+240)%360},100%,75%,${scanAlpha})`);
      grd2.addColorStop(1, `hsla(${holoHue},100%,80%,${scanAlpha})`);
      ctx.fillStyle = grd2;
    } else {
      ctx.fillStyle = `hsla(${holoHue},100%,75%,${alpha})`;
    }
    ctx.shadowColor = `hsl(${holoHue},100%,70%)`;
    ctx.shadowBlur = glow * 0.4 * s2;
    ctx.fillText(cd.ch, 0, 0);
    ctx.shadowBlur = 0;

  } else if (mode === 3) {
    // GLITCH — position jitter + color split
    const jitter = glitchActive > 0 ? settings.glitchIntensity : 0;
    const jx = (Math.random()-0.5)*jitter;
    const jy = (Math.random()-0.5)*jitter;
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = `hsl(0,100%,60%)`; ctx.fillText(cd.ch, jx+2, jy);
    ctx.fillStyle = `hsl(180,100%,60%)`; ctx.fillText(cd.ch, jx-2, jy);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsl(${hue},${sat}%,${lit}%)`;
    ctx.fillText(cd.ch, 0, 0);

  } else {
    // GHOST — outline, very transparent
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = `hsl(${hue},${sat}%,${lit}%)`;
    ctx.lineWidth = 0.7 * s2;
    ctx.shadowColor = `hsl(${hue},100%,70%)`;
    ctx.shadowBlur = glow * 0.3 * s2;
    ctx.strokeText(cd.ch, 0, 0);
    ctx.shadowBlur = 0;
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ======================================================
 DEV PANEL
====================================================== */
let devPanel;
function createDevPanel() {
  devPanel = document.createElement("div");
  Object.assign(devPanel.style, {
    position:"fixed",top:"5px",left:"5px",padding:"8px",
    background:"rgba(0,0,0,0.85)",color:"#fff",fontFamily:"sans-serif",
    fontSize:"12px",borderRadius:"6px",zIndex:9999,
    display:"none",maxHeight:"95vh",overflowY:"auto",width:"210px",
  });
  const modes=["chrome","neon","holo","glitch","ghost"];
  devPanel.innerHTML=`
  <b>SPHERE + TEXT: MULTI-RING</b><hr>
  <b>SPHERE</b><br>
  Subdivisions <input type="range" id="subdivisions" min="1" max="4" step="1"><br>
  Radius <input type="range" id="radius" min="60" max="280"><br>
  Displace Amp <input type="range" id="displaceAmp" min="0" max="100"><br>
  Rot X <input type="range" id="rotX" min="0" max="0.02" step="0.0005"><br>
  Rot Y <input type="range" id="rotY" min="0" max="0.02" step="0.0005"><br>
  Rot Audio Mult <input type="range" id="rotAudioMult" min="0" max="6" step="0.1"><br>
  BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.4" step="0.01"><br>
  Draw Faces <input type="range" id="drawFaces" min="0" max="1" step="1"><br>
  Draw Edges <input type="range" id="drawEdges" min="0" max="1" step="1"><br>
  Edge Width <input type="range" id="edgeWidth" min="0.2" max="4" step="0.1"><br>
  Face Alpha <input type="range" id="faceAlpha" min="0.01" max="0.4" step="0.01"><br>
  Sphere Hue Base <input type="range" id="hueBase" min="0" max="360"><br>
  Sphere Hue Range <input type="range" id="hueRange" min="0" max="360"><br>
  Saturation <input type="range" id="saturation" min="0" max="100"><br>
  Lightness <input type="range" id="lightness" min="10" max="90"><br>
  <hr><b>RING 1 🟠 (equator)</b><br>
  Speed <input type="range" id="ring1Speed" min="-0.03" max="0.03" step="0.001"><br>
  Radius <input type="range" id="ring1Radius" min="80" max="450"><br>
  Size <input type="range" id="ring1Size" min="8" max="70"><br>
  Hue <input type="range" id="ring1Hue" min="0" max="360"><br>
  Mode <input type="range" id="ring1Mode" min="0" max="4" step="1">
  <span id="m1" style="font-size:10px"> chrome</span><br>
  Audio Boost <input type="range" id="ring1AudioBoost" min="0" max="6" step="0.1"><br>
  <hr><b>RING 2 🔵 (vertical)</b><br>
  Speed <input type="range" id="ring2Speed" min="-0.03" max="0.03" step="0.001"><br>
  Radius <input type="range" id="ring2Radius" min="80" max="450"><br>
  Size <input type="range" id="ring2Size" min="8" max="70"><br>
  Hue <input type="range" id="ring2Hue" min="0" max="360"><br>
  Mode <input type="range" id="ring2Mode" min="0" max="4" step="1">
  <span id="m2" style="font-size:10px"> neon</span><br>
  Audio Boost <input type="range" id="ring2AudioBoost" min="0" max="6" step="0.1"><br>
  <hr><b>RING 3 🟢 (tilted)</b><br>
  Speed <input type="range" id="ring3Speed" min="-0.03" max="0.03" step="0.001"><br>
  Radius <input type="range" id="ring3Radius" min="80" max="450"><br>
  Size <input type="range" id="ring3Size" min="8" max="70"><br>
  Hue <input type="range" id="ring3Hue" min="0" max="360"><br>
  Mode <input type="range" id="ring3Mode" min="0" max="4" step="1">
  <span id="m3" style="font-size:10px"> holo</span><br>
  Audio Boost <input type="range" id="ring3AudioBoost" min="0" max="6" step="0.1"><br>
  Tilt <input type="range" id="ring3Tilt" min="0" max="1.57" step="0.05"><br>
  <hr><b>GLOBAL TEXT</b><br>
  Font <input type="text" id="textFontFamilyInput" style="width:130px;background:#111;color:#fff;border:1px solid #444;padding:2px 4px;font-size:11px;"><br>
  Letter Spacing <input type="range" id="letterSpacing" min="0.4" max="3" step="0.05"><br>
  Glow Size <input type="range" id="glowSize" min="0" max="50"><br>
  Text Saturation <input type="range" id="saturation2" min="0" max="100"><br>
  Text Lightness <input type="range" id="lightness2" min="10" max="100"><br>
  Depth Fade <input type="range" id="depthFade" min="0" max="1" step="1"><br>
  Holo Scanlines <input type="range" id="holoScanlines" min="0" max="1" step="1"><br>
  Glitch on Beat <input type="range" id="glitchOnBeat" min="0" max="1" step="1"><br>
  Glitch Intensity <input type="range" id="glitchIntensity" min="1" max="30"><br>
  Beat Threshold <input type="range" id="beatThreshold" min="0.2" max="0.9" step="0.05"><br>
  `;
  document.body.appendChild(devPanel);
  const ml=[devPanel.querySelector("#m1"),devPanel.querySelector("#m2"),devPanel.querySelector("#m3")];
  Object.keys(settings).forEach(key=>{
    const el=devPanel.querySelector(`#${key}`);
    if(!el)return;
    el.value=settings[key];
    el.addEventListener("input",e=>{
      settings[key]=parseFloat(e.target.value);
      if(key==="ring1Mode"&&ml[0])ml[0].textContent=" "+modes[settings.ring1Mode];
      if(key==="ring2Mode"&&ml[1])ml[1].textContent=" "+modes[settings.ring2Mode];
      if(key==="ring3Mode"&&ml[2])ml[2].textContent=" "+modes[settings.ring3Mode];
    });
  });
  // Font text input
  const fontInp=devPanel.querySelector("#textFontFamilyInput");
  if(fontInp){
    fontInp.value=settings.textFontFamily;
    fontInp.addEventListener("input",e=>{settings.textFontFamily=e.target.value;});
    fontInp.addEventListener("keydown",e=>e.stopPropagation());
  }
}
createDevPanel();

/* ======================================================
 DRAW
====================================================== */
function draw() {
  requestAnimationFrame(draw);
  if(devPanel) devPanel.style.display=devPanelActive?"block":"none";
  analyser.getByteFrequencyData(freqData);

  const bass=avg(0,15);
  const mid=avg(15,80);
  const high=avg(80,180);
  frame++;

  ensureGeometry();

  // Beat detection for glitch
  if(settings.glitchOnBeat && bass>settings.beatThreshold && lastBass<=settings.beatThreshold) {
    glitchActive = 12;
  }
  if(glitchActive>0) glitchActive--;
  lastBass=bass;

  rx+=settings.rotX*(1+bass*settings.rotAudioMult);
  ry+=settings.rotY*(1+mid*settings.rotAudioMult);

  ringAngles[0]+=settings.ring1Speed*(1+bass*settings.ring1AudioBoost);
  ringAngles[1]+=settings.ring2Speed*(1+mid*settings.ring2AudioBoost);
  ringAngles[2]+=settings.ring3Speed*(1+high*settings.ring3AudioBoost);

  ctx.fillStyle=`rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0,0,width,height);

  // Project sphere
  const R=settings.radius;
  const vCount=vertices.length;
  for(let i=0;i<vCount;i++){
    const v=vertices[i];
    const fi=Math.floor((i/vCount)*200)%256;
    const fv=(freqData[fi]||0)/255;
    const noise=(Math.sin(v[0]*17.3+frame*0.02)*Math.cos(v[1]*13.7+frame*0.015))*settings.displaceNoise;
    const r=R*(1+fv*settings.displaceAmp/R+noise*settings.displaceAmp/R*0.3+bass*0.1);
    const[px,py,d]=rotProject(v[0],v[1],v[2],r);
    projX[i]=px;projY[i]=py;projD[i]=d;
  }

  // Build all ring char arrays
  const ring1Chars=buildRingChars(ringTexts[0],ringAngles[0],settings.ring1Radius,"equator",0,rx,ry,bass,mid,high);
  const ring2Chars=buildRingChars(ringTexts[1],ringAngles[1],settings.ring2Radius,"y",0,rx,ry,bass,mid,high);
  const ring3Chars=buildRingChars(ringTexts[2],ringAngles[2],settings.ring3Radius,"tilt",settings.ring3Tilt,rx,ry,bass,mid,high);

  ctx.save();
  ctx.globalCompositeOperation="lighter";

  // Draw sphere back half (buckets 0..mid)
  const buckets=Math.floor(settings.depthBuckets);
  const bf=Array.from({length:buckets},()=>[]);
  for(let fi2=0;fi2<faces.length;fi2++){
    const[a,b,c]=faces[fi2];
    const d=(projD[a]+projD[b]+projD[c])/3;
    bf[Math.min(buckets-1,Math.floor(d*buckets))].push(fi2);
  }

  const drawBucket=(bi)=>{
    const bF=bf[bi];if(!bF.length)return;
    const t=bi/buckets;
    const hue=(settings.hueBase+t*settings.hueRange+frame*settings.hueTimeSpeed)%360;
    const alpha=t*0.6+0.2;
    if(settings.drawFaces){ctx.beginPath();for(const fi2 of bF){const[a,b,c]=faces[fi2];ctx.moveTo(projX[a],projY[a]);ctx.lineTo(projX[b],projY[b]);ctx.lineTo(projX[c],projY[c]);ctx.closePath();}ctx.fillStyle=`hsla(${hue},${settings.saturation}%,${settings.lightness}%,${settings.faceAlpha*alpha})`;ctx.fill();}
    if(settings.drawEdges){ctx.beginPath();for(const fi2 of bF){const[a,b,c]=faces[fi2];ctx.moveTo(projX[a],projY[a]);ctx.lineTo(projX[b],projY[b]);ctx.lineTo(projX[c],projY[c]);ctx.closePath();}ctx.strokeStyle=`hsla(${hue},${settings.saturation}%,${Math.min(90,settings.lightness+15)}%,${alpha})`;ctx.lineWidth=settings.edgeWidth;ctx.stroke();}
    bF.length=0;
  };

  const mid2=Math.floor(buckets/2);
  for(let bi=0;bi<mid2;bi++) drawBucket(bi);

  // Draw all 3 rings depth-sorted together
  const allChars=[
    ...ring1Chars.map(c=>({...c,ringMode:Math.floor(settings.ring1Mode),ringHue:settings.ring1Hue,ringSize:settings.ring1Size})),
    ...ring2Chars.map(c=>({...c,ringMode:Math.floor(settings.ring2Mode),ringHue:settings.ring2Hue,ringSize:settings.ring2Size})),
    ...ring3Chars.map(c=>({...c,ringMode:Math.floor(settings.ring3Mode),ringHue:settings.ring3Hue,ringSize:settings.ring3Size})),
  ];
  allChars.sort((a,b)=>a.depth-b.depth);
  allChars.forEach(cd=>{
    drawRingChar(cd, cd.ringMode, cd.ringHue, cd.ringSize, bass);
  });

  // Front half of sphere
  for(let bi=mid2;bi<buckets;bi++) drawBucket(bi);

  ctx.restore();
}

draw();
