/* Hof-Maschinen – Maschinenverwaltung: Pickerl, Betriebsstunden, Wartung, Kosten. */
(() => {
const createStore = window.createStore;

const CFG = window.HOF_CONFIG || {};
const VERSION = '1.0';

// ---------- Icons ----------
const I = {
  traktor: '<svg viewBox="0 0 24 24"><circle cx="7" cy="16" r="3.5"/><circle cx="18" cy="17" r="2.5"/><path d="M4 12V7h7l2 5h6v5h-1M10.5 16h5M7 7V4"/></svg>',
  motorrad: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="16" r="3.5"/><circle cx="18.5" cy="16" r="3.5"/><path d="M5.5 16l4-6h5l4 6M9 7h3l2.5 3"/></svg>',
  auto: '<svg viewBox="0 0 24 24"><path d="M3 16v-4l2-5h14l2 5v4z"/><circle cx="7" cy="16.5" r="2"/><circle cx="17" cy="16.5" r="2"/></svg>',
  anhaenger: '<svg viewBox="0 0 24 24"><path d="M3 7h14v8H3zM17 13h4"/><circle cx="8" cy="17" r="2"/></svg>',
  geraet: '<svg viewBox="0 0 24 24"><path d="M14.5 6.5a4 4 0 0 0-5.3 5.2L4 17l3 3 5.3-5.2a4 4 0 0 0 5.2-5.3l-2.5 2.5-2.7-.6-.6-2.7z"/></svg>',
  sonstiges: '<svg viewBox="0 0 24 24"><path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8"/></svg>',
  service: '<svg viewBox="0 0 24 24"><path d="M14.5 6.5a4 4 0 0 0-5.3 5.2L4 17l3 3 5.3-5.2a4 4 0 0 0 5.2-5.3l-2.5 2.5-2.7-.6-.6-2.7z"/></svg>',
  repair: '<svg viewBox="0 0 24 24"><path d="M13 4l7 7-3 3-7-7zM10 7l-6 6 3 3 6-6M4 20l3-4"/></svg>',
  pickerl: '<svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="6"/><path d="M9 15.5L8 21l4-2 4 2-1-5.5M10 10l1.5 1.5L14 9"/></svg>',
  reading: '<svg viewBox="0 0 24 24"><path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/></svg>',
  fuel: '<svg viewBox="0 0 24 24"><path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M3 20h13M14 9h2l2 2v6a1.5 1.5 0 0 0 3 0V8l-3-3M7 8h5"/></svg>',
  other: '<svg viewBox="0 0 24 24"><path d="M6 4h9l4 4v12H6zM14 4v5h5M9 13h7M9 17h5"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
};

const TYPES = {
  traktor: { label: 'Traktor', unit: 'h', pickerl: true, intervals: [
    ['Motoröl + Ölfilter', 250, 12], ['Luftfilter', 500, 24], ['Getriebe- / Hydrauliköl', 1000, 24], ['Abschmieren', 50, 0]] },
  motorrad: { label: 'Motorrad', unit: 'km', pickerl: true, intervals: [
    ['Ölwechsel + Filter', 5000, 12], ['Kette reinigen & schmieren', 1000, 0], ['Zündkerze', 10000, 24]] },
  auto: { label: 'Auto / Pickup', unit: 'km', pickerl: true, intervals: [['Service', 15000, 12]] },
  anhaenger: { label: 'Anhänger', unit: '', pickerl: true, intervals: [['Bremsen & Lager prüfen', 0, 12]] },
  geraet: { label: 'Gerät / Maschine', unit: 'h', pickerl: false, intervals: [['Service', 100, 12]] },
  sonstiges: { label: 'Sonstiges', unit: '', pickerl: false, intervals: [] },
};
const KINDS = {
  service: { label: 'Service', title: 'Service' },
  repair: { label: 'Reparatur', title: 'Reparatur' },
  pickerl: { label: 'Pickerl', title: 'Pickerl-Überprüfung' },
  reading: { label: 'Stand', title: 'Stand abgelesen' },
  fuel: { label: 'Tanken', title: 'Getankt' },
  other: { label: 'Sonstiges', title: '' },
};
const UNIT_LABEL = { h: 'Betriebsstunden', km: 'Kilometerstand', '': 'kein Zähler' };

// ---------- Helfer ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const fmt = (n, d = 0) => (n == null ? '–' : Number(n).toLocaleString('de-AT', { maximumFractionDigits: d }));
const fmtIn = (n) => (n == null ? '' : String(Math.round(n * 10) / 10).replace('.', ','));
const EUR = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' });
const money = (n) => EUR.format(n || 0);
const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
const fmtDate = (s) => (s ? parseDay(s).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–');
const monthIdx = (ym) => { const [y, m] = ym.split('-').map(Number); return y * 12 + (m - 1); };
const idxToYm = (i) => `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
const fmtMonth = (ym) => { const [y, m] = ym.split('-'); return `${m}/${y}`; };
const addMonths = (day, n) => { const d = parseDay(day); const t = new Date(d.getFullYear(), d.getMonth() + n, 1); const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); t.setDate(Math.min(d.getDate(), last)); return isoDay(t); };
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
const uid = () => Math.random().toString(36).slice(2, 10);
const unitShort = (m) => m.unit || '';

// ---------- Zustand ----------
let store = null;
let user = null;
let DATA = { machines: [], entries: [] };
let tab = 'home';
let costYear = String(new Date().getFullYear());
let historyFilter = { machine: '', kind: '' };
const NAME_KEY = 'hofmaschinen_name';
const userName = () => { try { return localStorage.getItem(NAME_KEY) || (user && user.email ? user.email.split('@')[0] : ''); } catch (e) { return ''; } };

const machineById = (id) => DATA.machines.find((m) => m.id === id);
const entriesOf = (mid) => DATA.entries.filter((e) => e.machineId === mid);
const sortedMachines = () => [...DATA.machines].sort((a, b) => a.name.localeCompare(b.name, 'de'));
const sortedEntries = (list) => [...list].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));

// ---------- Status-Berechnung ----------
const RANK = { bad: 3, warn: 2, unknown: 1, ok: 0 };
function intervalStatus(m, iv) {
  const today = isoDay();
  const parts = [];
  let status = 'ok';
  let pct = 0;
  let known = false;
  if (iv.every && m.unit && iv.lastReading != null && m.reading != null) {
    known = true;
    const next = iv.lastReading + iv.every;
    const left = next - m.reading;
    pct = Math.max(pct, (m.reading - iv.lastReading) / iv.every);
    const s = left < 0 ? 'bad' : left <= iv.every * 0.1 ? 'warn' : 'ok';
    if (RANK[s] > RANK[status]) status = s;
    parts.push(left < 0 ? `${fmt(-left)} ${m.unit} überfällig` : `noch ${fmt(left)} ${m.unit} (bei ${fmt(next)})`);
  }
  if (iv.months && iv.lastDate) {
    known = true;
    const due = addMonths(iv.lastDate, iv.months);
    const total = daysBetween(iv.lastDate, due);
    const left = daysBetween(today, due);
    pct = Math.max(pct, total ? (total - left) / total : 1);
    const s = left < 0 ? 'bad' : left <= 30 ? 'warn' : 'ok';
    if (RANK[s] > RANK[status]) status = s;
    parts.push(left < 0 ? `seit ${fmtDate(due)} fällig` : `spätestens ${fmtDate(due)}`);
  }
  if (!known) return { status: 'unknown', pct: 0, text: 'Letzter Service noch nicht eingetragen' };
  return { status, pct: Math.min(Math.max(pct, 0), 1), text: parts.join(' · ') };
}
function pickerlStatus(m) {
  const p = m.pickerl || {};
  if (!p.required) return null;
  if (!p.due) return { status: 'unknown', short: 'Pickerl ?', text: 'Pickerl-Monat noch nicht eingetragen' };
  const now = monthIdx(isoDay().slice(0, 7));
  const due = monthIdx(p.due);
  const diff = now - due;
  if (diff < -1) return { status: 'ok', short: `Pickerl ${fmtMonth(p.due)}`, text: `Nächstes Pickerl: ${fmtMonth(p.due)}` };
  if (diff <= 0) return { status: 'warn', short: `Pickerl fällig`, text: `Pickerl jetzt fällig (${fmtMonth(p.due)}) – Begutachtung möglich` };
  if (diff <= 4) return { status: 'warn', short: 'Pickerl Nachfrist', text: `Pickerl ${fmtMonth(p.due)} – Nachfrist läuft bis Ende ${fmtMonth(idxToYm(due + 4))}` };
  return { status: 'bad', short: 'Pickerl abgelaufen', text: `Pickerl abgelaufen (${fmtMonth(p.due)}, Nachfrist vorbei)` };
}
function dueItems() {
  const items = [];
  DATA.machines.forEach((m) => {
    const p = pickerlStatus(m);
    if (p && (p.status === 'warn' || p.status === 'bad')) items.push({ m, kind: 'pickerl', label: 'Pickerl', text: p.text, status: p.status });
    (m.intervals || []).forEach((iv) => {
      const s = intervalStatus(m, iv);
      if (s.status === 'warn' || s.status === 'bad') items.push({ m, kind: 'service', label: iv.name, text: s.text, status: s.status });
    });
  });
  return items.sort((a, b) => RANK[b.status] - RANK[a.status] || a.m.name.localeCompare(b.m.name, 'de'));
}
function worstService(m) {
  let worst = null;
  (m.intervals || []).forEach((iv) => {
    const s = intervalStatus(m, iv);
    if (s.status !== 'unknown' && (!worst || RANK[s.status] > RANK[worst.status])) worst = { ...s, name: iv.name };
  });
  return worst;
}

// ---------- Toast ----------
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
function onStoreError(e) {
  const code = (e && e.code) || '';
  if (code.includes('permission-denied')) toast('Kein Zugriff – ist deine E-Mail in den Firestore-Regeln eingetragen?');
  else toast('Fehler beim Speichern: ' + (e && e.message ? e.message : code));
}

// ---------- Sheet ----------
let stack = [];
let current = null;
let cleanup = null;
function showView(view, keepScroll) {
  if (cleanup) { try { cleanup(); } catch (e) { /* */ } cleanup = null; }
  const body = $('#sheetBody');
  const scroll = keepScroll ? body.scrollTop : 0;
  current = view;
  const v = view();
  if (!v) { closeSheet(); return; }
  current.live = !!v.live;
  $('#sheetTitle').textContent = v.title;
  body.innerHTML = v.html;
  body.scrollTop = scroll;
  $('#sheet').classList.toggle('tall', !!v.tall);
  $('#sheetBack').hidden = stack.length === 0;
  $('#sheet').hidden = false;
  $('#overlay').hidden = false;
  document.body.style.overflow = 'hidden';
  if (v.mount) cleanup = v.mount(body) || null;
}
const openSheet = (view) => { stack = []; showView(view); };
const pushView = (view) => { if (current) stack.push(current); showView(view); };
const backView = () => (stack.length ? showView(stack.pop()) : closeSheet());
function closeSheet() {
  if (cleanup) { try { cleanup(); } catch (e) { /* */ } cleanup = null; }
  stack = []; current = null;
  $('#sheet').hidden = true; $('#overlay').hidden = true;
  document.body.style.overflow = '';
}

// ---------- Datei-Download (iPhone + Android) ----------
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
async function saveFile(name, mime, text) {
  const blob = new Blob([text], { type: mime });
  try {
    const file = new File([blob], name, { type: mime });
    if (isIOS() && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function openCalendar(name, ics) {
  if (isIOS()) { window.open('data:text/calendar;charset=utf-8,' + encodeURIComponent(ics)); return; }
  saveFile(name, 'text/calendar', ics);
}
function icsFor(m) {
  const events = [];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const add = (day, summary) => {
    const d = day.replace(/-/g, '');
    const next = isoDay(new Date(parseDay(day).getTime() + 86400000)).replace(/-/g, '');
    events.push(['BEGIN:VEVENT', `UID:${m.id}-${uid()}@hof-maschinen`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${summary.replace(/[,;]/g, ' ')}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${summary.replace(/[,;]/g, ' ')}`, 'TRIGGER:-P7D', 'END:VALARM', 'END:VEVENT'].join('\r\n'));
  };
  if (m.pickerl && m.pickerl.required && m.pickerl.due) add(`${m.pickerl.due}-01`, `Pickerl fällig: ${m.name}`);
  (m.intervals || []).forEach((iv) => { if (iv.months && iv.lastDate) add(addMonths(iv.lastDate, iv.months), `${iv.name} fällig: ${m.name}`); });
  if (!events.length) return null;
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hof-Maschinen//DE', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
}

