/**
 * lfo.js  —  Universal LFO Engine
 * =================================
 *
 * USAGE:
 *   import { initLFO } from "./lfo.js";
 *   // After building your dev panel and settings:
 *   initLFO(settings, devPanelEl);
 *
 *   OR script tag:
 *   <script src="lfo.js"></script>
 *   window.LFO.init(settings, devPanelEl);
 *
 * OPEN PANEL:  Cmd/Ctrl + L
 *
 * Features:
 *   - 6 LFOs, each independently rate/depth/offset controlled
 *   - 10 waveshapes: sine, triangle, square, sawtooth, rampDown,
 *     noise, S&H, randomWalk, stepRandom, drunk
 *   - BPM lock with 1/8, 1/4, 1/2, ×1, ×2, ×4 divisions
 *   - Auto-detects all parameters in the dev panel
 *   - Target dropdown per LFO
 *   - Live mini waveform preview with animated playhead dot
 *   - Moving slider knob in dev panel while LFO is active
 *   - Settings saved to localStorage per page
 */

const LFO_COUNT  = 6;
const SHAPES     = ["sine","triangle","square","sawtooth","rampDown","noise","sampleHold","randomWalk","stepRandom","drunk"];
const SHAPE_ABBR = ["SIN","TRI","SQR","SAW","RMP","NOZ","S&H","RWK","STP","DRK"];

const STORAGE_KEY = () => `lfo_engine_v1_${location.pathname}`;

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
let _s    = null;   // settings reference
let _pEl  = null;   // dev panel DOM element

const _lfos = Array.from({ length: LFO_COUNT }, (_, i) => ({
  id:       i,
  enabled:  false,
  rate:     0.5,         // Hz
  bpmLock:  false,
  bpm:      120,
  bpmDiv:   1,           // quarter note = 1
  shape:    "sine",
  depth:    1.0,         // 0–1
  offset:   0.5,         // centre
  target:   null,        // { key, min, max }
  phase:    Math.random() * Math.PI * 2,
  // internal per-shape state
  _sh:      Math.random(),
  _shTimer: 0,
  _rw:      0.5,
  _drunk:   0.5,
  _step:    Math.random() > 0.5 ? 1 : 0,
  _stepT:   0,
}));

let _panel     = null;
let _open      = false;
let _prevTime  = performance.now();
let _masterBPM = 120;

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
function init(settingsObj, devPanelEl) {
  _s   = settingsObj;
  _pEl = devPanelEl || null;

  _loadState();

  // Cmd/Ctrl + L  (no Shift)
  window.addEventListener("keydown", e => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      _toggle();
    }
  });

  // Main tick
  ;(function tick() {
    requestAnimationFrame(tick);
    const now = performance.now();
    const dt  = Math.min((now - _prevTime) / 1000, 0.08);
    _prevTime = now;
    _tickAll(dt);
    if (_open) _tickVisuals();
  })();
}

// ─────────────────────────────────────────────────────────────
// COMPUTE
// ─────────────────────────────────────────────────────────────
function _compute(lfo, dt) {
  lfo.phase += lfo.rate * dt * Math.PI * 2;

  const t01 = ((lfo.phase / (Math.PI * 2)) % 1 + 1) % 1;   // 0–1 phase

  switch (lfo.shape) {
    case "sine":
      return (Math.sin(lfo.phase) + 1) / 2;

    case "triangle":
      return t01 < 0.5 ? t01 * 2 : (1 - t01) * 2;

    case "square":
      return t01 < 0.5 ? 1 : 0;

    case "sawtooth":
      return t01;

    case "rampDown":
      return 1 - t01;

    case "noise":
      return Math.random();

    case "sampleHold": {
      lfo._shTimer += dt;
      if (lfo._shTimer >= 1 / Math.max(0.01, lfo.rate)) {
        lfo._sh      = Math.random();
        lfo._shTimer = 0;
      }
      return lfo._sh;
    }

    case "randomWalk": {
      lfo._rw = Math.max(0, Math.min(1, lfo._rw + (Math.random() - 0.5) * 0.05));
      return lfo._rw;
    }

    case "stepRandom": {
      lfo._stepT += dt;
      const interval = 1 / Math.max(0.01, lfo.rate * 8);
      if (lfo._stepT >= interval) {
        lfo._step  = Math.random() > 0.5 ? 1 : 0;
        lfo._stepT = 0;
      }
      return lfo._step;
    }

    case "drunk": {
      const drift = lfo.rate * dt * 25;
      lfo._drunk = Math.max(0, Math.min(1, lfo._drunk + (Math.random() - 0.48) * 0.08 * drift));
      return lfo._drunk;
    }

    default:
      return 0.5;
  }
}

