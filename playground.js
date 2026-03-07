/* =============================
TEMPLATES
============================= */
export const templates = {

t1:`const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
function draw(){
  requestAnimationFrame(draw);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  let t = Date.now()*0.001;
  ctx.fillStyle = "cyan";
  for(let i=0;i<120;i++){
    let x = canvas.width/2 + Math.sin(t+i)*220;
    let y = canvas.height/2 + Math.cos(t+i*0.5)*150;
    ctx.fillRect(x,y,2,2);
  }
}
draw();`,

t2:`const canvas=document.querySelector("canvas");
const ctx=canvas.getContext("2d");
function draw(){
  requestAnimationFrame(draw);
  ctx.fillStyle="rgba(0,0,0,0.2)";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  let t=Date.now()*0.002;
  let radius=120+Math.sin(t)*40;
  let x=canvas.width/2;
  let y=canvas.height/2;
  ctx.beginPath();
  ctx.arc(x,y,radius,0,Math.PI*2);
  ctx.strokeStyle="cyan";
  ctx.shadowBlur=40;
  ctx.shadowColor="cyan";
  ctx.lineWidth=3;
  ctx.stroke();
}
draw();`,

t3:`const canvas=document.querySelector("canvas");
const ctx=canvas.getContext("2d");
function draw(){
  requestAnimationFrame(draw);
  ctx.fillStyle="rgba(0,0,0,0.08)";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  let t=Date.now()*0.001;
  ctx.strokeStyle="magenta";
  ctx.beginPath();
  for(let i=0;i<220;i++){
    let x=i*5;
    let y=canvas.height/2 + Math.sin(i*0.1+t)*90;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
}
draw();`,

t4:`const canvas=document.querySelector("canvas");
const ctx=canvas.getContext("2d");
function draw(){
  requestAnimationFrame(draw);
  ctx.fillStyle="black";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let i=0;i<80;i++){
    let h=Math.random()*180;
    ctx.fillStyle="cyan";
    ctx.fillRect(i*10,canvas.height-h,6,h);
  }
}
draw();`,

t5:`const canvas=document.querySelector("canvas");
const ctx=canvas.getContext("2d");
function draw(){
  requestAnimationFrame(draw);
  let img=ctx.getImageData(0,0,canvas.width,canvas.height);
  let d=img.data;
  for(let i=0;i<d.length;i+=4){
    let noise=Math.random()*20;
    d[i]+=noise; d[i+1]+=noise; d[i+2]+=noise;
  }
  ctx.putImageData(img,0,0);
}
draw();`
};

/* =============================
DOM REFERENCES
============================= */
const editor = document.getElementById("editor");
const frame = document.getElementById("previewFrame");
const templateSelect = document.getElementById("templateSelect");

/* =============================
INITIALIZE
============================= */
editor.value = templates.t1;
initSandbox(editor.value);

/* =============================
TEMPLATE LOAD
============================= */
templateSelect.onchange = () => {
  const code = templates[templateSelect.value];
  if(code){
    editor.value = code;
    updateSandbox(code);
  }
};

/* =============================
REAL-TIME UPDATE
============================= */
let timeout;
editor.addEventListener("input", ()=>{
  clearTimeout(timeout);
  timeout = setTimeout(()=>updateSandbox(editor.value), 100);
});

/* =============================
SANDBOX FUNCTIONS
============================= */
function initSandbox(code){
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <body style="margin:0;overflow:hidden;background:black">
        <canvas id="sandbox"></canvas>
        <script>
          const canvas=document.getElementById("sandbox");
          function resize(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;}
          window.addEventListener("resize",resize);
          resize();
          const ctx=canvas.getContext("2d");
          ${code}
        <\/script>
      </body>
    </html>
  `);
  doc.close();
}

function updateSandbox(code){
  const doc = frame.contentDocument;
  const canvasCode = `
    const canvas=document.getElementById("sandbox");
    function resize(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;}
    window.addEventListener("resize",resize);
    resize();
    const ctx=canvas.getContext("2d");
    ${code}
  `;
  doc.body.innerHTML = '<canvas id="sandbox"></canvas><script>'+canvasCode+'<\/script>';
}