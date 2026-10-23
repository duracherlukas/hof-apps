/* Wandertagebuch – Wanderungen mit Fotos, GPS-Strecke und Statistik.
   Alle Daten bleiben auf dem Handy (IndexedDB). */
(() => {
'use strict';
const VERSION = '1.0';
const DEFAULT_CENTER = { lat: 47.405, lng: 12.90, zoom: 12 }; // Maria Alm

// ---------- Helfer ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const fmtN = (n, d = 0) => Number(n || 0).toLocaleString('de-AT', { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtKm = (km) => fmtN(km, km >= 100 ? 0 : 1);
const fmtDur = (min) => { if (!min) return '–'; const h = Math.floor(min / 60); const m = Math.round(min % 60); return `${h}:${String(m).padStart(2, '0')} h`; };
const parseDur = (s) => {
  s = String(s || '').trim().replace(/h|std\.?/gi, '').trim();
  if (!s) return null;
  const m = s.match(/^(\d+)\s*[:.,]\s*(\d{1,2})$/);
  if (m) return +m[1] * 60 + +m[2];
  const n = num(s);
  return n == null ? null : Math.round(n * 60);
};
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = (k, opts = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) => (k ? parseDay(k).toLocaleDateString('de-AT', opts) : '');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const starsTxt = (n) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '');
const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } return v; };

const WEATHER = { sonnig: ['☀️', 'Sonnig'], wolkig: ['⛅', 'Wolkig'], regen: ['🌧️', 'Regen'], schnee: ['❄️', 'Schnee'], nebel: ['🌫️', 'Nebel'] };
const DIFF = { leicht: ['🟢', 'Leicht'], mittel: ['🟡', 'Mittel'], schwer: ['🔴', 'Schwer'] };

const I = {
  boot: '<path d="M4 18h16v2H4zM6 18l1-9 4-1 2-4h3l-1 5 4 3v6"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  gps: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/>',
  dist: '<path d="M4 18c3-8 13-4 16-12"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="6" r="2"/>',
  up: '<path d="M3 20l6-9 4 5 3-4 5 8z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  share: '<path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  mountain: '<path d="M2 20l7-12 4 6 2-3 7 9z"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24">${I[k]}</svg>`;

// ---------- Datenbank (IndexedDB) ----------
let dbp = null;
function openDb() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('wandertagebuch', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('hikes', { keyPath: 'id' });
        const ph = d.createObjectStore('photos', { keyPath: 'id' });
        ph.createIndex('hikeId', 'hikeId');
        d.createObjectStore('state');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await openDb();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    const r = fn(s);
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('abgebrochen'));
  });
}
const DB = {
  all: (store) => tx(store, 'readonly', (s) => s.getAll()),
  get: (store, key) => tx(store, 'readonly', (s) => s.get(key)),
  put: (store, val, key) => tx(store, 'readwrite', (s) => (key === undefined ? s.put(val) : s.put(val, key))),
  del: (store, key) => tx(store, 'readwrite', (s) => s.delete(key)),
  photosOf: (hikeId) => tx('photos', 'readonly', (s) => s.index('hikeId').getAll(hikeId)),
  async delPhotosOf(hikeId) { const ps = await DB.photosOf(hikeId); for (const p of ps) await DB.del('photos', p.id); },
};

// ---------- Zustand ----------
let hikes = [];
let settings = { title: 'Mein Wandertagebuch' };
let tab = 'diary';
let statsYear = String(new Date().getFullYear());
const urlCache = new Map();
const photoUrl = (p, kind = 'thumb') => {
  const key = `${p.id}:${kind}`;
  if (!urlCache.has(key)) urlCache.set(key, URL.createObjectURL(kind === 'thumb' ? (p.thumb || p.full) : p.full));
  return urlCache.get(key);
};
const forgetPhoto = (id) => ['thumb', 'full'].forEach((k) => { const key = `${id}:${k}`; if (urlCache.has(key)) { URL.revokeObjectURL(urlCache.get(key)); urlCache.delete(key); } });
const sortedHikes = () => [...hikes].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
const yearOf = (h) => (h.date || '').slice(0, 4);

async function loadAll() {
  hikes = (await DB.all('hikes')) || [];
  const s = await DB.get('state', 'settings');
  if (s) settings = { ...settings, ...s };
}

// ---------- Toast ----------
let toastT;
function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }

