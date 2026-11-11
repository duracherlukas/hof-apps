/* Gäste-Verwaltung: Bestellungen, Bäckerei-Liste, Abrechnung, Gästemappe, Unterkünfte, Einstellungen */
(() => {
const { $, $$, esc, ICON, money, toast } = G;

let store = null;
let user = null;
let site = null;          // aktueller Stand aus der Datenbank
let units = [];
let orders = [];
let loaded = { site: false, units: false, orders: false };
let tab = 'orders';
let selDay = null;
let draft = null;         // Entwurf beim Bearbeiten von Gästemappe/Einstellungen
let seeded = false;

const S = () => G.mergeSite(site);
const cutoff = () => (Number.isFinite(+S().cutoffHour) ? +S().cutoffHour : 17);
const clone = (o) => JSON.parse(JSON.stringify(o));
const unitName = (id) => (units.find((u) => u.id === id) || {}).name;
const unitById = (id) => units.find((u) => u.id === id);
const propOfUnitId = (id) => G.propertyOf(S(), unitById(id));
const propIndex = (pid) => { const i = (S().properties || []).findIndex((p) => p.id === pid); return i < 0 ? 99 : i; };
let contentProp = 0;
const guestUrl = (id) => new URL(`index.html${id ? `?u=${encodeURIComponent(id)}` : ''}`, location.href).href;

const TABS = [
  ['orders', 'Brötchen', ICON.bread, 'Bestellungen'],
  ['booking', 'Belegung', ICON.cal, 'Belegung'],
  ['billing', 'Kasse', ICON.euro, 'Abrechnung'],
  ['content', 'Mappe', ICON.book, 'Gästemappe'],
  ['units', 'Häuser', ICON.home, 'Unterkünfte'],
  ['settings', 'Mehr', ICON.gear, 'Einstellungen'],
];

function onStoreError(e) {
  const c = String((e && e.code) || '');
  if (c.includes('permission')) toast('Kein Zugriff – ist deine E-Mail in den Firestore-Regeln eingetragen?');
  else toast('Fehler: ' + ((e && e.message) || c));
}

// ---------- Teilen / Kopieren ----------
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Kopiert'); }
  catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Kopiert'); } catch (e2) { toast('Kopieren nicht möglich'); }
    ta.remove();
  }
}
async function shareText(text) {
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  copyText(text);
}

// ---------- Bestellungen ----------
function dayOrders(day) { return orders.filter((o) => o.date === day); }
function sumItems(list, group) {
  const map = new Map();
  list.forEach((o) => (o.items || []).forEach((it) => {
    if (group && (it.group || 'baecker') !== group) return;
    const key = it.id || it.name;
    const cur = map.get(key) || { name: it.name, qty: 0, price: it.price, unit: it.unit || '' };
    cur.qty += it.qty; map.set(key, cur);
  }));
  const order = (S().products || []).map((p) => p.id);
  return [...map.entries()].sort((a, b) => {
    const ia = order.indexOf(a[0]); const ib = order.indexOf(b[0]);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  }).map(([, v]) => v);
}
function bakeryText(day, list) {
  const s = S();
  return `Bestellung für ${G.fmtDay(day)}:\n\n${list.map((it) => `${it.qty} × ${it.name}`).join('\n')}\n\nDanke!\n${s.hofName || ''}`.trim();
}

function ordersHtml() {
  const day = selDay || G.addDays(G.today(), 1);
  selDay = day;
  const dl = G.deadlineFor(day, cutoff());
  const now = G.now();
  const all = dayOrders(day);
  const active = all.filter((o) => o.status !== 'storniert');
  const cancelled = all.filter((o) => o.status === 'storniert');
  const bakery = sumItems(active, 'baecker');
  const hof = sumItems(active, 'hof');
  const total = active.reduce((s, o) => s + G.orderTotal(o), 0);
  let status;
  if (now < dl) status = `<div class="status collecting">${ICON.clock}<div><b>Gäste können noch bestellen</b>Bestellschluss ${esc(G.fmtDeadline(dl))} – noch ${G.countdown(dl - now)}</div></div>`;
  else if (day > G.today()) status = `<div class="status order-now">${ICON.bread}<div><b>Bestellschluss vorbei – jetzt beim Bäcker bestellen</b>Die Liste ist fix, Gäste können nichts mehr ändern.</div></div>`;
  else status = `<div class="status past">${ICON.check}<div><b>${day === G.today() ? 'Liefertag heute' : 'Vergangener Liefertag'}</b>${active.length} Bestellungen</div></div>`;
  const s = S();
  const wa = String(s.bakeryPhone || '').replace(/[^\d]/g, '');
  const tbl = (list) => `<table class="totals">${list.map((it) => `<tr><td class="q num">${it.qty}${it.unit === 'kg' ? ' kg' : '×'}</td><td>${esc(it.name)}</td></tr>`).join('')}</table>`;
  const meat = sumItems(active, 'fleisch');
  return `
    <div class="datenav">
      <button class="icon-btn" data-day="-1" aria-label="Vortag">${ICON.back}</button>
      <div class="d"><b>${esc(G.fmtDayRel(day))}</b><small>${active.length} ${active.length === 1 ? 'Bestellung' : 'Bestellungen'} · ${money(total)}</small></div>
      <button class="icon-btn" data-day="1" aria-label="Nächster Tag">${ICON.chevron}</button>
    </div>
    ${status}
    ${active.length ? `
      ${bakery.length ? `<div class="card"><h2>${ICON.bread} Für ${esc(s.bakeryName || 'die Bäckerei')}</h2>${tbl(bakery)}
        <div class="share-row">
          ${wa ? `<a class="btn primary" href="https://wa.me/${esc(wa)}?text=${encodeURIComponent(bakeryText(day, bakery))}" target="_blank" rel="noopener">${ICON.chat}WhatsApp</a>` : ''}
          <button class="btn" data-share>${ICON.share}Teilen</button>
          <button class="btn" data-copy>${ICON.copy}Kopieren</button>
        </div></div>` : ''}
      ${hof.length ? `<div class="card"><h2>${ICON.egg} Vom Hof herrichten</h2>${tbl(hof)}</div>` : ''}
      ${meat.length ? `<div class="card"><h2>${ICON.euro} Fleisch aus der Truhe herrichten</h2>${tbl(meat)}<p class="hint" style="margin:6px 0 0">Abgerechnet wird nach tatsächlichem Gewicht – Betrag beim Kassieren anpassen.</p></div>` : ''}
      <div class="section-title">Verteilliste</div>
      <div class="list">${active.sort((a, b) => propIndex(propOfUnitId(a.unitId).id) - propIndex(propOfUnitId(b.unitId).id) || (a.unitName || '').localeCompare(b.unitName || '', 'de') || String(a.spot).localeCompare(String(b.spot), 'de', { numeric: true }))
        .map((o) => `<div class="order"><label class="deliv">
          <input type="checkbox" data-deliv="${esc(o.id)}" ${o.status === 'geliefert' ? 'checked' : ''} aria-label="geliefert">
          <div class="info"><div class="head"><b>${esc(o.unitName || unitName(o.unitId) || '?')}${o.spot ? ` · Platz ${esc(o.spot)}` : ''}</b><span class="num">${money(G.orderTotal(o))}</span></div>
          <div class="items">${esc(G.orderItemsText(o))}</div>
          <small>${esc(propOfUnitId(o.unitId).name || '')} · ${esc(o.name)}${o.note ? ` · „${esc(o.note)}“` : ''}</small></div></label></div>`).join('')}</div>
      <p class="hint">Häkchen setzen, wenn geliefert – die Gäste sehen das in ihrer Gästemappe.</p>`
      : `<div class="card" style="text-align:center"><p class="muted" style="margin:8px 0">Noch keine Bestellungen für diesen Tag.</p></div>`}
    ${cancelled.length ? `<div class="section-title">Storniert</div><div class="list">${cancelled.map((o) => `<div class="order storniert">
      <div class="head"><b>${esc(o.unitName)}${o.spot ? ` · Platz ${esc(o.spot)}` : ''}</b><span class="badge storniert">storniert</span></div>
      <div class="items">${esc(G.orderItemsText(o))}</div><small>${esc(o.name)}</small></div>`).join('')}</div>` : ''}`;
}
function bindOrders(v) {
  $$('[data-day]', v).forEach((b) => (b.onclick = () => { selDay = G.addDays(selDay, +b.dataset.day); render(); }));
  const day = selDay;
  const bakery = sumItems(dayOrders(day).filter((o) => o.status !== 'storniert'), 'baecker');
  const sh = $('[data-share]', v); if (sh) sh.onclick = () => shareText(bakeryText(day, bakery));
  const cp = $('[data-copy]', v); if (cp) cp.onclick = () => copyText(bakeryText(day, bakery));
  $$('[data-deliv]', v).forEach((c) => (c.onchange = () => store.updateOrder(c.dataset.deliv, { status: c.checked ? 'geliefert' : 'offen' })));
}

