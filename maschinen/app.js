/* Hof-Maschinen – Maschinenverwaltung: Pickerl, Betriebsstunden, Wartung, Kosten. */
(() => {
const createStore = window.createStore;

const CFG = window.HOF_CONFIG || {};
const VERSION = '1.2';

// ---------- Icons ----------
const I = {
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  qr: '<svg viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/></svg>',
  field: '<svg viewBox="0 0 24 24"><path d="M3 18l5-10 5 6 3-4 5 8z"/><path d="M3 21h18"/></svg>',
  bale: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 12h.01"/></svg>',
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
let DATA = { machines: [], entries: [], harvest: [] };
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
  else if (tab === 'ernte') v.innerHTML = ernteHtml();
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
    <button class="btn primary" data-act="newMachine" style="margin-bottom:8px">${I.plus} Maschine anlegen</button>
    ${list.length ? `<button class="btn" data-act="qr" style="margin-bottom:14px">${I.qr} QR-Aufkleber drucken</button>` : ''}
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
    ${(() => {
      const rows = sortedMachines().map((m) => ({ m, s: fuelStats(entriesOf(m.id), costYear) })).filter((r) => r.s.liters);
      if (!rows.length) return '';
      const max = Math.max(...rows.map((r) => r.s.liters));
      return `<div class="card"><h2>Tankbuch ${costYear}</h2>${rows.map((r) => `<div class="cbar"><div class="lbl"><span>${esc(r.m.name)}</span><span class="num">${fmt(r.s.liters)} l${r.s.cost ? ` · ${money(r.s.cost)}` : ''}</span></div>
        <div class="track"><div class="fill" style="width:${(r.s.liters / max) * 100}%"></div></div></div>`).join('')}
        <small class="muted">Gesamt ${fmt(rows.reduce((s, r) => s + r.s.liters, 0))} Liter</small></div>`;
    })()}
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
  $$('[data-act="qr"]', v).forEach((b) => (b.onclick = () => printStickers(sortedMachines())));
  $$('[data-machine]', v).forEach((b) => (b.onclick = () => openSheet(viewMachine(b.dataset.machine))));
  $$('[data-entry]', v).forEach((b) => (b.onclick = () => { const e = DATA.entries.find((x) => x.id === b.dataset.entry); if (e) openSheet(viewEntryForm({ entry: e })); }));
  $$('[data-tabgo]', v).forEach((b) => (b.onclick = () => { tab = b.dataset.tabgo; render(); window.scrollTo(0, 0); }));
  $$('[data-year]', v).forEach((b) => (b.onclick = () => { costYear = b.dataset.year; render(); }));
  $$('[data-eyear]', v).forEach((b) => (b.onclick = () => { ernteYear = b.dataset.eyear; render(); }));
  $$('[data-act="newHarvest"]', v).forEach((b) => (b.onclick = () => openSheet(viewHarvestForm({}))));
  $$('[data-field]', v).forEach((b) => (b.onclick = () => openSheet(viewField(b.dataset.field))));
  const ec = $('[data-act="ernteCsv"]', v); if (ec) ec.onclick = () => exportErnteCsv(ernteYear);
  const ea = $('[data-act="ernteCsvAll"]', v); if (ea) ea.onclick = () => exportErnteCsv('');
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
        ${fuelHtml(m, ents)}
        ${partsHtml(m)}
        <div class="section-title">Fotos (Typenschild, Rechnungen …)</div>
        <div class="photos" id="mPhotos"></div><input type="file" id="mFile" accept="image/*" multiple hidden>
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
        $('#mParts', body).onclick = () => pushView(viewParts(id));
        const stopPh = photoStrip($('#mPhotos', body), $('#mFile', body), { machineId: id, entryId: null });
        const cal = $('#mCal', body);
        if (cal) cal.onclick = () => openCalendar(`${m.name}-termine.ics`, icsFor(m));
        return stopPh;
      },
    };
  };
  view.machineId = id;
  return view;
}

