/* Hof-Karte: Leitungen, Schieber, Kabel, Grenzsteine und Flächen am Hof einzeichnen. */
(() => {
const CFG = window.HOFKARTE_CONFIG || {};
const VERSION = '1.0';

// ---------- Helfer ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const fmtN = (n, d = 0) => Number(n).toLocaleString('de-AT', { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtLen = (m) => (m >= 1000 ? `${fmtN(m / 1000, 2)} km` : `${fmtN(m, m < 10 ? 1 : 0)} m`);
const fmtArea = (a) => `${fmtN(a)} m² · ${fmtN(a / 10000, 2)} ha`;
const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } return v; };

// ---------- Icons ----------
const P = {
  valve: '<path d="M4 9v6M20 9v6M4 12h16M12 12V6M8 6h8"/>',
  drop: '<path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z"/>',
  hydrant: '<path d="M8 21h8M9 21V10h6v11M8 10h8M10 10V7a2 2 0 0 1 4 0v3M6 13h3M15 13h3"/>',
  circle: '<circle cx="12" cy="12" r="7"/><path d="M8 12h8"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  stone: '<path d="M7 20l2-14h6l2 14z"/><path d="M10 10h4"/>',
  tank: '<rect x="4" y="7" width="16" height="11" rx="5"/><path d="M9 7V5h6v2"/>',
  gate: '<path d="M4 20V5M20 20V5M4 8h16M4 16h16M8 8l8 8"/>',
  pin: '<path d="M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  wave: '<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/>',
  pipe: '<path d="M3 9h12a4 4 0 0 1 4 4v8M3 15h9a1 1 0 0 1 1 1v5"/>',
  fence: '<path d="M5 20V6l2-2 2 2v14M15 20V6l2-2 2 2v14M3 10h18M3 16h18"/>',
  road: '<path d="M8 3L5 21M16 3l3 18M12 4v3M12 11v3M12 18v2"/>',
  line: '<path d="M4 18L10 9l5 5 5-9"/>',
  grass: '<path d="M4 20c1-5 2-8 4-10M9 20c0-5 1-9 3-13M15 20c0-4-1-8-3-11M20 20c-1-5-3-8-5-9"/>',
  tree: '<path d="M12 3l6 9h-3l4 6H5l4-6H6z"/><path d="M12 18v3"/>',
  area: '<path d="M4 7l7-3 9 5-2 10-11 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gps: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  check: '<path d="M5 12l4 4 10-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  nav: '<path d="M12 2l7 19-7-4-7 4z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24">${P[k] || P.pin}</svg>`;

// ---------- Kategorien ----------
const CATS = {
  schieber: { kind: 'point', label: 'Wasser-Schieber', color: '#1f6fd0', icon: 'valve' },
  quelle: { kind: 'point', label: 'Quelle / Brunnen', color: '#0b9bbd', icon: 'drop' },
  hydrant: { kind: 'point', label: 'Hydrant', color: '#d32f2f', icon: 'hydrant' },
  schacht: { kind: 'point', label: 'Schacht', color: '#616161', icon: 'circle' },
  verteiler: { kind: 'point', label: 'Stromkasten', color: '#e07b00', icon: 'bolt' },
  grenzstein: { kind: 'point', label: 'Grenzstein', color: '#7c3aed', icon: 'stone' },
  tank: { kind: 'point', label: 'Tank', color: '#795548', icon: 'tank' },
  tor: { kind: 'point', label: 'Tor / Gatter', color: '#33691e', icon: 'gate' },
  punkt: { kind: 'point', label: 'Sonstiger Punkt', color: '#455a64', icon: 'pin' },
  wasser: { kind: 'line', label: 'Wasserleitung', color: '#1f6fd0', icon: 'drop' },
  strom: { kind: 'line', label: 'Stromkabel', color: '#e07b00', icon: 'bolt' },
  drainage: { kind: 'line', label: 'Drainage', color: '#00a3a3', icon: 'wave', dash: '10 7' },
  kanal: { kind: 'line', label: 'Kanal / Abwasser', color: '#795548', icon: 'pipe' },
  zaun: { kind: 'line', label: 'Zaun', color: '#263238', icon: 'fence', dash: '2 7' },
  weg: { kind: 'line', label: 'Weg / Zufahrt', color: '#9e9e9e', icon: 'road' },
  linie: { kind: 'line', label: 'Sonstige Linie', color: '#455a64', icon: 'line' },
  wiese: { kind: 'area', label: 'Wiese / Feld', color: '#43a047', icon: 'grass' },
  weide: { kind: 'area', label: 'Weide', color: '#9ccc65', icon: 'grass' },
  wald: { kind: 'area', label: 'Wald', color: '#1b5e20', icon: 'tree' },
  flaeche: { kind: 'area', label: 'Sonstige Fläche', color: '#455a64', icon: 'area' },
};
const KIND_LABEL = { point: 'Punkte', line: 'Leitungen & Linien', area: 'Flächen' };
const catOf = (f) => CATS[f.cat] || CATS.punkt;
const sw = (c, size = '') => `<span class="sw" style="background:${c.color}${size}">${svg(c.icon)}</span>`;

// ---------- Geometrie ----------
const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
function dist(a, b) {
  const dLat = rad(b.lat - a.lat); const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const lineLength = (cs) => cs.slice(1).reduce((s, c, i) => s + dist(cs[i], c), 0);
function areaOf(cs) {
  if (cs.length < 3) return 0;
  const lat0 = cs.reduce((s, c) => s + c.lat, 0) / cs.length;
  const k = Math.cos(rad(lat0));
  const pts = cs.map((c) => [rad(c.lng) * R * k, rad(c.lat) * R]);
  let s = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; });
  return Math.abs(s) / 2;
}
const centroid = (cs) => ({ lat: cs.reduce((s, c) => s + c.lat, 0) / cs.length, lng: cs.reduce((s, c) => s + c.lng, 0) / cs.length });
function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
const DIRS = ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten'];
const dirText = (deg) => DIRS[Math.round(deg / 45) % 8];
function nearestPoint(f, from) {
  if (f.kind === 'area') return centroid(f.coords);
  let best = f.coords[0]; let bd = Infinity;
  f.coords.forEach((c) => { const d = dist(from, c); if (d < bd) { bd = d; best = c; } });
  return best;
}
const anchor = (f) => (f.kind === 'area' ? centroid(f.coords) : f.coords[0]);
function measureText(f) {
  if (f.kind === 'line') return fmtLen(lineLength(f.coords));
  if (f.kind === 'area') return fmtArea(areaOf(f.coords));
  return '';
}
const coordText = (c) => `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`;

