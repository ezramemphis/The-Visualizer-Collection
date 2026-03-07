// ===============================================
// MILKDROP — CHAOTIC EVOLUTION ENGINE
// ===============================================

import { analyser, freqData,  } from "./visualizer.js";

// -----------------------------------------------
// Canvas (self-contained)
// -----------------------------------------------

const OLD = document.getElementById("milkdrop-canvas");
if (OLD) OLD.remove();

const canvas = document.createElement("canvas");
canvas.id = "milkdrop-canvas";
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.appendChild(canvas);

// -----------------------------------------------
// WebGL Context
// -----------------------------------------------

const gl =
  canvas.getContext("webgl", { premultipliedAlpha: false }) ||
  canvas.getContext("experimental-webgl");

if (!gl) throw new Error("WebGL not supported.");

// -----------------------------------------------
// Resize + Rebuild
// -----------------------------------------------

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  rebuildBuffers();
}
window.addEventListener("resize", resize);

// -----------------------------------------------
// Shader Utils
// -----------------------------------------------

function compile(type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function createProgram(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p));
  return p;
}

// -----------------------------------------------
// Fullscreen Quad
// -----------------------------------------------

const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
     1,  1
  ]),
  gl.STATIC_DRAW
);

// -----------------------------------------------
// Shaders
// -----------------------------------------------

const vertexShader = `
attribute vec2 position;
varying vec2 vUv;
void main(){
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision mediump float;

varying vec2 vUv;

uniform sampler2D prevFrame;
uniform float time;
uniform float bass;
uniform float rotVel;
uniform float zoomPump;
uniform float chaos;
uniform float symmetry;
uniform float warpAmount;

vec2 kaleido(vec2 uv, float n){
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    float sector = 6.28318 / n;
    a = mod(a, sector);
    a = abs(a - sector*0.5);
    return vec2(cos(a), sin(a)) * r;
}

void main(){

    vec2 uv = vUv - 0.5;

    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // rotational chaos
    a += rotVel * 3.0;
    a += sin(time*0.5 + r*12.0) * chaos;

    r *= 1.0 + zoomPump;

    uv = vec2(cos(a), sin(a)) * r;

    // kaleidoscope folding
    uv = kaleido(uv, symmetry);

    // domain tearing
    uv.x += sin(uv.y*10.0 + time*2.0) * warpAmount;
    uv.y += cos(uv.x*8.0 - time*1.5) * warpAmount;

    vec2 fuv = uv + 0.5;

    // RGB splitting
    float aberr = 0.002 + bass * 0.02;

    vec3 col;
    col.r = texture2D(prevFrame, fuv + aberr).r;
    col.g = texture2D(prevFrame, fuv).g;
    col.b = texture2D(prevFrame, fuv - aberr).b;

    // radial pulse rings
    float rings = sin(r*40.0 - time*6.0);
    col += rings * bass * 0.6;

    // color rotation
    float c = cos(time*0.3);
    float s = sin(time*0.3);
    col.rg = mat2(c, -s, s, c) * col.rg;

    // feedback decay
    col *= 0.975;

    gl_FragColor = vec4(col,1.0);
}
`;

const program = createProgram(vertexShader, fragmentShader);
gl.useProgram(program);

// -----------------------------------------------
// Attributes
// -----------------------------------------------

const posLoc = gl.getAttribLocation(program, "position");
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

// -----------------------------------------------
// Framebuffers (Ping-Pong)
// -----------------------------------------------

let bufferA, bufferB;

function createFBO() {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    canvas.width,
    canvas.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    tex,
    0
  );

  return { tex, fbo };
}

function rebuildBuffers() {
  bufferA = createFBO();
  bufferB = createFBO();

  gl.bindFramebuffer(gl.FRAMEBUFFER, bufferA.fbo);
  gl.clearColor(0.02, 0.02, 0.02, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

function swap(){
  const t = bufferA;
  bufferA = bufferB;
  bufferB = t;
}

// -----------------------------------------------
// Uniforms
// -----------------------------------------------

const uTime = gl.getUniformLocation(program,"time");
const uBass = gl.getUniformLocation(program,"bass");
const uRot  = gl.getUniformLocation(program,"rotVel");
const uZoom = gl.getUniformLocation(program,"zoomPump");
const uChaos = gl.getUniformLocation(program,"chaos");
const uSym = gl.getUniformLocation(program,"symmetry");
const uWarp = gl.getUniformLocation(program,"warpAmount");

// -----------------------------------------------
// Chaos Variables
// -----------------------------------------------

let rotVel = 0;
let zoomPump = 0;
let chaos = 0.3;
let symmetry = 6.0;
let warpAmount = 0.02;

let lastEnergy = 0;
let time = 0;
let presetTimer = 0;

// -----------------------------------------------
// Mutation System
// -----------------------------------------------

function mutate() {
  rotVel = (Math.random() - 0.5) * 0.08;
  zoomPump = Math.random() * 0.08;
  chaos = Math.random() * 1.2;
  symmetry = Math.floor(3 + Math.random() * 12);
  warpAmount = Math.random() * 0.1;
}

// -----------------------------------------------
// Render Loop
// -----------------------------------------------

function render(){
  requestAnimationFrame(render);

  analyser.getByteFrequencyData(freqData);

  let bass = 0;
  for(let i=0;i<20;i++) bass += freqData[i];
  bass /= (20*255);

  // Beat-trigger mutation
  if(bass - lastEnergy > 0.15){
    mutate();
  }
  lastEnergy = bass;

  // Timed preset mutation
  presetTimer += 0.016;
  if(presetTimer > 15){
    mutate();
    presetTimer = 0;
  }

  rotVel *= 0.99;
  time += 0.016;

  // Render to bufferB
  gl.bindFramebuffer(gl.FRAMEBUFFER, bufferB.fbo);
  gl.bindTexture(gl.TEXTURE_2D, bufferA.tex);

  gl.uniform1f(uTime,time);
  gl.uniform1f(uBass,bass);
  gl.uniform1f(uRot,rotVel);
  gl.uniform1f(uZoom,zoomPump);
  gl.uniform1f(uChaos,chaos);
  gl.uniform1f(uSym,symmetry);
  gl.uniform1f(uWarp,warpAmount);

  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);

  // Render to screen
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.bindTexture(gl.TEXTURE_2D,bufferB.tex);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);

  swap();
}

