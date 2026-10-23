/* ==========================================================
   EINSTELLUNGEN – diese Datei passt du an (siehe ANLEITUNG.md)
   ========================================================== */
window.HOF_CONFIG = {
  // Name, der oben in der App steht
  hofName: 'Hof-Maschinen',

  // Firebase-Zugangsdaten aus der Firebase-Konsole
  // (Projekteinstellungen › Allgemein › Deine Apps › Web-App › SDK-Konfiguration).
  // Solange apiKey leer ist, läuft die App im Demo-Modus (Daten nur auf diesem Gerät).
  firebase: {
    apiKey: 'AIzaSyDPPV_0slhGyHkm7iVwKw5CM9Uvva96xmI',
    authDomain: 'hof-apps.firebaseapp.com',
    projectId: 'hof-apps',
    storageBucket: 'hof-apps.firebasestorage.app',
    messagingSenderId: '1810222157',
    appId: '1:1810222157:web:9b6f2232cf8757f3522004',
  },

  // Vorschläge, die beim Anlegen einer Maschine angezeigt werden
  vorschlaege: [
    { name: 'Claas Axos 340', type: 'traktor' },
    { name: 'Fiatagri 80-90 DT', type: 'traktor' },
    { name: 'Steyr 768', type: 'traktor' },
    { name: 'Massey Ferguson 135', type: 'traktor' },
    { name: 'Reform Metrac 3004', type: 'traktor' },
    { name: 'Yamaha XT 500 N', type: 'motorrad' },
  ],
};
