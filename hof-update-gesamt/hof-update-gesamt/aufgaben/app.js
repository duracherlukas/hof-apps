/* Aufgaben: gemeinsame Aufgabenliste für die Familie am Hof */
(() => {
const H = window.HOF;
const { $, $$, esc, isoDay, addDays, daysBetween, fmtDate, toast } = H;
const CFG = window.HOF_CONFIG || {};
const VERSION = '1.0';
const PLACES = ['Hof', 'Stall', 'Ferienwohnungen', 'Nösslau Alm', 'Schoberhof', 'Felder & Wiesen', 'Wald', 'Maschinen', 'Haushalt'];
const REPEAT = { '': 'einmalig', woche: 'jede Woche', monat: 'jeden Monat', jahr: 'jedes Jahr' };
const I = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
};
let tasks = [];
let tab = 'offen';
const NAME_KEY = 'hofmaschinen_name';
const me = () => H.userName();
const open = () => tasks.filter((t) => t.status !== 'erledigt');
const people = () => [...new Set([me(), ...tasks.map((t) => t.who)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
const places = () => [...new Set([...PLACES, ...tasks.map((t) => t.place)].filter(Boolean))];
const sortOpen = (l) => [...l].sort((a, b) => (b.prio ? 1 : 0) - (a.prio ? 1 : 0) || (a.due || '9999').localeCompare(b.due || '9999') || (a.createdAt || 0) - (b.createdAt || 0));

function dueBadge(t) {
  if (!t.due) return '';
  const d = daysBetween(isoDay(), t.due);
  const txt = d < 0 ? `${-d} T. überfällig` : d === 0 ? 'heute' : d === 1 ? 'morgen' : d < 7 ? fmtDate(t.due, { weekday: 'short' }) : fmtDate(t.due, { day: '2-digit', month: '2-digit' });
  return `<span class="badge ${d < 0 ? 'bad' : d <= 1 ? 'warn' : ''}">${txt}</span>`;
}
function row(t) {
  const done = t.status === 'erledigt';
  return `<div class="list-item task ${done ? 'done' : ''}">
    <button class="tick" data-tick="${esc(t.id)}" aria-label="${done ? 'wieder öffnen' : 'erledigt'}">${done ? '✓' : ''}</button>
    <button class="info" data-task="${esc(t.id)}" style="text-align:left">
      <span class="name">${t.prio ? '❗ ' : ''}${esc(t.title)}</span>
      <small>${esc([t.who, t.place, t.repeat ? REPEAT[t.repeat] : '', done && t.doneAt ? `erledigt ${fmtDate(isoDay(new Date(t.doneAt)))}${t.doneBy ? ` von ${t.doneBy}` : ''}` : ''].filter(Boolean).join(' · '))}</small>
    </button>${done ? '' : dueBadge(t)}</div>`;
}
function groupHtml(list) {
  const today = isoDay(); const week = addDays(today, 7);
  const g = [['Überfällig', list.filter((t) => t.due && t.due < today)], ['Heute', list.filter((t) => t.due === today)], ['Nächste 7 Tage', list.filter((t) => t.due && t.due > today && t.due <= week)],
    ['Später', list.filter((t) => t.due && t.due > week)], ['Ohne Datum', list.filter((t) => !t.due)]];
  const html = g.filter(([, l]) => l.length).map(([h, l]) => `<div class="section-title">${h} (${l.length})</div><div class="list">${sortOpen(l).map(row).join('')}</div>`).join('');
  return html || '<div class="empty"><span style="font-size:40px">🎉</span><br>Nichts offen!</div>';
}
function render() {
  $$('.tab').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab));
  const v = $('#view');
  if (tab === 'offen') v.innerHTML = `${quickAdd()}${groupHtml(open())}`;
  else if (tab === 'meine') v.innerHTML = me() ? `<p class="hint" style="margin-top:0">Aufgaben für <b>${esc(me())}</b></p>${groupHtml(open().filter((t) => t.who === me()))}`
    : '<div class="card"><p style="margin-top:0">Trag zuerst deinen Namen ein (Zahnrad oben rechts) – dann siehst du hier deine Aufgaben.</p></div>';
  else if (tab === 'orte') {
    const by = {};
    open().forEach((t) => { (by[t.place || 'Ohne Ort'] = by[t.place || 'Ohne Ort'] || []).push(t); });
    v.innerHTML = Object.keys(by).length ? Object.entries(by).sort((a, b) => a[0].localeCompare(b[0], 'de')).map(([p, l]) => `<div class="section-title">${esc(p)} (${l.length})</div><div class="list">${sortOpen(l).map(row).join('')}</div>`).join('') : '<div class="empty">Nichts offen.</div>';
  } else {
    const done = tasks.filter((t) => t.status === 'erledigt').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 150);
    v.innerHTML = done.length ? `<div class="list">${done.map(row).join('')}</div><button class="btn" id="csv" style="margin-top:14px">${I.down} Liste als Excel</button>` : '<div class="empty">Noch nichts erledigt.</div>';
  }
  bind(v);
}
function quickAdd() {
  return `<form class="quick" id="quick"><input class="input" id="qTitle" placeholder="Neue Aufgabe … z. B. Zaun Nösslau richten" autocomplete="off"><button class="btn primary small" aria-label="Hinzufügen">${I.plus}</button></form>`;
}
function bind(v) {
  $$('[data-task]', v).forEach((b) => (b.onclick = () => H.openSheet(viewForm(tasks.find((t) => t.id === b.dataset.task)))));
  $$('[data-tick]', v).forEach((b) => (b.onclick = () => toggleDone(tasks.find((t) => t.id === b.dataset.tick))));
  const q = $('#quick', v);
  if (q) q.onsubmit = (e) => { e.preventDefault(); const title = $('#qTitle', v).value.trim(); if (!title) return; H.store.save('tasks', null, { title, status: 'offen', createdAt: Date.now(), by: me() }); toast('Hinzugefügt'); };
  const c = $('#csv', v); if (c) c.onclick = exportCsv;
}
function toggleDone(t) {
  if (!t) return;
  if (t.status === 'erledigt') { H.store.save('tasks', t.id, { status: 'offen', doneAt: null, doneBy: null }); toast('Wieder offen'); return; }
  H.store.save('tasks', t.id, { status: 'erledigt', doneAt: Date.now(), doneBy: me() });
  if (t.repeat) {
    const base = t.due || isoDay();
    const d = H.parseDay(base);
    if (t.repeat === 'woche') d.setDate(d.getDate() + 7); else if (t.repeat === 'monat') d.setMonth(d.getMonth() + 1); else d.setFullYear(d.getFullYear() + 1);
    const { id, doneAt, doneBy, ...rest } = t;
    H.store.save('tasks', null, { ...rest, status: 'offen', due: isoDay(d), createdAt: Date.now() });
    toast(`Erledigt – nächstes Mal am ${fmtDate(isoDay(d))}`);
  } else toast('Erledigt 👍');
}
function viewForm(t) {
  return () => {
    const d = t || { status: 'offen', who: '', place: '', due: '', prio: false, repeat: '' };
    return {
      title: t ? 'Aufgabe' : 'Neue Aufgabe', tall: true,
      html: `
        <label class="field"><span>Was ist zu tun?</span><input class="input" id="fTitle" value="${esc(d.title || '')}" autocomplete="off"></label>
        <div class="grid2">
          <label class="field"><span>Wer?</span><input class="input" id="fWho" list="pl" value="${esc(d.who || '')}" placeholder="Name"><datalist id="pl">${people().map((p) => `<option value="${esc(p)}">`).join('')}</datalist></label>
          <label class="field"><span>Bis wann?</span><input class="input" id="fDue" type="date" value="${esc(d.due || '')}"></label>
        </div>
        <div class="seg" id="fWhen"><button data-w="0">Heute</button><button data-w="1">Morgen</button><button data-w="7">In 1 Woche</button><button data-w="">Kein Datum</button></div>
        <div class="grid2">
          <label class="field"><span>Wo?</span><input class="input" id="fPlace" list="pc" value="${esc(d.place || '')}"><datalist id="pc">${places().map((p) => `<option value="${esc(p)}">`).join('')}</datalist></label>
          <label class="field"><span>Wiederholen</span><select class="input" id="fRep">${Object.entries(REPEAT).map(([k, v]) => `<option value="${k}" ${k === (d.repeat || '') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <label class="check-line"><input type="checkbox" id="fPrio" ${d.prio ? 'checked' : ''}> ❗ Wichtig</label>
        <label class="field"><span>Notiz</span><textarea class="input" id="fNote" rows="3">${esc(d.note || '')}</textarea></label>
        <button class="btn primary" id="fSave">Speichern</button>
        ${t ? `<button class="btn" id="fDone">${t.status === 'erledigt' ? `${I.undo} Wieder öffnen` : '✓ Erledigt'}</button>
          <button class="btn danger" id="fDel">${I.trash} Löschen</button>
          <p class="hint">Angelegt ${t.by ? `von ${esc(t.by)} ` : ''}am ${t.createdAt ? fmtDate(isoDay(new Date(t.createdAt))) : '–'}</p>` : ''}`,
      mount(body) {
        $$('#fWhen button', body).forEach((b) => (b.onclick = () => { $('#fDue', body).value = b.dataset.w === '' ? '' : addDays(isoDay(), +b.dataset.w); }));
        $('#fSave', body).onclick = () => {
          const title = $('#fTitle', body).value.trim();
          if (!title) { toast('Bitte eingeben, was zu tun ist'); $('#fTitle', body).focus(); return; }
          const data = { title, who: $('#fWho', body).value.trim(), due: $('#fDue', body).value || '', place: $('#fPlace', body).value.trim(), repeat: $('#fRep', body).value,
            prio: $('#fPrio', body).checked, note: $('#fNote', body).value.trim(), updatedAt: Date.now() };
          if (!t) { data.status = 'offen'; data.createdAt = Date.now(); data.by = me(); }
          H.store.save('tasks', t ? t.id : null, data); toast('Gespeichert'); H.closeSheet();
        };
        if (t) {
          $('#fDone', body).onclick = () => { toggleDone(t); H.closeSheet(); };
          $('#fDel', body).onclick = () => { if (confirm('Aufgabe löschen?')) { H.store.del('tasks', t.id); H.closeSheet(); toast('Gelöscht'); } };
        } else setTimeout(() => $('#fTitle', body).focus(), 50);
      },
    };
  };
}
function exportCsv() {
  const rows = [['Aufgabe', 'Wer', 'Wo', 'Bis', 'Status', 'Erledigt am', 'Erledigt von', 'Notiz']];
  [...tasks].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).forEach((t) => rows.push([t.title, t.who, t.place, t.due ? fmtDate(t.due) : '', t.status, t.doneAt ? fmtDate(isoDay(new Date(t.doneAt))) : '', t.doneBy, t.note]));
  H.saveFile(`aufgaben-${isoDay()}.csv`, 'text/csv', H.csv(rows));
}
function viewSettings() {
  return {
    title: 'Einstellungen',
    html: `<div class="panel"><label class="field"><span>Dein Name (für „Meine“ Aufgaben)</span><input class="input" id="sName" value="${esc(me())}"></label><button class="btn primary" id="sNameSave">Speichern</button></div>
      <div class="panel">${H.store.mode === 'demo' ? '<p class="hint" style="margin:0">Demo-Modus: Daten bleiben nur auf diesem Gerät.</p>' : `<p class="hint" style="margin-top:0">Angemeldet als <b>${esc(H.user.email)}</b></p><button class="btn" id="sOut">Abmelden</button>`}</div>
      <p class="hint" style="text-align:center">Aufgaben ${VERSION} · ${open().length} offen · ${tasks.length - open().length} erledigt</p>`,
    mount(body) {
      $('#sNameSave', body).onclick = () => { try { localStorage.setItem(NAME_KEY, $('#sName', body).value.trim()); } catch (e) { /* */ } toast('Gespeichert'); H.closeSheet(); render(); };
      const o = $('#sOut', body); if (o) o.onclick = () => H.store.signOut();
    },
  };
}
let unsub = null;
H.boot({
  config: CFG, demoKey: 'aufgaben_demo', title: 'Aufgaben',
  onStart() {
    $$('.tab').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
    $('#fab').onclick = () => H.openSheet(viewForm(null));
    $('#openSettings').onclick = () => H.openSheet(viewSettings);
    if (unsub) unsub();
    unsub = H.store.watch('tasks', (l, meta) => {
      tasks = l;
      $('#syncState').textContent = H.store.mode === 'demo' ? 'Demo-Modus' : meta.offline ? 'Offline – wird später synchronisiert' : `${open().length} offen · synchronisiert`;
      render();
    });
  },
  onStop() { if (unsub) unsub(); unsub = null; },
});
})();