function _tickAll(dt) {
  _lfos.forEach(lfo => {
    if (!lfo.enabled || !lfo.target) return;

    const raw  = _compute(lfo, dt);
    // Apply depth + offset:  out = clamp(offset + (raw-0.5)*depth, 0, 1)
    const norm = Math.max(0, Math.min(1, lfo.offset + (raw - 0.5) * lfo.depth));
    const val  = lfo.target.min + norm * (lfo.target.max - lfo.target.min);

    if (_s && lfo.target.key in _s) {
      _s[lfo.target.key] = val;
    }

    // Animate dev panel slider
    if (_pEl) {
      const el = _pEl.querySelector(`[id="${lfo.target.key}"]`);
      if (el?.type === "range") el.value = val;
    }
  });

  // Tick phases even when no target (for visual)
  _lfos.forEach(lfo => {
    if (!lfo.enabled) return;
    // Phase already advanced above if target set — advance for no-target too
    if (!lfo.target) {
      lfo.phase += lfo.rate * dt * Math.PI * 2;
    }
  });
}

// ─────────────────────────────────────────────────────────────
// PANEL
// ─────────────────────────────────────────────────────────────
function _toggle() {
  if (!_panel) _build();
  _open = !_open;
  _panel.style.display = _open ? "block" : "none";
  if (_open) _refreshTargetDropdowns();
}

