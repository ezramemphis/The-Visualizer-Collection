const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let width, height;

function resize(){
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

let frame = 0;





const visualizers = [

/* 1 — SINGLE MOVING DOT (basics of animation) */
() => {
  const x = (frame * 2) % width;
  ctx.fillStyle = "white";
  ctx.fillRect(x, height/2, 10, 10);
},

/* 2 — BOUNCING BALL (motion logic) */
() => {
  const x = Math.sin(frame * 0.05) * 200 + width/2;
  ctx.beginPath();
  ctx.arc(x, height/2, 20, 0, Math.PI*2);
  ctx.fillStyle = "cyan";
  ctx.fill();
},

/* 3 — SIMPLE LINE (drawing paths) */
() => {
  ctx.beginPath();
  ctx.moveTo(0, height/2);
  ctx.lineTo(width, height/2);
  ctx.strokeStyle = "white";
  ctx.stroke();
},

/* 4 — SINE WAVE (core math) */
() => {
  ctx.beginPath();
  for(let x=0;x<width;x++){
    const y = height/2 + Math.sin(x*0.01) * 50;
    x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.strokeStyle = "lime";
  ctx.stroke();
},

/* 5 — ANIMATED SINE (time) */
() => {
  ctx.beginPath();
  for(let x=0;x<width;x++){
    const y = height/2 + Math.sin(x*0.01 + frame*0.05)*60;
    x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.strokeStyle = "yellow";
  ctx.stroke();
},

/* 6 — MULTI WAVE (layering) */
() => {
  ctx.beginPath();
  for(let x=0;x<width;x++){
    let y = 0;
    y += Math.sin(x*0.01 + frame*0.05)*40;
    y += Math.sin(x*0.02 + frame*0.03)*20;
    y += height/2;
    x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.strokeStyle = "magenta";
  ctx.stroke();
},

/* 7 — GRID (structure) */
() => {
  for(let y=0;y<20;y++){
    for(let x=0;x<20;x++){
      ctx.fillRect(x*40, y*40, 3, 3);
    }
  }
},

/* 8 — RANDOM PARTICLES (noise) */
() => {
  for(let i=0;i<100;i++){
    ctx.fillRect(Math.random()*width, Math.random()*height, 2, 2);
  }
},

/* 9 — RADIAL POINTS (polar intro) */
() => {
  for(let i=0;i<500;i++){
    const angle = i * 0.02;
    const radius = i * 0.2;

    const x = Math.cos(angle)*radius + width/2;
    const y = Math.sin(angle)*radius + height/2;

    ctx.fillRect(x,y,2,2);
  }
},

/* 10 — SPIRAL (polar + animation) */
() => {
  for(let i=0;i<500;i++){
    const angle = i * 0.02 + frame*0.02;
    const radius = i * 0.3;

    const x = Math.cos(angle)*radius + width/2;
    const y = Math.sin(angle)*radius + height/2;

    ctx.fillRect(x,y,2,2);
  }
},

/* 11 — CIRCLE WAVE (radial sine) */
() => {
  for(let i=0;i<500;i++){
    const angle = i * 0.02;
    const radius = 150 + Math.sin(i*0.1 + frame*0.1)*30;

    const x = Math.cos(angle)*radius + width/2;
    const y = Math.sin(angle)*radius + height/2;

    ctx.fillRect(x,y,2,2);
  }
},

/* 12 — COLOR CYCLING (hue system) */
() => {
  const hue = frame % 360;
  ctx.fillStyle = `hsl(${hue},100%,50%)`;
  ctx.fillRect(0,0,width,height);
},

/* 13 — HORIZONTAL STRIPES (iteration) */
() => {
  for(let y=0;y<height;y+=10){
    const hue = (y + frame) % 360;
    ctx.strokeStyle = `hsl(${hue},100%,50%)`;

    ctx.beginPath();
    ctx.moveTo(0,y);
    ctx.lineTo(width,y);
    ctx.stroke();
  }
},

/* 14 — TRAIL EFFECT (alpha fade) */
() => {
  ctx.fillStyle = "rgba(0,0,0,0.02)";
  ctx.fillRect(0,0,width,height);

  const x = Math.random()*width;
  const y = Math.random()*height;

  ctx.fillStyle = "white";
  ctx.fillRect(x,y,3,3);
},

/* 15 — LINE GRID TERRAIN (2D heightmap) */
() => {
  const grid = 50;

  for(let y=0;y<grid;y++){
    ctx.beginPath();

    for(let x=0;x<grid;x++){
      const px = x*15;
      const py = y*15 + Math.sin(x*0.5 + frame*0.1)*20;

      x===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
    }

    ctx.strokeStyle = "white";
    ctx.stroke();
  }
},

/* 16 — FRACTAL TERRAIN (layering waves) */
() => {
  const grid = 50;

  for(let y=0;y<grid;y++){
    ctx.beginPath();

    for(let x=0;x<grid;x++){
      let z = 0;
      z += Math.sin(x*0.3 + frame*0.1)*20;
      z += Math.sin(x*0.6 + frame*0.05)*10;

      const px = x*15;
      const py = y*15 - z;

      x===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
    }

    ctx.strokeStyle = "cyan";
    ctx.stroke();
  }
},

/* 17 — VORTEX (radial pull) */
() => {
  for(let i=0;i<1000;i++){
    let angle = i * 0.02;
    let radius = i * 0.2;

    radius *= 0.95;

    const x = Math.cos(angle + frame*0.02)*radius + width/2;
    const y = Math.sin(angle + frame*0.02)*radius + height/2;

    ctx.fillRect(x,y,2,2);
  }
},

/* 18 — ADDITIVE GLOW (blend mode) */
() => {
  ctx.globalCompositeOperation = "lighter";

  for(let i=0;i<50;i++){
    ctx.fillStyle = `hsl(${(frame+i*10)%360},100%,50%)`;
    ctx.beginPath();
    ctx.arc(
      Math.random()*width,
      Math.random()*height,
      20,
      0,
      Math.PI*2
    );
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
},

/* 19 — SCREEN DISTORT (drawImage trick) */
() => {
  ctx.drawImage(canvas, 0, 0);

  const slice = Math.random()*height;
  ctx.drawImage(canvas, 0, slice, width, 10, Math.random()*20, slice, width, 10);
},

/* 20 — MINI FULL SYSTEM */
() => {
  const grid = 60;

  ctx.translate(width/2, height/2);

  for(let y=-grid;y<grid;y++){
    ctx.beginPath();

    for(let x=-grid;x<grid;x++){
      const z =
        Math.sin(x*0.1 + frame*0.02) +
        Math.cos(y*0.1 + frame*0.02);

      const px = x*10;
      const py = y*10 - z*50;

      x===-grid ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
    }

    ctx.strokeStyle = `hsl(${(y*5+frame)%360},100%,50%)`;
    ctx.stroke();
  }

  ctx.resetTransform();
}

];






//LINK IT UP

function getVisualizer(index){
  const i = index - 1; // convert to 0-based internally

  // 1–20 → main file
  if(i < visualizers.length){
    return visualizers[i];
  }

  // 21–40 → extension1
  if(window.extension1Visualizers && i < 40){
    return window.extension1Visualizers[i - 20];
  }

  // 41–60 → extension2
  if(window.extension2Visualizers && i < 60){
    return window.extension2Visualizers[i - 40];
  }

  // fallback (if something breaks)
  return visualizers[0];
}




function draw(){
  requestAnimationFrame(draw);
  frame++;

  // fade trail
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0,0,width,height);

  // 👉 SWITCH BETWEEN VISUALIZERS HERE
  visualizers[42](); // change index (0–19)
}

draw();







