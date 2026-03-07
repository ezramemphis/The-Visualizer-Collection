// ==============================================
// FRACTAL TERRAIN — ZEN MODE VERSION
// ==============================================

let ctx, canvas, analyser, freqData;

let frame = 0;
let width = 0;
let height = 0;

/* ============================================
   AUDIO HELPER
============================================ */

function avg(s, e){
  let v = 0;
  const len = Math.max(1, e - s);
  for(let i = s; i < e; i++){
    v += freqData[i] || 0;
  }
  return (v / len) / 255;
}

/* ============================================
   SETTINGS (STATIC FOR ZEN)
============================================ */

const settings = {

  terrainScale: 0.1,
  terrainHeight: 80,
  fractalDepth: 3,
  timeFlowSpeed: 0.005,
  lineWidthBase: 1.3,
  bgAlpha: 0.15,

  oneColorMode: 0,
  singleHue: 200,
  spectralHueShift: 0.5,
  hueMin: 0,
  hueMax: 360,

  bassWarpIntensity: 6,
  chaosNoiseStrength: 0.005,
  vortexPull: 0.002,
  spiralTwist: 0.004,
  depthPulse: 1,
  glitchSlices: 0
};

/* ============================================
   INIT
============================================ */

export function init(env){
  ctx = env.ctx;
  canvas = env.canvas;
  analyser = env.analyser;
  freqData = env.freqData;

  width = canvas.width;
  height = canvas.height;

  frame = 0;
}

/* ============================================
   UPDATE
============================================ */

export function update(dt){

  analyser.getByteFrequencyData(freqData);

  frame += settings.timeFlowSpeed * 100;
}

/* ============================================
   RENDER
============================================ */

export function render(alpha){

  width = canvas.width;
  height = canvas.height;

  const bass = avg(0, 20);
  const high = avg(90, 180);

  ctx.save();
  ctx.globalAlpha = alpha;

  // subtle fade for blending
  ctx.fillStyle = `rgba(0,0,0,${settings.bgAlpha})`;
  ctx.fillRect(0, 0, width, height);

  const grid = 120;
  const stepX = width / grid;
  const stepY = height / grid;

  ctx.translate(width / 2, height / 2);
  ctx.globalCompositeOperation = "lighter";

  for(let y = -grid/2; y < grid/2; y++){

    ctx.beginPath();

    for(let x = -grid/2; x < grid/2; x++){

      const nx = x * settings.terrainScale;
      const ny = y * settings.terrainScale;

      let field =
        Math.sin(nx + frame * 0.02) +
        Math.cos(ny + frame * 0.013);

      let fractal = 0;

      for(let k = 1; k <= settings.fractalDepth; k++){
        fractal +=
          Math.sin(nx * k * 2 + frame * 0.01 * k) +
          Math.cos(ny * k * 3 + frame * 0.008 * k);
      }

      fractal /= settings.fractalDepth;

      const radius = Math.sqrt(x*x + y*y);
      const angle = Math.atan2(y, x);

      const bassWarp =
        Math.sin(radius * 0.05 - frame * 0.1)
        * bass
        * settings.bassWarpIntensity
        * 30;

      const chaos =
        (Math.sin(x * 0.6 + frame * 0.4) *
         Math.cos(y * 0.5 - frame * 0.3))
        * settings.chaosNoiseStrength
        * 1500;

      const vortexStrength =
        settings.vortexPull * (1 + bass * 5);

      const inwardPull =
        vortexStrength * radius;

      const warpedRadius =
        radius - inwardPull;

      const spiral =
        settings.spiralTwist * radius * (1 + high * 3);

      const finalAngle =
        angle + spiral;

      const warpedX =
        Math.cos(finalAngle) * warpedRadius;

      const warpedY =
        Math.sin(finalAngle) * warpedRadius;

      const depth =
        Math.sin(frame * 0.05 + radius * 0.1)
        * settings.depthPulse
        * 50;

      const terrain =
        (field + fractal)
        * settings.terrainHeight
        * (high + 0.25)
        + bassWarp
        + chaos
        + depth;

      const px = warpedX * stepX;
      const py = warpedY * stepY - terrain;

      if(x === -grid/2) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    /* COLOR SYSTEM */

    let hue;

    if(settings.oneColorMode === 1){
      hue = settings.singleHue;
    } else {
      const range = settings.hueMax - settings.hueMin;
      const cycle =
        (frame * settings.spectralHueShift + y * 5) % range;
      hue = settings.hueMin + cycle;
    }

    ctx.strokeStyle =
      `hsla(${hue},85%,60%,${high + 0.25})`;

    ctx.lineWidth =
      settings.lineWidthBase + high * 2;

    ctx.stroke();
  }

  /* GLITCH */

  if(settings.glitchSlices > 0){
    for(let i = 0; i < settings.glitchSlices; i++){
      const sliceY = Math.random() * height;
      const sliceH = Math.random() * 10 + 2;
      const offset = (Math.random() - 0.5) * 60;

      ctx.drawImage(
        canvas,
        0, sliceY, width, sliceH,
        offset, sliceY, width, sliceH
      );
    }
  }

  ctx.restore();
}

/* ============================================
   DESTROY
============================================ */

export function destroy(){
  // nothing persistent to clean up
}