// ---------- Zustand ----------
let store = null;
let user = null;
let features = [];
let settings = {};
let map = null;
let featLayer = null;
const layerById = new Map();
let hidden = new Set(LS('hofkarte_hidden') || []);
let showLabels = LS('hofkarte_labels') !== false;
let selectedId = null;

// ---------- Toast ----------
let toastTimer;
function toast(msg, ms = 2800) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function onStoreError(e) {
  const c = String((e && e.code) || '');
  if (c.includes('permission')) toast('Kein Zugriff – ist deine E-Mail in den Firestore-Regeln eingetragen?', 5000);
  else toast((e && e.message) || 'Fehler beim Speichern', 5000);
}
const userName = () => (user && user.email && user.email !== 'demo' ? user.email.split('@')[0] : '');

// ---------- Karte ----------
const BASES = {
  luftbild: { label: 'Luftbild (basemap.at)', url: 'https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg', native: 19, attr: 'Luftbild: <a href="https://basemap.at" target="_blank">basemap.at</a>' },
  karte: { label: 'Karte (basemap.at)', url: 'https://mapsneu.wien.gv.at/basemap/geolandbasemap/normal/google3857/{z}/{y}/{x}.png', native: 19, attr: 'Karte: <a href="https://basemap.at" target="_blank">basemap.at</a>' },
  osm: { label: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', native: 19, attr: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>' },
};
const LABELS_URL = 'https://mapsneu.wien.gv.at/basemap/bmapoverlay/normal/google3857/{z}/{y}/{x}.png';
let baseKey = LS('hofkarte_base') || 'luftbild';
let baseLayer = null;
let labelLayer = null;
let showStreetLabels = LS('hofkarte_streetlabels') !== false;
const wmsLayers = (CFG.wms || []).map((w, i) => ({ ...w, i, on: LS(`hofkarte_wms_${i}`) !== false, layer: null }));

function setBase(key) {
  if (!BASES[key]) key = 'luftbild';
  baseKey = key; LS('hofkarte_base', key);
  if (baseLayer) map.removeLayer(baseLayer);
  const b = BASES[key];
  let errors = 0;
  baseLayer = L.tileLayer(b.url, { maxNativeZoom: b.native, maxZoom: 21, attribution: b.attr });
  baseLayer.on('tileerror', () => {
    errors += 1;
    if (errors === 12 && key !== 'osm' && navigator.onLine) { toast(`${b.label} gerade nicht erreichbar – wechsle zu OpenStreetMap`, 4000); setBase('osm'); }
  });
  baseLayer.on('tileload', () => { errors = 0; });
  baseLayer.addTo(map).bringToBack();
  updateLabelLayer();
}
function updateLabelLayer() {
  if (labelLayer) { map.removeLayer(labelLayer); labelLayer = null; }
  if (baseKey === 'luftbild' && showStreetLabels) labelLayer = L.tileLayer(LABELS_URL, { maxNativeZoom: 19, maxZoom: 21, pane: 'labels', opacity: 0.9 }).addTo(map);
}
function updateWms() {
  wmsLayers.forEach((w) => {
    if (w.on && !w.layer) {
      w.layer = L.tileLayer.wms(w.url, { layers: w.layers, format: w.format || 'image/png', transparent: true, version: w.version || '1.3.0', maxZoom: 21, attribution: w.attribution || '', opacity: w.opacity || 0.85, pane: 'wms' }).addTo(map);
    } else if (!w.on && w.layer) { map.removeLayer(w.layer); w.layer = null; }
  });
}
const homeView = () => (settings.center && settings.center.lat ? settings.center : CFG.start || { lat: 47.3979, lng: 12.9029, zoom: 18 });

function initMap() {
  const h = homeView();
  const touch = matchMedia('(pointer: coarse)').matches;
  map = L.map('map', { zoomControl: !touch, maxZoom: 21, tap: false }).setView([h.lat, h.lng], h.zoom || 18);
  if (!touch) map.zoomControl.setPosition('bottomright');
  map.createPane('labels').style.zIndex = 350;   // Beschriftungen über dem Luftbild, unter den Einträgen
  map.createPane('wms').style.zIndex = 300;
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank">Leaflet</a>');
  setBase(baseKey);
  updateWms();
  featLayer = L.layerGroup().addTo(map);
  map.on('move', () => { if (draw) updateDraw(); });
  map.on('zoomend', () => renderFeatures());
  // Lange drücken = Punkt an dieser Stelle (Maus: Rechtsklick)
  let lastTouch = 0;
  map.on('contextmenu', (e) => { if (!draw && Date.now() - lastTouch > 1500) openSheet(viewQuickPoint(e.latlng)); });
  const el = map.getContainer();
  let lp = null;
  el.addEventListener('touchstart', (e) => {
    lastTouch = Date.now();
    if (e.touches.length !== 1 || draw) { lp = null; return; }
    const t = e.touches[0];
    lp = { x: t.clientX, y: t.clientY, timer: setTimeout(() => {
      if (!lp) return;
      const ll = map.containerPointToLatLng(map.mouseEventToContainerPoint({ clientX: lp.x, clientY: lp.y }));
      lp = null;
      if (navigator.vibrate) navigator.vibrate(30);
      openSheet(viewQuickPoint(ll));
    }, 650) };
  }, { passive: true });
  const cancelLp = (e) => {
    lastTouch = Date.now();
    if (!lp) return;
    if (e.type === 'touchmove') { const t = e.touches[0]; if (Math.hypot(t.clientX - lp.x, t.clientY - lp.y) < 10) return; }
    clearTimeout(lp.timer); lp = null;
  };
  ['touchmove', 'touchend', 'touchcancel'].forEach((ev) => el.addEventListener(ev, cancelLp, { passive: true }));
  map.on('zoomstart movestart', () => { if (lp) { clearTimeout(lp.timer); lp = null; } });
}