// -----------------------------------------------
// Start
// -----------------------------------------------

resize();
render();





//////////////////////////////////////////////////////////
// DEV PANEL — LEFT SIDE EXPERIMENTAL ENGINE CONTROL
//////////////////////////////////////////////////////////

let devPanel;
export let devPanelActive = false;

/*
You should have a global settings object like:

let settings = {
  lineColor:"#ffffff",
  bgColor:"#000000",
  lineWidthMult:2,
  nodeSpeedMult:1,
  nodeSize:2,
  connectionDist:150,
  bgAlpha:0.2,
  nodeCount:200,
  chaosField:1,
  velocityDamping:0.05,
  orbitPull:0.001,
  colorShiftSpeed:0.3,
  imageOpacity:1,
  imageZoom:1
};
*/

function createDevPanel(settings, callbacks = {}) {

  devPanel = document.createElement("div");

  Object.assign(devPanel.style, {
    position: "fixed",
    top: "5px",
    left: "5px",
    padding: "10px",
    background: "rgba(0,0,0,0.85)",
    color: "#fff",
    fontFamily: "monospace",
    fontSize: "12px",
    borderRadius: "8px",
    zIndex: 9999,
    display: "none",
    maxHeight: "95vh",
    overflowY: "auto",
    width: "260px"
  });

  devPanel.innerHTML = `
  <b>DEV PANEL — CHAOS ENGINE</b><hr>

  <b>MAIN</b><hr>

  Line Color<br>
  <input type="color" id="lineColor"><br>

  Background Color<br>
  <input type="color" id="bgColor"><br>

  Line Width<br>
  <input type="range" id="lineWidthMult" min="0.5" max="6" step="0.1"><br>

  Node Speed<br>
  <input type="range" id="nodeSpeedMult" min="0" max="10" step="0.1"><br>

  Node Size<br>
  <input type="range" id="nodeSize" min="0" max="10" step="0.5"><br>

  Connection Distance<br>
  <input type="range" id="connectionDist" min="50" max="400"><br>

  BG Alpha<br>
  <input type="range" id="bgAlpha" min="0" max="1" step="0.01"><br>

  <hr><b>EXPERIMENTAL</b><hr>

  Node Count<br>
  <input type="range" id="nodeCount" min="50" max="400"><br>

  Chaos Field<br>
  <input type="range" id="chaosField" min="0" max="5" step="0.01"><br>

  Velocity Damping<br>
  <input type="range" id="velocityDamping" min="0" max="0.2" step="0.001"><br>

  Orbit Pull<br>
  <input type="range" id="orbitPull" min="0" max="0.01" step="0.0001"><br>

  Color Shift Speed<br>
  <input type="range" id="colorShiftSpeed" min="0" max="2" step="0.01"><br>

  Image Opacity<br>
  <input type="range" id="imageOpacity" min="0" max="1" step="0.01"><br>

  Image Zoom<br>
  <input type="range" id="imageZoom" min="0.5" max="3" step="0.1"><br>

  <hr>
  Upload Background Image<br>
  <input type="file" id="bgUpload" accept="image/*">
  `;

  document.body.appendChild(devPanel);

  // -------------------------------
  // Bind Inputs to Settings Object
  // -------------------------------

  Object.keys(settings).forEach(key => {

    const el = devPanel.querySelector(`#${key}`);
    if (!el) return;

    el.value = settings[key];

    el.addEventListener("input", e => {

      const val = e.target.value;

      settings[key] =
        isNaN(settings[key])
          ? val
          : parseFloat(val);

      if (callbacks[key])
        callbacks[key](settings[key]);
    });
  });

  // -------------------------------
  // Background Upload
  // -------------------------------

  const upload = devPanel.querySelector("#bgUpload");

  upload.addEventListener("change", e => {

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = ev => {

      const img = new Image();

      img.onload = () => {
        if (callbacks.backgroundImage)
          callbacks.backgroundImage(img);
      };

      img.src = ev.target.result;
    };

    reader.readAsDataURL(file);
  });

  return devPanel;
}

//////////////////////////////////////////////////////////
// PANEL TOGGLE SHORTCUT
//////////////////////////////////////////////////////////

window.addEventListener("keydown", e => {

  const isMac =
    navigator.platform.toUpperCase().includes("MAC");

  const combo =
    e.shiftKey &&
    (isMac ? e.metaKey : e.ctrlKey) &&
    e.key.toLowerCase() === "u";

  if (!combo) return;

  e.preventDefault();

  devPanelActive = !devPanelActive;

  if (devPanel) {
    devPanel.style.display =
      devPanelActive ? "block" : "none";
  }
});

//////////////////////////////////////////////////////////
// EXPORT
//////////////////////////////////////////////////////////

export { createDevPanel };