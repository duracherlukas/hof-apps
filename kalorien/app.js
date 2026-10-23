/* Kalorien – Kalorien-Tracker mit KI-Foto, Barcode-Scan und Tagesbilanz.
   Alle Daten bleiben lokal im Browser (localStorage). */
'use strict';
(() => {

// ---------- Konstanten ----------
const STORE = 'kalorien_v1';
const VERSION = '1.0';
const MEALS = [
  { id: 'breakfast', name: 'Frühstück' },
  { id: 'lunch', name: 'Mittagessen' },
  { id: 'dinner', name: 'Abendessen' },
  { id: 'snack', name: 'Snacks' },
];
const MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash – genauer' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite – schneller, mehr Gratis-Anfragen' },
];
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';
const OFF = 'https://world.openfoodfacts.org';
const OFF_FIELDS = 'code,product_name,product_name_de,generic_name_de,brands,nutriments,serving_quantity,quantity,image_front_small_url';

const ACTIVITY = [
  [1.2, 'Kaum Bewegung (Bürojob, kein Sport)'],
  [1.375, 'Leicht aktiv (1–3× Sport pro Woche)'],
  [1.55, 'Aktiv (3–5× Sport oder Job auf den Beinen)'],
  [1.725, 'Sehr aktiv (körperliche Arbeit + Sport)'],
];
const GOALS = [
  [-500, 'Abnehmen (ca. 0,5 kg pro Woche)'],
  [-250, 'Langsam abnehmen'],
  [0, 'Gewicht halten'],
  [300, 'Zunehmen / Muskelaufbau'],
];

// Grundnahrungsmittel aus foods.js (Richtwerte pro 100 g bzw. 100 ml)
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
const CATEGORIES = Object.entries(window.FOODS || {}).map(([cat, list]) => ({
  name: cat,
  items: list.map(([name, unit, kcal, p, c, f, g, label, alias]) => ({
    name, unit, per100: { kcal, p, c, f }, servings: [{ label: `${label} (${g} ${unit})`, g }], src: 'db', cat,
    key: norm(`${name} ${alias || ''}`),
  })),
}));
const BASICS = CATEGORIES.flatMap((c) => c.items);
function matchFoods(term) {
  const words = norm(term).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const t = norm(term);
  return BASICS.filter((b) => words.every((w) => b.key.includes(w)))
    .map((b) => ({ b, score: norm(b.name).startsWith(t) ? 0 : norm(b.name).includes(t) ? 1 : 2 }))
    .sort((x, y) => x.score - y.score || x.b.name.localeCompare(y.b.name, 'de'))
    .map((x) => x.b);
}

const ICON = {
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  barcode: '<svg viewBox="0 0 24 24"><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M8 8v8M11 8v8M14 8v8M17 8v8"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  label: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path d="M5 6h14M5 11h14M5 16h9"/></svg>',
};

// ---------- Helfer ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
const fmt = (n) => Math.round(n || 0).toLocaleString('de-AT');
const fmtIn = (n) => String(Math.round((n || 0) * 10) / 10).replace('.', ',');
const fmt1 = (n) => (Math.round((n || 0) * 10) / 10).toLocaleString('de-AT', { maximumFractionDigits: 1 });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const dkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const todayKey = () => dkey(new Date());
const mealName = (id) => (MEALS.find((m) => m.id === id) || MEALS[3]).name;
const scale = (per100, g) => ({ kcal: per100.kcal * g / 100, p: per100.p * g / 100, c: per100.c * g / 100, f: per100.f * g / 100 });

function defaultMeal() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10.5) return 'breakfast';
  if (h < 14.5) return 'lunch';
  if (h < 17.5) return 'snack';
  return 'dinner';
}

// ---------- Speicher ----------
function defaults() {
  return {
    settings: {
      goal: 0,
      split: { c: 45, p: 25, f: 30 },
      profile: { sex: 'm', age: '', height: '', weight: '', activity: 1.375, goalType: 0 },
      apiKey: '',
      model: MODELS[0].id,
    },
    log: {},
    recent: [],
    custom: {},
  };
}
function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const d = JSON.parse(raw);
      const def = defaults();
      return {
        ...def, ...d,
        settings: { ...def.settings, ...(d.settings || {}), split: { ...def.settings.split, ...(d.settings?.split || {}) }, profile: { ...def.settings.profile, ...(d.settings?.profile || {}) } },
      };
    }
  } catch (e) { /* ignore */ }
  return defaults();
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(db)); }
  catch (e) { toast('Speichern fehlgeschlagen – Speicher voll?'); }
}

let db = load();
let day = todayKey();

