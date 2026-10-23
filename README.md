# Hof-Apps

Alle Apps in einem Repository – veröffentlicht über GitHub Pages.

| App | Ordner | Adresse (DEIN-NAME ersetzen) |
|---|---|---|
| Startseite | `/` | `https://DEIN-NAME.github.io/hof-apps/` |
| Maschinen | `maschinen/` | `…/hof-apps/maschinen/` |
| Hof-Karte | `hofkarte/` | `…/hof-apps/hofkarte/` |
| Gäste-Verwaltung | `gaeste/admin.html` | `…/hof-apps/gaeste/admin.html` |
| Gästeseite (QR-Codes) | `gaeste/` | `…/hof-apps/gaeste/` |
| Kalorien | `kalorien/` | `…/hof-apps/kalorien/` |
| Wandertagebuch | `wandertagebuch/` | `…/hof-apps/wandertagebuch/` |

## Veröffentlichen

1. GitHub › **New repository** › Name `hof-apps` › **Public** › Create.
2. **uploading an existing file** › den **Inhalt** dieses Ordners hineinziehen (am PC mit Chrome oder Edge) › **Commit changes**.
3. **Settings › Pages** › Source **Deploy from a branch** › Branch **main** › **/ (root)** › **Save**.
4. Nach 1–2 Minuten ist alles unter `https://DEIN-NAME.github.io/hof-apps/` erreichbar.

## Firebase (Maschinen, Hof-Karte, Gäste)

- Dieselben Firebase-Werte in **drei** Dateien eintragen: `maschinen/config.js`, `hofkarte/config.js`, `gaeste/config.js`.
- Firebase › Authentication › Einstellungen › **Autorisierte Domains** › `DEIN-NAME.github.io` hinzufügen.
- Firebase › Firestore › **Regeln**: Inhalt von `firestore.rules` (in diesem Hauptordner) einfügen, eigene E-Mail eintragen, veröffentlichen.

Kalorien und Wandertagebuch brauchen kein Firebase. Der Gemini-Key für die Kalorien-App wird nur in der App am Handy eingetragen – **niemals in eine Datei auf GitHub**, das Repository ist öffentlich.

## Updates

Geänderte Dateien wieder hochladen (gleicher Weg, vorhandene werden ersetzt) und in der `sw.js` der jeweiligen App die Versionsnummer in `const CACHE = '…-v1'` um eins erhöhen.