// ---------- Geometrie ----------
const rad = (d) => (d * Math.PI) / 180;
function dist(a, b) {
  const R = 6371008.8;
  const dLat = rad(b[0] - a[0]); const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Punkte: [lat, lng, ele|null, timeMs|null]
function analyze(points, threshold = 4) {
  let m = 0; let up = 0; let down = 0; let ref = null; let maxEle = null; let minEle = null;
  points.forEach((p, i) => {
    if (i) m += dist(points[i - 1], p);
    const e = p[2];
    if (e == null || !Number.isFinite(e)) return;
    maxEle = maxEle == null ? e : Math.max(maxEle, e);
    minEle = minEle == null ? e : Math.min(minEle, e);
    if (ref == null) { ref = e; return; }
    if (e - ref >= threshold) { up += e - ref; ref = e; } else if (ref - e >= threshold) { down += ref - e; ref = e; }
  });
  const times = points.map((p) => p[3]).filter(Boolean);
  const durationMin = times.length > 1 ? Math.round((times[times.length - 1] - times[0]) / 60000) : null;
  return { km: m / 1000, up: Math.round(up), down: Math.round(down), maxEle: maxEle != null ? Math.round(maxEle) : null, minEle: minEle != null ? Math.round(minEle) : null, durationMin, start: times[0] || null };
}
function simplify(points, minDist = 5) {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) if (dist(out[out.length - 1], points[i]) >= minDist) out.push(points[i]);
  out.push(points[points.length - 1]);
  return out;
}
function parseGpx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Keine gültige GPX-Datei');
  let nodes = Array.from(doc.getElementsByTagName('trkpt'));
  if (!nodes.length) nodes = Array.from(doc.getElementsByTagName('rtept'));
  if (!nodes.length) throw new Error('Die Datei enthält keine Strecke');
  const pts = nodes.map((n) => {
    const ele = n.getElementsByTagName('ele')[0];
    const time = n.getElementsByTagName('time')[0];
    return [+n.getAttribute('lat'), +n.getAttribute('lon'), ele ? parseFloat(ele.textContent) : null, time ? Date.parse(time.textContent) || null : null];
  }).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  const nameEl = doc.querySelector('trk > name') || doc.querySelector('metadata > name') || doc.querySelector('rte > name');
  return { points: pts, name: nameEl ? nameEl.textContent.trim() : '' };
}
function toGpx(h) {
  const x = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const pts = (h.track || []).map((p) => `<trkpt lat="${p[0]}" lon="${p[1]}">${p[2] != null ? `<ele>${p[2]}</ele>` : ''}${p[3] ? `<time>${new Date(p[3]).toISOString()}</time>` : ''}</trkpt>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Wandertagebuch" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${x(h.title)}</name><trkseg>${pts}</trkseg></trk></gpx>`;
}

// ---------- Fotos ----------
async function loadImage(file) {
  const url = URL.createObjectURL(file);
  try { return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Bild nicht lesbar')); i.src = url; }); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
function toBlob(img, max, q) {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', q));
}
async function makePhoto(file, hikeId) {
  const img = await loadImage(file);
  const [full, thumb] = await Promise.all([toBlob(img, 1800, 0.82), toBlob(img, 480, 0.75)]);
  return { id: uid(), hikeId, full, thumb, createdAt: Date.now(), name: file.name || '' };
}

// ---------- Karten ----------
const BASES = {
  wander: { label: 'Wanderkarte', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', sub: 'abc', native: 17, attr: 'Karte: © <a href="https://opentopomap.org" target="_blank">OpenTopoMap</a> · Daten: © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>' },
  karte: { label: 'Straßenkarte', url: 'https://mapsneu.wien.gv.at/basemap/geolandbasemap/normal/google3857/{z}/{y}/{x}.png', native: 19, attr: '<a href="https://basemap.at" target="_blank">basemap.at</a>' },
  luftbild: { label: 'Luftbild', url: 'https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg', native: 19, attr: '<a href="https://basemap.at" target="_blank">basemap.at</a>' },
};
let baseKey = LS('wtb_base') || 'wander';
function baseLayer(key) {
  const b = BASES[key] || BASES.wander;
  return L.tileLayer(b.url, { subdomains: b.sub || 'abc', maxNativeZoom: b.native, maxZoom: 19, attribution: b.attr });
}
function makeMap(el, opts = {}) {
  const touch = matchMedia('(pointer: coarse)').matches;
  const map = L.map(el, { zoomControl: !touch, attributionControl: true, ...opts });
  map.attributionControl.setPrefix(false);
  let layer = baseLayer(baseKey).addTo(map);
  let errors = 0;
  const watchErr = () => {
    layer.on('tileerror', () => { errors += 1; if (errors === 12 && baseKey !== 'karte' && navigator.onLine) { map.removeLayer(layer); layer = baseLayer('karte').addTo(map); } });
  };
  watchErr();
  map.setBase = (key) => { baseKey = key; LS('wtb_base', key); map.removeLayer(layer); errors = 0; layer = baseLayer(key).addTo(map); watchErr(); };
  return map;
}
const trackColor = '#e0532c';

// ---------- Rendering der Hauptansichten ----------
let tabMap = null;
function render() {
  $('#appTitle').textContent = settings.title || 'Mein Wandertagebuch';
  $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
  if (tabMap) { tabMap.remove(); tabMap = null; }
  const v = $('#view');
  const total = hikes.length;
  $('#topSub').textContent = total ? `${total} ${total === 1 ? 'Wanderung' : 'Wanderungen'}` : '';
  if (tab === 'diary') { v.innerHTML = diaryHtml(); bindDiary(v); }
  else if (tab === 'map') { v.innerHTML = mapHtml(); bindMapTab(v); }
  else if (tab === 'stats') { v.innerHTML = statsHtml(); bindStats(v); }
  else { v.innerHTML = peaksHtml(); bindPeaks(v); }
}

function totals(list) {
  return list.reduce((t, h) => ({ n: t.n + 1, km: t.km + (h.km || 0), up: t.up + (h.up || 0), min: t.min + (h.durationMin || 0), peaks: t.peaks + (h.peak ? 1 : 0) }), { n: 0, km: 0, up: 0, min: 0, peaks: 0 });
}

function hikeCardHtml(h) {
  return `<button class="hike" data-hike="${esc(h.id)}">
    ${h.coverId ? `<img class="cover" data-cover="${esc(h.coverId)}" alt="">` : `<div class="nocover">${svg('mountain')}</div>`}
    <div class="body">
      <div class="date">${esc(fmtDate(h.date))}${h.rating ? ` · <span class="stars">${starsTxt(h.rating)}</span>` : ''}</div>
      <h3>${esc(h.title || 'Wanderung')}</h3>
      <div class="facts">
        ${h.km ? `<span>${svg('dist')}${fmtKm(h.km)} km</span>` : ''}
        ${h.up ? `<span>${svg('up')}${fmtN(h.up)} Hm</span>` : ''}
        ${h.durationMin ? `<span>${svg('clock')}${fmtDur(h.durationMin)}</span>` : ''}
        ${h.weather && WEATHER[h.weather] ? `<span>${WEATHER[h.weather][0]}</span>` : ''}
      </div>
    </div></button>`;
}
function diaryHtml() {
  const y = String(new Date().getFullYear());
  const t = totals(hikes.filter((h) => yearOf(h) === y));
  const list = sortedHikes();
  let html = `
    <div class="card year-card"><div class="yl">Mein Wanderjahr ${y}</div>
      <div class="stats4"><div><b class="num">${t.n}</b><small>Touren</small></div><div><b class="num">${fmtKm(t.km)}</b><small>km</small></div>
      <div><b class="num">${fmtN(t.up)}</b><small>Höhenmeter</small></div><div><b class="num">${t.peaks}</b><small>Gipfel</small></div></div></div>
    <div class="start-row">
      <button class="big-btn" id="bNew"><span class="ic">${svg('pen')}</span><b>Eintragen</b><small>Wanderung nachträglich ins Tagebuch schreiben</small></button>
      <button class="big-btn rec-btn" id="bRec"><span class="ic">${svg('gps')}</span><b>Aufzeichnen</b><small>Jetzt losgehen – Strecke wird per GPS mitgeschrieben</small></button>
    </div>`;
  if (!list.length) {
    html += '<div class="empty"><span class="big">🥾</span>Noch keine Wanderungen.<br>Tipp auf „Eintragen“ oder nimm die nächste Tour mit „Aufzeichnen“ auf.</div>';
    return html;
  }
  let lastYear = null;
  list.forEach((h) => {
    const yy = yearOf(h);
    if (yy !== lastYear) { html += `<div class="section-title">${esc(yy)}</div>`; lastYear = yy; }
    html += hikeCardHtml(h);
  });
  return html;
}
async function fillCovers(root) {
  for (const img of $$('img[data-cover]', root)) {
    try { const p = await DB.get('photos', img.dataset.cover); if (p) img.src = photoUrl(p, 'thumb'); } catch (e) { /* */ }
  }
}
function bindDiary(v) {
  $('#bNew', v).onclick = () => openSheet(viewForm(null));
  $('#bRec', v).onclick = () => startRecording();
  $$('[data-hike]', v).forEach((b) => (b.onclick = () => openSheet(viewDetail(b.dataset.hike))));
  fillCovers(v);
}

function mapHtml() {
  return `<div class="map-tools">${Object.entries(BASES).map(([k, b]) => `<button class="chip ${k === baseKey ? 'on' : ''}" data-base="${k}">${b.label}</button>`).join('')}</div>
    <div class="map-full" id="tabMapEl"></div>
    ${hikes.length ? '' : '<p class="hint">Hier erscheinen alle Wanderungen auf der Karte.</p>'}`;
}
function bindMapTab(v) {
  tabMap = makeMap($('#tabMapEl', v));
  const bounds = [];
  hikes.forEach((h) => {
    let layer = null;
    if (h.track && h.track.length > 1) {
      layer = L.polyline(h.track.map((p) => [p[0], p[1]]), { color: trackColor, weight: 4, opacity: 0.9 });
      h.track.forEach((p) => bounds.push([p[0], p[1]]));
    } else if (h.loc) {
      layer = L.marker([h.loc.lat, h.loc.lng], { icon: L.divIcon({ className: '', html: '<div class="pinw"></div>', iconSize: [30, 30], iconAnchor: [4, 30] }) });
      bounds.push([h.loc.lat, h.loc.lng]);
    }
    if (layer) {
      layer.bindTooltip(`${esc(h.title)} · ${esc(fmtDate(h.date, { day: 'numeric', month: 'short', year: 'numeric' }))}`);
      layer.on('click', () => openSheet(viewDetail(h.id)));
      layer.addTo(tabMap);
    }
  });
  if (bounds.length) tabMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  else tabMap.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_CENTER.zoom);
  $$('[data-base]', v).forEach((b) => (b.onclick = () => { tabMap.setBase(b.dataset.base); $$('[data-base]', v).forEach((x) => x.classList.toggle('on', x === b)); }));
}

function statsHtml() {
  const years = [...new Set(hikes.map(yearOf).filter(Boolean))].sort().reverse();
  if (!years.includes(String(new Date().getFullYear()))) years.unshift(String(new Date().getFullYear()));
  const list = statsYear === 'alle' ? hikes : hikes.filter((h) => yearOf(h) === statsYear);
  const t = totals(list);
  const months = Array.from({ length: 12 }, (_, i) => list.filter((h) => +h.date.slice(5, 7) === i + 1).reduce((s, h) => s + (h.km || 0), 0));
  const maxM = Math.max(...months, 1);
  const best = (key) => list.filter((h) => h[key]).sort((a, b) => b[key] - a[key])[0];
  const longest = best('km'); const most = best('up'); const highest = best('peakHeight'); const dur = best('durationMin');
  const fav = list.filter((h) => h.rating === 5).length;
  const recRow = (ic, label, h, val) => (h ? `<button class="rec-row" data-hike="${esc(h.id)}"><span class="ic">${ic}</span><span class="info"><b>${val}</b><small>${label} · ${esc(h.title)}, ${esc(fmtDate(h.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</small></span></button>` : '');
  return `
    <div class="chips">${years.map((y) => `<button class="chip ${y === statsYear ? 'on' : ''}" data-year="${y}">${y}</button>`).join('')}<button class="chip ${statsYear === 'alle' ? 'on' : ''}" data-year="alle">Alle Jahre</button></div>
    <div class="card"><div class="stats4">
      <div><b class="num">${t.n}</b><small>Touren</small></div><div><b class="num">${fmtKm(t.km)}</b><small>km</small></div>
      <div><b class="num">${fmtN(t.up)}</b><small>Höhenmeter</small></div><div><b class="num">${Math.round(t.min / 60)}</b><small>Stunden</small></div></div>
      ${t.up ? `<p class="hint" style="margin:12px 0 0;text-align:center">Das sind ${fmtN(t.up / 8849, 1)}× der Mount Everest 🏔️</p>` : ''}</div>
    ${statsYear !== 'alle' ? `<div class="card"><h2>Kilometer pro Monat</h2><div class="bars">${months.map((m, i) => `<div title="${fmtKm(m)} km"><i class="${m ? '' : 'zero'}" style="height:${Math.max(2, (m / maxM) * 100)}%"></i>${'JFMAMJJASOND'[i]}</div>`).join('')}</div></div>` : ''}
    ${list.length ? `<div class="card records"><h2>Rekorde</h2>
      ${recRow('📏', 'Längste Tour', longest, longest ? `${fmtKm(longest.km)} km` : '')}
      ${recRow('⛰️', 'Meiste Höhenmeter', most, most ? `${fmtN(most.up)} Hm` : '')}
      ${recRow('🏔️', 'Höchster Gipfel', highest, highest ? `${esc(highest.peak || highest.title)} · ${fmtN(highest.peakHeight)} m` : '')}
      ${recRow('⏱️', 'Längste Dauer', dur, dur ? fmtDur(dur.durationMin) : '')}
      ${fav ? `<div class="rec-row"><span class="ic">⭐</span><span class="info"><b>${fav} Lieblingstouren</b><small>mit 5 Sternen bewertet</small></span></div>` : ''}
    </div>` : '<div class="empty">In diesem Zeitraum gibt es noch keine Wanderungen.</div>'}`;
}
function bindStats(v) {
  $$('[data-year]', v).forEach((b) => (b.onclick = () => { statsYear = b.dataset.year; render(); }));
  $$('[data-hike]', v).forEach((b) => (b.onclick = () => openSheet(viewDetail(b.dataset.hike))));
}

function peaksHtml() {
  const map = new Map();
  hikes.filter((h) => h.peak).forEach((h) => {
    const key = h.peak.trim().toLowerCase();
    const cur = map.get(key) || { name: h.peak.trim(), height: null, count: 0, last: null, lastId: null };
    cur.count += 1;
    if (h.peakHeight) cur.height = Math.max(cur.height || 0, h.peakHeight);
    if (!cur.last || h.date > cur.last) { cur.last = h.date; cur.lastId = h.id; }
    map.set(key, cur);
  });
  const peaks = [...map.values()].sort((a, b) => (b.height || 0) - (a.height || 0) || a.name.localeCompare(b.name, 'de'));
  return `<div class="card"><h2>🏔️ Mein Gipfelbuch</h2><p class="muted" style="margin:0">${peaks.length ? `${peaks.length} verschiedene Gipfel, ${peaks.reduce((s, p) => s + p.count, 0)} Besteigungen` : 'Trag bei einer Wanderung einen Gipfel ein, dann erscheint er hier.'}</p></div>
    ${peaks.length ? `<div class="list">${peaks.map((p) => `<button class="peak" data-hike="${esc(p.lastId)}">
      <span class="info"><b>${esc(p.name)}</b><small>${p.count}× bestiegen · zuletzt ${esc(fmtDate(p.last, { day: 'numeric', month: 'short', year: 'numeric' }))}</small></span>
      ${p.height ? `<span class="h num">${fmtN(p.height)} m</span>` : ''}</button>`).join('')}</div>` : ''}`;
}
function bindPeaks(v) { $$('[data-hike]', v).forEach((b) => (b.onclick = () => openSheet(viewDetail(b.dataset.hike)))); }

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
  $('#sheetBack').hidden = !stack.length;
  $('#sheet').hidden = false; $('#overlay').hidden = false;
  document.body.style.overflow = 'hidden';
  if (v.mount) cleanup = v.mount($('#sheetBody')) || null;
}
const openSheet = (v) => { stack = []; showView(v); };
const pushView = (v) => { if (current) stack.push(current); showView(v); };
const backView = () => (stack.length ? showView(stack.pop()) : closeSheet());
function closeSheet() {
  if (cleanup) { try { cleanup(); } catch (e) { /* */ } cleanup = null; }
  stack = []; current = null;
  $('#sheet').hidden = true; $('#overlay').hidden = true;
  document.body.style.overflow = '';
}

// ---------- Ansicht: Details ----------
let viewerPhotos = [];
let viewerIdx = 0;
function openViewer(list, i) { viewerPhotos = list; viewerIdx = i; showViewerImg(); $('#viewer').hidden = false; }
function showViewerImg() {
  const p = viewerPhotos[viewerIdx];
  $('#viewerImg').src = photoUrl(p, 'full');
  $('#vPrev').hidden = viewerPhotos.length < 2; $('#vNext').hidden = viewerPhotos.length < 2;
}

function viewDetail(id) {
  return () => {
    const h = hikes.find((x) => x.id === id);
    if (!h) return null;
    const facts = [];
    if (h.km) facts.push([`${fmtKm(h.km)}`, 'km']);
    if (h.up) facts.push([`${fmtN(h.up)}`, 'Hm ↑']);
    if (h.durationMin) facts.push([fmtDur(h.durationMin).replace(' h', ''), 'Stunden']);
    if (h.peakHeight) facts.push([`${fmtN(h.peakHeight)}`, 'm Gipfel']);
    if (h.difficulty && DIFF[h.difficulty]) facts.push([DIFF[h.difficulty][0], DIFF[h.difficulty][1]]);
    if (h.weather && WEATHER[h.weather]) facts.push([WEATHER[h.weather][0], WEATHER[h.weather][1]]);
    const rows = [];
    if (h.peak) rows.push(['Gipfel', `${esc(h.peak)}${h.peakHeight ? ` (${fmtN(h.peakHeight)} m)` : ''}`]);
    if (h.start) rows.push(['Ausgangspunkt', esc(h.start)]);
    if (h.down) rows.push(['Abstieg', `${fmtN(h.down)} Hm`]);
    if (h.companions) rows.push(['Mit dabei', esc(h.companions)]);
    if (h.hut) rows.push(['Einkehr', esc(h.hut)]);
    return {
      title: h.title || 'Wanderung',
      html: `
        <div class="gallery" id="dGal"></div>
        <div class="muted">${esc(fmtDate(h.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</div>
        <h2 style="margin:2px 0 4px;font-size:24px">${esc(h.title || 'Wanderung')}</h2>
        ${h.rating ? `<div class="stars" style="font-size:22px;margin-bottom:10px">${starsTxt(h.rating)}</div>` : '<div style="height:8px"></div>'}
        ${facts.length ? `<div class="facts-grid">${facts.map(([a, b]) => `<div class="fact"><b class="num">${a}</b><small>${b}</small></div>`).join('')}</div>` : ''}
        ${h.track && h.track.length > 1 || h.loc ? '<div class="mini-map" id="dMap"></div>' : ''}
        ${rows.length ? `<div class="card"><dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>` : ''}
        ${h.note ? `<div class="card note">${esc(h.note)}</div>` : ''}
        <div class="btn-row">
          <button class="btn" id="dShare">${svg('share')}Teilen</button>
          <button class="btn" id="dEdit">${svg('edit')}Bearbeiten</button>
          ${h.track && h.track.length > 1 ? `<button class="btn" id="dGpx">${svg('down')}GPX</button>` : `<button class="btn" id="dPhotos">${svg('camera')}Fotos</button>`}
        </div>`,
      mount(body) {
        let map = null;
        let photos = [];
        (async () => {
          photos = (await DB.photosOf(h.id)).sort((a, b) => (a.id === h.coverId ? -1 : b.id === h.coverId ? 1 : a.createdAt - b.createdAt));
          const gal = $('#dGal', body);
          if (!gal) return;
          if (!photos.length) { gal.remove(); return; }
          gal.innerHTML = photos.map((p, i) => `<img src="${photoUrl(p, 'full')}" data-i="${i}" alt="Foto ${i + 1}">`).join('');
          $$('img', gal).forEach((im) => (im.onclick = () => openViewer(photos, +im.dataset.i)));
        })();
        const mEl = $('#dMap', body);
        if (mEl) {
          setTimeout(() => {
            map = makeMap(mEl, { scrollWheelZoom: false });
            if (h.track && h.track.length > 1) {
              const ll = h.track.map((p) => [p[0], p[1]]);
              L.polyline(ll, { color: trackColor, weight: 5 }).addTo(map);
              L.circleMarker(ll[0], { radius: 7, color: '#fff', weight: 3, fillColor: '#2f6d5a', fillOpacity: 1 }).addTo(map).bindTooltip('Start');
              L.circleMarker(ll[ll.length - 1], { radius: 7, color: '#fff', weight: 3, fillColor: trackColor, fillOpacity: 1 }).addTo(map).bindTooltip('Ziel');
              map.fitBounds(ll, { padding: [20, 20] });
            } else {
              L.marker([h.loc.lat, h.loc.lng], { icon: L.divIcon({ className: '', html: '<div class="pinw"></div>', iconSize: [30, 30], iconAnchor: [4, 30] }) }).addTo(map);
              map.setView([h.loc.lat, h.loc.lng], 13);
            }
          }, 60);
        }
        $('#dEdit', body).onclick = () => pushView(viewForm(h));
        const g = $('#dGpx', body);
        if (g) g.onclick = () => saveFile(`${(h.title || 'wanderung').replace(/[^\wäöüÄÖÜß-]+/g, '_')}.gpx`, 'application/gpx+xml', toGpx(h));
        const ph = $('#dPhotos', body); if (ph) ph.onclick = () => pushView(viewForm(h));
        $('#dShare', body).onclick = () => shareHike(h, photos);
        return () => { if (map) map.remove(); };
      },
    };
  };
}
async function shareHike(h, photos) {
  const parts = [`🥾 ${h.title}${h.peak && h.peak !== h.title ? ` (${h.peak}${h.peakHeight ? `, ${fmtN(h.peakHeight)} m` : ''})` : ''}`, fmtDate(h.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })];
  const f = [h.km ? `${fmtKm(h.km)} km` : '', h.up ? `${fmtN(h.up)} Hm` : '', h.durationMin ? fmtDur(h.durationMin) : ''].filter(Boolean).join(' · ');
  if (f) parts.push(f);
  if (h.rating) parts.push(starsTxt(h.rating));
  if (h.note) parts.push('', h.note.length > 400 ? h.note.slice(0, 400) + ' …' : h.note);
  const text = parts.join('\n');
  try {
    const files = photos.slice(0, 6).map((p, i) => new File([p.full], `wanderung-${i + 1}.jpg`, { type: 'image/jpeg' }));
    if (files.length && navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, text }); return; }
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Text kopiert – jetzt z. B. in WhatsApp einfügen'); } catch (e) { toast('Teilen nicht möglich'); }
}

