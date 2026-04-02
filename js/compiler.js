// ===============================
// VISUALIZER — QUANTUM FIELD
// Wave function collapse, probability clouds, interference
// Draws the actual amplitude/probability field as pixels
// ===============================

import { ctx, canvas, analyser, freqData, timeData, devPanelActive } from "./visualizer.js";
import { registerSceneSettings, attachDetachButton, initFxFilters } from "./visualizer.js";

let width = canvas.width, height = canvas.height, frame = 0;
window.addEventListener("resize", () => { width=canvas.width; height=canvas.height; resizeField(); });

function avg(s,e){ let v=0; for(let i=s;i<e;i++) v+=freqData[i]||0; return v/Math.max(1,e-s)/255; }

const settings = {
  // Wave sources
  sourceCount:    3,
  waveSpeed:      0.04,
  waveFreq:       0.06,
  waveDecay:      0.003,

  // Field rendering
  fieldResolution:3,       // pixel block size (lower=sharper, heavier)
  fieldContrast:  1.8,
  probabilityMode:0,       // 0=amplitude 1=probability (|ψ|²)
  superpositionN: 3,

  // Audio
  bassWaveAdd:    2,
  midFreqShift:   0.02,
  highAmp:        0.5,
  beatCollapse:   1,
  beatThreshold:  0.60,

  // Color
  hue1:           200,
  hue2:           280,
  hue3:           60,
  hueSpeed:       0.4,
  saturation:     90,
  brightness:     60,
  negativeHue:    0,       // color negative amplitude differently

  // Sources
  sourceOrbit:    0.3,
  orbitSpeed:     0.008,
  sourcePhase:    1,       // phase difference between sources
  quantumJitter:  0.002,

  bgAlpha:        0.04,
};

registerSceneSettings(settings);

const devPanel = document.createElement("div");
Object.assign(devPanel.style,{
  position:"fixed",top:"5px",left:"5px",padding:"8px 10px",
  background:"rgba(5,5,15,0.9)",color:"#ccf0ff",fontFamily:"monospace",fontSize:"11px",
  borderRadius:"8px",zIndex:9999,display:"none",maxHeight:"95vh",overflowY:"auto",width:"200px",
  border:"1px solid #ffffff18"
});
devPanel.innerHTML=`
<div style="color:#44ccff;font-weight:bold;letter-spacing:0.1em;margin-bottom:8px">⬡ QUANTUM FIELD</div>

<b>WAVES</b><br>
Source Count <input type="range" id="sourceCount" min="1" max="8" step="1"><br>
Wave Speed <input type="range" id="waveSpeed" min="0.005" max="0.15" step="0.005"><br>
Wave Freq <input type="range" id="waveFreq" min="0.01" max="0.2" step="0.005"><br>
Wave Decay <input type="range" id="waveDecay" min="0" max="0.02" step="0.001"><br>

<hr style="border-color:#ffffff18;margin:6px 0">
<b>FIELD</b><br>
Resolution <input type="range" id="fieldResolution" min="1" max="8" step="1"><br>
Contrast <input type="range" id="fieldContrast" min="0.5" max="4" step="0.05"><br>
Probability Mode <input type="range" id="probabilityMode" min="0" max="1" step="1"><br>
Superposition N <input type="range" id="superpositionN" min="1" max="6" step="1"><br>

<hr style="border-color:#ffffff18;margin:6px 0">
<b>AUDIO</b><br>
Bass Wave Add <input type="range" id="bassWaveAdd" min="0" max="5" step="0.1"><br>
Mid Freq Shift <input type="range" id="midFreqShift" min="0" max="0.1" step="0.002"><br>
High Amp <input type="range" id="highAmp" min="0" max="2" step="0.05"><br>
Beat Collapse <input type="range" id="beatCollapse" min="0" max="1" step="1"><br>
Beat Threshold <input type="range" id="beatThreshold" min="0.3" max="0.9" step="0.01"><br>

<hr style="border-color:#ffffff18;margin:6px 0">
<b>COLOR</b><br>
Hue 1 <input type="range" id="hue1" min="0" max="360"><br>
Hue 2 <input type="range" id="hue2" min="0" max="360"><br>
Hue 3 <input type="range" id="hue3" min="0" max="360"><br>
Hue Speed <input type="range" id="hueSpeed" min="0" max="2" step="0.05"><br>
Saturation <input type="range" id="saturation" min="0" max="100"><br>
Brightness <input type="range" id="brightness" min="10" max="90"><br>
Negative Hue <input type="range" id="negativeHue" min="0" max="1" step="1"><br>
BG Alpha <input type="range" id="bgAlpha" min="0.01" max="0.3" step="0.01"><br>

<hr style="border-color:#ffffff18;margin:6px 0">
<b>SOURCES</b><br>
Source Orbit <input type="range" id="sourceOrbit" min="0" max="0.8" step="0.01"><br>
Orbit Speed <input type="range" id="orbitSpeed" min="-0.03" max="0.03" step="0.001"><br>
Source Phase <input type="range" id="sourcePhase" min="0" max="3.14" step="0.05"><br>
Quantum Jitter <input type="range" id="quantumJitter" min="0" max="0.02" step="0.0005"><br>
`;
document.body.appendChild(devPanel);
Object.keys(settings).forEach(k=>{
  const el=devPanel.querySelector(`#${k}`); if(!el)return;
  el.value=settings[k]; el.addEventListener("input",e=>settings[k]=parseFloat(e.target.value));
});
attachDetachButton(devPanel, settings);
initFxFilters();

