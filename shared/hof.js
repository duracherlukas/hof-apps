/* Gemeinsamer Unterbau für kleine Hof-Apps (Herdenbuch, Aufgaben):
   Anmeldung, Datenspeicher (Firebase oder Demo), Bottom-Sheet, Toast und Helfer. */
(() => {
const H = (window.HOF = {});
const FB = 'https://www.gstatic.com/firebasejs/13.1.0';
const clean = (o) => JSON.parse(JSON.stringify(o));
H.$ = (s, r = document) => r.querySelector(s);
H.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
H.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
H.num = (v) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
H.fmt = (n, d = 0) => (n == null ? '–' : Number(n).toLocaleString('de-AT', { maximumFractionDigits: d }));
const pad = (n) => String(n).padStart(2, '0');
H.isoDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
H.parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
H.addDays = (s, n) => { const d = H.parseDay(s); d.setDate(d.getDate() + n); return H.isoDay(d); };
H.daysBetween = (a, b) => Math.round((H.parseDay(b) - H.parseDay(a)) / 86400000);
H.fmtDate = (s, opts = { day: '2-digit', month: '2-digit', year: 'numeric' }) => (s ? H.parseDay(s).toLocaleDateString('de-AT', opts) : '–');
H.rid = (n = 16) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
H.userName = () => { try { return localStorage.getItem('hofmaschinen_name') || (H.user && H.user.email ? H.user.email.split('@')[0] : ''); } catch (e) { return ''; } };

// ---------- Toast ----------
let tt;
H.toast = (msg, ms = 2800) => { const t = H.$('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), ms); };
H.onError = (e) => {
  const c = String((e && e.code) || '');
  if (c.includes('permission')) H.toast('Kein Zugriff – ist deine E-Mail in den Firebase-Regeln eingetragen?', 5000);
  else H.toast('Fehler: ' + ((e && e.message) || c), 5000);
};

// ---------- Sheet ----------
let stack = []; let current = null; let cleanup = null;
function showView(view, keepScroll) {
  if (cleanup) { try { cleanup(); } catch (e) { /* */ } cleanup = null; }
  const body = H.$('#sheetBody'); const sc = keepScroll ? body.scrollTop : 0;
  current = view;
  const v = view();
  if (!v) { H.closeSheet(); return; }
  current.live = !!v.live;
  H.$('#sheetTitle').textContent = v.title;
  body.innerHTML = v.html; body.scrollTop = sc;
  H.$('#sheet').classList.toggle('tall', !!v.tall);
  H.$('#sheetBack').hidden = !stack.length;
  H.$('#sheet').hidden = false; H.$('#overlay').hidden = false;
  document.body.style.overflow = 'hidden';
  if (v.mount) cleanup = v.mount(body) || null;
}
H.showView = showView;
H.openSheet = (v) => { stack = []; showView(v); };
H.pushView = (v) => { if (current) stack.push(current); showView(v); };
H.backView = () => (stack.length ? showView(stack.pop()) : H.closeSheet());
H.closeSheet = () => {
  if (cleanup) { try { cleanup(); } catch (e) { /* */ } cleanup = null; }
  stack = []; current = null;
  H.$('#sheet').hidden = true; H.$('#overlay').hidden = true; document.body.style.overflow = '';
};
H.refreshSheet = () => { if (current && current.live) showView(current, true); };

// ---------- Datei speichern ----------
H.saveFile = async (name, mime, text) => {
  const blob = new Blob([text], { type: mime });
  try {
    const file = new File([blob], name, { type: mime });
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (ios && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
};
H.csv = (rows) => '﻿' + rows.map((r) => r.map((v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\r\n');

// ---------- Datenspeicher ----------
H.createStore = async (config, demoKey) => {
  const f = (config && config.firebase) || {};
  if (f.apiKey && f.projectId) {
    const [{ initializeApp }, A, fs] = await Promise.all([import(`${FB}/firebase-app.js`), import(`${FB}/firebase-auth.js`), import(`${FB}/firebase-firestore.js`)]);
    const app = initializeApp(f);
    const auth = A.getAuth(app);
    let db;
    try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); } catch (e) { db = fs.getFirestore(app); }
    return {
      mode: 'firebase',
      onAuth: (cb) => A.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null)),
      signIn: (e, p) => A.signInWithEmailAndPassword(auth, e, p),
      signOut: () => A.signOut(auth),
      resetPassword: (e) => A.sendPasswordResetEmail(auth, e),
      watch(coll, cb) {
        return fs.onSnapshot(fs.collection(db, coll), { includeMetadataChanges: true }, (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id })),
          { pending: snap.metadata.hasPendingWrites, offline: snap.metadata.fromCache }), H.onError);
      },
      save(coll, id, data) { const ref = id ? fs.doc(db, coll, id) : fs.doc(fs.collection(db, coll)); fs.setDoc(ref, clean(data), { merge: true }).catch(H.onError); return ref.id; },
      del(coll, id) { fs.deleteDoc(fs.doc(db, coll, id)).catch(H.onError); },
    };
  }
  // Demo: alles im Browser
  const read = () => { try { return JSON.parse(localStorage.getItem(demoKey)) || {}; } catch (e) { return {}; } };
  let data = read();
  const subs = [];
  const emit = () => subs.forEach(({ coll, cb }) => cb(Object.values(data[coll] || {}), { pending: false, offline: false }));
  const persist = () => { try { localStorage.setItem(demoKey, JSON.stringify(data)); } catch (e) { H.toast('Speicher voll'); } emit(); };
  window.addEventListener('storage', (e) => { if (e.key === demoKey) { data = read(); emit(); } });
  return {
    mode: 'demo',
    onAuth(cb) { setTimeout(() => cb({ uid: 'demo', email: 'demo' }), 0); return () => {}; },
    signIn: async () => {}, signOut: async () => {}, resetPassword: async () => {},
    watch(coll, cb) { const s = { coll, cb }; subs.push(s); setTimeout(() => cb(Object.values(data[coll] || {}), { pending: false, offline: false }), 0); return () => subs.splice(subs.indexOf(s), 1); },
    save(coll, id, d) { const key = id || H.rid(); data[coll] = data[coll] || {}; data[coll][key] = { ...(data[coll][key] || {}), ...clean(d), id: key }; persist(); return key; },
    del(coll, id) { if (data[coll]) delete data[coll][id]; persist(); },
  };
};

// ---------- Start: Anmeldung + App ----------
H.boot = async ({ config, demoKey, title, onStart, onStop }) => {
  H.$('#sheetClose').onclick = H.closeSheet;
  H.$('#sheetBack').onclick = H.backView;
  H.$('#overlay').onclick = H.closeSheet;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') H.closeSheet(); });
  try { H.store = await H.createStore(config, demoKey); }
  catch (e) { H.$('#boot').innerHTML = '<div class="err-box" style="margin:20px">Die App konnte nicht starten. Beim ersten Start wird Internet benötigt.</div>'; return; }
  H.store.onAuth((u) => {
    H.user = u;
    if (u) {
      H.$('#boot').hidden = true; H.$('#login').hidden = true; H.$('#app').hidden = false;
      H.$('#demoBanner').hidden = H.store.mode !== 'demo';
      onStart();
    } else {
      if (onStop) onStop();
      H.closeSheet();
      H.$('#boot').hidden = true; H.$('#app').hidden = true; H.$('#login').hidden = false;
      H.$('#loginTitle').textContent = title;
      const err = H.$('#loginErr');
      H.$('#loginForm').onsubmit = async (ev) => {
        ev.preventDefault(); err.hidden = true; H.$('#loginBtn').disabled = true;
        try { await H.store.signIn(H.$('#loginEmail').value.trim(), H.$('#loginPw').value); }
        catch (e2) {
          const c = String(e2.code || '');
          err.textContent = c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') ? 'E-Mail oder Passwort stimmt nicht.'
            : c.includes('too-many') ? 'Zu viele Versuche – warte kurz.' : c.includes('network') ? 'Keine Internetverbindung.' : `Anmeldung fehlgeschlagen (${c})`;
          err.hidden = false;
        } finally { H.$('#loginBtn').disabled = false; }
      };
      H.$('#forgotPw').onclick = async () => {
        const email = H.$('#loginEmail').value.trim();
        if (!email) { err.textContent = 'Gib zuerst deine E-Mail-Adresse ein.'; err.hidden = false; return; }
        try { await H.store.resetPassword(email); H.toast('E-Mail zum Zurücksetzen wurde gesendet'); } catch (e3) { err.textContent = 'Konnte keine E-Mail senden.'; err.hidden = false; }
      };
    }
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
};
})();