// ---------- Ansicht: Formular ----------
let unsavedNewId = null;
function viewForm(existing, preset) {
  return () => {
    const isNew = !existing;
    const h = existing ? { ...existing } : { id: uid(), date: dayKey(), title: '', rating: 0, ...(preset || {}) };
    if (isNew && !preset) unsavedNewId = h.id;
    let draftTrack = h.track || null;
    let draftLoc = h.loc || null;
    let rating = h.rating || 0;
    let weather = h.weather || '';
    let difficulty = h.difficulty || '';
    let coverId = h.coverId || null;
    const segHtml = (obj, val, attr) => `<div class="seg">${Object.entries(obj).map(([k, [e, l]]) => `<button type="button" data-${attr}="${k}" class="${k === val ? 'on' : ''}"><span class="e">${e}</span>${l}</button>`).join('')}</div>`;
    return {
      title: isNew ? 'Neue Wanderung' : 'Bearbeiten',
      html: `
        ${preset && preset.fromRec ? '<div class="note-box">Die Aufzeichnung ist gespeichert. Gib der Wanderung noch einen Namen und füge Fotos dazu.</div>' : ''}
        <label class="field"><span>Wohin ging's?</span><input class="input" id="fTitle" value="${esc(h.title)}" placeholder="z. B. Rund um den Hundstein" autocomplete="off"></label>
        <label class="field"><span>Datum</span><input class="input" id="fDate" type="date" value="${esc(h.date)}"></label>
        <div class="grid2">
          <label class="field"><span>Gipfel / höchster Punkt</span><input class="input" id="fPeak" value="${esc(h.peak || '')}" placeholder="z. B. Hundstein" autocomplete="off"></label>
          <label class="field"><span>Höhe (m)</span><input class="input num" id="fPeakH" inputmode="numeric" value="${h.peakHeight || ''}"></label>
        </div>
        <label class="field"><span>Ausgangspunkt</span><input class="input" id="fStart" value="${esc(h.start || '')}" placeholder="z. B. Parkplatz Hinterthal" autocomplete="off"></label>
        <div class="grid3">
          <label class="field"><span>Strecke (km)</span><input class="input num" id="fKm" inputmode="decimal" value="${h.km ? fmtN(h.km, 1).replace(/\s/g, '') : ''}"></label>
          <label class="field"><span>Höhenmeter</span><input class="input num" id="fUp" inputmode="numeric" value="${h.up || ''}"></label>
          <label class="field"><span>Dauer (Std:Min)</span><input class="input num" id="fDur" inputmode="decimal" value="${h.durationMin ? `${Math.floor(h.durationMin / 60)}:${pad(h.durationMin % 60)}` : ''}" placeholder="4:30"></label>
        </div>
        <div class="field"><span>Wie hat's gefallen?</span><div class="star-input" id="fStars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" class="${n <= rating ? 'on' : ''}" aria-label="${n} Sterne">★</button>`).join('')}</div></div>
        <div class="field"><span>Wetter</span>${segHtml(WEATHER, weather, 'w')}</div>
        <div class="field"><span>Schwierigkeit</span>${segHtml(DIFF, difficulty, 'd')}</div>
        <label class="field"><span>Mit wem?</span><input class="input" id="fWho" value="${esc(h.companions || '')}" placeholder="z. B. mit Papa und Lukas" autocomplete="off"></label>
        <label class="field"><span>Einkehr / Hütte</span><input class="input" id="fHut" value="${esc(h.hut || '')}" placeholder="z. B. Statzerhaus – Kaspressknödel 😋" autocomplete="off"></label>
        <label class="field"><span>Mein Tagebuch</span><textarea class="input" id="fNote" rows="5" placeholder="Wie war's? Was hast du gesehen? Blumen, Tiere, Ausblick …">${esc(h.note || '')}</textarea></label>

        <div class="field"><span>Fotos</span><div class="photo-grid" id="fPhotos"></div>
          <input type="file" id="fFiles" accept="image/*" multiple hidden></div>

        <div class="field"><span>Strecke</span><div id="fTrack"></div>
          <input type="file" id="fGpx" accept=".gpx,application/gpx+xml,application/xml,text/xml" hidden></div>

        <button class="btn primary" id="fSave">Speichern</button>
        ${isNew ? '' : `<button class="btn danger" id="fDel">${svg('trash')}Wanderung löschen</button>`}`,
      mount(body) {
        let saved = false;
        let pickMap = null;
        // Sterne, Wetter, Schwierigkeit
        $$('[data-star]', body).forEach((b) => (b.onclick = () => {
          rating = +b.dataset.star === rating ? 0 : +b.dataset.star;
          $$('[data-star]', body).forEach((x) => x.classList.toggle('on', +x.dataset.star <= rating));
        }));
        $$('[data-w]', body).forEach((b) => (b.onclick = () => { weather = weather === b.dataset.w ? '' : b.dataset.w; $$('[data-w]', body).forEach((x) => x.classList.toggle('on', x.dataset.w === weather)); }));
        $$('[data-d]', body).forEach((b) => (b.onclick = () => { difficulty = difficulty === b.dataset.d ? '' : b.dataset.d; $$('[data-d]', body).forEach((x) => x.classList.toggle('on', x.dataset.d === difficulty)); }));

        // Fotos
        let photos = [];
        const grid = $('#fPhotos', body);
        const renderPhotos = () => {
          if (!coverId && photos.length) coverId = photos[0].id;
          grid.innerHTML = photos.map((p) => `<div class="ph"><img src="${photoUrl(p, 'thumb')}" data-cover="${esc(p.id)}" alt="">
            ${p.id === coverId ? '<span class="cov">Titelbild</span>' : ''}
            <button type="button" class="del" data-pdel="${esc(p.id)}" aria-label="Foto entfernen">${svg('x')}</button></div>`).join('')
            + `<button type="button" class="ph add" id="fAddPh">${svg('camera')}<span>Fotos dazu</span></button>`;
          $('#fAddPh', grid).onclick = () => $('#fFiles', body).click();
          $$('img[data-cover]', grid).forEach((im) => (im.onclick = () => { coverId = im.dataset.cover; renderPhotos(); toast('Als Titelbild gewählt'); }));
          $$('[data-pdel]', grid).forEach((b) => (b.onclick = async () => {
            if (!confirm('Dieses Foto entfernen?')) return;
            await DB.del('photos', b.dataset.pdel); forgetPhoto(b.dataset.pdel);
            photos = photos.filter((p) => p.id !== b.dataset.pdel);
            if (coverId === b.dataset.pdel) coverId = photos[0] ? photos[0].id : null;
            renderPhotos();
          }));
        };
        DB.photosOf(h.id).then((ps) => { photos = ps.sort((a, b) => a.createdAt - b.createdAt); renderPhotos(); });
        $('#fFiles', body).onchange = async (ev) => {
          const files = [...ev.target.files];
          ev.target.value = '';
          if (!files.length) return;
          toast(files.length === 1 ? 'Foto wird hinzugefügt …' : `${files.length} Fotos werden hinzugefügt …`, 2000);
          for (const f of files) {
            try { const p = await makePhoto(f, h.id); await DB.put('photos', p); photos.push(p); renderPhotos(); }
            catch (e) { toast('Ein Foto konnte nicht gespeichert werden (Speicher voll?)', 4000); }
          }
        };

        // Strecke
        const trackBox = $('#fTrack', body);
        const renderTrack = () => {
          if (pickMap) { pickMap.remove(); pickMap = null; }
          if (draftTrack && draftTrack.length > 1) {
            const a = analyze(draftTrack);
            trackBox.innerHTML = `<div class="note-box">✅ GPS-Strecke gespeichert: ${fmtKm(a.km)} km${a.up ? `, ${fmtN(a.up)} Hm` : ''}${a.maxEle ? `, höchster Punkt ${fmtN(a.maxEle)} m` : ''}</div>
              <button type="button" class="btn" id="fGpxBtn">${svg('file')}Andere GPX-Datei laden</button>
              <button type="button" class="btn danger" id="fTrackDel">Strecke entfernen</button>`;
            $('#fTrackDel', body).onclick = () => { if (confirm('Strecke entfernen?')) { draftTrack = null; renderTrack(); } };
          } else {
            trackBox.innerHTML = `<p class="hint" style="margin-top:0">Tipp auf die Karte, um den Ort der Wanderung zu markieren – oder lade eine GPX-Datei (z. B. aus Bergfex, Komoot oder Outdooractive).</p>
              <div class="pick-map" id="fPick"></div>
              <button type="button" class="btn" id="fGpxBtn">${svg('file')}GPX-Datei laden</button>`;
            setTimeout(() => {
              const el = $('#fPick', body);
              if (!el) return;
              pickMap = makeMap(el, { scrollWheelZoom: false });
              let marker = null;
              const setM = (ll) => {
                draftLoc = { lat: ll.lat, lng: ll.lng };
                if (marker) marker.setLatLng(ll);
                else marker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="pinw"></div>', iconSize: [30, 30], iconAnchor: [4, 30] }) }).addTo(pickMap);
              };
              const c = draftLoc || LS('wtb_lastloc') || DEFAULT_CENTER;
              pickMap.setView([c.lat, c.lng], draftLoc ? 13 : (c.zoom || 12));
              if (draftLoc) setM(L.latLng(draftLoc.lat, draftLoc.lng));
              pickMap.on('click', (e) => setM(e.latlng));
            }, 60);
          }
          $('#fGpxBtn', body).onclick = () => $('#fGpx', body).click();
        };
        renderTrack();
        $('#fGpx', body).onchange = async (ev) => {
          const f = ev.target.files[0];
          ev.target.value = '';
          if (!f) return;
          try {
            const { points, name } = parseGpx(await f.text());
            draftTrack = simplify(points);
            const a = analyze(points);
            const setIfEmpty = (id, val) => { const el = $(id, body); if (el && !el.value && val) el.value = val; };
            setIfEmpty('#fTitle', name);
            setIfEmpty('#fKm', fmtN(a.km, 1).replace(/\s/g, ''));
            setIfEmpty('#fUp', a.up || '');
            if (a.durationMin) setIfEmpty('#fDur', `${Math.floor(a.durationMin / 60)}:${pad(a.durationMin % 60)}`);
            if (a.maxEle) setIfEmpty('#fPeakH', a.maxEle);
            if (a.start) $('#fDate', body).value = dayKey(new Date(a.start));
            h.down = a.down;
            renderTrack();
            toast(`Strecke geladen: ${fmtKm(a.km)} km, ${fmtN(a.up)} Hm`);
          } catch (e) { toast(e.message || 'Datei konnte nicht gelesen werden', 4000); }
        };

        $('#fSave', body).onclick = async () => {
          const title = $('#fTitle', body).value.trim();
          if (!title) { toast('Bitte schreib dazu, wohin es ging'); $('#fTitle', body).focus(); return; }
          const data = {
            ...h, title, date: $('#fDate', body).value || dayKey(),
            peak: $('#fPeak', body).value.trim(), peakHeight: num($('#fPeakH', body).value),
            start: $('#fStart', body).value.trim(),
            km: num($('#fKm', body).value), up: num($('#fUp', body).value), durationMin: parseDur($('#fDur', body).value),
            rating, weather, difficulty,
            companions: $('#fWho', body).value.trim(), hut: $('#fHut', body).value.trim(), note: $('#fNote', body).value.trim(),
            track: draftTrack, loc: draftTrack ? null : draftLoc, coverId: photos.some((p) => p.id === coverId) ? coverId : (photos[0] ? photos[0].id : null),
            updatedAt: Date.now(),
          };
          delete data.fromRec;
          if (!data.createdAt) data.createdAt = Date.now();
          try {
            await DB.put('hikes', data);
            saved = true; unsavedNewId = null;
            if (draftLoc) LS('wtb_lastloc', { ...draftLoc, zoom: 13 });
            const i = hikes.findIndex((x) => x.id === data.id);
            if (i >= 0) hikes[i] = data; else hikes.push(data);
            toast(isNew ? 'Ins Tagebuch eingetragen 🥾' : 'Gespeichert');
            render();
            openSheet(viewDetail(data.id));
          } catch (e) { toast('Speichern fehlgeschlagen – ist der Speicher voll?', 4000); }
        };
        const del = $('#fDel', body);
        if (del) del.onclick = async () => {
          if (!confirm(`„${h.title}“ wirklich löschen? Auch die Fotos werden gelöscht.`)) return;
          (await DB.photosOf(h.id)).forEach((p) => forgetPhoto(p.id));
          await DB.delPhotosOf(h.id); await DB.del('hikes', h.id);
          hikes = hikes.filter((x) => x.id !== h.id);
          saved = true; closeSheet(); render(); toast('Gelöscht');
        };
        return () => {
          if (pickMap) pickMap.remove();
          // Neuer Eintrag nicht gespeichert -> hinzugefügte Fotos wieder entfernen
          if (isNew && !saved && unsavedNewId === h.id) { DB.delPhotosOf(h.id).catch(() => {}); unsavedNewId = null; }
        };
      },
    };
  };
}

// ---------- Ansicht: Einstellungen ----------
function viewSettings() {
  return {
    title: 'Einstellungen',
    html: `
      <label class="field"><span>Name des Tagebuchs</span><input class="input" id="sTitle" value="${esc(settings.title)}"></label>
      <button class="btn primary" id="sSave">Speichern</button>
      <div class="section-title">Sicherung</div>
      <div class="warn-box">Alles ist nur auf diesem Handy gespeichert. Mach ab und zu eine Sicherung und schick sie dir z. B. per E-Mail oder speichere sie in der Cloud.</div>
      <button class="btn" id="sBackup">${svg('down')}Sicherung mit Fotos</button>
      <button class="btn" id="sBackupLite">${svg('down')}Sicherung ohne Fotos (klein)</button>
      <button class="btn" id="sImport">${svg('file')}Sicherung einspielen</button>
      <input type="file" id="sImportFile" accept="application/json,.json" hidden>
      <p class="hint" id="sStorage"></p>
      <div class="section-title">Hilfe</div>
      <div class="card" style="font-size:15px">
        <b>Als App aufs Handy:</b><br>
        iPhone: in Safari auf <b>Teilen</b> › <b>Zum Home-Bildschirm</b>.<br>
        Android: in Chrome auf <b>⋮</b> › <b>App installieren</b>.<br><br>
        <b>Aufzeichnen:</b> Die App muss dabei offen bleiben – der Bildschirm bleibt automatisch an. Handy einfach in die Jackentasche. Nach dem Beenden kannst du Fotos dazugeben.<br><br>
        <b>Fotos:</b> Beim Eintragen auf „Fotos dazu“ tippen und Bilder aus der Galerie wählen. Ein Foto antippen macht es zum Titelbild.
      </div>
      <p class="hint" style="text-align:center">Wandertagebuch ${VERSION}</p>`,
    mount(body) {
      $('#sSave', body).onclick = async () => {
        settings.title = $('#sTitle', body).value.trim() || 'Mein Wandertagebuch';
        await DB.put('state', settings, 'settings'); render(); toast('Gespeichert');
      };
      $('#sBackup', body).onclick = () => backup(true);
      $('#sBackupLite', body).onclick = () => backup(false);
      $('#sImport', body).onclick = () => $('#sImportFile', body).click();
      $('#sImportFile', body).onchange = async (ev) => {
        const f = ev.target.files[0]; ev.target.value = '';
        if (f) restore(f);
      };
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then((e) => { const el = $('#sStorage', body); if (el) el.textContent = `Belegt: ${fmtN((e.usage || 0) / 1048576, 1)} MB`; });
      }
    },
  };
}
const blobToDataUrl = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
const dataUrlToBlob = async (d) => (await fetch(d)).blob();
async function backup(withPhotos) {
  toast('Sicherung wird erstellt …', 2000);
  const out = { app: 'wandertagebuch', version: VERSION, created: new Date().toISOString(), settings, hikes, photos: [] };
  if (withPhotos) {
    for (const p of await DB.all('photos')) out.photos.push({ id: p.id, hikeId: p.hikeId, createdAt: p.createdAt, full: await blobToDataUrl(p.full), thumb: await blobToDataUrl(p.thumb) });
  }
  saveFile(`wandertagebuch-${dayKey()}${withPhotos ? '' : '-ohne-fotos'}.json`, 'application/json', JSON.stringify(out));
}
async function restore(file) {
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== 'wandertagebuch' || !Array.isArray(d.hikes)) throw new Error();
    if (!confirm(`${d.hikes.length} Wanderungen${d.photos && d.photos.length ? ` und ${d.photos.length} Fotos` : ''} einspielen? Gleiche Einträge werden überschrieben.`)) return;
    for (const h of d.hikes) await DB.put('hikes', h);
    for (const p of d.photos || []) await DB.put('photos', { id: p.id, hikeId: p.hikeId, createdAt: p.createdAt, full: await dataUrlToBlob(p.full), thumb: await dataUrlToBlob(p.thumb || p.full) });
    if (d.settings) { settings = { ...settings, ...d.settings }; await DB.put('state', settings, 'settings'); }
    await loadAll(); closeSheet(); render(); toast('Sicherung eingespielt');
  } catch (e) { toast('Diese Datei ist keine gültige Sicherung', 4000); }
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

// ---------- GPS-Aufzeichnung ----------
let rec = null;        // { points, startedAt, elapsed, resumedAt, paused }
let recWatch = null;
let recTimer = null;
let recMap = null;
let recLine = null;
let recMe = null;
let wakeLock = null;
let lastSave = 0;
let liveRef = null;   // Höhenbezug für Live-Höhenmeter
let recDirty = false;

async function keepAwake() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('screen'); } }
  catch (e) { /* nicht unterstützt */ }
}
const elapsedMs = () => (rec ? rec.elapsed + (rec.paused || !rec.resumedAt ? 0 : Date.now() - rec.resumedAt) : 0);
async function persistRec() { if (rec) { lastSave = Date.now(); recDirty = false; try { await DB.put('state', rec, 'rec'); } catch (e) { /* */ } } }

function startRecording(resume) {
  if (!('geolocation' in navigator)) { toast('Dieses Gerät kann keinen Standort bestimmen'); return; }
  if (!resume) rec = { points: [], startedAt: Date.now(), elapsed: 0, resumedAt: Date.now(), paused: false, up: 0, dist: 0 };
  liveRef = null;
  $('#rec').hidden = false;
  $('#rPause').textContent = rec.paused ? 'Weiter' : 'Pause';
  if (!recMap) recMap = makeMap($('#recMap'), { zoomControl: false });
  recMap.invalidateSize();
  const last = rec.points[rec.points.length - 1];
  const c = last ? { lat: last[0], lng: last[1] } : (LS('wtb_lastloc') || DEFAULT_CENTER);
  recMap.setView([c.lat, c.lng], 15);
  if (recLine) recLine.remove();
  recLine = L.polyline(rec.points.map((p) => [p[0], p[1]]), { color: trackColor, weight: 5 }).addTo(recMap);
  keepAwake();
  recWatch = navigator.geolocation.watchPosition(onPos, (err) => {
    $('#recStatus').textContent = err.code === 1 ? 'Standort nicht erlaubt – bitte in den Handy-Einstellungen erlauben' : 'Kein GPS-Signal …';
    $('#recStatus').classList.remove('ok');
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
  clearInterval(recTimer);
  recTimer = setInterval(updateRecUi, 1000);
  updateRecUi();
  persistRec();
}
function onPos(pos) {
  if (!rec) return;
  const { latitude: lat, longitude: lng, altitude, accuracy } = pos.coords;
  const ll = [lat, lng];
  if (!recMe) recMe = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false }).addTo(recMap);
  else recMe.setLatLng(ll);
  recMap.panTo(ll, { animate: true });
  const st = $('#recStatus');
  if (rec.paused) { st.textContent = 'Pausiert'; st.classList.remove('ok'); return; }
  if (accuracy > 35) { st.textContent = `GPS noch ungenau (± ${fmtN(accuracy)} m) …`; st.classList.remove('ok'); return; }
  st.textContent = `Aufnahme läuft · GPS ± ${fmtN(accuracy)} m`; st.classList.add('ok');
  const ele = altitude != null && Number.isFinite(altitude) ? Math.round(altitude) : null;
  const p = [lat, lng, ele, Date.now()];
  const prev = rec.points[rec.points.length - 1];
  if (prev && dist(prev, p) < Math.max(6, accuracy * 0.6)) { if (ele != null) $('#rAlt').textContent = fmtN(ele); return; }
  if (prev) rec.dist += dist(prev, p);
  if (ele != null) {
    if (liveRef == null) liveRef = ele;
    else if (ele - liveRef >= 5) { rec.up += ele - liveRef; liveRef = ele; } else if (liveRef - ele >= 5) liveRef = ele;
  }
  rec.points.push(p);
  recLine.addLatLng(ll);
  recDirty = true;
  if (Date.now() - lastSave > 5000) persistRec();
  updateRecUi(ele);
}
function updateRecUi(ele) {
  if (!rec) return;
  if (recDirty && Date.now() - lastSave > 3000) persistRec();
  const s = Math.floor(elapsedMs() / 1000);
  $('#rTime').textContent = `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  $('#rDist').textContent = fmtN(rec.dist / 1000, 1);
  $('#rUp').textContent = fmtN(rec.up);
  if (ele != null) $('#rAlt').textContent = fmtN(ele);
}
function stopWatching() {
  if (recWatch !== null) navigator.geolocation.clearWatch(recWatch);
  recWatch = null; clearInterval(recTimer);
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}
$('#rPause').onclick = () => {
  if (!rec) return;
  if (rec.paused) { rec.paused = false; rec.resumedAt = Date.now(); $('#rPause').textContent = 'Pause'; }
  else { rec.elapsed = elapsedMs(); rec.paused = true; $('#rPause').textContent = 'Weiter'; $('#recStatus').textContent = 'Pausiert'; $('#recStatus').classList.remove('ok'); }
  persistRec();
};
$('#rStop').onclick = async () => {
  if (!rec) return;
  if (!confirm('Wanderung beenden und speichern?')) return;
  const total = elapsedMs();
  stopWatching();
  const pts = simplify(rec.points);
  const a = analyze(pts, 5);
  const hike = {
    id: uid(), date: dayKey(new Date(rec.startedAt)), title: '', rating: 0,
    km: pts.length > 1 ? Math.round(a.km * 10) / 10 : null, up: rec.up ? Math.round(rec.up) : (a.up || null), down: a.down || null,
    durationMin: Math.round(total / 60000) || null, peakHeight: a.maxEle, track: pts.length > 1 ? pts : null,
    loc: pts.length === 1 ? { lat: pts[0][0], lng: pts[0][1] } : null, createdAt: Date.now(),
  };
  hike.title = `Wanderung am ${fmtDate(hike.date, { day: 'numeric', month: 'long' })}`;
  await DB.put('hikes', hike);
  hikes.push(hike);
  await DB.del('state', 'rec');
  if (pts.length) LS('wtb_lastloc', { lat: pts[pts.length - 1][0], lng: pts[pts.length - 1][1], zoom: 13 });
  rec = null;
  $('#rec').hidden = true;
  if (recMe) { recMe.remove(); recMe = null; }
  render();
  openSheet(viewForm(hike, { fromRec: true }));
};
window.addEventListener('pagehide', () => { if (rec) persistRec(); });
document.addEventListener('visibilitychange', () => {
  if (!rec) return;
  if (document.visibilityState === 'visible') keepAwake();
  else persistRec();
});

