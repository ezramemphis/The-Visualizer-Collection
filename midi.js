/**
 * midi.js  —  Universal MIDI Engine v2
 * ======================================
 *
 * USAGE — two ways to integrate:
 *
 *   A) ES module import (recommended):
 *      import { initMIDI, mapCC, mapNote, mapNoteToggle } from "./midi.js";
 *      initMIDI(settings, devPanelEl);
 *      mapCC(176, 21, "myParam", 0, 100);
 *
 *   B) Script tag (no modules):
 *      <script src="midi.js"></script>
 *      window.MIDI.init(settings, devPanelEl);
 *      window.MIDI.mapCC(176, 21, "myParam", 0, 100);
 *
 * OPEN PANEL:  Shift + M   (no other modifier needed)
 *
 * LEARN MODE:  Click LEARN next to any parameter,
 *              then move a knob or press a pad.
 *              CC → smooth-mapped.  Note-on → toggle.
 *
 * PERSIST:     All mappings + ADSR settings saved to localStorage
 *              per-page (keyed by window.location.pathname).
 */

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const DEFAULT_SMOOTHING = 0.08;   // lower = smoother (EMA coeff)
const HISTORY_LEN       = 8;      // median filter window
const MAX_LOG_LINES     = 50;

// ─────────────────────────────────────────────────────────────
// INTERNAL STATE
// ─────────────────────────────────────────────────────────────
let _s        = null;   // settings object reference
let _devEl    = null;   // dev panel DOM element (for live slider updates)
let _access   = null;   // MIDIAccess
let _learn    = null;   // { paramKey, min, max } | null

// Maps keyed by "${status}_${control}"
const _cc     = {};     // CC maps
const _note   = {};     // velocity maps
const _tog    = {};     // toggle maps

const _adsrs  = Array.from({ length: 4 }, (_, i) => new ADSR(i));

let   _panel      = null;
let   _panelOpen  = false;
let   _prevTime   = performance.now();
const _logs       = [];
const _ccAct      = {};   // live CC bar activity  {raw, ts}

const _storageKey = () => `midi_v2_${location.pathname}`;

// ─────────────────────────────────────────────────────────────
// ADSR CLASS
// ─────────────────────────────────────────────────────────────
function ADSR(id) {
  this.id      = id;
  this.attack  = 0.05;
  this.decay   = 0.2;
  this.sustain = 0.6;
  this.release = 0.8;
  this.flutter = false;

  this.phase   = "idle";
  this.value   = 0;
  this.time    = 0;
  this.active  = false;
  this.target  = null;   // { paramKey, min, max }

  this._flutterClock = 0;
  this._flutterHigh  = false;
}

ADSR.prototype.gate = function(on) {
  if (on) {
    this.phase  = "attack";
    this.time   = 0;
    this.active = true;
  } else {
    if (this.phase !== "idle") {
      this.phase = "release";
      this.time  = 0;
    }
  }
};

ADSR.prototype.tick = function(dt) {
  // Flutter clock
  if (this.flutter && this.active) {
    this._flutterClock += dt;
    if (this._flutterClock > 0.035) {
      this._flutterClock = 0;
      this._flutterHigh  = !this._flutterHigh;
    }
  } else {
    this._flutterHigh = false;
  }

  // Envelope
  switch (this.phase) {
    case "attack":
      this.time  += dt;
      this.value  = Math.min(1, this.time / Math.max(0.001, this.attack));
      if (this.time >= this.attack) { this.phase = "decay"; this.time = 0; }
      break;
    case "decay":
      this.time  += dt;
      this.value  = 1 - (1 - this.sustain) * Math.min(1, this.time / Math.max(0.001, this.decay));
      if (this.time >= this.decay) this.phase = "sustain";
      break;
    case "sustain":
      this.value = this.sustain;
      break;
    case "release":
      this.time  += dt;
      const t     = Math.min(1, this.time / Math.max(0.001, this.release));
      this.value  = this.sustain * (1 - t);
      if (t >= 1) { this.phase = "idle"; this.value = 0; this.active = false; }
      break;
    default:
      this.value = 0;
  }

  const out = (this.flutter && this._flutterHigh) ? 0 : this.value;

  if (this.target && _s) {
    _apply(this.target.paramKey, this.target.min + out * (this.target.max - this.target.min));
  }
};

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
function init(settingsObj, devPanelEl) {
  _s     = settingsObj;
  _devEl = devPanelEl || null;

  _loadMappings();
  _buildPanel();
  _requestMIDI();

// Keyboard toggle: M
window.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "m" && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    _togglePanel();
  }
});

  // Main tick: ADSR + CC drift
  ;(function tick() {
    requestAnimationFrame(tick);
    const now = performance.now();
    const dt  = Math.min((now - _prevTime) / 1000, 0.1);
    _prevTime = now;

    _adsrs.forEach(a => a.tick(dt));

    // Drift CCs toward their smoothed target
    Object.values(_cc).forEach(m => {
      if (m._smooth === null) return;
      const target  = m.min + (m._smooth / 127) * (m.max - m.min);
      const current = (_s && m.paramKey in _s) ? _s[m.paramKey] : target;
      _apply(m.paramKey, current + (1 - m.smoothing) * (target - current));
    });

    if (_panelOpen) _tickUI();
  })();

  _log("MIDI engine initialised");
}