// ---------- Teile & Betriebsstoffe ----------
const PART_SUGGEST = {
  traktor: ['Motoröl', 'Ölfilter', 'Luftfilter', 'Kraftstofffilter', 'Hydraulik-/Getriebeöl', 'Reifen vorne', 'Reifen hinten', 'Batterie', 'Keilriemen'],
  motorrad: ['Motoröl', 'Ölfilter', 'Zündkerze', 'Reifen vorne', 'Reifen hinten', 'Kette / Ritzel', 'Batterie'],
  auto: ['Motoröl', 'Ölfilter', 'Luftfilter', 'Reifen Sommer', 'Reifen Winter', 'Wischerblätter', 'Batterie'],
  anhaenger: ['Reifen', 'Bremsbeläge', 'Radlager'],
  geraet: ['Öl', 'Filter', 'Messer / Zinken', 'Keilriemen'],
  sonstiges: [],
};
function partsHtml(m) {
  const ps = (m.parts || []).filter((p) => p.name || p.value);
  return `<div class="section-title">Teile & Betriebsstoffe</div>
    ${ps.length ? `<div class="panel"><dl class="kv" style="margin:0">${ps.map((p) => `<dt>${esc(p.name)}</dt><dd>${esc(p.value)}</dd>`).join('')}</dl></div>`
      : '<p class="hint" style="margin-top:0">Ölsorte, Filternummern, Reifengrößen … einmal eintragen – dann hast du alles beim Händler griffbereit.</p>'}
    <button class="btn" id="mParts">${I.edit} Teile & Betriebsstoffe bearbeiten</button>`;
}
function viewParts(id) {
  return () => {
    const m = machineById(id);
    if (!m) return null;
    const rows = (m.parts && m.parts.length ? m.parts : []).map((p) => ({ ...p }));
    const sugg = () => (PART_SUGGEST[m.type] || []).filter((s) => !rows.some((r) => r.name === s));
    return {
      title: `Teile – ${m.name}`,
      tall: true,
      html: `<div id="pRows"></div><div class="chips" id="pSugg"></div>
        <button class="btn" id="pAdd">${I.plus} Zeile hinzufügen</button>
        <button class="btn primary" id="pSave">Speichern</button>`,
      mount(body) {
        const draw = () => {
          $('#pRows', body).innerHTML = rows.map((r, i) => `<div class="part-row">
            <input class="input" data-pn="${i}" value="${esc(r.name || '')}" placeholder="z. B. Motoröl">
            <input class="input" data-pv="${i}" value="${esc(r.value || '')}" placeholder="z. B. 15W-40, 12 l">
            <button class="icon-btn" data-px="${i}" aria-label="Zeile löschen">${I.trash}</button></div>`).join('') || '<p class="hint">Noch nichts eingetragen – tipp unten auf einen Vorschlag.</p>';
          $('#pSugg', body).innerHTML = sugg().map((s) => `<button class="chip" data-ps="${esc(s)}">+ ${esc(s)}</button>`).join('');
          $$('[data-pn]', body).forEach((el) => (el.oninput = () => { rows[+el.dataset.pn].name = el.value; }));
          $$('[data-pv]', body).forEach((el) => (el.oninput = () => { rows[+el.dataset.pv].value = el.value; }));
          $$('[data-px]', body).forEach((b) => (b.onclick = () => { rows.splice(+b.dataset.px, 1); draw(); }));
          $$('[data-ps]', body).forEach((b) => (b.onclick = () => { rows.push({ name: b.dataset.ps, value: '' }); draw(); const ins = $$('[data-pv]', body); ins[ins.length - 1].focus(); }));
        };
        draw();
        $('#pAdd', body).onclick = () => { rows.push({ name: '', value: '' }); draw(); };
        $('#pSave', body).onclick = () => {
          store.saveMachine(id, { parts: rows.map((r) => ({ name: (r.name || '').trim(), value: (r.value || '').trim() })).filter((r) => r.name || r.value) });
          toast('Gespeichert'); backView();
        };
      },
    };
  };
}

// ---------- Tankbuch ----------
function fuelStats(list, year) {
  const f = list.filter((e) => e.kind === 'fuel' && e.liters && (!year || (e.date || '').startsWith(year)));
  const liters = f.reduce((s, e) => s + e.liters, 0);
  const cost = f.reduce((s, e) => s + (e.cost || 0), 0);
  const all = list.filter((e) => e.kind === 'fuel' && e.liters && e.reading != null).sort((a, b) => a.reading - b.reading);
  let perUnit = null;
  if (all.length >= 2 && all[all.length - 1].reading > all[0].reading) perUnit = all.slice(1).reduce((s, e) => s + e.liters, 0) / (all[all.length - 1].reading - all[0].reading);
  return { liters, cost, perLiter: liters && cost ? cost / liters : null, perUnit, count: f.length };
}
function fuelHtml(m, ents) {
  if (!ents.some((e) => e.kind === 'fuel' && e.liters)) return '';
  const y = String(new Date().getFullYear());
  const s = fuelStats(ents, y); const all = fuelStats(ents);
  const per = all.perUnit != null ? (m.unit === 'km' ? `${fmt(all.perUnit * 100, 1)} l/100 km` : `${fmt(all.perUnit, 1)} l/${m.unit || 'Einheit'}`) : '–';
  return `<div class="section-title">Tankbuch</div>
    <div class="stats">
      <div class="stat"><b class="num">${fmt(s.liters)} l</b><small>${y}</small></div>
      <div class="stat"><b class="num">${per}</b><small>Ø Verbrauch</small></div>
      <div class="stat"><b class="num">${s.perLiter ? money(s.perLiter) : '–'}</b><small>pro Liter</small></div>
    </div>
    ${all.perUnit == null ? '<p class="hint" style="margin-top:-6px">Für den Verbrauch beim Tanken auch den Stand eintragen (mindestens zweimal).</p>' : ''}`;
}

