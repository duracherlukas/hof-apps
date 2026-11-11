/* Datenschicht: Firebase (gemeinsame Daten) oder Demo-Modus (nur dieses Gerät). */
(() => {
const FB = 'https://www.gstatic.com/firebasejs/13.1.0';

const clean = (obj) => JSON.parse(JSON.stringify(obj)); // entfernt undefined-Werte (Firestore mag die nicht)

window.createStore = async function createStore(config, onError) {
  const fbc = (config && config.firebase) || {};
  if (fbc.apiKey && fbc.projectId) return firebaseStore(fbc, onError);
  return demoStore();
};

// ---------------- Firebase ----------------
async function firebaseStore(fbc, onError) {
  const [{ initializeApp }, authMod, fs] = await Promise.all([
    import(`${FB}/firebase-app.js`),
    import(`${FB}/firebase-auth.js`),
    import(`${FB}/firebase-firestore.js`),
  ]);
  const app = initializeApp(fbc);
  const auth = authMod.getAuth(app);
  let db;
  try {
    db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch (e) {
    db = fs.getFirestore(app); // Fallback ohne Offline-Speicher
  }
  const machinesCol = fs.collection(db, 'machines');
  const entriesCol = fs.collection(db, 'entries');
  const fail = (e) => { if (onError) onError(e); };

  return {
    mode: 'firebase',
    onAuth(cb) { return authMod.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null)); },
    signIn: (email, pw) => authMod.signInWithEmailAndPassword(auth, email, pw),
    signOut: () => authMod.signOut(auth),
    resetPassword: (email) => authMod.sendPasswordResetEmail(auth, email),

    subscribe(cb) {
      const state = { machines: [], entries: [], pending: false, offline: false, ready: { m: false, e: false } };
      const emit = () => { if (state.ready.m && state.ready.e) cb({ machines: state.machines, entries: state.entries, pending: state.pending, offline: state.offline }); };
      const meta = (snap) => { state.pending = snap.metadata.hasPendingWrites; state.offline = snap.metadata.fromCache; };
      const u1 = fs.onSnapshot(machinesCol, { includeMetadataChanges: true }, (snap) => {
        state.machines = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        state.ready.m = true; meta(snap); emit();
      }, fail);
      const u2 = fs.onSnapshot(entriesCol, { includeMetadataChanges: true }, (snap) => {
        state.entries = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        state.ready.e = true; meta(snap); emit();
      }, fail);
      return () => { u1(); u2(); };
    },

    newId: (kind) => fs.doc(kind === 'machine' ? machinesCol : entriesCol).id,

    // Schreibvorgänge werden sofort lokal angezeigt und synchronisiert, sobald Netz da ist.
    saveMachine(id, data) {
      const ref = id ? fs.doc(machinesCol, id) : fs.doc(machinesCol);
      fs.setDoc(ref, clean(data), { merge: true }).catch(fail);
      return ref.id;
    },
    deleteMachine(id, entryIds) {
      const ids = [...entryIds];
      const commitChunk = () => {
        const batch = fs.writeBatch(db);
        ids.splice(0, 450).forEach((eid) => batch.delete(fs.doc(entriesCol, eid)));
        if (!ids.length) batch.delete(fs.doc(machinesCol, id));
        batch.commit().catch(fail);
        if (ids.length) commitChunk();
      };
      commitChunk();
    },
    saveEntry(id, data, machineId, machinePatch) {
      const batch = fs.writeBatch(db);
      const ref = id ? fs.doc(entriesCol, id) : fs.doc(entriesCol);
      batch.set(ref, clean(data), { merge: true });
      if (machineId && machinePatch) batch.set(fs.doc(machinesCol, machineId), clean(machinePatch), { merge: true });
      batch.commit().catch(fail);
      return ref.id;
    },
    deleteEntry(id) { fs.deleteDoc(fs.doc(entriesCol, id)).catch(fail); },
    // Fotos zu Maschinen und Einträgen
    async listPhotos(machineId) {
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'mphotos'), fs.where('machineId', '==', machineId)));
      return snap.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    },
    async addPhoto(data) { const ref = fs.doc(fs.collection(db, 'mphotos')); await fs.setDoc(ref, clean(data)); return ref.id; },
    async deletePhoto(id) { await fs.deleteDoc(fs.doc(db, 'mphotos', id)); },
    // Flächen aus der Hof-Karte (nur lesen)
    subscribeFeatures(cb) {
      return fs.onSnapshot(fs.collection(db, 'features'), (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))), () => cb([]));
    },
  };
}

