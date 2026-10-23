/* Gemeinsamer Code für Gästeseite und Verwaltung. */
(() => {
const G = (window.G = {});
G.VERSION = '1.0';

// ---------- Helfer ----------
G.$ = (s, r = document) => r.querySelector(s);
G.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
G.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
G.num = (v) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
G.fmtIn = (n) => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
const EUR = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' });
G.money = (n) => EUR.format(n || 0);
G.uid = (n = 10) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
G.slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'einheit';
G.now = () => (typeof window.__NOW__ === 'number' ? window.__NOW__ : Date.now());
const pad = (n) => String(n).padStart(2, '0');
G.store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } return v; };

// ---------- Zeit (immer österreichische Zeit, egal wo das Handy eingestellt ist) ----------
const TZ = 'Europe/Vienna';
const partsFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
function vParts(ms) {
  const o = {};
  partsFmt.formatToParts(new Date(ms)).forEach((p) => { o[p.type] = p.value; });
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
}
G.dayKey = (ms) => { const p = vParts(ms); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
G.today = () => G.dayKey(G.now());
G.addDays = (day, n) => { const [y, m, d] = day.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
// Wiener Uhrzeit (Tag + Stunde) -> Zeitpunkt in ms
G.viennaTime = (day, hour, minute = 0) => {
  const [y, m, d] = day.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d, hour, minute);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = vParts(guess);
    guess -= Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - target;
  }
  return guess;
};
G.timeOf = (ms) => { const p = vParts(ms); return `${pad(p.h)}:${pad(p.mi)}`; };
// Bestellschluss für eine Lieferung am Tag "day": Vortag um cutoff Uhr
G.deadlineFor = (day, cutoff) => G.viennaTime(G.addDays(day, -1), cutoff);
// Frühester Liefertag, der jetzt noch bestellbar ist
G.earliestDelivery = (cutoff) => {
  const t = G.today();
  return G.now() < G.viennaTime(t, cutoff) ? G.addDays(t, 1) : G.addDays(t, 2);
};
G.fmtDay = (day, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('de-AT', { ...opts, timeZone: 'UTC' });
};
G.relDay = (day) => {
  const t = G.today();
  if (day === t) return 'heute';
  if (day === G.addDays(t, 1)) return 'morgen';
  if (day === G.addDays(t, 2)) return 'übermorgen';
  if (day === G.addDays(t, -1)) return 'gestern';
  return '';
};
G.fmtDayRel = (day) => { const r = G.relDay(day); const f = G.fmtDay(day, { weekday: 'short', day: 'numeric', month: 'numeric' }); return r ? `${r[0].toUpperCase() + r.slice(1)}, ${f}` : G.fmtDay(day); };
G.fmtDeadline = (ms) => { const day = G.dayKey(ms); const r = G.relDay(day); return `${r || G.fmtDay(day, { weekday: 'short', day: 'numeric', month: 'numeric' })} um ${G.timeOf(ms)} Uhr`; };
G.countdown = (ms) => {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) return `${Math.floor(h / 24)} ${Math.floor(h / 24) === 1 ? 'Tag' : 'Tagen'}`;
  return h ? `${h} Std. ${m} Min.` : `${m} Min.`;
};