function _build() {
  // ── Styles ─────────────────────────────────────────────
  const sty = document.createElement("style");
  sty.textContent = `
#_lfo_panel{
  position:fixed;top:0;right:0;width:340px;height:100vh;
  overflow-y:auto;background:rgba(5,5,18,0.97);
  border-left:1px solid rgba(123,47,255,.2);
  padding:0;color:#dde;font-family:'Courier New',monospace;font-size:11px;
  z-index:999998;display:none;
  backdrop-filter:blur(22px);box-shadow:-6px 0 50px rgba(123,47,255,.06);
  user-select:none
}
#_lfo_panel *{box-sizing:border-box}
#_lfo_panel::-webkit-scrollbar{width:4px}
#_lfo_panel::-webkit-scrollbar-thumb{background:rgba(123,47,255,.25);border-radius:3px}
._lp_header{
  position:sticky;top:0;z-index:2;
  display:flex;align-items:center;justify-content:space-between;
  padding:11px 14px 9px;background:rgba(5,5,18,.98);
  border-bottom:1px solid rgba(123,47,255,.15)
}
._lp_title{color:#7b2fff;font-size:13px;font-weight:bold;letter-spacing:.13em}
._lp_hint{color:rgba(255,255,255,.2);font-size:9px}
._lp_bpm_row{
  display:flex;align-items:center;gap:8px;
  padding:8px 14px;border-bottom:1px solid rgba(255,255,255,.06)
}
._lp_bpm_row label{font-size:9px;color:#888}
._lp_bpm_row input[type=number]{
  width:52px;background:#0d0d1a;border:1px solid #2a2a3a;color:#00ffcc;
  border-radius:3px;padding:2px 5px;font-size:11px;font-family:monospace
}
._lfo_card{
  padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.06)
}
._lfo_card._on{border-left:2px solid #7b2fff;padding-left:12px}
._lfo_top{display:flex;align-items:center;gap:7px;margin-bottom:7px}
._lfo_en{display:flex;align-items:center;gap:5px;cursor:pointer;flex-shrink:0}
._lfo_en input{accent-color:#7b2fff;cursor:pointer}
._lfo_num{font-weight:bold;font-size:11px;color:#7b2fff;letter-spacing:.1em}
._lfo_mini{
  flex:1;height:22px;border:1px solid rgba(123,47,255,.2);
  border-radius:3px;overflow:hidden;background:#04040e
}
._lfo_mini canvas{display:block;width:100%;height:100%}
._lfo_shapes{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:7px}
._lshp{
  padding:2px 5px;font-size:8px;font-family:monospace;cursor:pointer;
  border-radius:3px;border:1px solid rgba(255,255,255,.1);
  background:rgba(255,255,255,.04);color:#777;transition:all .12s
}
._lshp._active{background:rgba(123,47,255,.4);border-color:rgba(123,47,255,.7);color:#fff}
._lshp:hover{color:#ddd}
._lfo_row{
  display:grid;grid-template-columns:48px 1fr 38px;
  align-items:center;gap:5px;margin-bottom:5px
}
._lfo_row label{font-size:9px;color:#666}
._lfo_row input[type=range]{accent-color:#7b2fff;height:3px;cursor:pointer}
._lfo_row span{font-size:9px;color:#aaa;text-align:right}
._lfo_bpm_row{
  display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:6px
}
._lfo_bpm_row label{font-size:8px;color:#666;margin-right:2px;display:flex;align-items:center;gap:3px}
._lfo_bpm_row input[type=checkbox]{accent-color:#00ffcc;cursor:pointer}
._bdiv{
  padding:2px 5px;font-size:8px;font-family:monospace;cursor:pointer;
  border-radius:3px;border:1px solid rgba(0,255,204,.18);
  background:rgba(0,255,204,.04);color:#777;transition:all .12s
}
._bdiv._active{border-color:rgba(0,255,204,.6);color:#00ffcc;background:rgba(0,255,204,.12)}
._lfo_target_row{display:flex;align-items:center;gap:6px}
._lfo_target_row label{font-size:9px;color:#666;flex-shrink:0}
._lfo_target_row select{
  flex:1;background:#0b0b1a;border:1px solid rgba(255,255,255,.1);
  color:#00ffcc;border-radius:3px;padding:2px 5px;
  font-size:9px;font-family:monospace;cursor:pointer
}
`;
  document.head.appendChild(sty);

  // ── DOM ─────────────────────────────────────────────────
  _panel = document.createElement("div");
  _panel.id = "_lfo_panel";

  const bpmDivs = [
    { label: "1/8",  div: 0.125 },
    { label: "1/4",  div: 0.25  },
    { label: "1/2",  div: 0.5   },
    { label: "×1",   div: 1     },
    { label: "×2",   div: 2     },
    { label: "×4",   div: 4     },
  ];

  _panel.innerHTML = `
<div class="_lp_header">
  <span class="_lp_title">⬡ LFO ENGINE</span>
  <span class="_lp_hint">⌘L</span>
</div>
<div class="_lp_bpm_row">
  <label>MASTER BPM</label>
  <input type="number" id="_lfo_mbpm" value="${_masterBPM}" min="20" max="300">
</div>
<div id="_lfo_cards"></div>
`;
  document.body.appendChild(_panel);

  // Master BPM
  _panel.querySelector("#_lfo_mbpm").addEventListener("input", e => {
    _masterBPM = parseFloat(e.target.value) || 120;
    _lfos.forEach(lfo => { lfo.bpm = _masterBPM; if (lfo.bpmLock) lfo.rate = _bpmHz(lfo.bpm, lfo.bpmDiv); });
    _refreshRateDisplays();
  });

  // Build LFO cards
  const cards = _panel.querySelector("#_lfo_cards");
  _lfos.forEach((lfo, i) => {
    const card = document.createElement("div");
    card.className = "_lfo_card" + (lfo.enabled ? " _on" : "");
    card.id = `_lc_${i}`;

    card.innerHTML = `
<div class="_lfo_top">
  <label class="_lfo_en">
    <input type="checkbox" id="_len_${i}" ${lfo.enabled ? "checked" : ""}>
    <span class="_lfo_num">LFO ${i + 1}</span>
  </label>
  <div class="_lfo_mini"><canvas id="_lm_${i}" height="22"></canvas></div>
</div>

<div class="_lfo_shapes" id="_lsh_${i}">
  ${SHAPES.map((s, si) => `
    <button class="_lshp${s === lfo.shape ? " _active" : ""}" data-s="${s}" data-i="${i}">
      ${SHAPE_ABBR[si]}
    </button>`).join("")}
</div>

<div class="_lfo_row">
  <label>RATE</label>
  <input type="range" id="_lrate_${i}" min="0.01" max="20" step="0.01" value="${lfo.rate}">
  <span id="_lratev_${i}">${lfo.rate.toFixed(2)}Hz</span>
</div>

<div class="_lfo_bpm_row">
  <label><input type="checkbox" id="_lbpm_${i}" ${lfo.bpmLock ? "checked" : ""}> BPM</label>
  ${bpmDivs.map(bd => `
    <button class="_bdiv${lfo.bpmDiv === bd.div && lfo.bpmLock ? " _active" : ""}"
      data-div="${bd.div}" data-i="${i}">${bd.label}</button>`).join("")}
</div>

<div class="_lfo_row">
  <label>DEPTH</label>
  <input type="range" id="_ldep_${i}" min="0" max="1" step="0.01" value="${lfo.depth}">
  <span id="_ldepv_${i}">${lfo.depth.toFixed(2)}</span>
</div>
<div class="_lfo_row">
  <label>OFFSET</label>
  <input type="range" id="_loff_${i}" min="0" max="1" step="0.01" value="${lfo.offset}">
  <span id="_loffv_${i}">${lfo.offset.toFixed(2)}</span>
</div>

<div class="_lfo_target_row">
  <label>TARGET</label>
  <select id="_ltgt_${i}"><option value="">— none —</option></select>
</div>
`;
    cards.appendChild(card);

    // Enable
    document.getElementById(`_len_${i}`).addEventListener("change", e => {
      lfo.enabled = e.target.checked;
      card.classList.toggle("_on", lfo.enabled);
      _saveState();
    });

    // Shape buttons
    card.querySelectorAll("._lshp").forEach(btn => {
      btn.addEventListener("click", () => {
        lfo.shape = btn.dataset.s;
        card.querySelectorAll("._lshp").forEach(b => b.classList.toggle("_active", b.dataset.s === lfo.shape));
        _saveState();
      });
    });

    // Rate
    document.getElementById(`_lrate_${i}`).addEventListener("input", e => {
      lfo.rate     = parseFloat(e.target.value);
      lfo.bpmLock  = false;
      document.getElementById(`_lbpm_${i}`).checked = false;
      document.getElementById(`_lratev_${i}`).textContent = lfo.rate.toFixed(2) + "Hz";
      card.querySelectorAll("._bdiv").forEach(b => b.classList.remove("_active"));
      _saveState();
    });

    // BPM lock
    document.getElementById(`_lbpm_${i}`).addEventListener("change", e => {
      lfo.bpmLock = e.target.checked;
      if (lfo.bpmLock) _applyBpmDiv(lfo, lfo.bpmDiv, i);
      _saveState();
    });

    // BPM div buttons
    card.querySelectorAll("._bdiv").forEach(btn => {
      btn.addEventListener("click", () => {
        lfo.bpmLock = true;
        document.getElementById(`_lbpm_${i}`).checked = true;
        _applyBpmDiv(lfo, parseFloat(btn.dataset.div), i);
        card.querySelectorAll("._bdiv").forEach(b =>
          b.classList.toggle("_active", b.dataset.div === btn.dataset.div));
        _saveState();
      });
    });

    // Depth
    document.getElementById(`_ldep_${i}`).addEventListener("input", e => {
      lfo.depth = parseFloat(e.target.value);
      document.getElementById(`_ldepv_${i}`).textContent = lfo.depth.toFixed(2);
      _saveState();
    });

    // Offset
    document.getElementById(`_loff_${i}`).addEventListener("input", e => {
      lfo.offset = parseFloat(e.target.value);
      document.getElementById(`_loffv_${i}`).textContent = lfo.offset.toFixed(2);
      _saveState();
    });

    // Target
    document.getElementById(`_ltgt_${i}`).addEventListener("change", e => {
      const key = e.target.value;
      if (!key || !_s) { lfo.target = null; _saveState(); return; }
      const el = _pEl?.querySelector(`[id="${key}"]`);
      lfo.target = { key, min: el ? parseFloat(el.min) : 0, max: el ? parseFloat(el.max) : 1 };
      _saveState();
    });
  });
}

