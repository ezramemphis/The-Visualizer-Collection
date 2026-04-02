window.extension2Visualizers = [

/* 41 — COMPLEX FIELD */
() => {
  for(let x=0;x<width;x+=5){
    for(let y=0;y<height;y+=5){
      const v =
        Math.sin(x*0.01 + frame*0.02) *
        Math.cos(y*0.01 + frame*0.02);

      ctx.fillStyle=`hsl(${v*200+200},100%,50%)`;
      ctx.fillRect(x,y,5,5);
    }
  }
},

/* 42 — FLOW FIELD */
() => {
  for(let i=0;i<1000;i++){
    const x=Math.random()*width;
    const y=Math.random()*height;

    const angle = Math.sin(x*0.01 + frame*0.02)*Math.PI;

    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x+Math.cos(angle)*10, y+Math.sin(angle)*10);
    ctx.stroke();
  }
},

/* 43 — TUNNEL */
() => {
  for(let i=0;i<200;i++){
    const z = (i+frame)%200;
    const scale = 200/z;

    const x = width/2 + Math.sin(i)*scale*100;
    const y = height/2 + Math.cos(i)*scale*100;

    ctx.fillRect(x,y,2,2);
  }
},

/* 44 — FRACTAL BURST */
() => {
  for(let i=0;i<1000;i++){
    let x=0,y=0;

    for(let j=0;j<10;j++){
      const nx = Math.sin(y + frame*0.01)*2;
      const ny = Math.cos(x + frame*0.01)*2;
      x=nx; y=ny;
    }

    ctx.fillRect(x*100+width/2, y*100+height/2,1,1);
  }
},

// 45–60 deeper generative systems
...Array.from({length:16}, (_,i)=>()=> {
  for(let j=0;j<2000;j++){
    const t = j*0.01;
    const x = Math.sin(t + frame*0.01*(i+1))*200;
    const y = Math.cos(t + frame*0.02*(i+1))*200;

    ctx.fillRect(x+width/2,y+height/2,1,1);
  }
})

];