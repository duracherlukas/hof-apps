/* Ausgaben: Kartenumsätze aus Mein ELBA einlesen, Personen zuordnen, offen/bezahlt verfolgen.
   Alle Daten bleiben nur auf diesem Gerät (localStorage). */
(() => {
'use strict';
const VERSION = '1.1';
const KEY = 'ausgaben_v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const r2 = (n) => Math.round(n * 100) / 100;
const EUR = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' });
const money = (n) => EUR.format(n || 0);
const num = (v) => { const s = String(v ?? '').trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); const n = parseFloat(s); return Number.isFinite(n) ? n : null; };
const fmtIn = (n) => (n == null ? '' : String(r2(n)).replace('.', ','));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDay = (s, o = { weekday: 'short', day: 'numeric', month: 'numeric' }) => (s ? parseDay(s).toLocaleDateString('de-AT', o) : '');
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

const COLORS = ['#1f6b5e', '#c2185b', '#1565c0', '#ef6c00', '#6a1b9a', '#2e7d32', '#00838f', '#8d6e63', '#ad1457', '#546e7a'];
const DEFAULT = () => ({
  tx: {},
  persons: [
    { id: 'ich', name: 'Ich', me: true, color: '#546e7a' },
    { id: 'mama', name: 'Mama', color: '#c2185b' },
    { id: 'papa', name: 'Papa', color: '#1565c0' },
    { id: 'hans', name: 'Hans', color: '#ef6c00' },
    { id: 'spaetzle', name: 'Spätzle', color: '#6a1b9a' },
    { id: 'nina', name: 'Nina', color: '#2e7d32' },
    { id: 'jasmin', name: 'Jasmin', color: '#00838f' },
  ],
  groups: [
    { id: 'g-sj', name: 'Spätzle & Jasmin', members: ['spaetzle', 'jasmin'] },
    { id: 'g-ni', name: 'Nina & ich', members: ['nina', 'ich'] },
  ],
  rules: {},      // Geschäft -> zuletzt gewählte Aufteilung
  lookups: {},    // Geschäft -> gefundener Name/Art/Ort
  payments: [],   // erhaltene Rückzahlungen
  settings: { autoSearch: true, withAtm: false, withOther: false },
  lastBackup: 0,
});
let db = load();

function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.tx) return { ...DEFAULT(), ...d, settings: { ...DEFAULT().settings, ...(d.settings || {}) } }; } catch (e) { /* */ }
  return DEFAULT();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Speicher voll – bitte eine Sicherung machen und alte Jahre löschen', 5000); } }

let tt;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), ms); }

// ---------- Personen & Gruppen ----------
const person = (id) => db.persons.find((p) => p.id === id);
const pname = (id) => (person(id) || { name: '?' }).name;
const pcolor = (id) => (person(id) || {}).color || '#888';
const meId = () => (db.persons.find((p) => p.me) || {}).id;
const others = () => db.persons.filter((p) => !p.me);
// Betrag gleichmäßig auf Personen verteilen (Cent-genau)
function evenSplit(amount, ids) {
  const cents = Math.round(amount * 100); const base = Math.floor(cents / ids.length); let rest = cents - base * ids.length;
  return ids.map((p) => ({ p, amt: (base + (rest-- > 0 ? 1 : 0)) / 100, paid: false }));
}

// ---------- Geschäfte erkennen ----------
const CATS = {
  lebensmittel: ['🛒', 'Lebensmittel'], tanken: ['⛽', 'Tankstelle'], landwirtschaft: ['🚜', 'Lagerhaus / Landwirtschaft'], drogerie: ['🧴', 'Drogerie'],
  essen: ['🍽️', 'Gasthaus / Essen'], cafe: ['☕', 'Café / Bäckerei'], online: ['📦', 'Online'], kleidung: ['👕', 'Kleidung / Schuhe'], bau: ['🔨', 'Baumarkt / Garten'],
  elektronik: ['💻', 'Elektronik'], verkehr: ['🚆', 'Verkehr / Parken'], apotheke: ['💊', 'Apotheke / Arzt'], bargeld: ['🏧', 'Bargeld'], freizeit: ['🎟️', 'Freizeit / Sport'],
  wohnen: ['🛋️', 'Möbel / Wohnen'], tiere: ['🐾', 'Tierbedarf'], abo: ['🔁', 'Abo / Handy'], hotel: ['🏨', 'Unterkunft'], auto: ['🚗', 'Auto / Werkstatt'], sonstiges: ['💳', 'Sonstiges'],
};
const BRANDS = [
  [/\bbilla\b/i, 'Billa', 'lebensmittel'], [/\bspar\b|interspar|eurospar/i, 'Spar', 'lebensmittel'], [/\bhofer\b/i, 'Hofer', 'lebensmittel'], [/\blidl\b/i, 'Lidl', 'lebensmittel'],
  [/\bpenny\b/i, 'Penny', 'lebensmittel'], [/\bm-?preis\b/i, 'MPreis', 'lebensmittel'], [/\bunimarkt\b/i, 'Unimarkt', 'lebensmittel'], [/\bnah\s*&?\s*frisch\b/i, 'Nah & Frisch', 'lebensmittel'],
  [/\bmetro\b/i, 'Metro', 'lebensmittel'], [/\bdm\b(?!\w)|dm.drogerie/i, 'dm drogerie markt', 'drogerie'], [/\bbipa\b/i, 'Bipa', 'drogerie'], [/\bm(ue|ü)ller\b/i, 'Müller', 'drogerie'],
  [/\bomv\b/i, 'OMV', 'tanken'], [/\bbp\b/i, 'BP', 'tanken'], [/\bshell\b/i, 'Shell', 'tanken'], [/\beni\b|\bagip\b/i, 'Eni', 'tanken'], [/\bavanti\b/i, 'Avanti', 'tanken'],
  [/turm.?oel|turmöl/i, 'Turmöl', 'tanken'], [/\bjet\b/i, 'Jet', 'tanken'], [/\bdoppler\b/i, 'Doppler', 'tanken'], [/\bgenol\b/i, 'Genol', 'tanken'], [/\bdiskont\b.*tank|\bsb.?tank/i, null, 'tanken'],
  [/lagerhaus|\brwa\b/i, 'Lagerhaus', 'landwirtschaft'], [/\bfrey\b.*land|landtechnik/i, null, 'landwirtschaft'], [/raiffeisen.?markt/i, 'Raiffeisen Markt', 'landwirtschaft'],
  [/\bhornbach\b/i, 'Hornbach', 'bau'], [/\bobi\b/i, 'OBI', 'bau'], [/\bbauhaus\b/i, 'Bauhaus', 'bau'], [/\bhagebau\b/i, 'Hagebau', 'bau'], [/\bdehner\b|bellaflora|starkl/i, null, 'bau'],
  [/mediamarkt|media markt/i, 'MediaMarkt', 'elektronik'], [/\bsaturn\b/i, 'Saturn', 'elektronik'], [/hartlauer/i, 'Hartlauer', 'elektronik'], [/cyberport|e-?tec|ditech/i, null, 'elektronik'],
  [/\bamazon|amzn/i, 'Amazon', 'online'], [/\bpaypal\b/i, 'PayPal', 'online'], [/\bebay\b/i, 'eBay', 'online'], [/willhaben/i, 'willhaben', 'online'], [/\btemu\b/i, 'Temu', 'online'], [/\bshein\b/i, 'Shein', 'online'], [/zalando/i, 'Zalando', 'online'],
  [/apple\.com|itunes|\bapple\b/i, 'Apple', 'abo'], [/google\s*(play|\*)|\bgoogle\b/i, 'Google', 'abo'], [/netflix/i, 'Netflix', 'abo'], [/spotify/i, 'Spotify', 'abo'], [/disney/i, 'Disney+', 'abo'],
  [/\ba1\b|a1 telekom/i, 'A1', 'abo'], [/magenta/i, 'Magenta', 'abo'], [/\bdrei\b|hutchison/i, 'Drei', 'abo'], [/\bhot\b.*mobil|hofer telekom/i, 'HoT', 'abo'],
  [/\bh\s*&\s*m\b|\bhm\b/i, 'H&M', 'kleidung'], [/\bzara\b/i, 'Zara', 'kleidung'], [/\bc\s*&\s*a\b/i, 'C&A', 'kleidung'], [/deichmann/i, 'Deichmann', 'kleidung'], [/humanic/i, 'Humanic', 'kleidung'],
  [/\bnew yorker\b/i, 'New Yorker', 'kleidung'], [/\bpeek|cloppenburg/i, 'Peek & Cloppenburg', 'kleidung'], [/intersport|hervis|gigasport|sport ?2000|xxl.?sport/i, null, 'freizeit'],
  [/xxxlutz|xxx lutz|m(ö|oe)belix|m(ö|oe)max|\bikea\b|\bkika\b|\bleiner\b/i, null, 'wohnen'], [/fressnapf|zoo\s?&?\s?co|futterhaus/i, null, 'tiere'],
  [/mc ?donald|mcdonalds/i, "McDonald's", 'essen'], [/burger king/i, 'Burger King', 'essen'], [/\bkfc\b/i, 'KFC', 'essen'], [/subway/i, 'Subway', 'essen'], [/wirt\b|gasthof|gasthaus|restaurant|pizzeria|st(ü|ue)b(e|e?r?l|n)\b|\balm\b|h(ü|ue)tte|kebap|kebab|imbiss|wirtshaus/i, null, 'essen'],
  [/b(ä|ae)ckerei|backhaus|ankerbrot|\banker\b|\bfelber\b|caf(e|é)|kaffee|starbucks|coffee/i, null, 'cafe'],
  [/\bö?bb\b|oebb|westbahn|asfinag|vignette|parkgar|parken|apcoa|easypark|parkster|maut/i, null, 'verkehr'],
  [/apotheke|ordination|dr\.?\s|arzt|zahnarzt|optik|fielmann/i, null, 'apotheke'], [/hotel|pension|airbnb|booking\.com/i, null, 'hotel'],
  [/autohaus|reifen|werkstatt|vergölst|forstinger|atu\b|pit.?stop|waschstra/i, null, 'auto'], [/kino|cineplexx|therme|bergbahn|lift|skipass|eintritt|museum/i, null, 'freizeit'],
  [/thalia|libro|morawa|pagro/i, null, 'sonstiges'], [/\bpost\b/i, 'Österreichische Post', 'sonstiges'], [/trafik|tabak/i, 'Trafik', 'sonstiges'],
];
const PREFIX = [['eurospar', 'Eurospar', 'lebensmittel'], ['interspar', 'Interspar', 'lebensmittel'], ['sparkasse', null, null], ['spar', 'Spar', 'lebensmittel'], ['billa', 'Billa', 'lebensmittel'], ['hofer', 'Hofer', 'lebensmittel'],
  ['lidl', 'Lidl', 'lebensmittel'], ['penny', 'Penny', 'lebensmittel'], ['mpreis', 'MPreis', 'lebensmittel'], ['unimarkt', 'Unimarkt', 'lebensmittel'], ['nahfrisch', 'Nah & Frisch', 'lebensmittel'], ['lagerhaus', 'Lagerhaus', 'landwirtschaft'],
  ['omv', 'OMV', 'tanken'], ['shell', 'Shell', 'tanken'], ['avanti', 'Avanti', 'tanken'], ['turmoel', 'Turmöl', 'tanken'], ['bipa', 'Bipa', 'drogerie'], ['dmdrogerie', 'dm drogerie markt', 'drogerie'], ['mueller', 'Müller', 'drogerie'],
  ['mcdonald', "McDonald's", 'essen'], ['burgerking', 'Burger King', 'essen'], ['hornbach', 'Hornbach', 'bau'], ['xxxlutz', 'XXXLutz', 'wohnen'], ['ikea', 'IKEA', 'wohnen'], ['mediamarkt', 'MediaMarkt', 'elektronik'],
  ['hartlauer', 'Hartlauer', 'elektronik'], ['fressnapf', 'Fressnapf', 'tiere'], ['amazon', 'Amazon', 'online'], ['amzn', 'Amazon', 'online'], ['paypal', 'PayPal', 'online'], ['netflix', 'Netflix', 'abo'], ['spotify', 'Spotify', 'abo'],
  ['oebb', 'ÖBB', 'verkehr'], ['asfinag', 'Asfinag', 'verkehr'], ['fielmann', 'Fielmann', 'apotheke'], ['deichmann', 'Deichmann', 'kleidung'], ['intersport', 'Intersport', 'freizeit'], ['hervis', 'Hervis', 'freizeit'], ['apotheke', null, 'apotheke']];
