# Hof-Maschinen – Einrichtung

Die App läuft auf **iPhone und Android** als Web-App. Hosting über **GitHub Pages**, gemeinsame Daten über **Firebase** – beides kostenlos, kein eigener Server nötig.

Ablauf: Erst auf GitHub hochladen und im Demo-Modus ausprobieren (Teil A), dann Firebase für gemeinsame Daten einrichten (Teil B).

---

## Teil A – App auf GitHub Pages veröffentlichen (ca. 10 Minuten)

1. Auf <https://github.com> ein kostenloses Konto anlegen (falls noch nicht vorhanden).
2. Oben rechts **+ › New repository**
   - Name: `hof-maschinen`
   - **Public** auswählen (GitHub Pages ist nur für öffentliche Repositories gratis)
   - **Create repository**
3. Auf der neuen Seite **uploading an existing file** anklicken und den **Inhalt** des Ordners `maschinen/` hineinziehen (alle Dateien **und** den Ordner `icons`). Am besten am PC mit Chrome oder Edge – die können ganze Ordner hochladen. Unten **Commit changes**.
4. Im Repository **Settings › Pages**
   - Source: **Deploy from a branch**
   - Branch: **main**, Ordner **/ (root)** › **Save**
5. Nach 1–2 Minuten ist die App erreichbar unter
   `https://DEIN-GITHUB-NAME.github.io/hof-maschinen/`

Jetzt läuft die App im **Demo-Modus** – zum Ausprobieren perfekt, die Daten bleiben aber nur auf dem jeweiligen Handy.

### Aufs Handy holen

- **iPhone:** Adresse in **Safari** öffnen › **Teilen** › **Zum Home-Bildschirm**
- **Android:** Adresse in **Chrome** öffnen › Menü **⋮** › **App installieren** (oder „Zum Startbildschirm hinzufügen“)

---

## Teil B – Gemeinsame Daten mit Firebase (ca. 15 Minuten)

### 1. Projekt anlegen
1. <https://console.firebase.google.com> öffnen, mit deinem Google-Konto anmelden.
2. **Projekt erstellen** › Name z. B. `hof-maschinen` › Google Analytics **ausschalten** › erstellen.
   Du bleibst im kostenlosen **Spark-Tarif** – keine Kreditkarte nötig.

### 2. Anmeldung einrichten
1. Links **Build › Authentication** › **Jetzt starten**.
2. Reiter **Anmeldemethode** › **E-Mail/Passwort** › aktivieren › Speichern.
3. Reiter **Nutzer** › **Nutzer hinzufügen** – für jede Person am Hof E-Mail und Passwort eintragen (auch für dich).
4. Reiter **Einstellungen › Autorisierte Domains** › **Domain hinzufügen** › `DEIN-GITHUB-NAME.github.io`

### 3. Datenbank anlegen
1. Links **Build › Firestore Database** › **Datenbank erstellen**.
2. Standort: **europe-west3 (Frankfurt)** – liegt nah an Österreich.
3. **Im Produktionsmodus starten**.
4. Reiter **Regeln**: Den Inhalt der Datei `firestore.rules` (liegt im Hauptordner `hof-apps`) hineinkopieren, bei `deine.email@gmail.com` deine E-Mail eintragen und weitere Personen ergänzen, z. B.:
   ```
   'lukas@gmail.com',
   'papa@gmx.at'
   ```
   › **Veröffentlichen**.
   Nur diese E-Mail-Adressen können die Daten lesen und ändern.

### 4. App mit Firebase verbinden
1. In Firebase oben links auf **Projektübersicht** (Zahnrad) › **Projekteinstellungen**.
2. Unten bei „Meine Apps“ auf **</>** (Web) klicken › Name `hof-maschinen` › **App registrieren** (Firebase Hosting **nicht** anhaken).
3. Es erscheint ein Code-Block mit `firebaseConfig`. Die Werte (`apiKey`, `authDomain`, `projectId`, …) in die Datei `config.js` übertragen.
4. Auf GitHub: Datei `config.js` öffnen › **Stift-Symbol** (bearbeiten) › Werte einfügen › **Commit changes**.

Nach 1–2 Minuten zeigt die App einen Anmeldebildschirm. Mit der E-Mail und dem Passwort aus Schritt 2 anmelden – ab jetzt sehen alle dieselben Daten.

> Die Werte in `config.js` sind kein Geheimnis – sie stehen bei jeder Firebase-Web-App öffentlich im Code. Geschützt werden die Daten durch die Regeln aus Schritt 3. Passwörter gehören **nie** in eine Datei auf GitHub.

---

## Updates einspielen

1. Geänderte Dateien auf GitHub hochladen (gleich wie in Teil A, Schritt 3 – vorhandene Dateien werden ersetzt).
2. In `sw.js` die Zeile `const CACHE = 'hof-maschinen-v1';` hochzählen (`v2`, `v3` …), damit die Handys die neue Version laden.

**Profi-Variante mit Git:**
```bash
git clone https://github.com/DEIN-GITHUB-NAME/hof-maschinen.git
cd hof-maschinen
# Dateien ändern …
git add .
git commit -m "Update"
git push
```
Ohne Kommandozeile geht's bequem mit **GitHub Desktop** (<https://desktop.github.com>).

---

## Funktionen

- **Übersicht:** Was überfällig oder bald fällig ist (Pickerl, Service), Kosten des Jahres, letzte Einträge
- **Maschinen:** Traktoren, Motorrad, Auto, Anhänger, Geräte – mit Betriebsstunden oder Kilometern
- **Pickerl (§57a):** Fälligkeitsmonat, Hinweis auf die Nachfrist (bis 4 Monate nach dem Monat), nach der Überprüfung automatisch der nächste Termin
- **Wartungsintervalle:** z. B. Ölwechsel alle 250 h oder 12 Monate – fällig ist, was zuerst eintritt
- **Einträge:** Stunden/Kilometer, Service, Reparatur, Pickerl, Tanken, Sonstiges – mit Kosten, Notiz und wer es eingetragen hat
- **Kosten:** pro Jahr, pro Maschine, pro Art, Kosten pro Betriebsstunde; Export als CSV für Excel
- **Kalender:** Pickerl- und Service-Termine mit Erinnerung eine Woche vorher in den Handy-Kalender übernehmen
- **Offline:** Einträge funktionieren auch ohne Empfang und werden später synchronisiert
- **Backup:** Komplett-Export und -Import als JSON (Zahnrad oben rechts)

## Kosten

Nichts. Der kostenlose Firebase-Tarif erlaubt u. a. 50.000 Lesevorgänge und 20.000 Schreibvorgänge pro Tag – für einen Hof reicht das um ein Vielfaches.