// ---------- Text-Formatierung (einfach) ----------
// **fett**, Zeilen mit "- " werden Aufzählungen, Links und Telefonnummern werden anklickbar.
G.md = (text) => {
  const inline = (s) => G.esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(>])(\+?\d[\d /-]{6,}\d)(?=$|[\s),.<])/g, (m0, pre, tel) => `${pre}<a href="tel:${tel.replace(/[^\d+]/g, '')}">${tel}</a>`)
    .replace(/(^|[\s(>])(112|122|133|140|141|144|1450)(?=$|[\s),.:<–-])/g, '$1<a href="tel:$2">$2</a>');
  const out = [];
  let list = null;
  let para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join('')}</ul>`); list = null; } };
  String(text || '').split('\n').forEach((line) => {
    const li = line.match(/^\s*[-•*]\s+(.*)$/);
    if (li) { flushPara(); (list = list || []).push(li[1]); return; }
    flushList();
    if (!line.trim()) { flushPara(); return; }
    para.push(line);
  });
  flushPara(); flushList();
  return out.join('');
};

// ---------- Toast ----------
let toastTimer;
G.toast = (msg) => {
  let t = G.$('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
};

// ---------- Icons ----------
G.ICON = {
  home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/></svg>',
  key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l3 3M14 9l2 2"/></svg>',
  rules: '<svg viewBox="0 0 24 24"><path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4"/></svg>',
  recycle: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
  sos: '<svg viewBox="0 0 24 24"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M3 20l5-9 4 6 3-4 6 7z"/><circle cx="16" cy="6" r="2"/></svg>',
  egg: '<svg viewBox="0 0 24 24"><path d="M12 3c3.5 0 6.5 6 6.5 10.5A6.5 6.5 0 0 1 5.5 13.5C5.5 9 8.5 3 12 3z"/></svg>',
  wifi: '<svg viewBox="0 0 24 24"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>',
  bread: '<svg viewBox="0 0 24 24"><path d="M5 11a4 4 0 0 1 3-7h8a4 4 0 0 1 3 7v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M10 11v4M14 11v4"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/></svg>',
  car: '<svg viewBox="0 0 24 24"><path d="M3 16v-4l2-5h14l2 5v4z"/><circle cx="7" cy="16.5" r="2"/><circle cx="17" cy="16.5" r="2"/></svg>',
  mountain: '<svg viewBox="0 0 24 24"><path d="M2 20l7-12 4 6 2-3 7 9z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M4 20l1.5-4A8 8 0 1 1 9 19.5z"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7"/></svg>',
  qr: '<svg viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/></svg>',
  euro: '<svg viewBox="0 0 24 24"><path d="M17 6a7 7 0 1 0 0 12M4 10h9M4 14h9"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/></svg>',
};
G.SECTION_ICONS = ['home', 'key', 'wifi', 'rules', 'recycle', 'sos', 'map', 'mountain', 'egg', 'bread', 'car', 'phone', 'info', 'book'];

// ---------- Startinhalte ----------
G.defaultSite = () => ({
  hofName: 'Urlaub am Bauernhof',
  subtitle: 'Eure digitale Gästemappe',
  breakfast: true,
  cutoffHour: 17,
  deliveryText: 'Wir stellen euch das Frühstück bis 7:30 Uhr vor die Tür.',
  phone: '',
  whatsapp: '',
  email: '',
  bakeryName: '',
  bakeryPhone: '',
  sections: [
    { id: 'willkommen', icon: 'home', title: 'Willkommen', text: 'Schön, dass ihr bei uns seid! Hier findet ihr alles Wichtige für euren Aufenthalt.\n\nWenn etwas fehlt oder kaputt ist, meldet euch bitte jederzeit – wir helfen gerne.' },
    { id: 'anreise', icon: 'key', title: 'An- & Abreise', text: '- Anreise ab **15:00 Uhr**\n- Abreise bis **10:00 Uhr**\n- Bitte lasst den Schlüssel bei der Abreise in der Wohnung stecken.\n- Parkplätze: [hier eintragen]' },
    { id: 'hausregeln', icon: 'rules', title: 'Hausregeln', text: '- Nachtruhe von 22:00 bis 7:00 Uhr\n- Rauchen bitte nur im Freien\n- Haustiere nur nach Absprache\n- Wir sind ein Arbeitsbetrieb: Bitte lasst Kinder nicht unbeaufsichtigt beim Stall, bei Maschinen oder auf dem Hofplatz spielen.' },
    { id: 'muell', icon: 'recycle', title: 'Müll & Recycling', text: 'Die Mülltonnen findet ihr [hier eintragen].\n\n- **Restmüll** – schwarze Tonne\n- **Bio** – braune Tonne\n- **Papier** – rote Tonne\n- **Plastik & Metall** – gelber Sack\n- **Glas** – bitte in den Container [hier eintragen]' },
    { id: 'notfall', icon: 'sos', title: 'Notfall & wichtige Nummern', text: '- **112** – Euro-Notruf\n- **144** – Rettung\n- **122** – Feuerwehr\n- **133** – Polizei\n- **140** – Bergrettung / Alpinnotruf\n- **141** – Ärztenotdienst\n- **1450** – Gesundheitsberatung\n\nNächster Arzt: [hier eintragen]\nNächste Apotheke: [hier eintragen]' },
    { id: 'tipps', icon: 'mountain', title: 'Ausflugstipps', text: 'Unsere Lieblingsziele in der Umgebung:\n\n- [Wanderung – Gehzeit, Einkehr]\n- [Badesee / Hallenbad]\n- [Ausflug bei Schlechtwetter]\n- [Restaurant-Tipp]' },
    { id: 'hof', icon: 'egg', title: 'Vom Hof', text: 'Frische Milch, Eier und hausgemachte Marmelade bekommt ihr direkt bei uns – einfach mit der Frühstücksbestellung dazu bestellen oder fragen.' },
  ],
  products: [
    { id: 'semmel', name: 'Semmel', price: 0.6, group: 'baecker', active: true },
    { id: 'kornspitz', name: 'Kornspitz', price: 1.0, group: 'baecker', active: true },
    { id: 'vollkorn', name: 'Vollkornweckerl', price: 0.9, group: 'baecker', active: true },
    { id: 'croissant', name: 'Croissant', price: 1.4, group: 'baecker', active: true },
    { id: 'brot', name: 'Bauernbrot (½ Laib)', price: 2.9, group: 'baecker', active: true },
    { id: 'milch', name: 'Frische Milch vom Hof (1 l)', price: 1.5, group: 'hof', active: true },
    { id: 'eier', name: 'Eier vom Hof (6 Stück)', price: 3.0, group: 'hof', active: true },
    { id: 'butter', name: 'Butter (250 g)', price: 3.5, group: 'hof', active: true },
    { id: 'marmelade', name: 'Hausgemachte Marmelade', price: 4.5, group: 'hof', active: true },
  ],
});
G.defaultUnits = () => [
  { name: 'Ferienwohnung 1', breakfast: true, askSpot: false, wlanName: '', wlanPassword: '', note: '' },
  { name: 'Ferienwohnung 2', breakfast: true, askSpot: false, wlanName: '', wlanPassword: '', note: '' },
  { name: 'Selbstversorgerhaus', breakfast: true, askSpot: false, wlanName: '', wlanPassword: '', note: '' },
  { name: 'Camping', breakfast: true, askSpot: true, wlanName: '', wlanPassword: '', note: '' },
  { name: 'Almhütte', breakfast: false, askSpot: false, wlanName: '', wlanPassword: '', note: 'Auf der Almhütte gibt es kein WLAN und keinen Frühstücksservice.' },
];
G.newUnitId = (name) => `${G.slug(name)}-${G.uid(6)}`;
G.mergeSite = (s) => ({ ...G.defaultSite(), ...(s || {}) });

// ---------- Datenspeicher ----------
const FB = 'https://www.gstatic.com/firebasejs/13.1.0';
const clean = (o) => JSON.parse(JSON.stringify(o));

G.createStore = async (config, opts = {}) => {
  const fbc = (config && config.firebase) || {};
  if (fbc.apiKey && fbc.projectId) return firebaseStore(fbc, opts);
  return demoStore();
};

async function firebaseStore(fbc, opts) {
  const [{ initializeApp }, fs] = await Promise.all([import(`${FB}/firebase-app.js`), import(`${FB}/firebase-firestore.js`)]);
  const app = initializeApp(fbc);
  let db;
  if (opts.persistent) {
    try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); }
    catch (e) { db = fs.getFirestore(app); }
  } else db = fs.getFirestore(app);
  const fail = opts.onError || (() => {});
  const siteRef = fs.doc(db, 'site', 'main');
  const unitsCol = fs.collection(db, 'units');
  const ordersCol = fs.collection(db, 'orders');
  const toMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v);
  const orderOut = (d) => { const o = { ...d.data(), id: d.id }; o.deadline = toMs(o.deadline); o.createdAt = toMs(o.createdAt) || G.now(); return o; };
  let authMod = null;
  const getAuthMod = async () => { if (!authMod) authMod = await import(`${FB}/firebase-auth.js`); return authMod; };
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), ms))]);

  return {
    mode: 'firebase',
    async onAuth(cb) { const a = await getAuthMod(); return a.onAuthStateChanged(a.getAuth(app), (u) => cb(u ? { uid: u.uid, email: u.email } : null)); },
    async signIn(email, pw) { const a = await getAuthMod(); return a.signInWithEmailAndPassword(a.getAuth(app), email, pw); },
    async signOut() { const a = await getAuthMod(); return a.signOut(a.getAuth(app)); },
    async resetPassword(email) { const a = await getAuthMod(); return a.sendPasswordResetEmail(a.getAuth(app), email); },

    async getSite() { const s = await fs.getDoc(siteRef); return s.exists() ? s.data() : null; },
    watchSite(cb) { return fs.onSnapshot(siteRef, (s) => cb(s.exists() ? s.data() : null), fail); },
    saveSite(data) { fs.setDoc(siteRef, clean(data)).catch(fail); },

    async getUnit(id) { const s = await fs.getDoc(fs.doc(unitsCol, id)); return s.exists() ? { ...s.data(), id } : null; },
    watchUnits(cb) { return fs.onSnapshot(unitsCol, (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))), fail); },
    saveUnit(id, data) { fs.setDoc(fs.doc(unitsCol, id), clean(data)).catch(fail); return id; },
    deleteUnit(id) { fs.deleteDoc(fs.doc(unitsCol, id)).catch(fail); },

    async createOrder(data) {
      const ref = fs.doc(ordersCol, G.uid(20));
      const { deadline, ...rest } = clean(data);
      await withTimeout(fs.setDoc(ref, { ...rest, deadline: fs.Timestamp.fromMillis(deadline), createdAt: fs.serverTimestamp() }), 15000);
      return ref.id;
    },
    async getOrder(id) { const s = await fs.getDoc(fs.doc(ordersCol, id)); return s.exists() ? orderOut(s) : null; },
    async cancelOrder(id) { await withTimeout(fs.updateDoc(fs.doc(ordersCol, id), { status: 'storniert' }), 15000); },
    watchOrders(sinceDay, cb) {
      return fs.onSnapshot(fs.query(ordersCol, fs.where('date', '>=', sinceDay)), (snap) => cb(snap.docs.map(orderOut)), fail);
    },
    updateOrder(id, patch) { fs.updateDoc(fs.doc(ordersCol, id), clean(patch)).catch(fail); },
    deleteOrder(id) { fs.deleteDoc(fs.doc(ordersCol, id)).catch(fail); },
  };
}

function demoStore() {
  const KEY = 'gaeste_demo';
  const load = () => {
    const d = G.store(KEY);
    if (d && d.units && d.orders) return d;
    const fresh = { site: G.defaultSite(), units: {}, orders: {} };
    G.defaultUnits().forEach((u) => { const id = G.newUnitId(u.name); fresh.units[id] = { ...u, id }; });
    G.store(KEY, fresh);
    return fresh;
  };
  let data = load();
  const subs = { site: new Set(), units: new Set(), orders: new Set() };
  const emit = () => {
    subs.site.forEach((cb) => cb(data.site));
    subs.units.forEach((cb) => cb(Object.values(data.units)));
    subs.orders.forEach(({ since, cb }) => cb(Object.values(data.orders).filter((o) => o.date >= since)));
  };
  const persist = () => { G.store(KEY, data); emit(); };
  window.addEventListener('storage', (e) => { if (e.key === KEY) { data = load(); emit(); } });
  const sub = (set, item) => { set.add(item); setTimeout(emit, 0); return () => set.delete(item); };
  return {
    mode: 'demo',
    async onAuth(cb) { setTimeout(() => cb({ uid: 'demo', email: 'demo' }), 0); return () => {}; },
    async signIn() {}, async signOut() {}, async resetPassword() {},
    async getSite() { return data.site; },
    watchSite(cb) { return sub(subs.site, cb); },
    saveSite(s) { data.site = clean(s); persist(); },
    async getUnit(id) { return data.units[id] || null; },
    watchUnits(cb) { return sub(subs.units, cb); },
    saveUnit(id, u) { data.units[id] = { ...clean(u), id }; persist(); return id; },
    deleteUnit(id) { delete data.units[id]; persist(); },
    async createOrder(o) {
      if (G.now() >= o.deadline) throw Object.assign(new Error('Bestellschluss vorbei'), { code: 'permission-denied' });
      const id = G.uid(20);
      data.orders[id] = { ...clean(o), id, createdAt: G.now() };
      persist();
      return id;
    },
    async getOrder(id) { return data.orders[id] || null; },
    async cancelOrder(id) {
      const o = data.orders[id];
      if (!o || G.now() >= o.deadline) throw Object.assign(new Error('Zu spät'), { code: 'permission-denied' });
      o.status = 'storniert'; persist();
    },
    watchOrders(since, cb) { return sub(subs.orders, { since, cb }); },
    updateOrder(id, patch) { if (data.orders[id]) { Object.assign(data.orders[id], clean(patch)); persist(); } },
    deleteOrder(id) { delete data.orders[id]; persist(); },
  };
}

// Summen einer Bestellung
G.orderTotal = (o) => (o.items || []).reduce((s, it) => s + (it.qty || 0) * (it.price || 0), 0);
G.orderItemsText = (o) => (o.items || []).map((it) => `${it.qty} × ${it.name}`).join(', ');
})();