function brandOf(text) {
  for (const [re, name, cat] of BRANDS) if (re.test(text)) return { name, cat };
  const flat = String(text || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/[^a-z0-9]/g, '');
  for (const [k, name, cat] of PREFIX) if (flat.startsWith(k)) return cat ? { name, cat } : null;
  return null;
}
const SMALL = new Set(['am', 'an', 'im', 'in', 'bei', 'der', 'die', 'das', 'und', 'zum', 'zur', 'von', 'auf', 'a.', 'b.', 'st.']);
function titleCase(s) {
  return String(s || '').toLowerCase().split(/\s+/).filter(Boolean).map((w, i) => (i > 0 && SMALL.has(w) ? w : w.replace(/(^|[-/(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()))).join(' ')
    .replace(/\b(Ag|Kg|Og|Gmbh|Ug|Eu|Öbb|Oebb|Dm|Bp|Omv|Kfz|Ams|Svs|Orf|Gis|Atu)\b/g, (w) => ({ Gmbh: 'GmbH', Oebb: 'ÖBB', Dm: 'dm' }[w] || w.toUpperCase()));
}
// Kartenzahlung aus dem Buchungstext lesen: Uhrzeit, Geschäft, Ort
// ELBA-Text hat Felder wie "Verwendungszweck: … Zahlungsreferenz: … Kartenfolge-Nr.: 1"
const LABELS = [
  ['ibanEmpf', 'IBAN Zahlungsempf(?:ä|ae|a)nger'], ['bicEmpf', 'BIC Zahlungsempf(?:ä|ae|a)nger'], ['ibanAuf', 'IBAN Auftraggeber'], ['bicAuf', 'BIC Auftraggeber'],
  ['empf', 'Zahlungsempf(?:ä|ae|a)nger'], ['pflicht', 'Zahlungspflichtiger'], ['auf', 'Auftraggeber'], ['empf2', 'Empf(?:ä|ae|a)nger'],
  ['vz', 'Verwendungszweck'], ['ref', 'Zahlungsreferenz'], ['kfn', 'Kartenfolge-?Nr\\.?'], ['mandat', 'Mandat(?:sreferenz)?'], ['cred', 'Creditor[- ]?ID'],
  ['btext', 'Buchungstext'], ['aufref', 'Auftraggeberreferenz'], ['kenn', 'Empf(?:ä|ae|a)nger-?Kennung'],
];
const LABEL_RE = new RegExp(`(?<![\\p{L}])(${LABELS.map((l) => l[1]).join('|')})\\s*:`, 'giu');
function fields(t) {
  const hits = []; let m; LABEL_RE.lastIndex = 0;
  while ((m = LABEL_RE.exec(t))) { const key = (LABELS.find((l) => new RegExp(`^${l[1]}$`, 'iu').test(m[1])) || [m[1]])[0]; hits.push({ key, i: m.index, end: LABEL_RE.lastIndex }); }
  if (!hits.length) return null;
  const out = { _pre: t.slice(0, hits[0].i).trim() };
  hits.forEach((h, n) => { out[h.key] = t.slice(h.end, n + 1 < hits.length ? hits[n + 1].i : t.length).trim(); });
  return out;
}
const RE_WHEN = /(\d{2})\.(\d{2})\.?(?:\d{2,4})?\s+(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?/;
const CITY_PRE = /^(MARIA|ST\.?|SANKT|BAD)$/i;
const CITY_LINK = /^(AM|AN|IM|BEI|OB|ZUM)$/i;
// Kartenzahlungstext zerlegen: "NYX*SPARMARKTOBERTILLI OBERTILLIACH 9942" -> Geschäft, Ort
function parseShop(src) {
  let s = String(src || '').replace(/\b(DANKT|DANKE|SAGT DANKE)\b/gi, ' ').trim();
  let via = null;
  const pm = s.match(/^([A-Z0-9]{2,10}|APPLE PAY|GOOGLE PAY)\s?\*\s?/i);
  if (pm) { via = pm[1].toUpperCase(); s = s.slice(pm[0].length); }
  let name; let place;
  const parts = s.split(/\s{2,}/).map((x) => x.trim()).filter(Boolean);
  const notNum = (x) => !/^\d+$/.test(x) && !/^(AT|AUT|DE|DEU|IT|ITA|CH)$/i.test(x);
  if (parts.length >= 2) { name = parts[0].split(' '); place = parts.slice(1).join(' ').split(' ').filter(notNum); }
  else {
    const toks = s.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    let end = toks.length; while (end > 1 && !notNum(toks[end - 1])) end--;
    const tail = end < toks.length; const core = toks.slice(0, end);
    const ni = core.findIndex((x, i) => i > 0 && /^\d{2,}$/.test(x));
    if (ni > 0) { name = core.slice(0, ni); place = core.slice(ni + 1).filter(notNum); }
    else if (tail && core.length >= 2) {
      let k = core.length - 1;
      while (k >= 2 && CITY_LINK.test(core[k - 1])) k -= 2;
      if (k >= 2 && CITY_PRE.test(core[k - 1])) k--;
      name = core.slice(0, k); place = core.slice(k);
    } else { name = core; place = []; }
  }
  return { merchant: titleCase(name.join(' ')).slice(0, 40) || 'Unbekannt', place: titleCase(place.join(' ')).slice(0, 40), via: via && via !== 'POS' ? titleCase(via) : null };
}
function parseText(raw) {
  const t = String(raw || '').replace(/[\\|]/g, ' ').trim();
  const flat = t.replace(/\s+/g, ' ');
  const f = fields(t);
  let time = null; let day = null;
  const findWhen = (x) => { const m = String(x || '').replace(/\s+/g, ' ').match(RE_WHEN); if (m && !time) { time = `${pad(m[3])}:${m[4]}`; day = { d: +m[1], m: +m[2] }; } return m; };
  if (f) {
    const ref = f.ref || ''; const vz = f.vz || '';
    findWhen(ref); findWhen(vz); findWhen(f._pre);
    const payee = f.empf || f.empf2 || f.auf || f.pflicht || '';
    const cardish = 'kfn' in f || /\b(POS|E-?COMM|ECOM|AUTOMAT|ATM|BANKOMAT)\b/i.test(ref);
    if (cardish) {
      let shopText = vz;
      if (!shopText) { const m = ref.replace(/\s+/g, ' ').match(RE_WHEN); shopText = m ? ref.replace(/\s+/g, ' ').slice(ref.replace(/\s+/g, ' ').indexOf(m[0]) + m[0].length) : ref; }
      const sp = parseShop(shopText);
      return { time, day, ...sp, purpose: vz || shopText };
    }
    const who = payee.replace(/\s+/g, ' ').trim();
    const purpose = (vz || f.btext || ref || f._pre || '').replace(/\s+/g, ' ').trim();
    return { time, day, merchant: titleCase(who || purpose.split(' ').slice(0, 4).join(' ')).slice(0, 40) || 'Abbuchung', place: '', via: null, purpose };
  }
  // Format ohne Feldnamen: "POS 12,50 AT D4 19.11. 14:23 BILLA DANKT 1234 SALZBURG 5020"
  const m = flat.match(new RegExp(`${RE_WHEN.source}\\s+(.*)$`));
  let rest = flat;
  if (m) { time = `${pad(m[3])}:${m[4]}`; day = { d: +m[1], m: +m[2] }; rest = m[5]; }
  rest = rest.replace(/^(POS|E-?COMM(ERCE)?|ECOM|BEZAHLUNG|KARTENZAHLUNG|KARTE|AUTOMAT|ATM|BANKOMAT|DEBIT|CONTACTLESS|NFC)\b\s*/i, '')
    .replace(/^\d+[.,]\d{2}\s+[A-Z]{2}\s+[A-Z]\d\s+/, '').replace(/\b(MC|VISA|MAESTRO|DEBIT|KARTE)\s*\/?\s*\d{4,}\b/gi, ' ').trim();
  return { time, day, ...parseShop(rest), purpose: rest };
}
const merchantKey = (m) => String(m || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 3).join(' ');
function txKind(text) {
  if (/\b(AUTOMAT|BARGELD|BEHEBUNG|GELDAUTOMAT|ATM|CASH)\b/i.test(text)) return 'atm';
  if (/Kartenfolge/i.test(text)) return 'card';
  if (/\b(POS|E-?COMM|ECOM|KARTE|KARTENZAHLUNG|MC\/|VISA|MAESTRO|DEBIT|BEZAHLUNG|APPLE PAY|GOOGLE PAY|CONTACTLESS|NFC)\b/i.test(text)) return 'card';
  return 'other';
}
const KIND_LABEL = { card: 'Bankomatkarte', atm: 'Behebung', other: 'Abbuchung', bar: 'Bar', card2: 'Andere Karte', transfer: 'Überweisung' };

// Anzeige-Infos einer Ausgabe (Name, Art, Ort)
function info(tx) {
  const lk = db.lookups[tx.mkey] || {};
  const brand = brandOf(tx.merchant);
  const name = tx.name || lk.name || (brand && brand.name) || tx.merchant;
  const cat = tx.cat || lk.cat || (brand && brand.cat) || (tx.kind === 'atm' ? 'bargeld' : 'sonstiges');
  const place = tx.place || lk.place || '';
  return { name, cat, place, icon: (CATS[cat] || CATS.sonstiges)[0], catLabel: (CATS[cat] || CATS.sonstiges)[1], found: lk.src && !lk.custom ? lk : null };
}

// ---------- CSV aus Mein ELBA einlesen ----------
function decode(buf) {
  let t = new TextDecoder('utf-8').decode(buf);
  if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf);
  return t.replace(/^﻿/, '');
}
function splitLine(line, sep) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
const RE_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/;
const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const RE_AMT = /^[+-]?\s?(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$|^[+-]?\d+\.\d{2}$/;
const RE_TS = /(\d{1,2})\.(\d{1,2})\.(\d{4})[ T]+(\d{1,2}):(\d{2})|(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/;
function toIso(s) {
  let m = String(s).match(RE_DATE); if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${pad(m[2])}-${pad(m[1])}`; }
  m = String(s).match(RE_ISO); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
function parseAmount(s) {
  const t = String(s).replace(/\s/g, '');
  if (/^[+-]?\d+\.\d{2}$/.test(t)) return parseFloat(t);
  return num(t);
}
function detectColumns(rows) {
  const n = Math.max(...rows.map((r) => r.length));
  const score = Array.from({ length: n }, () => ({ date: 0, amt: 0, cur: 0, ts: 0, len: 0, cnt: 0 }));
  rows.slice(0, 40).forEach((r) => r.forEach((v, i) => {
    const s = score[i]; if (!v) return; s.cnt++; s.len += v.length;
    if (RE_DATE.test(v) || RE_ISO.test(v) && v.length <= 10) s.date++;
    if (RE_AMT.test(v)) s.amt++;
    if (/^[A-Z]{3}$/.test(v)) s.cur++;
    if (RE_TS.test(v) && v.length < 30) s.ts++;
  }));
  const total = Math.min(rows.length, 40);
  const pick = (k, min = 0.6) => score.map((s, i) => ({ i, v: s[k] / total })).filter((x) => x.v >= min).map((x) => x.i);
  const dates = pick('date'); const amts = pick('amt').filter((i) => !dates.includes(i)); const tss = pick('ts').filter((i) => !dates.includes(i));
  const textCands = score.map((s, i) => ({ i, avg: s.cnt ? s.len / s.cnt : 0 })).filter((x) => !dates.includes(x.i) && !amts.includes(x.i) && !tss.includes(x.i)).sort((a, b) => b.avg - a.avg);
  return { date: dates[0] ?? null, amount: amts[0] ?? null, text: textCands[0] ? textCands[0].i : null, ts: tss[0] ?? null };
}
function parseCsv(text, map) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], error: 'Die Datei ist leer.' };
  const first = lines[0];
  const sep = [';', '\t', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = lines.map((l) => splitLine(l, sep));
  const cols = map || detectColumns(rows);
  if (cols.date == null || cols.amount == null || cols.text == null) return { rows, cols, error: 'Spalten nicht erkannt' };
  const out = [];
  rows.forEach((r) => {
    const date = toIso(r[cols.date]); const amount = parseAmount(r[cols.amount]);
    if (!date || amount == null) return; // Kopfzeile o. ä.
    const raw = r[cols.text] || '';
    const ts = cols.ts != null ? r[cols.ts] || '' : '';
    out.push({ date, amount, raw, ts, line: r.join(';') });
  });
  return { rows, cols, out, sep };
}
// Felder einer Bank-Ausgabe aus dem Text setzen (auch für spätere Verbesserungen der Erkennung)
function applyParse(tx, raw, booked, ts) {
  const p = parseText(raw);
  let date = booked; let time = p.time;
  const tsm = ts && ts.match(RE_TS);
  if (!time && tsm) time = tsm[4] ? `${pad(tsm[4])}:${tsm[5]}` : `${tsm[9]}:${tsm[10]}`;
  if (p.day) { // Kaufdatum aus dem Text (Buchung kommt oft 1–3 Tage später)
    const b = parseDay(booked); let y = b.getFullYear(); if (p.day.m > b.getMonth() + 1) y--;
    const cand = `${y}-${pad(p.day.m)}-${pad(p.day.d)}`; if (cand <= booked) date = cand;
  }
  const kind = txKind(raw);
  if (kind === 'atm') {
    const src = p.purpose || raw.replace(/.*\d{1,2}[:.]\d{2}\s+/, '');
    const words = src.split(/\s+/).filter((w) => /^\p{L}{3,}$/u.test(w) && !/^(BANKOMAT|AUTOMAT|ATM|GELDAUTOMAT|BEHEBUNG|BARGELD|AT|RAIFFEISEN|RAIKA|RAIFFEISENBANK|BANK|SPARKASSE|BAWAG|FILIALE|KARTENFOLGE)$/i.test(w));
    p.merchant = 'Bargeld-Behebung'; p.place = titleCase(words.join(' ')).slice(0, 40);
  }
  Object.assign(tx, { date, booked, time: time || tx.time || null, raw, merchant: p.merchant, place: p.place, via: p.via, purpose: p.purpose || '', mkey: kind === 'atm' ? 'bargeld behebung' : merchantKey(p.merchant), kind });
  return tx;
}
function buildTx(row) {
  const id = `e${hash(`${row.date}|${row.amount}|${row.raw}|${row.ts}`)}`;
  return applyParse({ id, amount: r2(Math.abs(row.amount)), src: 'elba', alloc: [], created: Date.now() }, row.raw, row.date, row.ts);
}
// Nach einem Update: bereits eingelesene Ausgaben neu erkennen (Zuordnungen bleiben)
const PARSER = 2;
function migrate() {
  if ((db.parser || 1) >= PARSER) return;
  const junk = /kartenfolge|verwendungszweck|zahlungsreferenz/;
  Object.values(db.tx).forEach((t) => { if (t.src === 'elba' && t.raw) applyParse(t, t.raw, t.booked || t.date, null); });
  Object.keys(db.rules).forEach((k) => { if (junk.test(k)) delete db.rules[k]; });
  Object.keys(db.lookups).forEach((k) => { if (junk.test(k)) delete db.lookups[k]; });
  db.parser = PARSER; save();
}

let pendingImport = null;
async function onCsvFile(file) {
  try {
    const text = decode(await file.arrayBuffer());
    const res = parseCsv(text);
    pendingImport = { text, res, name: file.name };
    openSheet(res.error ? viewMapping : viewImport);
  } catch (e) { toast('Die Datei konnte nicht gelesen werden'); }
}
function viewMapping() {
  const { res } = pendingImport;
  const sample = res.rows.slice(0, 4);
  const n = Math.max(...sample.map((r) => r.length));
  const opt = (k) => `<select class="input" data-map="${k}"><option value="">–</option>${Array.from({ length: n }, (_, i) => `<option value="${i}" ${res.cols && res.cols[k] === i ? 'selected' : ''}>Spalte ${i + 1}: ${esc((sample[sample.length > 1 ? 1 : 0][i] || '').slice(0, 28))}</option>`).join('')}</select>`;
  return {
    title: 'Spalten zuordnen',
    html: `<div class="warn-box">Ich konnte das Format nicht sicher erkennen. Sag mir bitte einmal, welche Spalte was ist – das merkt sich die App.</div>
      <table class="map-table">${sample.map((r) => `<tr>${r.map((v) => `<td>${esc(v.slice(0, 40))}</td>`).join('')}</tr>`).join('')}</table>
      <label class="field" style="margin-top:12px"><span>Datum</span>${opt('date')}</label>
      <label class="field"><span>Buchungstext (wo eingekauft)</span>${opt('text')}</label>
      <label class="field"><span>Betrag</span>${opt('amount')}</label>
      <label class="field"><span>Zeitpunkt (optional)</span>${opt('ts')}</label>
      <button class="btn primary" id="mapOk">Weiter</button>`,
    mount(b) {
      $('#mapOk', b).onclick = () => {
        const m = {}; $$('[data-map]', b).forEach((s) => { m[s.dataset.map] = s.value === '' ? null : +s.value; });
        if (m.date == null || m.text == null || m.amount == null) { toast('Bitte Datum, Text und Betrag wählen'); return; }
        db.settings.csvMap = m; save();
        pendingImport.res = parseCsv(pendingImport.text, m);
        showView(viewImport);
      };
    },
  };
}
function viewImport() {
  let { res } = pendingImport;
  if (db.settings.csvMap && (!res.out || !res.out.length)) res = pendingImport.res = parseCsv(pendingImport.text, db.settings.csvMap);
  const all = (res.out || []).filter((r) => r.amount < 0).map(buildTx);
  const income = (res.out || []).filter((r) => r.amount > 0).length;
  const fresh = all.filter((t) => !db.tx[t.id]);
  const by = (k) => fresh.filter((t) => t.kind === k);
  return {
    title: 'Umsätze einlesen',
    html: `<div class="note-box">In <b>${esc(pendingImport.name)}</b> stehen <b>${all.length}</b> Abbuchungen${income ? ` (und ${income} Eingänge, die ignoriert werden)` : ''}. Davon sind <b>${fresh.length} neu</b>, ${all.length - fresh.length} hast du schon.</div>
      <label class="check-line"><input type="checkbox" checked disabled> 💳 Kartenzahlungen (${by('card').length} neu)</label>
      <label class="check-line"><input type="checkbox" id="imAtm" ${db.settings.withAtm ? 'checked' : ''}> 🏧 Bargeld-Behebungen (${by('atm').length} neu)</label>
      <label class="check-line"><input type="checkbox" id="imOther" ${db.settings.withOther ? 'checked' : ''}> 🔁 Andere Abbuchungen, z. B. Überweisungen, Lastschriften (${by('other').length} neu)</label>
      ${fresh.length ? `<div class="section-title">Vorschau</div><div class="list">${fresh.slice(0, 5).map((t) => { const i = info(t); return `<div class="line-item"><span class="tx-ico">${i.icon}</span><span class="info"><b>${esc(i.name)}</b><small>${esc([i.place, fmtDay(t.date), t.time].filter(Boolean).join(' · '))}</small></span><b class="num">${money(t.amount)}</b></div>`; }).join('')}</div>` : ''}
      <button class="btn primary" id="imGo" ${fresh.length ? '' : 'disabled'}>Übernehmen</button>
      ${db.settings.csvMap ? '<button class="btn" id="imRemap">Spalten neu zuordnen</button>' : ''}`,
    mount(b) {
      const rm = $('#imRemap', b); if (rm) rm.onclick = () => { db.settings.csvMap = null; save(); pendingImport.res = parseCsv(pendingImport.text); showView(viewMapping); };
      $('#imGo', b).onclick = () => {
        db.settings.withAtm = $('#imAtm', b).checked; db.settings.withOther = $('#imOther', b).checked;
        const take = fresh.filter((t) => t.kind === 'card' || (t.kind === 'atm' && db.settings.withAtm) || (t.kind === 'other' && db.settings.withOther));
        take.forEach((t) => { db.tx[t.id] = t; });
        save(); closeSheet(); tab = 'todo'; render();
        toast(`${take.length} Ausgaben übernommen`);
        lookupQueue();
      };
    },
  };
}

// ---------- Automatische Suche im Internet (OpenStreetMap + Wikipedia) ----------
const OSM_CAT = { supermarket: 'lebensmittel', convenience: 'lebensmittel', greengrocer: 'lebensmittel', butcher: 'lebensmittel', farm: 'lebensmittel', bakery: 'cafe', cafe: 'cafe', confectionery: 'cafe',
  restaurant: 'essen', fast_food: 'essen', bar: 'essen', pub: 'essen', biergarten: 'essen', ice_cream: 'cafe', fuel: 'tanken', car_wash: 'auto', car_repair: 'auto', car: 'auto', tyres: 'auto',
  hardware: 'bau', doityourself: 'bau', garden_centre: 'bau', agrarian: 'landwirtschaft', chemist: 'drogerie', cosmetics: 'drogerie', pharmacy: 'apotheke', doctors: 'apotheke', dentist: 'apotheke', optician: 'apotheke',
  clothes: 'kleidung', shoes: 'kleidung', sports: 'freizeit', electronics: 'elektronik', mobile_phone: 'elektronik', computer: 'elektronik', furniture: 'wohnen', pet: 'tiere', hotel: 'hotel', guest_house: 'hotel',
  parking: 'verkehr', cinema: 'freizeit', swimming_pool: 'freizeit', water_park: 'freizeit', aerialway: 'freizeit', kiosk: 'sonstiges', tobacco: 'sonstiges', books: 'sonstiges', post_office: 'sonstiges' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let searching = false;
const similar = (a, b) => { const A = merchantKey(a).split(' ').filter((w) => w.length >= 4); const B = ` ${merchantKey(b)} `; return A.some((w) => B.includes(w)); };
async function lookupOne(tx) {
  const key = tx.mkey; const q = `${tx.merchant}${tx.place ? ` ${tx.place}` : ''}`;
  let res = null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=at,de,it&accept-language=de&addressdetails=1&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
    if (r.ok) {
      const list = await r.json();
      const hit = list.find((x) => x.name && similar(tx.merchant, x.name));
      if (hit) {
        const a = hit.address || {};
        res = { name: hit.name, cat: OSM_CAT[hit.type] || OSM_CAT[hit.category] || null, place: a.village || a.town || a.city || a.municipality || tx.place || '', addr: [a.road && `${a.road} ${a.house_number || ''}`.trim(), a.postcode && `${a.postcode} ${a.village || a.town || a.city || ''}`.trim()].filter(Boolean).join(', '),
          src: 'OpenStreetMap', url: `https://www.openstreetmap.org/${hit.osm_type}/${hit.osm_id}` };
      }
    }
  } catch (e) { /* offline */ }
  if (!res) {
    await sleep(300);
    try {
      const r = await fetch(`https://de.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=${encodeURIComponent(tx.merchant)}`);
      if (r.ok) {
        const j = await r.json(); const hit = j.query && j.query.search && j.query.search[0];
        if (hit && similar(tx.merchant, hit.title)) {
          const s = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
          res = { name: hit.title, cat: null, place: '', desc: s && (s.description || '').slice(0, 80), src: 'Wikipedia', url: `https://de.wikipedia.org/wiki/${encodeURIComponent(hit.title)}` };
        }
      }
    } catch (e) { /* */ }
  }
  db.lookups[key] = { ...(res || { none: true }), at: Date.now() };
  save();
  return res;
}
async function lookupQueue() {
  if (searching || !db.settings.autoSearch || !navigator.onLine) return;
  searching = true;
  try {
    const seen = new Set();
    const todo = Object.values(db.tx).filter((t) => t.src === 'elba' && t.mkey && !db.lookups[t.mkey] && t.kind !== 'atm' && !brandOf(t.merchant) && !seen.has(t.mkey) && seen.add(t.mkey));
    for (const t of todo.slice(0, 40)) { await lookupOne(t); render(true); await sleep(1100); } // OpenStreetMap: max. 1 Anfrage pro Sekunde
  } finally { searching = false; }
}
const googleUrl = (tx) => `https://www.google.com/search?q=${encodeURIComponent((tx.purpose && tx.kind !== 'other' ? tx.purpose.replace(/^\w{2,10}\s?\*\s?/, '') : `${tx.merchant} ${tx.place || ''}`).replace(/\s+/g, ' ').trim())}`;

// ---------- Zuordnen ----------
function assign(tx, target, remember = true) {
  if (target === 'ignore') { tx.ignored = true; tx.alloc = []; }
  else if (target.startsWith('g:')) { const g = db.groups.find((x) => x.id === target.slice(2)); if (!g) return; tx.alloc = evenSplit(tx.amount, g.members.filter(person)); tx.ignored = false; }
  else { tx.alloc = [{ p: target, amt: tx.amount, paid: false }]; tx.ignored = false; }
  if (remember && tx.mkey) db.rules[tx.mkey] = target;
  save();
}
function applySplit(tx, parts, remember) {
  tx.alloc = parts.filter((x) => x.amt > 0).map((x) => ({ p: x.p, amt: r2(x.amt), paid: !!x.paid })); tx.ignored = false;
  if (remember && tx.mkey) db.rules[tx.mkey] = { split: tx.alloc.map((a) => [a.p, a.amt / tx.amount]) };
  save();
}
function suggestion(tx) {
  const r = tx.mkey ? db.rules[tx.mkey] : null;
  if (!r) return null;
  if (typeof r === 'string') return r === 'ignore' ? { label: 'Ignorieren', target: 'ignore' } : r.startsWith('g:') ? { label: (db.groups.find((g) => g.id === r.slice(2)) || {}).name, target: r } : person(r) ? { label: pname(r), target: r } : null;
  if (r.split) return { label: r.split.map(([p, f]) => `${pname(p)} ${Math.round(f * 100)} %`).join(' / '), split: r.split };
  return null;
}
function applySuggestion(tx) {
  const s = suggestion(tx); if (!s) return;
  if (s.split) {
    const parts = s.split.map(([p, f]) => ({ p, amt: r2(tx.amount * f) }));
    const diff = r2(tx.amount - parts.reduce((x, y) => x + y.amt, 0)); if (parts.length) parts[parts.length - 1].amt = r2(parts[parts.length - 1].amt + diff);
    applySplit(tx, parts, false);
  } else assign(tx, s.target, false);
}
const unassigned = () => Object.values(db.tx).filter((t) => !t.ignored && !(t.alloc && t.alloc.length)).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));

