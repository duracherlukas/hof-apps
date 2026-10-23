/* ==========================================================
   EINSTELLUNGEN – siehe ANLEITUNG.md
   ========================================================== */
window.HOFKARTE_CONFIG = {
  hofName: 'Hof-Karte',
  adresse: 'Stegen 16, 5761 Maria Alm',

  // Startpunkt der Karte (Hof). Kann in der App unter „Mehr › Hof-Mittelpunkt“ neu gesetzt werden.
  start: { lat: 47.3979, lng: 12.9029, zoom: 18 },

  // Firebase – dieselben Werte wie bei der Maschinen- und Gäste-App.
  // Leer = Demo-Modus (Daten nur auf diesem Gerät).
  firebase: {
    apiKey: 'AIzaSyDPPV_0slhGyHkm7iVwKw5CM9Uvva96xmI',
    authDomain: 'hof-apps.firebaseapp.com',
    projectId: 'hof-apps',
    storageBucket: 'hof-apps.firebasestorage.app',
    messagingSenderId: '1810222157',
    appId: '1:1810222157:web:9b6f2232cf8757f3522004',
  },

  // Zusätzliche Kartenebenen als WMS (z. B. Grundstücksgrenzen aus SAGIS).
  // Die Adresse des Dienstes und den Ebenennamen findest du in SAGIS bzw. im Geoportal Land Salzburg.
  // Beispiel:
  // wms: [
  //   { name: 'Grundstücksgrenzen (SAGIS)', url: 'https://…/WMSServer', layers: '0', attribution: '© Land Salzburg (SAGIS)', maxZoom: 21 },
  // ],
  wms: [],
};