// ---------- Objekte zeichnen ----------
function renderFeatures() {
  if (!featLayer) return;
  featLayer.clearLayers();
  layerById.clear();
  const z = map.getZoom();
  features.forEach((f) => {
    if (hidden.has(f.cat) || !Array.isArray(f.coords) || !f.coords.length) return;
    const c = catOf(f);
    const ll = f.coords.map((p) => [p.lat, p.lng]);
    const sel = f.id === selectedId;
    let layer;
    if (f.kind === 'point') {
      layer = L.marker(ll[0], { icon: L.divIcon({ className: '', html: `<div class="pin ${sel ? 'sel' : ''}" style="background:${c.color}">${svg(c.icon)}</div>`, iconSize: [34, 34], iconAnchor: [4, 34] }), keyboard: false });
    } else if (f.kind === 'line') {
      const group = [];
      if (sel) group.push(L.polyline(ll, { color: '#fff', weight: 11, opacity: 0.9, interactive: false }));
      group.push(L.polyline(ll, { color: c.color, weight: sel ? 7 : 5, dashArray: c.dash || null, lineCap: 'round', opacity: 0.95 }));
      layer = L.featureGroup(group);
    } else {
      layer = L.polygon(ll, { color: sel ? '#fff' : c.color, weight: sel ? 4 : 2.5, fillColor: c.color, fillOpacity: sel ? 0.35 : 0.22 });
    }
    layer.on('click', (e) => { L.DomEvent.stopPropagation(e); if (!draw) openFeature(f.id); });
    if (showLabels && z >= 17 && f.title) {
      layer.bindTooltip(esc(f.title), { permanent: true, direction: f.kind === 'point' ? 'right' : 'center', className: 'map-label', offset: f.kind === 'point' ? [14, -18] : [0, 0], interactive: false });
    }
    layer.addTo(featLayer);
    layerById.set(f.id, layer);
  });
}
function zoomTo(f, keepSheet) {
  if (!f || !f.coords || !f.coords.length) return;
  if (!keepSheet) closeSheet();
  if (f.kind === 'point') map.setView([f.coords[0].lat, f.coords[0].lng], Math.max(map.getZoom(), 19));
  else map.fitBounds(L.latLngBounds(f.coords.map((p) => [p.lat, p.lng])), { padding: [60, 60], maxZoom: 20 });
}

// ---------- GPS ----------
let watchId = null;
let fix = null;
let meMarker = null;
let accCircle = null;
let centerOnFix = false;
function startGps(center) {
  if (!('geolocation' in navigator)) { toast('Dieses Gerät hat kein GPS'); return; }
  centerOnFix = !!center;
  if (watchId !== null) { if (center && fix) map.setView([fix.lat, fix.lng], Math.max(map.getZoom(), 18)); return; }
  $('#btnLocate').classList.add('on');
  $('#gpsPill').hidden = false; $('#gpsPill').textContent = 'GPS wird gesucht …'; $('#gpsPill').classList.remove('bad');
  watchId = navigator.geolocation.watchPosition((p) => {
    fix = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, ts: Date.now() };
    const ll = [fix.lat, fix.lng];
    if (!meMarker) {
      meMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
      accCircle = L.circle(ll, { radius: fix.acc, color: '#1a73e8', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
    } else { meMarker.setLatLng(ll); accCircle.setLatLng(ll).setRadius(fix.acc); }
    const pill = $('#gpsPill');
    pill.textContent = `GPS-Genauigkeit ± ${fmtN(fix.acc)} m${fix.acc > 15 ? ' – noch ungenau' : ''}`;
    pill.classList.toggle('bad', fix.acc > 15);
    if (centerOnFix) { map.setView(ll, Math.max(map.getZoom(), 18)); centerOnFix = false; }
    if (draw) updateDraw();
  }, (err) => {
    stopGps();
    toast(err.code === 1 ? 'Standort nicht erlaubt. Erlaube den Standortzugriff für den Browser in den Handy-Einstellungen.' : 'Kein GPS-Signal', 5000);
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
}
function stopGps() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null; fix = null;
  if (meMarker) { map.removeLayer(meMarker); map.removeLayer(accCircle); meMarker = null; accCircle = null; }
  $('#btnLocate').classList.remove('on');
  $('#gpsPill').hidden = true;
}
function waitForFix(maxMs = 15000) {
  return new Promise((resolve) => {
    if (fix && Date.now() - fix.ts < 5000) { resolve(fix); return; }
    startGps(false);
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (fix && Date.now() - fix.ts < 5000) { clearInterval(iv); resolve(fix); }
      else if (Date.now() - t0 > maxMs || watchId === null) { clearInterval(iv); resolve(null); }
    }, 300);
  });
}

