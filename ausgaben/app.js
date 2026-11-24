/* Ausgaben: Kartenumsätze aus Mein ELBA einlesen, Personen zuordnen, offen/bezahlt verfolgen.
   Alle Daten bleiben nur auf diesem Gerät (localStorage). */
(() => {
'use strict';
const VERSION = '1.4';
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
let settleCache = {};
function save() { settleCache = {}; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Speicher voll – bitte eine Sicherung machen und alte Jahre löschen', 5000); } }

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
  wohnen: ['🛋️', 'Möbel / Wohnen'], tiere: ['🐾', 'Tierbedarf'], abo: ['🔁', 'Abo / Handy'], hotel: ['🏨', 'Unterkunft'], auto: ['🚗', 'Auto / Werkstatt'], sonstiges: ['💳', 'Sonstiges'], einnahme: ['💰', 'Einnahme'],
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
  ['mcdonald', "McDonald's", 'essen'], ['burgerking', 'Burger King', 'essen'], ['hornbach', 'Hornbach', 'bau'], ['xxxlutz', 'XXXLutz', 'wohnen'], ['ikea', 'IKEA', 'wohnen'], ['mediamarkt', 'MediaMarkt', 'elektronik'], ['mediam', 'MediaMarkt', 'elektronik'], ['klarna', 'Klarna', 'online'],
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
    .replace(/\b(Ag|Ab|Se|Bv|Nv|Kg|Og|Gmbh|Ug|Eu|Öbb|Oebb|Dm|Bp|Omv|Kfz|Ams|Svs|Orf|Gis|Atu)\b/g, (w) => ({ Gmbh: 'GmbH', Oebb: 'ÖBB', Dm: 'dm' }[w] || w.toUpperCase()));
}
// Kartenzahlung aus dem Buchungstext lesen: Uhrzeit, Geschäft, Ort
// ELBA-Text hat Felder wie "Verwendungszweck: … Zahlungsreferenz: … Kartenfolge-Nr.: 1"
const LABELS = [
  ['ibanEmpf', 'IBAN Zahlungsempf(?:ä|ae|a)nger'], ['bicEmpf', 'BIC Zahlungsempf(?:ä|ae|a)nger'], ['ibanAuf', 'IBAN Auftraggeber'], ['bicAuf', 'BIC Auftraggeber'],
  ['ibanEmpf2', 'IBAN Empf(?:ä|ae|a)nger'], ['bicEmpf2', 'BIC Empf(?:ä|ae|a)nger'], ['empf', 'Zahlungsempf(?:ä|ae|a)nger'], ['pflicht', 'Zahlungspflichtiger'], ['auf', 'Auftraggeber'], ['empf2', 'Empf(?:ä|ae|a)nger'],
  ['vz', 'Verwendungszweck'], ['ref', 'Zahlungsreferenz'], ['kfn', 'Kartenfolge-?Nr\\.?'], ['mandat', 'Mandat(?:sreferenz)?'], ['cred', 'Creditor[- ]?ID'],
  ['btext', 'Buchungstext'], ['aufref', 'Auftraggeberreferenz'], ['kenn', 'Empf(?:ä|ae|a)nger-?Kennung'],
];
const LABEL_RE = new RegExp(`(?<![\\p{L}])(${LABELS.map((l) => l[1]).join('|')})\\s*:`, 'giu');
function fields(t) {
  const hits = []; let m; LABEL_RE.lastIndex = 0;
  while ((m = LABEL_RE.exec(t))) { const key = (LABELS.find((l) => new RegExp(`^${l[1]}$`, 'iu').test(m[1])) || [m[1]])[0]; hits.push({ key, i: m.index, end: LABEL_RE.lastIndex }); }
  if (!hits.length) return null;
  const out = { _pre: t.slice(0, hits[0].i).trim() };
  hits.forEach((h, n) => { if (!(h.key in out)) out[h.key] = t.slice(h.end, n + 1 < hits.length ? hits[n + 1].i : t.length).trim(); });
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
  while (name.length > 1 && /^\d+$/.test(name[0])) name.shift(); // Filialnummer vorne weg
  return { merchant: titleCase(name.join(' ')).slice(0, 40) || 'Unbekannt', place: titleCase(place.join(' ')).slice(0, 40), via: via && via !== 'POS' ? titleCase(via) : null };
}
function parseText(raw) {
  const t = String(raw || '').replace(/[\\|]/g, ' ').trim();
  const flat = t.replace(/\s+/g, ' ');
  const f = fields(t);
  let time = null; let day = null;
  const findWhen = (x) => { const m = String(x || '').replace(/\s+/g, ' ').match(RE_WHEN) || String(x || '').replace(/\s+/g, ' ').match(/(\d{2})\.(\d{2})\.?\s+UM\s+(\d{1,2})[:.](\d{2})/i); if (m && !time) { time = `${pad(m[3])}:${m[4]}`; day = { d: +m[1], m: +m[2] }; } return m; };
  if (f) {
    const ref = f.ref || ''; const vz = f.vz || '';
    findWhen(ref); findWhen(vz); findWhen(f._pre);
    const payee = f.empf || f.empf2 || f.auf || f.pflicht || '';
    const cardish = 'kfn' in f || /\b(POS|E-?COMM|ECOM|AUTOMAT|ATM|BANKOMAT)\b/i.test(ref);
    if (cardish) {
      let shopText = vz;
      const r1 = ref.replace(/\s+/g, ' ').trim();
      if (!shopText) { // z. B. "HOFER DANKT 2362 D1 28.08. 12:31" – Geschäft steht vor dem Zeitpunkt
        const m = r1.match(RE_WHEN);
        const before = (m ? r1.slice(0, r1.indexOf(m[0])) : r1)
          .replace(/^(POS|E-?COMM(ERCE)?|ECOM|AUTOMAT|ATM|BANKOMAT)\s+/i, '').replace(/^\d{1,3}(\.\d{3})*,\d{2}\s+[A-Z]{2}\s+/, '')
          .replace(/\s+\d{3,5}\s+[A-Z]\d\s*$/, '').replace(/(^|\s)[A-Z]\d\s*$/, '').trim();
        const after = m ? r1.slice(r1.indexOf(m[0]) + m[0].length).trim() : '';
        shopText = before || after;
      }
      const sp = parseShop(shopText);
      return { time, day, ...sp, purpose: vz || r1 };
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
const KIND_LABEL = { card: 'Bankomatkarte', atm: 'Behebung', other: 'Abbuchung', bar: 'Bar', card2: 'Andere Karte', transfer: 'Überweisung', in: 'Eingang' };
const isIn = (t) => t.dir === 'in';

// Anzeige-Infos einer Ausgabe (Name, Art, Ort)
function info(tx) {
  const lk = (!isIn(tx) && db.lookups[tx.mkey]) || {};
  const brand = isIn(tx) ? null : brandOf(tx.merchant);
  const name = tx.name || lk.name || (brand && brand.name) || tx.merchant;
  const cat = isIn(tx) ? (tx.cat || 'einnahme') : tx.cat || lk.cat || (brand && brand.cat) || (tx.kind === 'atm' ? 'bargeld' : 'sonstiges');
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
  const kind = tx.dir === 'in' ? 'in' : txKind(raw);
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
  return applyParse({ id, amount: r2(Math.abs(row.amount)), dir: row.amount > 0 ? 'in' : 'out', src: 'elba', alloc: [], created: Date.now() }, row.raw, row.date, row.ts);
}
// Nach einem Update: bereits eingelesene Ausgaben neu erkennen (Zuordnungen bleiben)
const PARSER = 4;
function migrate() {
  if ((db.parser || 1) >= PARSER) return;
  const junk = /kartenfolge|verwendungszweck|zahlungsreferenz|^unbekannt$/;
  Object.values(db.tx).forEach((t) => { if (t.src === 'elba' && t.raw) applyParse(t, t.raw, t.booked || t.date, null); });
  Object.keys(db.rules).forEach((k) => { if (junk.test(k)) delete db.rules[k]; });
  Object.keys(db.lookups).forEach((k) => { if (junk.test(k) || !db.lookups[k].custom) delete db.lookups[k]; }); // neu suchen, nur noch in Österreich
  db.parser = PARSER; save();
}
// Einmalig: alte, von Hand gesetzte Haken entfernen (jetzt rechnet die App selbst)
function resetTicksOnce() {
  if (db.ticksReset) return;
  Object.values(db.tx).forEach((t) => (t.alloc || []).forEach((a) => { a.paid = false; }));
  db.ticksReset = true; save();
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
  const all = (res.out || []).filter((r) => r.amount !== 0).map(buildTx);
  const nOut = all.filter((t) => !isIn(t)).length; const nIn = all.length - nOut;
  const fresh = all.filter((t) => !db.tx[t.id]);
  const by = (k) => fresh.filter((t) => t.kind === k);
  return {
    title: 'Umsätze einlesen',
    html: `<div class="note-box">In <b>${esc(pendingImport.name)}</b> stehen <b>${nOut}</b> Abbuchungen und <b>${nIn}</b> Eingänge. Davon sind <b>${fresh.length} neu</b>, ${all.length - fresh.length} hast du schon.</div>
      <label class="check-line"><input type="checkbox" checked disabled> 💳 Kartenzahlungen (${by('card').length} neu)</label>
      <label class="check-line"><input type="checkbox" id="imAtm" ${db.settings.withAtm ? 'checked' : ''}> 🏧 Bargeld-Behebungen (${by('atm').length} neu)</label>
      <label class="check-line"><input type="checkbox" id="imOther" ${db.settings.withOther ? 'checked' : ''}> 🔁 Andere Abbuchungen, z. B. Überweisungen, Lastschriften (${by('other').length} neu)</label>
      <label class="check-line"><input type="checkbox" id="imIn" ${db.settings.withIn !== false ? 'checked' : ''}> 💰 Einnahmen / Eingänge (${by('in').length} neu)</label>
      ${fresh.length ? `<div class="section-title">Vorschau</div><div class="list">${fresh.slice(0, 5).map((t) => { const i = info(t); return `<div class="line-item"><span class="tx-ico">${i.icon}</span><span class="info"><b>${esc(i.name)}</b><small>${esc([i.place, fmtDay(t.date), t.time].filter(Boolean).join(' · '))}</small></span><b class="num">${isIn(t) ? '+ ' : ''}${money(t.amount)}</b></div>`; }).join('')}</div>` : ''}
      <button class="btn primary" id="imGo" ${fresh.length ? '' : 'disabled'}>Übernehmen</button>
      ${db.settings.csvMap ? '<button class="btn" id="imRemap">Spalten neu zuordnen</button>' : ''}`,
    mount(b) {
      const rm = $('#imRemap', b); if (rm) rm.onclick = () => { db.settings.csvMap = null; save(); pendingImport.res = parseCsv(pendingImport.text); showView(viewMapping); };
      $('#imGo', b).onclick = () => {
        db.settings.withAtm = $('#imAtm', b).checked; db.settings.withOther = $('#imOther', b).checked; db.settings.withIn = $('#imIn', b).checked;
        const take = fresh.filter((t) => t.kind === 'card' || (t.kind === 'atm' && db.settings.withAtm) || (t.kind === 'other' && db.settings.withOther) || (t.kind === 'in' && db.settings.withIn));
        take.forEach((t) => { db.tx[t.id] = t; });
        save(); closeSheet(); tab = 'todo'; render();
        const ni = take.filter(isIn).length;
        toast(`${take.length - ni} Ausgaben${ni ? ` und ${ni} Einnahmen` : ''} übernommen`);
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
const similar = (a, b) => { const A = merchantKey(a).split(' ').filter((w) => w.length >= 4 && w !== 'unbekannt'); const B = ` ${merchantKey(b)} `; return A.some((w) => B.includes(w)); };
async function lookupOne(tx) {
  const key = tx.mkey; const q = `${tx.merchant}${tx.place ? ` ${tx.place}` : ''}`;
  let res = null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=at&accept-language=de&addressdetails=1&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
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
    const todo = Object.values(db.tx).filter((t) => t.src === 'elba' && !isIn(t) && t.mkey && t.mkey.length >= 3 && t.mkey !== 'unbekannt' && !db.lookups[t.mkey] && t.kind !== 'atm' && !brandOf(t.merchant) && !seen.has(t.mkey) && seen.add(t.mkey));
    for (const t of todo.slice(0, 40)) { await lookupOne(t); render(true); await sleep(1100); } // OpenStreetMap: max. 1 Anfrage pro Sekunde
  } finally { searching = false; }
}
const googleUrl = (tx) => `https://www.google.com/search?q=${encodeURIComponent((tx.purpose && tx.kind !== 'other' ? tx.purpose.replace(/^\w{2,10}\s?\*\s?/, '') : `${tx.merchant} ${tx.place || ''}`).replace(/\s+/g, ' ').trim())}`;

// ---------- Zuordnen ----------
function assign(tx, target, remember = true) {
  if (isIn(tx)) { if (target === 'ignore') { decideIn(tx, '', false); tx.ignored = true; save(); } return; }
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
  if (isIn(tx)) {
    const ri = tx.mkey ? db.rules[`in:${tx.mkey}`] : null;
    if (!ri) return null;
    return ri === 'normal' ? { label: 'Normale Einnahme', inTarget: '' } : person(ri) ? { label: `Rückzahlung von ${pname(ri)}`, inTarget: ri } : null;
  }
  const r = tx.mkey ? db.rules[tx.mkey] : null;
  if (!r) return null;
  if (typeof r === 'string') return r === 'ignore' ? { label: 'Ignorieren', target: 'ignore' } : r.startsWith('g:') ? { label: (db.groups.find((g) => g.id === r.slice(2)) || {}).name, target: r } : person(r) ? { label: pname(r), target: r } : null;
  if (r.split) return { label: r.split.map(([p, f]) => `${pname(p)} ${Math.round(f * 100)} %`).join(' / '), split: r.split };
  return null;
}
function applySuggestion(tx) {
  const s = suggestion(tx); if (!s) return;
  if (s.inTarget !== undefined) { decideIn(tx, s.inTarget, false); return; }
  if (s.split) {
    const parts = s.split.map(([p, f]) => ({ p, amt: r2(tx.amount * f) }));
    const diff = r2(tx.amount - parts.reduce((x, y) => x + y.amt, 0)); if (parts.length) parts[parts.length - 1].amt = r2(parts[parts.length - 1].amt + diff);
    applySplit(tx, parts, false);
  } else assign(tx, s.target, false);
}
const openIn = (t) => isIn(t) && !t.ignored && !t.payFrom && !t.inDone;
const unassigned = () => Object.values(db.tx).filter((t) => (isIn(t) ? openIn(t) : !t.ignored && !(t.alloc && t.alloc.length))).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));

// ---------- Rechnen ----------
let period = { mode: 'month', ym: today().slice(0, 7), y: today().slice(0, 4) };
const inPeriod = (d) => (period.mode === 'all' ? true : period.mode === 'year' ? d.startsWith(period.y) : d.startsWith(period.ym));
const periodLabel = () => (period.mode === 'all' ? 'Gesamter Zeitraum' : period.mode === 'year' ? `Jahr ${period.y}` : parseDay(`${period.ym}-01`).toLocaleDateString('de-AT', { month: 'long', year: 'numeric' }));
function shift(dir) {
  if (period.mode === 'year') period.y = String(+period.y + dir);
  if (period.mode === 'month') { const d = parseDay(`${period.ym}-01`); d.setMonth(d.getMonth() + dir); period.ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
}
// Rückzahlungen mit Ausgaben verrechnen:
// 1) gleicher Betrag -> diese Ausgabe, 2) sonst Ausgaben im selben Monat, 3) dann die ältesten, Rest = Guthaben.
// Von Hand abgehakte Ausgaben gelten als erledigt und brauchen keine Zahlung.
function settle(pid) {
  if (settleCache[pid]) return settleCache[pid];
  const items = [];
  Object.values(db.tx).forEach((t) => { if (t.ignored) return; (t.alloc || []).forEach((a, i) => { if (a.p === pid) items.push({ key: `${t.id}|${i}`, t, a, i, date: t.date, amt: a.amt, left: a.paid ? 0 : a.amt, manual: !!a.paid, by: [] }); }); });
  items.sort((x, y) => (x.date + (x.t.time || '')).localeCompare(y.date + (y.t.time || '')));
  const pays = db.payments.filter((x) => x.p === pid).map((x) => ({ ...x, left: x.amt })).sort((x, y) => x.date.localeCompare(y.date));
  const take = (it, py, amt) => { it.left = r2(it.left - amt); py.left = r2(py.left - amt); it.by.push({ date: py.date, amt: r2(amt), note: py.note }); };
  pays.forEach((py) => { // 1) gleicher Betrag
    const cands = items.filter((it) => it.left > 0 && it.left === it.amt && Math.abs(it.amt - py.amt) < 0.005);
    if (!cands.length) return;
    const before = cands.filter((it) => it.date <= py.date);
    const it = before.length ? before[before.length - 1] : cands[0];
    take(it, py, py.left);
  });
  pays.forEach((py) => { // 2) selber Monat, 3) älteste zuerst
    if (py.left <= 0) return;
    const m = py.date.slice(0, 7);
    const order = [...items.filter((it) => it.date.startsWith(m)), ...items.filter((it) => !it.date.startsWith(m))];
    for (const it of order) { if (py.left <= 0) break; if (it.left > 0) take(it, py, Math.min(it.left, py.left)); }
  });
  const map = {}; items.forEach((it) => { it.state = it.manual ? 'manual' : it.left <= 0 ? 'paid' : it.left < it.amt ? 'part' : 'open'; map[it.key] = it; });
  const res = { map, items, open: r2(items.reduce((x, it) => x + it.left, 0)), credit: r2(pays.reduce((x, py) => x + Math.max(0, py.left), 0)), got: r2(pays.reduce((x, py) => x + py.amt, 0)), manual: r2(items.filter((it) => it.manual).reduce((x, it) => x + it.amt, 0)) };
  settleCache[pid] = res;
  return res;
}
const stateOf = (t, i, a) => (settle(a.p).map[`${t.id}|${i}`] || { state: 'open', left: a.amt, by: [] });
function stateText(st, isMe) {
  if (isMe) return 'eigene Ausgabe';
  if (st.state === 'manual') return 'von Hand abgehakt';
  if (st.state === 'paid') return `bezahlt ${st.by.map((b) => fmtDay(b.date, { day: '2-digit', month: '2-digit' })).filter((v, k, arr) => arr.indexOf(v) === k).join(', ')}`;
  if (st.state === 'part') return `teilweise bezahlt · noch ${money(st.left)} offen`;
  return 'noch offen';
}
const checkHtml = (st, attr) => `<button class="check ${st.state === 'paid' ? 'on' : st.state === 'manual' ? 'on manual' : st.state === 'part' ? 'part' : ''}" ${attr} aria-label="von Hand abhaken">${st.state === 'paid' || st.state === 'manual' ? '✓' : st.state === 'part' ? '◐' : ''}</button>`;
function personStats(pid, onlyPeriod = true) {
  const se = settle(pid);
  let spent = 0; const items = [];
  se.items.forEach((it) => { if (!onlyPeriod || inPeriod(it.date)) { spent += it.amt; items.push({ t: it.t, a: it.a, i: it.i, st: it }); } });
  const isMe = person(pid) && person(pid).me;
  return { spent: r2(spent), open: isMe ? 0 : se.open, credit: isMe ? 0 : se.credit, paid: isMe ? 0 : se.got, manual: se.manual,
    items: items.sort((x, y) => (y.t.date + (y.t.time || '')).localeCompare(x.t.date + (x.t.time || ''))), payments: db.payments.filter((x) => x.p === pid) };
}

// ---------- Ansichten ----------
let tab = 'todo';
let selMode = false; const selected = new Set();
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
  const sel = mode === 'all' && selMode && !isIn(t);
  const chips = mode === 'todo' && isIn(t) ? `<div class="hint" style="margin:8px 0 0">Wer hat dir das gezahlt?</div><div class="chips" style="margin-top:6px">
      ${sug ? `<button class="chip sugg" data-sug="${esc(t.id)}">Vorschlag: ${esc(sug.label)} ✓</button>` : ''}
      ${others().map((p) => `<button class="chip" data-pfq="${esc(t.id)}|${esc(p.id)}"><span class="pdot" style="background:${p.color}"></span>↩ ${esc(p.name)}</button>`).join('')}
      <button class="chip" data-pfq="${esc(t.id)}|">💰 Normale Einnahme</button>
      <button class="chip ghost" data-as="${esc(t.id)}|ignore">Ignorieren</button></div>`
    : mode === 'todo' ? `<div class="chips">
      ${sug ? `<button class="chip sugg" data-sug="${esc(t.id)}">Vorschlag: ${esc(sug.label)} ✓</button>` : ''}
      ${db.persons.map((p) => `<button class="chip" data-as="${esc(t.id)}|${esc(p.id)}"><span class="pdot" style="background:${p.color}"></span>${esc(p.name)}</button>`).join('')}
      ${db.groups.map((g) => `<button class="chip" data-as="${esc(t.id)}|g:${esc(g.id)}">👥 ${esc(g.name)}</button>`).join('')}
      <button class="chip ghost" data-split="${esc(t.id)}">✂️ Aufteilen</button>
      <button class="chip ghost" data-as="${esc(t.id)}|ignore">Ignorieren</button></div>`
    : isIn(t) ? (t.payFrom ? `<div class="alloc"><span class="tag" style="color:var(--ok)">↩ Rückzahlung von ${esc(pname(t.payFrom))}</span></div>` : t.ignored ? '<div class="alloc"><span class="tag">ignoriert</span></div>' : '')
    : (t.alloc && t.alloc.length ? `<div class="alloc">${t.alloc.map((a, k) => `<span class="tag ${['paid', 'manual'].includes(stateOf(t, k, a).state) && !(person(a.p) || {}).me ? 'paid' : ''}"><span class="pdot" style="width:8px;height:8px;border-radius:50%;background:${pcolor(a.p)}"></span>${esc(pname(a.p))}${t.alloc.length > 1 ? ` ${money(a.amt)}` : ''}</span>`).join('')}</div>` : t.ignored ? '<div class="alloc"><span class="tag">ignoriert</span></div>' : '<div class="alloc"><span class="tag" style="color:var(--bad)">nicht zugeordnet</span></div>');
  return `<div class="tx ${sel && selected.has(t.id) ? 'picked' : ''}">
    <button class="tx-head" ${sel ? `data-pick="${esc(t.id)}"` : `data-open="${esc(t.id)}"`}>
      ${sel ? `<span class="check ${selected.has(t.id) ? 'on' : ''}" style="margin:6px 6px 0 0">${selected.has(t.id) ? '✓' : ''}</span>` : `<span class="tx-ico" title="${esc(i.catLabel)}">${i.icon}</span>`}
      <span class="tx-main"><span class="tx-name">${esc(i.name)}</span><span class="tx-meta">${esc(meta)}</span>
        ${t.purpose ? `<span class="tx-purpose">${esc(t.purpose)}</span>` : ''}
        ${i.found ? `<span class="found">🔎 ${esc([i.catLabel !== 'Sonstiges' ? i.catLabel : '', i.found.desc || '', `laut ${i.found.src}`].filter(Boolean).join(' · '))}</span>` : ''}</span>
      <span class="tx-amt num ${isIn(t) ? 'in' : ''}">${isIn(t) ? '+ ' : ''}${money(t.amount)}</span>
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
    ${list.length ? `<p class="hint" style="margin-top:0">${(() => { const ni = list.filter(isIn).length; const no = list.length - ni; return [no ? `${no} Ausgabe${no === 1 ? '' : 'n'}` : '', ni ? `${ni} Einnahme${ni === 1 ? '' : 'n'}` : ''].filter(Boolean).join(' und '); })()} noch zuordnen. Tipp auf eine Person – oder auf den <b>Vorschlag</b>.</p>
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
      <div class="stat"><b class="num">${unassigned().length}</b><small>noch zuordnen</small></div></div>
    <div class="people">${list.map(({ p, s }) => `<button class="pcard" data-person="${esc(p.id)}" style="--pc:${p.color}">
      <b>${esc(p.name)}</b><span class="big num">${money(s.spent)}</span><small>${s.items.length} Ausgabe${s.items.length === 1 ? '' : 'n'}</small>
      ${!p.me && s.paid ? `<small>schon gezahlt ${money(s.paid)}</small>` : ''}${p.me ? '<small>deine eigenen Ausgaben</small>' : `<span class="open ${s.open ? '' : 'zero'}">${s.open ? `offen ${money(s.open)}` : s.credit ? `Guthaben ${money(s.credit)}` : 'alles bezahlt ✓'}</span>`}</button>`).join('')}</div>
    <p class="hint">„Offen“ zählt über alle Monate – was abgehakt oder als Zahlung eingetragen ist, ist erledigt.</p>`;
}
function allHtml() {
  const q = query.trim().toLowerCase();
  let list = Object.values(db.tx).filter((t) => inPeriod(t.date));
  if (filterP === 'in') list = list.filter((t) => isIn(t) && !t.ignored);
  else if (filterP === 'out') list = list.filter((t) => !isIn(t) && !t.ignored);
  else if (filterP === 'none') list = list.filter((t) => !isIn(t) && !t.ignored && !(t.alloc || []).length);
  else if (filterP === 'ignored') list = list.filter((t) => t.ignored);
  else if (filterP !== 'all') list = list.filter((t) => (t.alloc || []).some((a) => a.p === filterP));
  if (q) list = list.filter((t) => { const i = info(t); return `${i.name} ${i.place} ${t.purpose || ''} ${t.raw} ${t.note || ''} ${i.catLabel}`.toLowerCase().includes(q); });
  list.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const byPerson = !!person(filterP);
  const amtOf = (t) => (byPerson ? (t.alloc || []).filter((a) => a.p === filterP).reduce((s, a) => s + a.amt, 0) : isIn(t) ? 0 : t.amount);
  const inOf = (t) => (!byPerson && isIn(t) && !t.ignored ? t.amount : 0);
  const sum = list.reduce((s, t) => s + (t.ignored && !byPerson ? 0 : amtOf(t)), 0);
  const sumIn = list.reduce((s, t) => s + inOf(t), 0);
  const nOut = list.filter((t) => !isIn(t)).length; const nIn = list.length - nOut;
  const daySum = (ts) => { const o = ts.reduce((s, t) => s + (t.ignored && !byPerson ? 0 : amtOf(t)), 0); const i = ts.reduce((s, t) => s + inOf(t), 0); return [o ? `− ${money(o)}` : '', i ? `<span style="color:var(--ok)">+ ${money(i)}</span>` : ''].filter(Boolean).join(' · '); };
  const days = {}; list.forEach((t) => { (days[t.date] = days[t.date] || []).push(t); });
  return `${periodHtml()}
    <div class="chips" style="margin:0 0 10px">${[['all', 'Alle'], ['out', 'Ausgaben'], ['in', 'Einnahmen'], ...db.persons.map((p) => [p.id, p.name]), ['none', 'Nicht zugeordnet'], ['ignored', 'Ignoriert']].map(([k, l]) => `<button class="chip ${filterP === k ? 'on' : ''}" data-fp="${esc(k)}">${esc(l)}</button>`).join('')}</div>
    ${selMode ? `<div class="row" style="margin-bottom:10px"><button class="btn small" data-act="selAll">Alle ${list.filter((t) => !isIn(t)).length} auswählen</button><button class="btn small" data-act="selNone">Keine</button><button class="btn small primary" data-act="selDone">Fertig</button></div>
      <p class="hint" style="margin-top:0">Tipp die Ausgaben an, die du umbuchen willst.</p>`
      : '<button class="btn" data-act="selOn" style="margin-top:0">☑️ Mehrere auswählen & umbuchen</button>'}
    <input class="input" id="q" type="search" placeholder="Suchen … z. B. Lagerhaus, Saalfelden, Tankstelle" value="${esc(query)}">
    <div class="note-box" style="margin-top:10px">${nOut ? `${nOut} Ausgabe${nOut === 1 ? '' : 'n'} · <b>${money(sum)}</b>${byPerson ? ` für ${esc(pname(filterP))}` : ''}` : ''}${nOut && nIn ? '<br>' : ''}${nIn ? `${nIn} Einnahme${nIn === 1 ? '' : 'n'} · <b style="color:var(--ok)">+ ${money(sumIn)}</b>` : ''}${!list.length ? 'Nichts gefunden' : ''}</div>
    ${Object.entries(days).map(([d, ts]) => `<div class="day-head"><span>${esc(fmtDay(d, { weekday: 'long', day: 'numeric', month: 'long' }))}</span><span class="num">${daySum(ts)}</span></div>${ts.map((t) => txCard(t, 'all')).join('')}`).join('') || '<div class="empty">Keine Einträge in diesem Zeitraum.</div>'}
    ${list.length && !selMode ? '<button class="btn" data-act="csv">📊 Diese Liste als Excel-Tabelle</button>' : ''}
    ${selMode && selected.size ? `<div class="actionbar"><span><b>${selected.size}</b> ausgewählt<br><small class="num">${money([...selected].reduce((x, id) => x + ((db.tx[id] || {}).amount || 0), 0))}</small></span><button class="btn primary small" data-act="selAssign">Zuordnen an …</button></div>` : ''}`;
}
function statsHtml() {
  const every = Object.values(db.tx).filter((t) => inPeriod(t.date) && !t.ignored);
  const list = every.filter((t) => !isIn(t)); const ins = every.filter(isIn);
  const totIn = ins.reduce((s, t) => s + t.amount, 0);
  const bySrc = {}; ins.forEach((t) => { const n = t.payFrom ? `↩ ${pname(t.payFrom)}` : info(t).name; bySrc[n] = (bySrc[n] || 0) + t.amount; });
  const byCat = {}; list.forEach((t) => { const c = info(t).cat; byCat[c] = (byCat[c] || 0) + t.amount; });
  const byShop = {}; list.forEach((t) => { const n = info(t).name; byShop[n] = (byShop[n] || 0) + t.amount; });
  const tot = list.reduce((s, t) => s + t.amount, 0);
  const max = Math.max(...Object.values(byCat), 1);
  const bars = (obj, label) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;gap:8px;font-size:15px"><span>${label(k)}</span><b class="num">${money(v)}</b></div><div class="bar"><i style="width:${(v / max) * 100}%;background:var(--accent)"></i></div></div>`).join('');
  const people = db.persons.map((p) => ({ p, v: personStats(p.id).spent })).filter((x) => x.v);
  const pmax = Math.max(...people.map((x) => x.v), 1);
  return `${periodHtml()}
    <div class="stats"><div class="stat ok"><b class="num">${money(totIn)}</b><small>Einnahmen</small></div><div class="stat"><b class="num">${money(tot)}</b><small>Ausgaben (${list.length})</small></div><div class="stat ${totIn - tot < 0 ? 'bad' : 'ok'}"><b class="num">${totIn - tot < 0 ? '− ' : '+ '}${money(Math.abs(totIn - tot))}</b><small>Differenz</small></div></div>
    ${ins.length ? `<div class="card"><h2>💰 Woher (Einnahmen)</h2>${(() => { const m3 = Math.max(...Object.values(bySrc), 1); return Object.entries(bySrc).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;gap:8px;font-size:15px"><span>${esc(k)}</span><b class="num" style="color:var(--ok)">+ ${money(v)}</b></div><div class="bar"><i style="width:${(v / m3) * 100}%;background:var(--ok)"></i></div></div>`).join(''); })()}</div>` : ''}
    ${people.length ? `<div class="card"><h2>Für wen</h2>${people.sort((a, b) => b.v - a.v).map(({ p, v }) => `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;font-size:15px"><span>${esc(p.name)}</span><b class="num">${money(v)}</b></div><div class="bar"><i style="width:${(v / pmax) * 100}%;background:${p.color}"></i></div></div>`).join('')}</div>` : ''}
    ${list.length ? `<div class="card"><h2>Wofür (Ausgaben)</h2>${bars(byCat, (k) => `${(CATS[k] || CATS.sonstiges)[0]} ${(CATS[k] || CATS.sonstiges)[1]}`)}</div>
      <div class="card"><h2>Wo am meisten</h2>${(() => { const m2 = Math.max(...Object.values(byShop), 1); return Object.entries(byShop).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;gap:8px;font-size:15px"><span>${esc(k)}</span><b class="num">${money(v)}</b></div><div class="bar"><i style="width:${(v / m2) * 100}%;background:var(--warn)"></i></div></div>`).join(''); })()}</div>` : '<div class="empty">Noch keine Ausgaben in diesem Zeitraum.</div>'}`;
}
function render(soft) {
  const v = $('#view');
  if (soft && document.activeElement && document.activeElement.id === 'q') return;
  $$('.tab').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab));
  const n = unassigned().length;
  $('#todoCount').hidden = !n; $('#todoCount').textContent = n > 99 ? '99+' : n;
  { const all = Object.values(db.tx); const ni = all.filter(isIn).length; $('#sub').textContent = all.length ? `${all.length - ni} Ausgaben${ni ? ` · ${ni} Einnahmen` : ''} · nur auf diesem Gerät` : 'Kartenausgaben zuordnen'; }
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
  $$('[data-pfq]', v).forEach((b) => (b.onclick = () => { const [id, pid] = b.dataset.pfq.split('|'); decideIn(db.tx[id], pid); toast(pid ? `Rückzahlung von ${pname(pid)}` : 'Normale Einnahme'); render(true); }));
  $$('[data-pick]', v).forEach((b) => (b.onclick = () => { const id = b.dataset.pick; if (selected.has(id)) selected.delete(id); else selected.add(id); render(true); }));
  $$('[data-act="selOn"]', v).forEach((b) => (b.onclick = () => { selMode = true; selected.clear(); render(true); }));
  $$('[data-act="selDone"]', v).forEach((b) => (b.onclick = () => { selMode = false; selected.clear(); render(true); }));
  $$('[data-act="selNone"]', v).forEach((b) => (b.onclick = () => { selected.clear(); render(true); }));
  $$('[data-act="selAll"]', v).forEach((b) => (b.onclick = () => { $$('[data-pick]', v).forEach((x) => selected.add(x.dataset.pick)); render(true); }));
  $$('[data-act="selAssign"]', v).forEach((b) => (b.onclick = () => openSheet(viewBulk)));
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

// Einnahme: anzeigen und optional als Rückzahlung einer Person werten
function decideIn(t, pid, remember = true) {
  db.payments = db.payments.filter((x) => x.txId !== t.id);
  t.payFrom = pid || null; t.inDone = true;
  if (pid) db.payments.push({ id: `tx-${t.id}`, txId: t.id, p: pid, amt: t.amount, date: t.date, note: `Überweisung: ${info(t).name}` });
  if (remember && t.mkey) db.rules[`in:${t.mkey}`] = pid || 'normal';
  save();
}
function reopenIn(t) { db.payments = db.payments.filter((x) => x.txId !== t.id); t.payFrom = null; t.inDone = false; t.ignored = false; save(); }
function incomeView(t) {
  const i = info(t);
  const rows = [['Von', i.name], t.purpose ? ['Verwendungszweck', t.purpose] : null, ['Wann', `${fmtDay(t.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${t.time ? `, ${t.time} Uhr` : ''}`], ['Betrag', `+ ${money(t.amount)}`]].filter(Boolean);
  const sugg = !t.payFrom && t.mkey && db.rules[`in:${t.mkey}`];
  return {
    title: `💰 ${i.name}`,
    html: `<div class="card"><dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        ${t.raw ? `<div class="section-title" style="margin-top:12px">Text von der Bank</div><div class="raw">${esc(t.raw)}</div>` : ''}</div>
      <div class="section-title">Ist das eine Rückzahlung?</div>
      <p class="hint" style="margin-top:0">Wenn dir jemand Geld zurücküberwiesen hat, tipp auf die Person – dann wird es bei ihr vom offenen Betrag abgezogen.</p>
      <div class="chips">${others().map((p) => `<button class="chip ${t.payFrom === p.id ? 'on' : ''} ${sugg === p.id ? 'sugg' : ''}" data-pf="${esc(p.id)}"><span class="pdot" style="background:${p.color}"></span>${esc(p.name)}</button>`).join('')}
        <button class="chip ${t.inDone && !t.payFrom ? 'on' : 'ghost'}" data-pf="">💰 Nein, normale Einnahme</button></div>
      <label class="field" style="margin-top:14px"><span>Notiz</span><input class="input" id="tNote" value="${esc(t.note || '')}"></label>
      ${t.inDone && !t.ignored ? '<button class="btn" id="tReopen">↺ Wieder zu „Zuordnen“</button>' : ''}
      <button class="btn" id="tIgnore">${t.ignored ? '↩️ Nicht mehr ignorieren' : '🚫 Ignorieren (zählt nirgends mit)'}</button>`,
    mount(b) {
      $$('[data-pf]', b).forEach((x) => (x.onclick = () => { decideIn(t, x.dataset.pf); toast(x.dataset.pf ? `Als Rückzahlung von ${pname(x.dataset.pf)} eingetragen` : 'Gespeichert'); showView(viewTx(t.id)); }));
      $('#tNote', b).onchange = (e) => { t.note = e.target.value.trim(); save(); };
      $('#tIgnore', b).onclick = () => { if (t.ignored) reopenIn(t); else { decideIn(t, '', false); t.ignored = true; save(); } showView(viewTx(t.id)); };
      const ro = $('#tReopen', b); if (ro) ro.onclick = () => { reopenIn(t); toast('Wieder bei „Zuordnen“'); showView(viewTx(t.id)); };
    },
  };
}
// Mehrere Ausgaben auf einmal umbuchen
function viewBulk() {
  const ids = [...selected].filter((id) => db.tx[id]);
  return {
    title: `${ids.length} Ausgabe${ids.length === 1 ? '' : 'n'} umbuchen`,
    html: `<p class="hint" style="margin-top:0">Zusammen ${money(ids.reduce((x, id) => x + db.tx[id].amount, 0))}. Wem sollen sie gehören?</p>
      <div class="chips">${db.persons.map((p) => `<button class="chip" data-bulk="${esc(p.id)}"><span class="pdot" style="background:${p.color}"></span>${esc(p.name)}</button>`).join('')}${db.groups.map((g) => `<button class="chip" data-bulk="g:${esc(g.id)}">👥 ${esc(g.name)}</button>`).join('')}</div>
      <button class="btn" data-bulk="reset" style="margin-top:16px">↺ Zurück zu „Zuordnen“ (Zuordnung löschen)</button>
      <button class="btn" data-bulk="ignore">🚫 Ignorieren</button>
      <p class="hint">Der Haken „bezahlt“ wird dabei zurückgesetzt.</p>`,
    mount(b) {
      $$('[data-bulk]', b).forEach((x) => (x.onclick = () => {
        const target = x.dataset.bulk;
        ids.forEach((id) => { const t = db.tx[id]; if (target === 'reset') { t.alloc = []; t.ignored = false; } else assign(t, target, false); });
        save(); selected.clear(); selMode = false; closeSheet();
        toast(target === 'reset' ? `${ids.length} wieder bei „Zuordnen“` : target === 'ignore' ? `${ids.length} ignoriert` : `${ids.length} → ${target.startsWith('g:') ? (db.groups.find((g) => g.id === target.slice(2)) || {}).name : pname(target)}`);
      }));
    },
  };
}
// Detail einer Ausgabe
function viewTx(id) {
  return () => {
    const t = db.tx[id]; if (!t) return null;
    if (isIn(t)) return incomeView(t);
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
        ${(t.alloc || []).length ? `<div class="list">${t.alloc.map((a, k) => { const st = stateOf(t, k, a); const me = person(a.p) && person(a.p).me; return `<div class="line-item">${me ? '<span class="check"></span>' : checkHtml(st, `data-paid="${k}"`)}<span class="info"><b>${esc(pname(a.p))}</b><small>${esc(stateText(st, me))}</small></span><b class="num">${money(a.amt)}</b></div>`; }).join('')}</div>` : `<div class="${t.ignored ? 'note-box' : 'warn-box'}">${t.ignored ? 'Diese Ausgabe wird ignoriert (zählt nirgends mit).' : 'Noch niemandem zugeordnet.'}</div>`}
        <div class="chips">${db.persons.map((p) => `<button class="chip" data-to="${esc(p.id)}"><span class="pdot" style="background:${p.color}"></span>${esc(p.name)}</button>`).join('')}${db.groups.map((g) => `<button class="chip" data-to="g:${esc(g.id)}">👥 ${esc(g.name)}</button>`).join('')}<button class="chip ghost" id="tSplit">✂️ Aufteilen</button></div>
        <label class="field" style="margin-top:14px"><span>Notiz</span><input class="input" id="tNote" value="${esc(t.note || '')}" placeholder="z. B. Geburtstagsgeschenk, Hälfte vom Tanken"></label>
        ${t.src !== 'elba' ? '<button class="btn" id="tEdit">✏️ Betrag / Datum bearbeiten</button>' : ''}
        <button class="btn" id="tIgnore">${t.ignored ? '↩️ Nicht mehr ignorieren' : '🚫 Ignorieren (zählt nirgends mit)'}</button>
        <button class="btn danger" id="tDel">🗑️ Löschen</button>`,
      mount(b) {
        $$('[data-to]', b).forEach((x) => (x.onclick = () => { assign(t, x.dataset.to); toast('Gespeichert'); showView(viewTx(id)); }));
        $$('[data-paid]', b).forEach((x) => (x.onclick = () => { const a = t.alloc[+x.dataset.paid]; a.paid = !a.paid; save(); toast(a.paid ? 'Von Hand abgehakt' : 'Haken entfernt'); showView(viewTx(id)); }));
        $('#tSplit', b).onclick = () => pushView(viewSplit(id));
        $('#tName', b).onclick = () => pushView(viewRename(id));
        $('#tNote', b).onchange = (e) => { t.note = e.target.value.trim(); save(); };
        const ed = $('#tEdit', b); if (ed) ed.onclick = () => pushView(viewManual(id));
        $('#tIgnore', b).onclick = () => { if (t.ignored) t.ignored = false; else { t.ignored = true; t.alloc = []; } save(); showView(viewTx(id)); };
        $('#tDel', b).onclick = () => {
          if (!confirm(t.src === 'elba' ? 'Löschen? Beim nächsten Einlesen derselben Datei kommt die Ausgabe wieder. Besser: „Ignorieren“.' : 'Diese Ausgabe löschen?')) return;
          delete db.tx[id]; db.payments = db.payments.filter((x) => x.txId !== id); save(); closeSheet(); toast('Gelöscht');
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
          : `<div class="stat ok"><b class="num">${money(s.paid)}</b><small>zurückbezahlt</small></div>${s.credit && !s.open ? `<div class="stat ok"><b class="num">${money(s.credit)}</b><small>Guthaben</small></div>` : `<div class="stat ${s.open ? 'bad' : 'ok'}"><b class="num">${money(s.open)}</b><small>noch offen</small></div>`}`}</div>
        ${p.me ? '' : `<p class="hint" style="margin-top:-4px">Zurückbezahlt und offen zählen immer über alle Monate.${s.manual ? ` ${money(s.manual)} sind von Hand abgehakt.` : ''}${s.credit && s.open ? ` Guthaben: ${money(s.credit)}.` : ''} Tipp auf den Kreis, um etwas von Hand abzuhaken (z. B. bar bezahlt oder geschenkt).</p>`}
        ${p.me ? '' : `<div class="row"><button class="btn primary" id="pPay">💶 Zahlung erhalten</button><button class="btn" id="pShare">📤 Liste schicken</button></div>
          <button class="btn" id="pBulk">☑️ Mehrere umbuchen (falsch zugeordnet?)</button>
`}
        <div class="section-title"><span>Ausgaben</span><span>${s.items.length}</span></div>
        ${s.items.length ? `<div class="list">${s.items.map(({ t, a, i, st }) => { const inf = info(t); return `<div class="line-item">
            ${p.me ? `<span class="tx-ico" style="width:32px;height:32px;font-size:16px">${inf.icon}</span>` : checkHtml(st, `data-pp="${esc(t.id)}|${i}"`)}
            <button class="info" data-open2="${esc(t.id)}"><b>${esc(inf.name)}</b><small>${esc([inf.place, `${fmtDay(t.date)}${t.time ? ` ${t.time}` : ''}`, t.alloc.length > 1 ? `Anteil von ${money(t.amount)}` : '', t.note].filter(Boolean).join(' · '))}${p.me ? '' : `<br><span class="st-${st.state}">${esc(stateText(st, false))}</span>`}</small></button>
            <b class="num">${money(a.amt)}</b></div>`; }).join('')}</div>` : '<div class="empty">Keine Ausgaben in diesem Zeitraum.</div>'}
        ${s.payments.length && !p.me ? `<div class="section-title">Schon gezahlt (Zahlungen)</div><div class="list">${s.payments.slice().sort((x, y) => y.date.localeCompare(x.date)).map((x) => `<div class="line-item"><span class="info"><b>${money(x.amt)}</b><small>${esc([fmtDay(x.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), x.note].filter(Boolean).join(' · '))}</small></span>${x.txId ? '<small class="muted">aus Kontoeingang</small>' : `<button class="icon-btn" data-pdel="${esc(x.id)}" aria-label="Zahlung löschen">🗑️</button>`}</div>`).join('')}</div>` : ''}
        <button class="btn" id="pCsv">📊 Als Excel-Tabelle</button>`,
      mount(b) {
        $$('[data-pp]', b).forEach((x) => (x.onclick = () => { const [tid, k] = x.dataset.pp.split('|'); const a = db.tx[tid].alloc[+k]; a.paid = !a.paid; save(); showView(viewPerson(pid)); }));
        $$('[data-open2]', b).forEach((x) => (x.onclick = () => pushView(viewTx(x.dataset.open2))));
        $$('[data-pdel]', b).forEach((x) => (x.onclick = () => { if (!confirm('Diese Zahlung löschen?')) return; db.payments = db.payments.filter((y) => y.id !== x.dataset.pdel); save(); showView(viewPerson(pid)); }));
        const pay = $('#pPay', b); if (pay) pay.onclick = () => pushView(viewPayment(pid));
        const sh = $('#pShare', b); if (sh) sh.onclick = () => shareList(pid);
        const bu = $('#pBulk', b); if (bu) bu.onclick = () => { closeSheet(); tab = 'all'; filterP = pid; selMode = true; selected.clear(); render(); window.scrollTo(0, 0); };
        $('#pCsv', b).onclick = () => exportCsv(pid);
      },
    };
  };
}
function viewPayment(pid) {
  return () => ({
    title: `Zahlung von ${pname(pid)}`,
    html: `<p class="hint" style="margin-top:0">Noch offen: <b>${money(personStats(pid).open)}</b>. Die Zahlung wird automatisch verrechnet: zuerst mit einer Ausgabe mit gleichem Betrag, sonst mit dem selben Monat, dann mit den ältesten. Was übrig bleibt, wird Guthaben.</p>
      <div class="grid2"><label class="field"><span>Betrag (€)</span><input class="input num" id="pyAmt" inputmode="decimal" value="${fmtIn(personStats(pid).open) || ''}"></label>
      <label class="field"><span>Datum</span><input class="input" id="pyDate" type="date" value="${today()}"></label></div>
      <label class="field"><span>Notiz</span><input class="input" id="pyNote" placeholder="z. B. bar, überwiesen"></label>
      <button class="btn primary" id="pySave">Speichern</button>`,
    mount(b) {
      $('#pySave', b).onclick = () => {
        const amt = num($('#pyAmt', b).value);
        if (!amt || amt <= 0) { toast('Bitte einen Betrag eingeben'); return; }
        db.payments.push({ id: uid(), p: pid, amt: r2(amt), date: $('#pyDate', b).value || today(), note: $('#pyNote', b).value.trim() || 'bar / von Hand' });
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
    const i = info(t);
    if (isIn(t)) { if (!only) rows.push([fmtDay(t.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), t.time || '', i.name, '', 'Einnahme', dec(t.amount), t.payFrom ? `Rückzahlung von ${pname(t.payFrom)}` : '', dec(t.amount), '', t.note || '', t.raw || '']); return; }
    const al = (t.alloc || []).length ? t.alloc : [{ p: null, amt: t.amount }];
    al.filter((a) => !only || a.p === only).forEach((a, k) => rows.push([fmtDay(t.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), t.time || '', i.name, i.place, i.catLabel, dec(t.amount), a.p ? pname(a.p) : 'nicht zugeordnet', dec(a.amt), a.p ? ({ paid: 'ja', manual: 'ja (von Hand)', part: `teilweise, offen ${dec(stateOf(t, k, a).left)}`, open: 'nein' }[stateOf(t, k, a).state]) : '', t.note || '', t.raw || '']));
  });
  saveFile(`ausgaben-${only ? pname(only).toLowerCase() : 'alle'}-${period.mode === 'month' ? period.ym : period.mode === 'year' ? period.y : 'gesamt'}.csv`, 'text/csv', csvText(rows));
}
async function shareList(pid) {
  const s = personStats(pid);
  const open = s.items.filter((x) => x.st.left > 0);
  const lines = open.map(({ t, st }) => { const i = info(t); return `• ${fmtDay(t.date, { day: '2-digit', month: '2-digit' })}${t.time ? ` ${t.time}` : ''} ${i.name}${i.place ? `, ${i.place}` : ''}: ${money(st.left)}${st.state === 'part' ? ` (Rest von ${money(st.amt)})` : ''}`; });
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
$$('.tab').forEach((b) => (b.onclick = () => { if (tab !== b.dataset.tab) { selMode = false; selected.clear(); } tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
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
resetTicksOnce();
render();
lookupQueue();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
// für Tests
window.__ausgaben = { parseShop, parseText, parseCsv, detectColumns, buildTx };
})();