// ─────────────────────────────────────────────────────────────
// MIDI ACCESS
// ─────────────────────────────────────────────────────────────
function _requestMIDI() {
  if (!navigator.requestMIDIAccess) {
    _log("⚠ Web MIDI API not available (use Chrome/Edge)");
    return;
  }
  navigator.requestMIDIAccess({ sysex: false })
    .then(acc => {
      _access = acc;
      _connectAll();
      acc.onstatechange = () => { _connectAll(); _refreshInputList(); };
      _log(`✓ MIDI ready — ${[...acc.inputs.values()].length} input(s) connected`);
      _refreshInputList();
    })
    .catch(err => _log(`✗ MIDI denied: ${err.message || err}`));
}

function _connectAll() {
  if (!_access) return;
  for (const inp of _access.inputs.values()) inp.onmidimessage = _onMessage;
}

// ─────────────────────────────────────────────────────────────
// MESSAGE HANDLER
// ─────────────────────────────────────────────────────────────
function _onMessage(e) {
  const d = e.data;
  if (!d || d.length < 2) return;

  const status  = d[0];
  const ctrl    = d[1];
  const val     = d[2] ?? 0;
  const id      = `${status}_${ctrl}`;

  _ccAct[id] = { raw: val, ts: performance.now() };
  _log(`[${_hex(status)} ${_pad(ctrl)} ${_pad(val)}]  ${_label(id)}`);

  // ── Learn mode ─────────────────────────────────────────
  if (_learn) {
    const isCC  = (status & 0xF0) === 0xB0;
    const isNote = (status & 0xF0) === 0x90;

    if (isCC || (isNote && val > 0)) {
      if (isCC) {
        _cc[id] = _mkCC(_learn.paramKey, _learn.min, _learn.max);
        _log(`✓ Learned CC  [${_hex(status)} cc${ctrl}] → ${_learn.paramKey}`);
      } else {
        _tog[id] = { paramKey: _learn.paramKey, offVal: _learn.min, onVal: _learn.max, _state: false };
        _log(`✓ Learned BTN [${_hex(status)} n${ctrl}] → ${_learn.paramKey} (toggle)`);
      }
      _saveMappings();
      _learn = null;
      if (_panelOpen) _refreshMappings();
    }
    return;
  }

  // ── CC ──────────────────────────────────────────────────
  if (_cc[id]) {
    const m   = _cc[id];
    const raw = m.invert ? 127 - val : val;
    m._hist.push(raw);
    if (m._hist.length > HISTORY_LEN) m._hist.shift();
    const sorted = [...m._hist].sort((a, b) => a - b);
    m._smooth = sorted[Math.floor(sorted.length / 2)];
    return;   // drift applied in tick()
  }

  // ── Toggle ──────────────────────────────────────────────
  if (_tog[id]) {
    const tm   = _tog[id];
    const on   = (status & 0xF0) === 0x90 && val > 0;
    const off  = (status & 0xF0) === 0x80 || ((status & 0xF0) === 0x90 && val === 0);
    if (on) {
      tm._state = !tm._state;
      _apply(tm.paramKey, tm._state ? tm.onVal : tm.offVal);
      _adsrs.forEach(a => { if (a.target?.paramKey === tm.paramKey) a.gate(true); });
    } else if (off) {
      _adsrs.forEach(a => { if (a.target?.paramKey === tm.paramKey) a.gate(false); });
    }
    return;
  }

  // ── Note → param ────────────────────────────────────────
  if (_note[id] && val > 0) {
    const nm  = _note[id];
    const raw = nm.invert ? 127 - val : val;
    _apply(nm.paramKey, nm.min + (raw / 127) * (nm.max - nm.min));
  }
}

// ─────────────────────────────────────────────────────────────
// APPLY
// ─────────────────────────────────────────────────────────────
function _apply(key, value) {
  if (!_s || !(key in _s)) return;
  _s[key] = value;
  if (_devEl) {
    const el = _devEl.querySelector(`[id="${key}"]`);
    if (el?.type === "range") el.value = value;
  }
}

// ─────────────────────────────────────────────────────────────
// MAPPING HELPERS
// ─────────────────────────────────────────────────────────────
function _mkCC(paramKey, min, max, smoothing = DEFAULT_SMOOTHING) {
  return { paramKey, min, max, smoothing, invert: false, _hist: [], _smooth: null };
}

function _label(id) {
  if (_cc[id])  return `CC → ${_cc[id].paramKey}`;
  if (_tog[id]) return `BTN → ${_tog[id].paramKey}`;
  if (_note[id]) return `NOTE → ${_note[id].paramKey}`;
  return "unmapped";
}

function _hex(n) { return n.toString(16).padStart(2, "0").toUpperCase(); }
function _pad(n) { return String(n).padStart(3, " "); }

