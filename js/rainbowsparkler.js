// ===============================
// VISUALIZER D — HYPERSPACE TUNNEL MEGA ULTRA
// ===============================

import { ctx, canvas, analyser, freqData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings } from "./visualizer.js";

let width = canvas.width;
let height = canvas.height;
let frame = 0;

/* ======================================================
 AUDIO HELPER
====================================================== */

function avg(s,e){
  let v = 0;
  const len = Math.max(1,e-s);
  for(let i=s;i<e;i++) v += freqData[i] || 0;
  return (v/len)/255;
}

/* ======================================================
 SETTINGS
====================================================== */

const settings = {

  // MAIN
  depthLines: 500,
  baseSpeed: 1,
  spiralTwist: 0.05,
  baseRadius: 600,
  radiusMod: 400,
  lineWidthBase: 1.8,
  bgAlpha: 0.06,
  glitchSlices: 40,
  particleShock: 2,

  // COLOR
  oneColorMode: 0,
  singleHue: 200,
  spectralHueShift: 1,
  hueMin: 0,
  hueMax: 360,
  colorPulse: 1,
  brightnessBoost: 0.3,
  saturationBoost: 0.2,

  // AUDIO REACTIVE
  bassPush: 1,
  midPull: 0.4,
  highTwist: 0.05,
  bassVortexMultiplier: 3,

  // VORTEX & DISTORTION
  vortexCount: 4,
  vortexStrength: 0.006,
  spiralChaos: 0.01,
  depthPulse: 3,
  twistOscillation: 0.02,

  // PARTICLE EFFECTS
  particleCount: 250,
  particleSize: 3,
  particleTrail: 0.08,
  particleSpeed: 1.5,
  particleGravity: 0.02,
  particleColorShift: 0.5
};

registerSceneSettings(settings);

/* ======================================================
 RESIZE
====================================================== */

function resize(){
  width = canvas.width;
  height = canvas.height;
}
window.addEventListener("resize", resize);
resize();

/* ======================================================
 DEV PANEL
====================================================== */

let devPanel;

function createDevPanel(){

  devPanel = document.createElement("div");

  Object.assign(devPanel.style,{
    position:"fixed",
    top:"5px",
    left:"5px",
    padding:"8px",
    background:"rgba(0,0,0,0.85)",
    color:"#fff",
    fontFamily:"sans-serif",
    fontSize:"12px",
    borderRadius:"6px",
    zIndex:9999,
    display:"none",
    maxHeight:"95vh",
    overflowY:"auto"
  });

  devPanel.innerHTML = `
  <b>HYPERSPACE TUNNEL MEGA ULTRA</b><hr>

  <b>MAIN</b><br>
  Depth Lines <input type="range" id="depthLines" min="50" max="600"><br>
  Base Speed <input type="range" id="baseSpeed" min="0" max="5" step="0.01"><br>
  Spiral Twist <input type="range" id="spiralTwist" min="0" max="0.1" step="0.001"><br>
  Base Radius <input type="range" id="baseRadius" min="100" max="1000"><br>
  Radius Mod <input type="range" id="radiusMod" min="0" max="600"><br>
  Line Width <input type="range" id="lineWidthBase" min="0.5" max="5" step="0.1"><br>
  BG Alpha <input type="range" id="bgAlpha" min="0" max="1" step="0.01"><br>
  Glitch Slices <input type="range" id="glitchSlices" min="0" max="100"><br>

  <hr><b>COLOR</b><br>
  One Color Mode <input type="range" id="oneColorMode" min="0" max="1" step="1"><br>
  Single Hue <input type="range" id="singleHue" min="0" max="360"><br>
  Hue Shift Speed <input type="range" id="spectralHueShift" min="0" max="5" step="0.01"><br>
  Hue Min <input type="range" id="hueMin" min="0" max="360"><br>
  Hue Max <input type="range" id="hueMax" min="0" max="360"><br>
  Color Pulse <input type="range" id="colorPulse" min="0" max="3" step="0.01"><br>
  Brightness Boost <input type="range" id="brightnessBoost" min="0" max="1" step="0.01"><br>
  Saturation Boost <input type="range" id="saturationBoost" min="0" max="1" step="0.01"><br>

  <hr><b>AUDIO REACTIVE</b><br>
  Bass Push <input type="range" id="bassPush" min="0" max="3" step="0.01"><br>
  Mid Pull <input type="range" id="midPull" min="0" max="1" step="0.01"><br>
  High Twist <input type="range" id="highTwist" min="0" max="0.1" step="0.001"><br>
  Bass Vortex Multiplier <input type="range" id="bassVortexMultiplier" min="1" max="10"><br>

  <hr><b>VORTEX & DISTORTION</b><br>
  Vortex Count <input type="range" id="vortexCount" min="1" max="8" step="1"><br>
  Vortex Strength <input type="range" id="vortexStrength" min="0" max="0.02" step="0.0001"><br>
  Spiral Chaos <input type="range" id="spiralChaos" min="0" max="0.05" step="0.0001"><br>
  Depth Pulse <input type="range" id="depthPulse" min="0" max="6" step="0.01"><br>
  Twist Oscillation <input type="range" id="twistOscillation" min="0" max="0.05" step="0.001"><br>

  <hr><b>PARTICLES</b><br>
  Particle Count <input type="range" id="particleCount" min="50" max="1000"><br>
  Particle Size <input type="range" id="particleSize" min="0.5" max="5" step="0.1"><br>
  Particle Trail <input type="range" id="particleTrail" min="0" max="0.2" step="0.01"><br>
  Particle Speed <input type="range" id="particleSpeed" min="0.1" max="5" step="0.01"><br>
  Particle Shock <input type="range" id="particleShock" min="0" max="5" step="0.01"><br>
  Particle Gravity <input type="range" id="particleGravity" min="0" max="0.1" step="0.001"><br>
  Particle Color Shift <input type="range" id="particleColorShift" min="0" max="2" step="0.01"><br>
  `;

  document.body.appendChild(devPanel);

  Object.keys(settings).forEach(key=>{
    const el = devPanel.querySelector(`#${key}`);
    if(!el) return;
    el.value = settings[key];
    el.addEventListener("input", e=>{
      settings[key] = parseFloat(e.target.value);
    });
  });
}