// ---------- Hauptansichten ----------
function render() {
  $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
  const v = $('#view');
  if (tab === 'home') v.innerHTML = homeHtml();
  else if (tab === 'machines') v.innerHTML = machinesHtml();
  else if (tab === 'costs') v.innerHTML = costsHtml();
  else v.innerHTML = historyHtml();
  bindMain(v);
}

function machineIcon(m, status) {
  return `<span class="ico ${status || ''}">${I[m.type] || I.sonstiges}</span>`;
}
function entryRow(e, showMachine = true) {
  const m = machineById(e.machineId);
  const title = e.title || KINDS[e.kind]?.label || 'Eintrag';
  const sub = [fmtDate(e.date), showMachine && m ? m.name : '', e.reading != null && m && m.unit ? `${fmt(e.reading)} ${m.unit}` : '', e.by].filter(Boolean).join(' · ');
  return `<button class="list-item" data-entry="${esc(e.id)}">
    <span class="ico">${I[e.kind] || I.other}</span>
    <span class="info"><span class="name">${esc(title)}</span><small>${esc(sub)}</small></span>
    <span class="val num">${e.cost ? money(e.cost) : ''}</span></button>`;
}

function homeHtml() {
  if (!DATA.machines.length) {
    return `<div class="card"><h2>Willkommen!</h2>
      <p class="muted" style="margin-top:0">Leg zuerst deine Maschinen an. Danach siehst du hier auf einen Blick, wann Pickerl und Service fällig sind und was die Maschinen kosten.</p>
      <button class="btn primary" data-act="newMachine">${I.plus} Erste Maschine anlegen</button></div>`;
  }
  const due = dueItems();
  const bad = due.filter((d) => d.status === 'bad').length;
  const warn = due.length - bad;
  const year = String(new Date().getFullYear());
  const yearCost = DATA.entries.filter((e) => (e.date || '').startsWith(year)).reduce((s, e) => s + (e.cost || 0), 0);
  const recent = sortedEntries(DATA.entries).slice(0, 5);
  return `
    <div class="stats">
      <div class="stat"><b class="num">${DATA.machines.length}</b><small>Maschinen</small></div>
      <div class="stat ${bad ? 'bad' : ''}"><b class="num">${bad}</b><small>überfällig</small></div>
      <div class="stat ${warn ? 'warn' : ''}"><b class="num">${warn}</b><small>bald fällig</small></div>
    </div>
    <div class="section-title">Fällig</div>
    ${due.length ? `<div class="list">${due.map((d) => `
      <button class="list-item" data-machine="${esc(d.m.id)}">
        <span class="ico ${d.status}">${d.kind === 'pickerl' ? I.pickerl : I.service}</span>
        <span class="info"><span class="name">${esc(d.m.name)}</span><small class="wrap">${esc(d.label)}: ${esc(d.text)}</small></span>
      </button>`).join('')}</div>`
      : `<div class="list"><div class="list-item"><span class="ico ok">${I.check}</span><span class="info"><span class="name">Alles im grünen Bereich</span><small>Kein Pickerl und kein Service in den nächsten 30 Tagen fällig.</small></span></div></div>`}
    <div class="section-title">Kosten ${year}</div>
    <button class="card" data-tabgo="costs" style="display:block;width:100%;text-align:left">
      <div class="total num">${money(yearCost)}</div><small class="muted">für alle Maschinen · Details ansehen</small></button>
    <div class="section-title">Zuletzt eingetragen</div>
    ${recent.length ? `<div class="list">${recent.map((e) => entryRow(e)).join('')}</div>` : '<div class="empty">Noch keine Einträge. Tipp auf + um Stunden, Service oder Reparaturen einzutragen.</div>'}`;
}