// ---------- Berechnungen ----------
function goals() {
  const kcal = db.settings.goal || 0;
  const s = db.settings.split;
  return { kcal, c: kcal * s.c / 100 / 4, p: kcal * s.p / 100 / 4, f: kcal * s.f / 100 / 9 };
}
function entriesOf(k) { return db.log[k] || []; }
function totals(list) {
  return list.reduce((t, e) => ({ kcal: t.kcal + (e.kcal || 0), p: t.p + (e.p || 0), c: t.c + (e.c || 0), f: t.f + (e.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
}

// ---------- Einträge ----------
function addEntry(meal, item) {
  const entry = { id: uid(), meal, name: item.name || 'Lebensmittel', brand: item.brand || '', img: item.img || '', unit: item.unit || 'g',
    grams: item.grams || 0, per100: item.per100 || null, kcal: item.kcal || 0, p: item.p || 0, c: item.c || 0, f: item.f || 0,
    src: item.src || 'manual', barcode: item.barcode || '', t: Date.now() };
  (db.log[day] = db.log[day] || []).push(entry);
  remember(entry);
  save();
  render();
}
function updateEntry(id, changes) {
  const list = entriesOf(day);
  const i = list.findIndex((e) => e.id === id);
  if (i >= 0) { list[i] = { ...list[i], ...changes }; remember(list[i]); save(); render(); }
}
function deleteEntry(id) {
  db.log[day] = entriesOf(day).filter((e) => e.id !== id);
  if (!db.log[day].length) delete db.log[day];
  save();
  render();
}
function remember(e) {
  const key = (e.name + '|' + (e.brand || '')).toLowerCase();
  const rec = { name: e.name, brand: e.brand, img: e.img, unit: e.unit, grams: e.grams, per100: e.per100,
    kcal: e.kcal, p: e.p, c: e.c, f: e.f, src: e.src, barcode: e.barcode };
  db.recent = [rec, ...db.recent.filter((r) => (r.name + '|' + (r.brand || '')).toLowerCase() !== key)].slice(0, 40);
}

// ---------- Rendering Hauptseite ----------
function renderHeader() {
  const t = todayKey();
  const d = parseKey(day);
  const names = { [t]: 'Heute', [addDays(t, -1)]: 'Gestern', [addDays(t, 1)]: 'Morgen' };
  $('#dayTitle').textContent = names[day] || d.toLocaleDateString('de-AT', { weekday: 'long' });
  $('#daySub').textContent = d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'long' });
}

function renderSummary() {
  const g = goals();
  const t = totals(entriesOf(day));
  const el = $('#summary');
  if (!g.kcal) {
    el.innerHTML = `<div class="no-goal">
      <b>Willkommen!</b>
      <p>Leg zuerst dein Tagesziel fest – dann siehst du hier, wie viele Kalorien du noch übrig hast.</p>
      <button class="btn primary" id="setGoal">Tagesziel festlegen</button></div>`;
    $('#setGoal').onclick = () => openSheet(viewSettings);
    return;
  }
  const remaining = g.kcal - t.kcal;
  const over = remaining < 0;
  const C = 2 * Math.PI * 62;
  const pct = Math.min(t.kcal / g.kcal, 1);
  const macro = (cls, label, val, goal) => `
    <div class="macro ${cls}"><small>${label}</small>
      <div class="track"><div class="fill" style="width:${goal ? Math.min(val / goal * 100, 100) : 0}%"></div></div>
      <span class="num">${fmt(val)} / ${fmt(goal)} g</span></div>`;
  el.innerHTML = `
    <div class="summary-top">
      <div class="stat"><b class="num">${fmt(t.kcal)}</b><small>gegessen</small></div>
      <div class="ring ${over ? 'over' : ''}">
        <svg viewBox="0 0 148 148" aria-hidden="true">
          <circle class="track" cx="74" cy="74" r="62"/>
          <circle class="bar" cx="74" cy="74" r="62" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/>
        </svg>
        <div class="ring-center"><b class="num">${fmt(Math.abs(remaining))}</b><small>${over ? 'kcal zu viel' : 'kcal übrig'}</small></div>
      </div>
      <div class="stat"><b class="num">${fmt(g.kcal)}</b><small>Ziel</small></div>
    </div>
    <div class="macros">
      ${macro('c', 'Kohlenhydrate', t.c, g.c)}
      ${macro('p', 'Eiweiß', t.p, g.p)}
      ${macro('f', 'Fett', t.f, g.f)}
    </div>`;
}

function renderMeals() {
  const list = entriesOf(day);
  $('#meals').innerHTML = MEALS.map((m) => {
    const items = list.filter((e) => e.meal === m.id);
    const sum = totals(items).kcal;
    return `<div class="meal">
      <div class="meal-head">
        <h3>${m.name}</h3>
        <span class="kcal num">${items.length ? fmt(sum) + ' kcal' : ''}</span>
        <button class="add-btn" data-add="${m.id}" aria-label="${m.name} hinzufügen">${ICON.plus}</button>
      </div>
      ${items.length ? `<ul class="entries">${items.map((e) => `
        <li><button class="entry" data-entry="${e.id}">
          <span class="src-dot ${esc(e.src)}"></span>
          <span class="info"><span class="name">${esc(e.name)}</span>
          <small>${e.grams ? fmt(e.grams) + ' ' + esc(e.unit) : 'Portion'}${e.brand ? ' · ' + esc(e.brand) : ''}</small></span>
          <span class="val num">${fmt(e.kcal)} kcal</span>
        </button></li>`).join('')}</ul>` : ''}
    </div>`;
  }).join('');
  $$('[data-add]').forEach((b) => (b.onclick = () => openSheet(viewAdd(b.dataset.add))));
  $$('[data-entry]').forEach((b) => (b.onclick = () => {
    const e = entriesOf(day).find((x) => x.id === b.dataset.entry);
    if (e) openSheet(viewEntry(e));
  }));
}

function renderWeek() {
  const g = goals();
  const days = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6));
  const vals = days.map((k) => totals(entriesOf(k)).kcal);
  const max = Math.max(g.kcal * 1.15, ...vals, 500);
  const W = 320, H = 132, top = 8, base = 108, bw = 26, step = W / 7;
  const y = (v) => base - (v / max) * (base - top);
  const bars = days.map((k, i) => {
    const v = vals[i];
    const x = step * i + (step - bw) / 2;
    const h = Math.max(base - y(v), v > 0 ? 3 : 0);
    const cls = ['bar', g.kcal && v > g.kcal ? 'over' : '', k === day ? 'sel' : 'dim'].join(' ');
    const label = parseKey(k).toLocaleDateString('de-AT', { weekday: 'short' }).replace('.', '');
    return `<rect class="${cls}" x="${x}" y="${base - h}" width="${bw}" height="${h}" rx="6"/>
      <text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(label)}</text>`;
  }).join('');
  const logged = vals.filter((v) => v > 0);
  const avg = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : 0;
  $('#week').innerHTML = `<h3>Letzte 7 Tage</h3>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kalorien der letzten 7 Tage">
      ${g.kcal ? `<line class="goal-line" x1="0" x2="${W}" y1="${y(g.kcal)}" y2="${y(g.kcal)}"/>` : ''}
      ${bars}
    </svg>
    <div class="avg">${logged.length ? `Ø ${fmt(avg)} kcal an ${logged.length} ${logged.length === 1 ? 'Tag' : 'Tagen'} mit Einträgen` : 'Noch keine Einträge in dieser Woche.'}${g.kcal ? ' · gestrichelt = Ziel' : ''}</div>`;
}

function render() {
  renderHeader();
  renderSummary();
  renderMeals();
  renderWeek();
}

// ---------- Toast ----------
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- Sheet (Overlay-Fenster) ----------
let stack = [];
let current = null;
let cleanup = null;

function runCleanup() { if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; } }
function showView(view) {
  runCleanup();
  current = view;
  const v = view();
  $('#sheetTitle').textContent = v.title;
  const body = $('#sheetBody');
  body.innerHTML = v.html;
  body.scrollTop = 0;
  $('#sheet').classList.toggle('tall', !!v.tall);
  $('#sheetBack').hidden = stack.length === 0;
  $('#sheet').hidden = false;
  $('#overlay').hidden = false;
  document.body.style.overflow = 'hidden';
  if (v.mount) cleanup = v.mount(body) || null;
}
function openSheet(view) { stack = []; showView(view); }
function pushView(view) { if (current) stack.push(current); showView(view); }
function backView() { if (stack.length) showView(stack.pop()); else closeSheet(); }
function closeSheet() {
  runCleanup();
  stack = [];
  current = null;
  $('#sheet').hidden = true;
  $('#overlay').hidden = true;
  document.body.style.overflow = '';
}

function segHtml(selected) {
  return `<div class="section-title">Mahlzeit</div><div class="seg" data-seg>${MEALS.map((m) =>
    `<button type="button" data-meal="${m.id}" class="${m.id === selected ? 'on' : ''}">${m.name}</button>`).join('')}</div>`;
}
function bindSeg(body, initial) {
  let val = initial;
  $$('[data-seg] button', body).forEach((b) => (b.onclick = () => {
    val = b.dataset.meal;
    $$('[data-seg] button', body).forEach((x) => x.classList.toggle('on', x === b));
  }));
  return () => val;
}

