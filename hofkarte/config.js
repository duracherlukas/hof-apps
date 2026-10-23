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
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },

  // Zusätzliche Kartenebenen als WMS (z. B. Grundstücksgrenzen aus SAGIS).
  // Die Adresse des Dienstes und den Ebenennamen findest du in SAGIS bzw. im Geoportal Land Salzburg.
  // Beispiel:
  // wms: [
  //   { name: 'Grundstücksgrenzen (SAGIS)', url: 'https://…/WMSServer', layers: '0', attribution: '© Land Salzburg (SAGIS)', maxZoom: 21 },
  // ],
  wms: [],
};
