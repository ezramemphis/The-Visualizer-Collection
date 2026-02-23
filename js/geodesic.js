import { ctx, canvas, analyser, freqData, timeData, devPanelActive } from "./visualizer.js";

let frame = 0, width = canvas.width, height = canvas.height;
function resize() { width = canvas.width; height = canvas.height; }
window.addEventListener("resize", resize);
function avg(s, e) { let v = 0; for (let i = s; i < e; i++) v += freqData[i]; return v / (e - s) / 255; }

// ===== DEV PANEL =====
const settings = {
  lineCount: 70,
  lineDensity: 6,       // smaller = more lines
  radialAmp: 50,
  spiralTwist: 3.5,
  lineWidthBase: 1.5,
  hueStart: 0,
  hueEnd: 360,
  waveAmplitude: 80,
  bgAlpha: 0.15
};

let devPanel;
function createDevPanel() {
  devPanel = document.createElement("div");
  devPanel.style.position = "fixed";
  devPanel.style.top = "5px";
  devPanel.style.left = "5px";
  devPanel.style.padding = "6px 10px";
  devPanel.style.background = "rgba(0,0,0,0.7)";
  devPanel.style.color = "#fff";
  devPanel.style.fontFamily = "sans-serif";
  devPanel.style.fontSize = "12px";
  devPanel.style.borderRadius = "4px";
  devPanel.style.zIndex = 9999;
  devPanel.style.display = "none";

  devPanel.innerHTML = `
    <div style="margin-bottom:4px;font-weight:bold;font-size:10px;">DEV PANEL</div>
    <label>Line Count: <input type="range" id="devLineCount" min="10" max="120" step="1" value="${settings.lineCount}"></label><br>
    <label>Line Density: <input type="range" id="devLineDensity" min="1" max="12" step="0.1" value="${settings.lineDensity}"></label><br>
    <label>Radial Amp: <input type="range" id="devRadialAmp" min="0" max="200" step="1" value="${settings.radialAmp}"></label><br>
    <label>Spiral Twist: <input type="range" id="devSpiralTwist" min="0" max="6" step="0.01" value="${settings.spiralTwist}"></label><br>
    <label>Line Width Base: <input type="range" id="devLineWidthBase" min="0.5" max="10" step="0.1" value="${settings.lineWidthBase}"></label><br>
    <label>Wave Amp: <input type="range" id="devWaveAmplitude" min="0" max="300" step="1" value="${settings.waveAmplitude}"></label><br>
    <label>Hue Start: <input type="range" id="devHueStart" min="0" max="360" step="1" value="${settings.hueStart}"></label><br>
    <label>Hue End: <input type="range" id="devHueEnd" min="0" max="360" step="1" value="${settings.hueEnd}"></label><br>
    <label>BG Alpha: <input type="range" id="devBgAlpha" min="0" max="1" step="0.01" value="${settings.bgAlpha}"></label>
  `;

  document.body.appendChild(devPanel);
  const bind = (id, prop, parse=parseFloat) => {
    document.getElementById(id).addEventListener("input", e => settings[prop] = parse(e.target.value));
  };
  bind("devLineCount","lineCount",parseInt);
  bind("devLineDensity","lineDensity");
  bind("devRadialAmp","radialAmp");
  bind("devSpiralTwist","spiralTwist");
  bind("devLineWidthBase","lineWidthBase");
  bind("devWaveAmplitude","waveAmplitude");
  bind("devHueStart","hueStart",parseInt);
  bind("devHueEnd","hueEnd",parseInt);
  bind("devBgAlpha","bgAlpha");
}
createDevPanel();

// ===== DRAW LOOP =====
function draw() {
  requestAnimationFrame(draw);
  devPanel.style.display = devPanelActive ? "block" : "none";

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);
  const bass = avg(0,12), mid = avg(20,90), high = avg(80,180);
  frame++;

  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0,0,width,height);

  ctx.save();
  ctx.translate(width/2,height/2);
  ctx.globalCompositeOperation = "lighter";

  for(let l=0;l<settings.lineCount;l++){
    ctx.beginPath();
    const hue = (settings.hueStart + ((settings.hueEnd-settings.hueStart)*(l/settings.lineCount)+frame*1.5))%360;
    ctx.strokeStyle = `hsla(${hue},100%,50%,0.6)`;
    ctx.lineWidth = settings.lineWidthBase*(0.5 + high*2);

    for(let i=0;i<Math.PI*8;i+=0.02){
      const idx = (i/(Math.PI*8)*timeData.length)|0;
      const waveform = (timeData[idx]-128)/128;

      // crazy experimental radius
      const radial = i*settings.lineDensity
                   + Math.sin(i*settings.spiralTwist + frame*0.02 + l)*settings.radialAmp
                   + Math.cos(i*3 + frame*0.01*l)*settings.waveAmplitude*waveform
                   + bass*50;

      const x = Math.cos(i + l*0.2 + frame*0.01) * radial;
      const y = Math.sin(i*1.2 + l*0.3 + frame*0.012) * radial;

      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }

    ctx.stroke();
  }

  // ===== secondary chaotic ripples =====
  for(let l=0;l<settings.lineCount/2;l++){
    ctx.beginPath();
    const hue = (settings.hueEnd - ((settings.hueEnd-settings.hueStart)*(l/(settings.lineCount/2))) + frame*2.5)%360;
    ctx.strokeStyle = `hsla(${hue},80%,60%,0.3)`;
    ctx.lineWidth = settings.lineWidthBase*0.7*(0.5+mid);

    for(let i=0;i<Math.PI*6;i+=0.03){
      const idx = (i/(Math.PI*6)*timeData.length)|0;
      const waveform = (timeData[idx]-128)/128;

      const radial = i*settings.lineDensity*0.8
                   + Math.sin(i*settings.spiralTwist*1.2 + frame*0.03 + l)*settings.radialAmp*0.6
                   + Math.cos(i*5 + frame*0.02*l)*settings.waveAmplitude*waveform*0.6
                   + mid*50;

      const x = Math.cos(i + l*0.3 + frame*0.008) * radial;
      const y = Math.sin(i*1.5 + l*0.5 + frame*0.009) * radial;

      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

draw();