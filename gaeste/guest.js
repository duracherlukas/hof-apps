/* Gästeseite: digitale Gästemappe + Frühstücksbestellung */
(() => {
const { $, $$, esc, ICON, md, money, toast } = G;

let store = null;
let site = G.defaultSite();
let unit = null;          // aktuelle Unterkunft (aus dem QR-Code)
let demoUnits = [];       // nur im Demo-Modus: Auswahl
let myOrders = [];        // eigene Bestellungen dieser Unterkunft
const params = new URLSearchParams(location.search);
const unitId = params.get('u');
const ORDERS_KEY = () => `gaeste_my_orders_${unitId}`;
const NAME_KEY = 'gaeste_name';

const breakfastOn = () => site.breakfast !== false && unit && unit.breakfast !== false && (site.products || []).some((p) => p.active !== false);
const cutoff = () => (Number.isFinite(+site.cutoffHour) ? +site.cutoffHour : 17);

// ---------- Startseite ----------
function homeHtml() {
  const secs = site.sections || [];
  let html = `
    <header class="hero">
      <small>${esc(site.subtitle || 'Eure digitale Gästemappe')}</small>
      <h1>${esc(site.hofName || 'Willkommen')}</h1>
      ${unit ? `<span class="chip-unit">${ICON.home}${esc(unit.name)}</span>` : ''}
    </header>`;
  if (store && store.mode === 'demo') {
    html += `<div class="demo-banner">Demo-Modus – Bestellungen bleiben nur auf diesem Gerät.
      ${demoUnits.length ? `<br>Unterkunft wählen: ${demoUnits.map((u) => `<a href="?u=${encodeURIComponent(u.id)}">${esc(u.name)}</a>`).join(' · ')}` : ''}</div>`;
  }
  if (!unit && unitId) html += '<div class="warn-box">Diese Unterkunft wurde nicht gefunden. Bitte scannt den QR-Code in eurer Unterkunft noch einmal.</div>';

  // Frühstück
  if (unit && breakfastOn()) {
    const day = G.earliestDelivery(cutoff());
    const dl = G.deadlineFor(day, cutoff());
    const open = myOrders.filter((o) => o.status !== 'storniert' && o.date >= G.today());
    html += `<section class="card breakfast-card">
      <h2>${ICON.bread} Frühstück bestellen</h2>
      <p>Frisches Gebäck vom Bäcker und Produkte von unserem Hof – direkt zu eurer Unterkunft.</p>
      <div class="deadline">${ICON.clock}<span>Für <b>${esc(G.fmtDayRel(day))}</b> bestellbar bis <b>${esc(G.fmtDeadline(dl))}</b> (noch ${G.countdown(dl - G.now())})</span></div>
      <a class="btn warm" href="#bestellen">${ICON.bread} Jetzt bestellen</a>
      ${open.length ? `<div class="section-title" style="margin-top:16px">Eure Bestellungen</div><div class="list">${open.map(orderHtml).join('')}</div>` : ''}
    </section>`;
  } else if (!unit && site.breakfast !== false) {
    html += `<section class="card breakfast-card"><h2>${ICON.bread} Frühstück bestellen</h2>
      <p class="muted">Scannt den QR-Code in eurer Unterkunft, um Frühstück zu bestellen.</p></section>`;
  }

  // WLAN
  if (unit && (unit.wlanName || unit.wlanPassword)) {
    html += `<section class="card"><h2>${ICON.wifi} WLAN</h2>
      ${unit.wlanName ? `<div class="wifi-row"><span class="lbl">Netzwerk</span><span class="val">${esc(unit.wlanName)}</span><button class="copy-btn" data-copy="${esc(unit.wlanName)}" aria-label="Netzwerkname kopieren">${ICON.copy}</button></div>` : ''}
      ${unit.wlanPassword ? `<div class="wifi-row"><span class="lbl">Passwort</span><span class="val">${esc(unit.wlanPassword)}</span><button class="copy-btn" data-copy="${esc(unit.wlanPassword)}" aria-label="Passwort kopieren">${ICON.copy}</button></div>` : ''}
    </section>`;
  }
  if (unit && unit.note) html += `<div class="note-box">${md(unit.note)}</div>`;

  // Abschnitte
  html += secs.map((s, i) => `
    <details class="acc" ${i === 0 ? 'open' : ''}>
      <summary><span class="ico">${ICON[s.icon] || ICON.info}</span><span class="t">${esc(s.title)}</span><span class="chev">${ICON.chevron}</span></summary>
      <div class="body">${md(s.text)}</div>
    </details>`).join('');

  // Kontakt
  const wa = String(site.whatsapp || '').replace(/[^\d]/g, '');
  const tel = String(site.phone || '').replace(/[^\d+]/g, '');
  if (tel || wa || site.email) {
    html += `<div class="section-title">Kontakt</div><div class="btn-grid">
      ${tel ? `<a class="btn" href="tel:${esc(tel)}">${ICON.phone}Anrufen</a>` : ''}
      ${wa ? `<a class="btn" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">${ICON.chat}WhatsApp</a>` : ''}
      ${site.email ? `<a class="btn" href="mailto:${esc(site.email)}">${ICON.mail}E-Mail</a>` : ''}
    </div>`;
  }
  html += `<p class="footer">Wir wünschen euch einen schönen Aufenthalt!</p>`;
  return html;
}

function orderHtml(o) {
  const canCancel = o.status === 'offen' && G.now() < o.deadline;
  const st = { offen: 'bestellt', geliefert: 'geliefert', storniert: 'storniert' }[o.status] || o.status;
  return `<div class="order ${esc(o.status)}">
    <div class="head"><b>${esc(G.fmtDayRel(o.date))}</b><span class="badge ${esc(o.status)}">${esc(st)}</span></div>
    <div class="items">${esc(G.orderItemsText(o))}</div>
    <small>${money(G.orderTotal(o))}${canCancel ? ` · änderbar bis ${esc(G.fmtDeadline(o.deadline))}` : ''}</small>
    ${canCancel ? `<div style="margin-top:8px"><button class="btn small danger" data-cancel="${esc(o.id)}">Stornieren</button></div>` : ''}
  </div>`;
}

// ---------- Bestellen ----------
let cart = {};
let chosenDay = null;
function orderableDays() {
  const first = G.earliestDelivery(cutoff());
  return Array.from({ length: 5 }, (_, i) => G.addDays(first, i));
}
function orderViewHtml() {
  const days = orderableDays();
  if (!chosenDay || !days.includes(chosenDay)) chosenDay = days[0];
  const prods = (site.products || []).filter((p) => p.active !== false);
  const groups = [['baecker', 'Vom Bäcker'], ['hof', 'Vom Hof']];
  const savedName = G.store(NAME_KEY) || '';
  return `
    <div class="topnav"><a class="icon-btn" href="#" aria-label="Zurück">${ICON.back}</a><h1>Frühstück bestellen</h1></div>
    <div class="note-box">${esc(unit.name)} · ${esc(site.deliveryText || '')}</div>
    <div class="section-title">Für welchen Tag?</div>
    <div class="days">${days.map((d) => `<button class="day ${d === chosenDay ? 'on' : ''}" data-day="${d}">
      <b>${esc(G.relDay(d) ? G.relDay(d)[0].toUpperCase() + G.relDay(d).slice(1) : G.fmtDay(d, { weekday: 'long' }))}</b>
      <small>${esc(G.fmtDay(d, { day: 'numeric', month: 'numeric' }))} · bis ${esc(G.fmtDeadline(G.deadlineFor(d, cutoff())).replace(' um ', ', '))}</small></button>`).join('')}</div>
    ${groups.map(([g, label]) => {
      const list = prods.filter((p) => (p.group || 'baecker') === g);
      if (!list.length) return '';
      return `<div class="section-title">${label}</div><div class="list">${list.map((p) => {
        const q = cart[p.id] || 0;
        return `<div class="prod ${q ? 'has' : ''}" data-prod="${esc(p.id)}">
          <div class="info"><b>${esc(p.name)}</b><small>${money(p.price)}</small></div>
          <div class="stepper"><button data-dec="${esc(p.id)}" aria-label="weniger" ${q ? '' : 'disabled'}>${ICON.minus}</button>
          <span class="q num" data-q="${esc(p.id)}">${q}</span>
          <button data-inc="${esc(p.id)}" aria-label="mehr">${ICON.plus}</button></div></div>`;
      }).join('')}</div>`;
    }).join('')}
    <div class="section-title">Eure Angaben</div>
    <label class="field"><span>Name</span><input class="input" id="oName" value="${esc(savedName)}" autocomplete="name" placeholder="z. B. Familie Huber"></label>
    ${unit.askSpot ? '<label class="field"><span>Stellplatz-Nummer</span><input class="input" id="oSpot" inputmode="numeric" autocomplete="off"></label>' : ''}
    <label class="field"><span>Anmerkung (optional)</span><textarea class="input" id="oNote" rows="2" placeholder="z. B. Allergien, Wunschzeit"></textarea></label>
    <div id="oErr"></div>
    <div class="sticky-bar"><div class="sum"><span>Summe</span><span class="num" id="oSum">${money(0)}</span></div>
      <button class="btn warm" id="oSend" disabled>Bestellen</button></div>`;
}
function bindOrder(root) {
  const prods = site.products || [];
  const update = () => {
    let total = 0; let count = 0;
    prods.forEach((p) => { const q = cart[p.id] || 0; total += q * p.price; count += q; });
    $('#oSum', root).textContent = money(total);
    const btn = $('#oSend', root);
    btn.disabled = !count;
    btn.textContent = count ? `Für ${G.relDay(chosenDay) || G.fmtDay(chosenDay, { weekday: 'long' })} bestellen` : 'Bitte etwas auswählen';
  };
  const setQ = (id, q) => {
    cart[id] = Math.max(0, Math.min(50, q));
    const row = root.querySelector(`[data-prod="${CSS.escape(id)}"]`);
    row.classList.toggle('has', !!cart[id]);
    row.querySelector('[data-q]').textContent = cart[id];
    row.querySelector('[data-dec]').disabled = !cart[id];
    update();
  };
  $$('[data-inc]', root).forEach((b) => (b.onclick = () => setQ(b.dataset.inc, (cart[b.dataset.inc] || 0) + 1)));
  $$('[data-dec]', root).forEach((b) => (b.onclick = () => setQ(b.dataset.dec, (cart[b.dataset.dec] || 0) - 1)));
  $$('[data-day]', root).forEach((b) => (b.onclick = () => {
    chosenDay = b.dataset.day;
    $$('[data-day]', root).forEach((x) => x.classList.toggle('on', x === b));
    update();
  }));
  update();
  $('#oSend', root).onclick = async () => {
    const err = $('#oErr', root);
    err.innerHTML = '';
    const name = $('#oName', root).value.trim();
    const spot = unit.askSpot ? $('#oSpot', root).value.trim() : '';
    if (!name) { toast('Bitte gebt euren Namen an'); $('#oName', root).focus(); return; }
    if (unit.askSpot && !spot) { toast('Bitte die Stellplatz-Nummer angeben'); $('#oSpot', root).focus(); return; }
    const deadline = G.deadlineFor(chosenDay, cutoff());
    if (G.now() >= deadline) {
      err.innerHTML = `<div class="err-box">Der Bestellschluss für diesen Tag (${esc(G.fmtDeadline(deadline))}) ist leider vorbei. Bitte wählt einen anderen Tag.</div>`;
      render(); return;
    }
    const items = prods.filter((p) => cart[p.id]).map((p) => ({ id: p.id, name: p.name, price: p.price, group: p.group || 'baecker', qty: cart[p.id] }));
    const order = { unitId: unit.id, unitName: unit.name, spot, name, date: chosenDay, items, note: $('#oNote', root).value.trim().slice(0, 500),
      total: Math.round(items.reduce((s, it) => s + it.qty * it.price, 0) * 100) / 100, status: 'offen', deadline };
    const btn = $('#oSend', root);
    btn.disabled = true; btn.textContent = 'Wird gesendet …';
    try {
      const id = await store.createOrder(order);
      G.store(NAME_KEY, name);
      const ids = G.store(ORDERS_KEY()) || [];
      G.store(ORDERS_KEY(), [id, ...ids].slice(0, 40));
      myOrders = [{ ...order, id }, ...myOrders].sort((a, b) => a.date.localeCompare(b.date));
      cart = {};
      lastOrder = { ...order, id };
      location.hash = '#danke';
    } catch (e) {
      const c = String((e && e.code) || '');
      err.innerHTML = `<div class="err-box">${c.includes('permission') ? 'Die Bestellung wurde nicht angenommen – vermutlich ist der Bestellschluss vorbei. Bitte wählt einen anderen Tag.'
        : c.includes('timeout') || c.includes('unavailable') ? 'Keine Verbindung. Bitte prüft euer Internet und versucht es nochmal.'
          : 'Das hat leider nicht geklappt. Bitte versucht es nochmal oder ruft uns an.'}</div>`;
      btn.disabled = false; update();
    }
  };
}

let lastOrder = null;
function thanksHtml() {
  const o = lastOrder;
  if (!o) return homeHtml();
  return `<div class="success"><div class="big">${ICON.check}</div><h1>Danke, ${esc(o.name)}!</h1>
    <p class="muted">Eure Bestellung für <b>${esc(G.fmtDay(o.date))}</b> ist bei uns angekommen.</p></div>
    <div class="card"><div class="items">${(o.items || []).map((it) => `${it.qty} × ${esc(it.name)}`).join('<br>')}</div>
      <p style="margin:10px 0 0"><b>Summe: ${money(o.total)}</b></p>
      <p class="muted" style="margin:6px 0 0">${esc(site.deliveryText || '')}</p>
      <p class="muted" style="margin:6px 0 0">Ändern oder stornieren könnt ihr bis ${esc(G.fmtDeadline(o.deadline))}.</p></div>
    <a class="btn primary" href="#">Zurück zur Gästemappe</a>`;
}

// ---------- Rendering ----------
function render() {
  const root = $('#root');
  const route = location.hash.replace('#', '');
  if (route === 'bestellen' && unit && breakfastOn()) { root.innerHTML = orderViewHtml(); bindOrder(root); }
  else if (route === 'danke') root.innerHTML = thanksHtml();
  else root.innerHTML = homeHtml();
  bindCommon(root);
}
function bindCommon(root) {
  $$('[data-copy]', root).forEach((b) => (b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Kopiert'); }
    catch (e) { toast(b.dataset.copy); }
  }));
  $$('[data-cancel]', root).forEach((b) => (b.onclick = async () => {
    if (!confirm('Diese Bestellung wirklich stornieren?')) return;
    try {
      await store.cancelOrder(b.dataset.cancel);
      myOrders = myOrders.map((o) => (o.id === b.dataset.cancel ? { ...o, status: 'storniert' } : o));
      toast('Bestellung storniert'); render();
    } catch (e) { toast('Stornieren nicht mehr möglich – der Bestellschluss ist vorbei.'); }
  }));
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

async function loadMyOrders() {
  if (!unitId) return;
  const ids = G.store(ORDERS_KEY()) || [];
  const res = await Promise.all(ids.map((id) => store.getOrder(id).catch(() => null)));
  const keepFrom = G.addDays(G.today(), -14);
  myOrders = res.filter((o) => o && o.date >= keepFrom).sort((a, b) => a.date.localeCompare(b.date));
  G.store(ORDERS_KEY(), myOrders.map((o) => o.id));
}

async function boot() {
  try {
    store = await G.createStore(window.GAESTE_CONFIG);
  } catch (e) {
    $('#root').innerHTML = '<div class="err-box">Die Seite konnte nicht geladen werden. Bitte prüfe deine Internetverbindung.</div>';
    return;
  }
  try { const s = await store.getSite(); if (s) site = G.mergeSite(s); } catch (e) { /* Standardinhalte */ }
  if (unitId) { try { unit = await store.getUnit(unitId); } catch (e) { unit = null; } }
  if (store.mode === 'demo') {
    store.watchUnits((us) => {
      demoUnits = us.sort((a, b) => a.name.localeCompare(b.name, 'de'));
      if (!location.hash || location.hash === '#') render();
    });
  }
  await loadMyOrders();
  if (site.hofName) document.title = site.hofName;
  if (location.hash === '#danke') location.hash = '';
  render();
  // Countdown und Bestellschluss jede Minute aktualisieren (nicht während man bestellt)
  setInterval(() => { if (location.hash !== '#bestellen') render(); }, 60000);
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && location.hash !== '#bestellen') { await loadMyOrders(); render(); }
  });
}
boot();
})();