function _applyBpmDiv(lfo, div, i) {
  lfo.bpmDiv = div;
  lfo.rate   = _bpmHz(lfo.bpm, div);
  const rEl  = document.getElementById(`_lrate_${i}`);
  const rvEl = document.getElementById(`_lratev_${i}`);
  if (rEl)  rEl.value     = lfo.rate;
  if (rvEl) rvEl.textContent = lfo.rate.toFixed(2) + "Hz";
}

function _bpmHz(bpm, div) {
  // div: 1 = quarter note, 2 = eighth note, 0.5 = half note, etc.
  return (bpm / 60) * div;
}

function _refreshRateDisplays() {
  _lfos.forEach((lfo, i) => {
    const rEl  = document.getElementById(`_lrate_${i}`);
    const rvEl = document.getElementById(`_lratev_${i}`);
    if (rEl)  rEl.value       = lfo.rate;
    if (rvEl) rvEl.textContent = lfo.rate.toFixed(2) + "Hz";
  });
}

// ─────────────────────────────────────────────────────────────
// TARGET DROPDOWNS  —  auto-detect params
// ─────────────────────────────────────────────────────────────
function _getParams() {
  if (!_s) return [];
  return Object.keys(_s).map(key => {
    const el = _pEl?.querySelector(`[id="${key}"]`);
    return { key, min: el ? parseFloat(el.min) : 0, max: el ? parseFloat(el.max) : 1 };
  });
}