// Offscreen field buffer
let fieldBuf, fieldCtx;
function resizeField(){
  fieldBuf = document.createElement("canvas");
  fieldBuf.width  = Math.ceil(width  / settings.fieldResolution);
  fieldBuf.height = Math.ceil(height / settings.fieldResolution);
  fieldCtx = fieldBuf.getContext("2d");
}
resizeField();

// Wave sources
const sources = [];
function buildSources(count, bass){
  sources.length=0;
  for(let i=0;i<count;i++){
    const angle=(i/count)*Math.PI*2;
    const orbit = settings.sourceOrbit * Math.min(width,height)*0.45;
    sources.push({
      x: 0.5 + Math.cos(angle+frame*settings.orbitSpeed)*orbit/width,
      y: 0.5 + Math.sin(angle+frame*settings.orbitSpeed)*orbit/height,
      phase: i * settings.sourcePhase,
      amp:   1 + i*0.1
    });
  }
}

let lastBass=0, collapseFlash=0;

function draw(){
  requestAnimationFrame(draw);
  devPanel.style.display = devPanelActive?"block":"none";
  analyser.getByteFrequencyData(freqData);

  const bass=avg(0,12), mid=avg(12,60), high=avg(60,160);
  frame++;

  if(bass>settings.beatThreshold && lastBass<=settings.beatThreshold && settings.beatCollapse){
    collapseFlash=1.0;
    // Shift source phases for visual collapse
    sources.forEach(s=>s.phase+=Math.PI);
  }
  lastBass=bass;
  if(collapseFlash>0) collapseFlash*=0.85;

  const R = settings.fieldResolution;
  const fw = Math.ceil(width/R);
  const fh = Math.ceil(height/R);

  if(fieldBuf.width!==fw || fieldBuf.height!==fh) resizeField();

  const globalHue = (settings.hue1 + frame*settings.hueSpeed*0.3)%360;
  const totalSources = Math.floor(settings.sourceCount) + Math.round(bass*settings.bassWaveAdd);
  buildSources(totalSources, bass);

  const freq = settings.waveFreq + mid*settings.midFreqShift;
  const t = frame * settings.waveSpeed;

  // Build field image
  const imgData = fieldCtx.createImageData(fw, fh);
  const data = imgData.data;

  for(let py=0;py<fh;py++){
    for(let px=0;px<fw;px++){
      const nx = px/fw;
      const ny = py/fh;

      let psi=0;
      for(let s=0;s<sources.length;s++){
        const src=sources[s];
        const dx=nx-(src.x+(Math.random()-0.5)*settings.quantumJitter);
        const dy=ny-(src.y+(Math.random()-0.5)*settings.quantumJitter);
        const dist=Math.sqrt(dx*dx+dy*dy);
        const wave=Math.sin(dist*freq*80 - t + src.phase) * Math.exp(-dist*settings.waveDecay*80);

        // Superposition
        for(let k=0;k<Math.floor(settings.superpositionN);k++){
          psi += wave * src.amp * Math.cos(k*dist*10) * (1+high*settings.highAmp*0.3);
        }
      }

      psi /= sources.length * settings.superpositionN;

      let val = settings.probabilityMode ? psi*psi : psi;
      val = Math.tanh(val*settings.fieldContrast);

      const idx = (py*fw+px)*4;
      const positive = val>0;
      const magnitude = Math.abs(val);

      let h = positive
        ? (globalHue + magnitude*settings.hue2*0.1)%360
        : settings.negativeHue ? (globalHue+180)%360 : (globalHue+60)%360;

      // Convert HSL to RGB
      const s2=settings.saturation/100, l2=(settings.brightness*magnitude)/100;
      const c=(1-Math.abs(2*l2-1))*s2;
      const x2=c*(1-Math.abs((h/60)%2-1));
      const m2=l2-c/2;
      let r=0,g=0,b=0;
      if(h<60){r=c;g=x2;}else if(h<120){r=x2;g=c;}
      else if(h<180){g=c;b=x2;}else if(h<240){g=x2;b=c;}
      else if(h<300){r=x2;b=c;}else{r=c;b=x2;}

      data[idx]  =((r+m2)*255)|0;
      data[idx+1]=((g+m2)*255)|0;
      data[idx+2]=((b+m2)*255)|0;
      data[idx+3]=(magnitude*255)|0;
    }
  }

  fieldCtx.putImageData(imgData, 0, 0);

  ctx.fillStyle=`rgba(0,0,8,${settings.bgAlpha})`;
  ctx.fillRect(0,0,width,height);

  ctx.globalCompositeOperation="lighter";
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(fieldBuf, 0, 0, width, height);
  ctx.imageSmoothingEnabled=true;
  ctx.globalCompositeOperation="source-over";

  // Collapse flash
  if(collapseFlash>0.02){
    ctx.fillStyle=`rgba(100,200,255,${collapseFlash*0.15})`;
    ctx.fillRect(0,0,width,height);
  }

  // Source indicators
  ctx.globalCompositeOperation="lighter";
  sources.forEach((src,i)=>{
    const sx=src.x*width, sy=src.y*height;
    const hue=(globalHue+i*40)%360;
    ctx.beginPath();
    ctx.arc(sx,sy,4+bass*10,0,Math.PI*2);
    ctx.strokeStyle=`hsla(${hue},100%,80%,${0.4+bass*0.6})`;
    ctx.lineWidth=1.5;
    ctx.stroke();
  });
  ctx.globalCompositeOperation="source-over";
}

draw();
