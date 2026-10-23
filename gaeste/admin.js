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
const guestUrl = (id) => new URL(`index.html${id ? `?u=${encodeURIComponent(id)}` : ''}`, location.href).href;

const TABS = [
  ['orders', 'Bestellungen', ICON.bread],
  ['billing', 'Abrechnung', ICON.euro],
  ['content', 'Gästemappe', ICON.book],
  ['units', 'Unterkünfte', ICON.home],
  ['settings', 'Einstellungen', ICON.gear],
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
    const cur = map.get(key) || { name: it.name, qty: 0, price: it.price };
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
  const tbl = (list) => `<table class="totals">${list.map((it) => `<tr><td class="q num">${it.qty}×</td><td>${esc(it.name)}</td></tr>`).join('')}</table>`;
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
      <div class="section-title">Verteilliste</div>
      <div class="list">${active.sort((a, b) => (a.unitName || '').localeCompare(b.unitName || '', 'de') || String(a.spot).localeCompare(String(b.spot), 'de', { numeric: true }))
        .map((o) => `<div class="order"><label class="deliv">
          <input type="checkbox" data-deliv="${esc(o.id)}" ${o.status === 'geliefert' ? 'checked' : ''} aria-label="geliefert">
          <div class="info"><div class="head"><b>${esc(o.unitName || unitName(o.unitId) || '?')}${o.spot ? ` · Platz ${esc(o.spot)}` : ''}</b><span class="num">${money(G.orderTotal(o))}</span></div>
          <div class="items">${esc(G.orderItemsText(o))}</div>
          <small>${esc(o.name)}${o.note ? ` · „${esc(o.note)}“` : ''}</small></div></label></div>`).join('')}</div>
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
    <p class="hint">Tipp: Bei der Abreise einfach die Summe der Unterkunft kassieren und auf „bezahlt“ tippen.</p>`;
}
function bindBilling(v) {
  $$('[data-paid]', v).forEach((b) => (b.onclick = () => {
    const list = orders.filter((o) => o.unitId === b.dataset.paid && o.status !== 'storniert' && !o.paid);
    if (!confirm(`${list.length} Bestellungen (${money(list.reduce((s, o) => s + G.orderTotal(o), 0))}) als bezahlt markieren?`)) return;
    list.forEach((o) => store.updateOrder(o.id, { paid: true, paidAt: Date.now() }));
    toast('Als bezahlt markiert');
  }));
}

// ---------- Gästemappe bearbeiten ----------
const ICON_NAMES = { home: 'Haus', key: 'Schlüssel', wifi: 'WLAN', rules: 'Regeln', recycle: 'Müll', sos: 'Notfall', map: 'Karte', mountain: 'Berge', egg: 'Hof', bread: 'Brot', car: 'Auto', phone: 'Telefon', info: 'Info', book: 'Buch' };
function contentHtml() {
  if (!draft) draft = clone(S());
  return `
    <div class="panel">
      <label class="field"><span>Name eures Hofs</span><input class="input" id="cName" value="${esc(draft.hofName)}"></label>
      <label class="field" style="margin:0"><span>Untertitel</span><input class="input" id="cSub" value="${esc(draft.subtitle)}"></label>
    </div>
    <div class="section-title">Abschnitte</div>
    <p class="hint" style="margin-top:-4px">Formatierung: <b>**fett**</b>, Zeilen mit „- “ werden Aufzählungen, Telefonnummern und Links werden automatisch anklickbar.</p>
    <div id="secList">${draft.sections.map((sec, i) => `<div class="sec-edit">
      <div class="row">
        <select class="input" data-sicon="${i}" style="flex:0 0 112px">${G.SECTION_ICONS.map((k) => `<option value="${k}" ${k === sec.icon ? 'selected' : ''}>${ICON_NAMES[k] || k}</option>`).join('')}</select>
        <input class="input" data-stitle="${i}" value="${esc(sec.title)}" placeholder="Überschrift">
        <div class="tools">
          <button class="icon-btn" data-sup="${i}" aria-label="nach oben" ${i ? '' : 'disabled'}>${ICON.up}</button>
          <button class="icon-btn" data-sdown="${i}" aria-label="nach unten" ${i < draft.sections.length - 1 ? '' : 'disabled'}>${ICON.down}</button>
          <button class="icon-btn" data-sdel="${i}" aria-label="löschen">${ICON.trash}</button>
        </div>
      </div>
      <textarea class="input" data-stext="${i}" rows="6">${esc(sec.text)}</textarea>
    </div>`).join('')}</div>
    <button class="btn" id="cAdd">${ICON.plus} Abschnitt hinzufügen</button>
    <button class="btn primary" id="cSave">Speichern</button>
    <a class="btn" href="${esc(guestUrl(units[0] && units[0].id))}" target="_blank" rel="noopener">Gästeseite ansehen</a>`;
}
function bindContent(v) {
  $('#cName', v).oninput = (e) => { draft.hofName = e.target.value; };
  $('#cSub', v).oninput = (e) => { draft.subtitle = e.target.value; };
  const rer = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };
  $$('[data-stitle]', v).forEach((el) => (el.oninput = () => { draft.sections[+el.dataset.stitle].title = el.value; }));
  $$('[data-stext]', v).forEach((el) => (el.oninput = () => { draft.sections[+el.dataset.stext].text = el.value; }));
  $$('[data-sicon]', v).forEach((el) => (el.onchange = () => { draft.sections[+el.dataset.sicon].icon = el.value; }));
  $$('[data-sup]', v).forEach((b) => (b.onclick = () => { const i = +b.dataset.sup; [draft.sections[i - 1], draft.sections[i]] = [draft.sections[i], draft.sections[i - 1]]; rer(); }));
  $$('[data-sdown]', v).forEach((b) => (b.onclick = () => { const i = +b.dataset.sdown; [draft.sections[i + 1], draft.sections[i]] = [draft.sections[i], draft.sections[i + 1]]; rer(); }));
  $$('[data-sdel]', v).forEach((b) => (b.onclick = () => { const i = +b.dataset.sdel; if (confirm(`Abschnitt „${draft.sections[i].title}“ löschen?`)) { draft.sections.splice(i, 1); rer(); } }));
  $('#cAdd', v).onclick = () => { draft.sections.push({ id: G.uid(6), icon: 'info', title: 'Neuer Abschnitt', text: '' }); rer(); setTimeout(() => { const t = $$('[data-stitle]').pop(); if (t) { t.focus(); t.select(); } }, 50); };
  $('#cSave', v).onclick = () => {
    const merged = { ...S(), hofName: draft.hofName.trim(), subtitle: draft.subtitle.trim(), sections: draft.sections.filter((x) => x.title.trim() || x.text.trim()) };
    store.saveSite(merged); site = merged; draft = null; toast('Gästemappe gespeichert'); render();
  };
}

// ---------- Unterkünfte ----------
function unitsHtml() {
  const list = [...units].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return `
    <div class="list">${list.map((u) => `<button class="edit-row" data-unit="${esc(u.id)}">
      <span class="info"><b>${esc(u.name)}</b><small>${[u.breakfast !== false ? 'Frühstück' : 'kein Frühstück', u.askSpot ? 'fragt Stellplatz' : '', u.wlanName ? 'WLAN' : ''].filter(Boolean).join(' · ')}</small></span>
      ${ICON.chevron}</button>`).join('') || '<div class="empty" style="padding:16px">Noch keine Unterkünfte.</div>'}</div>
    <button class="btn" id="uAdd" style="margin-top:12px">${ICON.plus} Unterkunft hinzufügen</button>
    <button class="btn primary" id="uPrint">${ICON.print} QR-Codes für alle drucken</button>
    <p class="hint">Jede Unterkunft hat einen eigenen QR-Code. Damit wissen wir bei jeder Bestellung, wohin sie geliefert wird, und Gäste sehen das richtige WLAN. Am besten laminiert in die Wohnung hängen.</p>`;
}
function bindUnits(v) {
  $$('[data-unit]', v).forEach((b) => (b.onclick = () => openUnit(units.find((u) => u.id === b.dataset.unit))));
  $('#uAdd', v).onclick = () => openUnit(null);
  $('#uPrint', v).onclick = () => printQr([...units].sort((a, b) => a.name.localeCompare(b.name, 'de')));
}
function openUnit(u) {
  const d = u ? clone(u) : { name: '', breakfast: true, askSpot: false, wlanName: '', wlanPassword: '', note: '' };
  openSheet(u ? u.name : 'Neue Unterkunft', `
    <label class="field"><span>Name</span><input class="input" id="eName" value="${esc(d.name)}" placeholder="z. B. Ferienwohnung Alpenblick"></label>
    <div class="panel">
      <label class="toggle"><span>Frühstücksbestellung möglich</span><input type="checkbox" id="eBf" ${d.breakfast !== false ? 'checked' : ''}></label>
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
      const data = { name, breakfast: $('#eBf', sh).checked, askSpot: $('#eSpot', sh).checked, wlanName: $('#eWn', sh).value.trim(), wlanPassword: $('#eWp', sh).value.trim(), note: $('#eNote', sh).value.trim() };
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
  $('#printArea').innerHTML = list.map((u) => `<div class="qr-card">
    <h3>${esc(s.hofName)}</h3><div class="unit">${esc(u.name)}</div>
    ${qrSvg(guestUrl(u.id))}
    <p><b>Gästemappe${u.breakfast !== false && s.breakfast !== false ? ' & Frühstück bestellen' : ''}</b><br>Mit der Handy-Kamera scannen</p>
    <small>${esc(guestUrl(u.id))}</small></div>`).join('');
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 1000); }, 100);
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
      <label class="field" style="margin:0"><span>Hinweis zur Lieferung</span><input class="input" id="sDeliv" value="${esc(d.deliveryText)}"></label>
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
          <label><input type="checkbox" data-pact="${i}" ${p.active !== false ? 'checked' : ''}>bestellbar</label>
        </div></div>`).join('')}
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
    <div class="section-title">Kontakt für Gäste</div>
    <div class="panel">
      <label class="field"><span>Telefon</span><input class="input" id="sPhone" inputmode="tel" value="${esc(d.phone)}" placeholder="+43 …"></label>
      <label class="field"><span>WhatsApp</span><input class="input" id="sWa" inputmode="tel" value="${esc(d.whatsapp)}" placeholder="+43 …"></label>
      <label class="field" style="margin:0"><span>E-Mail</span><input class="input" id="sMail" type="email" value="${esc(d.email)}"></label>
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
  $$('[data-pgroup]', v).forEach((el) => (el.onchange = () => { d.products[+el.dataset.pgroup].group = el.value; }));
  $$('[data-pact]', v).forEach((el) => (el.onchange = () => { d.products[+el.dataset.pact].active = el.checked; }));
  $$('[data-pdel]', v).forEach((b) => (b.onclick = () => { d.products.splice(+b.dataset.pdel, 1); rer(); }));
  $('#pAdd', v).onclick = () => { d.products.push({ id: G.uid(6), name: '', price: 0, group: 'baecker', active: true }); rer(); };
  const out = $('#sOut', v); if (out) out.onclick = () => store.signOut();
  $('#sSave', v).onclick = () => {
    const merged = {
      ...S(),
      breakfast: $('#sOn', v).checked, cutoffHour: +$('#sCut', v).value, deliveryText: $('#sDeliv', v).value.trim(),
      products: d.products.filter((p) => p.name.trim()).map((p) => ({ ...p, name: p.name.trim(), price: Math.round((p.price || 0) * 100) / 100 })),
      bakeryName: $('#sBName', v).value.trim(), bakeryPhone: $('#sBPhone', v).value.trim(),
      phone: $('#sPhone', v).value.trim(), whatsapp: $('#sWa', v).value.trim(), email: $('#sMail', v).value.trim(),
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
  $('#topTitle').firstChild.textContent = t[1];
  $('#topSub').textContent = S().hofName || '';
  $('#tabbar').innerHTML = TABS.map(([k, label, icon]) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${icon}<span>${label}</span></button>`).join('');
  $$('#tabbar [data-tab]').forEach((b) => (b.onclick = () => {
    if (EDIT_TABS.includes(tab) && b.dataset.tab !== tab) draft = null;
    tab = b.dataset.tab; render(); window.scrollTo(0, 0);
  }));
  if (!loaded.site || !loaded.units) { v.innerHTML = '<div class="center"><div class="spinner"></div></div>'; return; }
  const views = {
    orders: [ordersHtml, bindOrders], billing: [billingHtml, bindBilling], content: [contentHtml, bindContent],
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
  unsubs.push(store.watchOrders(G.addDays(G.today(), -120), (os) => { orders = os; loaded.orders = true; liveRender(); }));
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
