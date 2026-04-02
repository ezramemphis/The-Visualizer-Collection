window.extension1Visualizers = [

/* 21 — EXPANDING RINGS */
() => {
  for(let i=0;i<10;i++){
    ctx.beginPath();
    ctx.arc(width/2, height/2, (frame+i*20)%300, 0, Math.PI*2);
    ctx.strokeStyle = `hsl(${(frame+i*20)%360},100%,50%)`;
    ctx.stroke();
  }
},

/* 22 — NOISE FIELD */
() => {
  for(let i=0;i<2000;i++){
    const x = Math.random()*width;
    const y = Math.random()*height;
    ctx.fillStyle = `hsl(${(x+y+frame)%360},100%,50%)`;
    ctx.fillRect(x,y,1,1);
  }
},

/* 23 — WAVE INTERFERENCE */
() => {
  ctx.beginPath();
  for(let x=0;x<width;x++){
    const y = height/2 +
      Math.sin(x*0.02 + frame*0.05)*40 +
      Math.sin(x*0.03 + frame*0.08)*20;
    x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.strokeStyle = "white";
  ctx.stroke();
},

/* 24 — ROTATING GRID */
() => {
  ctx.translate(width/2,height/2);
  ctx.rotate(frame*0.01);

  for(let x=-200;x<200;x+=20){
    ctx.beginPath();
    ctx.moveTo(x,-200);
    ctx.lineTo(x,200);
    ctx.stroke();
  }

  ctx.resetTransform();
},

/* 25 — PULSE CIRCLE */
() => {
  const r = 100 + Math.sin(frame*0.1)*50;
  ctx.beginPath();
  ctx.arc(width/2,height/2,r,0,Math.PI*2);
  ctx.strokeStyle="cyan";
  ctx.stroke();
},

/* 26 — STARFIELD */
() => {
  for(let i=0;i<500;i++){
    const x = (Math.random()-0.5)*width + width/2;
    const y = (Math.random()-0.5)*height + height/2;
    ctx.fillRect(x,y,1,1);
  }
},

/* 27 — ORBITING DOTS */
() => {
  for(let i=0;i<20;i++){
    const angle = frame*0.02 + i;
    const x = Math.cos(angle)*150 + width/2;
    const y = Math.sin(angle)*150 + height/2;
    ctx.fillRect(x,y,4,4);
  }
},

/* 28 — GRID WAVE */
() => {
  for(let y=0;y<20;y++){
    for(let x=0;x<20;x++){
      const offset = Math.sin(frame*0.1 + x+y)*10;
      ctx.fillRect(x*30, y*30+offset, 3, 3);
    }
  }
},

/* 29 — HUE SPIRAL */
() => {
  for(let i=0;i<500;i++){
    const a=i*0.02+frame*0.02;
    const r=i*0.3;
    ctx.fillStyle=`hsl(${i%360},100%,50%)`;
    ctx.fillRect(
      Math.cos(a)*r+width/2,
      Math.sin(a)*r+height/2,
      2,2
    );
  }
},

/* 30 — BARS */
() => {
  for(let i=0;i<50;i++){
    const h = Math.sin(frame*0.1+i)*50+50;
    ctx.fillRect(i*20,height-h,15,h);
  }
},

// 31–40 (slightly more complex)
...Array.from({length:10}, (_,i)=>()=> {
  for(let j=0;j<500;j++){
    const a = j*0.02 + frame*0.01*(i+1);
    const r = j*0.2;
    ctx.fillRect(
      Math.cos(a)*r + width/2,
      Math.sin(a)*r + height/2,
      1,1
    );
  }
})

];