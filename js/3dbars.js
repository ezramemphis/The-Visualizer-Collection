import * as THREE from "https://cdn.skypack.dev/three";
import { canvas, analyser, freqData } from "./visualizer.js";

/* ===============================
   RENDERER
================================ */

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false // IMPORTANT: solid background
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x050505, 1);

/* ===============================
   SCENE
================================ */

const scene = new THREE.Scene();

/* ===============================
   CAMERA
================================ */

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(0, 12, 30);

/* ===============================
   LIGHTING
================================ */

scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const light = new THREE.DirectionalLight(0xffffff, 1.2);
light.position.set(10, 20, 10);
scene.add(light);

/* ===============================
   TEST FLOOR (DEBUG VISIBILITY)
================================ */

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 1
  })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

/* ===============================
   BARS
================================ */

const BAR_COUNT = 48;
const bars = [];
const smooth = new Float32Array(BAR_COUNT);

const geometry = new THREE.BoxGeometry(0.9, 1, 0.9);

for (let i = 0; i < BAR_COUNT; i++) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(`hsl(${180 + i * 2}, 80%, 55%)`),
    emissive: new THREE.Color(`hsl(${180 + i * 2}, 90%, 40%)`),
    emissiveIntensity: 0.4,
    metalness: 0.2,
    roughness: 0.4
  });

  const bar = new THREE.Mesh(geometry, material);
  bar.position.set(i - BAR_COUNT / 2, 0.5, 0);
  scene.add(bar);
  bars.push(bar);
}

/* ===============================
   RESIZE
================================ */

window.addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

/* ===============================
   ANIMATE
================================ */

function draw() {
  requestAnimationFrame(draw);

  analyser.getByteFrequencyData(freqData);

  const step = Math.floor(freqData.length / BAR_COUNT);

  for (let i = 0; i < BAR_COUNT; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) {
      sum += freqData[i * step + j];
    }

    const energy = sum / step / 255;

    // fallback motion if audio is silent
    smooth[i] += ((energy || Math.random() * 0.05) - smooth[i]) * 0.12;

    const height = 0.5 + smooth[i] * 10;

    bars[i].scale.y = height;
    bars[i].position.y = height / 2;

    bars[i].material.emissiveIntensity =
      0.3 + smooth[i] * 1.2;
  }

  scene.rotation.y += 0.001;

  renderer.render(scene, camera);
}

draw();