function listItemHtml(it, idx, extra = '') {
  const portion = it.grams ? `${fmt(it.grams)} ${esc(it.unit || 'g')}` : '';
  const kcal = it.per100 && !it.grams ? `${fmt(it.per100.kcal)} kcal / 100 ${esc(it.unit || 'g')}` : `${fmt(it.kcal)} kcal`;
  return `<button class="list-item" data-idx="${idx}" ${extra}>
    ${it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy">` : ''}
    <span class="info"><span class="name">${esc(it.name)}</span>
    <small>${[it.brand && esc(it.brand), portion].filter(Boolean).join(' · ')}</small></span>
    <span class="val num">${kcal}</span></button>`;
}

// ---------- Ansicht: Hinzufügen ----------
function viewAdd(meal) {
  return () => ({
    title: `${mealName(meal)} hinzufügen`,
    html: `
      <div class="tiles">
        <button class="tile" data-go="photo">${ICON.camera}<b>Foto (KI)</b><small>Essen fotografieren, KI schätzt Kalorien</small></button>
        <button class="tile" data-go="scan">${ICON.barcode}<b>Barcode</b><small>Verpacktes Produkt scannen</small></button>
        <button class="tile" data-go="search">${ICON.search}<b>Suchen</b><small>Lebensmittel & Produkte</small></button>
        <button class="tile" data-go="manual">${ICON.pencil}<b>Manuell</b><small>Kalorien selbst eingeben</small></button>
      </div>
      <div class="section-title">Zuletzt gegessen</div>
      ${db.recent.length ? `<div class="list">${db.recent.slice(0, 15).map((r, i) => listItemHtml(r, i)).join('')}</div>`
        : '<div class="empty">Hier erscheinen deine zuletzt eingetragenen Lebensmittel.</div>'}`,
    mount(body) {
      const go = { photo: viewPhoto, scan: viewScan, search: viewSearch, manual: (m) => viewManual(m) };
      $$('[data-go]', body).forEach((b) => (b.onclick = () => pushView(go[b.dataset.go](meal))));
      $$('.list-item', body).forEach((b) => (b.onclick = () => pushView(viewFromRecent(db.recent[+b.dataset.idx], meal))));
    },
  });
}
function viewFromRecent(r, meal) {
  return r.per100 ? viewPortion({ ...r, servings: [] }, meal) : viewManual(meal, null, r);
}
function viewEntry(e) {
  return e.per100 ? viewPortion({ ...e, servings: [] }, e.meal, e) : viewManual(e.meal, e);
}

// ---------- Ansicht: Portion wählen (Produkt mit Werten pro 100 g) ----------
function viewPortion(prod, meal, entry) {
  return () => {
    const unit = prod.unit || 'g';
    const servings = [...(prod.servings || [])];
    if (!servings.some((s) => s.g === 100)) servings.push({ label: `100 ${unit}`, g: 100 });
    const start = entry ? entry.grams : (prod.grams || servings[0].g || 100);
    const p = prod.per100;
    const srcLabel = { barcode: 'Open Food Facts', db: 'Richtwert', ai: 'KI-Schätzung', label: 'Nährwerttabelle (KI)', custom: 'Eigenes Produkt' }[prod.src] || '';
    return {
      title: entry ? 'Eintrag bearbeiten' : 'Menge wählen',
      html: `
        <div class="product-head">
          ${prod.img ? `<img src="${esc(prod.img)}" alt="">` : ''}
          <div><h3>${esc(prod.name)}</h3><small>${[prod.brand && esc(prod.brand), srcLabel].filter(Boolean).join(' · ')}</small></div>
        </div>
        <div class="chips">${servings.map((s) => `<button type="button" class="chip" data-g="${s.g}">${esc(s.label)}</button>`).join('')}</div>
        <label class="field"><span>Menge (${esc(unit)})</span>
          <input class="input num" id="amt" type="text" inputmode="decimal" value="${fmtIn(start)}" autocomplete="off"></label>
        <div class="nutri">
          <div class="k"><b class="num" id="nK">0</b><small>kcal</small></div>
          <div class="c"><b class="num" id="nC">0</b><small>KH (g)</small></div>
          <div class="p"><b class="num" id="nP">0</b><small>Eiweiß (g)</small></div>
          <div class="f"><b class="num" id="nF">0</b><small>Fett (g)</small></div>
        </div>
        <div class="per100">Pro 100 ${esc(unit)}: ${fmt(p.kcal)} kcal · KH ${fmt1(p.c)} g · Eiweiß ${fmt1(p.p)} g · Fett ${fmt1(p.f)} g</div>
        ${segHtml(entry ? entry.meal : meal)}
        <button class="btn primary" id="savePortion">${entry ? 'Speichern' : 'Hinzufügen'}</button>
        ${entry ? '<button class="btn danger" id="delEntry">Eintrag löschen</button>' : ''}`,
      mount(body) {
        const amt = $('#amt', body);
        const getMeal = bindSeg(body, entry ? entry.meal : meal);
        const update = () => {
          const g = num(amt.value);
          const v = scale(p, g);
          $('#nK', body).textContent = fmt(v.kcal);
          $('#nC', body).textContent = fmt1(v.c);
          $('#nP', body).textContent = fmt1(v.p);
          $('#nF', body).textContent = fmt1(v.f);
          $$('.chip', body).forEach((c) => c.classList.toggle('on', +c.dataset.g === g));
        };
        amt.oninput = update;
        $$('.chip', body).forEach((c) => (c.onclick = () => { amt.value = fmtIn(+c.dataset.g); update(); }));
        update();
        $('#savePortion', body).onclick = () => {
          const g = num(amt.value);
          if (!g) { toast('Bitte eine Menge eingeben'); amt.focus(); return; }
          const item = { name: prod.name, brand: prod.brand, img: prod.img, unit, per100: p, grams: g, ...scale(p, g), src: prod.src, barcode: prod.barcode };
          if (entry) { updateEntry(entry.id, { ...item, meal: getMeal() }); toast('Gespeichert'); }
          else { addEntry(getMeal(), item); toast(`${prod.name} hinzugefügt`); }
          closeSheet();
        };
        if (entry) $('#delEntry', body).onclick = () => { deleteEntry(entry.id); toast('Gelöscht'); closeSheet(); };
      },
    };
  };
}

// ---------- Ansicht: Manuell ----------
function viewManual(meal, entry, preset, barcode) {
  return () => {
    const src = entry || preset || {};
    return {
      title: entry ? 'Eintrag bearbeiten' : 'Manuell eintragen',
      html: `
        ${barcode ? `<div class="note-box">Produkt ${esc(barcode)} wird für den nächsten Scan auf diesem Gerät gespeichert, wenn du die Werte pro 100 g eingibst.</div>` : ''}
        <label class="field"><span>Name</span><input class="input" id="mName" value="${esc(src.name || '')}" placeholder="z. B. Kaiserschmarrn" autocomplete="off"></label>
        <div class="seg" id="mMode">
          <button type="button" data-mode="portion" class="${barcode ? '' : 'on'}">Für meine Portion</button>
          <button type="button" data-mode="per100" class="${barcode ? 'on' : ''}">Pro 100 g/ml</button>
        </div>
        <div class="grid2">
          <label class="field"><span>Kalorien (kcal)</span><input class="input num" id="mK" inputmode="decimal" value="${src.kcal ? fmtIn(src.kcal) : ''}"></label>
          <label class="field"><span>Kohlenhydrate (g)</span><input class="input num" id="mC" inputmode="decimal" value="${src.c ? fmtIn(src.c) : ''}"></label>
          <label class="field"><span>Eiweiß (g)</span><input class="input num" id="mP" inputmode="decimal" value="${src.p ? fmtIn(src.p) : ''}"></label>
          <label class="field"><span>Fett (g)</span><input class="input num" id="mF" inputmode="decimal" value="${src.f ? fmtIn(src.f) : ''}"></label>
        </div>
        <div class="row">
          <label class="field"><span id="mAmtLabel">Menge (optional)</span><input class="input num" id="mAmt" inputmode="decimal" value="${src.grams ? fmtIn(src.grams) : ''}"></label>
          <label class="field"><span>Einheit</span><select class="input" id="mUnit"><option value="g">g</option><option value="ml" ${src.unit === 'ml' ? 'selected' : ''}>ml</option></select></label>
        </div>
        ${segHtml(entry ? entry.meal : meal)}
        <button class="btn primary" id="mSave">${entry ? 'Speichern' : 'Hinzufügen'}</button>
        ${entry ? '<button class="btn danger" id="mDel">Eintrag löschen</button>' : ''}`,
      mount(body) {
        const getMeal = bindSeg(body, entry ? entry.meal : meal);
        let mode = barcode ? 'per100' : 'portion';
        const setMode = (m) => {
          mode = m;
          $$('#mMode button', body).forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
          $('#mAmtLabel', body).textContent = m === 'per100' ? 'Gegessene Menge' : 'Menge (optional)';
        };
        $$('#mMode button', body).forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
        setMode(mode);
        $('#mSave', body).onclick = () => {
          const name = $('#mName', body).value.trim() || 'Lebensmittel';
          const v = { kcal: num($('#mK', body).value), c: num($('#mC', body).value), p: num($('#mP', body).value), f: num($('#mF', body).value) };
          const grams = num($('#mAmt', body).value);
          const unit = $('#mUnit', body).value;
          if (!v.kcal && !v.c && !v.p && !v.f) { toast('Bitte mindestens die Kalorien eingeben'); return; }
          let item;
          if (mode === 'per100') {
            if (!grams) { toast('Bitte die gegessene Menge eingeben'); return; }
            item = { name, unit, grams, per100: v, ...scale(v, grams), src: barcode ? 'custom' : 'manual', barcode: barcode || '' };
            if (barcode) { db.custom[barcode] = { name, unit, per100: v, src: 'custom', barcode, servings: [] }; }
          } else {
            item = { name, unit, grams, per100: grams ? scale(v, 10000 / grams) : null, ...v, src: 'manual' };
          }
          if (entry) { updateEntry(entry.id, { ...item, meal: getMeal() }); toast('Gespeichert'); }
          else { addEntry(getMeal(), item); toast(`${name} hinzugefügt`); }
          closeSheet();
        };
        if (entry) $('#mDel', body).onclick = () => { deleteEntry(entry.id); toast('Gelöscht'); closeSheet(); };
      },
    };
  };
}

// ---------- Ansicht: Suche ----------
function viewSearch(meal) {
  return () => ({
    title: 'Lebensmittel suchen',
    tall: true,
    html: `
      <form id="sForm" class="row" style="margin-bottom:12px">
        <input class="input" id="sQ" type="search" placeholder="z. B. Banane, Skyr, Manner …" autocomplete="off" enterkeyhint="search">
        <button class="btn primary" style="flex:0 0 auto;width:auto;padding:12px 16px" aria-label="Suchen">${ICON.search}</button>
      </form>
      <div id="sLocal"></div>
      <div id="sRemote"></div>`,
    mount(body) {
      const q = $('#sQ', body);
      let results = [];
      const pick = (it) => pushView(it.per100 ? viewPortion({ ...it }, meal) : viewManual(meal, null, it));
      const bindList = (container) => $$('.list-item', container).forEach((b) => (b.onclick = () => pick(results[+b.dataset.idx])));
      const renderLocal = () => {
        const term = q.value.trim();
        const nt = norm(term);
        const recents = db.recent.filter((r) => !term || norm(r.name + ' ' + (r.brand || '')).includes(nt)).slice(0, term ? 10 : 6);
        const basics = term ? matchFoods(term).slice(0, 30) : [];
        results = [...recents, ...basics];
        let html = '';
        if (recents.length) html += `<div class="section-title">Zuletzt gegessen</div><div class="list">${recents.map((r, i) => listItemHtml(r, i)).join('')}</div>`;
        if (basics.length) html += `<div class="section-title">Lebensmittel (Richtwerte)</div><div class="list">${basics.map((b, i) => listItemHtml(b, recents.length + i)).join('')}</div>`;
        if (term && !basics.length && !recents.length) html += '<div class="empty">Keine Treffer in der Liste – drück auf Suchen für die Produktdatenbank.</div>';
        if (term && term.length >= 2) html += '<p class="hint">Markenprodukt gesucht? Drück auf Suchen, dann wird auch Open Food Facts durchsucht.</p>';
        if (!term) {
          html += `<div class="section-title">Kategorien</div><div class="list">${CATEGORIES.map((c, i) => `
            <button class="list-item" data-cat="${i}"><span class="info"><span class="name">${esc(c.name)}</span></span>
            <span class="val num">${c.items.length}</span></button>`).join('')}</div>`;
        }
        $('#sLocal', body).innerHTML = html;
        $$('.list-item[data-idx]', $('#sLocal', body)).forEach((el) => (el.onclick = () => pick(results[+el.dataset.idx])));
        $$('[data-cat]', body).forEach((el) => (el.onclick = () => pushView(viewCategory(CATEGORIES[+el.dataset.cat], meal))));
      };
      q.oninput = () => { renderLocal(); $('#sRemote', body).innerHTML = ''; };
      $('#sForm', body).onsubmit = async (ev) => {
        ev.preventDefault();
        const term = q.value.trim();
        if (term.length < 2) return;
        q.blur();
        const box = $('#sRemote', body);
        box.innerHTML = '<div class="spinner"></div><div class="loading">Suche in der Produktdatenbank …</div>';
        try {
          const found = await searchOFF(term);
          if (q.value.trim() !== term) return;
          const offset = results.length;
          results = results.concat(found);
          box.innerHTML = `<div class="section-title">Produkte (Open Food Facts)</div>` +
            (found.length ? `<div class="list">${found.map((p, i) => listItemHtml(p, offset + i)).join('')}</div>`
              : '<div class="empty">Nichts gefunden. Probier einen anderen Begriff oder trag es manuell ein.</div>');
          bindList(box);
        } catch (e) {
          box.innerHTML = '<div class="err-box">Die Produktdatenbank ist gerade nicht erreichbar. Versuch es gleich nochmal.</div>';
        }
      };
      renderLocal();
      setTimeout(() => q.focus(), 300);
    },
  });
}

function viewCategory(cat, meal) {
  return () => ({
    title: cat.name,
    tall: true,
    html: `<div class="list">${cat.items.map((b, i) => listItemHtml(b, i)).join('')}</div>
      <p class="hint">Richtwerte pro 100 g bzw. 100 ml – für Markenprodukte lieber den Barcode scannen.</p>`,
    mount(body) {
      $$('.list-item', body).forEach((el) => (el.onclick = () => pushView(viewPortion({ ...cat.items[+el.dataset.idx] }, meal))));
    },
  });
}

// ---------- Open Food Facts ----------
function parseQty(str) {
  const m = String(str || '').replace(',', '.').match(/([\d.]+)\s*(kg|g|ml|cl|l)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  const factor = { kg: 1000, g: 1, l: 1000, cl: 10, ml: 1 }[u];
  return { amount: n * factor, unit: ['ml', 'cl', 'l'].includes(u) ? 'ml' : 'g' };
}
function fromOFF(p, code) {
  const n = p.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n['energy-kj_100g'] != null) kcal = n['energy-kj_100g'] / 4.184;
  if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184;
  const per100 = { kcal: +kcal || 0, p: +n.proteins_100g || 0, c: +n.carbohydrates_100g || 0, f: +n.fat_100g || 0 };
  const qty = parseQty(p.quantity);
  const unit = qty ? qty.unit : 'g';
  const servings = [];
  const sq = +p.serving_quantity;
  if (sq > 0) servings.push({ label: `1 Portion (${fmt1(sq)} ${unit})`, g: sq });
  if (qty && qty.amount > 0 && qty.amount <= 2000 && qty.amount !== sq) servings.push({ label: `Ganze Packung (${fmt(qty.amount)} ${unit})`, g: qty.amount });
  return {
    name: p.product_name_de || p.product_name || p.generic_name_de || 'Unbekanntes Produkt',
    brand: String(p.brands || '').split(',')[0].trim(),
    img: p.image_front_small_url || '',
    unit, per100, servings, src: 'barcode', barcode: code || p.code || '',
    hasNutrition: per100.kcal > 0 || per100.p > 0 || per100.c > 0 || per100.f > 0,
  };
}
async function lookupBarcode(code) {
  if (db.custom[code]) return { ...db.custom[code], hasNutrition: true };
  const res = await fetch(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('OFF ' + res.status);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return fromOFF(data.product, code);
}
async function searchOFF(term) {
  const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=30&sort_by=unique_scans_n&fields=${OFF_FIELDS}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('OFF ' + res.status);
  const data = await res.json();
  return (data.products || []).map((p) => fromOFF(p)).filter((p) => p.hasNutrition).slice(0, 20);
}

// ---------- Barcode-Scanner ----------
let zxingLoading = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve();
  if (!zxingLoading) {
    zxingLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/zxing.min.js';
      s.onload = () => resolve();
      s.onerror = () => { zxingLoading = null; reject(new Error('Scanner-Bibliothek konnte nicht geladen werden')); };
      document.head.appendChild(s);
    });
  }
  return zxingLoading;
}
function zxingHints(tryHarder) {
  const Z = window.ZXing;
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
  if (tryHarder) hints.set(Z.DecodeHintType.TRY_HARDER, true);
  return hints;
}
async function nativeDetector() {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const formats = await window.BarcodeDetector.getSupportedFormats();
    if (!formats.includes('ean_13')) return null;
    return new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter((f) => formats.includes(f)) });
  } catch (e) { return null; }
}
const validCode = (c) => /^\d{8}$|^\d{12,14}$/.test(c);

async function startScanner(video, onCode) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw Object.assign(new Error('Kamera nicht verfügbar. Die App muss über https:// geöffnet werden.'), { friendly: true });
  }
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.muted = true;
  let stopped = false;
  const detector = await nativeDetector();
  if (detector) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    const loop = async () => {
      if (stopped) return;
      try {
        const codes = await detector.detect(video);
        const hit = codes.map((c) => c.rawValue).find(validCode);
        if (hit) { stopped = true; stop(); onCode(hit); return; }
      } catch (e) { /* weiter versuchen */ }
      setTimeout(loop, 150);
    };
    const stop = () => { stopped = true; stream.getTracks().forEach((t) => t.stop()); video.srcObject = null; };
    loop();
    return stop;
  }
  await loadZXing();
  const reader = new window.ZXing.BrowserMultiFormatReader(zxingHints(false), 200);
  const stop = () => { stopped = true; try { reader.reset(); } catch (e) { /* ignore */ } };
  await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video, (result) => {
    if (stopped || !result) return;
    const code = result.getText();
    if (validCode(code)) { stop(); onCode(code); }
  });
  if (stopped) stop();
  return stop;
}
async function decodeBarcodeImage(file) {
  const detector = await nativeDetector();
  if (detector && window.createImageBitmap) {
    try {
      const bmp = await createImageBitmap(file);
      const codes = await detector.detect(bmp);
      const hit = codes.map((c) => c.rawValue).find(validCode);
      if (hit) return hit;
    } catch (e) { /* weiter mit ZXing */ }
  }
  await loadZXing();
  const url = URL.createObjectURL(file);
  try {
    const reader = new window.ZXing.BrowserMultiFormatReader(zxingHints(true));
    const res = await reader.decodeFromImageUrl(url);
    return validCode(res.getText()) ? res.getText() : null;
  } catch (e) { return null; }
  finally { URL.revokeObjectURL(url); }
}
function cameraError(e) {
  if (e && e.friendly) return e.message;
  if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) return 'Kamerazugriff wurde nicht erlaubt. Erlaube die Kamera in den iPhone-Einstellungen (Safari › Kamera) oder nutze die Möglichkeiten unten.';
  if (e && e.name === 'NotFoundError') return 'Keine Kamera gefunden.';
  return 'Kamera konnte nicht gestartet werden. Nutze die Möglichkeiten unten.';
}

// ---------- Ansicht: Barcode scannen ----------
function viewScan(meal) {
  return () => ({
    title: 'Barcode scannen',
    html: `
      <div class="scanner"><video id="scanVideo" playsinline muted></video><div class="frame"></div><div class="laser"></div></div>
      <div class="scan-status" id="scanStatus">Kamera wird gestartet …</div>
      <button class="btn" id="scanPhoto">${ICON.image} Barcode fotografieren</button>
      <input type="file" id="scanFile" accept="image/*" capture="environment" hidden>
      <div class="section-title">Oder Nummer eintippen</div>
      <form class="row" id="eanForm">
        <input class="input num" id="eanInput" inputmode="numeric" pattern="[0-9]*" placeholder="z. B. 9000100000000" autocomplete="off">
        <button class="btn primary" style="flex:0 0 auto;width:auto;padding:12px 18px">OK</button>
      </form>`,
    mount(body) {
      let stop = null;
      let done = false;
      const status = $('#scanStatus', body);
      const handle = async (code) => {
        if (done) return;
        done = true;
        if (navigator.vibrate) navigator.vibrate(60);
        status.textContent = `Gefunden: ${code} – suche Produkt …`;
        try {
          const prod = await lookupBarcode(code);
          if (current !== thisView) return;
          if (prod && prod.hasNutrition) pushView(viewPortion(prod, meal));
          else pushView(viewNotFound(code, meal, prod));
        } catch (e) {
          done = false;
          status.textContent = 'Produktdatenbank nicht erreichbar. Bist du online?';
        }
      };
      const thisView = current;
      startScanner($('#scanVideo', body), handle)
        .then((s) => { stop = s; if (!done) status.textContent = 'Halte den Barcode in den Rahmen'; if (current !== thisView) s(); })
        .catch((e) => { status.textContent = cameraError(e); $('.scanner', body).hidden = true; });
      $('#scanPhoto', body).onclick = () => $('#scanFile', body).click();
      $('#scanFile', body).onchange = async (ev) => {
        const file = ev.target.files[0];
        ev.target.value = '';
        if (!file) return;
        status.textContent = 'Lese Barcode vom Foto …';
        const code = await decodeBarcodeImage(file);
        if (code) { if (stop) stop(); handle(code); }
        else status.textContent = 'Kein Barcode erkannt. Fotografiere ihn möglichst gerade und scharf oder tippe die Nummer ein.';
      };
      $('#eanForm', body).onsubmit = (ev) => {
        ev.preventDefault();
        const code = $('#eanInput', body).value.replace(/\D/g, '');
        if (!validCode(code)) { toast('Bitte eine gültige Barcode-Nummer (8 oder 13 Ziffern) eingeben'); return; }
        if (stop) stop();
        handle(code);
      };
      return () => { done = true; if (stop) stop(); };
    },
  });
}

function viewNotFound(code, meal, partial) {
  return () => ({
    title: 'Produkt nicht gefunden',
    html: `
      <div class="note-box">${partial ? `„${esc(partial.name)}“ ist in der Datenbank, aber ohne Nährwerte.` : `Der Barcode ${esc(code)} ist noch nicht in der Datenbank.`}
      Fotografiere die Nährwerttabelle oder gib die Werte selbst ein – das Produkt wird dann auf diesem Gerät gespeichert.</div>
      <button class="btn primary" id="nfLabel">${ICON.label} Nährwerttabelle fotografieren (KI)</button>
      <button class="btn" id="nfManual">${ICON.pencil} Werte selbst eingeben</button>`,
    mount(body) {
      $('#nfLabel', body).onclick = () => pushView(viewLabel(meal, code, partial));
      $('#nfManual', body).onclick = () => pushView(viewManual(meal, null, partial ? { name: partial.name } : null, code));
    },
  });
}

// ---------- KI (Google Gemini) ----------
async function fileToJpeg(file, maxSide = 1024) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
      i.src = url;
    });
    const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * s);
    canvas.height = Math.round(img.naturalHeight * s);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

async function callGemini(parts, model) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': db.settings.apiKey.trim() },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* ignore */ }
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || res.statusText || 'Fehler'), { status: res.status });
  const text = (data?.candidates?.[0]?.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
  if (!text) {
    const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || '';
    throw Object.assign(new Error('Die KI hat keine Antwort geliefert' + (reason ? ` (${reason})` : '')), { status: 0 });
  }
  return text;
}
function parseJSON(text) {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s < 0 || e < s) throw Object.assign(new Error('Antwort der KI war nicht lesbar'), { status: 0 });
  return JSON.parse(text.slice(s, e + 1));
}
async function askAI(parts) {
  if (!db.settings.apiKey.trim()) throw Object.assign(new Error('NOKEY'), { code: 'NOKEY' });
  const models = [db.settings.model || MODELS[0].id];
  if (models[0] !== FALLBACK_MODEL) models.push(FALLBACK_MODEL);
  let last;
  for (const m of models) {
    try { return parseJSON(await callGemini(parts, m)); }
    catch (e) { last = e; if (![404, 429, 500, 503].includes(e.status)) break; }
  }
  throw last;
}
function aiError(e) {
  if (e.code === 'NOKEY') return 'Es ist noch kein API-Key hinterlegt.';
  const msg = String(e.message || '');
  if (e.status === 400 && /api key/i.test(msg)) return 'Der API-Key ist ungültig. Bitte in den Einstellungen prüfen.';
  if (e.status === 400 && /location|region|country/i.test(msg)) return 'Der Gratis-Zugang zur Gemini-API ist in deiner Region nicht verfügbar.';
  if (e.status === 401 || e.status === 403) return 'Zugriff verweigert – stimmt der API-Key?';
  if (e.status === 404) return 'Das KI-Modell wurde nicht gefunden. Wähle in den Einstellungen ein anderes Modell.';
  if (e.status === 429) return 'Gratis-Limit erreicht. Warte eine Minute oder probier es später wieder.';
  if (e.status >= 500) return 'Der KI-Dienst ist gerade überlastet. Versuch es gleich nochmal.';
  if (e instanceof TypeError) return 'Keine Verbindung zur KI. Bist du online?';
  return msg || 'Unbekannter Fehler';
}

const MEAL_PROMPT = (hasImage, note) => `Du bist eine erfahrene Ernährungsberaterin. ${hasImage ? 'Analysiere das Foto einer Mahlzeit.' : 'Analysiere die folgende Beschreibung einer Mahlzeit.'}
Erkenne jedes Lebensmittel bzw. jede Komponente einzeln. Schätze realistisch die Portionsgröße in Gramm (Getränke in ml) und die Kalorien sowie Makronährstoffe für genau diese Portion. Berücksichtige typische Zubereitung (Öl, Butter, Soßen, Panade). Ist eine Verpackung mit Nährwerten sichtbar, nutze diese Angaben. Verwende österreichische/deutsche Lebensmittelnamen.
${note ? `Angaben des Nutzers: """${note}"""` : ''}
Antworte ausschließlich mit JSON in genau diesem Format:
{"items":[{"name":"Name auf Deutsch","grams":Zahl,"unit":"g","kcal":Zahl,"protein":Zahl,"carbs":Zahl,"fat":Zahl}],"confidence":"hoch|mittel|niedrig","note":"kurzer Hinweis auf Deutsch, höchstens ein Satz"}
"unit" ist "g" oder "ml". Ist kein Essen erkennbar, gib "items": [] zurück und erkläre es in "note".`;

const LABEL_PROMPT = `Auf dem Foto ist die Verpackung bzw. Nährwerttabelle eines Lebensmittels. Lies die Nährwerte pro 100 g bzw. pro 100 ml ab.
Antworte ausschließlich mit JSON in genau diesem Format:
{"name":"Produktname falls erkennbar, sonst leer","brand":"Marke falls erkennbar, sonst leer","unit":"g oder ml","per100":{"kcal":Zahl,"protein":Zahl,"carbs":Zahl,"fat":Zahl},"serving":Zahl oder null,"found":true}
Sind nur kJ angegeben, rechne in kcal um (kJ geteilt durch 4,184). Ist keine Nährwerttabelle lesbar, setze "found": false.`;

function noKeyHtml() {
  return `<div class="err-box">Für die KI-Auswertung brauchst du einen kostenlosen Google-Gemini-API-Key.</div>
    <button class="btn primary" id="toSettings">API-Key einrichten</button>`;
}

// ---------- Ansicht: Foto (KI) ----------
function viewPhoto(meal) {
  return () => {
    const hasKey = !!db.settings.apiKey.trim();
    return {
      title: 'Essen fotografieren',
      html: hasKey ? `
        <label class="field"><span>Zusatzinfo für die KI (optional)</span>
          <textarea class="input" id="pNote" rows="2" placeholder="z. B. große Portion, in Butter gebraten, ohne Soße"></textarea></label>
        <button class="btn primary" id="pCam">${ICON.camera} Foto aufnehmen</button>
        <button class="btn" id="pLib">${ICON.image} Aus der Mediathek wählen</button>
        <button class="btn" id="pText">${ICON.text} Nur Beschreibung auswerten</button>
        <input type="file" id="pCamFile" accept="image/*" capture="environment" hidden>
        <input type="file" id="pLibFile" accept="image/*" hidden>
        <p class="hint">Tipp: Fotografiere schräg von oben, damit die KI die Portionsgröße gut abschätzen kann. Ein Besteck oder die Hand daneben hilft als Größenvergleich.</p>`
        : noKeyHtml(),
      mount(body) {
        if (!hasKey) { $('#toSettings', body).onclick = () => pushView(viewSettings); return; }
        const run = async (file) => {
          const note = $('#pNote', body).value.trim();
          if (!file && !note) { toast('Bitte zuerst beschreiben, was du gegessen hast'); $('#pNote', body).focus(); return; }
          pushView(viewAnalyzing(meal, file, note));
        };
        $('#pCam', body).onclick = () => $('#pCamFile', body).click();
        $('#pLib', body).onclick = () => $('#pLibFile', body).click();
        $('#pText', body).onclick = () => run(null);
        ['#pCamFile', '#pLibFile'].forEach((id) => ($(id, body).onchange = (ev) => {
          const f = ev.target.files[0];
          ev.target.value = '';
          if (f) run(f);
        }));
      },
    };
  };
}

function viewAnalyzing(meal, file, note) {
  return () => ({
    title: 'KI analysiert …',
    html: `<img class="photo-preview" id="aImg" alt="" hidden><div id="aBox"><div class="spinner"></div><div class="loading">Die KI schätzt Lebensmittel und Kalorien …</div></div>`,
    mount(body) {
      let alive = true;
      const me = current;
      (async () => {
        try {
          const parts = [];
          let dataUrl = '';
          if (file) {
            dataUrl = await fileToJpeg(file);
            const img = $('#aImg', body);
            img.src = dataUrl;
            img.hidden = false;
            parts.push({ inline_data: { mime_type: 'image/jpeg', data: dataUrl.split(',')[1] } });
          }
          parts.unshift({ text: MEAL_PROMPT(!!file, note) });
          const result = await askAI(parts);
          if (!alive || current !== me) return;
          const items = (Array.isArray(result.items) ? result.items : []).map((it) => {
            const grams = num(it.grams);
            const v = { kcal: num(it.kcal), p: num(it.protein), c: num(it.carbs), f: num(it.fat) };
            return { name: String(it.name || 'Lebensmittel').slice(0, 80), unit: it.unit === 'ml' ? 'ml' : 'g', grams,
              per100: grams ? scale(v, 10000 / grams) : null, ...v, on: true };
          });
          showView(viewAiResult(meal, items, String(result.note || ''), String(result.confidence || ''), dataUrl));
        } catch (e) {
          if (!alive) return;
          $('#aBox', body).innerHTML = `<div class="err-box">${esc(aiError(e))}</div>
            ${e.code === 'NOKEY' || [400, 401, 403, 404].includes(e.status) ? '<button class="btn primary" id="aSet">Einstellungen öffnen</button>' : ''}
            <button class="btn" id="aBack">Zurück</button>`;
          const s = $('#aSet', body);
          if (s) s.onclick = () => pushView(viewSettings);
          $('#aBack', body).onclick = backView;
        }
      })();
      return () => { alive = false; };
    },
  });
}

function viewAiResult(meal, items, note, confidence, dataUrl) {
  return () => ({
    title: 'Ergebnis prüfen',
    html: `
      ${dataUrl ? `<img class="photo-preview" src="${dataUrl}" alt="">` : ''}
      ${note || confidence ? `<div class="note-box">${esc(note)}${confidence ? ` <small>(Sicherheit: ${esc(confidence)})</small>` : ''}</div>` : ''}
      ${items.length ? `<div id="aiList">${items.map((it, i) => `
        <div class="ai-item">
          <input type="checkbox" data-i="${i}" ${it.on ? 'checked' : ''} aria-label="übernehmen">
          <div class="ai-top"><input class="ai-name" data-name="${i}" value="${esc(it.name)}" aria-label="Name">
            <span class="ai-kcal num" data-k="${i}">${fmt(it.kcal)} kcal</span></div>
          <div class="ai-line">
            <input class="ai-grams num" data-g="${i}" inputmode="decimal" value="${it.grams ? fmtIn(it.grams) : ''}" ${it.per100 ? '' : 'disabled'} aria-label="Menge"> ${esc(it.unit)}
            <span>KH ${fmt1(it.c)} · E ${fmt1(it.p)} · F ${fmt1(it.f)}</span>
          </div>
        </div>`).join('')}</div>
        <div class="ai-total"><span>Gesamt</span><span class="num" id="aiTotal"></span></div>
        <p class="hint">Mengen sind Schätzungen – pass sie an, wenn du es genauer weißt. Die Werte rechnen sich automatisch um.</p>
        ${segHtml(meal)}
        <button class="btn primary" id="aiAdd">Hinzufügen</button>`
        : '<div class="empty">Die KI hat kein Essen erkannt. Probier ein anderes Foto oder beschreib dein Essen im Textfeld.</div>'}
      <button class="btn" id="aiRetry">Neues Foto</button>`,
    mount(body) {
      $('#aiRetry', body).onclick = backView;
      if (!items.length) return;
      const getMeal = bindSeg(body, meal);
      const recalc = () => {
        items.forEach((it, i) => {
          const line = body.querySelector(`[data-g="${i}"]`).closest('.ai-item').querySelector('.ai-line span');
          line.textContent = `KH ${fmt1(it.c)} · E ${fmt1(it.p)} · F ${fmt1(it.f)}`;
          body.querySelector(`[data-k="${i}"]`).textContent = `${fmt(it.kcal)} kcal`;
        });
        const sel = items.filter((it) => it.on);
        $('#aiTotal', body).textContent = `${fmt(totals(sel).kcal)} kcal`;
        $('#aiAdd', body).textContent = sel.length ? `${sel.length} ${sel.length === 1 ? 'Eintrag' : 'Einträge'} hinzufügen` : 'Nichts ausgewählt';
        $('#aiAdd', body).disabled = !sel.length;
      };
      $$('[data-i]', body).forEach((c) => (c.onchange = () => { items[+c.dataset.i].on = c.checked; recalc(); }));
      $$('[data-name]', body).forEach((n) => (n.oninput = () => { items[+n.dataset.name].name = n.value; }));
      $$('[data-g]', body).forEach((g) => (g.oninput = () => {
        const it = items[+g.dataset.g];
        const grams = num(g.value);
        if (it.per100 && grams) { it.grams = grams; Object.assign(it, scale(it.per100, grams)); recalc(); }
      }));
      recalc();
      $('#aiAdd', body).onclick = () => {
        const m = getMeal();
        const sel = items.filter((it) => it.on);
        sel.forEach((it) => addEntry(m, { name: it.name.trim() || 'Lebensmittel', unit: it.unit, grams: it.grams, per100: it.per100, kcal: it.kcal, p: it.p, c: it.c, f: it.f, src: 'ai' }));
        toast(`${fmt(totals(sel).kcal)} kcal zu ${mealName(m)} hinzugefügt`);
        closeSheet();
      };
    },
  });
}

// ---------- Ansicht: Nährwerttabelle fotografieren ----------
function viewLabel(meal, code, partial) {
  return () => {
    const hasKey = !!db.settings.apiKey.trim();
    return {
      title: 'Nährwerttabelle',
      html: hasKey ? `
        <p class="hint">Fotografiere die Nährwerttabelle auf der Verpackung möglichst gerade und scharf.</p>
        <button class="btn primary" id="lCam">${ICON.camera} Foto aufnehmen</button>
        <button class="btn" id="lLib">${ICON.image} Aus der Mediathek wählen</button>
        <input type="file" id="lCamFile" accept="image/*" capture="environment" hidden>
        <input type="file" id="lLibFile" accept="image/*" hidden>
        <div id="lBox"></div>` : noKeyHtml(),
      mount(body) {
        if (!hasKey) { $('#toSettings', body).onclick = () => pushView(viewSettings); return; }
        let alive = true;
        const me = current;
        const run = async (file) => {
          const box = $('#lBox', body);
          box.innerHTML = '<div class="spinner"></div><div class="loading">Lese Nährwerte …</div>';
          try {
            const dataUrl = await fileToJpeg(file, 1400);
            const r = await askAI([{ text: LABEL_PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: dataUrl.split(',')[1] } }]);
            if (!alive || current !== me) return;
            const p = r.per100 || {};
            const per100 = { kcal: num(p.kcal), p: num(p.protein), c: num(p.carbs), f: num(p.fat) };
            if (r.found === false || !per100.kcal) { box.innerHTML = '<div class="err-box">Keine Nährwerte erkannt. Versuch ein schärferes Foto.</div>'; return; }
            const unit = r.unit === 'ml' ? 'ml' : 'g';
            const serving = num(r.serving);
            const prod = { name: String(r.name || (partial && partial.name) || 'Produkt').slice(0, 80), brand: String(r.brand || (partial && partial.brand) || ''),
              img: partial ? partial.img : '', unit, per100, servings: serving ? [{ label: `1 Portion (${fmt1(serving)} ${unit})`, g: serving }] : [],
              src: code ? 'custom' : 'label', barcode: code || '' };
            if (code) db.custom[code] = prod;
            save();
            pushView(viewPortion(prod, meal));
          } catch (e) {
            if (alive) box.innerHTML = `<div class="err-box">${esc(aiError(e))}</div>`;
          }
        };
        $('#lCam', body).onclick = () => $('#lCamFile', body).click();
        $('#lLib', body).onclick = () => $('#lLibFile', body).click();
        ['#lCamFile', '#lLibFile'].forEach((id) => ($(id, body).onchange = (ev) => {
          const f = ev.target.files[0];
          ev.target.value = '';
          if (f) run(f);
        }));
        return () => { alive = false; };
      },
    };
  };
}

// ---------- Ansicht: Einstellungen ----------
function viewSettings() {
  const s = db.settings;
  const pr = s.profile;
  const opt = (list, val) => list.map(([v, l]) => `<option value="${v}" ${+v === +val ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const welcome = !s.goal;
  return {
    title: welcome ? 'Willkommen' : 'Einstellungen',
    tall: true,
    html: `
      ${welcome ? '<div class="note-box">Gib ein paar Daten ein, dann berechnet die App dein persönliches Kalorienziel. Alles bleibt nur auf deinem iPhone gespeichert.</div>' : ''}
      <div class="section-title">Dein Tagesziel</div>
      <div class="panel">
        <div class="grid2">
          <label class="field"><span>Geschlecht</span><select class="input" id="sSex">
            <option value="m" ${pr.sex === 'm' ? 'selected' : ''}>männlich</option>
            <option value="f" ${pr.sex === 'f' ? 'selected' : ''}>weiblich</option></select></label>
          <label class="field"><span>Alter</span><input class="input num" id="sAge" inputmode="numeric" value="${esc(pr.age)}" placeholder="Jahre"></label>
          <label class="field"><span>Größe (cm)</span><input class="input num" id="sHeight" inputmode="decimal" value="${esc(pr.height)}"></label>
          <label class="field"><span>Gewicht (kg)</span><input class="input num" id="sWeight" inputmode="decimal" value="${esc(pr.weight)}"></label>
        </div>
        <label class="field"><span>Aktivität</span><select class="input" id="sAct">${opt(ACTIVITY, pr.activity)}</select></label>
        <label class="field"><span>Ziel</span><select class="input" id="sGoalType">${opt(GOALS, pr.goalType)}</select></label>
        <button class="btn" id="sCalc">Ziel berechnen</button>
        <p class="hint" id="sCalcOut"></p>
        <label class="field"><span>Tagesziel (kcal) – kannst du auch direkt eintragen</span>
          <input class="input num" id="sGoal" inputmode="numeric" value="${s.goal || ''}" placeholder="z. B. 2200"></label>
        <div class="section-title" style="margin-top:4px">Makro-Verteilung in %</div>
        <div class="row">
          <label class="field"><span>Kohlenh.</span><input class="input num" id="sC" inputmode="numeric" value="${s.split.c}"></label>
          <label class="field"><span>Eiweiß</span><input class="input num" id="sP" inputmode="numeric" value="${s.split.p}"></label>
          <label class="field"><span>Fett</span><input class="input num" id="sF" inputmode="numeric" value="${s.split.f}"></label>
        </div>
      </div>

      <div class="section-title">KI-Fotoanalyse (Google Gemini, gratis)</div>
      <div class="panel">
        <p class="hint" style="margin-top:0">So bekommst du deinen kostenlosen Key:<br>
          1. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> öffnen und mit deinem Google-Konto anmelden<br>
          2. „Create API key“ antippen<br>
          3. Key kopieren und hier einfügen</p>
        <label class="field"><span>API-Key</span>
          <div class="row"><input class="input" id="sKey" type="password" value="${esc(s.apiKey)}" placeholder="AIza…" autocomplete="off" autocapitalize="off" spellcheck="false">
          <button type="button" class="btn" id="sShow" style="flex:0 0 auto;width:auto;padding:12px 14px">Zeigen</button></div></label>
        <label class="field"><span>Modell</span><select class="input" id="sModel">
          ${MODELS.map((m) => `<option value="${m.id}" ${m.id === s.model ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}
          ${MODELS.some((m) => m.id === s.model) ? '' : `<option value="${esc(s.model)}" selected>${esc(s.model)}</option>`}
          <option value="__custom">Anderes Modell eingeben …</option></select></label>
        <button class="btn" id="sTest">Verbindung testen</button>
        <p class="hint" id="sTestOut"></p>
        <p class="hint">Hinweis: Im Gratis-Zugang darf Google die gesendeten Fotos zur Verbesserung seiner Dienste verwenden – fotografiere also nur dein Essen. Der Key bleibt nur auf diesem Gerät gespeichert. Wird das Gratis-Limit erreicht, weicht die App automatisch auf Flash-Lite aus.</p>
      </div>

      <div class="section-title">Daten</div>
      <div class="panel">
        <button class="btn" id="sExport">Backup exportieren</button>
        <button class="btn" id="sImport">Backup importieren</button>
        <input type="file" id="sImportFile" accept="application/json,.json" hidden>
        <button class="btn danger" id="sReset">Alle Daten löschen</button>
        <p class="hint">Tipp: Leg die App über „Teilen › Zum Home-Bildschirm“ ab, dann bleiben deine Daten dauerhaft gespeichert. Mach trotzdem ab und zu ein Backup.</p>
      </div>

      <button class="btn primary" id="sSave">Speichern</button>
      <p class="hint" style="text-align:center">Kalorien ${VERSION} · Produktdaten: Open Food Facts (ODbL)</p>`,
    mount(body) {
      const v = (id) => $(id, body).value;
      $('#sCalc', body).onclick = () => {
        const sex = v('#sSex'); const age = num(v('#sAge')); const h = num(v('#sHeight')); const w = num(v('#sWeight'));
        if (!age || !h || !w) { $('#sCalcOut', body).textContent = 'Bitte Alter, Größe und Gewicht ausfüllen.'; return; }
        const bmr = 10 * w + 6.25 * h - 5 * age + (sex === 'm' ? 5 : -161);
        const tdee = bmr * +v('#sAct');
        const floor = sex === 'm' ? 1500 : 1200;
        const target = Math.max(Math.round((tdee + +v('#sGoalType')) / 10) * 10, floor);
        $('#sGoal', body).value = target;
        $('#sCalcOut', body).textContent = `Grundumsatz ${fmt(bmr)} kcal · Gesamtumsatz ${fmt(tdee)} kcal → Tagesziel ${fmt(target)} kcal`;
      };
      $('#sShow', body).onclick = () => {
        const k = $('#sKey', body);
        k.type = k.type === 'password' ? 'text' : 'password';
        $('#sShow', body).textContent = k.type === 'password' ? 'Zeigen' : 'Verbergen';
      };
      $('#sModel', body).onchange = (ev) => {
        if (ev.target.value !== '__custom') return;
        const id = (prompt('Modell-ID eingeben (z. B. gemini-3.8-flash):', s.model) || '').trim();
        if (id) {
          const o = document.createElement('option');
          o.value = id; o.textContent = id; o.selected = true;
          ev.target.insertBefore(o, ev.target.lastElementChild);
        } else ev.target.value = s.model;
      };
      $('#sTest', body).onclick = async () => {
        const out = $('#sTestOut', body);
        const key = v('#sKey').trim();
        if (!key) { out.textContent = 'Bitte zuerst einen API-Key einfügen.'; return; }
        out.textContent = 'Teste …';
        const oldKey = db.settings.apiKey; const oldModel = db.settings.model;
        db.settings.apiKey = key; db.settings.model = v('#sModel');
        try {
          await callGemini([{ text: 'Antworte nur mit {"ok":true}' }], db.settings.model);
          out.textContent = '✓ Verbindung klappt – die KI ist bereit.';
        } catch (e) {
          out.textContent = '✗ ' + aiError(e);
        } finally { db.settings.apiKey = oldKey; db.settings.model = oldModel; }
      };
      $('#sExport', body).onclick = async () => {
        const data = { ...db, settings: { ...db.settings, apiKey: '' }, exported: new Date().toISOString(), app: 'kalorien', version: VERSION };
        const name = `kalorien-backup-${todayKey()}.json`;
        const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
        try {
          const file = new File([blob], name, { type: 'application/json' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Kalorien-Backup' }); return; }
        } catch (e) { if (e.name === 'AbortError') return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      };
      $('#sImport', body).onclick = () => $('#sImportFile', body).click();
      $('#sImportFile', body).onchange = async (ev) => {
        const f = ev.target.files[0];
        ev.target.value = '';
        if (!f) return;
        try {
          const d = JSON.parse(await f.text());
          if (!d || typeof d.log !== 'object') throw new Error();
          if (!confirm('Backup importieren? Deine aktuellen Einträge werden dabei ersetzt.')) return;
          const key = db.settings.apiKey;
          localStorage.setItem(STORE, JSON.stringify(d));
          db = load();
          if (!db.settings.apiKey) db.settings.apiKey = key;
          save(); render(); closeSheet(); toast('Backup importiert');
        } catch (e) { toast('Diese Datei ist kein gültiges Backup'); }
      };
      $('#sReset', body).onclick = () => {
        if (!confirm('Wirklich alle Einträge und Einstellungen löschen? Das lässt sich nicht rückgängig machen.')) return;
        db = defaults(); save(); render(); closeSheet(); toast('Alle Daten gelöscht');
      };
      $('#sSave', body).onclick = () => {
        const goal = Math.round(num(v('#sGoal')));
        if (goal && (goal < 800 || goal > 6000)) { toast('Das Tagesziel sollte zwischen 800 und 6000 kcal liegen'); return; }
        if (!goal) { toast('Bitte ein Tagesziel berechnen oder eintragen'); $('#sGoal', body).focus(); return; }
        const split = { c: num(v('#sC')), p: num(v('#sP')), f: num(v('#sF')) };
        const sum = split.c + split.p + split.f;
        if (Math.round(sum) !== 100) { toast(`Die Makro-Prozente ergeben ${fmt(sum)} % statt 100 %`); return; }
        let model = v('#sModel');
        if (model === '__custom') model = s.model;
        db.settings = {
          ...db.settings, goal, split,
          profile: { sex: v('#sSex'), age: v('#sAge'), height: v('#sHeight'), weight: v('#sWeight'), activity: +v('#sAct'), goalType: +v('#sGoalType') },
          apiKey: v('#sKey').trim(), model,
        };
        save(); render();
        toast('Gespeichert');
        if (stack.length) backView(); else closeSheet();
      };
    },
  };
}

// ---------- Start ----------
$('#prevDay').onclick = () => { day = addDays(day, -1); render(); };
$('#nextDay').onclick = () => { day = addDays(day, 1); render(); };
$('#dayLabel').onclick = () => { day = todayKey(); render(); };
$('#openSettings').onclick = () => openSheet(viewSettings);
$('#sheetClose').onclick = closeSheet;
$('#sheetBack').onclick = backView;
$('#overlay').onclick = closeSheet;
$$('[data-quick]').forEach((b) => (b.onclick = () => {
  const m = defaultMeal();
  const v = { photo: viewPhoto, scan: viewScan, search: viewSearch }[b.dataset.quick](m);
  openSheet(v);
}));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) closeSheet(); });

// Tageswechsel um Mitternacht / beim Zurückkehren zur App
let lastToday = todayKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const t = todayKey();
  if (t !== lastToday) { if (day === lastToday) day = t; lastToday = t; render(); }
});

render();
if (!db.settings.goal) openSheet(viewSettings);

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

})();