// ─────────────────────────────────────────────────────────────
// PUBLIC MAPPING API
// ─────────────────────────────────────────────────────────────
function mapCC(status, cc, paramKey, min, max, opts) {
  const m = _mkCC(paramKey, min, max, opts?.smoothing ?? DEFAULT_SMOOTHING);
  m.invert = opts?.invert ?? false;
  _cc[`${status}_${cc}`] = m;
}

function mapNote(status, note, paramKey, min, max, opts) {
  _note[`${status}_${note}`] = { paramKey, min, max, invert: opts?.invert ?? false };
}

function mapNoteToggle(status, note, paramKey, offVal, onVal) {
  _tog[`${status}_${note}`] = { paramKey, offVal, onVal, _state: false };
}

function clearMappings() {
  [_cc, _note, _tog].forEach(m => Object.keys(m).forEach(k => delete m[k]));
  _saveMappings();
  if (_panelOpen) _refreshMappings();
}

// ─────────────────────────────────────────────────────────────
// PERSIST
// ─────────────────────────────────────────────────────────────
function _saveMappings() {
  try {
    localStorage.setItem(_storageKey(), JSON.stringify({
      cc:    Object.entries(_cc).map(([id, m]) =>
               ({ id, paramKey: m.paramKey, min: m.min, max: m.max, smoothing: m.smoothing, invert: m.invert })),
      tog:   Object.entries(_tog).map(([id, m]) =>
               ({ id, paramKey: m.paramKey, offVal: m.offVal, onVal: m.onVal })),
      note:  Object.entries(_note).map(([id, m]) =>
               ({ id, paramKey: m.paramKey, min: m.min, max: m.max, invert: m.invert })),
      adsrs: _adsrs.map(a => ({
               attack: a.attack, decay: a.decay, sustain: a.sustain, release: a.release,
               flutter: a.flutter, target: a.target,
             })),
    }));
  } catch {}
}