function _refreshTargetDropdowns() {
  const params = _getParams();
  _lfos.forEach((lfo, i) => {
    const sel = document.getElementById(`_ltgt_${i}`);
    if (!sel) return;
    const cur = lfo.target?.key || "";
    sel.innerHTML = `<option value="">— none —</option>`;
    params.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.key; opt.textContent = p.key;
      if (p.key === cur) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// MINI CANVAS VISUALS
// ─────────────────────────────────────────────────────────────
function _tickVisuals() {
  _lfos.forEach((lfo, i) => {
    const c = document.getElementById(`_lm_${i}`);
    if (!c) return;
    c.width = c.parentElement?.clientWidth || 160;
    const cx = c.getContext("2d");
    const W = c.width, H = c.height;

    cx.clearRect(0, 0, W, H);
    cx.fillStyle = "#04040e"; cx.fillRect(0, 0, W, H);

    // Draw waveform preview
    const color = lfo.enabled ? "#7b2fff" : "#2a2a3a";
    cx.beginPath(); cx.strokeStyle = color; cx.lineWidth = 1.5;
    const steps = W;
    for (let s = 0; s <= steps; s++) {
      const t  = (s / steps) * Math.PI * 2;
      const t01 = s / steps;
      let y = 0.5;
      switch (lfo.shape) {
        case "sine":       y = (Math.sin(t) + 1) / 2; break;
        case "triangle":   y = t01 < .5 ? t01 * 2 : (1 - t01) * 2; break;
        case "square":     y = t01 < .5 ? 1 : 0; break;
        case "sawtooth":   y = t01; break;
        case "rampDown":   y = 1 - t01; break;
        case "sampleHold":
        case "stepRandom": y = t01 < .5 ? 0.8 : 0.2; break;
        default:           y = Math.random() * 0.4 + 0.3; break;
      }
      const px = s, py = H - y * (H - 3) - 1.5;
      s === 0 ? cx.moveTo(px, py) : cx.lineTo(px, py);
    }
    cx.stroke();

    // Animated playhead dot
    if (lfo.enabled) {
      const norm = ((lfo.phase / (Math.PI * 2)) % 1 + 1) % 1;
      const dotX = norm * W;
      let dotY = 0.5;
      switch (lfo.shape) {
        case "sine":     dotY = (Math.sin(lfo.phase) + 1) / 2; break;
        case "triangle": dotY = norm < .5 ? norm * 2 : (1 - norm) * 2; break;
        case "square":   dotY = norm < .5 ? 1 : 0; break;
        case "sawtooth": dotY = norm; break;
        case "rampDown": dotY = 1 - norm; break;
        default:         dotY = lfo._rw ?? 0.5;
      }
      const py = H - dotY * (H - 3) - 1.5;
      cx.fillStyle = "#00ffcc";
      cx.shadowColor = "#00ffcc"; cx.shadowBlur = 5;
      cx.beginPath(); cx.arc(dotX, py, 2.5, 0, Math.PI * 2); cx.fill();
      cx.shadowBlur = 0;
    }
  });
}

// ─────────────────────────────────────────────────────────────
// PERSIST
// ─────────────────────────────────────────────────────────────
function _saveState() {
  try {
    localStorage.setItem(STORAGE_KEY(), JSON.stringify({
      masterBPM: _masterBPM,
      lfos: _lfos.map(l => ({
        enabled: l.enabled, rate: l.rate, bpmLock: l.bpmLock,
        bpm: l.bpm, bpmDiv: l.bpmDiv, shape: l.shape,
        depth: l.depth, offset: l.offset,
        target: l.target,
      })),
    }));
  } catch {}
}

function _loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY());
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.masterBPM) _masterBPM = d.masterBPM;
    (d.lfos || []).forEach((sv, i) => {
      if (!_lfos[i]) return;
      Object.assign(_lfos[i], {
        enabled: sv.enabled ?? false,
        rate: sv.rate ?? 0.5,
        bpmLock: sv.bpmLock ?? false,
        bpm: sv.bpm ?? 120,
        bpmDiv: sv.bpmDiv ?? 1,
        shape: sv.shape ?? "sine",
        depth: sv.depth ?? 1,
        offset: sv.offset ?? 0.5,
        target: sv.target ?? null,
      });
    });
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────
const API = {
  init:    init,
  getLFO:  i => _lfos[i],
  refresh: () => { if (_open) _refreshTargetDropdowns(); },
};

window.LFO = API;

export {
  init as initLFO,
  API  as LFO,
};