// ---------- Abrechnung ----------
function billingHtml() {
  const open = orders.filter((o) => o.status !== 'storniert' && !o.paid);
  const byUnit = {};
  open.forEach((o) => { (byUnit[o.unitId] = byUnit[o.unitId] || []).push(o); });
  const groups = Object.entries(byUnit).sort((a, b) => (a[1][0].unitName || '').localeCompare(b[1][0].unitName || '', 'de'));
  const sum = open.reduce((s, o) => s + G.orderTotal(o), 0);
  return `
    <div class="card"><small class="muted">Noch offen (nicht bezahlt)</small><div style="font-size:30px;font-weight:750" class="num">${money(sum)}</div>
      <small class="muted">${open.length} Bestellungen in ${groups.length} Unterkünften</small></div>
    ${groups.length ? groups.map(([uid, list]) => {
      const t = list.reduce((s, o) => s + G.orderTotal(o), 0);
      return `<div class="card">
        <h2>${ICON.home} ${esc(unitName(uid) || list[0].unitName)} <span class="num" style="margin-left:auto">${money(t)}</span></h2>
        <div class="list" style="box-shadow:none;margin:8px -6px 12px">${list.sort((a, b) => a.date.localeCompare(b.date)).map((o) => `<div class="order">
          <div class="head"><b>${esc(G.fmtDay(o.date, { weekday: 'short', day: 'numeric', month: 'numeric' }))}${o.spot ? ` · Platz ${esc(o.spot)}` : ''}</b><span class="num">${money(G.orderTotal(o))}</span></div>
          <div class="items">${esc(G.orderItemsText(o))}</div><small>${esc(o.name)}</small></div>`).join('')}</div>
        <button class="btn primary" data-paid="${esc(uid)}">${ICON.check} Als bezahlt markieren</button>
      </div>`;
    }).join('') : '<div class="card" style="text-align:center"><p class="muted" style="margin:8px 0">Alles bezahlt – nichts offen.</p></div>'}
    <p class="hint">Tipp: Bei der Abreise einfach die Summe der Unterkunft kassieren und auf „bezahlt“ tippen.</p>
    ${monthHtml()}`;
}
// Monatsübersicht: Umsatz aus Brötchen-, Hof- und Fleischbestellungen pro Betrieb und Unterkunft
let billMonth = G.today().slice(0, 7);
const monthOrders = (ym) => orders.filter((o) => (o.date || '').startsWith(ym) && o.status !== 'storniert');
const groupSum = (o, g) => (o.items || []).filter((it) => (it.group || 'baecker') === g).reduce((s, it) => s + it.qty * it.price, 0);
function monthHtml() {
  const [y, m] = billMonth.split('-').map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('de-AT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const list = monthOrders(billMonth);
  const total = list.reduce((s, o) => s + G.orderTotal(o), 0);
  const props = S().properties || [];
  const blocks = props.map((p) => {
    const os = list.filter((o) => propOfUnitId(o.unitId).id === p.id);
    if (!os.length) return '';
    const byU = {};
    os.forEach((o) => { (byU[o.unitId] = byU[o.unitId] || []).push(o); });
    const sum = os.reduce((s, o) => s + G.orderTotal(o), 0);
    return `<div class="card"><h2>${ICON.home} ${esc(p.name)} <span class="num" style="margin-left:auto">${money(sum)}</span></h2>
      <table class="mtable"><thead><tr><th>Unterkunft</th><th>Best.</th><th>Bäcker</th><th>Hof</th><th>Fleisch</th><th>Summe</th></tr></thead><tbody>
      ${Object.entries(byU).sort((a, b) => (unitName(a[0]) || '').localeCompare(unitName(b[0]) || '', 'de')).map(([uid, uo]) => `<tr><td>${esc(unitName(uid) || uo[0].unitName || '?')}</td><td>${uo.length}</td>
        <td>${money(uo.reduce((s, o) => s + groupSum(o, 'baecker'), 0))}</td><td>${money(uo.reduce((s, o) => s + groupSum(o, 'hof'), 0))}</td><td>${money(uo.reduce((s, o) => s + groupSum(o, 'fleisch'), 0))}</td>
        <td><b>${money(uo.reduce((s, o) => s + G.orderTotal(o), 0))}</b></td></tr>`).join('')}</tbody></table></div>`;
  }).join('');
  return `<div class="section-title">Monatsübersicht</div>
    <div class="datenav">
      <button class="icon-btn" data-bm="-1" aria-label="Voriger Monat">${ICON.back}</button>
      <div class="d"><b>${esc(label)}</b><small>${list.length} Bestellungen · ${money(total)}</small></div>
      <button class="icon-btn" data-bm="1" aria-label="Nächster Monat">${ICON.chevron}</button>
    </div>
    ${blocks || '<div class="card" style="text-align:center"><p class="muted" style="margin:8px 0">Keine Bestellungen in diesem Monat.</p></div>'}
    ${list.length ? `<button class="btn" id="bmCsv">${ICON.down} ${esc(label)} als Tabelle (Excel)</button>` : ''}`;
}
function exportMonthCsv() {
  const cell = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const dec = (n) => (Math.round((n || 0) * 100) / 100).toFixed(2).replace('.', ',');
  const rows = [['Datum', 'Betrieb', 'Unterkunft', 'Platz', 'Name', 'Artikel', 'Bäcker (EUR)', 'Hof (EUR)', 'Fleisch (EUR)', 'Summe (EUR)', 'Status', 'Bezahlt']];
  monthOrders(billMonth).sort((a, b) => a.date.localeCompare(b.date)).forEach((o) => rows.push([G.fmtDay(o.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), propOfUnitId(o.unitId).name || '', unitName(o.unitId) || o.unitName || '',
    o.spot || '', o.name || '', G.orderItemsText(o), dec(groupSum(o, 'baecker')), dec(groupSum(o, 'hof')), dec(groupSum(o, 'fleisch')), dec(G.orderTotal(o)), o.status, o.paid ? 'ja' : 'nein']));
  const text = '\ufeff' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
  const blob = new Blob([text], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bestellungen-${billMonth}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function bindBilling(v) {
  $$('[data-bm]', v).forEach((b) => (b.onclick = () => {
    const [y, m] = billMonth.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + +b.dataset.bm, 1));
    billMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const yy = window.scrollY; render(); window.scrollTo(0, yy);
  }));
  const mc = $('#bmCsv', v); if (mc) mc.onclick = exportMonthCsv;
  $$('[data-paid]', v).forEach((b) => (b.onclick = () => {
    const list = orders.filter((o) => o.unitId === b.dataset.paid && o.status !== 'storniert' && !o.paid);
    if (!confirm(`${list.length} Bestellungen (${money(list.reduce((s, o) => s + G.orderTotal(o), 0))}) als bezahlt markieren?`)) return;
    list.forEach((o) => store.updateOrder(o.id, { paid: true, paidAt: Date.now() }));
    toast('Als bezahlt markiert');
  }));
}

// ---------- Belegung (Buchungskalender) ----------
let bookings = [];
let calMonth = G.today().slice(0, 7);
const SOURCES = ['Telefon', 'E-Mail', 'Webseite', 'Booking.com', 'Airbnb', 'Sonstiges'];
const BSTATUS = { fix: 'Fix gebucht', option: 'Option / Anfrage', storniert: 'Storniert' };
const activeBookings = (list = bookings) => list.filter((b) => b.status !== 'storniert');
const dayNum = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
const nightsOf = (b) => Math.max(0, dayNum(b.to) - dayNum(b.from));
const occupies = (b, day) => b.from <= day && day < b.to; // Abreisetag ist wieder frei
const overlaps = (a, b) => a.unitId === b.unitId && a.from < b.to && b.from < a.to;
const personsText = (b) => [b.adults ? `${b.adults} Erw.` : '', b.children ? `${b.children} Ki.` : '', b.dog ? 'Hund' : ''].filter(Boolean).join(', ');
const sortedUnits = () => [...units].sort((a, b) => propIndex(G.propertyOf(S(), a).id) - propIndex(G.propertyOf(S(), b).id) || a.name.localeCompare(b.name, 'de'));
const bookingOrders = (b) => orders.filter((o) => o.unitId === b.unitId && o.date > b.from && o.date <= b.to && o.status !== 'storniert');
const fmtShort = (day) => G.fmtDay(day, { weekday: 'short', day: 'numeric', month: 'numeric' });
const fmtLong = (day) => G.fmtDay(day, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
function withLang(l, fn) { const old = G.lang; G.lang = l || 'de'; try { return fn(); } finally { G.lang = old; } }

// Gästeseite bekommt nur Zeitraum + Sprache (keine Namen), damit sie z. B. am Abreisetag um eine Bewertung bitten kann
function syncStays(unitId, list = bookings) {
  const u = unitById(unitId);
  if (!u) return;
  const since = G.addDays(G.today(), -1);
  const stays = activeBookings(list).filter((b) => b.unitId === unitId && b.to >= since)
    .sort((a, b) => a.from.localeCompare(b.from)).slice(0, 8).map((b) => ({ from: b.from, to: b.to, lang: b.lang || 'de' }));
  if (JSON.stringify(stays) === JSON.stringify(u.stays || [])) return;
  const { id, ...rest } = u;
  store.saveUnit(unitId, { ...rest, stays });
}

function dayCard(day, label) {
  const act = activeBookings();
  const arr = act.filter((b) => b.from === day);
  const dep = act.filter((b) => b.to === day);
  const occ = act.filter((b) => occupies(b, day));
  const os = dayOrders(day).filter((o) => o.status !== 'storniert');
  const meat = sumItems(os, 'fleisch');
  const line = (b, icon) => `<button class="todo-row" data-bk="${esc(b.id)}"><span class="todo-ico">${icon}</span><span><b>${esc(unitName(b.unitId) || '?')}</b> – ${esc(b.name || '')}${personsText(b) ? ` <small>(${esc(personsText(b))})</small>` : ''}${b.status === 'option' ? ' <span class="badge">Option</span>' : ''}</span></button>`;
  return `<div class="card todo">
    <h2>${esc(label)} <small class="muted" style="font-weight:500">${esc(fmtShort(day))}</small></h2>
    ${arr.length ? arr.map((b) => line(b, '⤵︎ Anreise')).join('') : ''}
    ${dep.length ? dep.map((b) => line(b, '⤴︎ Abreise')).join('') : ''}
    ${!arr.length && !dep.length ? '<p class="muted" style="margin:4px 0">Keine An- oder Abreisen.</p>' : ''}
    <div class="todo-foot">
      <span>${occ.length} von ${units.length} belegt</span>
      <button class="link-btn" data-goorders="${day}">${os.length} Brötchen-Bestellung${os.length === 1 ? '' : 'en'} ›</button>
    </div>
    ${meat.length ? `<div class="todo-meat">🥩 Fleisch herrichten: ${esc(meat.map((m) => `${m.qty}${m.unit === 'kg' ? ' kg' : '×'} ${m.name}`).join(', '))}</div>` : ''}
  </div>`;
}

function bookingHtml() {
  const today = G.today();
  const [y, m] = calMonth.split('-').map(Number);
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = Array.from({ length: daysIn }, (_, i) => `${calMonth}-${String(i + 1).padStart(2, '0')}`);
  const act = bookings.filter((b) => b.status !== 'storniert');
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('de-AT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const wd = (d) => new Date(Date.UTC(...d.split('-').map((x, i) => (i === 1 ? x - 1 : +x)))).getUTCDay();
  const props = S().properties || [];
  const rows = props.map((p) => {
    const us = sortedUnits().filter((u) => G.propertyOf(S(), u).id === p.id);
    if (!us.length) return '';
    return `<tr class="cal-prop"><th colspan="${daysIn + 1}">${esc(p.name)}</th></tr>` + us.map((u) => `<tr><th class="u" title="${esc(u.name)}">${esc(u.name.replace(/^Ferienwohnung /, 'FeWo '))}</th>${days.map((d) => {
      const b = act.find((x) => x.unitId === u.id && occupies(x, d));
      const cls = [wd(d) === 0 || wd(d) === 6 ? 'we' : '', d === today ? 'today' : ''].filter(Boolean).join(' ');
      if (!b) return `<td class="${cls}" data-new="${esc(u.id)}|${d}"></td>`;
      const first = b.from === d || d === days[0];
      return `<td class="bk ${esc(b.status || 'fix')} ${cls} ${first ? 'first' : ''}" data-bk="${esc(b.id)}">${first ? `<span class="bk-l">${esc((b.name || '?').split(' ').slice(-1)[0])}</span>` : ''}</td>`;
    }).join('')}</tr>`).join('');
  }).join('');
  const upcoming = act.filter((b) => b.to >= today).sort((a, b) => a.from.localeCompare(b.from)).slice(0, 30);
  return `
    <div class="todo-grid">${dayCard(today, 'Heute')}${dayCard(G.addDays(today, 1), 'Morgen')}</div>
    <button class="btn primary" id="bNew">${ICON.plus} Buchung eintragen</button>
    <div class="datenav" style="margin-top:14px">
      <button class="icon-btn" data-cm="-1" aria-label="Voriger Monat">${ICON.back}</button>
      <div class="d"><b>${esc(monthLabel)}</b><small>${act.filter((b) => b.from <= days[daysIn - 1] && b.to > days[0]).length} Buchungen</small></div>
      <button class="icon-btn" data-cm="1" aria-label="Nächster Monat">${ICON.chevron}</button>
    </div>
    ${units.length ? `<div class="cal-wrap"><table class="cal">
      <thead><tr><th class="u"></th>${days.map((d) => `<th class="${wd(d) === 0 || wd(d) === 6 ? 'we' : ''} ${d === today ? 'today' : ''}">${+d.slice(8)}<small>${'SMDMDFS'[wd(d)]}</small></th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table></div>
      <p class="hint">Freies Feld antippen = neue Buchung ab diesem Tag. <span class="lg fix"></span> fix <span class="lg option"></span> Option</p>` : '<div class="empty">Leg zuerst Unterkünfte an.</div>'}
    <div class="section-title">Kommende Buchungen</div>
    ${upcoming.length ? `<div class="list">${upcoming.map((b) => `<button class="edit-row" data-bk="${esc(b.id)}">
      <span class="info"><b>${esc(b.name || 'Ohne Namen')}${b.status === 'option' ? ' <span class="badge">Option</span>' : ''}</b>
      <small>${esc(unitName(b.unitId) || '?')} · ${esc(fmtShort(b.from))} – ${esc(fmtShort(b.to))} · ${nightsOf(b)} N.${personsText(b) ? ` · ${esc(personsText(b))}` : ''}</small></span>${ICON.chevron}</button>`).join('')}</div>`
      : '<div class="empty">Noch keine Buchungen eingetragen.</div>'}`;
}
function bindBooking(v) {
  $('#bNew', v).onclick = () => openBookingForm(null, {});
  $$('[data-cm]', v).forEach((b) => (b.onclick = () => {
    const [y, m] = calMonth.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + +b.dataset.cm, 1));
    calMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    render();
  }));
  $$('[data-bk]', v).forEach((el) => (el.onclick = () => openBooking(el.dataset.bk)));
  $$('[data-new]', v).forEach((el) => (el.onclick = () => { const [u, d] = el.dataset.new.split('|'); openBookingForm(null, { unitId: u, from: d, to: G.addDays(d, 7) }); }));
  $$('[data-goorders]', v).forEach((b) => (b.onclick = () => { selDay = b.dataset.goorders; tab = 'orders'; render(); window.scrollTo(0, 0); }));
  const today = $('.cal .today', v);
  if (today) { const w = $('.cal-wrap', v); w.scrollLeft = Math.max(0, today.offsetLeft - 140); }
}

function openBookingForm(b, preset) {
  const d = b ? clone(b) : { unitId: preset.unitId || (sortedUnits()[0] || {}).id, from: preset.from || G.today(), to: preset.to || G.addDays(G.today(), 7),
    name: '', phone: '', email: '', adults: 2, children: 0, dog: false, source: 'Telefon', status: 'fix', lang: 'de', deposit: null, depositPaid: false, note: '' };
  const props = S().properties || [];
  openSheet(b ? 'Buchung bearbeiten' : 'Neue Buchung', `
    <label class="field"><span>Unterkunft</span><select class="input" id="bUnit">${props.map((p) => `<optgroup label="${esc(p.name)}">${sortedUnits().filter((u) => G.propertyOf(S(), u).id === p.id).map((u) => `<option value="${esc(u.id)}" ${u.id === d.unitId ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <div class="grid2">
      <label class="field"><span>Anreise</span><input class="input" id="bFrom" type="date" value="${esc(d.from)}"></label>
      <label class="field"><span>Abreise</span><input class="input" id="bTo" type="date" value="${esc(d.to)}"></label>
    </div>
    <p class="hint" id="bNights" style="margin-top:-6px"></p>
    <label class="field"><span>Name</span><input class="input" id="bName" value="${esc(d.name)}" placeholder="z. B. Familie Huber" autocomplete="off"></label>
    <div class="grid2">
      <label class="field"><span>Telefon / WhatsApp</span><input class="input" id="bPhone" inputmode="tel" value="${esc(d.phone)}" placeholder="+43 …"></label>
      <label class="field"><span>E-Mail</span><input class="input" id="bMail" type="email" value="${esc(d.email)}"></label>
      <label class="field"><span>Erwachsene</span><input class="input num" id="bAd" inputmode="numeric" value="${esc(d.adults ?? '')}"></label>
      <label class="field"><span>Kinder</span><input class="input num" id="bCh" inputmode="numeric" value="${esc(d.children ?? '')}"></label>
    </div>
    <div class="panel"><label class="toggle"><span>Mit Hund</span><input type="checkbox" id="bDog" ${d.dog ? 'checked' : ''}></label></div>
    <div class="grid2">
      <label class="field"><span>Gebucht über</span><select class="input" id="bSrc">${SOURCES.map((s) => `<option ${s === d.source ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label class="field"><span>Sprache des Gastes</span><select class="input" id="bLang">${Object.entries(G.LANGS).map(([k, v]) => `<option value="${k}" ${k === d.lang ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    <label class="field"><span>Status</span><select class="input" id="bStatus">${Object.entries(BSTATUS).map(([k, v]) => `<option value="${k}" ${k === d.status ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <div class="grid2">
      <label class="field"><span>Anzahlung (€)</span><input class="input num" id="bDep" inputmode="decimal" value="${esc(G.fmtIn(d.deposit))}" placeholder="0,00"></label>
      <div class="panel" style="margin:22px 0 12px"><label class="toggle"><span>Anzahlung bezahlt</span><input type="checkbox" id="bDepPaid" ${d.depositPaid ? 'checked' : ''}></label></div>
    </div>
    <label class="field"><span>Notiz (nur für euch)</span><textarea class="input" id="bNote" rows="2">${esc(d.note || '')}</textarea></label>
    <button class="btn primary" id="bSave">Speichern</button>
    ${b ? `<button class="btn danger" id="bDel">${ICON.trash} Buchung löschen</button>` : ''}`, (sh) => {
    const upd = () => {
      const f = $('#bFrom', sh).value; const t = $('#bTo', sh).value;
      $('#bNights', sh).textContent = f && t && t > f ? `${dayNum(t) - dayNum(f)} Nächte` : 'Abreise muss nach der Anreise sein';
    };
    $('#bFrom', sh).onchange = () => { const f = $('#bFrom', sh).value; if (f && $('#bTo', sh).value <= f) $('#bTo', sh).value = G.addDays(f, 7); upd(); };
    $('#bTo', sh).onchange = upd; upd();
    $('#bSave', sh).onclick = () => {
      const data = {
        unitId: $('#bUnit', sh).value, from: $('#bFrom', sh).value, to: $('#bTo', sh).value, name: $('#bName', sh).value.trim(),
        phone: $('#bPhone', sh).value.trim(), email: $('#bMail', sh).value.trim(), adults: G.num($('#bAd', sh).value) || 0, children: G.num($('#bCh', sh).value) || 0,
        dog: $('#bDog', sh).checked, source: $('#bSrc', sh).value, lang: $('#bLang', sh).value, status: $('#bStatus', sh).value,
        deposit: G.num($('#bDep', sh).value), depositPaid: $('#bDepPaid', sh).checked, note: $('#bNote', sh).value.trim(),
        updatedAt: Date.now(), createdAt: (b && b.createdAt) || Date.now(), by: (b && b.by) || (user && user.email) || '',
      };
      if (!data.unitId) { toast('Bitte eine Unterkunft wählen'); return; }
      if (!data.from || !data.to || data.to <= data.from) { toast('Bitte An- und Abreise prüfen'); return; }
      if (!data.name) { toast('Bitte einen Namen eingeben'); $('#bName', sh).focus(); return; }
      const id = b ? b.id : `b${G.uid(14)}`;
      if (data.status !== 'storniert') {
        const clash = activeBookings().find((x) => x.id !== id && overlaps(x, data));
        if (clash && !confirm(`Achtung: ${unitName(data.unitId)} ist von ${fmtShort(clash.from)} bis ${fmtShort(clash.to)} schon an „${clash.name}“ vergeben.\n\nTrotzdem speichern?`)) return;
      }
      store.saveBooking(id, data);
      const list = [...bookings.filter((x) => x.id !== id), { ...data, id }];
      syncStays(data.unitId, list);
      if (b && b.unitId !== data.unitId) syncStays(b.unitId, list);
      bookings = list;
      closeSheet(); toast('Buchung gespeichert');
      if (tab === 'booking') render();
      openBooking(id);
    };
    const del = $('#bDel', sh);
    if (del) del.onclick = () => {
      if (!confirm(`Buchung „${b.name}“ (${fmtShort(b.from)} – ${fmtShort(b.to)}) wirklich löschen?\nTipp: Bei Stornierungen besser den Status auf „Storniert“ setzen.`)) return;
      store.deleteBooking(b.id);
      const list = bookings.filter((x) => x.id !== b.id);
      syncStays(b.unitId, list); bookings = list;
      closeSheet(); toast('Gelöscht'); render();
    };
  });
}

function arrivalMessage(b) {
  const u = unitById(b.unitId) || {};
  const P = G.propertyOf(S(), u);
  const link = `${guestUrl(b.unitId)}&lang=${b.lang || 'de'}`;
  return withLang(b.lang, () => {
    const L = G.lang;
    const extra = G.tr(P, 'arrivalExtra');
    const from = G.fmtDay(b.from); const to = G.fmtDay(b.to);
    const first = (b.name || '').trim();
    if (L === 'en') return `Hello ${first},\n\nwe are already looking forward to your stay! Here are the most important details:\n\n🏠 ${P.name} – ${u.name || ''}\n📅 Arrival: ${from}\n📅 Departure: ${to}${extra ? `\n\n${extra}` : ''}\n\nIn your digital guest folder you will find everything about your arrival, the Wi-Fi and our bread service:\n${link}\n\nSafe travels and kind regards\nThe Herzog family`;
    if (L === 'nl') return `Hallo ${first},\n\nwe kijken al uit naar jullie komst! Hier de belangrijkste informatie:\n\n🏠 ${P.name} – ${u.name || ''}\n📅 Aankomst: ${from}\n📅 Vertrek: ${to}${extra ? `\n\n${extra}` : ''}\n\nIn jullie digitale gastenmap vinden jullie alles over de aankomst, de wifi en onze broodservice:\n${link}\n\nGoede reis en hartelijke groeten\nFamilie Herzog`;
    return `Hallo ${first},\n\nwir freuen uns schon auf euch! Hier die wichtigsten Infos zu eurem Aufenthalt:\n\n🏠 ${P.name} – ${u.name || ''}\n📅 Anreise: ${from}\n📅 Abreise: ${to}${extra ? `\n\n${extra}` : ''}\n\nIn eurer digitalen Gästemappe findet ihr alles zur Anreise, das WLAN und unseren Brötchenservice:\n${link}\n\nGute Anreise und liebe Grüße\nFamilie Herzog`;
  });
}
const waNumber = (p) => { let d = String(p || '').replace(/[^\d+]/g, ''); if (d.startsWith('+')) return d.slice(1); if (d.startsWith('00')) return d.slice(2); if (d.startsWith('0')) return `43${d.slice(1)}`; return d; };

function openBooking(id) {
  const b = bookings.find((x) => x.id === id);
  if (!b) return;
  const u = unitById(b.unitId) || {};
  const P = G.propertyOf(S(), u);
  const os = bookingOrders(b);
  const osSum = os.reduce((s, o) => s + G.orderTotal(o), 0);
  const msg = arrivalMessage(b);
  const subj = withLang(b.lang, () => (G.lang === 'en' ? `Your stay at ${P.name}` : G.lang === 'nl' ? `Jullie verblijf bij ${P.name}` : `Euer Aufenthalt – ${P.name}`));
  const rows = [
    ['Unterkunft', `${u.name || '?'} · ${P.name || ''}`],
    ['Zeitraum', `${fmtLong(b.from)} – ${fmtLong(b.to)} (${nightsOf(b)} Nächte)`],
    ['Personen', personsText(b) || '–'],
    ['Kontakt', [b.phone, b.email].filter(Boolean).join(' · ') || '–'],
    ['Gebucht über', b.source || '–'],
    ['Sprache', G.LANGS[b.lang || 'de']],
    ['Anzahlung', b.deposit ? `${money(b.deposit)} ${b.depositPaid ? '✓ bezahlt' : '– offen'}` : '–'],
    ['Brötchen & Fleisch', os.length ? `${os.length} Bestellungen · ${money(osSum)}` : 'keine'],
  ];
  openSheet(b.name || 'Buchung', `
    ${b.status !== 'fix' ? `<div class="warn-box">${esc(BSTATUS[b.status] || b.status)}</div>` : ''}
    <div class="kv">${rows.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
    ${b.note ? `<div class="note-box">${esc(b.note)}</div>` : ''}
    <div class="section-title">Anreise-Info an den Gast</div>
    <div class="share-row">
      ${b.phone ? `<a class="btn primary" href="https://wa.me/${esc(waNumber(b.phone))}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${ICON.chat}WhatsApp</a>` : ''}
      ${b.email ? `<a class="btn ${b.phone ? '' : 'primary'}" href="mailto:${esc(b.email)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(msg)}">${ICON.mail}E-Mail</a>` : ''}
      <button class="btn" id="bShare">${ICON.share}Teilen</button>
    </div>
    <details class="tr-box"><summary>Nachricht ansehen</summary><pre class="msg">${esc(msg)}</pre></details>
    <button class="btn" id="bLink">${ICON.copy} Link zur Gästemappe kopieren</button>
    <button class="btn" id="bEdit">${ICON.edit} Bearbeiten</button>
    <p class="hint">Die Rechnung kommt mit dem nächsten Update, sobald Preise, Endreinigung und Ortstaxe eingetragen sind.</p>`, (sh) => {
    $('#bShare', sh).onclick = () => shareText(msg);
    $('#bLink', sh).onclick = () => copyText(`${guestUrl(b.unitId)}&lang=${b.lang || 'de'}`);
    $('#bEdit', sh).onclick = () => openBookingForm(b, {});
  });
}

// ---------- Gästemappe bearbeiten ----------
const ICON_NAMES = { home: 'Haus', key: 'Schlüssel', wifi: 'WLAN', rules: 'Regeln', recycle: 'Müll', sos: 'Notfall', map: 'Karte', mountain: 'Berge', egg: 'Hof', bread: 'Brot', car: 'Auto', phone: 'Telefon', info: 'Info', book: 'Buch' };
function trState(sec) {
  const has = sec.text_en || sec.text_nl;
  if (!has) return 'fehlt';
  return sec.trSrc && sec.trSrc !== G.hash(`${sec.title}\n${sec.text}`) ? 'veraltet' : '';
}
const trBadge = (st) => (st === 'veraltet' ? '<span class="badge warn">bitte prüfen</span>' : st === 'fehlt' ? '<span class="badge">fehlt</span>' : '<span class="badge ok">✓</span>');
function contentHtml() {
  if (!draft) draft = clone(S());
  const props = draft.properties;
  if (contentProp >= props.length) contentProp = 0;
  const P = props[contentProp];
  const firstUnit = units.find((u) => u.property === P.id);
  return `
    <div class="seg" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${props.map((p, i) => `<button class="btn small ${i === contentProp ? 'primary' : ''}" style="margin:0" data-prop="${i}">${esc(p.name)}</button>`).join('')}</div>
    <div class="panel">
      <label class="field"><span>Name</span><input class="input" id="cName" value="${esc(P.name)}"></label>
      <label class="field"><span>Untertitel</span><input class="input" id="cSub" value="${esc(P.subtitle || '')}"></label>
      <div class="grid2">
        <label class="field"><span>Telefon</span><input class="input" id="cPhone" inputmode="tel" value="${esc(P.phone || '')}" placeholder="+43 …"></label>
        <label class="field"><span>WhatsApp</span><input class="input" id="cWa" inputmode="tel" value="${esc(P.whatsapp || '')}" placeholder="+43 …"></label>
        <label class="field"><span>E-Mail</span><input class="input" id="cMail" type="email" value="${esc(P.email || '')}"></label>
        <label class="field"><span>Webseite</span><input class="input" id="cWeb" type="url" value="${esc(P.website || '')}"></label>
      </div>
      <label class="field"><span>Hinweis zum Brötchenservice</span><input class="input" id="cDeliv" value="${esc(P.deliveryText || '')}"></label>
      <label class="field"><span>Link für Bewertungen (Google, Booking …)</span><input class="input" id="cReview" type="url" value="${esc(P.reviewUrl || '')}" placeholder="https://g.page/r/…"></label>
      <p class="hint" style="margin-top:-6px">Am Abreisetag bittet die Gästemappe dann um eine Bewertung (nur wenn die Buchung unter „Belegung“ eingetragen ist).</p>
      <label class="field" style="margin:0"><span>Zusatz für die Anreise-Info (optional)</span><textarea class="input" id="cArr" rows="2" placeholder="z. B. Schlüssel liegt im Kasten neben der Tür">${esc(P.arrivalExtra || '')}</textarea></label>
      <details class="tr-box"><summary>Übersetzungen (Englisch / Niederländisch) ${trBadge(P.subtitle_en || P.subtitle_nl ? '' : 'fehlt')}</summary>
        ${[['subtitle', 'Untertitel'], ['deliveryText', 'Hinweis Brötchenservice'], ['arrivalExtra', 'Zusatz Anreise-Info']].map(([k, l]) => `<div class="grid2">
          <label class="field"><span>${l} 🇬🇧</span><input class="input" data-ptr="${k}_en" value="${esc(P[`${k}_en`] || '')}"></label>
          <label class="field"><span>${l} 🇳🇱</span><input class="input" data-ptr="${k}_nl" value="${esc(P[`${k}_nl`] || '')}"></label></div>`).join('')}
      </details>
    </div>
    <div class="section-title">Abschnitte der Gästemappe – ${esc(P.name)}</div>
    <p class="hint" style="margin-top:-4px">Formatierung: <b>**fett**</b>, Zeilen mit „- “ werden Aufzählungen, Telefonnummern und Links werden automatisch anklickbar. Überall wo <b>[hier eintragen]</b> steht, fehlt noch eine Info.</p>
    <div id="secList">${P.sections.map((sec, i) => `<div class="sec-edit">
      <div class="row">
        <select class="input" data-sicon="${i}" style="flex:0 0 112px">${G.SECTION_ICONS.map((k) => `<option value="${k}" ${k === sec.icon ? 'selected' : ''}>${ICON_NAMES[k] || k}</option>`).join('')}</select>
        <input class="input" data-stitle="${i}" value="${esc(sec.title)}" placeholder="Überschrift">
        <div class="tools">
          <button class="icon-btn" data-sup="${i}" aria-label="nach oben" ${i ? '' : 'disabled'}>${ICON.up}</button>
          <button class="icon-btn" data-sdown="${i}" aria-label="nach unten" ${i < P.sections.length - 1 ? '' : 'disabled'}>${ICON.down}</button>
          <button class="icon-btn" data-sdel="${i}" aria-label="löschen">${ICON.trash}</button>
        </div>
      </div>
      <textarea class="input" data-stext="${i}" rows="7">${esc(sec.text)}</textarea>
      <details class="tr-box"><summary>Übersetzung 🇬🇧 🇳🇱 ${trBadge(trState(sec))}</summary>
        ${trState(sec) === 'veraltet' ? `<div class="warn-box">Der deutsche Text wurde geändert. Bitte die Übersetzung anpassen – oder <button class="link-btn" data-trok="${i}">passt so</button>.</div>` : ''}
        <input class="input" data-tr="${i}|title_en" value="${esc(sec.title_en || '')}" placeholder="Title (English)">
        <textarea class="input" data-tr="${i}|text_en" rows="5" placeholder="Text (English)">${esc(sec.text_en || '')}</textarea>
        <input class="input" data-tr="${i}|title_nl" value="${esc(sec.title_nl || '')}" placeholder="Titel (Nederlands)">
        <textarea class="input" data-tr="${i}|text_nl" rows="5" placeholder="Tekst (Nederlands)">${esc(sec.text_nl || '')}</textarea>
        <p class="hint" style="margin:0">Leer lassen = Gäste sehen den deutschen Text (ihr Browser kann ihn übersetzen).</p>
      </details>
    </div>`).join('')}</div>
    <button class="btn" id="cAdd">${ICON.plus} Abschnitt hinzufügen</button>
    <button class="btn primary" id="cSave">Speichern</button>
    ${firstUnit ? `<a class="btn" href="${esc(guestUrl(firstUnit.id))}" target="_blank" rel="noopener">So sehen es die Gäste</a>` : ''}`;
}
function bindContent(v) {
  const P = draft.properties[contentProp];
  const rer = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };
  $$('[data-prop]', v).forEach((b) => (b.onclick = () => { contentProp = +b.dataset.prop; rer(); }));
  const f = { cName: 'name', cSub: 'subtitle', cPhone: 'phone', cWa: 'whatsapp', cMail: 'email', cWeb: 'website', cDeliv: 'deliveryText', cReview: 'reviewUrl', cArr: 'arrivalExtra' };
  $$('[data-ptr]', v).forEach((el) => (el.oninput = () => { P[el.dataset.ptr] = el.value; }));
  $$('[data-tr]', v).forEach((el) => (el.oninput = () => { const [i, k] = el.dataset.tr.split('|'); const sec = P.sections[+i]; sec[k] = el.value; sec.trTouched = true; }));
  $$('[data-trok]', v).forEach((b) => (b.onclick = () => { const sec = P.sections[+b.dataset.trok]; sec.trSrc = G.hash(`${sec.title}\n${sec.text}`); rer(); }));
  Object.entries(f).forEach(([id, key]) => { $(`#${id}`, v).oninput = (e) => { P[key] = e.target.value; }; });
  $$('[data-stitle]', v).forEach((el) => (el.oninput = () => { P.sections[+el.dataset.stitle].title = el.value; }));
  $$('[data-stext]', v).forEach((el) => (el.oninput = () => { P.sections[+el.dataset.stext].text = el.value; }));
  $$('[data-sicon]', v).forEach((el) => (el.onchange = () => { P.sections[+el.dataset.sicon].icon = el.value; }));
  $$('[data-sup]', v).forEach((b) => (b.onclick = () => { const i = +b.dataset.sup; [P.sections[i - 1], P.sections[i]] = [P.sections[i], P.sections[i - 1]]; rer(); }));
  $$('[data-sdown]', v).forEach((b) => (b.onclick = () => { const i = +b.dataset.sdown; [P.sections[i + 1], P.sections[i]] = [P.sections[i], P.sections[i + 1]]; rer(); }));
  $$('[data-sdel]', v).forEach((b) => (b.onclick = () => { const i = +b.dataset.sdel; if (confirm(`Abschnitt „${P.sections[i].title}“ löschen?`)) { P.sections.splice(i, 1); rer(); } }));
  $('#cAdd', v).onclick = () => { P.sections.push({ id: G.uid(6), icon: 'info', title: 'Neuer Abschnitt', text: '' }); rer(); setTimeout(() => { const t = $$('[data-stitle]').pop(); if (t) { t.focus(); t.select(); } }, 50); };
  $('#cSave', v).onclick = () => {
    const props = draft.properties.map((p) => ({
      ...p, name: (p.name || '').trim() || 'Unterkunft', subtitle: (p.subtitle || '').trim(), phone: (p.phone || '').trim(), whatsapp: (p.whatsapp || '').trim(),
      email: (p.email || '').trim(), website: (p.website || '').trim(), deliveryText: (p.deliveryText || '').trim(),
      reviewUrl: (p.reviewUrl || '').trim(), arrivalExtra: (p.arrivalExtra || '').trim(),
      sections: p.sections.filter((x) => x.title.trim() || x.text.trim()).map(({ trTouched, ...x }) => (trTouched ? { ...x, trSrc: G.hash(`${x.title}\n${x.text}`) } : x)),
    }));
    const merged = { ...S(), properties: props };
    store.saveSite(merged); site = merged; draft = null; toast(`Gästemappe „${props[contentProp].name}“ gespeichert`); render();
  };
}

// ---------- Unterkünfte ----------
function unitsHtml() {
  const props = S().properties || [];
  const row = (u) => `<button class="edit-row" data-unit="${esc(u.id)}">
      <span class="info"><b>${esc(u.name)}</b><small>${[u.breakfast !== false ? 'Brötchenservice' : 'kein Brötchenservice', u.askSpot ? 'fragt Stellplatz' : '', u.wlanName ? 'WLAN' : ''].filter(Boolean).join(' · ')}</small></span>
      ${ICON.chevron}</button>`;
  const groups = props.map((p) => [p, units.filter((u) => G.propertyOf(S(), u).id === p.id).sort((a, b) => a.name.localeCompare(b.name, 'de'))]);
  return `
    ${units.length ? groups.map(([p, list]) => `<div class="section-title">${esc(p.name)}</div>
      <div class="list">${list.map(row).join('') || '<div class="empty" style="padding:14px">Keine Unterkunft</div>'}</div>`).join('')
      : '<div class="empty" style="padding:16px">Noch keine Unterkünfte.</div>'}
    <button class="btn" id="uAdd" style="margin-top:12px">${ICON.plus} Unterkunft hinzufügen</button>
    <button class="btn primary" id="uPrint">${ICON.print} QR-Codes für alle drucken</button>
    <p class="hint">Jede Unterkunft hat einen eigenen QR-Code. Damit wissen wir bei jeder Bestellung, wohin sie geliefert wird, und Gäste sehen das richtige WLAN. Am besten laminiert in die Wohnung hängen.</p>`;
}
function bindUnits(v) {
  $$('[data-unit]', v).forEach((b) => (b.onclick = () => openUnit(units.find((u) => u.id === b.dataset.unit))));
  $('#uAdd', v).onclick = () => openUnit(null);
  $('#uPrint', v).onclick = () => printQr([...units].sort((a, b) => propIndex(G.propertyOf(S(), a).id) - propIndex(G.propertyOf(S(), b).id) || a.name.localeCompare(b.name, 'de')));
}
function openUnit(u) {
  const props = S().properties || [];
  const d = u ? clone(u) : { name: '', property: props[0] && props[0].id, breakfast: true, askSpot: false, wlanName: '', wlanPassword: '', note: '' };
  const curProp = G.propertyOf(S(), d).id;
  openSheet(u ? u.name : 'Neue Unterkunft', `
    <label class="field"><span>Name</span><input class="input" id="eName" value="${esc(d.name)}" placeholder="z. B. Ferienwohnung Alpenblick"></label>
    <label class="field"><span>Gehört zu</span><select class="input" id="eProp">${props.map((p) => `<option value="${esc(p.id)}" ${p.id === curProp ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    <div class="panel">
      <label class="toggle"><span>Brötchenservice (Bestellung möglich)</span><input type="checkbox" id="eBf" ${d.breakfast !== false ? 'checked' : ''}></label>
      <label class="toggle"><span>Nach Stellplatz-Nummer fragen (Camping)</span><input type="checkbox" id="eSpot" ${d.askSpot ? 'checked' : ''}></label>
    </div>
    <div class="grid2">
      <label class="field"><span>WLAN-Name</span><input class="input" id="eWn" value="${esc(d.wlanName)}" autocapitalize="off" spellcheck="false"></label>
      <label class="field"><span>WLAN-Passwort</span><input class="input" id="eWp" value="${esc(d.wlanPassword)}" autocapitalize="off" spellcheck="false"></label>
    </div>
    <label class="field"><span>Hinweis nur für diese Unterkunft (optional)</span><textarea class="input" id="eNote" rows="3">${esc(d.note)}</textarea></label>
    <button class="btn primary" id="eSave">Speichern</button>
    ${u ? `<button class="btn" id="eQr">${ICON.qr} QR-Code drucken</button>
      <button class="btn" id="eLink">${ICON.copy} Link kopieren</button>
      <button class="btn danger" id="eDel">${ICON.trash} Unterkunft löschen</button>` : ''}`, (sh) => {
    $('#eSave', sh).onclick = () => {
      const name = $('#eName', sh).value.trim();
      if (!name) { toast('Bitte einen Namen eingeben'); return; }
      const data = { name, property: $('#eProp', sh).value, breakfast: $('#eBf', sh).checked, askSpot: $('#eSpot', sh).checked, wlanName: $('#eWn', sh).value.trim(), wlanPassword: $('#eWp', sh).value.trim(), note: $('#eNote', sh).value.trim() };
      if (u && u.stays) data.stays = u.stays;
      store.saveUnit(u ? u.id : G.newUnitId(name), data);
      closeSheet(); toast('Gespeichert');
    };
    if (u) {
      $('#eQr', sh).onclick = () => printQr([u]);
      $('#eLink', sh).onclick = () => copyText(guestUrl(u.id));
      $('#eDel', sh).onclick = () => {
        if (!confirm(`„${u.name}“ löschen? Der QR-Code dieser Unterkunft funktioniert danach nicht mehr.`)) return;
        store.deleteUnit(u.id); closeSheet(); toast('Gelöscht');
      };
    }
  });
}

// ---------- QR-Codes drucken ----------
function qrSvg(text) {
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0 });
}
function printQr(list) {
  if (!list.length) { toast('Keine Unterkünfte'); return; }
  if (location.protocol === 'file:') toast('Achtung: Die QR-Codes zeigen auf diese Datei am PC. Erst nach dem Veröffentlichen drucken!');
  const s = S();
  const info = (u) => ({
    title: G.propertyOf(s, u).name || s.hofName || '',
    unit: u.name,
    line: `Gästemappe${u.breakfast !== false && s.breakfast !== false ? ' & Brötchen bestellen' : ''}`,
    url: guestUrl(u.id),
  });
  const area = $('#printArea');
  area.innerHTML = `<div class="print-bar no-print">
      <button class="btn" id="pClose">${ICON.back} Zurück</button>
      <button class="btn primary" id="pGo">${ICON.print} Drucken</button></div>
    <p class="hint no-print">Klappt das Drucken nicht? Dann speichere die Karten als Bild (Knopf unter jeder Karte) – am Handy kannst du sie dort auch direkt drucken oder dir per Mail schicken.</p>
    <div class="qr-grid">${list.map((u, i) => { const x = info(u); return `<div class="qr-wrap"><div class="qr-card">
      <h3>${esc(x.title)}</h3><div class="unit">${esc(x.unit)}</div>
      ${qrSvg(x.url)}
      <p><b>${esc(x.line)}</b><br>Mit der Handy-Kamera scannen</p>
      <small>${esc(x.url)}</small></div>
      <button class="btn small no-print" data-img="${i}">${ICON.share} Als Bild speichern</button></div>`; }).join('')}</div>`;
  document.body.classList.add('printing');
  window.scrollTo(0, 0);
  const close = () => { document.body.classList.remove('printing'); area.innerHTML = ''; };
  $('#pClose', area).onclick = close;
  $('#pGo', area).onclick = () => {
    try { window.print(); } catch (e) { toast('Drucken geht hier nicht – bitte „Als Bild speichern“ verwenden.'); }
  };
  $$('[data-img]', area).forEach((btn) => (btn.onclick = () => saveQrImage(info(list[+btn.dataset.img]))));
}

// QR-Karte als PNG-Bild (zum Teilen, Drucken vom Handy oder Mailen an den PC)
function wrapText(ctx, text, maxW) {
  const words = String(text).split(' '); const lines = []; let cur = '';
  words.forEach((w) => { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur);
  return lines;
}
async function saveQrImage(x) {
  const W = 1200, H = 1500, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#999'; ctx.lineWidth = 6; ctx.setLineDash([24, 16]);
  ctx.strokeRect(30, 30, W - 60, H - 60); ctx.setLineDash([]);
  ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  let y = 110;
  ctx.font = 'bold 72px system-ui, sans-serif';
  wrapText(ctx, x.title, W - 200).forEach((l) => { ctx.fillText(l, W / 2, y); y += 88; });
  ctx.font = 'bold 56px system-ui, sans-serif';
  wrapText(ctx, x.unit, W - 200).forEach((l) => { ctx.fillText(l, W / 2, y + 10); y += 70; });
  const qr = window.qrcode(0, 'M'); qr.addData(x.url); qr.make();
  const n = qr.getModuleCount(), size = 760, cell = Math.floor(size / n), qs = cell * n, qx = Math.round((W - qs) / 2), qy = Math.round(y + 60);
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (qr.isDark(r, col)) ctx.fillRect(qx + col * cell, qy + r * cell, cell, cell);
  y = qy + qs + 70;
  ctx.font = 'bold 50px system-ui, sans-serif'; ctx.fillText(x.line, W / 2, y);
  ctx.font = '44px system-ui, sans-serif'; ctx.fillText('Mit der Handy-Kamera scannen', W / 2, y + 70);
  ctx.font = '26px system-ui, sans-serif'; ctx.fillStyle = '#555';
  wrapText(ctx, x.url.replace(/([/?=&])/g, '$1 '), W - 160).forEach((l, i) => ctx.fillText(l.replace(/ /g, ''), W / 2, y + 160 + i * 34));
  const name = `QR-${G.slug(x.unit)}.png`;
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  const file = new File([blob], name, { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: x.unit }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Bild gespeichert');
}

// ---------- Einstellungen ----------
function settingsHtml() {
  if (!draft) draft = clone(S());
  const d = draft;
  return `
    <div class="section-title">Frühstück</div>
    <div class="panel">
      <label class="toggle"><span>Frühstücksbestellung aktiv</span><input type="checkbox" id="sOn" ${d.breakfast !== false ? 'checked' : ''}></label>
      <label class="field"><span>Bestellschluss am Vortag</span><select class="input" id="sCut">
        ${Array.from({ length: 13 }, (_, i) => i + 10).map((h) => `<option value="${h}" ${+d.cutoffHour === h ? 'selected' : ''}>${h}:00 Uhr</option>`).join('')}</select></label>
      <p class="hint" style="margin:0">Produkte ohne Preis bitte nicht als „bestellbar“ markieren. Den Hinweis zur Lieferung und die Kontaktdaten stellst du pro Betrieb unter „Gästemappe“ ein. Ob eine einzelne Unterkunft bestellen kann, unter „Unterkünfte“.</p>
    </div>
    <div class="section-title">Produkte & Preise</div>
    <div class="panel" id="prodList">
      ${d.products.map((p, i) => `<div class="prod-edit">
        <input class="input" data-pname="${i}" value="${esc(p.name)}" placeholder="Produkt">
        <input class="input num" data-pprice="${i}" inputmode="decimal" value="${G.fmtIn(p.price)}" placeholder="€">
        <button class="icon-btn" data-pdel="${i}" aria-label="löschen">${ICON.trash}</button>
        <div class="meta">
          <label><input type="radio" name="pg${i}" data-pgroup="${i}" value="baecker" ${(p.group || 'baecker') === 'baecker' ? 'checked' : ''}>Bäcker</label>
          <label><input type="radio" name="pg${i}" data-pgroup="${i}" value="hof" ${p.group === 'hof' ? 'checked' : ''}>vom Hof</label>
          <label><input type="radio" name="pg${i}" data-pgroup="${i}" value="fleisch" ${p.group === 'fleisch' ? 'checked' : ''}>Fleisch</label>
          <label><input type="checkbox" data-pact="${i}" ${p.active !== false ? 'checked' : ''}>bestellbar</label>
          ${(p.group || 'baecker') === 'baecker' ? `<select class="input" data-pcat="${i}" style="width:auto;padding:4px 8px;min-height:0">
            ${['', ...G.BAKERY_CATS].map((c) => `<option value="${esc(c)}" ${(p.cat || '') === c ? 'selected' : ''}>${c ? esc(c) : 'ohne Kategorie'}</option>`).join('')}</select>` : ''}
          ${p.group === 'fleisch' ? `<select class="input" data-punit="${i}" style="width:auto;padding:4px 8px;min-height:0"><option value="" ${p.unit !== 'kg' ? 'selected' : ''}>pro Stück</option><option value="kg" ${p.unit === 'kg' ? 'selected' : ''}>pro kg</option></select>` : ''}
        </div>
        <div class="tr-row"><input class="input" data-pen="${i}" value="${esc(p.name_en || '')}" placeholder="🇬🇧 English"><input class="input" data-pnl="${i}" value="${esc(p.name_nl || '')}" placeholder="🇳🇱 Nederlands"></div>
        </div>`).join('')}
      <button class="btn small" id="pAdd">${ICON.plus} Produkt</button>
    </div>
    <div class="section-title">Bäckerei</div>
    <div class="panel">
      <div class="grid2">
        <label class="field"><span>Name</span><input class="input" id="sBName" value="${esc(d.bakeryName)}" placeholder="z. B. Bäckerei Mair"></label>
        <label class="field"><span>WhatsApp-Nummer</span><input class="input" id="sBPhone" inputmode="tel" value="${esc(d.bakeryPhone)}" placeholder="+43 …"></label>
      </div>
      <p class="hint" style="margin:0">Mit Nummer erscheint bei den Bestellungen ein Knopf, der die fertige Liste per WhatsApp an die Bäckerei schickt.</p>
    </div>
    <button class="btn primary" id="sSave">Speichern</button>
    <div class="section-title">Konto</div>
    <div class="panel">${store.mode === 'demo' ? '<p class="hint" style="margin:0">Demo-Modus – kein Konto nötig. Für echte Bestellungen Firebase in config.js eintragen (siehe Anleitung).</p>'
      : `<p class="hint" style="margin-top:0">Angemeldet als <b>${esc(user.email)}</b></p><button class="btn" id="sOut">Abmelden</button>`}</div>
    <p class="hint" style="text-align:center">Gäste-App ${G.VERSION}</p>`;
}
function bindSettings(v) {
  const d = draft;
  const rer = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };
  $$('[data-pname]', v).forEach((el) => (el.oninput = () => { d.products[+el.dataset.pname].name = el.value; }));
  $$('[data-pprice]', v).forEach((el) => (el.oninput = () => { d.products[+el.dataset.pprice].price = G.num(el.value) || 0; }));
  $$('[data-pgroup]', v).forEach((el) => (el.onchange = () => { d.products[+el.dataset.pgroup].group = el.value; rer(); }));
  $$('[data-pcat]', v).forEach((el) => (el.onchange = () => { d.products[+el.dataset.pcat].cat = el.value; }));
  $$('[data-punit]', v).forEach((el) => (el.onchange = () => { d.products[+el.dataset.punit].unit = el.value; }));
  $$('[data-pen]', v).forEach((el) => (el.oninput = () => { d.products[+el.dataset.pen].name_en = el.value; }));
  $$('[data-pnl]', v).forEach((el) => (el.oninput = () => { d.products[+el.dataset.pnl].name_nl = el.value; }));
  $$('[data-pact]', v).forEach((el) => (el.onchange = () => { d.products[+el.dataset.pact].active = el.checked; }));
  $$('[data-pdel]', v).forEach((b) => (b.onclick = () => { d.products.splice(+b.dataset.pdel, 1); rer(); }));
  $('#pAdd', v).onclick = () => { d.products.push({ id: G.uid(6), name: '', price: 0, group: 'baecker', active: true }); rer(); };
  const out = $('#sOut', v); if (out) out.onclick = () => store.signOut();
  $('#sSave', v).onclick = () => {
    const merged = {
      ...S(),
      breakfast: $('#sOn', v).checked, cutoffHour: +$('#sCut', v).value,
      products: d.products.filter((p) => p.name.trim()).map((p) => ({ ...p, name: p.name.trim(), price: Math.round((p.price || 0) * 100) / 100 })),
      bakeryName: $('#sBName', v).value.trim(), bakeryPhone: $('#sBPhone', v).value.trim(),
    };
    store.saveSite(merged); site = merged; draft = null; toast('Einstellungen gespeichert'); render();
  };
}

// ---------- Sheet ----------
function openSheet(title, html, mount) {
  $('#sheetHost').innerHTML = `<div class="sheet-bg" id="shBg"></div><div class="sheet" role="dialog" aria-modal="true">
    <div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" id="shClose" aria-label="Schließen"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div id="shBody">${html}</div></div>`;
  $('#shBg').onclick = closeSheet;
  $('#shClose').onclick = closeSheet;
  document.body.style.overflow = 'hidden';
  if (mount) mount($('#shBody'));
}
function closeSheet() { $('#sheetHost').innerHTML = ''; document.body.style.overflow = ''; }

// ---------- Rendering ----------
const EDIT_TABS = ['content', 'settings'];
function render() {
  const v = $('#view');
  const t = TABS.find((x) => x[0] === tab);
  $('#topTitle').firstChild.textContent = t[3] || t[1];
  $('#topSub').textContent = S().hofName || '';
  $('#tabbar').innerHTML = TABS.map(([k, label, icon]) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${icon}<span>${label}</span></button>`).join('');
  $$('#tabbar [data-tab]').forEach((b) => (b.onclick = () => {
    if (EDIT_TABS.includes(tab) && b.dataset.tab !== tab) draft = null;
    tab = b.dataset.tab; render(); window.scrollTo(0, 0);
  }));
  if (!loaded.site || !loaded.units) { v.innerHTML = '<div class="center"><div class="spinner"></div></div>'; return; }
  const views = {
    orders: [ordersHtml, bindOrders], booking: [bookingHtml, bindBooking], billing: [billingHtml, bindBilling], content: [contentHtml, bindContent],
    units: [unitsHtml, bindUnits], settings: [settingsHtml, bindSettings],
  };
  const [h, b] = views[tab];
  v.innerHTML = h();
  b(v);
}
// Live-Updates nicht in Formulare hineinrendern, während jemand tippt
function liveRender() { if (!EDIT_TABS.includes(tab)) render(); }

function maybeSeed() {
  if (seeded || !loaded.site || !loaded.units) return;
  seeded = true;
  if (!site) {
    store.saveSite(G.defaultSite());
    if (!units.length) G.defaultUnits().forEach((u) => store.saveUnit(G.newUnitId(u.name), u));
    toast('Startinhalte angelegt – passe sie unter „Gästemappe“ und „Unterkünfte“ an.');
  } else if (!Array.isArray(site.properties) || !site.properties.length) {
    // Alte Version (ein gemeinsamer Hof) -> drei Betriebe
    const migrated = G.migrateSite(site);
    store.saveSite(migrated); site = migrated;
    const { changes, adds } = G.migrateUnits(units);
    changes.forEach(([id, data]) => store.saveUnit(id, data));
    adds.forEach((u) => store.saveUnit(G.newUnitId(u.name), u));
    toast('Umgestellt auf Stegerbauer, Nösslau Alm und Schoberhof');
  } else {
    const up = G.upgradeSite(site);
    if (up) { store.saveSite(up); site = up; toast('Gästemappe und Preisliste aktualisiert'); }
  }
}

// ---------- Login & Start ----------
let unsubs = [];
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
function startApp() {
  $('#boot').hidden = true; $('#login').hidden = true; $('#app').hidden = false;
  $('#demoBanner').hidden = store.mode !== 'demo';
  $('#guestLink').innerHTML = ICON.book;
  unsubs.forEach((u) => u()); unsubs = [];
  loaded = { site: false, units: false, orders: false };
  render();
  unsubs.push(store.watchSite((s) => { site = s; loaded.site = true; maybeSeed(); liveRender(); }));
  unsubs.push(store.watchUnits((us) => { units = us; loaded.units = true; maybeSeed(); liveRender(); }));
  unsubs.push(store.watchOrders(G.addDays(G.today(), -400), (os) => { orders = os; loaded.orders = true; liveRender(); }));
  if (store.watchBookings) unsubs.push(store.watchBookings((bs) => { bookings = bs; liveRender(); }));
}
async function boot() {
  try { store = await G.createStore(window.GAESTE_CONFIG, { persistent: true, onError: onStoreError }); }
  catch (e) { $('#boot').innerHTML = '<div class="err-box" style="margin:20px">Die Verwaltung konnte nicht starten. Bist du online?</div>'; return; }
  await store.onAuth((u) => {
    user = u;
    if (u) startApp();
    else { unsubs.forEach((x) => x()); unsubs = []; closeSheet(); showLogin(); }
  });
  setInterval(() => { if (tab === 'orders' && !$('#sheetHost').innerHTML) render(); }, 60000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
})();