// ---------- Zeichenmodus ----------
let draw = null; // { kind, cat, coords, editId, measure }
let drawLayer = null;
function startDraw(opts) {
  closeSheet();
  draw = { coords: [], ...opts };
  if (opts.editId) draw.coords = [];
  drawLayer = L.layerGroup().addTo(map);
  $('#crosshair').hidden = false;
  $('#drawbar').hidden = false;
  $('#fab').hidden = true;
  $('.topbar').style.visibility = 'hidden';
  renderDrawButtons();
  updateDraw();
}
function endDraw() {
  if (drawLayer) map.removeLayer(drawLayer);
  drawLayer = null; draw = null;
  $('#crosshair').hidden = true; $('#drawbar').hidden = true; $('#fab').hidden = false;
  $('.topbar').style.visibility = '';
}
function renderDrawButtons() {
  const k = draw.kind;
  const btn = (id, icon, label, cls = '') => `<button id="${id}" class="${cls}">${svg(icon)}${label}</button>`;
  $('#drawBtns').innerHTML = k === 'point'
    ? btn('dHere', 'plus', 'Hier setzen', 'primary') + btn('dGps', 'gps', 'Meine Position') + btn('dCancel', 'x', 'Abbrechen')
    : btn('dAdd', 'plus', 'Punkt setzen', 'primary') + btn('dGps', 'gps', 'GPS-Punkt') + btn('dUndo', 'undo', 'Zurück')
      + btn('dDone', 'check', draw.measure ? 'Fertig' : 'Fertig') + btn('dCancel', 'x', 'Abbrechen');
  const on = (id, fn) => { const b = $(`#${id}`); if (b) b.onclick = fn; };
  on('dCancel', () => { endDraw(); });
  on('dHere', () => { const c = map.getCenter(); draw.coords = [{ lat: c.lat, lng: c.lng }]; finishDraw(); });
  on('dAdd', () => { const c = map.getCenter(); draw.coords.push({ lat: c.lat, lng: c.lng }); updateDraw(); });
  on('dUndo', () => { draw.coords.pop(); updateDraw(); });
  on('dGps', async () => {
    toast('Warte auf GPS …', 1500);
    const f = await waitForFix();
    if (!draw) return;
    if (!f) { toast('Kein GPS-Signal – setze den Punkt mit dem Fadenkreuz.', 4000); return; }
    if (f.acc > 15) toast(`Achtung: GPS nur auf ± ${fmtN(f.acc)} m genau`, 3500);
    const p = { lat: f.lat, lng: f.lng };
    map.panTo([p.lat, p.lng]);
    if (draw.kind === 'point') { draw.coords = [p]; finishDraw(); } else { draw.coords.push(p); updateDraw(); }
  });
  on('dDone', () => finishDraw());
}
function updateDraw() {
  if (!draw || !drawLayer) return;
  const c = CATS[draw.cat] || { color: '#ff3b30', label: 'Messen' };
  const pts = draw.coords.map((p) => [p.lat, p.lng]);
  const center = map.getCenter();
  drawLayer.clearLayers();
  if (draw.kind === 'area' && pts.length >= 2) L.polygon([...pts, [center.lat, center.lng]], { color: c.color, weight: 2, fillOpacity: 0.2, dashArray: '6 6', interactive: false }).addTo(drawLayer);
  if (pts.length >= 2) L.polyline(pts, { color: c.color, weight: 5, interactive: false }).addTo(drawLayer);
  if (pts.length >= 1 && draw.kind !== 'point') L.polyline([pts[pts.length - 1], [center.lat, center.lng]], { color: c.color, weight: 3, dashArray: '6 8', interactive: false }).addTo(drawLayer);
  pts.forEach((p) => L.marker(p, { icon: L.divIcon({ className: '', html: '<div class="vtx"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }), interactive: false }).addTo(drawLayer));
  const live = [...draw.coords, { lat: center.lat, lng: center.lng }];
  let stats = '';
  if (draw.kind === 'line') stats = `${draw.coords.length} Punkte · ${fmtLen(lineLength(draw.coords.length ? live : []))}`;
  else if (draw.kind === 'area') stats = `${draw.coords.length} Punkte · ${live.length >= 3 ? fmtArea(areaOf(live)) : '–'}`;
  else stats = 'Fadenkreuz auf die Stelle schieben';
  if (fix && draw.kind !== 'point') stats += ` · GPS ± ${fmtN(fix.acc)} m`;
  $('#drawTitle').textContent = draw.measure ? 'Messen' : `${draw.editId ? 'Neu einzeichnen: ' : ''}${c.label}`;
  $('#drawStats').textContent = stats;
  const undo = $('#dUndo'); if (undo) undo.disabled = !draw.coords.length;
  const done = $('#dDone'); if (done) done.disabled = draw.coords.length < (draw.kind === 'area' ? 3 : 2);
}
function finishDraw() {
  const d = draw;
  if (d.kind === 'line' && d.coords.length < 2) { toast('Mindestens 2 Punkte setzen'); return; }
  if (d.kind === 'area' && d.coords.length < 3) { toast('Mindestens 3 Punkte setzen'); return; }
  endDraw();
  if (d.measure) {
    toast(d.kind === 'area' ? `Fläche: ${fmtArea(areaOf(d.coords))}` : `Länge: ${fmtLen(lineLength(d.coords))}`, 8000);
    return;
  }
  if (d.editId) {
    const f = features.find((x) => x.id === d.editId);
    store.saveFeature(d.editId, { coords: d.coords, updatedAt: Date.now(), updatedBy: userName() });
    if (f) f.coords = d.coords;
    toast('Form gespeichert');
    openFeature(d.editId);
    return;
  }
  openSheet(viewForm({ kind: d.kind, cat: d.cat, coords: d.coords }));
}

// ---------- Sheet ----------
let stack = [];
let current = null;
let cleanup = null;
function showView(view) {
  if (cleanup) { try { cleanup(); } catch (e) { /* */ } cleanup = null; }
  current = view;
  const v = view();
  if (!v) { closeSheet(); return; }
  $('#sheetTitle').textContent = v.title;
  $('#sheetBody').innerHTML = v.html;
  $('#sheetBody').scrollTop = 0;
  $('#sheet').classList.toggle('tall', !!v.tall);
  $('#sheetBack').hidden = !stack.length;
  $('#sheet').hidden = false; $('#overlay').hidden = false;
  if (v.mount) cleanup = v.mount($('#sheetBody')) || null;
}
const openSheet = (v) => { stack = []; showView(v); };
const pushView = (v) => { if (current) stack.push(current); showView(v); };
const backView = () => (stack.length ? showView(stack.pop()) : closeSheet());
function closeSheet() {
  if (cleanup) { try { cleanup(); } catch (e) { /* */ } cleanup = null; }
  stack = []; current = null;
  $('#sheet').hidden = true; $('#overlay').hidden = true;
  if (selectedId) { selectedId = null; renderFeatures(); }
}

// ---------- Ansicht: Neu ----------
function viewNew() {
  const group = (kind) => `<div class="section-title">${KIND_LABEL[kind]}</div><div class="cats">${Object.entries(CATS).filter(([, c]) => c.kind === kind)
    .map(([k, c]) => `<button class="cat" data-cat="${k}">${sw(c)}${esc(c.label)}</button>`).join('')}</div>`;
  return {
    title: 'Was einzeichnen?',
    tall: true,
    html: `${group('point')}${group('line')}${group('area')}
      <div class="section-title">Werkzeug</div>
      <div class="cats"><button class="cat" data-measure="line"><span class="sw" style="background:#ff3b30">${svg('ruler')}</span>Strecke messen</button>
        <button class="cat" data-measure="area"><span class="sw" style="background:#ff3b30">${svg('area')}</span>Fläche messen</button></div>
      <p class="hint">Tipp: Schieb die Karte so, dass das rote Fadenkreuz genau auf der Stelle liegt, und tippe „Punkt setzen“. Oder geh hin und nimm die GPS-Position. Lange auf die Karte drücken setzt direkt einen Punkt.</p>`,
    mount(body) {
      $$('[data-cat]', body).forEach((b) => (b.onclick = () => startDraw({ kind: CATS[b.dataset.cat].kind, cat: b.dataset.cat })));
      $$('[data-measure]', body).forEach((b) => (b.onclick = () => startDraw({ kind: b.dataset.measure, cat: null, measure: true })));
    },
  };
}
function viewQuickPoint(latlng) {
  return () => ({
    title: 'Punkt hier einzeichnen',
    html: `<div class="cats">${Object.entries(CATS).filter(([, c]) => c.kind === 'point').map(([k, c]) => `<button class="cat" data-cat="${k}">${sw(c)}${esc(c.label)}</button>`).join('')}</div>
      <p class="hint">${coordText(latlng)}</p>`,
    mount(body) {
      $$('[data-cat]', body).forEach((b) => (b.onclick = () => pushView(viewForm({ kind: 'point', cat: b.dataset.cat, coords: [{ lat: latlng.lat, lng: latlng.lng }] }))));
    },
  });
}

// ---------- Ansicht: Formular ----------
function viewForm(f) {
  return () => {
    const isNew = !f.id;
    const c = CATS[f.cat];
    const catOpts = Object.entries(CATS).filter(([, x]) => x.kind === f.kind).map(([k, x]) => `<option value="${k}" ${k === f.cat ? 'selected' : ''}>${esc(x.label)}</option>`).join('');
    const showDepth = f.kind !== 'area';
    return {
      title: isNew ? `Neu: ${c.label}` : 'Bearbeiten',
      tall: true,
      html: `
        ${isNew && f.kind !== 'point' ? `<div class="note-box">${f.kind === 'line' ? 'Länge' : 'Fläche'}: <b>${measureText(f)}</b></div>` : ''}
        <label class="field"><span>Bezeichnung</span><input class="input" id="fTitle" value="${esc(f.title || '')}" placeholder="${esc(c.label)}" autocomplete="off"></label>
        <label class="field"><span>Art</span><select class="input" id="fCat">${catOpts}</select></label>
        <div class="grid2">
          ${showDepth ? `<label class="field"><span>Tiefe (cm)</span><input class="input num" id="fDepth" inputmode="numeric" value="${f.depth ?? ''}"></label>` : ''}
          <label class="field"><span>Baujahr / verlegt</span><input class="input num" id="fYear" inputmode="numeric" value="${esc(f.year || '')}"></label>
          ${f.kind !== 'area' ? `<label class="field"><span>Material</span><input class="input" id="fMat" value="${esc(f.material || '')}" placeholder="z. B. PE, Kupfer"></label>
          <label class="field"><span>Dimension</span><input class="input" id="fDim" value="${esc(f.dim || '')}" placeholder="z. B. DN 32, 5×16 mm²"></label>` : ''}
        </div>
        <label class="field"><span>Notizen</span><textarea class="input" id="fNote" rows="4" placeholder="z. B. Schieber unter dem Deckel neben dem Stadel, im Winter abdrehen">${esc(f.note || '')}</textarea></label>
        <button class="btn primary" id="fSave">Speichern</button>
        ${isNew ? '<p class="hint">Fotos kannst du nach dem Speichern hinzufügen.</p>' : ''}`,
      mount(body) {
        $('#fSave', body).onclick = () => {
          const cat = $('#fCat', body).value;
          const data = {
            kind: f.kind, cat, coords: f.coords,
            title: $('#fTitle', body).value.trim() || CATS[cat].label,
            depth: showDepth ? num($('#fDepth', body).value) : null,
            year: $('#fYear', body).value.trim(),
            material: f.kind !== 'area' ? $('#fMat', body).value.trim() : '',
            dim: f.kind !== 'area' ? $('#fDim', body).value.trim() : '',
            note: $('#fNote', body).value.trim(),
            updatedAt: Date.now(), updatedBy: userName(),
          };
          if (isNew) { data.createdAt = Date.now(); data.createdBy = userName(); data.photoCount = 0; }
          const id = f.id || store.newId();
          store.saveFeature(id, data);
          if (hidden.has(cat)) { hidden.delete(cat); LS('hofkarte_hidden', [...hidden]); }
          toast('Gespeichert');
          if (!features.some((x) => x.id === id)) features.push({ ...data, id });
          openFeature(id);
        };
      },
    };
  };
}

// ---------- Ansicht: Details ----------
function openFeature(id) {
  selectedId = id;
  renderFeatures();
  openSheet(viewDetail(id));
}
function viewDetail(id) {
  return () => {
    const f = features.find((x) => x.id === id);
    if (!f) return null;
    const c = catOf(f);
    const a = anchor(f);
    const rows = [];
    if (f.kind === 'line') rows.push(['Länge', fmtLen(lineLength(f.coords))]);
    if (f.kind === 'area') rows.push(['Fläche', fmtArea(areaOf(f.coords))]);
    if (f.depth != null && f.depth !== '') rows.push(['Tiefe', `${fmtN(f.depth)} cm`]);
    if (f.material) rows.push(['Material', esc(f.material)]);
    if (f.dim) rows.push(['Dimension', esc(f.dim)]);
    if (f.year) rows.push(['Baujahr', esc(f.year)]);
    if (fix) { const t = nearestPoint(f, fix); rows.push(['Von dir', `${fmtLen(dist(fix, t))} Richtung ${dirText(bearing(fix, t))}`]); }
    rows.push([f.kind === 'point' ? 'Koordinaten' : 'Mittelpunkt', coordText(a)]);
    if (f.createdAt) rows.push(['Eingetragen', `${fmtDate(f.createdAt)}${f.createdBy ? ` · ${esc(f.createdBy)}` : ''}`]);
    return {
      title: f.title || c.label,
      tall: true,
      html: `
        <div class="detail-head">${sw(c)}<div><h3>${esc(f.title || c.label)}</h3><small>${esc(c.label)}</small></div></div>
        <div class="btn-row">
          <button class="btn" id="dShow">${svg('eye')}Zeigen</button>
          <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}&travelmode=walking" target="_blank" rel="noopener">${svg('nav')}Hinführen</a>
          <button class="btn" id="dEdit">${svg('edit')}Bearbeiten</button>
        </div>
        <div class="card"><dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>
        ${f.note ? `<div class="card note">${esc(f.note)}</div>` : ''}
        <div class="section-title">Fotos</div>
        <div class="photos" id="dPhotos"><div class="ph"><div class="spinner" style="margin:30% auto"></div></div></div>
        <input type="file" id="dFile" accept="image/*" multiple hidden>
        <div class="section-title">Mehr</div>
        <button class="btn" id="dRedraw">${svg('line')}Lage neu einzeichnen</button>
        <button class="btn" id="dCopy">${svg('copy')}Koordinaten kopieren</button>
        <button class="btn danger" id="dDel">${svg('trash')}Löschen</button>`,
      mount(body) {
        let alive = true;
        $('#dShow', body).onclick = () => { zoomTo(f); selectedId = f.id; renderFeatures(); };
        $('#dEdit', body).onclick = () => pushView(viewForm(f));
        $('#dRedraw', body).onclick = () => startDraw({ kind: f.kind, cat: f.cat, editId: f.id });
        $('#dCopy', body).onclick = async () => {
          const txt = f.kind === 'point' ? coordText(a) : f.coords.map(coordText).join('\n');
          try { await navigator.clipboard.writeText(txt); toast('Koordinaten kopiert'); } catch (e) { toast(coordText(a)); }
        };
        $('#dDel', body).onclick = () => {
          if (!confirm(`„${f.title || c.label}“ wirklich löschen? Fotos werden auch gelöscht.`)) return;
          store.deleteFeature(f.id); features = features.filter((x) => x.id !== f.id);
          closeSheet(); renderFeatures(); toast('Gelöscht');
        };
        // Fotos
        const box = $('#dPhotos', body);
        let photos = [];
        const renderPhotos = () => {
          box.innerHTML = photos.map((p, i) => `<div class="ph"><img src="${p.data}" alt="" data-view="${i}" loading="lazy"><button class="del" data-pdel="${i}" aria-label="Foto löschen">${svg('x')}</button></div>`).join('')
            + `<button class="ph add" id="dAddPhoto" aria-label="Foto hinzufügen">${svg('camera')}</button>`;
          $$('[data-view]', box).forEach((im) => (im.onclick = () => { $('#viewerImg').src = photos[+im.dataset.view].data; $('#viewer').hidden = false; }));
          $$('[data-pdel]', box).forEach((b) => (b.onclick = async () => {
            if (!confirm('Foto löschen?')) return;
            const p = photos[+b.dataset.pdel];
            try { await store.deletePhoto(p.id); photos = photos.filter((x) => x !== p); renderPhotos(); store.saveFeature(f.id, { photoCount: photos.length }); } catch (e) { onStoreError(e); }
          }));
          $('#dAddPhoto', box).onclick = () => $('#dFile', body).click();
        };
        store.listPhotos(f.id).then((ps) => { if (alive) { photos = ps; renderPhotos(); } }).catch((e) => { if (alive) { renderPhotos(); onStoreError(e); } });
        $('#dFile', body).onchange = async (ev) => {
          const files = [...ev.target.files];
          ev.target.value = '';
          for (const file of files) {
            try {
              toast('Foto wird gespeichert …', 1500);
              const data = await fileToJpeg(file);
              const p = { featureId: f.id, data, createdAt: Date.now(), by: userName() };
              p.id = await store.addPhoto(p);
              photos.push(p);
              if (alive) renderPhotos();
              store.saveFeature(f.id, { photoCount: photos.length });
            } catch (e) {
              toast(e.code === 'quota' ? 'Speicher voll – im Demo-Modus passen nur wenige Fotos.' : 'Foto konnte nicht gespeichert werden.', 4000);
            }
          }
        };
        return () => { alive = false; };
      },
    };
  };
}

// Fotos verkleinern (passen so in die kostenlose Datenbank)
async function fileToJpeg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let max = 1280;
    for (let tries = 0; tries < 4; tries++) {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      for (let q = 0.75; q >= 0.45; q -= 0.1) {
        const d = cv.toDataURL('image/jpeg', q);
        if (d.length < 650000) return d;
      }
      max = Math.round(max * 0.75);
    }
    throw new Error('Foto zu groß');
  } finally { URL.revokeObjectURL(url); }
}

// ---------- Ansicht: Liste ----------
let listFilter = '';
let listQuery = '';
function viewList() {
  return () => ({
    title: `Alles am Hof (${features.length})`,
    tall: true,
    html: `
      <input class="input" id="lQ" type="search" placeholder="Suchen …" value="${esc(listQuery)}" style="margin-bottom:10px" autocomplete="off">
      <div class="chips" id="lChips">${[['', 'Alle'], ['point', 'Punkte'], ['line', 'Leitungen'], ['area', 'Flächen']].map(([k, l]) => `<button class="chip ${k === listFilter ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
      <div id="lItems"></div>
      <div class="section-title">Auf der Karte anzeigen</div>
      <div class="list">${Object.entries(CATS).filter(([k]) => features.some((f) => f.cat === k)).map(([k, c]) => `
        <label class="toggle"><span style="display:flex;align-items:center;gap:10px"><span class="chip" style="padding:0;box-shadow:none;background:none"><span class="dot" style="background:${c.color}"></span></span>${esc(c.label)}</span>
        <input type="checkbox" data-vis="${k}" ${hidden.has(k) ? '' : 'checked'}></label>`).join('') || '<div class="empty">Noch nichts eingezeichnet.</div>'}</div>`,
    mount(body) {
      const renderItems = () => {
        const q = listQuery.toLowerCase();
        let list = features.filter((f) => (!listFilter || f.kind === listFilter)
          && (!q || `${f.title} ${catOf(f).label} ${f.note || ''} ${f.material || ''}`.toLowerCase().includes(q)));
        if (fix) list = list.map((f) => ({ f, d: dist(fix, nearestPoint(f, fix)) })).sort((a, b) => a.d - b.d).map((x) => x.f);
        else list.sort((a, b) => (catOf(a).label + a.title).localeCompare(catOf(b).label + b.title, 'de'));
        $('#lItems', body).innerHTML = list.length ? `<div class="list">${list.map((f) => {
          const c = catOf(f);
          const sub = [c.label, measureText(f), f.photoCount ? `${f.photoCount} Foto${f.photoCount > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
          return `<button class="list-item" data-id="${esc(f.id)}">${sw(c)}<span class="info"><span class="name">${esc(f.title || c.label)}</span><small>${esc(sub)}</small></span>
            ${fix ? `<span class="val">${fmtLen(dist(fix, nearestPoint(f, fix)))}</span>` : ''}</button>`;
        }).join('')}</div>` : '<div class="empty">Nichts gefunden.</div>';
        $$('[data-id]', body).forEach((b) => (b.onclick = () => { const f = features.find((x) => x.id === b.dataset.id); zoomTo(f, true); openFeature(f.id); }));
      };
      $('#lQ', body).oninput = (e) => { listQuery = e.target.value; renderItems(); };
      $$('#lChips [data-k]', body).forEach((b) => (b.onclick = () => { listFilter = b.dataset.k; $$('#lChips .chip', body).forEach((x) => x.classList.toggle('on', x === b)); renderItems(); }));
      $$('[data-vis]', body).forEach((cb) => (cb.onchange = () => {
        if (cb.checked) hidden.delete(cb.dataset.vis); else hidden.add(cb.dataset.vis);
        LS('hofkarte_hidden', [...hidden]); renderFeatures();
      }));
      renderItems();
    },
  });
}

// ---------- Ansicht: Kartenebenen ----------
function viewLayers() {
  return {
    title: 'Kartenebenen',
    html: `
      <div class="section-title">Hintergrund</div>
      <div class="list">${Object.entries(BASES).map(([k, b]) => `<button class="radio-row" data-base="${k}">${esc(b.label)}${k === baseKey ? `<span class="check">${svg('check')}</span>` : ''}</button>`).join('')}</div>
      <div class="section-title">Anzeige</div>
      <div class="list">
        <label class="toggle"><span>Straßen- und Ortsnamen im Luftbild</span><input type="checkbox" id="lyStreet" ${showStreetLabels ? 'checked' : ''}></label>
        <label class="toggle"><span>Bezeichnungen der Einträge</span><input type="checkbox" id="lyLabels" ${showLabels ? 'checked' : ''}></label>
        ${wmsLayers.map((w) => `<label class="toggle"><span>${esc(w.name)}</span><input type="checkbox" data-wms="${w.i}" ${w.on ? 'checked' : ''}></label>`).join('')}
      </div>
      ${wmsLayers.length ? '' : '<p class="hint">Grundstücksgrenzen aus SAGIS lassen sich in <b>config.js</b> als zusätzliche Ebene eintragen (siehe Anleitung).</p>'}`,
    mount(body) {
      $$('[data-base]', body).forEach((b) => (b.onclick = () => { setBase(b.dataset.base); showView(viewLayers); }));
      $('#lyStreet', body).onchange = (e) => { showStreetLabels = e.target.checked; LS('hofkarte_streetlabels', showStreetLabels); updateLabelLayer(); };
      $('#lyLabels', body).onchange = (e) => { showLabels = e.target.checked; LS('hofkarte_labels', showLabels); renderFeatures(); };
      $$('[data-wms]', body).forEach((cb) => (cb.onchange = () => { const w = wmsLayers[+cb.dataset.wms]; w.on = cb.checked; LS(`hofkarte_wms_${w.i}`, w.on); updateWms(); }));
    },
  };
}

// ---------- Ansicht: Mehr ----------
function viewMore() {
  return {
    title: 'Mehr',
    html: `
      <div class="list">
        <button class="radio-row" id="mHome">${svg('home')} Hof-Mittelpunkt auf aktuelle Kartenansicht setzen</button>
        <button class="radio-row" id="mGeo">${svg('down')} Export für Google Earth (KML)</button>
        <button class="radio-row" id="mJson">${svg('down')} Export als GeoJSON (für GIS)</button>
      </div>
      <div class="section-title">Konto</div>
      <div class="card">${store.mode === 'demo'
        ? 'Demo-Modus: Alles bleibt nur auf diesem Gerät. Für gemeinsame Daten Firebase in <b>config.js</b> eintragen (siehe Anleitung).'
        : `Angemeldet als <b>${esc(user.email)}</b><button class="btn" id="mOut" style="margin-top:10px">Abmelden</button>`}</div>
      <p class="hint" style="text-align:center">Hof-Karte ${VERSION} · ${features.length} Einträge · ${esc(CFG.adresse || '')}</p>`,
    mount(body) {
      $('#mHome', body).onclick = () => {
        const c = map.getCenter();
        settings.center = { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
        store.saveSettings({ center: settings.center });
        toast('Hof-Mittelpunkt gespeichert'); closeSheet();
      };
      $('#mGeo', body).onclick = () => saveFile(`hofkarte-${new Date().toISOString().slice(0, 10)}.kml`, 'application/vnd.google-earth.kml+xml', toKml());
      $('#mJson', body).onclick = () => saveFile(`hofkarte-${new Date().toISOString().slice(0, 10)}.geojson`, 'application/geo+json', JSON.stringify(toGeoJson(), null, 1));
      const out = $('#mOut', body); if (out) out.onclick = () => store.signOut();
    },
  };
}

// ---------- Export ----------
function toGeoJson() {
  return {
    type: 'FeatureCollection',
    features: features.map((f) => {
      const cs = f.coords.map((c) => [+c.lng.toFixed(7), +c.lat.toFixed(7)]);
      const geometry = f.kind === 'point' ? { type: 'Point', coordinates: cs[0] }
        : f.kind === 'line' ? { type: 'LineString', coordinates: cs } : { type: 'Polygon', coordinates: [[...cs, cs[0]]] };
      return { type: 'Feature', geometry, properties: { titel: f.title, art: catOf(f).label, tiefe_cm: f.depth ?? null, material: f.material || '', dimension: f.dim || '', baujahr: f.year || '', notiz: f.note || '' } };
    }),
  };
}
function toKml() {
  const x = (s) => String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  const kmlColor = (hex, a = 'ff') => { const h = hex.replace('#', ''); return a + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2); };
  const styles = Object.entries(CATS).map(([k, c]) => `<Style id="${k}"><IconStyle><color>${kmlColor(c.color)}</color></IconStyle><LineStyle><color>${kmlColor(c.color)}</color><width>4</width></LineStyle><PolyStyle><color>${kmlColor(c.color, '55')}</color></PolyStyle></Style>`).join('');
  const marks = features.map((f) => {
    const cs = f.coords.map((c) => `${c.lng},${c.lat},0`).join(' ');
    const desc = [catOf(f).label, f.depth != null ? `Tiefe ${f.depth} cm` : '', f.material, f.dim, f.year, f.note].filter(Boolean).join('\n');
    const geom = f.kind === 'point' ? `<Point><coordinates>${cs}</coordinates></Point>`
      : f.kind === 'line' ? `<LineString><tessellate>1</tessellate><coordinates>${cs}</coordinates></LineString>`
        : `<Polygon><outerBoundaryIs><LinearRing><coordinates>${cs} ${f.coords[0].lng},${f.coords[0].lat},0</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
    return `<Placemark><name>${x(f.title)}</name><description>${x(desc)}</description><styleUrl>#${f.cat}</styleUrl>${geom}</Placemark>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(CFG.hofName || 'Hof-Karte')}</name>${styles}${marks}</Document></kml>`;
}
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
async function saveFile(name, mime, text) {
  const blob = new Blob([text], { type: mime });
  try {
    const file = new File([blob], name, { type: mime });
    if (isIOS() && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

// ---------- Login & Start ----------
function showLogin() {
  $('#boot').hidden = true; $('#app').hidden = true; $('#login').hidden = false;
  const err = $('#loginErr');
  $('#loginForm').onsubmit = async (ev) => {
    ev.preventDefault(); err.hidden = true; $('#loginBtn').disabled = true;
    try { await store.signIn($('#loginEmail').value.trim(), $('#loginPw').value); }
    catch (e) {
      const c = String(e.code || '');
      err.textContent = c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') ? 'E-Mail oder Passwort stimmt nicht.'
        : c.includes('too-many') ? 'Zu viele Versuche – warte kurz.' : c.includes('network') ? 'Keine Internetverbindung.' : `Anmeldung fehlgeschlagen (${c})`;
      err.hidden = false;
    } finally { $('#loginBtn').disabled = false; }
  };
  $('#forgotPw').onclick = async () => {
    const email = $('#loginEmail').value.trim();
    if (!email) { err.textContent = 'Gib zuerst deine E-Mail-Adresse ein.'; err.hidden = false; return; }
    try { await store.resetPassword(email); toast('E-Mail zum Zurücksetzen wurde gesendet'); } catch (e) { err.textContent = 'Konnte keine E-Mail senden.'; err.hidden = false; }
  };
}
let unsubs = [];
function startApp() {
  $('#boot').hidden = true; $('#login').hidden = true; $('#app').hidden = false;
  $('#hofName').textContent = CFG.hofName || 'Hof-Karte';
  if (!map) initMap(); else map.invalidateSize();
  unsubs.forEach((u) => u()); unsubs = [];
  let firstSettings = true;
  unsubs.push(store.watchSettings((s) => {
    settings = s || {};
    if (firstSettings && settings.center && settings.center.lat) { const h = settings.center; map.setView([h.lat, h.lng], h.zoom || 18); }
    firstSettings = false;
  }));
  unsubs.push(store.watchFeatures((list, meta) => {
    features = list.filter((f) => f && f.kind && Array.isArray(f.coords));
    $('#syncState').textContent = store.mode === 'demo' ? 'Demo-Modus – nur dieses Gerät'
      : meta.offline || !navigator.onLine ? `${features.length} Einträge · offline` : meta.pending ? 'Wird synchronisiert …' : `${features.length} Einträge · synchronisiert`;
    renderFeatures();
  }));
}
async function boot() {
  $('#fab').onclick = () => openSheet(viewNew);
  $('#btnList').onclick = () => openSheet(viewList());
  $('#btnLayers').onclick = () => openSheet(viewLayers);
  $('#btnMore').onclick = () => openSheet(viewMore);
  $('#btnHome').onclick = () => { const h = homeView(); map.setView([h.lat, h.lng], h.zoom || 18); };
  $('#btnLocate').onclick = () => { if (watchId !== null && fix) map.setView([fix.lat, fix.lng], Math.max(map.getZoom(), 18)); else if (watchId !== null) stopGps(); else startGps(true); };
  $('#btnLocate').oncontextmenu = (e) => { e.preventDefault(); stopGps(); };
  $('#sheetClose').onclick = closeSheet;
  $('#sheetBack').onclick = backView;
  $('#overlay').onclick = closeSheet;
  $('#viewerClose').onclick = () => { $('#viewer').hidden = true; };
  $('#viewer').onclick = (e) => { if (e.target.id === 'viewer') $('#viewer').hidden = true; };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('#viewer').hidden) $('#viewer').hidden = true; else if (draw) endDraw(); else closeSheet(); } });
  if (typeof L === 'undefined') { $('#boot').innerHTML = '<div class="err-box" style="margin:20px">Kartenbibliothek fehlt (Ordner vendor/leaflet).</div>'; return; }
  try { store = await window.createHofStore(CFG, onStoreError); }
  catch (e) { $('#boot').innerHTML = '<div class="err-box" style="margin:20px">Die App konnte nicht starten. Beim ersten Start wird Internet benötigt.</div>'; return; }
  store.onAuth((u) => {
    user = u;
    if (u) startApp();
    else { unsubs.forEach((x) => x()); unsubs = []; closeSheet(); showLogin(); }
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
})();