// ---------- Fotos (Rechnungen, Typenschild, Schäden) ----------
async function fileToJpeg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let max = 1400;
    for (let tries = 0; tries < 4; tries++) {
      const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * sc); cv.height = Math.round(img.naturalHeight * sc);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      for (let q = 0.78; q >= 0.45; q -= 0.1) { const d = cv.toDataURL('image/jpeg', q); if (d.length < 650000) return d; }
      max = Math.round(max * 0.75);
    }
    throw new Error('Foto zu groß');
  } finally { URL.revokeObjectURL(url); }
}
// Fotostreifen: lädt/zeigt/fügt Fotos hinzu. ref = { machineId, entryId }
function photoStrip(box, fileInput, ref, onAdded) {
  let photos = [];
  let alive = true;
  const draw = () => {
    if (!alive) return;
    box.innerHTML = photos.map((p, i) => `<div class="ph"><img src="${p.data}" alt="" data-pv="${i}"><button class="del" data-pd="${i}" aria-label="Foto löschen">${I.trash}</button></div>`).join('')
      + `<button class="ph add" data-padd aria-label="Foto hinzufügen">${I.camera}</button>`;
    $$('[data-pv]', box).forEach((im) => (im.onclick = () => { $('#viewerImg').src = photos[+im.dataset.pv].data; $('#viewer').hidden = false; }));
    $$('[data-pd]', box).forEach((b) => (b.onclick = async () => {
      if (!confirm('Foto löschen?')) return;
      const p = photos[+b.dataset.pd];
      try { await store.deletePhoto(p.id); photos = photos.filter((x) => x !== p); draw(); } catch (e) { onStoreError(e); }
    }));
    $('[data-padd]', box).onclick = () => fileInput.click();
  };
  store.listPhotos(ref.machineId).then((ps) => { photos = ps.filter((p) => (p.entryId || null) === (ref.entryId || null)); draw(); }).catch(() => draw());
  fileInput.onchange = async (ev) => {
    const files = [...ev.target.files]; ev.target.value = '';
    for (const file of files) {
      try {
        toast('Foto wird gespeichert …');
        const data = await fileToJpeg(file);
        const p = { machineId: ref.machineId, entryId: ref.entryId || null, data, createdAt: Date.now(), by: userName() };
        p.id = await store.addPhoto(p);
        photos.push(p); draw();
        if (onAdded) onAdded(p);
      } catch (e) { toast(e && e.code === 'quota' ? 'Speicher voll – im Demo-Modus passen nur wenige Fotos.' : 'Foto konnte nicht gespeichert werden.'); }
    }
  };
  draw();
  return () => { alive = false; };
}

// ---------- QR-Aufkleber ----------
const machineUrl = (id) => new URL(`./?m=${encodeURIComponent(id)}`, location.href).href;
function qrSvg(text) { const q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0 }); }
function printStickers(list) {
  if (!window.qrcode) { toast('QR-Bibliothek fehlt'); return; }
  if (!list.length) { toast('Noch keine Maschinen'); return; }
  const area = $('#printArea');
  area.innerHTML = `<div class="print-bar no-print"><button class="btn" id="qClose">${I.back} Zurück</button><button class="btn primary" id="qGo">${I.print} Drucken</button></div>
    <p class="hint no-print">Ausdrucken, ausschneiden und z. B. mit Klebefolie geschützt in die Kabine kleben. Scannen öffnet die Maschine direkt in der App – praktisch zum Stunden eintragen.</p>
    <div class="qr-grid">${list.map((m) => `<div class="qr-card"><b>${esc(m.name)}</b>${qrSvg(machineUrl(m.id))}<small>Hof-Maschinen · scannen zum Eintragen</small></div>`).join('')}</div>`;
  document.body.classList.add('printing'); window.scrollTo(0, 0);
  $('#qClose', area).onclick = () => { document.body.classList.remove('printing'); area.innerHTML = ''; };
  $('#qGo', area).onclick = () => { try { window.print(); } catch (e) { toast('Drucken geht hier nicht'); } };
}

