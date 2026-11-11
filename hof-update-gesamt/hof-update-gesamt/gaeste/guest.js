/* Gästeseite: digitale Gästemappe + Frühstücksbestellung (Deutsch, Englisch, Niederländisch) */
(() => {
const { $, $$, esc, ICON, md, money, toast } = G;
const t = (k, v) => G.t(k, v);

let store = null;
let site = G.defaultSite();
let unit = null;          // aktuelle Unterkunft (aus dem QR-Code)
let demoUnits = [];       // nur im Demo-Modus: Auswahl
let myOrders = [];        // eigene Bestellungen dieser Unterkunft
let weather = null;       // Wettervorschau
const params = new URLSearchParams(location.search);
const unitId = params.get('u');
const ORDERS_KEY = () => `gaeste_my_orders_${unitId}`;
const NAME_KEY = 'gaeste_name';
const LANG_KEY = 'gaeste_lang';

const breakfastOn = () => site.breakfast !== false && unit && unit.breakfast !== false && (site.products || []).some((p) => p.active !== false);
const cutoff = () => (Number.isFinite(+site.cutoffHour) ? +site.cutoffHour : 17);
const productById = (id) => (site.products || []).find((p) => p.id === id);
const itemName = (it) => { const p = productById(it.id); return p && p.name === it.name ? G.pname(p) : it.name; };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ---------- Sprache ----------
function currentStay() {
  const today = G.today();
  return ((unit && unit.stays) || []).find((s) => s.from <= today && today <= s.to) || null;
}
function pickLang() {
  const ok = (l) => l && G.LANGS[l];
  const fromUrl = params.get('lang');
  if (ok(fromUrl)) { G.store(LANG_KEY, fromUrl); return fromUrl; }
  const saved = G.store(LANG_KEY);
  if (ok(saved)) return saved;
  const st = currentStay();
  if (st && ok(st.lang)) return st.lang;
  const nav = (navigator.languages || [navigator.language || 'de']).map((l) => String(l).slice(0, 2).toLowerCase());
  const hit = nav.find((l) => ok(l));
  return hit || 'en';
}
function setLang(l) {
  G.lang = l;
  document.documentElement.lang = l;
}
const langSwitch = () => `<div class="lang-switch" role="group" aria-label="${esc(t('language'))}">${Object.keys(G.LANGS).map((l) => `<button data-lang="${l}" class="${l === G.lang ? 'on' : ''}" aria-pressed="${l === G.lang}" title="${esc(G.LANGS[l])}">${l.toUpperCase()}</button>`).join('')}</div>`;

// ---------- Wetter (Open-Meteo, ohne Anmeldung) ----------
const WMO = (c) => (c === 0 ? '☀️' : c <= 2 ? '🌤️' : c === 3 ? '☁️' : c <= 48 ? '🌫️' : c <= 57 ? '🌦️' : c <= 67 ? '🌧️' : c <= 77 ? '❄️' : c <= 82 ? '🌦️' : c <= 86 ? '🌨️' : '⛈️');
async function loadWeather(P) {
  if (!P || P.lat == null || P.lng == null) return;
  const key = `gaeste_wx_${P.lat}_${P.lng}`;
  try {
    const c = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (c && Date.now() - c.at < 3600000) { weather = c.data; return; }
  } catch (e) { /* */ }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${P.lat}&longitude=${P.lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FVienna&forecast_days=3`;
    const r = await fetch(url);
    if (!r.ok) return;
    const j = await r.json();
    const d = j.daily || {};
    weather = (d.time || []).map((day, i) => ({ day, code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], rain: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null }));
    try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data: weather })); } catch (e) { /* */ }
  } catch (e) { /* offline – kein Wetter */ }
}
function weatherHtml() {
  if (!weather || !weather.length) return '';
  return `<section class="card"><h2>${ICON.mountain} ${esc(t('weather'))}</h2><div class="wx">${weather.map((w) => `<div class="wx-day">
    <small>${esc(cap(G.relDay(w.day)) || G.fmtDay(w.day, { weekday: 'short' }))}</small>
    <span class="wx-ico" aria-hidden="true">${WMO(w.code)}</span>
    <b class="num">${Math.round(w.max)}°</b><small class="num">${Math.round(w.min)}°</small>
    ${w.rain != null ? `<small class="wx-rain">${esc(t('rain'))} ${Math.round(w.rain)} %</small>` : ''}</div>`).join('')}</div></section>`;
}

// ---------- Startseite ----------
function homeHtml() {
  const P = unit ? G.propertyOf(site, unit) : null;
  const secs = P ? (P.sections || []) : [];
  let html = P ? `
    <header class="hero">${langSwitch()}
      <small>${esc(G.tr(P, 'subtitle') || t('guestFolder'))}</small>
      <h1>${esc(P.name || t('welcome'))}</h1>
      <span class="chip-unit">${ICON.home}${esc(unit.name)}</span>
    </header>` : `
    <header class="hero">${langSwitch()}
      <small>${esc(t('tagline'))}</small>
      <h1>${esc(site.hofName || t('welcome'))}</h1>
    </header>`;
  if (store && store.mode === 'demo') {
    html += `<div class="demo-banner">Demo-Modus – Bestellungen bleiben nur auf diesem Gerät.
      ${demoUnits.length ? `<br>Unterkunft wählen: ${demoUnits.map((u) => `<a href="?u=${encodeURIComponent(u.id)}">${esc(u.name)}</a>`).join(' · ')}` : ''}</div>`;
  }
  if (!unit && unitId) html += `<div class="warn-box">${esc(t('unitNotFound'))}</div>`;

  // Frühstück
  if (unit && breakfastOn()) {
    const day = G.earliestDelivery(cutoff());
    const dl = G.deadlineFor(day, cutoff());
    const open = myOrders.filter((o) => o.status !== 'storniert' && o.date >= G.today());
    const hasHof = (site.products || []).some((p) => p.active !== false && p.group === 'hof');
    html += `<section class="card breakfast-card">
      <h2>${ICON.bread} ${esc(t('breakfast'))}</h2>
      <p>${esc(t('breakfastIntro'))}${hasHof ? esc(t('breakfastHof')) : ''}.</p>
      ${G.tr(P, 'deliveryText') ? `<p class="muted" style="font-size:15px">${esc(G.tr(P, 'deliveryText'))}</p>` : ''}
      <div class="deadline">${ICON.clock}<span>${t('orderableFor', { day: `<b>${esc(G.fmtDayRel(day))}</b>`, deadline: `<b>${esc(G.fmtDeadline(dl))}</b>`, left: esc(G.countdown(dl - G.now())) })}</span></div>
      <a class="btn warm" href="#bestellen">${ICON.bread} ${esc(t('orderNow'))}</a>
      ${open.length ? `<div class="section-title" style="margin-top:16px">${esc(t('yourOrders'))}</div><div class="list">${open.map(orderHtml).join('')}</div>` : ''}
    </section>`;
  } else if (!unit) {
    html += `<div class="note-box">${esc(t('scanQr', { bf: site.breakfast !== false ? t('scanQrBf') : '' }))}</div>
      <p class="muted">${esc(t('landing'))}</p>
      <div class="section-title">${esc(t('ourPlaces'))}</div>
      <div class="list">${(site.properties || []).map((p) => `<a class="order" style="display:block;text-decoration:none;color:inherit" href="${esc(p.website || '#')}" target="_blank" rel="noopener">
        <div class="head"><b>${esc(p.name)}</b><span>${ICON.chevron}</span></div><small>${esc(G.tr(p, 'subtitle'))}</small></a>`).join('')}</div>`;
  }

  // Bewertung am letzten Tag
  const st = currentStay();
  if (P && P.reviewUrl && st && (G.today() >= G.addDays(st.to, -1))) {
    html += `<section class="card review-card"><h2>${ICON.check} ${esc(t('reviewTitle'))}</h2><p>${esc(t('reviewText'))}</p>
      <a class="btn primary" href="${esc(P.reviewUrl)}" target="_blank" rel="noopener">${esc(t('reviewBtn'))}</a></section>`;
  }

  // WLAN
  if (unit && (unit.wlanName || unit.wlanPassword)) {
    html += `<section class="card"><h2>${ICON.wifi} WLAN / Wi-Fi</h2>
      ${unit.wlanName ? `<div class="wifi-row"><span class="lbl">${esc(t('network'))}</span><span class="val">${esc(unit.wlanName)}</span><button class="copy-btn" data-copy="${esc(unit.wlanName)}" aria-label="${esc(t('network'))}">${ICON.copy}</button></div>` : ''}
      ${unit.wlanPassword ? `<div class="wifi-row"><span class="lbl">${esc(t('password'))}</span><span class="val">${esc(unit.wlanPassword)}</span><button class="copy-btn" data-copy="${esc(unit.wlanPassword)}" aria-label="${esc(t('password'))}">${ICON.copy}</button></div>` : ''}
    </section>`;
  }
  if (unit && unit.note) html += `<div class="note-box">${md(unit.note)}</div>`;
  if (P) html += weatherHtml();

  // Abschnitte
  if (G.lang !== 'de' && secs.some((s) => !s[`text_${G.lang}`])) html += `<p class="hint">${esc(t('notTranslated'))}</p>`;
  html += secs.map((s, i) => `
    <details class="acc" ${i === 0 ? 'open' : ''}>
      <summary><span class="ico">${ICON[s.icon] || ICON.info}</span><span class="t">${esc(G.tr(s, 'title'))}</span><span class="chev">${ICON.chevron}</span></summary>
      <div class="body">${md(G.tr(s, 'text'))}</div>
    </details>`).join('');

  // Kontakt
  const C = P || (site.properties || [])[0] || {};
  const wa = String(C.whatsapp || '').replace(/[^\d]/g, '');
  const tel = String(C.phone || '').replace(/[^\d+]/g, '');
  if (tel || wa || C.email || C.website) {
    html += `<div class="section-title">${esc(t('contact'))}${P ? '' : ' – Familie Herzog'}</div><div class="btn-grid">
      ${tel ? `<a class="btn" href="tel:${esc(tel)}">${ICON.phone}${esc(t('call'))}</a>` : ''}
      ${wa ? `<a class="btn" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">${ICON.chat}WhatsApp</a>` : ''}
      ${C.email ? `<a class="btn" href="mailto:${esc(C.email)}">${ICON.mail}${esc(t('email'))}</a>` : ''}
      ${P && C.website ? `<a class="btn" href="${esc(C.website)}" target="_blank" rel="noopener">${ICON.info}${esc(t('website'))}</a>` : ''}
    </div>`;
  }
  html += `<p class="footer">${esc(t('footer'))}</p>`;
  return html;
}

function orderHtml(o) {
  const canCancel = o.status === 'offen' && G.now() < o.deadline;
  const st = t(`st_${o.status}`);
  return `<div class="order ${esc(o.status)}">
    <div class="head"><b>${esc(G.fmtDayRel(o.date))}</b><span class="badge ${esc(o.status)}">${esc(st)}</span></div>
    <div class="items">${esc(G.orderItemsText(o, itemName))}</div>
    <small>${hasKg(o.items) ? `${esc(t('approx'))} ` : ''}${money(G.orderTotal(o))}${canCancel ? ` · ${esc(t('changeableUntil', { t: G.fmtDeadline(o.deadline) }))}` : ''}</small>
    ${canCancel ? `<div style="margin-top:8px"><button class="btn small danger" data-cancel="${esc(o.id)}">${esc(t('cancel'))}</button></div>` : ''}
  </div>`;
}
const hasKg = (items) => (items || []).some((it) => it.unit === 'kg' && it.qty);

// ---------- Bestellen ----------
let cart = {};
let chosenDay = null;
function orderableDays() {
  const first = G.earliestDelivery(cutoff());
  return Array.from({ length: 5 }, (_, i) => G.addDays(first, i));
}
function productGroups() {
  const prods = (site.products || []).filter((p) => p.active !== false);
  const groups = [];
  prods.forEach((p) => {
    const g0 = p.group || 'baecker';
    const key = g0 === 'baecker' ? `c:${p.cat || ''}` : g0;
    const label = g0 === 'baecker' ? (p.cat ? G.catName(p.cat) : t('g_baecker')) : t(`g_${g0}`);
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, label, group: g0, list: [] }));
    g.list.push(p);
  });
  const rank = { baecker: 0, hof: 1, fleisch: 2 };
  return groups.sort((a, b) => (rank[a.group] ?? 0) - (rank[b.group] ?? 0));
}
function orderViewHtml() {
  const days = orderableDays();
  if (!chosenDay || !days.includes(chosenDay)) chosenDay = days[0];
  const savedName = G.store(NAME_KEY) || '';
  const P = G.propertyOf(site, unit);
  return `
    <div class="topnav"><a class="icon-btn" href="#" aria-label="${esc(t('back'))}">${ICON.back}</a><h1>${esc(t('breakfast'))}</h1></div>
    <div class="note-box">${esc(unit.name)}${G.tr(P, 'deliveryText') ? ` · ${esc(G.tr(P, 'deliveryText'))}` : ''}</div>
    <div class="section-title">${esc(t('forWhichDay'))}</div>
    <div class="days">${days.map((d) => `<button class="day ${d === chosenDay ? 'on' : ''}" data-day="${d}">
      <b>${esc(G.relDay(d) ? cap(G.relDay(d)) : G.fmtDay(d, { weekday: 'long' }))}</b>
      <small>${esc(G.fmtDay(d, { day: 'numeric', month: 'numeric' }))} · ${esc(t('until'))} ${esc(G.fmtDeadline(G.deadlineFor(d, cutoff())))}</small></button>`).join('')}</div>
    ${productGroups().map((g) => `<div class="section-title">${esc(g.label)}</div>
      ${g.group === 'fleisch' ? `<p class="hint" style="margin-top:-4px">${esc(t('meatNote'))}</p>` : ''}
      <div class="list">${g.list.map((p) => {
        const q = cart[p.id] || 0;
        const kg = p.unit === 'kg';
        return `<div class="prod ${q ? 'has' : ''}" data-prod="${esc(p.id)}">
          <div class="info"><b>${esc(G.pname(p))}</b><small>${money(p.price)}${kg ? ` ${esc(t('perKg'))}` : ''}</small></div>
          <div class="stepper"><button data-dec="${esc(p.id)}" aria-label="−" ${q ? '' : 'disabled'}>${ICON.minus}</button>
          <span class="q num" data-q="${esc(p.id)}">${q}${kg ? `<small> ${esc(t('kg'))}</small>` : ''}</span>
          <button data-inc="${esc(p.id)}" aria-label="+">${ICON.plus}</button></div></div>`;
      }).join('')}</div>`).join('')}
    <div class="section-title">${esc(t('yourDetails'))}</div>
    <label class="field"><span>${esc(t('name'))}</span><input class="input" id="oName" value="${esc(savedName)}" autocomplete="name" placeholder="${esc(t('namePh'))}"></label>
    ${unit.askSpot ? `<label class="field"><span>${esc(t('spot'))}</span><input class="input" id="oSpot" inputmode="numeric" autocomplete="off"></label>` : ''}
    <label class="field"><span>${esc(t('note'))}</span><textarea class="input" id="oNote" rows="2" placeholder="${esc(t('notePh'))}"></textarea></label>
    <div id="oErr"></div>
    <div class="sticky-bar"><div class="sum"><span>${esc(t('sum'))}</span><span class="num" id="oSum">${money(0)}</span></div>
      <button class="btn warm" id="oSend" disabled>${esc(t('pickSomething'))}</button></div>`;
}
function bindOrder(root) {
  const prods = site.products || [];
  const update = () => {
    let total = 0; let count = 0; let kg = false;
    prods.forEach((p) => { const q = cart[p.id] || 0; total += q * p.price; count += q; if (q && p.unit === 'kg') kg = true; });
    $('#oSum', root).textContent = `${kg ? `${t('approx')} ` : ''}${money(total)}`;
    const btn = $('#oSend', root);
    btn.disabled = !count;
    btn.textContent = count ? t('orderFor', { day: G.relDay(chosenDay) || G.fmtDay(chosenDay, { weekday: 'long' }) }) : t('pickSomething');
  };
  const setQ = (id, q) => {
    cart[id] = Math.max(0, Math.min(50, q));
    const p = productById(id);
    const row = root.querySelector(`[data-prod="${CSS.escape(id)}"]`);
    row.classList.toggle('has', !!cart[id]);
    row.querySelector('[data-q]').innerHTML = `${cart[id]}${p && p.unit === 'kg' ? `<small> ${esc(t('kg'))}</small>` : ''}`;
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
    if (!name) { toast(t('errName')); $('#oName', root).focus(); return; }
    if (unit.askSpot && !spot) { toast(t('errSpot')); $('#oSpot', root).focus(); return; }
    const deadline = G.deadlineFor(chosenDay, cutoff());
    if (G.now() >= deadline) {
      err.innerHTML = `<div class="err-box">${esc(t('errDeadline', { t: G.fmtDeadline(deadline) }))}</div>`;
      render(); return;
    }
    const items = prods.filter((p) => cart[p.id]).map((p) => {
      const it = { id: p.id, name: p.name, price: p.price, group: p.group || 'baecker', qty: cart[p.id] };
      if (p.unit) it.unit = p.unit;
      return it;
    });
    const note = $('#oNote', root).value.trim();
    const order = { unitId: unit.id, unitName: unit.name, spot, name, date: chosenDay, items,
      note: (G.lang !== 'de' && note ? `[${G.lang.toUpperCase()}] ${note}` : note).slice(0, 500),
      total: Math.round(items.reduce((s, it) => s + it.qty * it.price, 0) * 100) / 100, status: 'offen', deadline };
    const btn = $('#oSend', root);
    btn.disabled = true; btn.textContent = t('sending');
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
      err.innerHTML = `<div class="err-box">${esc(c.includes('permission') ? t('errPermission') : c.includes('timeout') || c.includes('unavailable') ? t('errNet') : t('errGeneric'))}</div>`;
      btn.disabled = false; update();
    }
  };
}

let lastOrder = null;
function thanksHtml() {
  const o = lastOrder;
  if (!o) return homeHtml();
  const P = G.propertyOf(site, unit);
  return `<div class="success"><div class="big">${ICON.check}</div><h1>${esc(t('thanks', { name: o.name }))}</h1>
    <p class="muted">${t('arrived', { day: `<b>${esc(G.fmtDay(o.date))}</b>` })}</p></div>
    <div class="card"><div class="items">${(o.items || []).map((it) => esc(G.itemText(it, itemName(it)))).join('<br>')}</div>
      <p style="margin:10px 0 0"><b>${esc(t('sum'))}: ${hasKg(o.items) ? `${esc(t('approx'))} ` : ''}${money(o.total)}</b></p>
      <p class="muted" style="margin:6px 0 0">${esc(G.tr(P, 'deliveryText'))}</p>
      <p class="muted" style="margin:6px 0 0">${esc(t('canChange', { t: G.fmtDeadline(o.deadline) }))}</p></div>
    <a class="btn primary" href="#">${esc(t('back'))}</a>`;
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
    try { await navigator.clipboard.writeText(b.dataset.copy); toast(t('copied')); }
    catch (e) { toast(b.dataset.copy); }
  }));
  $$('[data-lang]', root).forEach((b) => (b.onclick = () => { setLang(b.dataset.lang); G.store(LANG_KEY, b.dataset.lang); render(); }));
  $$('[data-cancel]', root).forEach((b) => (b.onclick = async () => {
    if (!confirm(t('confirmCancel'))) return;
    try {
      await store.cancelOrder(b.dataset.cancel);
      myOrders = myOrders.map((o) => (o.id === b.dataset.cancel ? { ...o, status: 'storniert' } : o));
      toast(t('cancelled')); render();
    } catch (e) { toast(t('cancelTooLate')); }
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
    $('#root').innerHTML = '<div class="err-box">Die Seite konnte nicht geladen werden. Bitte prüfe deine Internetverbindung. / The page could not be loaded. Please check your internet connection.</div>';
    return;
  }
  try { const s = await store.getSite(); if (s) site = G.mergeSite(s); } catch (e) { /* Standardinhalte */ }
  if (unitId) { try { unit = await store.getUnit(unitId); } catch (e) { unit = null; } }
  setLang(pickLang());
  if (store.mode === 'demo') {
    store.watchUnits((us) => {
      demoUnits = us.sort((a, b) => a.name.localeCompare(b.name, 'de'));
      if (!location.hash || location.hash === '#') render();
    });
  }
  await loadMyOrders();
  document.title = unit ? G.propertyOf(site, unit).name || 'Gästemappe' : (site.hofName || 'Gästemappe');
  if (location.hash === '#danke') location.hash = '';
  render();
  if (unit) loadWeather(G.propertyOf(site, unit)).then(() => { if (weather && location.hash !== '#bestellen') render(); });
  // Countdown und Bestellschluss jede Minute aktualisieren (nicht während man bestellt)
  setInterval(() => { if (location.hash !== '#bestellen') render(); }, 60000);
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && location.hash !== '#bestellen') { await loadMyOrders(); render(); }
  });
}
boot();
})();