// ---------------- Demo (localStorage) ----------------
function demoStore() {
  const KEY = 'hofmaschinen_demo';
  const listeners = new Set();
  const load = () => {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.machines && d.entries) return d; } catch (e) { /* leer */ }
    return { machines: {}, entries: {} };
  };
  let data = load();
  const emit = () => {
    const snap = { machines: Object.values(data.machines), entries: Object.values(data.entries), pending: false, offline: false };
    listeners.forEach((cb) => cb(snap));
  };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* voll */ } emit(); };
  const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  window.addEventListener('storage', (e) => { if (e.key === KEY) { data = load(); emit(); } });

  return {
    mode: 'demo',
    onAuth(cb) { setTimeout(() => cb({ uid: 'demo', email: 'demo@geraet' }), 0); return () => {}; },
    signIn: async () => {},
    signOut: async () => {},
    resetPassword: async () => {},
    subscribe(cb) { listeners.add(cb); setTimeout(emit, 0); return () => listeners.delete(cb); },
    newId: () => id(),
    saveMachine(mid, m) {
      const key = mid || id();
      data.machines[key] = { ...(data.machines[key] || {}), ...clean(m), id: key };
      persist();
      return key;
    },
    deleteMachine(mid, entryIds) {
      entryIds.forEach((e) => delete data.entries[e]);
      delete data.machines[mid];
      persist();
    },
    saveEntry(eid, e, machineId, patch) {
      const key = eid || id();
      data.entries[key] = { ...(data.entries[key] || {}), ...clean(e), id: key };
      if (machineId && patch && data.machines[machineId]) data.machines[machineId] = { ...data.machines[machineId], ...clean(patch) };
      persist();
      return key;
    },
    deleteEntry(eid) { delete data.entries[eid]; persist(); },
    async listPhotos(mid) { try { return Object.values(JSON.parse(localStorage.getItem('hofmaschinen_photos')) || {}).filter((p) => p.machineId === mid).sort((a, b) => a.createdAt - b.createdAt); } catch (e) { return []; } },
    async addPhoto(p) {
      let all = {}; try { all = JSON.parse(localStorage.getItem('hofmaschinen_photos')) || {}; } catch (e) { /* */ }
      const pid = id(); all[pid] = { ...clean(p), id: pid };
      try { localStorage.setItem('hofmaschinen_photos', JSON.stringify(all)); } catch (e) { throw Object.assign(new Error('Speicher voll'), { code: 'quota' }); }
      return pid;
    },
    async deletePhoto(pid) { let all = {}; try { all = JSON.parse(localStorage.getItem('hofmaschinen_photos')) || {}; } catch (e) { /* */ } delete all[pid]; try { localStorage.setItem('hofmaschinen_photos', JSON.stringify(all)); } catch (e) { /* */ } },
    subscribeFeatures(cb) {
      const read = () => { try { const d = JSON.parse(localStorage.getItem('hofkarte_demo')); return d && d.features ? Object.values(d.features) : []; } catch (e) { return []; } };
      setTimeout(() => cb(read()), 0);
      const on = (e) => { if (e.key === 'hofkarte_demo') cb(read()); };
      window.addEventListener('storage', on);
      return () => window.removeEventListener('storage', on);
    },
  };
}

})();