function _loadMappings() {
  try {
    const raw = localStorage.getItem(_storageKey());
    if (!raw) return;
    const d = JSON.parse(raw);
    (d.cc   || []).forEach(m => { _cc[m.id]   = _mkCC(m.paramKey, m.min, m.max, m.smoothing); _cc[m.id].invert = m.invert ?? false; });
    (d.tog  || []).forEach(m => { _tog[m.id]  = { paramKey: m.paramKey, offVal: m.offVal, onVal: m.onVal, _state: false }; });
    (d.note || []).forEach(m => { _note[m.id] = { paramKey: m.paramKey, min: m.min, max: m.max, invert: m.invert ?? false }; });
    (d.adsrs || []).forEach((sv, i) => {
      if (!_adsrs[i]) return;
      Object.assign(_adsrs[i], { attack: sv.attack, decay: sv.decay, sustain: sv.sustain, release: sv.release, flutter: sv.flutter ?? false, target: sv.target ?? null });
    });
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// LOG
// ─────────────────────────────────────────────────────────────
function _log(msg) {
  _logs.push(msg);
  if (_logs.length > MAX_LOG_LINES) _logs.shift();
  if (_panelOpen) _refreshLog();
}

// ─────────────────────────────────────────────────────────────
// PANEL BUILD
// ─────────────────────────────────────────────────────────────
function _buildPanel() {
  if (_panel) return;

  // ── Inject styles ───────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
#_midi_panel{
  position:fixed;bottom:0;left:0;width:460px;max-height:88vh;
  overflow-y:auto;background:rgba(5,5,16,0.97);
  border:1px solid rgba(0,255,204,.18);border-bottom:none;
  border-radius:12px 12px 0 0;padding:0;color:#dde;
  font-family:'Courier New',monospace;font-size:11px;
  z-index:999999;display:none;
  backdrop-filter:blur(22px);box-shadow:0 -6px 50px rgba(0,255,204,.06);
  user-select:none
}
#_midi_panel *{box-sizing:border-box}
#_midi_panel::-webkit-scrollbar{width:5px}
#_midi_panel::-webkit-scrollbar-thumb{background:rgba(0,255,204,.2);border-radius:3px}
._mp_header{
  position:sticky;top:0;z-index:3;
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 16px 8px;background:rgba(5,5,16,.98);
  border-bottom:1px solid rgba(0,255,204,.1)
}
._mp_title{color:#00ffcc;font-size:13px;font-weight:bold;letter-spacing:.12em}
._mp_hint{color:rgba(255,255,255,.25);font-size:9px}
._mp_tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.07)}
._mp_tab{
  flex:1;padding:7px 0;border:none;background:none;
  color:rgba(255,255,255,.35);font-size:10px;letter-spacing:.07em;
  cursor:pointer;border-bottom:2px solid transparent;
  transition:all .15s;font-family:monospace
}
._mp_tab._active{color:#00ffcc;border-bottom-color:#00ffcc;background:rgba(0,255,204,.03)}
._mp_tab:hover{color:#fff}
._mp_sec{padding:12px 16px;display:none}
._mp_sec._active{display:block}

/* mapping row */
._mm_row{padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)}
._mm_row:last-child{border-bottom:none}
._mm_top{display:flex;align-items:center;gap:6px;margin-bottom:3px}
._mm_name{flex:1;font-size:10px;color:#bbb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
._mm_id{font-size:8px;color:rgba(0,255,204,.45);font-family:monospace}
._mm_btns{display:flex;gap:4px}
._mb{
  padding:2px 7px;font-size:9px;font-family:monospace;cursor:pointer;
  border-radius:3px;border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.05);color:#888;transition:all .12s
}
._mb:hover{background:rgba(255,255,255,.12);color:#fff}
._mb._learn{border-color:rgba(0,255,204,.35);color:rgba(0,255,204,.7)}
._mb._armed{background:rgba(255,200,0,.18);border-color:#ffc800;color:#ffc800;
  animation:_mp_blink .45s infinite alternate}
._mb._del{border-color:rgba(255,60,80,.3);color:rgba(255,90,90,.6)}
._mb._del:hover{background:rgba(255,60,80,.15);color:#ff5050}
@keyframes _mp_blink{from{opacity:.55}to{opacity:1}}
._mm_sub{display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding-left:2px}
._mm_sub label{font-size:8px;color:#555;white-space:nowrap}
._mm_sub input[type=number]{
  width:52px;background:#0d0d1a;border:1px solid #2a2a3a;color:#aaa;
  border-radius:2px;padding:1px 4px;font-size:9px;font-family:monospace
}
._mm_sub input[type=range]{width:55px;accent-color:#00ffcc;height:2px;cursor:pointer}
._mm_sub input[type=checkbox]{accent-color:#ff9900;width:11px;height:11px;cursor:pointer}

/* ADSR */
._adsr_card{
  background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);
  border-radius:9px;padding:10px 12px;margin-bottom:12px
}
._adsr_header{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px}
._adsr_title{color:#7b2fff;font-weight:bold;font-size:12px;letter-spacing:.1em}
._adsr_phase{font-size:9px;letter-spacing:.06em}
._adsr_canvas{
  display:block;width:100%;height:60px;
  border:1px solid rgba(255,255,255,.07);border-radius:4px;
  background:#04040e;cursor:default
}
._adsr_grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-top:9px}
._adsr_p{display:flex;flex-direction:column;align-items:center;gap:2px}
._adsr_p label{font-size:8px;color:#666;letter-spacing:.1em;text-transform:uppercase}
._adsr_p input[type=range]{width:100%;accent-color:#7b2fff;height:3px;cursor:pointer}
._adsr_p span{font-size:8px;color:#7b2fff;min-height:11px}
._adsr_target_row{display:flex;align-items:center;gap:7px;margin-top:8px}
._adsr_target_row label{font-size:9px;color:#666;flex-shrink:0}
._adsr_target_row select{
  flex:1;background:#0b0b18;border:1px solid rgba(255,255,255,.1);
  color:#00ffcc;border-radius:3px;padding:2px 5px;
  font-size:9px;font-family:monospace;cursor:pointer
}
._adsr_flutter_row{
  display:flex;align-items:center;gap:6px;margin-top:6px;cursor:pointer
}
._adsr_flutter_row input{accent-color:#ff9900;cursor:pointer}
._adsr_flutter_row span{font-size:9px;color:#ff9900}
._adsr_trig_row{display:flex;gap:6px;margin-top:9px}
._adsr_btn{
  flex:1;padding:6px 0;font-size:10px;font-family:monospace;font-weight:bold;
  cursor:pointer;border-radius:6px;border:none;letter-spacing:.06em;
  transition:all .1s;background:rgba(123,47,255,.2);color:#7b2fff
}
._adsr_btn:active,._adsr_btn._held{background:rgba(123,47,255,.55);color:#fff}
._gate_btn{background:rgba(0,255,204,.12);color:#00ffcc}
._gate_btn._held{background:rgba(0,255,204,.45);color:#000}

/* CC strip */
._cc_strip{display:flex;flex-wrap:wrap;gap:3px;padding:8px 0;min-height:44px}
._cc_wrap{display:flex;flex-direction:column;align-items:center;gap:2px}
._cc_bar{width:13px;height:30px;background:rgba(255,255,255,.06);
  border-radius:2px;position:relative;overflow:hidden}
._cc_fill{position:absolute;bottom:0;width:100%;border-radius:2px 2px 0 0;
  transition:height .05s linear}
._cc_lbl{font-size:7px;color:rgba(255,255,255,.25);max-width:18px;
  overflow:hidden;white-space:nowrap;text-align:center}

/* log */
._mp_log{
  height:100px;overflow-y:auto;background:rgba(0,0,0,.45);
  border:1px solid rgba(255,255,255,.05);border-radius:4px;
  padding:5px 7px;font-size:9px;color:rgba(0,255,204,.55);line-height:1.55
}
._mp_log::-webkit-scrollbar{width:3px}
._mp_log::-webkit-scrollbar-thumb{background:rgba(0,255,204,.15)}
._input_row{display:flex;align-items:center;gap:7px;padding:3px 0;font-size:9px;color:#999}
._input_dot{width:6px;height:6px;border-radius:50%;background:#00ffcc;
  box-shadow:0 0 5px #00ffcc;flex-shrink:0}
`;
  document.head.appendChild(style);

  // ── Build DOM ───────────────────────────────────────────
  _panel = document.createElement("div");
  _panel.id = "_midi_panel";
  _panel.innerHTML = `
<div class="_mp_header">
  <span class="_mp_title">⬡ MIDI ENGINE</span>
  <span class="_mp_hint">Shift + M</span>
</div>
<div class="_mp_tabs">
  <button class="_mp_tab _active" data-t="map">MAPPINGS</button>
  <button class="_mp_tab" data-t="adsr">ADSR × 4</button>
  <button class="_mp_tab" data-t="mon">MONITOR</button>
</div>

<!-- MAPPINGS -->
<div class="_mp_sec _active" id="_mp_map">
  <div style="display:flex;gap:6px;margin-bottom:10px;align-items:center">
    <button class="_mb" id="_mp_clear" style="flex:1">CLEAR ALL</button>
    <button class="_mb" id="_mp_save"
      style="flex:1;border-color:rgba(0,255,204,.3);color:rgba(0,255,204,.75)">SAVE</button>
    <span style="font-size:8px;color:rgba(255,255,255,.2)">Move control after LEARN</span>
  </div>
  <div id="_mp_params"></div>
</div>

<!-- ADSR -->
<div class="_mp_sec" id="_mp_adsr">
  <div id="_mp_adsr_body"></div>
</div>

<!-- MONITOR -->
<div class="_mp_sec" id="_mp_mon">
  <div style="font-size:9px;color:#555;margin-bottom:4px">CONNECTED INPUTS</div>
  <div id="_mp_inputs" style="margin-bottom:10px"></div>
  <div style="font-size:9px;color:#555;margin-bottom:4px">CC ACTIVITY</div>
  <div class="_cc_strip" id="_mp_cc"></div>
  <div style="font-size:9px;color:#555;margin:8px 0 3px">MESSAGE LOG</div>
  <div class="_mp_log" id="_mp_log"></div>
</div>
`;
  document.body.appendChild(_panel);

  // Tabs
  _panel.querySelectorAll("._mp_tab").forEach(tab => {
    tab.addEventListener("click", () => {
      _panel.querySelectorAll("._mp_tab,._mp_sec").forEach(el => el.classList.remove("_active"));
      tab.classList.add("_active");
      _panel.querySelector(`#_mp_${tab.dataset.t}`)?.classList.add("_active");
    });
  });

  // Header buttons
  _panel.querySelector("#_mp_clear").onclick = () => {
    if (confirm("Clear all MIDI mappings?")) { clearMappings(); }
  };
  _panel.querySelector("#_mp_save").onclick = () => {
    _saveMappings();
    const btn = _panel.querySelector("#_mp_save");
    const prev = btn.textContent;
    btn.textContent = "SAVED ✓";
    setTimeout(() => btn.textContent = prev, 1200);
  };

  _buildADSRSection();
  _refreshMappings();
  _refreshInputList();
}

// ─────────────────────────────────────────────────────────────
// MAPPINGS SECTION
// ─────────────────────────────────────────────────────────────
function _getParams() {
  if (!_s) return [];
  return Object.keys(_s).map(key => {
    const el = _devEl?.querySelector(`[id="${key}"]`);
    return { key, min: el ? parseFloat(el.min) : 0, max: el ? parseFloat(el.max) : 1 };
  });
}

function _refreshMappings() {
  const wrap = _panel?.querySelector("#_mp_params");
  if (!wrap) return;
  const params = _getParams();

  if (!params.length) {
    wrap.innerHTML = `<div style="color:rgba(255,255,255,.3);padding:8px 0;font-size:10px">
      Call window.MIDI.init(settings, panelEl) to detect parameters.</div>`;
    return;
  }

  wrap.innerHTML = "";
  params.forEach(p => {
    const exCC  = Object.entries(_cc).find(([, m]) => m.paramKey === p.key);
    const exTog = Object.entries(_tog).find(([, m]) => m.paramKey === p.key);
    const mapped   = exCC || exTog;
    const mappedId = mapped?.[0];
    const mappedType = exCC ? "CC" : exTog ? "BTN" : null;
    const armed = _learn?.paramKey === p.key;

    const row = document.createElement("div");
    row.className = "_mm_row";
    row.innerHTML = `
      <div class="_mm_top">
        <span class="_mm_name" style="color:${mappedId ? "#00ffcc" : "#aaa"}">${p.key}</span>
        ${mappedId ? `<span class="_mm_id">${mappedType} [${mappedId}]</span>` : ""}
        <div class="_mm_btns">
          <button class="_mb _learn ${armed ? "_armed" : ""}"
            data-key="${p.key}" data-min="${p.min}" data-max="${p.max}">
            ${armed ? "● MOVE CTRL" : "LEARN"}
          </button>
          ${mappedId ? `<button class="_mb _del" data-unmap="${mappedId}">✕</button>` : ""}
        </div>
      </div>
      ${exCC ? `
      <div class="_mm_sub">
        <label>MIN</label>
        <input type="number" step="any" value="${exCC[1].min}"
          class="_ccopt" data-id="${exCC[0]}" data-f="min">
        <label>MAX</label>
        <input type="number" step="any" value="${exCC[1].max}"
          class="_ccopt" data-id="${exCC[0]}" data-f="max">
        <label>SMOOTH</label>
        <input type="range" min="0" max="0.99" step="0.01" value="${exCC[1].smoothing}"
          class="_ccsmooth" data-id="${exCC[0]}">
        <label>
          <input type="checkbox" class="_ccinv" data-id="${exCC[0]}"
            ${exCC[1].invert ? "checked" : ""}> INV
        </label>
      </div>` : ""}
    `;

    row.querySelector("._learn").onclick = e => {
      const { key, min, max } = e.currentTarget.dataset;
      _learn = _learn?.paramKey === key ? null : { paramKey: key, min: parseFloat(min), max: parseFloat(max) };
      _refreshMappings();
    };

    row.querySelector("[data-unmap]")?.addEventListener("click", e => {
      const id = e.currentTarget.dataset.unmap;
      delete _cc[id]; delete _tog[id]; delete _note[id];
      _saveMappings(); _refreshMappings();
    });

    row.querySelectorAll("._ccopt").forEach(inp => inp.addEventListener("change", e => {
      const m = _cc[e.target.dataset.id];
      if (m) { m[e.target.dataset.f] = parseFloat(e.target.value); _saveMappings(); }
    }));

    row.querySelector("._ccsmooth")?.addEventListener("input", e => {
      const m = _cc[e.target.dataset.id];
      if (m) { m.smoothing = parseFloat(e.target.value); _saveMappings(); }
    });

    row.querySelector("._ccinv")?.addEventListener("change", e => {
      const m = _cc[e.target.dataset.id];
      if (m) { m.invert = e.target.checked; _saveMappings(); }
    });

    wrap.appendChild(row);
  });
}

// ─────────────────────────────────────────────────────────────
// ADSR SECTION
// ─────────────────────────────────────────────────────────────
function _buildADSRSection() {
  const body = _panel?.querySelector("#_mp_adsr_body");
  if (!body) return;
  body.innerHTML = "";

  _adsrs.forEach((adsr, i) => {
    const card = document.createElement("div");
    card.className = "_adsr_card";
    card.innerHTML = `
      <div class="_adsr_header">
        <span class="_adsr_title">ADSR ${i + 1}</span>
        <span class="_adsr_phase" id="_ap_${i}">IDLE</span>
      </div>
      <canvas class="_adsr_canvas" id="_ac_${i}" height="60"></canvas>
      <div class="_adsr_grid">
        <div class="_adsr_p">
          <label>A</label>
          <input type="range" id="_aa_${i}" min="0.001" max="4" step="0.001" value="${adsr.attack}">
          <span id="_aav_${i}">${adsr.attack.toFixed(2)}s</span>
        </div>
        <div class="_adsr_p">
          <label>D</label>
          <input type="range" id="_ad_${i}" min="0.001" max="4" step="0.001" value="${adsr.decay}">
          <span id="_adv_${i}">${adsr.decay.toFixed(2)}s</span>
        </div>
        <div class="_adsr_p">
          <label>S</label>
          <input type="range" id="_as_${i}" min="0" max="1" step="0.01" value="${adsr.sustain}">
          <span id="_asv_${i}">${adsr.sustain.toFixed(2)}</span>
        </div>
        <div class="_adsr_p">
          <label>R</label>
          <input type="range" id="_ar_${i}" min="0.001" max="8" step="0.001" value="${adsr.release}">
          <span id="_arv_${i}">${adsr.release.toFixed(2)}s</span>
        </div>
      </div>
      <div class="_adsr_target_row">
        <label>TARGET PARAM</label>
        <select id="_at_${i}"><option value="">— none —</option></select>
      </div>
      <div class="_adsr_flutter_row">
        <input type="checkbox" id="_af_${i}" ${adsr.flutter ? "checked" : ""}>
        <span>Flutter / gate-chop mode</span>
      </div>
      <div class="_adsr_trig_row">
        <button class="_adsr_btn" id="_atrig_${i}">TRIGGER</button>
        <button class="_adsr_btn _gate_btn" id="_agate_${i}">GATE  (hold)</button>
      </div>
    `;
    body.appendChild(card);

    // Wire sliders
    const wireA = (elId, field, fmt) => {
      const el = document.getElementById(elId);
      const vEl = document.getElementById(elId.replace(/(_a[a-z])_/, "$1v_"));
      el?.addEventListener("input", () => {
        adsr[field] = parseFloat(el.value);
        if (vEl) vEl.textContent = fmt(adsr[field]);
        _drawCurve(i); _saveMappings();
      });
    };
    wireA(`_aa_${i}`, "attack",  v => v.toFixed(2) + "s");
    wireA(`_ad_${i}`, "decay",   v => v.toFixed(2) + "s");
    wireA(`_as_${i}`, "sustain", v => v.toFixed(2));
    wireA(`_ar_${i}`, "release", v => v.toFixed(2) + "s");

    // Target select
    const sel = document.getElementById(`_at_${i}`);
    sel?.addEventListener("change", () => {
      const key = sel.value;
      if (!key) { adsr.target = null; _saveMappings(); return; }
      const el = _devEl?.querySelector(`[id="${key}"]`);
      adsr.target = { paramKey: key, min: el ? parseFloat(el.min) : 0, max: el ? parseFloat(el.max) : 1 };
      _saveMappings();
    });

    // Flutter
    document.getElementById(`_af_${i}`)?.addEventListener("change", e => {
      adsr.flutter = e.target.checked; _saveMappings();
    });

    // Trigger (one-shot gate)
    document.getElementById(`_atrig_${i}`)?.addEventListener("click", () => {
      adsr.gate(true);
      setTimeout(() => adsr.gate(false), (adsr.attack + adsr.decay) * 1000 + 20);
    });

    // Gate (hold)
    const gateBtn = document.getElementById(`_agate_${i}`);
    if (gateBtn) {
      const on  = () => { adsr.gate(true);  gateBtn.classList.add("_held"); };
      const off = () => { adsr.gate(false); gateBtn.classList.remove("_held"); };
      gateBtn.addEventListener("mousedown",  on);
      gateBtn.addEventListener("mouseup",    off);
      gateBtn.addEventListener("mouseleave", off);
      gateBtn.addEventListener("touchstart", e => { e.preventDefault(); on(); }, { passive: false });
      gateBtn.addEventListener("touchend",   off);
    }

    _drawCurve(i);
  });

  _refreshADSRDropdowns();
}

function _refreshADSRDropdowns() {
  const params = _getParams();
  _adsrs.forEach((adsr, i) => {
    const sel = document.getElementById(`_at_${i}`);
    if (!sel) return;
    const cur = adsr.target?.paramKey || "";
    sel.innerHTML = `<option value="">— none —</option>`;
    params.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.key; opt.textContent = p.key;
      if (p.key === cur) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

function _drawCurve(i, liveVal) {
  const c = document.getElementById(`_ac_${i}`);
  if (!c) return;
  c.width = c.parentElement?.offsetWidth || 380;
  const cx = c.getContext("2d");
  const W = c.width, H = c.height;
  const adsr = _adsrs[i];

  cx.clearRect(0, 0, W, H);
  cx.fillStyle = "#04040e"; cx.fillRect(0, 0, W, H);

  // Grid
  cx.strokeStyle = "rgba(255,255,255,.04)"; cx.lineWidth = 1;
  for (let g = 1; g < 4; g++) {
    cx.beginPath(); cx.moveTo(g * W/4, 0); cx.lineTo(g * W/4, H); cx.stroke();
  }
  cx.beginPath(); cx.moveTo(0, H * .5); cx.lineTo(W, H * .5); cx.stroke();

  const sustLen  = 0.3;
  const total    = adsr.attack + adsr.decay + sustLen + adsr.release;
  const xT = t  => (t / total) * (W - 4) + 2;
  const yV = v  => H - 4 - v * (H - 8);

  const t0 = 0, t1 = adsr.attack, t2 = t1 + adsr.decay, t3 = t2 + sustLen, t4 = t3 + adsr.release;

  // Fill
  const g = cx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(123,47,255,.22)");
  g.addColorStop(1, "rgba(123,47,255,0)");
  cx.beginPath();
  cx.moveTo(xT(t0), H);
  cx.lineTo(xT(t0), yV(0));
  cx.lineTo(xT(t1), yV(1));
  cx.lineTo(xT(t2), yV(adsr.sustain));
  cx.lineTo(xT(t3), yV(adsr.sustain));
  cx.lineTo(xT(t4), yV(0));
  cx.lineTo(xT(t4), H);
  cx.closePath(); cx.fillStyle = g; cx.fill();

  // Line
  cx.beginPath(); cx.strokeStyle = "#7b2fff"; cx.lineWidth = 2;
  cx.shadowColor = "#7b2fff"; cx.shadowBlur = 7;
  cx.moveTo(xT(t0), yV(0));
  cx.lineTo(xT(t1), yV(1));
  cx.lineTo(xT(t2), yV(adsr.sustain));
  cx.lineTo(xT(t3), yV(adsr.sustain));
  cx.lineTo(xT(t4), yV(0));
  cx.stroke(); cx.shadowBlur = 0;

  // Labels
  cx.fillStyle = "rgba(255,255,255,.18)"; cx.font = "8px monospace";
  cx.fillText("A", xT(t0 + adsr.attack * .5) - 3, H - 3);
  cx.fillText("D", xT(t1 + adsr.decay  * .5) - 3, H - 3);
  cx.fillText("S", xT(t2 + sustLen     * .5) - 3, H - 3);
  cx.fillText("R", xT(t3 + adsr.release* .5) - 3, H - 3);

  // Live playhead
  if (liveVal !== undefined && liveVal !== null && adsr.phase !== "idle") {
    let t = 0;
    switch (adsr.phase) {
      case "attack":  t = adsr.time; break;
      case "decay":   t = t1 + adsr.time; break;
      case "sustain": t = t2 + sustLen * .5; break;
      case "release": t = t3 + adsr.time; break;
    }
    const px = xT(Math.min(t, t4));
    cx.beginPath(); cx.strokeStyle = "#00ffcc"; cx.lineWidth = 1.5;
    cx.shadowColor = "#00ffcc"; cx.shadowBlur = 5;
    cx.moveTo(px, 0); cx.lineTo(px, H); cx.stroke(); cx.shadowBlur = 0;
    const dotY = yV(liveVal);
    cx.fillStyle = "#00ffcc"; cx.beginPath(); cx.arc(px, dotY, 3, 0, Math.PI * 2); cx.fill();
  }
}

// ─────────────────────────────────────────────────────────────
// UI TICK  (runs only when panel is open)
// ─────────────────────────────────────────────────────────────
function _tickUI() {
  // ADSR phase labels + live curves
  _adsrs.forEach((adsr, i) => {
    const ph = document.getElementById(`_ap_${i}`);
    if (ph) {
      ph.textContent = adsr.phase.toUpperCase();
      ph.style.color =
        adsr.phase === "attack"  ? "#00ffcc" :
        adsr.phase === "decay"   ? "#ff9900" :
        adsr.phase === "sustain" ? "#7b2fff" :
        adsr.phase === "release" ? "#ff003c" : "rgba(123,47,255,.3)";
    }
    if (adsr.phase !== "idle") _drawCurve(i, adsr.value);
  });

  // CC strip
  _refreshCCStrip();
}

function _refreshCCStrip() {
  const strip = _panel?.querySelector("#_mp_cc");
  if (!strip) return;
  const now = performance.now();

  Object.entries(_ccAct).forEach(([id, info]) => {
    const age = (now - info.ts) / 1000;
    if (age > 3) { delete _ccAct[id]; strip.querySelector(`[data-c="${id}"]`)?.remove(); return; }
    const alpha = Math.max(0.12, 1 - age * 0.4);

    let wrap = strip.querySelector(`[data-c="${id}"]`);
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "_cc_wrap"; wrap.dataset.c = id;
      wrap.innerHTML = `<div class="_cc_bar"><div class="_cc_fill"></div></div>
                        <div class="_cc_lbl">${id.split("_")[1] ?? id}</div>`;
      strip.appendChild(wrap);
    }
    const fill = wrap.querySelector("._cc_fill");
    const pct  = Math.round((info.raw / 127) * 100);
    fill.style.height     = `${pct}%`;
    fill.style.background = `hsla(${160 + (info.raw/127)*60},100%,55%,${alpha})`;
  });
}

function _refreshInputList() {
  const el = _panel?.querySelector("#_mp_inputs");
  if (!el) return;
  if (!_access) { el.innerHTML = `<div style="color:rgba(255,255,255,.25);font-size:9px">MIDI not initialised</div>`; return; }
  const inputs = [..._access.inputs.values()];
  el.innerHTML = inputs.length
    ? inputs.map(i => `<div class="_input_row"><div class="_input_dot"></div><span>${i.name}</span></div>`).join("")
    : `<div style="color:rgba(255,255,255,.25);font-size:9px">No devices connected</div>`;
}

function _refreshLog() {
  const el = _panel?.querySelector("#_mp_log");
  if (!el) return;
  el.innerHTML = _logs.map(l => `<div>${l}</div>`).join("");
  el.scrollTop = el.scrollHeight;
}

// ─────────────────────────────────────────────────────────────
// PANEL TOGGLE
// ─────────────────────────────────────────────────────────────
function _togglePanel() {
  if (!_panel) _buildPanel();
  _panelOpen = !_panelOpen;
  _panel.style.display = _panelOpen ? "block" : "none";
  if (_panelOpen) {
    _refreshMappings();
    _refreshADSRDropdowns();
    _refreshInputList();
    _refreshLog();
  }
}

// ─────────────────────────────────────────────────────────────
// EXPORT  (ES module + global)
// ─────────────────────────────────────────────────────────────
const API = {
  init:          init,
  mapCC:         mapCC,
  mapNote:       mapNote,
  mapNoteToggle: mapNoteToggle,
  clearMappings: clearMappings,
  openPanel:     () => { if (!_panelOpen) _togglePanel(); },
  closePanel:    () => { if (_panelOpen)  _togglePanel(); },
  getADSR:       i => _adsrs[i],
};

window.MIDI = API;

export {
  init as initMIDI,
  mapCC,
  mapNote,
  mapNoteToggle,
  clearMappings,
};