createDevPanel();

/* ======================================================
 PARTICLES
====================================================== */

const particles = Array.from({length:settings.particleCount}, ()=>({
  x: Math.random()*width,
  y: Math.random()*height,
  vx: 0,
  vy: 0
}));

/* ======================================================
 DRAW
====================================================== */

function drawHyperspaceMegaUltra(){

  requestAnimationFrame(drawHyperspaceMegaUltra);
  analyser.getByteFrequencyData(freqData);

  const bass = avg(0,20);
  const mid = avg(40,80);
  const high = avg(120,255);

  frame += settings.baseSpeed + bass*0.7;

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0,0,width,height);

  ctx.save();
  ctx.translate(width/2,height/2);
  ctx.globalCompositeOperation = "lighter";

  // DEPTH LINES
  for(let i=0;i<settings.depthLines;i++){
    const progress = i/settings.depthLines;

    let spiral = frame*settings.spiralTwist
                 + progress*settings.spiralChaos*high*10
                 + Math.sin(progress*5+frame*0.02)*0.5;

    let radius = settings.baseRadius + progress*settings.radiusMod
                 + Math.sin(frame*0.1+i*0.01)*bass*150;

    for(let v=0; v<settings.vortexCount; v++){
      const angleOffset = Math.sin(frame*0.01 + v*3.14) 
                          * settings.vortexStrength * (bass*settings.bassVortexMultiplier +1);
      spiral += angleOffset;
    }

    const x = Math.cos(spiral)*radius;
    const y = Math.sin(spiral)*radius;

    const hue = settings.oneColorMode===1 ? 
                settings.singleHue : 
                (frame*settings.spectralHueShift + progress*360 
                 + Math.sin(frame*0.05)*360*settings.colorPulse) % 360;

    ctx.strokeStyle = `hsla(${hue},${80+settings.saturationBoost*20}%,${60+settings.brightnessBoost*20}%,${1-progress})`;
    ctx.lineWidth = settings.lineWidthBase*(1-progress)*(1+bass);

    ctx.beginPath();
    ctx.moveTo(x*0.95, y*0.95);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  // PARTICLES
  particles.forEach(p=>{
    p.vx += (Math.random()-0.5)*0.5 + bass*settings.particleShock;
    p.vy += (Math.random()-0.5)*0.5 + high*settings.particleSpeed + settings.particleGravity;

    p.x += p.vx;
    p.y += p.vy;

    if(p.x< -width/2) p.x = width/2;
    if(p.x> width/2) p.x = -width/2;
    if(p.y< -height/2) p.y = height/2;
    if(p.y> height/2) p.y = -height/2;

    const particleHue = (frame*settings.spectralHueShift 
                        + Math.sqrt(p.x*p.x+p.y*p.y)*settings.particleColorShift) % 360;
    ctx.fillStyle = `hsla(${particleHue},90%,70%,0.8)`;
    ctx.beginPath();
    ctx.arc(p.x,p.y,settings.particleSize,0,2*Math.PI);
    ctx.fill();
  });

  // GLITCH SLICES
  for(let i=0;i<settings.glitchSlices;i++){
    const sliceY = Math.random()*height;
    const sliceH = Math.random()*10 + 2;
    const offset = (Math.random()-0.5)*120;
    ctx.drawImage(canvas,0,sliceY,width,sliceH,
                  offset,sliceY,width,sliceH);
  }

  ctx.restore();
}

drawHyperspaceMegaUltra();