// ---------- Erinnerungen (Benachrichtigung am Handy) ----------
const REMIND_KEY = 'hofmaschinen_remind';
const remindOn = () => { try { return localStorage.getItem(REMIND_KEY) === '1'; } catch (e) { return false; } };
async function updateReminders() {
  const items = dueItems().map((d) => ({ name: d.m.name, label: d.label, text: d.text, status: d.status }));
  // Für den Hintergrund-Check im Service Worker merken
  try { const c = await caches.open('hof-maschinen-due'); await c.put('due.json', new Response(JSON.stringify({ at: Date.now(), items, on: remindOn() }))); } catch (e) { /* */ }
  if (!remindOn() || !('Notification' in window) || Notification.permission !== 'granted') return;
  const today = isoDay();
  let last = null; try { last = localStorage.getItem('hofmaschinen_lastnotify'); } catch (e) { /* */ }
  if (last === today || !items.length) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const title = `Hof-Maschinen: ${items.length} ${items.length === 1 ? 'Sache' : 'Sachen'} fällig`;
    const body = items.slice(0, 4).map((i) => `${i.name}: ${i.label}`).join('\n');
    if (reg) await reg.showNotification(title, { body, icon: 'icons/icon-192.png', tag: 'due' }); else new Notification(title, { body });
    localStorage.setItem('hofmaschinen_lastnotify', today);
  } catch (e) { /* */ }
}
async function enableReminders(on) {
  if (on) {
    if (!('Notification' in window)) { toast('Dieses Handy/dieser Browser kann keine Benachrichtigungen'); return false; }
    const p = await Notification.requestPermission();
    if (p !== 'granted') { toast('Benachrichtigungen wurden nicht erlaubt'); return false; }
    try { const reg = await navigator.serviceWorker.ready; if (reg.periodicSync) await reg.periodicSync.register('due-check', { minInterval: 12 * 3600 * 1000 }); } catch (e) { /* nicht überall möglich */ }
  }
  try { localStorage.setItem(REMIND_KEY, on ? '1' : '0'); localStorage.removeItem('hofmaschinen_lastnotify'); } catch (e) { /* */ }
  updateReminders();
  return true;
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
        <div class="section-title" id="ePhTitle">Fotos (Rechnung, Schaden …)</div>
        <div class="photos" id="ePhotos"></div><input type="file" id="eFile" accept="image/*" multiple hidden>
        <button class="btn primary" id="eSave">Speichern</button>
        ${entry ? `<button class="btn danger" id="eDel">${I.trash} Eintrag löschen</button>
          <p class="hint">Eingetragen ${e.by ? 'von ' + esc(e.by) + ' ' : ''}am ${fmtDate(e.date)}. Änderungen hier passen den Maschinenstand nicht rückwirkend an.</p>` : ''}`,
      mount(body) {
        const machineSel = $('#eMachine', body);
        const readingIn = $('#eReading', body);
        // Fotos: neue Einträge bekommen ihre ID schon jetzt, damit Fotos dazu passen
        const eid = entry ? entry.id : store.newId('entry');
        let saved = !!entry;
        const added = [];
        let stopPh = null;
        const phSetup = () => {
          if (stopPh) stopPh();
          $('#ePhTitle', body).hidden = $('#ePhotos', body).hidden = !mid;
          stopPh = mid ? photoStrip($('#ePhotos', body), $('#eFile', body), { machineId: mid, entryId: eid }, (p) => added.push(p)) : null;
        };
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
        machineSel.onchange = () => { mid = machineSel.value; readingTouched = false; sel.clear(); sync(); phSetup(); };
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
          store.saveEntry(eid, data, m.id, Object.keys(patch).length ? patch : null);
          saved = true;
          toast('Gespeichert');
          backView();
        };
        phSetup();
        if (entry) $('#eDel', body).onclick = () => {
          if (!confirm('Eintrag löschen?')) return;
          store.deleteEntry(entry.id);
          store.listPhotos(entry.machineId).then((ps) => ps.filter((p) => p.entryId === entry.id).forEach((p) => store.deletePhoto(p.id).catch(() => {}))).catch(() => {});
          toast('Gelöscht'); backView();
        };
        // nicht gespeicherter neuer Eintrag -> dazu aufgenommene Fotos wieder entfernen
        return () => { if (stopPh) stopPh(); if (!saved) added.forEach((p) => store.deletePhoto(p.id).catch(() => {})); };
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
      <div class="section-title">Erinnerungen</div>
      <div class="panel">
        <label class="toggle"><span>Benachrichtigung am Handy, wenn Service oder Pickerl fällig sind</span><input type="checkbox" id="sRemind" ${remindOn() && 'Notification' in window && Notification.permission === 'granted' ? 'checked' : ''}></label>
        <p class="hint" style="margin-bottom:0">Kommt einmal am Tag, wenn du die App öffnest. Am Android (App installiert) prüft das Handy zusätzlich ab und zu im Hintergrund. Ganz sicher geht's mit „Termine in den Kalender übernehmen“ bei jeder Maschine.</p>
      </div>
      <div class="section-title">QR-Aufkleber</div>
      <div class="panel"><button class="btn" id="sQr">${I.qr} QR-Aufkleber für alle Maschinen drucken</button></div>
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
      $('#sRemind', body).onchange = async (ev) => { const ok = await enableReminders(ev.target.checked); if (!ok) ev.target.checked = false; else toast(ev.target.checked ? 'Erinnerungen an' : 'Erinnerungen aus'); };
      $('#sQr', body).onclick = () => { closeSheet(); printStickers(sortedMachines()); };
      $('#sJson', body).onclick = () => saveFile(`hof-maschinen-backup-${isoDay()}.json`, 'application/json',
        JSON.stringify({ app: 'hof-maschinen', version: VERSION, exported: new Date().toISOString(), machines: DATA.machines, entries: [...DATA.entries, ...DATA.harvest] }, null, 1));
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

// ---------- Ernte: Ballen pro Feld und Schnitt ----------
const BALE_TYPES = { silage: 'Silage', heu: 'Heu', grummet: 'Grummet', stroh: 'Stroh' };
const FIELD_CATS = ['wiese', 'weide', 'flaeche'];
const MAX_CUT = 5;
let ernteYear = String(new Date().getFullYear());
let mapFields = [];   // Flächen aus der Hof-Karte
const normName = (s) => String(s || '').trim().toLowerCase();
function areaM2(cs) {
  if (!Array.isArray(cs) || cs.length < 3) return 0;
  const R = 6371008.8; const rad = (d) => (d * Math.PI) / 180;
  const lat0 = cs.reduce((s, c) => s + c.lat, 0) / cs.length;
  const k = Math.cos(rad(lat0));
  const pts = cs.map((c) => [rad(c.lng) * R * k, rad(c.lat) * R]);
  let s = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; });
  return Math.abs(s) / 2;
}
function setMapFields(features) {
  mapFields = (features || [])
    .filter((f) => f.kind === 'area' && FIELD_CATS.includes(f.cat) && Array.isArray(f.coords) && f.coords.length > 2)
    .map((f) => ({ key: f.id, id: f.id, name: (f.title || 'Feld').trim(), ha: Math.round(areaM2(f.coords) / 100) / 100, fromMap: true }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
const fieldKeyOf = (e) => (e.fieldId && mapFields.some((f) => f.id === e.fieldId) ? e.fieldId : `n:${normName(e.field)}`);
function allFields() {
  const list = mapFields.map((f) => ({ ...f }));
  const seen = new Set(list.map((f) => f.key));
  [...DATA.harvest].sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach((e) => {
    const key = fieldKeyOf(e);
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ key, id: null, name: e.field || 'Ohne Namen', ha: e.ha || null, fromMap: false });
  });
  return list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
const fieldByKey = (key) => allFields().find((f) => f.key === key);
const harvestYear = (e) => String(e.year || (e.date || '').slice(0, 4));
const harvestOf = (year, key) => DATA.harvest.filter((e) => harvestYear(e) === year && (!key || fieldKeyOf(e) === key));
const sumBales = (list) => list.reduce((s, e) => s + (e.bales || 0), 0);
function byCut(list) { const o = {}; list.forEach((e) => { o[e.cut || 1] = (o[e.cut || 1] || 0) + (e.bales || 0); }); return o; }
const prevYear = (y) => String(+y - 1);
function diffBadge(now, before) {
  if (!before) return '';
  const d = Math.round(((now - before) / before) * 100);
  const cls = d > 0 ? 'ok' : d < 0 ? 'bad' : '';
  return `<span class="badge ${cls}">${d > 0 ? '▲ +' : d < 0 ? '▼ ' : '± '}${d} % zum Vorjahr</span>`;
}
const perHa = (bales, ha) => (ha && bales ? `${fmt(bales / ha, 1)} Ballen/ha` : '');
const cutLine = (cuts) => Object.keys(cuts).sort((a, b) => a - b).map((c) => `${c}. Schnitt: ${fmt(cuts[c])}`).join(' · ');

function ernteHtml() {
  const years = new Set([String(new Date().getFullYear())]);
  DATA.harvest.forEach((e) => years.add(harvestYear(e)));
  const yrs = [...years].filter(Boolean).sort().reverse();
  if (!yrs.includes(ernteYear)) ernteYear = yrs[0];
  const list = harvestOf(ernteYear);
  const prev = harvestOf(prevYear(ernteYear));
  const total = sumBales(list);
  const prevTotal = sumBales(prev);
  const cuts = byCut(list);
  const types = {};
  list.forEach((e) => { const t = BALE_TYPES[e.baleType] || 'Sonstige'; types[t] = (types[t] || 0) + (e.bales || 0); });
  const fields = allFields();
  const rows = fields.map((f) => {
    const fl = list.filter((e) => fieldKeyOf(e) === f.key);
    const pl = prev.filter((e) => fieldKeyOf(e) === f.key);
    return { f, sum: sumBales(fl), prevSum: sumBales(pl), cuts: byCut(fl) };
  }).sort((a, b) => b.sum - a.sum || a.f.name.localeCompare(b.f.name, 'de'));
  const haTotal = rows.filter((r) => r.sum && r.f.ha).reduce((s, r) => s + r.f.ha, 0);
  const balesWithHa = rows.filter((r) => r.sum && r.f.ha).reduce((s, r) => s + r.sum, 0);
  return `
    <div class="seg">${yrs.map((y) => `<button data-eyear="${y}" class="${y === ernteYear ? 'on' : ''}">${y}</button>`).join('')}</div>
    <div class="card">
      <small class="muted">Ballen ${ernteYear}</small>
      <div class="total num">${fmt(total)}</div>
      <div class="badges">${diffBadge(total, prevTotal)}${prevTotal ? `<span class="badge">Vorjahr: ${fmt(prevTotal)}</span>` : ''}${haTotal ? `<span class="badge">${fmt(balesWithHa / haTotal, 1)} Ballen/ha</span>` : ''}</div>
      ${total ? `<div class="ernte-cuts">${Object.keys(cuts).sort((a, b) => a - b).map((c) => `<div><b class="num">${fmt(cuts[c])}</b><small>${c}. Schnitt</small></div>`).join('')}</div>
        <small class="muted">${Object.entries(types).map(([t, n]) => `${esc(t)} ${fmt(n)}`).join(' · ')}</small>` : ''}
    </div>
    <button class="btn primary" data-act="newHarvest">${I.plus} Ballen eintragen</button>
    <div class="section-title">Nach Feld</div>
    ${rows.length ? `<div class="list">${rows.map(({ f, sum, prevSum, cuts: c }) => `
      <button class="list-item" data-field="${esc(f.key)}">
        <span class="ico ${sum ? '' : 'muted-ico'}">${I.field}</span>
        <span class="info"><span class="name">${esc(f.name)}</span>
          <small>${esc([f.ha ? `${fmt(f.ha, 2)} ha` : '', sum ? cutLine(c) : 'noch nichts eingetragen'].filter(Boolean).join(' · '))}</small></span>
        <span class="val num">${sum ? fmt(sum) : '–'}<small>${esc(prevSum ? `Vorjahr ${fmt(prevSum)}` : perHa(sum, f.ha))}</small></span>
      </button>`).join('')}</div>`
      : `<div class="empty">Noch keine Felder. Zeichne in der <b>Hof-Karte</b> deine Wiesen als „Wiese / Feld“ ein – dann stehen sie hier mit Fläche zur Auswahl. Oder tipp auf „Ballen eintragen“ und gib einen Feldnamen ein.</div>`}
    ${mapFields.length ? '' : '<p class="hint">Tipp: In der Hof-Karte eingezeichnete Wiesen erscheinen hier automatisch, inklusive Hektar.</p>'}
    <button class="btn" data-act="ernteCsv">${I.down} Ernte ${ernteYear} als Tabelle (Excel)</button>
    <button class="btn" data-act="ernteCsvAll">${I.down} Alle Jahre als Tabelle (Excel)</button>`;
}

function viewField(key) {
  const view = () => {
    const f = fieldByKey(key);
    if (!f) return { title: 'Feld', live: true, html: '<div class="empty">Dieses Feld hat keine Einträge mehr.</div>' };
    const ents = DATA.harvest.filter((e) => fieldKeyOf(e) === key);
    const years = [...new Set(ents.map(harvestYear))].sort().reverse();
    const maxCut = Math.max(1, ...ents.map((e) => e.cut || 1));
    const cutsArr = Array.from({ length: maxCut }, (_, i) => i + 1);
    return {
      title: f.name,
      live: true,
      html: `
        <div class="muted" style="margin:-4px 0 12px">${esc([f.ha ? `${fmt(f.ha, 2)} ha` : 'Fläche unbekannt', f.fromMap ? 'aus der Hof-Karte' : ''].filter(Boolean).join(' · '))}</div>
        <button class="btn primary" id="fNew">${I.plus} Ballen für dieses Feld eintragen</button>
        ${years.length ? `<div class="section-title">Jahre im Vergleich</div>
        <div class="table-wrap"><table class="etable"><thead><tr><th>Jahr</th>${cutsArr.map((c) => `<th>${c}.</th>`).join('')}<th>Summe</th>${f.ha ? '<th>/ha</th>' : ''}</tr></thead><tbody>
          ${years.map((y) => { const yl = ents.filter((e) => harvestYear(e) === y); const c = byCut(yl); const s = sumBales(yl);
            return `<tr><td>${y}</td>${cutsArr.map((n) => `<td>${c[n] ? fmt(c[n]) : '–'}</td>`).join('')}<td><b>${fmt(s)}</b></td>${f.ha ? `<td>${fmt(s / f.ha, 1)}</td>` : ''}</tr>`; }).join('')}
        </tbody></table></div>
        <div class="section-title">Einträge</div>
        <div class="list">${[...ents].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(harvestRow).join('')}</div>`
        : '<div class="empty">Für dieses Feld ist noch nichts eingetragen.</div>'}`,
      mount(body) {
        $('#fNew', body).onclick = () => pushView(viewHarvestForm({ fieldKey: key }));
        $$('[data-harvest]', body).forEach((b) => (b.onclick = () => { const e = DATA.harvest.find((x) => x.id === b.dataset.harvest); if (e) pushView(viewHarvestForm({ entry: e })); }));
      },
    };
  };
  return view;
}
function harvestRow(e) {
  return `<button class="list-item" data-harvest="${esc(e.id)}">
    <span class="ico">${I.bale}</span>
    <span class="info"><span class="name">${esc(`${e.cut || 1}. Schnitt · ${BALE_TYPES[e.baleType] || ''}`)}</span>
      <small>${esc([fmtDate(e.date), e.field, e.note, e.by].filter(Boolean).join(' · '))}</small></span>
    <span class="val num">${fmt(e.bales)}<small>Ballen</small></span></button>`;
}

function viewHarvestForm({ entry, fieldKey }) {
  return () => {
    const e = entry || {};
    const fields = allFields();
    let key = entry ? fieldKeyOf(e) : (fieldKey || '');
    let cut = e.cut || 1;
    let type = e.baleType || '';
    let cutTouched = !!entry;
    let typeTouched = !!entry;
    return {
      title: entry ? 'Ernte bearbeiten' : 'Ballen eintragen',
      tall: true,
      html: `
        <label class="field"><span>Feld</span><select class="input" id="hField">
          <option value="">Bitte wählen …</option>
          ${fields.map((f) => `<option value="${esc(f.key)}" ${f.key === key ? 'selected' : ''}>${esc(f.name)}${f.ha ? ` (${fmt(f.ha, 2)} ha)` : ''}</option>`).join('')}
          <option value="__new">+ Anderes Feld …</option></select></label>
        <div class="grid2" id="hNewWrap" hidden>
          <label class="field"><span>Name des Feldes</span><input class="input" id="hNewName" autocomplete="off" placeholder="z. B. Hausleiten"></label>
          <label class="field"><span>Fläche (ha, optional)</span><input class="input num" id="hNewHa" inputmode="decimal" placeholder="z. B. 1,8"></label>
        </div>
        <label class="field"><span>Schnitt</span></label>
        <div class="seg" id="hCut">${Array.from({ length: MAX_CUT }, (_, i) => i + 1).map((c) => `<button type="button" data-cut="${c}">${c}.</button>`).join('')}</div>
        <div class="grid2">
          <label class="field"><span>Anzahl Ballen</span><input class="input num big-num" id="hBales" inputmode="numeric" value="${e.bales != null ? esc(e.bales) : ''}" placeholder="0"></label>
          <label class="field"><span>Datum</span><input class="input" id="hDate" type="date" value="${esc(e.date || isoDay())}"></label>
        </div>
        <label class="field"><span>Art</span></label>
        <div class="seg" id="hType">${Object.entries(BALE_TYPES).map(([k, v]) => `<button type="button" data-type="${k}">${v}</button>`).join('')}</div>
        <label class="field"><span>Notiz (optional)</span><input class="input" id="hNote" value="${esc(e.note || '')}" placeholder="z. B. sehr nass, Lohnpresser"></label>
        <button class="btn primary" id="hSave">Speichern</button>
        ${entry ? `<button class="btn danger" id="hDel">${I.trash} Eintrag löschen</button>
          <p class="hint">Eingetragen ${e.by ? 'von ' + esc(e.by) + ' ' : ''}am ${fmtDate(e.date)}.</p>` : ''}`,
      mount(body) {
        const fieldSel = $('#hField', body);
        const yearOf = () => ($('#hDate', body).value || isoDay()).slice(0, 4);
        const suggest = () => {
          if (!cutTouched && key && key !== '__new') {
            const done = harvestOf(yearOf(), key).map((x) => x.cut || 1);
            cut = Math.min(MAX_CUT, (done.length ? Math.max(...done) : 0) + 1);
          }
          if (!typeTouched) {
            const last = [...DATA.harvest].filter((x) => (x.cut || 1) === cut && x.baleType).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
            type = last ? last.baleType : cut === 1 ? 'silage' : cut === 2 ? 'grummet' : 'silage';
          }
        };
        const sync = () => {
          $('#hNewWrap', body).hidden = key !== '__new';
          $$('#hCut button', body).forEach((b) => b.classList.toggle('on', +b.dataset.cut === cut));
          $$('#hType button', body).forEach((b) => b.classList.toggle('on', b.dataset.type === type));
        };
        fieldSel.onchange = () => { key = fieldSel.value; suggest(); sync(); if (key === '__new') $('#hNewName', body).focus(); };
        $('#hDate', body).onchange = () => { suggest(); sync(); };
        $$('#hCut button', body).forEach((b) => (b.onclick = () => { cut = +b.dataset.cut; cutTouched = true; suggest(); sync(); }));
        $$('#hType button', body).forEach((b) => (b.onclick = () => { type = b.dataset.type; typeTouched = true; sync(); }));
        suggest(); sync();
        $('#hSave', body).onclick = () => {
          let name; let fieldId = null; let ha = null;
          if (key === '__new') {
            name = $('#hNewName', body).value.trim();
            if (!name) { toast('Bitte einen Feldnamen eingeben'); $('#hNewName', body).focus(); return; }
            ha = num($('#hNewHa', body).value);
            const same = allFields().find((f) => normName(f.name) === normName(name));
            if (same) { fieldId = same.id; ha = ha || same.ha; name = same.name; }
          } else {
            const f = fieldByKey(key);
            if (!f) { toast('Bitte ein Feld wählen'); return; }
            name = f.name; fieldId = f.id; ha = f.ha;
          }
          const bales = num($('#hBales', body).value);
          if (bales == null || bales < 0) { toast('Bitte die Anzahl Ballen eingeben'); $('#hBales', body).focus(); return; }
          const date = $('#hDate', body).value || isoDay();
          const data = {
            kind: 'harvest', field: name, fieldId, ha: ha || null, date, year: +date.slice(0, 4), cut, bales: Math.round(bales), baleType: type,
            note: $('#hNote', body).value.trim(), updatedAt: Date.now(),
          };
          if (!entry) { data.by = userName(); data.createdAt = Date.now(); }
          store.saveEntry(entry ? entry.id : null, data);
          ernteYear = date.slice(0, 4);
          toast(`${fmt(data.bales)} Ballen gespeichert`);
          backView();
        };
        const del = $('#hDel', body);
        if (del) del.onclick = () => { if (confirm('Diesen Eintrag löschen?')) { store.deleteEntry(entry.id); toast('Gelöscht'); backView(); } };
      },
    };
  };
}

function exportErnteCsv(year) {
  const csvCell = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const dec = (n, d = 2) => (n == null || n === '' ? '' : String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ','));
  const ents = DATA.harvest.filter((e) => !year || harvestYear(e) === year)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.field || '').localeCompare(b.field || '', 'de'));
  const rows = [['Jahr', 'Datum', 'Feld', 'Fläche (ha)', 'Schnitt', 'Art', 'Ballen', 'Notiz', 'Eingetragen von']];
  ents.forEach((e) => { const f = fieldByKey(fieldKeyOf(e)) || {}; rows.push([harvestYear(e), fmtDate(e.date), f.name || e.field, dec(f.ha || e.ha), e.cut || 1, BALE_TYPES[e.baleType] || '', e.bales || 0, e.note || '', e.by || '']); });
  // Übersicht pro Feld und Jahr
  rows.push([], ['Übersicht'], ['Jahr', 'Feld', 'Fläche (ha)', ...Array.from({ length: MAX_CUT }, (_, i) => `${i + 1}. Schnitt`), 'Summe', 'Ballen/ha']);
  const years = [...new Set(ents.map(harvestYear))].sort();
  years.forEach((y) => allFields().forEach((f) => {
    const fl = ents.filter((e) => harvestYear(e) === y && fieldKeyOf(e) === f.key);
    if (!fl.length) return;
    const c = byCut(fl); const s = sumBales(fl);
    rows.push([y, f.name, dec(f.ha), ...Array.from({ length: MAX_CUT }, (_, i) => c[i + 1] || ''), s, f.ha ? dec(s / f.ha, 1) : '']);
  }));
  const text = '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
  saveFile(`ernte-${year || 'alle-jahre'}.csv`, 'text/csv', text);
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
let deepMachine = new URLSearchParams(location.search).get('m');
let remindTimer = null;
let unsubFeatures = null;
function startApp() {
  $('#boot').hidden = true;
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#hofName').textContent = CFG.hofName || 'Hof-Maschinen';
  $('#demoBanner').hidden = store.mode !== 'demo';
  if (unsubscribe) unsubscribe();
  unsubscribe = store.subscribe((snap) => {
    DATA = { machines: snap.machines, entries: snap.entries.filter((e) => e.kind !== 'harvest'), harvest: snap.entries.filter((e) => e.kind === 'harvest') };
    $('#syncState').textContent = store.mode === 'demo' ? 'Demo-Modus'
      : snap.offline || !navigator.onLine ? 'Offline – wird später synchronisiert'
        : snap.pending ? 'Wird synchronisiert …' : 'Synchronisiert';
    render();
    if (current && current.live) showView(current, true);
    if (deepMachine && machineById(deepMachine)) { const id = deepMachine; deepMachine = null; history.replaceState(null, '', location.pathname); openSheet(viewMachine(id)); }
    clearTimeout(remindTimer); remindTimer = setTimeout(updateReminders, 1500);
  });
  if (unsubFeatures) unsubFeatures();
  unsubFeatures = store.subscribeFeatures ? store.subscribeFeatures((fs) => {
    setMapFields(fs);
    if (tab === 'ernte') render();
    if (current && current.live) showView(current, true);
  }) : null;
}

async function boot() {
  $$('.tab').forEach((t) => (t.onclick = () => { tab = t.dataset.tab; render(); window.scrollTo(0, 0); }));
  $('#fab').onclick = () => openSheet(tab === 'ernte' ? viewHarvestForm({}) : viewEntryForm({}));
  $('#openSettings').onclick = () => openSheet(viewSettings);
  $('#sheetClose').onclick = closeSheet;
  $('#sheetBack').onclick = backView;
  $('#viewerClose').onclick = () => { $('#viewer').hidden = true; };
  $('#viewer').onclick = (e) => { if (e.target.id === 'viewer') $('#viewer').hidden = true; };
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
