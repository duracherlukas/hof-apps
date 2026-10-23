# Hof-Karte – Einrichtung

Karte für den Hof (Stegen 16, Maria Alm): Wasserleitungen, Schieber, Stromkabel, Drainagen, Grenzsteine, Zäune und Flächen einzeichnen – mit Tiefe, Material, Notizen und Fotos. Läuft auf iPhone und Android.

**Kartengrundlage:** Luftbild und Karte von **basemap.at** (Österreich, sehr detailliert, kostenlos), dazu OpenStreetMap als Reserve. Bereits angesehene Kartenteile merkt sich die App, damit sie auch draußen mit schlechtem Empfang funktioniert.

---

## Ausprobieren

Ordner entpacken und `index.html` doppelklicken. Läuft im Demo-Modus (nur dieser PC).

## Online stellen

Wie bei den anderen Apps: neues **Public** Repository auf GitHub (z. B. `hofkarte`), Inhalt des Ordners hochladen (inkl. `icons` und `vendor`), unter **Settings › Pages** aktivieren.
→ `https://DEIN-NAME.github.io/hofkarte/`

Aufs Handy: **iPhone** Safari › Teilen › Zum Home-Bildschirm · **Android** Chrome › ⋮ › App installieren.
Beim ersten Mal fragt das Handy, ob die App den **Standort** verwenden darf → erlauben (für GPS-Punkte).

## Gemeinsame Daten (Firebase)

1. In `config.js` dieselben Firebase-Werte eintragen wie bei der Maschinen- und Gäste-App.
2. In Firebase › Firestore › **Regeln** den Inhalt von `firestore.rules` (liegt im Hauptordner `hof-apps`) einfügen und veröffentlichen.
   **Diese Datei enthält die Regeln für alle drei Apps** (Maschinen, Gäste, Hof-Karte) und ersetzt die bisherigen.

Fotos werden verkleinert direkt in der Datenbank gespeichert – dafür braucht es keinen kostenpflichtigen Firebase-Tarif.

## Bedienung

- **＋** → wählen, was eingezeichnet wird (Punkt, Leitung, Fläche).
- Die Karte so verschieben, dass das **rote Fadenkreuz** genau auf der Stelle liegt → **Punkt setzen**. Für Leitungen und Flächen mehrere Punkte setzen, dann **Fertig**.
- Oder hingehen und **GPS-Punkt** tippen – die Genauigkeit wird oben angezeigt. Handy-GPS ist auf etwa 3–5 m genau; für Schieber unter der Erde zusätzlich ein Foto mit Bezugspunkt (Hausecke, Zaunpfahl) machen und die Entfernung in die Notiz schreiben.
- **Lange auf die Karte drücken** setzt sofort einen Punkt an dieser Stelle.
- Antippen eines Eintrags zeigt die Details: Tiefe, Material, Länge bzw. Fläche, **Entfernung und Richtung von dir**, Fotos. **Hinführen** öffnet die Route in Google Maps.
- **Liste** (☰): alles durchsuchen, nach Entfernung sortiert, und einzelne Arten auf der Karte ein- oder ausblenden.
- **Ebenen** (◇): Luftbild, Karte oder OpenStreetMap; Straßennamen und Beschriftungen ein/aus.
- **Mehr** (⋯): Hof-Mittelpunkt neu setzen, Export für **Google Earth (KML)** oder **GIS (GeoJSON)**.
- **Messen**: unter ＋ → „Strecke messen“ / „Fläche messen“, ohne etwas zu speichern.

## Grundstücksgrenzen aus SAGIS (optional)

Wenn du die Adresse eines WMS-Dienstes mit Grundstücksgrenzen hast (z. B. aus SAGIS bzw. dem Geoportal Land Salzburg), kannst du sie als Ebene einblenden. In `config.js`:

```js
wms: [
  { name: 'Grundstücksgrenzen (SAGIS)', url: 'https://…/WMSServer', layers: '0', attribution: '© Land Salzburg' },
],
```

Danach erscheint die Ebene unter **Ebenen** zum Ein- und Ausschalten. Achte auf die Nutzungsbedingungen des jeweiligen Dienstes.

## Updates

Geänderte Dateien hochladen und in `sw.js` die Zeile `const CACHE = 'hofkarte-v1';` hochzählen.
