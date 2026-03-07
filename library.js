// =======================================================
// PRELOADED SONG LIBRARY
// =======================================================

const SONG_LIBRARY = [
  {
    title: "Taste",
    artist: "Sabrina Carpenter",
    bpm: 95,
    genre: "pop",
    url: "music/pop1.mp3"
  },
  {
    title: "DAYDREAM",
    artist: "Destin Conrad",
    bpm: 78,
    genre: "rnb",
    url: "music/rnb1.mp3"
  },
  {
    title: "Digital Love",
    artist: "Daft Punk",
    bpm: 128,
    genre: "electronic",
    url: "../music/electronic1.mp3"
  },
  {
    title: "Husk",
    artist: "Men I Trust",
    bpm: 102,
    genre: "indie",
    url: "../music/indie1.mp3"
  },
  {
    title: "ᐳ;0 (ft. vegyn)",
    artist: "Mk.gee",
    bpm: 140,
    genre: "alternative",
    url: "../music/alt1.mp3"
  }
];


// =======================================================
// PLAYLIST UI
// =======================================================

let playlistContainer;
let genreFilterSelect;


// Create UI
function createPlaylistUI() {

  playlistContainer = document.createElement("div");
  genreFilterSelect = document.createElement("select");

  playlistContainer.className = "viz-playlist";

  // Genre filter options
  const genres = [
    "all",
    "pop",
    "rnb",
    "electronic",
    "indie",
    "alternative"
  ];

  genres.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g.toUpperCase();
    genreFilterSelect.appendChild(opt);
  });

  genreFilterSelect.onchange = renderPlaylist;

  document.body.appendChild(genreFilterSelect);
  document.body.appendChild(playlistContainer);

  renderPlaylist();
}


// Render playlist list
function renderPlaylist() {

  if (!playlistContainer) return;

  const filter = genreFilterSelect.value;

  playlistContainer.innerHTML = "";

  const list = SONG_LIBRARY.filter(song => {
    return filter === "all" || song.genre === filter;
  });

  list.forEach(song => {

    const item = document.createElement("div");
    item.className = "viz-song-item";

    item.innerHTML = `
      <div class="viz-song-title">
        ${song.title} - ${song.artist}
      </div>
      <div class="viz-song-meta">
        BPM ${song.bpm} • ${song.genre.toUpperCase()}
      </div>
    `;

    item.onclick = () => {
      loadFileFromURL(song.url);
    };

    playlistContainer.appendChild(item);
  });
}


// Load song from internal library URL
function loadFileFromURL(url) {
  audio.src = url;
  audio.load();
  audio.play();
}


// Initialize UI
createPlaylistUI();


// =======================================================
// PLAYLIST CSS (Injected)
// =======================================================

const style = document.createElement("style");

style.innerHTML = `

.viz-playlist {
  position: fixed;
  top: 10px;
  right: 10px;

  width: 220px;
  max-height: 320px;
  overflow-y: auto;

  background: rgba(0,0,0,0.75);
  backdrop-filter: blur(6px);

  border-radius: 8px;
  padding: 8px;

  font-family: sans-serif;
  z-index: 9999;
}

.viz-song-item {
  padding: 8px;
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #00ffcc;
}

.viz-song-item:hover {
  background: rgba(0,255,204,0.15);
  transform: translateX(4px);
}

.viz-song-title {
  font-size: 13px;
  font-weight: bold;
}

.viz-song-meta {
  font-size: 11px;
  opacity: 0.7;
}

.viz-playlist::-webkit-scrollbar {
  width: 6px;
}

.viz-playlist::-webkit-scrollbar-thumb {
  background: #00ffcc;
  border-radius: 3px;
}

.viz-playlist select {
  width: 100%;
  margin-bottom: 8px;
  padding: 4px;
  background: black;
  color: #00ffcc;
  border: 1px solid rgba(0,255,204,0.4);
  border-radius: 4px;
}

`;

document.head.appendChild(style);

