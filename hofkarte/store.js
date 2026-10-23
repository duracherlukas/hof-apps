/* Datenschicht: Firebase (gemeinsam) oder Demo (nur dieses Gerät). */
(() => {
const FB = 'https://www.gstatic.com/firebasejs/13.1.0';
const clean = (o) => JSON.parse(JSON.stringify(o));
const rid = (n = 16) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

window.createHofStore = async (config, onError) => {
  const f = (config && config.firebase) || {};
  if (f.apiKey && f.projectId) return firebaseStore(f, onError || (() => {}));
  return demoStore(onError || (() => {}));
};

async function firebaseStore(fbc, fail) {
  const [{ initializeApp }, A, fs] = await Promise.all([
    import(`${FB}/firebase-app.js`), import(`${FB}/firebase-auth.js`), import(`${FB}/firebase-firestore.js`),
  ]);
  const app = initializeApp(fbc);
  const auth = A.getAuth(app);
  let db;
  try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); }
  catch (e) { db = fs.getFirestore(app); }
  const featCol = fs.collection(db, 'features');
  const photoCol = fs.collection(db, 'photos');
  const settingsRef = fs.doc(db, 'hofkarte', 'settings');
  return {
    mode: 'firebase',
    onAuth: (cb) => A.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null)),
    signIn: (e, p) => A.signInWithEmailAndPassword(auth, e, p),
    signOut: () => A.signOut(auth),
    resetPassword: (e) => A.sendPasswordResetEmail(auth, e),
    watchFeatures(cb) {
      return fs.onSnapshot(featCol, { includeMetadataChanges: true }, (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id })), {
        pending: snap.metadata.hasPendingWrites, offline: snap.metadata.fromCache }), fail);
    },
    newId: () => rid(),
    saveFeature(id, data) { fs.setDoc(fs.doc(featCol, id), clean(data), { merge: true }).catch(fail); return id; },
    async deleteFeature(id) {
      const ph = await fs.getDocs(fs.query(photoCol, fs.where('featureId', '==', id)));
      const batch = fs.writeBatch(db);
      ph.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(fs.doc(featCol, id));
      batch.commit().catch(fail);
    },
    async listPhotos(featureId) {
      const snap = await fs.getDocs(fs.query(photoCol, fs.where('featureId', '==', featureId)));
      return snap.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    },
    async addPhoto(data) { const id = rid(); await fs.setDoc(fs.doc(photoCol, id), clean(data)); return id; },
    async deletePhoto(id) { await fs.deleteDoc(fs.doc(photoCol, id)); },
    watchSettings(cb) { return fs.onSnapshot(settingsRef, (s) => cb(s.exists() ? s.data() : {}), fail); },
    saveSettings(data) { fs.setDoc(settingsRef, clean(data), { merge: true }).catch(fail); },
  };
}

function demoStore(fail) {
  const KEY = 'hofkarte_demo';
  const read = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.features) return d; } catch (e) { /* */ } return { features: {}, photos: {}, settings: {} }; };
  let data = read();
  const subs = new Set();
  const setSubs = new Set();
  const emit = () => { subs.forEach((cb) => cb(Object.values(data.features), { pending: false, offline: false })); setSubs.forEach((cb) => cb(data.settings || {})); };
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { fail(Object.assign(new Error('Speicher des Browsers voll (Demo-Modus). Weniger/kleinere Fotos verwenden oder Firebase einrichten.'), { code: 'quota' })); data = read(); }
    emit();
  };
  window.addEventListener('storage', (e) => { if (e.key === KEY) { data = read(); emit(); } });
  return {
    mode: 'demo',
    onAuth(cb) { setTimeout(() => cb({ uid: 'demo', email: 'demo' }), 0); return () => {}; },
    signIn: async () => {}, signOut: async () => {}, resetPassword: async () => {},
    watchFeatures(cb) { subs.add(cb); setTimeout(emit, 0); return () => subs.delete(cb); },
    newId: () => rid(),
    saveFeature(id, f) { data.features[id] = { ...(data.features[id] || {}), ...clean(f), id }; persist(); return id; },
    async deleteFeature(id) { delete data.features[id]; Object.keys(data.photos).forEach((k) => { if (data.photos[k].featureId === id) delete data.photos[k]; }); persist(); },
    async listPhotos(fid) { return Object.values(data.photos).filter((p) => p.featureId === fid).sort((a, b) => a.createdAt - b.createdAt); },
    async addPhoto(p) {
      const id = rid();
      data.photos[id] = { ...clean(p), id };
      try { localStorage.setItem(KEY, JSON.stringify(data)); }
      catch (e) { delete data.photos[id]; throw Object.assign(new Error('Speicher voll'), { code: 'quota' }); }
      emit();
      return id;
    },
    async deletePhoto(id) { delete data.photos[id]; persist(); },
    watchSettings(cb) { setSubs.add(cb); setTimeout(emit, 0); return () => setSubs.delete(cb); },
    saveSettings(s) { data.settings = { ...(data.settings || {}), ...clean(s) }; persist(); },
  };
}
})();