function machinesHtml() {
  const list = sortedMachines();
  return `
    <button class="btn primary" data-act="newMachine" style="margin-bottom:14px">${I.plus} Maschine anlegen</button>
    ${list.length ? list.map((m) => {
      const p = pickerlStatus(m);
      const w = worstService(m);
      const badges = [];
      if (p) badges.push(`<span class="badge ${p.status === 'unknown' ? '' : p.status}">${esc(p.short)}</span>`);
      if (w) badges.push(`<span class="badge ${w.status}">${esc(w.name)}: ${w.status === 'bad' ? 'überfällig' : w.status === 'warn' ? 'bald' : 'ok'}</span>`);
      const status = [p && p.status, w && w.status].reduce((a, s) => (s && RANK[s] > RANK[a] ? s : a), 'ok');
      return `<button class="mcard" data-machine="${esc(m.id)}">
        <div class="top">${machineIcon(m, status === 'ok' ? '' : status === 'unknown' ? '' : status)}
          <div class="info"><h3>${esc(m.name)}</h3><div class="sub">${esc([TYPES[m.type]?.label, m.year, m.plate].filter(Boolean).join(' · '))}</div></div>
          ${m.unit ? `<div class="reading num">${fmt(m.reading)} ${esc(m.unit)}<small>${m.readingDate ? fmtDate(m.readingDate) : 'kein Stand'}</small></div>` : ''}
        </div>
        ${badges.length ? `<div class="badges">${badges.join('')}</div>` : ''}
      </button>`;
    }).join('') : '<div class="empty">Noch keine Maschinen angelegt.</div>'}`;
}

function costsHtml() {
  const years = new Set([String(new Date().getFullYear())]);
  DATA.entries.forEach((e) => e.date && years.add(e.date.slice(0, 4)));
  const yrs = [...years].sort().reverse();
  if (!yrs.includes(costYear)) costYear = yrs[0];
  const ents = DATA.entries.filter((e) => (e.date || '').startsWith(costYear) && e.cost);
  const total = ents.reduce((s, e) => s + e.cost, 0);
  const byMachine = {};
  const byKind = {};
  ents.forEach((e) => {
    byMachine[e.machineId] = (byMachine[e.machineId] || 0) + e.cost;
    byKind[e.kind] = (byKind[e.kind] || 0) + e.cost;
  });
  const bars = (obj, label) => {
    const rows = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...rows.map((r) => r[1]), 1);
    return rows.map(([k, v]) => `<div class="cbar"><div class="lbl"><span>${esc(label(k))}</span><span class="num">${money(v)}</span></div>
      <div class="track"><div class="fill" style="width:${(v / max) * 100}%"></div></div></div>`).join('');
  };
  return `
    <div class="seg">${yrs.map((y) => `<button data-year="${y}" class="${y === costYear ? 'on' : ''}">${y}</button>`).join('')}</div>
    <div class="card"><small class="muted">Gesamtkosten ${costYear}</small><div class="total num">${money(total)}</div>
      <small class="muted">${ents.length} ${ents.length === 1 ? 'Eintrag' : 'Einträge'} mit Kosten</small></div>
    ${ents.length ? `
      <div class="card"><h2>Nach Maschine</h2>${bars(byMachine, (id) => (machineById(id) || {}).name || 'Gelöschte Maschine')}</div>
      <div class="card"><h2>Nach Art</h2>${bars(byKind, (k) => KINDS[k]?.label || k)}</div>` : '<div class="empty">In diesem Jahr wurden noch keine Kosten eingetragen.</div>'}
    <button class="btn" data-act="csv">${I.down} ${costYear} als Tabelle exportieren (CSV)</button>
    <p class="hint">Die CSV-Datei lässt sich in Excel oder Google Tabellen öffnen – praktisch für die Buchhaltung.</p>`;
}

