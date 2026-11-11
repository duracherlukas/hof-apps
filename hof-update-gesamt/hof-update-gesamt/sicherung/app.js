/* Datensicherung: alle gemeinsamen Hof-Daten (Firebase) als eine Datei speichern und wieder einspielen */
(() => {
const H = window.HOF;
const { $, esc, toast } = H;
const GROUPS = [
  ['Maschinen & Ernte', ['machines', 'entries']],
  ['Hof-Karte & Feld-Tagebuch', ['features', 'fieldlog', 'hofkarte']],
  ['Gäste: Gästemappe, Unterkünfte, Bestellungen, Belegung', ['site', 'units', 'orders', 'bookings']],
  ['Herdenbuch', ['animals', 'animalEvents']],
  ['Aufgaben', ['tasks']],
];
const PHOTOS = ['photos', 'mphotos'];
const KEY = 'hof_lastBackup';
const lastBackup = () => { try { return +localStorage.getItem(KEY) || 0; } catch (e) { return 0; } };
// wartet auf den Stand vom Server (nicht nur den Zwischenspeicher am Handy)
const once = (coll) => new Promise((res) => {
  let done = false; let last = [];
  const finish = (docs) => { if (done) return; done = true; setTimeout(() => u && u(), 0); res(docs); };
  const u = H.store.watch(coll, (docs, meta) => { last = docs; if (!meta || !meta.offline) finish(docs); });
  setTimeout(() => finish(last), 12000);
});

function render() {
  const lb = lastBackup();
  const age = lb ? Math.floor((Date.now() - lb) / 86400000) : null;
  $('#view').innerHTML = `
    <div class="card ${age == null || age > 30 ? 'warn-card' : ''}">
      <h2>💾 Sicherung aller Hof-Daten</h2>
      <p class="muted" style="margin-top:0">${age == null ? 'Auf diesem Gerät wurde noch keine Sicherung gemacht.' : `Letzte Sicherung auf diesem Gerät: vor ${age} ${age === 1 ? 'Tag' : 'Tagen'}.`} Empfehlung: einmal im Monat sichern und die Datei z. B. per E-Mail an dich selbst schicken oder auf einen USB-Stick kopieren.</p>
      <label class="check-line"><input type="checkbox" id="withPhotos"> Fotos mitsichern (Hof-Karte und Maschinen – Datei wird größer)</label>
      <button class="btn primary" id="bkGo">Jetzt sichern</button>
      <div id="bkInfo" class="hint"></div>
    </div>
    <div class="section-title">Was wird gesichert?</div>
    <div class="list">${GROUPS.map(([l]) => `<div class="list-item"><span class="info"><span class="name">${esc(l)}</span></span></div>`).join('')}</div>
    <p class="hint">Kalorien und Wandertagebuch speichern nur auf dem Handy – die haben ihre eigene Sicherung in den Einstellungen und erinnern dich einmal im Monat daran.</p>
    <div class="section-title">Wiederherstellen</div>
    <div class="card"><p class="muted" style="margin-top:0">Nur im Notfall: Spielt eine Sicherungsdatei zurück. Vorhandene Einträge mit gleicher Kennung werden überschrieben, nichts wird gelöscht.</p>
      <button class="btn danger" id="rsGo">Sicherung einspielen …</button><input type="file" id="rsFile" accept="application/json,.json" hidden></div>
    ${H.store.mode === 'demo' ? '<div class="warn-box">Demo-Modus: Hier gibt es keine gemeinsamen Daten. Die Seite funktioniert erst mit Firebase.</div>' : ''}`;
  $('#bkGo').onclick = backup;
  $('#rsGo').onclick = () => $('#rsFile').click();
  $('#rsFile').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restore(f); };
}
async function backup() {
  const btn = $('#bkGo'); btn.disabled = true;
  const info = $('#bkInfo');
  const colls = GROUPS.flatMap(([, c]) => c).concat($('#withPhotos').checked ? PHOTOS : []);
  const out = { app: 'hof-apps', version: 1, exported: new Date().toISOString(), by: H.user && H.user.email, data: {} };
  try {
    for (const c of colls) {
      info.textContent = `Lade ${c} …`;
      out.data[c] = await Promise.race([once(c), new Promise((_, rej) => setTimeout(() => rej(new Error(`Zeitüberschreitung bei ${c}`)), 20000))]);
    }
    const n = Object.values(out.data).reduce((s, l) => s + l.length, 0);
    const d = new Date(); const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await H.saveFile(`hof-sicherung-${day}.json`, 'application/json', JSON.stringify(out));
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* */ }
    toast(`${n} Einträge gesichert`);
    render();
    $('#bkInfo').textContent = `${n} Einträge gesichert: ${Object.entries(out.data).map(([k, v]) => `${k} ${v.length}`).join(' · ')}`;
  } catch (e) { info.textContent = `Fehler: ${e.message || e}`; btn.disabled = false; }
}
async function restore(file) {
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== 'hof-apps' || !d.data) throw new Error('Das ist keine Hof-Sicherung.');
    const n = Object.values(d.data).reduce((s, l) => s + l.length, 0);
    if (!confirm(`Sicherung vom ${new Date(d.exported).toLocaleString('de-AT')} mit ${n} Einträgen einspielen?`)) return;
    if (!confirm('Wirklich? Gleiche Einträge werden mit dem Stand der Sicherung überschrieben.')) return;
    let k = 0;
    for (const [coll, docs] of Object.entries(d.data)) for (const { id, ...rest } of docs) { if (id) { H.store.save(coll, id, rest); k++; } }
    toast(`${k} Einträge eingespielt`);
  } catch (e) { toast(e.message || 'Datei konnte nicht gelesen werden', 5000); }
}
H.boot({
  config: window.HOF_CONFIG || {}, demoKey: 'sicherung_demo', title: 'Datensicherung',
  onStart() { $('#syncState').textContent = H.user && H.user.email !== 'demo' ? H.user.email : 'Demo-Modus'; $('#openSettings').onclick = () => { if (confirm('Abmelden?')) H.store.signOut(); }; render(); },
});
})();
