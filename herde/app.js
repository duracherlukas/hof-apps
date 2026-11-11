/* Herdenbuch: Rinder mit Ohrmarke, Belegung, Abkalbung, Behandlungen mit Wartezeit */
(() => {
const H = window.HOF;
const { $, $$, esc, num, fmt, isoDay, addDays, daysBetween, fmtDate, toast } = H;
const CFG = window.HOF_CONFIG || {};
const VERSION = '1.0';
const TRAG = 283; // Trächtigkeitsdauer Rind (Tage, Richtwert)

const I = {
  cow: '<svg viewBox="0 0 24 24"><path d="M5 8c-2 0-3-2-3-3 1 0 2 .5 3 1M19 8c2 0 3-2 3-3-1 0-2 .5-3 1"/><path d="M6 7h12l-1 7c0 3-2 6-5 6s-5-3-5-6z"/><circle cx="10" cy="12" r=".6"/><circle cx="14" cy="12" r=".6"/><path d="M10 17h4"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>',
  baby: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M5 21c1-4 4-6 7-6s6 2 7 6"/></svg>',
  pill: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M9 9l6 6"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
};
const EV = {
  belegung: { label: 'Belegung', icon: I.heart, onlyW: true },
  tu: { label: 'Trächtigkeit geprüft', icon: I.heart, onlyW: true },
  abkalbung: { label: 'Abkalbung', icon: I.baby, onlyW: true },
  behandlung: { label: 'Behandlung', icon: I.pill },
  impfung: { label: 'Impfung', icon: I.pill },
  klauen: { label: 'Klauenpflege', icon: I.more },
  wiegen: { label: 'Gewogen', icon: I.more },
  sonstiges: { label: 'Sonstiges', icon: I.more },
};
const BREEDS = ['Fleckvieh', 'Pinzgauer', 'Murbodner', 'Tiroler Grauvieh', 'Braunvieh', 'Holstein', 'Angus', 'Limousin', 'Charolais', 'Highland', 'Kreuzung'];
const STATUS = { aktiv: 'im Bestand', verkauft: 'verkauft', geschlachtet: 'geschlachtet', verendet: 'verendet' };

let animals = [];
let events = [];
let tab = 'home';
let filter = 'alle';
let query = '';

const byId = (id) => animals.find((a) => a.id === id);
const evOf = (id) => events.filter((e) => e.animalId === id).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
const active = () => animals.filter((a) => (a.status || 'aktiv') === 'aktiv');
const label = (a) => (a ? [a.name, a.ear].filter(Boolean).join(' · ') || 'Ohne Namen' : '?');
const shortEar = (ear) => String(ear || '').replace(/\s/g, '').slice(-5);
const ageMonths = (a) => (a.birth ? Math.floor(daysBetween(a.birth, isoDay()) / 30.44) : null);
const ageText = (a) => { const m = ageMonths(a); if (m == null) return ''; return m < 24 ? `${m} Mon.` : `${Math.floor(m / 12)} J.`; };
const calvings = (a) => events.filter((e) => e.animalId === a.id && e.type === 'abkalbung');
function category(a) {
  const m = ageMonths(a);
  if (m != null && m < 8) return 'kalb';
  if (a.sex === 'm') return 'stier';
  if (calvings(a).length || animals.some((x) => x.motherId === a.id) || (m != null && m >= 30)) return 'kuh';
  return 'kalbin';
}
const CAT_LABEL = { kuh: 'Kuh', kalbin: 'Kalbin', kalb: 'Kalb', stier: 'Stier' };
// Trächtigkeit: letzte Belegung nach der letzten Abkalbung, nicht als leer geprüft
function pregnancy(a) {
  const ev = evOf(a.id);
  const lastCalf = ev.find((e) => e.type === 'abkalbung');
  const lastBel = ev.find((e) => e.type === 'belegung' && (!lastCalf || e.date > lastCalf.date));
  if (!lastBel) return null;
  const tu = ev.find((e) => e.type === 'tu' && e.date >= lastBel.date);
  if (tu && tu.result === 'leer') return null;
  const due = addDays(lastBel.date, TRAG);
  return { since: lastBel.date, due, confirmed: !!(tu && tu.result === 'traechtig'), bull: lastBel.bull || '', daysLeft: daysBetween(isoDay(), due) };
}
// Wartezeit (Fleisch) aus Behandlungen
function withdrawal(a) {
  const t = isoDay();
  const list = events.filter((e) => e.animalId === a.id && (e.type === 'behandlung' || e.type === 'impfung') && e.waitUntil && e.waitUntil >= t);
  if (!list.length) return null;
  return list.sort((x, y) => y.waitUntil.localeCompare(x.waitUntil))[0];
}

// ---------- Ansichten ----------
function render() {
  $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
  const v = $('#view');
  v.innerHTML = tab === 'home' ? homeHtml() : tab === 'tiere' ? listHtml() : tab === 'termine' ? termHtml() : histHtml();
  bind(v);
}
function animalRow(a, extra) {
  const c = category(a);
  const p = a.sex !== 'm' ? pregnancy(a) : null; const w = withdrawal(a);
  const badges = [p ? `<span class="badge ${p.daysLeft <= 14 ? 'warn' : 'ok'}">${p.daysLeft < 0 ? 'Abkalbung überfällig' : `kalbt in ${p.daysLeft} T.`}</span>` : '', w ? `<span class="badge bad">Wartezeit bis ${fmtDate(w.waitUntil, { day: '2-digit', month: '2-digit' })}</span>` : '', (a.status || 'aktiv') !== 'aktiv' ? `<span class="badge">${STATUS[a.status]}</span>` : ''].filter(Boolean).join('');
  return `<button class="list-item" data-animal="${esc(a.id)}">
    <span class="ico ${c === 'kalb' ? 'ok' : ''}">${c === 'kalb' ? I.baby : I.cow}</span>
    <span class="info"><span class="name">${esc(a.name || shortEar(a.ear) || 'Ohne Namen')}${a.name && a.ear ? ` <small style="display:inline">· ${esc(shortEar(a.ear))}</small>` : ''}</span>
      <small>${esc([CAT_LABEL[c], a.breed, ageText(a), extra].filter(Boolean).join(' · '))}</small>${badges ? `<span class="badges">${badges}</span>` : ''}</span></button>`;
}
function homeHtml() {
  if (!animals.length) {
    return `<div class="card"><h2>Willkommen im Herdenbuch!</h2><p class="muted" style="margin-top:0">Leg zuerst deine Tiere an – mit Ohrmarke, Geburtsdatum und Mutter. Danach trägst du Belegungen, Abkalbungen und Behandlungen ein. Die App rechnet Abkalbetermine und Wartezeiten aus.</p>
      <button class="btn primary" data-act="newAnimal">${I.plus} Erstes Tier anlegen</button></div>`;
  }
  const act = active();
  const cnt = (c) => act.filter((a) => category(a) === c).length;
  const soon = act.filter((a) => a.sex !== 'm').map((a) => ({ a, p: pregnancy(a) })).filter((x) => x.p && x.p.daysLeft <= 30).sort((x, y) => x.p.daysLeft - y.p.daysLeft);
  const waits = act.map((a) => ({ a, w: withdrawal(a) })).filter((x) => x.w);
  const recent = [...events].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
  return `
    <div class="stats">
      <div class="stat"><b class="num">${act.length}</b><small>Tiere</small></div>
      <div class="stat"><b class="num">${cnt('kuh')}</b><small>Kühe</small></div>
      <div class="stat"><b class="num">${cnt('kalb')}</b><small>Kälber</small></div>
    </div>
    <div class="section-title">Abkalbungen in den nächsten 30 Tagen</div>
    ${soon.length ? `<div class="list">${soon.map((x) => animalRow(x.a, `Termin ${fmtDate(x.p.due, { day: '2-digit', month: '2-digit' })}`)).join('')}</div>` : '<div class="list"><div class="list-item"><span class="info"><small class="wrap">Keine Abkalbung in den nächsten 30 Tagen erwartet.</small></span></div></div>'}
    <div class="section-title">Laufende Wartezeiten</div>
    ${waits.length ? `<div class="list">${waits.map((x) => animalRow(x.a, `${x.w.drug || 'Behandlung'}`)).join('')}</div>` : '<div class="list"><div class="list-item"><span class="info"><small class="wrap">Kein Tier hat gerade eine Wartezeit.</small></span></div></div>'}
    <div class="section-title">Zuletzt eingetragen</div>
    ${recent.length ? `<div class="list">${recent.map(eventRow).join('')}</div>` : '<div class="empty">Noch keine Einträge.</div>'}`;
}
function eventText(e) {
  if (e.type === 'belegung') return [e.method, e.bull].filter(Boolean).join(' · ');
  if (e.type === 'tu') return e.result === 'traechtig' ? 'trächtig' : e.result === 'leer' ? 'leer' : '';
  if (e.type === 'abkalbung') return [e.calfSex === 'm' ? 'Stierkalb' : e.calfSex === 'w' ? 'Kuhkalb' : '', e.calfEar, e.course].filter(Boolean).join(' · ');
  if (e.type === 'behandlung' || e.type === 'impfung') return [e.drug, e.reason, e.waitUntil ? `Wartezeit bis ${fmtDate(e.waitUntil)}` : ''].filter(Boolean).join(' · ');
  if (e.type === 'wiegen') return e.weight ? `${fmt(e.weight)} kg` : '';
  return '';
}
function eventRow(e, showAnimal = true) {
  const a = byId(e.animalId);
  return `<button class="list-item" data-event="${esc(e.id)}"><span class="ico">${(EV[e.type] || EV.sonstiges).icon}</span>
    <span class="info"><span class="name">${esc((EV[e.type] || EV.sonstiges).label)}${showAnimal ? ` – ${esc(a ? a.name || shortEar(a.ear) : '?')}` : ''}</span>
    <small class="wrap">${esc([fmtDate(e.date), eventText(e), e.note, e.by].filter(Boolean).join(' · '))}</small></span></button>`;
}
function listHtml() {
  const q = query.toLowerCase();
  let list = filter === 'abgang' ? animals.filter((a) => (a.status || 'aktiv') !== 'aktiv') : active();
  if (!['alle', 'abgang'].includes(filter)) list = list.filter((a) => category(a) === filter);
  if (q) list = list.filter((a) => `${a.name} ${a.ear} ${a.breed}`.toLowerCase().includes(q));
  list.sort((a, b) => (a.name || a.ear || '').localeCompare(b.name || b.ear || '', 'de'));
  return `<button class="btn primary" data-act="newAnimal" style="margin-bottom:12px">${I.plus} Tier anlegen</button>
    <input class="input" id="q" type="search" placeholder="Name oder Ohrmarke suchen …" value="${esc(query)}" style="margin-bottom:10px">
    <div class="seg">${[['alle', 'Alle'], ['kuh', 'Kühe'], ['kalbin', 'Kalbinnen'], ['kalb', 'Kälber'], ['stier', 'Stiere'], ['abgang', 'Abgänge']].map(([k, l]) => `<button data-filter="${k}" class="${k === filter ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="list">${list.map((a) => animalRow(a)).join('')}</div>` : '<div class="empty">Keine Tiere gefunden.</div>'}
    <button class="btn" data-act="csvAnimals" style="margin-top:14px">${I.down} Bestandsliste (Excel)</button>`;
}
function termHtml() {
  const preg = active().filter((a) => a.sex !== 'm').map((a) => ({ a, p: pregnancy(a) })).filter((x) => x.p).sort((x, y) => x.p.due.localeCompare(y.p.due));
  const open = active().filter((a) => a.sex !== 'm' && ['kuh', 'kalbin'].includes(category(a)) && !pregnancy(a));
  return `<div class="section-title">Trächtige Tiere (${preg.length})</div>
    ${preg.length ? `<div class="list">${preg.map((x) => animalRow(x.a, `${x.p.confirmed ? 'bestätigt' : 'belegt'} ${fmtDate(x.p.since, { day: '2-digit', month: '2-digit' })} → kalbt ca. ${fmtDate(x.p.due)}`)).join('')}</div>` : '<div class="empty">Keine Belegungen eingetragen.</div>'}
    <p class="hint">Abkalbetermin = Belegung + ${TRAG} Tage (Richtwert).</p>
    <div class="section-title">Nicht belegt (${open.length})</div>
    ${open.length ? `<div class="list">${open.map((a) => { const lc = calvings(a).sort((x, y) => y.date.localeCompare(x.date))[0]; return animalRow(a, lc ? `abgekalbt vor ${daysBetween(lc.date, isoDay())} T.` : ''); }).join('')}</div>` : '<div class="empty">Alle Kühe und Kalbinnen sind belegt.</div>'}`;
}
function histHtml() {
  const list = [...events].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
  return `<button class="btn" data-act="csvTreat" style="margin-bottom:12px">${I.down} Behandlungen & Impfungen (Excel)</button>
    ${list.length ? `<div class="list">${list.slice(0, 200).map((e) => eventRow(e)).join('')}</div>` : '<div class="empty">Noch keine Einträge.</div>'}`;
}
function bind(v) {
  $$('[data-act="newAnimal"]', v).forEach((b) => (b.onclick = () => H.openSheet(viewAnimalForm(null))));
  $$('[data-animal]', v).forEach((b) => (b.onclick = () => H.openSheet(viewAnimal(b.dataset.animal))));
  $$('[data-event]', v).forEach((b) => (b.onclick = () => { const e = events.find((x) => x.id === b.dataset.event); if (e) H.openSheet(viewEventForm({ event: e })); }));
  $$('[data-filter]', v).forEach((b) => (b.onclick = () => { filter = b.dataset.filter; render(); }));
  const q = $('#q', v); if (q) q.oninput = (e) => { query = e.target.value; const pos = e.target.selectionStart; render(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  const ca = $('[data-act="csvAnimals"]', v); if (ca) ca.onclick = exportAnimals;
  const ct = $('[data-act="csvTreat"]', v); if (ct) ct.onclick = exportTreatments;
}

// ---------- Tier ----------
function viewAnimal(id) {
  const view = () => {
    const a = byId(id);
    if (!a) return { title: 'Tier', live: true, html: '<div class="empty">Dieses Tier gibt es nicht mehr.</div>' };
    const c = category(a); const p = a.sex !== 'm' ? pregnancy(a) : null; const w = withdrawal(a);
    const mother = byId(a.motherId);
    const kids = animals.filter((x) => x.motherId === a.id).sort((x, y) => (y.birth || '').localeCompare(x.birth || ''));
    const rows = [['Ohrmarke', a.ear || '–'], ['Geschlecht', a.sex === 'm' ? 'männlich' : 'weiblich'], ['Rasse', a.breed || '–'], ['Geboren', a.birth ? `${fmtDate(a.birth)} (${ageText(a)})` : '–'],
      ['Mutter', mother ? label(mother) : a.motherEar || '–'], ['Vater', a.father || '–'], ['Status', STATUS[a.status || 'aktiv'] + (a.leftDate ? ` am ${fmtDate(a.leftDate)}` : '')]];
    return {
      title: a.name || shortEar(a.ear) || 'Tier', tall: true, live: true,
      html: `
        <div class="detail-head"><span class="ico">${c === 'kalb' ? I.baby : I.cow}</span><div><h3>${esc(a.name || a.ear || 'Ohne Namen')}</h3><small>${esc([CAT_LABEL[c], a.breed, ageText(a)].filter(Boolean).join(' · '))}</small></div></div>
        ${p ? `<div class="note-box">${p.daysLeft < 0 ? `⚠️ Abkalbung seit ${-p.daysLeft} Tagen überfällig` : `🐮 ${p.confirmed ? 'Trächtig' : 'Belegt'} – kalbt ca. am <b>${fmtDate(p.due)}</b> (in ${p.daysLeft} Tagen)`}${p.bull ? ` · ${esc(p.bull)}` : ''}</div>` : ''}
        ${w ? `<div class="err-box">💊 Wartezeit bis <b>${fmtDate(w.waitUntil)}</b> – ${esc(w.drug || 'Behandlung')}. Nicht schlachten!</div>` : ''}
        <div class="btn-row">
          ${a.sex !== 'm' ? `<button class="btn" data-new="belegung">${I.heart}Belegung</button><button class="btn" data-new="abkalbung">${I.baby}Abkalbung</button>` : ''}
          <button class="btn" data-new="behandlung">${I.pill}Behandlung</button>
          ${a.sex === 'm' ? `<button class="btn" data-new="wiegen">${I.more}Gewogen</button><button class="btn" data-new="sonstiges">${I.more}Sonstiges</button>` : ''}
        </div>
        <div class="panel"><dl class="kv" style="margin:0">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>
        ${a.note ? `<div class="note-box">${esc(a.note)}</div>` : ''}
        ${kids.length ? `<div class="section-title">Nachkommen (${kids.length})</div><div class="list">${kids.map((k) => animalRow(k)).join('')}</div>` : ''}
        <div class="section-title">Einträge</div>
        <div class="seg">${Object.entries(EV).filter(([, d]) => !d.onlyW || a.sex !== 'm').map(([k, d]) => `<button data-new="${k}">+ ${d.label}</button>`).join('')}</div>
        ${evOf(a.id).length ? `<div class="list">${evOf(a.id).map((e) => eventRow(e, false)).join('')}</div>` : '<div class="empty">Noch keine Einträge für dieses Tier.</div>'}
        <button class="btn" id="aEdit" style="margin-top:16px">${I.edit} Tier bearbeiten / Abgang</button>`,
      mount(body) {
        $$('[data-new]', body).forEach((b) => (b.onclick = () => H.pushView(viewEventForm({ animalId: id, type: b.dataset.new }))));
        $$('[data-event]', body).forEach((b) => (b.onclick = () => { const e = events.find((x) => x.id === b.dataset.event); if (e) H.pushView(viewEventForm({ event: e })); }));
        $$('[data-animal]', body).forEach((b) => (b.onclick = () => H.pushView(viewAnimal(b.dataset.animal))));
        $('#aEdit', body).onclick = () => H.pushView(viewAnimalForm(id));
      },
    };
  };
  return view;
}
function viewAnimalForm(id, preset = {}) {
  return () => {
    const a = id ? byId(id) : { sex: 'w', status: 'aktiv', ...preset };
    const moms = active().filter((x) => x.sex !== 'm' && x.id !== id && ['kuh', 'kalbin'].includes(category(x))).sort((x, y) => (x.name || x.ear || '').localeCompare(y.name || y.ear || '', 'de'));
    let sex = a.sex || 'w';
    return {
      title: id ? 'Tier bearbeiten' : 'Neues Tier', tall: true,
      html: `
        <div class="grid2">
          <label class="field"><span>Ohrmarke</span><input class="input" id="fEar" value="${esc(a.ear || '')}" placeholder="AT 123 456 789" autocomplete="off"></label>
          <label class="field"><span>Name</span><input class="input" id="fName" value="${esc(a.name || '')}" autocomplete="off"></label>
        </div>
        <div class="seg" id="fSex"><button data-sex="w">♀ weiblich</button><button data-sex="m">♂ männlich</button></div>
        <div class="grid2">
          <label class="field"><span>Rasse</span><input class="input" id="fBreed" list="breeds" value="${esc(a.breed || '')}"><datalist id="breeds">${BREEDS.map((b) => `<option value="${b}">`).join('')}</datalist></label>
          <label class="field"><span>Geboren</span><input class="input" id="fBirth" type="date" value="${esc(a.birth || '')}"></label>
        </div>
        <label class="field"><span>Mutter</span><select class="input" id="fMother"><option value="">– unbekannt / zugekauft –</option>${moms.map((m) => `<option value="${esc(m.id)}" ${m.id === a.motherId ? 'selected' : ''}>${esc(label(m))}</option>`).join('')}</select></label>
        <label class="field"><span>Vater (Stier / Besamungsstier)</span><input class="input" id="fFather" value="${esc(a.father || '')}"></label>
        <label class="field"><span>Notiz</span><textarea class="input" id="fNote" rows="2">${esc(a.note || '')}</textarea></label>
        ${id ? `<div class="grid2">
          <label class="field"><span>Status</span><select class="input" id="fStatus">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === (a.status || 'aktiv') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="field"><span>Abgang am</span><input class="input" id="fLeft" type="date" value="${esc(a.leftDate || '')}"></label></div>` : ''}
        <button class="btn primary" id="fSave">Speichern</button>
        ${id ? `<button class="btn danger" id="fDel">${I.trash} Tier löschen</button><p class="hint">Verkaufte oder geschlachtete Tiere besser über „Status“ austragen – dann bleiben die Einträge erhalten.</p>` : ''}`,
      mount(body) {
        const sync = () => $$('#fSex button', body).forEach((b) => b.classList.toggle('on', b.dataset.sex === sex));
        $$('#fSex button', body).forEach((b) => (b.onclick = () => { sex = b.dataset.sex; sync(); })); sync();
        $('#fSave', body).onclick = () => {
          const ear = $('#fEar', body).value.trim(); const name = $('#fName', body).value.trim();
          if (!ear && !name) { toast('Bitte Ohrmarke oder Namen eingeben'); return; }
          const dup = ear && animals.find((x) => x.id !== id && (x.ear || '').replace(/\s/g, '') === ear.replace(/\s/g, ''));
          if (dup && !confirm(`Die Ohrmarke ${ear} gibt es schon (${label(dup)}). Trotzdem speichern?`)) return;
          const motherId = $('#fMother', body).value || null;
          const data = { ear, name, sex, breed: $('#fBreed', body).value.trim(), birth: $('#fBirth', body).value || null, motherId, motherEar: motherId ? (byId(motherId) || {}).ear || '' : (a.motherEar || ''),
            father: $('#fFather', body).value.trim(), note: $('#fNote', body).value.trim(), updatedAt: Date.now() };
          if (id) { data.status = $('#fStatus', body).value; data.leftDate = $('#fLeft', body).value || (data.status !== 'aktiv' ? isoDay() : null); }
          else { data.status = 'aktiv'; data.createdAt = Date.now(); data.by = H.userName(); }
          const nid = H.store.save('animals', id, data);
          toast('Gespeichert');
          if (id) H.backView(); else H.openSheet(viewAnimal(nid));
        };
        const del = $('#fDel', body);
        if (del) del.onclick = () => {
          const n = evOf(id).length;
          if (!confirm(`${label(a)} wirklich löschen?${n ? ` Auch ${n} Einträge werden gelöscht.` : ''}`)) return;
          evOf(id).forEach((e) => H.store.del('animalEvents', e.id));
          H.store.del('animals', id); H.closeSheet(); toast('Gelöscht');
        };
      },
    };
  };
}

// ---------- Einträge ----------
function viewEventForm({ event, animalId, type }) {
  return () => {
    const e = event || { animalId, type: type || 'behandlung', date: isoDay() };
    let t = e.type;
    const a = byId(e.animalId);
    const all = active().concat(a && (a.status || 'aktiv') !== 'aktiv' ? [a] : []).sort((x, y) => (x.name || x.ear || '').localeCompare(y.name || y.ear || '', 'de'));
    return {
      title: event ? 'Eintrag bearbeiten' : 'Neuer Eintrag', tall: true,
      html: `
        <label class="field"><span>Tier</span><select class="input" id="eAnimal">${e.animalId ? '' : '<option value="">Bitte wählen …</option>'}${all.map((x) => `<option value="${esc(x.id)}" ${x.id === e.animalId ? 'selected' : ''}>${esc(label(x))}</option>`).join('')}</select></label>
        <div class="seg" id="eType">${Object.entries(EV).map(([k, d]) => `<button data-t="${k}">${d.label}</button>`).join('')}</div>
        <label class="field"><span>Datum</span><input class="input" id="eDate" type="date" value="${esc(e.date || isoDay())}"></label>
        <div data-for="belegung"><div class="grid2">
          <label class="field"><span>Art</span><select class="input" id="eMethod">${['Besamung', 'Natursprung'].map((m) => `<option ${m === e.method ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          <label class="field"><span>Stier</span><input class="input" id="eBull" value="${esc(e.bull || '')}" placeholder="Name / Code"></label></div>
          <p class="hint" id="eDue" style="margin-top:-4px"></p></div>
        <div data-for="tu"><div class="seg" id="eRes"><button data-r="traechtig">trächtig</button><button data-r="leer">leer</button></div></div>
        <div data-for="abkalbung">
          <div class="seg" id="eCalfSex"><button data-cs="w">♀ Kuhkalb</button><button data-cs="m">♂ Stierkalb</button></div>
          <div class="grid2">
            <label class="field"><span>Ohrmarke Kalb</span><input class="input" id="eCalfEar" value="${esc(e.calfEar || '')}" autocomplete="off"></label>
            <label class="field"><span>Name Kalb</span><input class="input" id="eCalfName" value="${esc(e.calfName || '')}" autocomplete="off"></label></div>
          <label class="field"><span>Verlauf</span><select class="input" id="eCourse">${['leicht', 'mit Hilfe', 'schwer', 'Kaiserschnitt', 'Totgeburt'].map((c) => `<option ${c === e.course ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          ${event ? '' : '<p class="hint" style="margin-top:-4px">Das Kalb wird automatisch als neues Tier angelegt (Mutter und Geburtsdatum sind schon eingetragen).</p>'}
        </div>
        <div data-for="behandlung impfung">
          <div class="grid2">
            <label class="field"><span>Arzneimittel</span><input class="input" id="eDrug" value="${esc(e.drug || '')}"></label>
            <label class="field"><span>Grund / Diagnose</span><input class="input" id="eReason" value="${esc(e.reason || '')}"></label>
            <label class="field"><span>Tierarzt</span><input class="input" id="eVet" value="${esc(e.vet || '')}"></label>
            <label class="field"><span>Wartezeit Fleisch (Tage)</span><input class="input num" id="eWait" inputmode="numeric" value="${esc(e.waitDays ?? '')}"></label>
          </div>
          <p class="hint" id="eWaitInfo" style="margin-top:-4px"></p></div>
        <div data-for="wiegen"><label class="field"><span>Gewicht (kg)</span><input class="input num" id="eWeight" inputmode="decimal" value="${esc(e.weight ?? '')}"></label></div>
        <label class="field"><span>Notiz</span><textarea class="input" id="eNote" rows="2">${esc(e.note || '')}</textarea></label>
        <button class="btn primary" id="eSave">Speichern</button>
        ${event ? `<button class="btn danger" id="eDel">${I.trash} Eintrag löschen</button>` : ''}`,
      mount(body) {
        let res = e.result || 'traechtig'; let cs = e.calfSex || 'w';
        const sync = () => {
          $$('#eType button', body).forEach((b) => b.classList.toggle('on', b.dataset.t === t));
          $$('[data-for]', body).forEach((d) => { d.hidden = !d.dataset.for.split(' ').includes(t); });
          $$('#eRes button', body).forEach((b) => b.classList.toggle('on', b.dataset.r === res));
          $$('#eCalfSex button', body).forEach((b) => b.classList.toggle('on', b.dataset.cs === cs));
          const d = $('#eDate', body).value || isoDay();
          $('#eDue', body).textContent = `Abkalbung voraussichtlich am ${fmtDate(addDays(d, TRAG))}`;
          const w = num($('#eWait', body).value);
          $('#eWaitInfo', body).textContent = w ? `Wartezeit endet am ${fmtDate(addDays(d, w))}` : '';
        };
        $$('#eType button', body).forEach((b) => (b.onclick = () => { t = b.dataset.t; sync(); }));
        $$('#eRes button', body).forEach((b) => (b.onclick = () => { res = b.dataset.r; sync(); }));
        $$('#eCalfSex button', body).forEach((b) => (b.onclick = () => { cs = b.dataset.cs; sync(); }));
        $('#eDate', body).oninput = sync; $('#eWait', body).oninput = sync; sync();
        $('#eSave', body).onclick = () => {
          const aid = $('#eAnimal', body).value;
          if (!aid) { toast('Bitte ein Tier wählen'); return; }
          const date = $('#eDate', body).value || isoDay();
          const d = { animalId: aid, type: t, date, note: $('#eNote', body).value.trim(), updatedAt: Date.now() };
          if (t === 'belegung') { d.method = $('#eMethod', body).value; d.bull = $('#eBull', body).value.trim(); }
          if (t === 'tu') d.result = res;
          if (t === 'abkalbung') { d.calfSex = cs; d.calfEar = $('#eCalfEar', body).value.trim(); d.calfName = $('#eCalfName', body).value.trim(); d.course = $('#eCourse', body).value; }
          if (t === 'behandlung' || t === 'impfung') {
            d.drug = $('#eDrug', body).value.trim(); d.reason = $('#eReason', body).value.trim(); d.vet = $('#eVet', body).value.trim();
            d.waitDays = num($('#eWait', body).value); d.waitUntil = d.waitDays ? addDays(date, d.waitDays) : null;
          }
          if (t === 'wiegen') d.weight = num($('#eWeight', body).value);
          if (!event) { d.createdAt = Date.now(); d.by = H.userName(); }
          if (t === 'abkalbung' && !event && d.course !== 'Totgeburt') {
            const mom = byId(aid);
            const lastBel = evOf(aid).find((x) => x.type === 'belegung' && x.date <= date);
            d.calfId = H.store.save('animals', null, { ear: d.calfEar, name: d.calfName, sex: cs, breed: mom ? mom.breed || '' : '', birth: date, motherId: aid, motherEar: mom ? mom.ear || '' : '',
              father: lastBel ? lastBel.bull || '' : '', status: 'aktiv', note: '', createdAt: Date.now(), by: H.userName() });
          }
          H.store.save('animalEvents', event ? event.id : null, d);
          toast('Gespeichert'); H.backView();
        };
        const del = $('#eDel', body);
        if (del) del.onclick = () => { if (confirm('Eintrag löschen?')) { H.store.del('animalEvents', event.id); toast('Gelöscht'); H.backView(); } };
      },
    };
  };
}

// ---------- Export ----------
function exportAnimals() {
  const rows = [['Ohrmarke', 'Name', 'Geschlecht', 'Kategorie', 'Rasse', 'Geboren', 'Mutter', 'Vater', 'Status', 'Abgang', 'Abkalbetermin']];
  [...animals].sort((a, b) => (a.ear || '').localeCompare(b.ear || '')).forEach((a) => {
    const p = a.sex !== 'm' ? pregnancy(a) : null; const m = byId(a.motherId);
    rows.push([a.ear, a.name, a.sex === 'm' ? 'm' : 'w', CAT_LABEL[category(a)], a.breed, a.birth ? fmtDate(a.birth) : '', m ? m.ear || m.name : a.motherEar || '', a.father, STATUS[a.status || 'aktiv'], a.leftDate ? fmtDate(a.leftDate) : '', p ? fmtDate(p.due) : '']);
  });
  H.saveFile(`herdenbuch-bestand-${isoDay()}.csv`, 'text/csv', H.csv(rows));
}
function exportTreatments() {
  const rows = [['Datum', 'Ohrmarke', 'Name', 'Art', 'Arzneimittel', 'Grund', 'Tierarzt', 'Wartezeit (Tage)', 'Wartezeit bis', 'Notiz', 'Eingetragen von']];
  events.filter((e) => e.type === 'behandlung' || e.type === 'impfung').sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach((e) => {
    const a = byId(e.animalId) || {};
    rows.push([fmtDate(e.date), a.ear || '', a.name || '', EV[e.type].label, e.drug, e.reason, e.vet, e.waitDays ?? '', e.waitUntil ? fmtDate(e.waitUntil) : '', e.note, e.by]);
  });
  H.saveFile(`herdenbuch-behandlungen-${isoDay()}.csv`, 'text/csv', H.csv(rows));
}

// ---------- Start ----------
let unsubs = [];
H.boot({
  config: CFG, demoKey: 'herde_demo', title: 'Herdenbuch',
  onStart() {
    $$('.tab').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
    $('#fab').onclick = () => (animals.length ? H.openSheet(viewEventForm({ type: 'behandlung' })) : H.openSheet(viewAnimalForm(null)));
    $('#openSettings').onclick = () => H.openSheet(viewSettings);
    unsubs.forEach((u) => u()); unsubs = [];
    unsubs.push(H.store.watch('animals', (l, meta) => { animals = l; $('#syncState').textContent = H.store.mode === 'demo' ? 'Demo-Modus' : meta.offline ? 'Offline – wird später synchronisiert' : meta.pending ? 'Wird synchronisiert …' : `${active().length} Tiere · synchronisiert`; render(); H.refreshSheet(); }));
    unsubs.push(H.store.watch('animalEvents', (l) => { events = l; render(); H.refreshSheet(); }));
  },
  onStop() { unsubs.forEach((u) => u()); unsubs = []; },
});
function viewSettings() {
  return {
    title: 'Einstellungen',
    html: `<div class="panel">${H.store.mode === 'demo' ? '<p class="hint" style="margin:0">Demo-Modus: Daten bleiben nur auf diesem Gerät.</p>'
      : `<p class="hint" style="margin-top:0">Angemeldet als <b>${esc(H.user.email)}</b></p><button class="btn" id="sOut">Abmelden</button>`}</div>
      <div class="panel"><button class="btn" id="sJson">${I.down} Komplett-Sicherung (JSON)</button></div>
      <p class="hint">Hinweis: Die Meldungen an die AMA-Rinderdatenbank (Geburt, Zugang, Abgang) ersetzt diese App nicht.</p>
      <p class="hint" style="text-align:center">Herdenbuch ${VERSION} · ${animals.length} Tiere · ${events.length} Einträge</p>`,
    mount(body) {
      const o = $('#sOut', body); if (o) o.onclick = () => H.store.signOut();
      $('#sJson', body).onclick = () => H.saveFile(`herdenbuch-sicherung-${isoDay()}.json`, 'application/json', JSON.stringify({ app: 'herdenbuch', exported: new Date().toISOString(), animals, events }, null, 1));
    },
  };
}
})();