function historyHtml() {
  let list = DATA.entries;
  if (historyFilter.machine) list = list.filter((e) => e.machineId === historyFilter.machine);
  if (historyFilter.kind) list = list.filter((e) => e.kind === historyFilter.kind);
  list = sortedEntries(list);
  const groups = {};
  list.forEach((e) => { const k = (e.date || '').slice(0, 7); (groups[k] = groups[k] || []).push(e); });
  return `
    <div class="row" style="margin-bottom:6px">
      <select class="input" id="hMachine"><option value="">Alle Maschinen</option>${sortedMachines().map((m) => `<option value="${esc(m.id)}" ${m.id === historyFilter.machine ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
      <select class="input" id="hKind"><option value="">Alle Arten</option>${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${k === historyFilter.kind ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
    </div>
    ${list.length ? Object.entries(groups).map(([ym, es]) => `
      <div class="section-title">${esc(ym ? parseDay(ym + '-01').toLocaleDateString('de-AT', { month: 'long', year: 'numeric' }) : 'Ohne Datum')}</div>
      <div class="list">${es.map((e) => entryRow(e, !historyFilter.machine)).join('')}</div>`).join('')
      : '<div class="empty">Keine Einträge gefunden.</div>'}`;
}

function bindMain(v) {
  $$('[data-act="newMachine"]', v).forEach((b) => (b.onclick = () => openSheet(viewMachineForm(null))));
  $$('[data-machine]', v).forEach((b) => (b.onclick = () => openSheet(viewMachine(b.dataset.machine))));
  $$('[data-entry]', v).forEach((b) => (b.onclick = () => { const e = DATA.entries.find((x) => x.id === b.dataset.entry); if (e) openSheet(viewEntryForm({ entry: e })); }));
  $$('[data-tabgo]', v).forEach((b) => (b.onclick = () => { tab = b.dataset.tabgo; render(); window.scrollTo(0, 0); }));
  $$('[data-year]', v).forEach((b) => (b.onclick = () => { costYear = b.dataset.year; render(); }));
  const csv = $('[data-act="csv"]', v);
  if (csv) csv.onclick = () => exportCsv(costYear);
  const hm = $('#hMachine', v);
  if (hm) {
    hm.onchange = () => { historyFilter.machine = hm.value; render(); };
    $('#hKind', v).onchange = (ev) => { historyFilter.kind = ev.target.value; render(); };
  }
}

// ---------- Ansicht: Maschinen-Details ----------
function viewMachine(id) {
  const view = () => {
    const m = machineById(id);
    if (!m) return { title: 'Maschine', live: true, html: '<div class="empty">Wird geladen … (oder die Maschine wurde gelöscht)</div>' };
    const p = pickerlStatus(m);
    const ents = sortedEntries(entriesOf(id));
    const year = String(new Date().getFullYear());
    const total = ents.reduce((s, e) => s + (e.cost || 0), 0);
    const yearCost = ents.filter((e) => (e.date || '').startsWith(year)).reduce((s, e) => s + (e.cost || 0), 0);
    const readings = ents.map((e) => e.reading).filter((r) => r != null).concat(m.reading != null ? [m.reading] : []);
    const span = readings.length > 1 ? Math.max(...readings) - Math.min(...readings) : 0;
    const perUnit = span > 0 && total ? (total / span) * (m.unit === 'km' ? 100 : 1) : null;
    const ivs = m.intervals || [];
    return {
      title: m.name,
      tall: true,
      live: true,
      html: `
        <div class="detail-head">${machineIcon(m)}<div><h3>${esc(m.name)}</h3>
          <small>${esc([TYPES[m.type]?.label, m.year && `Baujahr ${m.year}`, m.plate].filter(Boolean).join(' · '))}</small></div></div>
        <div class="btn-row">
          ${m.unit ? `<button class="btn" data-new="reading">${I.reading}${m.unit === 'h' ? 'Stunden' : 'Kilometer'}</button>` : ''}
          <button class="btn" data-new="service">${I.service}Service</button>
          <button class="btn" data-new="repair">${I.repair}Reparatur</button>
          ${m.pickerl && m.pickerl.required ? `<button class="btn" data-new="pickerl">${I.pickerl}Pickerl</button>` : `<button class="btn" data-new="fuel">${I.fuel}Tanken</button>`}
        </div>
        <div class="card">
          ${m.unit ? `<small class="muted">${UNIT_LABEL[m.unit]}</small>
            <div class="total num">${fmt(m.reading)} ${esc(m.unit)}</div>
            <small class="muted">${m.readingDate ? 'Stand vom ' + fmtDate(m.readingDate) : 'Noch kein Stand eingetragen'}</small>` : ''}
          ${p ? `<div class="badges" style="margin-top:${m.unit ? '10px' : '0'}"><span class="badge ${p.status === 'unknown' ? '' : p.status}">${esc(p.text)}</span></div>` : ''}
        </div>
        <div class="section-title">Wartung</div>
        ${ivs.length ? `<div class="list">${ivs.map((iv) => {
          const s = intervalStatus(m, iv);
          const rule = [iv.every && m.unit ? `alle ${fmt(iv.every)} ${m.unit}` : '', iv.months ? `alle ${iv.months} Monate` : ''].filter(Boolean).join(' oder ');
          return `<div class="interval">
            <div class="row1"><b>${esc(iv.name)}</b><span class="badge ${s.status === 'unknown' ? '' : s.status}">${s.status === 'bad' ? 'überfällig' : s.status === 'warn' ? 'bald fällig' : s.status === 'ok' ? 'ok' : 'unbekannt'}</span></div>
            ${s.status !== 'unknown' ? `<div class="bar"><i class="${s.status}" style="width:${Math.round(s.pct * 100)}%"></i></div>` : ''}
            <small>${esc(s.text)}${rule ? ' · ' + esc(rule) : ''}${iv.lastDate ? ` · zuletzt ${fmtDate(iv.lastDate)}${iv.lastReading != null && m.unit ? ` bei ${fmt(iv.lastReading)} ${m.unit}` : ''}` : ''}</small>
            ${s.status === 'unknown' ? `<div style="margin-top:8px"><button class="btn small" data-last="${esc(iv.id)}">Letzten Service eintragen</button></div>` : ''}
          </div>`;
        }).join('')}</div>` : '<div class="empty">Keine Wartungsintervalle. Über „Bearbeiten“ kannst du welche anlegen.</div>'}
        ${icsFor(m) ? `<button class="btn" id="mCal" style="margin-top:12px">${I.cal} Termine in den Kalender übernehmen</button>` : ''}
        <div class="section-title">Kosten</div>
        <div class="stats">
          <div class="stat"><b class="num">${money(yearCost)}</b><small>${year}</small></div>
          <div class="stat"><b class="num">${money(total)}</b><small>gesamt</small></div>
          <div class="stat"><b class="num">${perUnit != null ? money(perUnit) : '–'}</b><small>pro ${m.unit === 'km' ? '100 km' : m.unit || 'Einheit'}</small></div>
        </div>
        ${m.notes || m.vin ? `<div class="section-title">Daten</div><div class="panel"><dl class="kv" style="margin:0">
          ${m.vin ? `<dt>Fahrgestellnr.</dt><dd>${esc(m.vin)}</dd>` : ''}
          ${m.notes ? `<dt>Notizen</dt><dd style="white-space:pre-wrap;text-align:left">${esc(m.notes)}</dd>` : ''}</dl></div>` : ''}
        <div class="section-title">Verlauf</div>
        ${ents.length ? `<div class="list">${ents.map((e) => entryRow(e, false)).join('')}</div>` : '<div class="empty">Noch keine Einträge für diese Maschine.</div>'}
        <button class="btn" id="mEdit" style="margin-top:16px">${I.edit} Maschine bearbeiten</button>`,
      mount(body) {
        $$('[data-new]', body).forEach((b) => (b.onclick = () => pushView(viewEntryForm({ machineId: id, kind: b.dataset.new }))));
        $$('[data-last]', body).forEach((b) => (b.onclick = () => pushView(viewEntryForm({ machineId: id, kind: 'service', preset: [b.dataset.last], past: true }))));
        $$('[data-entry]', body).forEach((b) => (b.onclick = () => { const e = DATA.entries.find((x) => x.id === b.dataset.entry); if (e) pushView(viewEntryForm({ entry: e })); }));
        $('#mEdit', body).onclick = () => pushView(viewMachineForm(id));
        const cal = $('#mCal', body);
        if (cal) cal.onclick = () => openCalendar(`${m.name}-termine.ics`, icsFor(m));
      },
    };
  };
  view.machineId = id;
  return view;
}

// ---------- Ansicht: Maschine anlegen / bearbeiten ----------
function defaultIntervals(type) {
  return (TYPES[type]?.intervals || []).map(([name, every, months]) => ({ id: uid(), name, every: every || null, months: months || null, lastReading: null, lastDate: null }));
}
function viewMachineForm(id) {
  return () => {
    const existing = id ? machineById(id) : null;
    const m = existing ? JSON.parse(JSON.stringify(existing)) : {
      name: '', type: 'traktor', year: '', plate: '', vin: '', unit: 'h', reading: null, readingDate: null,
      pickerl: { required: true, due: '', interval: 12 }, intervals: defaultIntervals('traktor'), notes: '',
    };
    let ivs = m.intervals || [];
    const names = new Set(DATA.machines.map((x) => x.name.toLowerCase()));
    const sugg = !existing ? (CFG.vorschlaege || []).filter((s) => !names.has(s.name.toLowerCase())) : [];
    const typeOpts = Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${k === m.type ? 'selected' : ''}>${t.label}</option>`).join('');
    const unitOpts = Object.entries({ h: 'Stunden (h)', km: 'Kilometer', '': 'Kein Zähler' }).map(([k, l]) => `<option value="${k}" ${k === (m.unit || '') ? 'selected' : ''}>${l}</option>`).join('');
    return {
      title: existing ? 'Maschine bearbeiten' : 'Neue Maschine',
      tall: true,
      html: `
        ${sugg.length ? `<div class="section-title">Vorschläge</div><div class="seg">${sugg.map((s, i) => `<button type="button" data-sugg="${i}">${esc(s.name)}</button>`).join('')}</div>` : ''}
        <label class="field"><span>Name</span><input class="input" id="fName" value="${esc(m.name)}" placeholder="z. B. Steyr 768" autocomplete="off"></label>
        <div class="grid2">
          <label class="field"><span>Art</span><select class="input" id="fType">${typeOpts}</select></label>
          <label class="field"><span>Baujahr</span><input class="input num" id="fYear" inputmode="numeric" value="${esc(m.year)}"></label>
          <label class="field"><span>Kennzeichen</span><input class="input" id="fPlate" value="${esc(m.plate)}" autocapitalize="characters"></label>
          <label class="field"><span>Fahrgestellnr.</span><input class="input" id="fVin" value="${esc(m.vin)}" autocapitalize="characters"></label>
          <label class="field"><span>Zähler</span><select class="input" id="fUnit">${unitOpts}</select></label>
          <label class="field" id="fReadingWrap"><span>Aktueller Stand</span><input class="input num" id="fReading" inputmode="decimal" value="${fmtIn(m.reading)}"></label>
        </div>

        <div class="section-title">Pickerl (§57a)</div>
        <div class="panel">
          <label class="switch-row"><span>Braucht ein Pickerl</span><input type="checkbox" id="fPickReq" ${m.pickerl && m.pickerl.required ? 'checked' : ''}></label>
          <div id="fPickWrap">
            <div class="grid2">
              <label class="field"><span>Nächstes Pickerl (Monat)</span><input class="input" id="fPickDue" type="month" value="${esc((m.pickerl && m.pickerl.due) || '')}"></label>
              <label class="field"><span>Intervall</span><select class="input" id="fPickInt">
                ${[12, 24, 36].map((n) => `<option value="${n}" ${(m.pickerl && +m.pickerl.interval === n) ? 'selected' : ''}>${n === 12 ? 'jährlich' : `alle ${n / 12} Jahre`}</option>`).join('')}</select></label>
            </div>
            <p class="hint" style="margin:0">Den Monat findest du auf der Plakette (gelochter Monat). Traktoren bis 25 km/h brauchen kein Pickerl, bis 40 km/h gilt 3-2-1, darüber jährlich.</p>
          </div>
        </div>

        <div class="section-title">Wartungsintervalle</div>
        <div class="panel">
          <div class="iv-head"><span>Was</span><span id="ivUnitHead">alle ${esc(m.unit || '–')}</span><span>Monate</span><span></span></div>
          <div id="ivList"></div>
          <button type="button" class="btn small" id="ivAdd">${I.plus} Intervall</button>
          <p class="hint" style="margin-bottom:0">Fällig ist, was zuerst erreicht wird. Leer lassen, wenn es nicht zählt.</p>
        </div>

        <label class="field"><span>Notizen (Ölsorte, Reifengröße, Ersatzteilnummern …)</span><textarea class="input" id="fNotes" rows="3">${esc(m.notes)}</textarea></label>
        <button class="btn primary" id="fSave">Speichern</button>
        ${existing ? `<button class="btn danger" id="fDel">${I.trash} Maschine löschen</button>` : ''}`,
      mount(body) {
        const typeSel = $('#fType', body);
        const unitSel = $('#fUnit', body);
        let ivTouched = !!existing;
        const renderIvs = () => {
          $('#ivList', body).innerHTML = ivs.map((iv, i) => `<div class="iv-row">
            <input class="input" data-iv-name="${i}" value="${esc(iv.name)}" placeholder="z. B. Ölwechsel">
            <input class="input num" data-iv-every="${i}" inputmode="numeric" value="${iv.every ?? ''}" ${unitSel.value ? '' : 'disabled'}>
            <input class="input num" data-iv-months="${i}" inputmode="numeric" value="${iv.months ?? ''}">
            <button type="button" class="icon-btn" data-iv-del="${i}" aria-label="Entfernen">${I.trash}</button></div>`).join('') || '<div class="empty" style="padding:8px">Keine Intervalle</div>';
          $$('[data-iv-name]', body).forEach((el) => (el.oninput = () => { ivs[+el.dataset.ivName].name = el.value; ivTouched = true; }));
          $$('[data-iv-every]', body).forEach((el) => (el.oninput = () => { ivs[+el.dataset.ivEvery].every = num(el.value); ivTouched = true; }));
          $$('[data-iv-months]', body).forEach((el) => (el.oninput = () => { ivs[+el.dataset.ivMonths].months = num(el.value); ivTouched = true; }));
          $$('[data-iv-del]', body).forEach((el) => (el.onclick = () => { ivs.splice(+el.dataset.ivDel, 1); ivTouched = true; renderIvs(); }));
          $('#ivUnitHead', body).textContent = `alle ${unitSel.value || '–'}`;
        };
        const syncPick = () => { $('#fPickWrap', body).hidden = !$('#fPickReq', body).checked; };
        const syncUnit = () => { $('#fReadingWrap', body).hidden = !unitSel.value; renderIvs(); };
        typeSel.onchange = () => {
          const t = TYPES[typeSel.value];
          if (!existing) {
            unitSel.value = t.unit;
            $('#fPickReq', body).checked = t.pickerl;
            if (!ivTouched) ivs = defaultIntervals(typeSel.value);
          }
          syncPick(); syncUnit();
        };
        unitSel.onchange = syncUnit;
        $('#fPickReq', body).onchange = syncPick;
        $('#ivAdd', body).onclick = () => { ivs.push({ id: uid(), name: '', every: null, months: null, lastReading: null, lastDate: null }); ivTouched = true; renderIvs(); };
        $$('[data-sugg]', body).forEach((b) => (b.onclick = () => {
          const s = sugg[+b.dataset.sugg];
          $('#fName', body).value = s.name;
          if (s.type && TYPES[s.type]) { typeSel.value = s.type; typeSel.onchange(); }
          $$('[data-sugg]', body).forEach((x) => x.classList.toggle('on', x === b));
        }));
        syncPick(); syncUnit();

        $('#fSave', body).onclick = () => {
          const name = $('#fName', body).value.trim();
          if (!name) { toast('Bitte einen Namen eingeben'); $('#fName', body).focus(); return; }
          const unit = unitSel.value;
          const reading = unit ? num($('#fReading', body).value) : null;
          const oldReading = existing ? existing.reading : null;
          const data = {
            name, type: typeSel.value, year: $('#fYear', body).value.trim(), plate: $('#fPlate', body).value.trim(),
            vin: $('#fVin', body).value.trim(), unit, reading,
            readingDate: reading != null && reading !== oldReading ? isoDay() : (existing ? existing.readingDate || null : null),
            pickerl: { required: $('#fPickReq', body).checked, due: $('#fPickDue', body).value || '', interval: +$('#fPickInt', body).value },
            intervals: ivs.filter((iv) => iv.name.trim()).map((iv) => ({ ...iv, name: iv.name.trim(), every: unit ? iv.every : null })),
            notes: $('#fNotes', body).value.trim(),
            updatedAt: Date.now(), updatedBy: userName(),
          };
          if (!existing) data.createdAt = Date.now();
          const newId = store.saveMachine(id, data);
          toast(existing ? 'Gespeichert' : `${name} angelegt`);
          if (existing) backView();
          else { tab = 'machines'; render(); openSheet(viewMachine(newId)); }
        };
        if (existing) {
          $('#fDel', body).onclick = () => {
            const n = entriesOf(id).length;
            if (!confirm(`„${existing.name}“ wirklich löschen?${n ? ` Dabei werden auch ${n} Einträge gelöscht.` : ''}`)) return;
            store.deleteMachine(id, entriesOf(id).map((e) => e.id));
            closeSheet(); toast('Gelöscht');
          };
        }
      },
    };
  };
}

// ---------- Ansicht: Eintrag ----------
function viewEntryForm({ machineId, kind, entry, preset, past }) {
  return () => {
    if (!DATA.machines.length) {
      return { title: 'Neuer Eintrag', html: `<div class="empty">Leg zuerst eine Maschine an.</div><button class="btn primary" id="toNew">${I.plus} Maschine anlegen</button>`,
        mount(body) { $('#toNew', body).onclick = () => pushView(viewMachineForm(null)); } };
    }
    const e = entry || {};
    let mid = e.machineId || machineId || (DATA.machines.length === 1 ? DATA.machines[0].id : '');
    let k = e.kind || kind || 'service';
    const sel = new Set(e.intervals || preset || []);
    return {
      title: entry ? 'Eintrag bearbeiten' : past ? 'Letzten Service eintragen' : 'Neuer Eintrag',
      tall: true,
      html: `
        <label class="field"><span>Maschine</span><select class="input" id="eMachine">
          ${mid ? '' : '<option value="">Bitte wählen …</option>'}
          ${sortedMachines().map((m) => `<option value="${esc(m.id)}" ${m.id === mid ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
        <div class="seg" id="eKind">${Object.entries(KINDS).map(([key, v]) => `<button type="button" data-kind="${key}" class="${key === k ? 'on' : ''}">${v.label}</button>`).join('')}</div>
        ${past ? '<div class="note-box">Trag ein, wann und bei welchem Stand das zuletzt gemacht wurde – ab dann rechnet die App die nächste Fälligkeit aus.</div>' : ''}
        <div class="grid2">
          <label class="field"><span>Datum</span><input class="input" id="eDate" type="date" value="${esc(e.date || isoDay())}"></label>
          <label class="field" id="eReadingWrap"><span id="eReadingLbl">Stand</span><input class="input num" id="eReading" inputmode="decimal"></label>
        </div>
        <label class="field" id="eTitleWrap"><span>Was wurde gemacht?</span><input class="input" id="eTitle" value="${esc(e.title || '')}" autocomplete="off"></label>
        <div id="eIvWrap" class="panel"></div>
        <div id="ePickWrap" class="panel">
          <div class="grid2">
            <label class="field"><span>Ergebnis</span><select class="input" id="ePickRes">
              <option value="ok" ${e.pickerlResult !== 'maengel' ? 'selected' : ''}>Bestanden</option>
              <option value="maengel" ${e.pickerlResult === 'maengel' ? 'selected' : ''}>Mit Mängeln</option></select></label>
            <label class="field"><span>Nächstes Pickerl</span><input class="input" id="ePickNext" type="month" value="${esc(e.pickerlNext || '')}"></label>
          </div>
        </div>
        <div class="grid2">
          <label class="field"><span>Kosten (€)</span><input class="input num" id="eCost" inputmode="decimal" value="${fmtIn(e.cost)}" placeholder="0,00"></label>
          <label class="field" id="eLitersWrap"><span>Liter</span><input class="input num" id="eLiters" inputmode="decimal" value="${fmtIn(e.liters)}"></label>
        </div>
        <label class="field"><span>Notiz (Teile, Werkstatt, Ölsorte …)</span><textarea class="input" id="eNote" rows="2">${esc(e.note || '')}</textarea></label>
        <button class="btn primary" id="eSave">Speichern</button>
        ${entry ? `<button class="btn danger" id="eDel">${I.trash} Eintrag löschen</button>
          <p class="hint">Eingetragen ${e.by ? 'von ' + esc(e.by) + ' ' : ''}am ${fmtDate(e.date)}. Änderungen hier passen den Maschinenstand nicht rückwirkend an.</p>` : ''}`,
      mount(body) {
        const machineSel = $('#eMachine', body);
        const readingIn = $('#eReading', body);
        let readingTouched = !!entry;
        if (entry) readingIn.value = fmtIn(e.reading);
        readingIn.oninput = () => { readingTouched = true; };
        const machine = () => machineById(mid);
        const sync = () => {
          const m = machine();
          $$('#eKind button', body).forEach((b) => b.classList.toggle('on', b.dataset.kind === k));
          const unit = m ? m.unit : '';
          $('#eReadingWrap', body).hidden = !unit;
          $('#eReadingLbl', body).textContent = unit === 'km' ? 'Kilometerstand' : 'Betriebsstunden';
          if (!readingTouched) readingIn.value = entry ? fmtIn(e.reading) : (m && m.reading != null && !past ? fmtIn(m.reading) : '');
          $('#eTitle', body).placeholder = k === 'repair' ? 'z. B. Kupplung getauscht' : k === 'other' ? 'z. B. Reifen gekauft' : KINDS[k].title;
          $('#eTitleWrap', body).hidden = k === 'reading';
          $('#eLitersWrap', body).hidden = k !== 'fuel';
          // Intervalle (nur bei Service)
          const ivs = (m && m.intervals) || [];
          const ivWrap = $('#eIvWrap', body);
          ivWrap.hidden = k !== 'service' || !ivs.length;
          ivWrap.innerHTML = `<small class="muted">Erledigt (setzt die Fälligkeit zurück):</small>` +
            ivs.map((iv) => `<label class="check"><input type="checkbox" data-ivsel="${esc(iv.id)}" ${sel.has(iv.id) ? 'checked' : ''}><span>${esc(iv.name)}</span></label>`).join('');
          $$('[data-ivsel]', ivWrap).forEach((c) => (c.onchange = () => { if (c.checked) sel.add(c.dataset.ivsel); else sel.delete(c.dataset.ivsel); }));
          // Pickerl
          $('#ePickWrap', body).hidden = k !== 'pickerl';
          if (k === 'pickerl' && !$('#ePickNext', body).value && m) {
            const p = m.pickerl || {};
            const base = p.due || isoDay().slice(0, 7);
            $('#ePickNext', body).value = idxToYm(monthIdx(base) + (+p.interval || 12));
          }
        };
        machineSel.onchange = () => { mid = machineSel.value; readingTouched = false; sel.clear(); sync(); };
        $$('#eKind button', body).forEach((b) => (b.onclick = () => { k = b.dataset.kind; sync(); }));
        sync();

        $('#eSave', body).onclick = () => {
          const m = machine();
          if (!m) { toast('Bitte eine Maschine wählen'); return; }
          const date = $('#eDate', body).value || isoDay();
          const reading = m.unit ? num(readingIn.value) : null;
          if (k === 'reading' && reading == null) { toast('Bitte den Stand eingeben'); readingIn.focus(); return; }
          const cost = num($('#eCost', body).value);
          const data = {
            machineId: m.id, kind: k, date, reading,
            title: k === 'reading' ? '' : ($('#eTitle', body).value.trim() || KINDS[k].title),
            cost: cost && cost > 0 ? Math.round(cost * 100) / 100 : 0,
            liters: k === 'fuel' ? num($('#eLiters', body).value) : null,
            note: $('#eNote', body).value.trim(),
            intervals: k === 'service' ? [...sel] : [],
            pickerlResult: k === 'pickerl' ? $('#ePickRes', body).value : null,
            pickerlNext: k === 'pickerl' ? ($('#ePickNext', body).value || null) : null,
            updatedAt: Date.now(),
          };
          if (!entry) { data.by = userName(); data.createdAt = Date.now(); }
          // Maschine aktualisieren
          const patch = {};
          if (reading != null && (m.reading == null || reading > m.reading)) { patch.reading = reading; patch.readingDate = date; }
          if (k === 'service' && sel.size) {
            patch.intervals = (m.intervals || []).map((iv) => (sel.has(iv.id) && (!iv.lastDate || date >= iv.lastDate)
              ? { ...iv, lastDate: date, lastReading: reading != null ? reading : (m.reading ?? null) } : iv));
          }
          if (k === 'pickerl' && data.pickerlNext) patch.pickerl = { ...(m.pickerl || {}), required: true, due: data.pickerlNext };
          store.saveEntry(entry ? entry.id : null, data, m.id, Object.keys(patch).length ? patch : null);
          toast('Gespeichert');
          backView();
        };
        if (entry) $('#eDel', body).onclick = () => { if (confirm('Eintrag löschen?')) { store.deleteEntry(entry.id); toast('Gelöscht'); backView(); } };
      },
    };
  };
}

// ---------- Ansicht: Einstellungen ----------
function viewSettings() {
  return {
    title: 'Einstellungen',
    tall: true,
    html: `
      <div class="section-title">Du</div>
      <div class="panel">
        <label class="field"><span>Dein Name (steht bei deinen Einträgen)</span><input class="input" id="sName" value="${esc(userName())}" autocomplete="name"></label>
        <button class="btn" id="sNameSave">Name speichern</button>
      </div>
      <div class="section-title">Konto</div>
      <div class="panel">
        ${store.mode === 'demo'
          ? '<p class="hint" style="margin-top:0">Die App läuft im <b>Demo-Modus</b>: Alle Daten bleiben nur auf diesem Gerät. Damit alle am Hof dieselben Daten sehen, trag die Firebase-Zugangsdaten in <code>config.js</code> ein (siehe ANLEITUNG.md).</p>'
          : `<p class="hint" style="margin-top:0">Angemeldet als <b>${esc(user.email)}</b></p><button class="btn" id="sLogout">Abmelden</button>`}
      </div>
      <div class="section-title">Daten</div>
      <div class="panel">
        <button class="btn" id="sCsv">${I.down} Alle Einträge als CSV</button>
        <button class="btn" id="sJson">${I.down} Komplett-Backup (JSON)</button>
        <button class="btn" id="sImport">Backup importieren</button>
        <input type="file" id="sImportFile" accept="application/json,.json" hidden>
      </div>
      <p class="hint" style="text-align:center">Hof-Maschinen ${VERSION} · ${DATA.machines.length} Maschinen · ${DATA.entries.length} Einträge</p>`,
    mount(body) {
      $('#sNameSave', body).onclick = () => { try { localStorage.setItem(NAME_KEY, $('#sName', body).value.trim()); } catch (e) { /* */ } toast('Name gespeichert'); };
      const lo = $('#sLogout', body);
      if (lo) lo.onclick = async () => { await store.signOut(); closeSheet(); };
      $('#sCsv', body).onclick = () => exportCsv(null);
      $('#sJson', body).onclick = () => saveFile(`hof-maschinen-backup-${isoDay()}.json`, 'application/json',
        JSON.stringify({ app: 'hof-maschinen', version: VERSION, exported: new Date().toISOString(), machines: DATA.machines, entries: DATA.entries }, null, 1));
      $('#sImport', body).onclick = () => $('#sImportFile', body).click();
      $('#sImportFile', body).onchange = async (ev) => {
        const f = ev.target.files[0];
        ev.target.value = '';
        if (!f) return;
        try {
          const d = JSON.parse(await f.text());
          if (!Array.isArray(d.machines) || !Array.isArray(d.entries)) throw new Error();
          if (!confirm(`${d.machines.length} Maschinen und ${d.entries.length} Einträge importieren? Gleiche Einträge werden überschrieben.`)) return;
          d.machines.forEach(({ id, ...m }) => store.saveMachine(id, m));
          d.entries.forEach(({ id, ...e }) => store.saveEntry(id, e));
          toast('Backup importiert');
          closeSheet();
        } catch (e) { toast('Diese Datei ist kein gültiges Backup'); }
      };
    },
  };
}

function exportCsv(year) {
  const csvCell = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const dec = (n) => (n == null || n === '' ? '' : String(n).replace('.', ','));
  const rows = [['Datum', 'Maschine', 'Art', 'Was', 'Stand', 'Einheit', 'Liter', 'Kosten (EUR)', 'Notiz', 'Eingetragen von']];
  sortedEntries(DATA.entries).reverse().filter((e) => !year || (e.date || '').startsWith(year)).forEach((e) => {
    const m = machineById(e.machineId) || {};
    rows.push([fmtDate(e.date), m.name || '', KINDS[e.kind]?.label || e.kind, e.title || '', dec(e.reading), m.unit || '', dec(e.liters), dec(e.cost || 0), e.note || '', e.by || '']);
  });
  const text = '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
  saveFile(`hof-maschinen-${year || 'alle'}.csv`, 'text/csv', text);
}

// ---------- Login ----------
function showLogin() {
  $('#boot').hidden = true;
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#loginTitle').textContent = CFG.hofName || 'Hof-Maschinen';
  const err = $('#loginErr');
  $('#loginForm').onsubmit = async (ev) => {
    ev.preventDefault();
    err.hidden = true;
    $('#loginBtn').disabled = true;
    try { await store.signIn($('#loginEmail').value.trim(), $('#loginPw').value); }
    catch (e) {
      const c = e.code || '';
      err.textContent = c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') ? 'E-Mail oder Passwort stimmt nicht.'
        : c.includes('too-many-requests') ? 'Zu viele Versuche – warte kurz.'
        : c.includes('network') ? 'Keine Internetverbindung.' : 'Anmeldung fehlgeschlagen (' + c + ')';
      err.hidden = false;
    } finally { $('#loginBtn').disabled = false; }
  };
  $('#forgotPw').onclick = async () => {
    const email = $('#loginEmail').value.trim();
    if (!email) { err.textContent = 'Gib zuerst deine E-Mail-Adresse ein.'; err.hidden = false; return; }
    try { await store.resetPassword(email); toast('E-Mail zum Zurücksetzen wurde gesendet'); }
    catch (e) { err.textContent = 'Konnte keine E-Mail senden.'; err.hidden = false; }
  };
}

// ---------- Start ----------
let unsubscribe = null;
function startApp() {
  $('#boot').hidden = true;
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#hofName').textContent = CFG.hofName || 'Hof-Maschinen';
  $('#demoBanner').hidden = store.mode !== 'demo';
  if (unsubscribe) unsubscribe();
  unsubscribe = store.subscribe((snap) => {
    DATA = { machines: snap.machines, entries: snap.entries };
    $('#syncState').textContent = store.mode === 'demo' ? 'Demo-Modus'
      : snap.offline || !navigator.onLine ? 'Offline – wird später synchronisiert'
        : snap.pending ? 'Wird synchronisiert …' : 'Synchronisiert';
    render();
    if (current && current.live) showView(current, true);
  });
}

async function boot() {
  $$('.tab').forEach((t) => (t.onclick = () => { tab = t.dataset.tab; render(); window.scrollTo(0, 0); }));
  $('#fab').onclick = () => openSheet(viewEntryForm({}));
  $('#openSettings').onclick = () => openSheet(viewSettings);
  $('#sheetClose').onclick = closeSheet;
  $('#sheetBack').onclick = backView;
  $('#overlay').onclick = closeSheet;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) closeSheet(); });
  window.addEventListener('online', () => render());
  try {
    store = await createStore(CFG, onStoreError);
  } catch (e) {
    $('#boot').innerHTML = '<div class="err-box" style="margin:20px">Die App konnte nicht starten. Bist du online? Beim ersten Start wird eine Internetverbindung benötigt.</div>';
    return;
  }
  store.onAuth((u) => {
    user = u;
    if (u) startApp();
    else { if (unsubscribe) { unsubscribe(); unsubscribe = null; } closeSheet(); showLogin(); }
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
})();
