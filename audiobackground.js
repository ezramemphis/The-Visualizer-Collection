/* ===============================
   BACKGROUND AUDIO SYSTEM
================================ */

const AudioContext = window.AudioContext || window.webkitAudioContext;
const bgCtx = new AudioContext();

/* ===============================
   MASTER GAIN
================================ */
const masterGain = bgCtx.createGain();
masterGain.gain.value = 1;
masterGain.connect(bgCtx.destination);

/* ===============================
   MUSIC BED
================================ */
const musicGain = bgCtx.createGain();
musicGain.gain.value = 0.1; // VERY quiet
musicGain.connect(masterGain);

const musicTracks = [
  "music/music1.mp3",
  "music/music1.mp3",
  "music/music1.mp3",
  "music/music1.mp3",
  "music/music1.mp3"
];

/* ===============================
   AMBIENCE BED
================================ */
const ambienceGain = bgCtx.createGain();
ambienceGain.gain.value = 0.08;
ambienceGain.connect(masterGain);

const ambienceTracks = [
  "ambience/wind.wav",
  "ambience/rain1.wav",
  "ambience/rain2.wav",
  "ambience/patter.wav",
  "ambience/rustling.wav",
  "ambience/traffic.wav"
];

/* ===============================
   LOADER
================================ */
async function loadAudio(url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return await bgCtx.decodeAudioData(buf);
}

/* ===============================
   PLAYER
================================ */
async function playLoop(tracks, gainNode, crossfade = 4) {
  let current = null;

  async function next() {
    const url = tracks[Math.floor(Math.random() * tracks.length)];
    const buffer = await loadAudio(url);

    const src = bgCtx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const fade = bgCtx.createGain();
    fade.gain.value = 0;

    src.connect(fade);
    fade.connect(gainNode);

    const now = bgCtx.currentTime;
    fade.gain.linearRampToValueAtTime(1, now + crossfade);

    src.start();

    if (current) {
      current.fade.gain.linearRampToValueAtTime(0, now + crossfade);
      current.src.stop(now + crossfade + 0.1);
    }

    current = { src, fade };
  }

  await next();
}

/* ===============================
   START (user gesture required)
================================ */
export function startBackgroundAudio() {
  if (bgCtx.state === "suspended") bgCtx.resume();

  playLoop(musicTracks, musicGain, 6);
  playLoop(ambienceTracks, ambienceGain, 8);
}


window.addEventListener("click", () => {
  startBackgroundAudio();
}, { once: true });