// ---------- Start ----------
async function boot() {
  $$('.tab').forEach((t) => (t.onclick = () => { tab = t.dataset.tab; render(); window.scrollTo(0, 0); }));
  $('#fab').onclick = () => openSheet(viewForm(null));
  $('#btnSettings').onclick = () => openSheet(viewSettings);
  $('#sheetClose').onclick = closeSheet;
  $('#sheetBack').onclick = backView;
  $('#overlay').onclick = closeSheet;
  $('#vClose').onclick = () => { $('#viewer').hidden = true; };
  $('#vPrev').onclick = () => { viewerIdx = (viewerIdx - 1 + viewerPhotos.length) % viewerPhotos.length; showViewerImg(); };
  $('#vNext').onclick = () => { viewerIdx = (viewerIdx + 1) % viewerPhotos.length; showViewerImg(); };
  let sx = null;
  $('#viewer').addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  $('#viewer').addEventListener('touchend', (e) => {
    if (sx == null || viewerPhotos.length < 2) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 50) { viewerIdx = (viewerIdx + (dx < 0 ? 1 : -1) + viewerPhotos.length) % viewerPhotos.length; showViewerImg(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('#viewer').hidden) $('#viewer').hidden = true; else closeSheet(); } });
  if (!('indexedDB' in window)) { $('#view').innerHTML = '<div class="warn-box">Dieser Browser kann keine Daten speichern. Bitte in Safari oder Chrome öffnen.</div>'; return; }
  try { await loadAll(); }
  catch (e) { $('#view').innerHTML = '<div class="warn-box">Der Speicher ist nicht verfügbar (privater Modus?). Bitte die Seite normal in Safari oder Chrome öffnen.</div>'; return; }
  render();
  // Laufende Aufzeichnung fortsetzen (z. B. nach versehentlichem Schließen)
  try {
    const r = await DB.get('state', 'rec');
    if (r && r.points) {
      rec = r; // Zeit läuft weiter, auch während die App zu war
      startRecording(true);
      toast('Aufzeichnung wird fortgesetzt', 3500);
    }
  } catch (e) { /* */ }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
})();