// ---------- Rechnen ----------
let period = { mode: 'month', ym: today().slice(0, 7), y: today().slice(0, 4) };
const inPeriod = (d) => (period.mode === 'all' ? true : period.mode === 'year' ? d.startsWith(period.y) : d.startsWith(period.ym));
const periodLabel = () => (period.mode === 'all' ? 'Gesamter Zeitraum' : period.mode === 'year' ? `Jahr ${period.y}` : parseDay(`${period.ym}-01`).toLocaleDateString('de-AT', { month: 'long', year: 'numeric' }));
function shift(dir) {
  if (period.mode === 'year') period.y = String(+period.y + dir);
  if (period.mode === 'month') { const d = parseDay(`${period.ym}-01`); d.setMonth(d.getMonth() + dir); period.ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
}
function personStats(pid, onlyPeriod = true) {
  let spent = 0; let unpaid = 0; let paidItems = 0; const items = [];
  Object.values(db.tx).forEach((t) => (t.alloc || []).forEach((a, i) => {
    if (a.p !== pid) return;
    if (!a.paid) unpaid += a.amt; else paidItems += a.amt;
    if (!onlyPeriod || inPeriod(t.date)) { spent += a.amt; items.push({ t, a, i }); }
  }));
  const payments = db.payments.filter((p) => p.p === pid);
  const got = payments.reduce((s, p) => s + p.amt, 0);
  const isMe = person(pid) && person(pid).me;
  return { spent: r2(spent), open: isMe ? 0 : r2(Math.max(0, unpaid - got)), credit: isMe ? 0 : r2(Math.max(0, got - unpaid)), paid: r2(paidItems + got), items: items.sort((x, y) => (y.t.date + (y.t.time || '')).localeCompare(x.t.date + (x.t.time || ''))), payments };
}

// ---------- Ansichten ----------
let tab = 'todo';
let filterP = 'all';
let query = '';
function periodHtml() {
  return `<div class="period"><div class="seg">${[['month', 'Monat'], ['year', 'Jahr'], ['all', 'Alles']].map(([k, l]) => `<button data-pm="${k}" class="${period.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    ${period.mode !== 'all' ? `<div class="pnav"><button class="icon-btn" data-shift="-1" aria-label="zurück"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><b>${esc(periodLabel())}</b><button class="icon-btn" data-shift="1" aria-label="weiter"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div>` : ''}`;
}
function txCard(t, mode) {
  const i = info(t);
  const sug = mode === 'todo' ? suggestion(t) : null;
  const meta = [i.place, `${fmtDay(t.date)}${t.time ? ` · ${t.time}` : ''}`, KIND_LABEL[t.kind] || ''].filter(Boolean).join(' · ');
  const chips = mode === 'todo' ? `<div class="chips">
      ${sug ? `<button class="chip sugg" data-sug="${esc(t.id)}">Vorschlag: ${esc(sug.label)} ✓</button>` : ''}
      ${db.persons.map((p) => `<button class="chip" data-as="${esc(t.id)}|${esc(p.id)}"><span class="pdot" style="background:${p.color}"></span>${esc(p.name)}</button>`).join('')}
      ${db.groups.map((g) => `<button class="chip" data-as="${esc(t.id)}|g:${esc(g.id)}">👥 ${esc(g.name)}</button>`).join('')}
      <button class="chip ghost" data-split="${esc(t.id)}">✂️ Aufteilen</button>
      <button class="chip ghost" data-as="${esc(t.id)}|ignore">Ignorieren</button></div>`
    : (t.alloc && t.alloc.length ? `<div class="alloc">${t.alloc.map((a) => `<span class="tag ${a.paid ? 'paid' : ''}"><span class="pdot" style="width:8px;height:8px;border-radius:50%;background:${pcolor(a.p)}"></span>${esc(pname(a.p))}${t.alloc.length > 1 ? ` ${money(a.amt)}` : ''}</span>`).join('')}</div>` : t.ignored ? '<div class="alloc"><span class="tag">ignoriert</span></div>' : '<div class="alloc"><span class="tag" style="color:var(--bad)">nicht zugeordnet</span></div>');
  return `<div class="tx">
    <button class="tx-head" data-open="${esc(t.id)}">
      <span class="tx-ico" title="${esc(i.catLabel)}">${i.icon}</span>
      <span class="tx-main"><span class="tx-name">${esc(i.name)}</span><span class="tx-meta">${esc(meta)}</span>
        ${t.purpose ? `<span class="tx-purpose">${esc(t.purpose)}</span>` : ''}
        ${i.found ? `<span class="found">🔎 ${esc([i.catLabel !== 'Sonstiges' ? i.catLabel : '', i.found.desc || '', `laut ${i.found.src}`].filter(Boolean).join(' · '))}</span>` : ''}</span>
      <span class="tx-amt num">${money(t.amount)}</span>
    </button>${chips}</div>`;
}
function todoHtml() {
  const list = unassigned();
  if (!Object.keys(db.tx).length) {
    return `<div class="card"><h2>👋 So geht's</h2>
      <ol style="margin:0;padding-left:20px;line-height:1.6">
        <li>In <b>Mein ELBA</b> bei deinem Konto die <b>Umsätze</b> öffnen, den Zeitraum wählen und als <b>CSV</b> exportieren/herunterladen.</li>
        <li>Hier auf <b>„Umsätze einlesen“</b> tippen und die Datei auswählen.</li>
        <li>Bei jeder Ausgabe antippen, <b>für wen</b> sie war. Die App merkt sich die Geschäfte.</li></ol>
      <button class="btn primary" data-act="import" style="margin-top:14px">⬇️ Umsätze einlesen</button>
      <button class="btn" data-act="manual">✍️ Ausgabe von Hand eintragen</button></div>
      <p class="hint">Deine Daten bleiben nur auf diesem Handy. Für die Firmen-Suche wird nur der Geschäftsname und Ort an OpenStreetMap bzw. Wikipedia geschickt – nie Beträge oder Personen.</p>`;
  }
  const withSug = list.filter((t) => suggestion(t));
  const bk = backupDue();
  return `${bk ? `<div class="warn-box">💾 ${bk} <button class="btn small" data-act="backup" style="margin-top:8px">Jetzt sichern</button></div>` : ''}
    ${list.length ? `<p class="hint" style="margin-top:0">${list.length} Ausgabe${list.length === 1 ? '' : 'n'} noch zuordnen. Tipp auf eine Person – oder auf den <b>Vorschlag</b>.</p>
      ${withSug.length > 1 ? `<button class="btn" data-act="allSug">✓ Alle ${withSug.length} Vorschläge übernehmen</button>` : ''}
      ${list.map((t) => txCard(t, 'todo')).join('')}`
      : `<div class="empty"><span class="big">🎉</span>Alles zugeordnet!<br><button class="btn primary" data-act="import" style="margin-top:14px">⬇️ Neue Umsätze einlesen</button></div>`}
    ${searching ? '<p class="hint">🔎 Suche gerade unbekannte Geschäfte im Internet …</p>' : ''}`;
}
function peopleHtml() {
  const list = db.persons.map((p) => ({ p, s: personStats(p.id) }));
  const total = list.reduce((x, y) => x + y.s.spent, 0);
  const openAll = list.reduce((x, y) => x + y.s.open, 0);
  return `${periodHtml()}
    <div class="stats"><div class="stat"><b class="num">${money(total)}</b><small>ausgegeben</small></div>
      <div class="stat ${openAll ? 'bad' : 'ok'}"><b class="num">${money(openAll)}</b><small>noch offen</small></div>
      <div class="stat"><b class="num">${unassigned().length}</b><small>nicht zugeordnet</small></div></div>
    <div class="people">${list.map(({ p, s }) => `<button class="pcard" data-person="${esc(p.id)}" style="--pc:${p.color}">
      <b>${esc(p.name)}</b><span class="big num">${money(s.spent)}</span><small>${s.items.length} Ausgabe${s.items.length === 1 ? '' : 'n'}</small>
      ${p.me ? '<small>deine eigenen Ausgaben</small>' : `<span class="open ${s.open ? '' : 'zero'}">${s.open ? `offen ${money(s.open)}` : s.credit ? `Guthaben ${money(s.credit)}` : 'alles bezahlt ✓'}</span>`}</button>`).join('')}</div>
    <p class="hint">„Offen“ zählt über alle Monate – was abgehakt oder als Zahlung eingetragen ist, ist erledigt.</p>`;
}
function allHtml() {
  const q = query.trim().toLowerCase();
  let list = Object.values(db.tx).filter((t) => inPeriod(t.date));
  if (filterP === 'none') list = list.filter((t) => !t.ignored && !(t.alloc || []).length);
  else if (filterP === 'ignored') list = list.filter((t) => t.ignored);
  else if (filterP !== 'all') list = list.filter((t) => (t.alloc || []).some((a) => a.p === filterP));
  if (q) list = list.filter((t) => { const i = info(t); return `${i.name} ${i.place} ${t.purpose || ''} ${t.raw} ${t.note || ''} ${i.catLabel}`.toLowerCase().includes(q); });
  list.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const amtOf = (t) => (filterP !== 'all' && filterP !== 'none' && filterP !== 'ignored' ? (t.alloc || []).filter((a) => a.p === filterP).reduce((s, a) => s + a.amt, 0) : t.amount);
  const sum = list.reduce((s, t) => s + amtOf(t), 0);
  const days = {}; list.forEach((t) => { (days[t.date] = days[t.date] || []).push(t); });
  return `${periodHtml()}
    <div class="chips" style="margin:0 0 10px">${[['all', 'Alle'], ...db.persons.map((p) => [p.id, p.name]), ['none', 'Nicht zugeordnet'], ['ignored', 'Ignoriert']].map(([k, l]) => `<button class="chip ${filterP === k ? 'on' : ''}" data-fp="${esc(k)}">${esc(l)}</button>`).join('')}</div>
    <input class="input" id="q" type="search" placeholder="Suchen … z. B. Lagerhaus, Saalfelden, Tankstelle" value="${esc(query)}">
    <div class="note-box" style="margin-top:10px">${list.length} Ausgabe${list.length === 1 ? '' : 'n'} · <b>${money(sum)}</b>${filterP !== 'all' && person(filterP) ? ` für ${esc(pname(filterP))}` : ''}</div>
    ${Object.entries(days).map(([d, ts]) => `<div class="day-head"><span>${esc(fmtDay(d, { weekday: 'long', day: 'numeric', month: 'long' }))}</span><span class="num">${money(ts.reduce((s, t) => s + amtOf(t), 0))}</span></div>${ts.map((t) => txCard(t, 'all')).join('')}`).join('') || '<div class="empty">Keine Ausgaben in diesem Zeitraum.</div>'}
    ${list.length ? '<button class="btn" data-act="csv">📊 Diese Liste als Excel-Tabelle</button>' : ''}`;
}
function statsHtml() {
  const list = Object.values(db.tx).filter((t) => inPeriod(t.date) && !t.ignored);
  const byCat = {}; list.forEach((t) => { const c = info(t).cat; byCat[c] = (byCat[c] || 0) + t.amount; });
  const byShop = {}; list.forEach((t) => { const n = info(t).name; byShop[n] = (byShop[n] || 0) + t.amount; });
  const tot = list.reduce((s, t) => s + t.amount, 0);
  const max = Math.max(...Object.values(byCat), 1);
  const bars = (obj, label) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;gap:8px;font-size:15px"><span>${label(k)}</span><b class="num">${money(v)}</b></div><div class="bar"><i style="width:${(v / max) * 100}%;background:var(--accent)"></i></div></div>`).join('');
  const people = db.persons.map((p) => ({ p, v: personStats(p.id).spent })).filter((x) => x.v);
  const pmax = Math.max(...people.map((x) => x.v), 1);
  return `${periodHtml()}
    <div class="stats"><div class="stat"><b class="num">${money(tot)}</b><small>gesamt</small></div><div class="stat"><b class="num">${list.length}</b><small>Ausgaben</small></div><div class="stat"><b class="num">${list.length ? money(tot / list.length) : '–'}</b><small>Ø pro Einkauf</small></div></div>
    ${people.length ? `<div class="card"><h2>Für wen</h2>${people.sort((a, b) => b.v - a.v).map(({ p, v }) => `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;font-size:15px"><span>${esc(p.name)}</span><b class="num">${money(v)}</b></div><div class="bar"><i style="width:${(v / pmax) * 100}%;background:${p.color}"></i></div></div>`).join('')}</div>` : ''}
    ${list.length ? `<div class="card"><h2>Wofür</h2>${bars(byCat, (k) => `${(CATS[k] || CATS.sonstiges)[0]} ${(CATS[k] || CATS.sonstiges)[1]}`)}</div>
      <div class="card"><h2>Wo am meisten</h2>${(() => { const m2 = Math.max(...Object.values(byShop), 1); return Object.entries(byShop).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;gap:8px;font-size:15px"><span>${esc(k)}</span><b class="num">${money(v)}</b></div><div class="bar"><i style="width:${(v / m2) * 100}%;background:var(--warn)"></i></div></div>`).join(''); })()}</div>` : '<div class="empty">Noch keine Ausgaben in diesem Zeitraum.</div>'}`;
}
function render(soft) {
  const v = $('#view');
  if (soft && document.activeElement && document.activeElement.id === 'q') return;
  $$('.tab').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab));
  const n = unassigned().length;
  $('#todoCount').hidden = !n; $('#todoCount').textContent = n > 99 ? '99+' : n;
  $('#sub').textContent = Object.keys(db.tx).length ? `${Object.keys(db.tx).length} Ausgaben · nur auf diesem Gerät` : 'Kartenausgaben zuordnen';
  const y = window.scrollY;
  v.innerHTML = tab === 'todo' ? todoHtml() : tab === 'people' ? peopleHtml() : tab === 'all' ? allHtml() : statsHtml();
  if (soft) window.scrollTo(0, y);
  bind(v);
}
function bind(v) {
  $$('[data-act="import"]', v).forEach((b) => (b.onclick = () => $('#fileCsv').click()));
  $$('[data-act="manual"]', v).forEach((b) => (b.onclick = () => openSheet(viewManual(null))));
  $$('[data-act="backup"]', v).forEach((b) => (b.onclick = exportBackup));
  $$('[data-act="csv"]', v).forEach((b) => (b.onclick = exportCsv));
  $$('[data-act="allSug"]', v).forEach((b) => (b.onclick = () => { const l = unassigned().filter((t) => suggestion(t)); l.forEach(applySuggestion); toast(`${l.length} zugeordnet`); render(true); }));
  $$('[data-sug]', v).forEach((b) => (b.onclick = () => { applySuggestion(db.tx[b.dataset.sug]); toast('Zugeordnet'); render(true); }));
  $$('[data-as]', v).forEach((b) => (b.onclick = () => { const [id, target] = b.dataset.as.split('|'); assign(db.tx[id], target); toast(target === 'ignore' ? 'Ignoriert' : `→ ${target.startsWith('g:') ? (db.groups.find((g) => g.id === target.slice(2)) || {}).name : pname(target)}`); render(true); }));
  $$('[data-split]', v).forEach((b) => (b.onclick = () => openSheet(viewSplit(b.dataset.split))));
  $$('[data-open]', v).forEach((b) => (b.onclick = () => openSheet(viewTx(b.dataset.open))));
  $$('[data-person]', v).forEach((b) => (b.onclick = () => openSheet(viewPerson(b.dataset.person))));
  $$('[data-pm]', v).forEach((b) => (b.onclick = () => { period.mode = b.dataset.pm; render(); }));
  $$('[data-shift]', v).forEach((b) => (b.onclick = () => { shift(+b.dataset.shift); render(); }));
  $$('[data-fp]', v).forEach((b) => (b.onclick = () => { filterP = b.dataset.fp; render(); }));
  const q = $('#q', v); if (q) q.oninput = (e) => { query = e.target.value; const pos = e.target.selectionStart; render(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
}

// ---------- Sheet ----------
let stack = []; let current = null;
function showView(view) {
  current = view; const v = view(); if (!v) { closeSheet(); return; }
  $('#sheetTitle').textContent = v.title; const b = $('#sheetBody'); b.innerHTML = v.html; b.scrollTop = 0;
  $('#sheetBack').hidden = !stack.length; $('#sheet').hidden = false; $('#overlay').hidden = false; document.body.style.overflow = 'hidden';
  if (v.mount) v.mount(b);
}
function openSheet(v) { stack = []; showView(v); }
function pushView(v) { if (current) stack.push(current); showView(v); }
function backView() { if (stack.length) showView(stack.pop()); else closeSheet(); }
function closeSheet() { stack = []; current = null; $('#sheet').hidden = true; $('#overlay').hidden = true; document.body.style.overflow = ''; render(true); }

// Detail einer Ausgabe
function viewTx(id) {
  return () => {
    const t = db.tx[id]; if (!t) return null;
    const i = info(t); const lk = db.lookups[t.mkey] || {};
    const rows = [['Wo', i.name], t.purpose ? ['Verwendungszweck', t.purpose] : null, ['Art', `${i.icon} ${i.catLabel}`], ['Ort', i.place || '–'], lk.addr ? ['Adresse', lk.addr] : null, ['Wann', `${fmtDay(t.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${t.time ? `, ${t.time} Uhr` : ''}`],
      t.booked && t.booked !== t.date ? ['Gebucht am', fmtDay(t.booked, { day: '2-digit', month: '2-digit', year: 'numeric' })] : null, ['Betrag', money(t.amount)], ['Bezahlt mit', `${KIND_LABEL[t.kind] || '–'}${t.via ? ` (über ${t.via})` : ''}`]].filter(Boolean);
    return {
      title: i.name,
      html: `<div class="card"><dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
          ${lk.src && !lk.custom ? `<p class="hint" style="margin:10px 0 0">🔎 Gefunden über <a href="${esc(lk.url)}" target="_blank" rel="noopener">${esc(lk.src)}</a>${lk.desc ? ` – ${esc(lk.desc)}` : ''}</p>` : ''}
          ${t.raw ? `<div class="section-title" style="margin-top:12px">Text von der Bank</div><div class="raw">${esc(t.raw)}</div>` : ''}</div>
        <div class="row"><a class="btn" href="${esc(googleUrl(t))}" target="_blank" rel="noopener">🔎 Im Internet suchen</a><button class="btn" id="tName">✏️ Name / Art ändern</button></div>
        <div class="section-title">Für wen</div>
        ${(t.alloc || []).length ? `<div class="list">${t.alloc.map((a, k) => `<div class="line-item"><button class="check ${a.paid ? 'on' : ''}" data-paid="${k}" aria-label="bezahlt">${a.paid ? '✓' : ''}</button><span class="info"><b>${esc(pname(a.p))}</b><small>${person(a.p) && person(a.p).me ? 'eigene Ausgabe' : a.paid ? 'zurückbezahlt' : 'noch offen'}</small></span><b class="num">${money(a.amt)}</b></div>`).join('')}</div>` : `<div class="${t.ignored ? 'note-box' : 'warn-box'}">${t.ignored ? 'Diese Ausgabe wird ignoriert (zählt nirgends mit).' : 'Noch niemandem zugeordnet.'}</div>`}
        <div class="chips">${db.persons.map((p) => `<button class="chip" data-to="${esc(p.id)}"><span class="pdot" style="background:${p.color}"></span>${esc(p.name)}</button>`).join('')}${db.groups.map((g) => `<button class="chip" data-to="g:${esc(g.id)}">👥 ${esc(g.name)}</button>`).join('')}<button class="chip ghost" id="tSplit">✂️ Aufteilen</button></div>
        <label class="field" style="margin-top:14px"><span>Notiz</span><input class="input" id="tNote" value="${esc(t.note || '')}" placeholder="z. B. Geburtstagsgeschenk, Hälfte vom Tanken"></label>
        ${t.src !== 'elba' ? '<button class="btn" id="tEdit">✏️ Betrag / Datum bearbeiten</button>' : ''}
        <button class="btn" id="tIgnore">${t.ignored ? '↩️ Nicht mehr ignorieren' : '🚫 Ignorieren (zählt nirgends mit)'}</button>
        <button class="btn danger" id="tDel">🗑️ Löschen</button>`,
      mount(b) {
        $$('[data-to]', b).forEach((x) => (x.onclick = () => { assign(t, x.dataset.to); toast('Gespeichert'); showView(viewTx(id)); }));
        $$('[data-paid]', b).forEach((x) => (x.onclick = () => { const a = t.alloc[+x.dataset.paid]; a.paid = !a.paid; save(); showView(viewTx(id)); }));
        $('#tSplit', b).onclick = () => pushView(viewSplit(id));
        $('#tName', b).onclick = () => pushView(viewRename(id));
        $('#tNote', b).onchange = (e) => { t.note = e.target.value.trim(); save(); };
        const ed = $('#tEdit', b); if (ed) ed.onclick = () => pushView(viewManual(id));
        $('#tIgnore', b).onclick = () => { if (t.ignored) t.ignored = false; else { t.ignored = true; t.alloc = []; } save(); showView(viewTx(id)); };
        $('#tDel', b).onclick = () => {
          if (!confirm(t.src === 'elba' ? 'Löschen? Beim nächsten Einlesen derselben Datei kommt die Ausgabe wieder. Besser: „Ignorieren“.' : 'Diese Ausgabe löschen?')) return;
          delete db.tx[id]; save(); closeSheet(); toast('Gelöscht');
        };
      },
    };
  };
}
function viewRename(id) {
  return () => {
    const t = db.tx[id]; const i = info(t);
    return {
      title: 'Name & Art',
      html: `<p class="hint" style="margin-top:0">Gilt für alle Ausgaben bei „${esc(t.merchant)}“ – auch für künftige.</p>
        <label class="field"><span>Name</span><input class="input" id="rnName" value="${esc(i.name)}"></label>
        <label class="field"><span>Ort</span><input class="input" id="rnPlace" value="${esc(i.place)}"></label>
        <label class="field"><span>Art</span><select class="input" id="rnCat">${Object.entries(CATS).map(([k, [ic, l]]) => `<option value="${k}" ${k === i.cat ? 'selected' : ''}>${ic} ${l}</option>`).join('')}</select></label>
        <button class="btn primary" id="rnSave">Speichern</button>`,
      mount(b) {
        $('#rnSave', b).onclick = () => {
          const name = $('#rnName', b).value.trim();
          if (t.mkey) db.lookups[t.mkey] = { ...(db.lookups[t.mkey] || {}), name: name || t.merchant, place: $('#rnPlace', b).value.trim(), cat: $('#rnCat', b).value, custom: true, at: Date.now() };
          else { t.name = name; t.place = $('#rnPlace', b).value.trim(); t.cat = $('#rnCat', b).value; }
          save(); toast('Gespeichert'); backView();
        };
      },
    };
  };
}
function viewSplit(id) {
  return () => {
    const t = db.tx[id];
    const cur = {}; (t.alloc || []).forEach((a) => { cur[a.p] = a.amt; });
    return {
      title: `Aufteilen · ${money(t.amount)}`,
      html: `<p class="hint" style="margin-top:0">${esc(info(t).name)} · ${esc(fmtDay(t.date))}. Trag ein, wie viel auf wen fällt.</p>
        <div class="list">${db.persons.map((p) => `<div class="split-row"><label><input type="checkbox" data-sp-on="${esc(p.id)}" ${cur[p.id] ? 'checked' : ''} style="width:20px;height:20px;accent-color:${p.color}">${esc(p.name)}</label>
          <input class="input num" data-sp="${esc(p.id)}" inputmode="decimal" value="${cur[p.id] ? fmtIn(cur[p.id]) : ''}" placeholder="0,00"></div>`).join('')}</div>
        <div class="note-box" id="spInfo" style="margin-top:10px"></div>
        <div class="row"><button class="btn" id="spEven">Gleichmäßig auf Angehakte</button></div>
        <label class="check-line"><input type="checkbox" id="spRemember" checked> Für „${esc(info(t).name)}“ künftig so vorschlagen</label>
        <button class="btn primary" id="spSave">Speichern</button>`,
      mount(b) {
        const upd = () => {
          let s = 0; $$('[data-sp]', b).forEach((x) => { const v = num(x.value) || 0; s += v; $(`[data-sp-on="${x.dataset.sp}"]`, b).checked = v > 0 || $(`[data-sp-on="${x.dataset.sp}"]`, b).checked && x.value === ''; });
          const rest = r2(t.amount - s);
          $('#spInfo', b).innerHTML = rest === 0 ? '✓ Passt genau.' : rest > 0 ? `Noch <b>${money(rest)}</b> zu verteilen.` : `<span style="color:var(--bad)">${money(-rest)} zu viel.</span>`;
          $('#spSave', b).disabled = rest !== 0;
        };
        $$('[data-sp]', b).forEach((x) => (x.oninput = upd));
        $$('[data-sp-on]', b).forEach((x) => (x.onchange = () => { if (!x.checked) $(`[data-sp="${x.dataset.spOn}"]`, b).value = ''; upd(); }));
        $('#spEven', b).onclick = () => {
          const ids = $$('[data-sp-on]', b).filter((x) => x.checked).map((x) => x.dataset.spOn);
          if (!ids.length) { toast('Zuerst Personen anhaken'); return; }
          const parts = evenSplit(t.amount, ids); $$('[data-sp]', b).forEach((x) => { const p = parts.find((y) => y.p === x.dataset.sp); x.value = p ? fmtIn(p.amt) : ''; }); upd();
        };
        upd();
        $('#spSave', b).onclick = () => {
          const parts = $$('[data-sp]', b).map((x) => ({ p: x.dataset.sp, amt: num(x.value) || 0, paid: ((t.alloc || []).find((a) => a.p === x.dataset.sp) || {}).paid }));
          applySplit(t, parts, $('#spRemember', b).checked); toast('Aufgeteilt'); if (stack.length) backView(); else closeSheet();
        };
      },
    };
  };
}
function viewManual(id) {
  return () => {
    const t = id ? db.tx[id] : null;
    const now = new Date();
    return {
      title: t ? 'Ausgabe bearbeiten' : 'Ausgabe eintragen',
      html: `<div class="grid2">
          <label class="field"><span>Betrag (€)</span><input class="input num" id="mAmt" inputmode="decimal" value="${t ? fmtIn(t.amount) : ''}" placeholder="0,00"></label>
          <label class="field"><span>Bezahlt mit</span><select class="input" id="mKind">${['bar', 'card2', 'transfer', 'card'].map((k) => `<option value="${k}" ${t && t.kind === k ? 'selected' : ''}>${KIND_LABEL[k]}</option>`).join('')}</select></label></div>
        <label class="field"><span>Wo (Geschäft)</span><input class="input" id="mName" value="${esc(t ? t.name || t.merchant : '')}" placeholder="z. B. Lagerhaus"></label>
        <div class="grid2">
          <label class="field"><span>Ort</span><input class="input" id="mPlace" value="${esc(t ? t.place : '')}" placeholder="z. B. Saalfelden"></label>
          <label class="field"><span>Art</span><select class="input" id="mCat">${Object.entries(CATS).map(([k, [ic, l]]) => `<option value="${k}" ${(t ? t.cat : 'sonstiges') === k ? 'selected' : ''}>${ic} ${l}</option>`).join('')}</select></label>
          <label class="field"><span>Datum</span><input class="input" id="mDate" type="date" value="${t ? t.date : today()}"></label>
          <label class="field"><span>Uhrzeit</span><input class="input" id="mTime" type="time" value="${t ? t.time || '' : `${pad(now.getHours())}:${pad(now.getMinutes())}`}"></label></div>
        ${t ? '' : `<div class="section-title">Für wen</div><div class="chips" id="mFor">${db.persons.map((p) => `<button class="chip" data-f="${esc(p.id)}"><span class="pdot" style="background:${p.color}"></span>${esc(p.name)}</button>`).join('')}${db.groups.map((g) => `<button class="chip" data-f="g:${esc(g.id)}">👥 ${esc(g.name)}</button>`).join('')}</div>`}
        <label class="field" style="margin-top:12px"><span>Notiz</span><input class="input" id="mNote" value="${esc(t ? t.note || '' : '')}"></label>
        <button class="btn primary" id="mSave">Speichern</button>`,
      mount(b) {
        let target = null;
        $$('[data-f]', b).forEach((x) => (x.onclick = () => { target = target === x.dataset.f ? null : x.dataset.f; $$('[data-f]', b).forEach((y) => y.classList.toggle('on', y.dataset.f === target)); }));
        $('#mSave', b).onclick = () => {
          const amount = num($('#mAmt', b).value);
          if (!amount || amount <= 0) { toast('Bitte einen Betrag eingeben'); $('#mAmt', b).focus(); return; }
          const name = $('#mName', b).value.trim() || 'Ausgabe';
          const data = { date: $('#mDate', b).value || today(), time: $('#mTime', b).value || null, amount: r2(amount), name, merchant: name, place: $('#mPlace', b).value.trim(), cat: $('#mCat', b).value, kind: $('#mKind', b).value, note: $('#mNote', b).value.trim() };
          if (t) {
            const scale = t.amount ? data.amount / t.amount : 1;
            Object.assign(t, data);
            if ((t.alloc || []).length === 1) t.alloc[0].amt = t.amount; else (t.alloc || []).forEach((a) => { a.amt = r2(a.amt * scale); });
          } else {
            const nt = { id: `m${uid()}`, ...data, src: 'manual', mkey: '', alloc: [], created: Date.now() };
            db.tx[nt.id] = nt;
            if (target) assign(nt, target, false);
          }
          save(); toast('Gespeichert'); if (stack.length) backView(); else closeSheet();
        };
      },
    };
  };
}
// Person: alle Ausgaben, offen/bezahlt, Zahlung erhalten, teilen
function viewPerson(pid) {
  return () => {
    const p = person(pid); if (!p) return null;
    const s = personStats(pid);
    return {
      title: p.name,
      html: `<div class="hint" style="margin-top:0">${esc(periodLabel())}</div>
        <div class="stats"><div class="stat"><b class="num">${money(s.spent)}</b><small>ausgegeben</small></div>
          ${p.me ? `<div class="stat"><b class="num">${s.items.length}</b><small>Ausgaben</small></div><div class="stat"><b class="num">${s.items.length ? money(s.spent / s.items.length) : '–'}</b><small>Ø</small></div>`
          : `<div class="stat ok"><b class="num">${money(s.paid)}</b><small>zurückbezahlt</small></div><div class="stat ${s.open ? 'bad' : 'ok'}"><b class="num">${money(s.open)}</b><small>noch offen</small></div>`}</div>
        ${p.me ? '' : `<div class="row"><button class="btn primary" id="pPay">💶 Zahlung erhalten</button><button class="btn" id="pShare">📤 Liste schicken</button></div>
          ${s.items.some((x) => !x.a.paid) ? '<button class="btn" id="pAll">✓ Alle in diesem Zeitraum als bezahlt abhaken</button>' : ''}`}
        <div class="section-title"><span>Ausgaben</span><span>${s.items.length}</span></div>
        ${s.items.length ? `<div class="list">${s.items.map(({ t, a, i }) => { const inf = info(t); return `<div class="line-item">
            ${p.me ? `<span class="tx-ico" style="width:32px;height:32px;font-size:16px">${inf.icon}</span>` : `<button class="check ${a.paid ? 'on' : ''}" data-pp="${esc(t.id)}|${i}" aria-label="bezahlt">${a.paid ? '✓' : ''}</button>`}
            <button class="info" data-open2="${esc(t.id)}"><b>${esc(inf.name)}</b><small>${esc([inf.place, `${fmtDay(t.date)}${t.time ? ` ${t.time}` : ''}`, t.alloc.length > 1 ? `Anteil von ${money(t.amount)}` : '', t.note].filter(Boolean).join(' · '))}</small></button>
            <b class="num">${money(a.amt)}</b></div>`; }).join('')}</div>` : '<div class="empty">Keine Ausgaben in diesem Zeitraum.</div>'}
        ${s.payments.length && !p.me ? `<div class="section-title">Erhaltene Zahlungen</div><div class="list">${s.payments.slice().sort((x, y) => y.date.localeCompare(x.date)).map((x) => `<div class="line-item"><span class="info"><b>${money(x.amt)}</b><small>${esc([fmtDay(x.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), x.note].filter(Boolean).join(' · '))}</small></span><button class="icon-btn" data-pdel="${esc(x.id)}" aria-label="Zahlung löschen">🗑️</button></div>`).join('')}</div>` : ''}
        <button class="btn" id="pCsv">📊 Als Excel-Tabelle</button>`,
      mount(b) {
        $$('[data-pp]', b).forEach((x) => (x.onclick = () => { const [tid, k] = x.dataset.pp.split('|'); const a = db.tx[tid].alloc[+k]; a.paid = !a.paid; save(); showView(viewPerson(pid)); }));
        $$('[data-open2]', b).forEach((x) => (x.onclick = () => pushView(viewTx(x.dataset.open2))));
        $$('[data-pdel]', b).forEach((x) => (x.onclick = () => { if (!confirm('Diese Zahlung löschen?')) return; db.payments = db.payments.filter((y) => y.id !== x.dataset.pdel); save(); showView(viewPerson(pid)); }));
        const pay = $('#pPay', b); if (pay) pay.onclick = () => pushView(viewPayment(pid));
        const all = $('#pAll', b); if (all) all.onclick = () => { if (!confirm(`Alle ${s.items.filter((x) => !x.a.paid).length} offenen Ausgaben von ${p.name} (${periodLabel()}) als bezahlt abhaken?`)) return; s.items.forEach(({ a }) => { a.paid = true; }); save(); showView(viewPerson(pid)); };
        const sh = $('#pShare', b); if (sh) sh.onclick = () => shareList(pid);
        $('#pCsv', b).onclick = () => exportCsv(pid);
      },
    };
  };
}
function viewPayment(pid) {
  return () => ({
    title: `Zahlung von ${pname(pid)}`,
    html: `<p class="hint" style="margin-top:0">Noch offen: <b>${money(personStats(pid).open)}</b>. Eine Zahlung wird vom offenen Betrag abgezogen.</p>
      <div class="grid2"><label class="field"><span>Betrag (€)</span><input class="input num" id="pyAmt" inputmode="decimal" value="${fmtIn(personStats(pid).open) || ''}"></label>
      <label class="field"><span>Datum</span><input class="input" id="pyDate" type="date" value="${today()}"></label></div>
      <label class="field"><span>Notiz</span><input class="input" id="pyNote" placeholder="z. B. bar, überwiesen"></label>
      <label class="check-line"><input type="checkbox" id="pyTick"> Wenn alles bezahlt ist: alle offenen Ausgaben abhaken</label>
      <button class="btn primary" id="pySave">Speichern</button>`,
    mount(b) {
      $('#pySave', b).onclick = () => {
        const amt = num($('#pyAmt', b).value);
        if (!amt || amt <= 0) { toast('Bitte einen Betrag eingeben'); return; }
        const st = personStats(pid, false);
        if ($('#pyTick', b).checked && amt >= st.open - 0.005) {
          Object.values(db.tx).forEach((t) => (t.alloc || []).forEach((a) => { if (a.p === pid) a.paid = true; }));
          const rest = r2(amt - st.open);
          db.payments = db.payments.filter((x) => x.p !== pid);
          if (rest > 0.005) db.payments.push({ id: uid(), p: pid, amt: rest, date: $('#pyDate', b).value || today(), note: 'Überzahlung / Guthaben' });
        } else db.payments.push({ id: uid(), p: pid, amt: r2(amt), date: $('#pyDate', b).value || today(), note: $('#pyNote', b).value.trim() });
        save(); toast('Zahlung eingetragen'); backView();
      };
    },
  });
}

// ---------- Export / Teilen / Sicherung ----------
function csvText(rows) { return '﻿' + rows.map((r) => r.map((v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\r\n'); }
const dec = (n) => (Math.round((n || 0) * 100) / 100).toFixed(2).replace('.', ',');
async function saveFile(name, mime, text) {
  const blob = new Blob([text], { type: mime });
  try { const f = new File([blob], name, { type: mime }); if (/iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function exportCsv(pid) {
  const only = typeof pid === 'string' ? pid : (filterP !== 'all' && person(filterP) ? filterP : null);
  const rows = [['Datum', 'Uhrzeit', 'Wo', 'Ort', 'Art', 'Betrag gesamt (EUR)', 'Für wen', 'Anteil (EUR)', 'Bezahlt', 'Notiz', 'BankText']];
  Object.values(db.tx).filter((t) => inPeriod(t.date) && !t.ignored).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).forEach((t) => {
    const i = info(t); const al = (t.alloc || []).length ? t.alloc : [{ p: null, amt: t.amount }];
    al.filter((a) => !only || a.p === only).forEach((a) => rows.push([fmtDay(t.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), t.time || '', i.name, i.place, i.catLabel, dec(t.amount), a.p ? pname(a.p) : 'nicht zugeordnet', dec(a.amt), a.paid ? 'ja' : 'nein', t.note || '', t.raw || '']));
  });
  saveFile(`ausgaben-${only ? pname(only).toLowerCase() : 'alle'}-${period.mode === 'month' ? period.ym : period.mode === 'year' ? period.y : 'gesamt'}.csv`, 'text/csv', csvText(rows));
}
async function shareList(pid) {
  const s = personStats(pid);
  const open = s.items.filter((x) => !x.a.paid);
  const lines = open.map(({ t, a }) => { const i = info(t); return `• ${fmtDay(t.date, { day: '2-digit', month: '2-digit' })}${t.time ? ` ${t.time}` : ''} ${i.name}${i.place ? `, ${i.place}` : ''}: ${money(a.amt)}`; });
  const text = `Hallo ${pname(pid)}, hier meine Auslagen für dich (${periodLabel()}):\n\n${lines.join('\n') || '(nichts offen)'}\n\nNoch offen gesamt: ${money(s.open)}`;
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Text kopiert – jetzt z. B. in WhatsApp einfügen'); } catch (e) { toast('Teilen geht hier nicht'); }
}
function backupDue() {
  if (Object.keys(db.tx).length < 10) return '';
  const d = db.lastBackup ? Math.floor((Date.now() - db.lastBackup) / 86400000) : null;
  if (d != null && d <= 30) return '';
  return d == null ? 'Deine Ausgaben sind nur auf diesem Handy gespeichert – mach ab und zu eine Sicherung.' : `Letzte Sicherung vor ${d} Tagen.`;
}
function exportBackup() {
  db.lastBackup = Date.now(); save();
  saveFile(`ausgaben-sicherung-${today()}.json`, 'application/json', JSON.stringify({ app: 'ausgaben', version: VERSION, exported: new Date().toISOString(), data: db }));
  render(true);
}
async function importBackup(file) {
  try {
    const j = JSON.parse(await file.text());
    if (j.app !== 'ausgaben' || !j.data || !j.data.tx) throw new Error('Das ist keine Ausgaben-Sicherung.');
    if (!confirm(`Sicherung vom ${new Date(j.exported).toLocaleString('de-AT')} mit ${Object.keys(j.data.tx).length} Ausgaben laden? Der jetzige Stand wird ersetzt.`)) return;
    db = { ...DEFAULT(), ...j.data }; save(); closeSheet(); render(); toast('Sicherung geladen');
  } catch (e) { toast(e.message || 'Datei konnte nicht gelesen werden', 4000); }
}

// ---------- Einstellungen ----------
function viewSettings() {
  return {
    title: 'Einstellungen',
    html: `<div class="section-title">Personen</div>
      <div class="list">${db.persons.map((p) => `<div class="line-item"><input type="color" value="${esc(p.color)}" data-pc="${esc(p.id)}" style="width:34px;height:34px;border:0;background:none;padding:0" aria-label="Farbe">
        <input class="input" data-pn="${esc(p.id)}" value="${esc(p.name)}" style="min-height:40px">${p.me ? '<small class="muted">du</small>' : `<button class="icon-btn" data-pdel="${esc(p.id)}" aria-label="entfernen">🗑️</button>`}</div>`).join('')}</div>
      <button class="btn" id="sAddP">+ Person hinzufügen</button>
      <div class="section-title">Gruppen (werden halb-halb bzw. gleichmäßig aufgeteilt)</div>
      <div class="list">${db.groups.map((g) => `<div class="line-item"><span class="info"><b>${esc(g.name)}</b><small>${esc(g.members.map(pname).join(', '))}</small></span><button class="icon-btn" data-gedit="${esc(g.id)}" aria-label="bearbeiten">✏️</button></div>`).join('') || '<p class="hint">Keine Gruppen.</p>'}</div>
      <button class="btn" id="sAddG">+ Gruppe hinzufügen</button>
      <div class="section-title">Gelernte Zuordnungen</div>
      <div class="list">${Object.entries(db.rules).map(([k, r]) => `<div class="line-item"><span class="info"><b>${esc(titleCase(k))}</b><small>${esc(typeof r === 'string' ? (r === 'ignore' ? 'ignorieren' : r.startsWith('g:') ? (db.groups.find((g) => g.id === r.slice(2)) || {}).name || '?' : pname(r)) : r.split ? r.split.map(([p, f]) => `${pname(p)} ${Math.round(f * 100)} %`).join(' / ') : '')}</small></span><button class="icon-btn" data-rdel="${esc(k)}" aria-label="vergessen">✖</button></div>`).join('') || '<p class="hint">Noch nichts gelernt.</p>'}</div>
      <div class="section-title">Suche</div>
      <label class="check-line"><input type="checkbox" id="sAuto" ${db.settings.autoSearch ? 'checked' : ''}> Unbekannte Geschäfte automatisch im Internet suchen (OpenStreetMap, Wikipedia)</label>
      <button class="btn" id="sReSearch">🔎 Nicht gefundene nochmal suchen</button>
      <div class="section-title">Sicherung</div>
      <button class="btn primary" id="sBackup">💾 Sicherung speichern</button>
      <button class="btn" id="sRestore">📂 Sicherung laden</button>
      <button class="btn danger" id="sWipe">Alle Daten löschen</button>
      <p class="hint" style="text-align:center">Ausgaben ${VERSION} · ${Object.keys(db.tx).length} Ausgaben · nur auf diesem Gerät gespeichert</p>`,
    mount(b) {
      $$('[data-pn]', b).forEach((x) => (x.onchange = () => { const p = person(x.dataset.pn); p.name = x.value.trim() || p.name; save(); }));
      $$('[data-pc]', b).forEach((x) => (x.onchange = () => { person(x.dataset.pc).color = x.value; save(); }));
      $$('[data-pdel]', b).forEach((x) => (x.onclick = () => {
        const id = x.dataset.pdel; const used = Object.values(db.tx).some((t) => (t.alloc || []).some((a) => a.p === id));
        if (used) { toast('Diese Person hat schon Ausgaben – zuerst umbuchen'); return; }
        if (!confirm(`${pname(id)} entfernen?`)) return;
        db.persons = db.persons.filter((p) => p.id !== id); db.groups.forEach((g) => { g.members = g.members.filter((m) => m !== id); }); save(); showView(viewSettings);
      }));
      $('#sAddP', b).onclick = () => { const n = prompt('Name der Person'); if (!n || !n.trim()) return; db.persons.push({ id: `p${uid()}`, name: n.trim(), color: COLORS[db.persons.length % COLORS.length] }); save(); showView(viewSettings); };
      $('#sAddG', b).onclick = () => pushView(viewGroup(null));
      $$('[data-gedit]', b).forEach((x) => (x.onclick = () => pushView(viewGroup(x.dataset.gedit))));
      $$('[data-rdel]', b).forEach((x) => (x.onclick = () => { delete db.rules[x.dataset.rdel]; save(); showView(viewSettings); }));
      $('#sAuto', b).onchange = (e) => { db.settings.autoSearch = e.target.checked; save(); if (e.target.checked) lookupQueue(); };
      $('#sReSearch', b).onclick = () => { Object.keys(db.lookups).forEach((k) => { if (db.lookups[k].none) delete db.lookups[k]; }); save(); toast('Suche läuft im Hintergrund …'); lookupQueue(); };
      $('#sBackup', b).onclick = exportBackup;
      $('#sRestore', b).onclick = () => $('#fileBackup').click();
      $('#sWipe', b).onclick = () => { if (!confirm('Wirklich ALLE Ausgaben, Personen und Zuordnungen löschen?')) return; if (!confirm('Ganz sicher? Das kann nicht rückgängig gemacht werden (außer mit einer Sicherung).')) return; db = DEFAULT(); save(); closeSheet(); render(); };
    },
  };
}
function viewGroup(gid) {
  return () => {
    const g = gid ? db.groups.find((x) => x.id === gid) : { name: '', members: [] };
    return {
      title: gid ? 'Gruppe bearbeiten' : 'Neue Gruppe',
      html: `<label class="field"><span>Name</span><input class="input" id="gName" value="${esc(g.name)}" placeholder="z. B. Mama & Papa"></label>
        <div class="list">${db.persons.map((p) => `<label class="check-line"><input type="checkbox" data-gm="${esc(p.id)}" ${g.members.includes(p.id) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('')}</div>
        <button class="btn primary" id="gSave">Speichern</button>${gid ? '<button class="btn danger" id="gDel">Gruppe löschen</button>' : ''}`,
      mount(b) {
        $('#gSave', b).onclick = () => {
          const members = $$('[data-gm]', b).filter((x) => x.checked).map((x) => x.dataset.gm);
          if (members.length < 2) { toast('Mindestens zwei Personen wählen'); return; }
          const name = $('#gName', b).value.trim() || members.map(pname).join(' & ');
          if (gid) Object.assign(g, { name, members }); else db.groups.push({ id: uid(), name, members });
          save(); backView();
        };
        const d = $('#gDel', b); if (d) d.onclick = () => { db.groups = db.groups.filter((x) => x.id !== gid); save(); backView(); };
      },
    };
  };
}

// ---------- Start ----------
$$('.tab').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
$('#fab').onclick = () => openSheet(viewManual(null));
$('#btnImport').onclick = () => $('#fileCsv').click();
$('#btnSettings').onclick = () => openSheet(viewSettings);
$('#sheetClose').onclick = closeSheet;
$('#sheetBack').onclick = backView;
$('#overlay').onclick = closeSheet;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
$('#fileCsv').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onCsvFile(f); };
$('#fileBackup').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importBackup(f); };
window.addEventListener('online', lookupQueue);
migrate();
render();
lookupQueue();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
// für Tests
window.__ausgaben = { parseShop, parseText, parseCsv, detectColumns, buildTx };
})();
