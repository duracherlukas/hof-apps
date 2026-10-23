# Gäste-App – Gästemappe & Frühstücksbestellung

Die App besteht aus zwei Seiten:

| Seite | Für wen | Wie aufrufen |
|---|---|---|
| `index.html` | **Gäste** – Gästemappe, WLAN, Frühstück bestellen | per QR-Code in der Unterkunft |
| `admin.html` | **Dich** – Bestellungen, Bäckerei-Liste, Abrechnung, Inhalte | als App am Handy |

**Bestellschluss:** Gäste können bis **17:00 Uhr am Vortag** bestellen (österreichische Zeit, auch wenn das Handy des Gastes anders eingestellt ist). Danach ist die Liste fix – du hast bis 18:00 Uhr Zeit, beim Bäcker zu bestellen. Die Uhrzeit lässt sich in den Einstellungen ändern.

---

## Teil A – Ausprobieren (Demo-Modus)

Ordner entpacken und `admin.html` doppelklicken. In einem zweiten Tab `index.html` öffnen und oben im gelben Kasten eine Unterkunft wählen. Im Demo-Modus funktioniert alles, die Daten bleiben aber nur auf diesem PC.

---

## Teil B – Online stellen mit GitHub Pages

Genau wie bei der Maschinen-App:

1. Auf GitHub ein neues **Public** Repository anlegen, z. B. `gaeste`.
2. **Inhalt** des Ordners `gaeste/` hochladen (alle Dateien plus die Ordner `icons` und `vendor`).
3. **Settings › Pages** › Branch **main**, Ordner **/ (root)** › Save.
4. Nach 1–2 Minuten erreichbar unter
   - Gäste: `https://DEIN-NAME.github.io/gaeste/`
   - Verwaltung: `https://DEIN-NAME.github.io/gaeste/admin.html`

---

## Teil C – Firebase verbinden (gemeinsame Daten)

Am einfachsten verwendest du **dasselbe Firebase-Projekt wie für die Maschinen-App**. Dann gelten auch dieselben Konten.

1. In `config.js` dieselben Firebase-Werte eintragen wie in der `config.js` der Maschinen-App (auf GitHub: Datei öffnen › Stift › einfügen › Commit).
2. In Firebase › **Firestore Database › Regeln**: den kompletten Inhalt von `firestore.rules` (liegt im Hauptordner `hof-apps`) einfügen, deine E-Mail(s) eintragen › **Veröffentlichen**.
   Diese Datei enthält die Regeln für **beide** Apps – sie ersetzt die alte Regel-Datei der Maschinen-App.
3. Falls die Gäste-App unter einer anderen Adresse läuft als die Maschinen-App: in Firebase › **Authentication › Einstellungen › Autorisierte Domains** die Domain ergänzen (bei GitHub Pages ist es dieselbe `DEIN-NAME.github.io`, also nichts zu tun).

Noch kein Firebase-Projekt? Dann zuerst Teil B der Anleitung der Maschinen-App durchgehen.

**Was die Regeln schützen:**
- Gäste können die Gästemappe lesen und **nur ihre eigene Unterkunft** abrufen (über den QR-Code), aber keine Liste aller Unterkünfte oder fremde Bestellungen sehen.
- Bestellungen werden **vom Server** abgelehnt, wenn der Bestellschluss vorbei ist – auch wenn jemand die Seite manipuliert.
- Gäste können nur **stornieren**, und nur bis zum Bestellschluss.
- Ändern, Abhaken und Abrechnen geht nur mit deinem Konto.

---

## Teil D – Einrichten

1. `admin.html` öffnen und anmelden. Beim ersten Start werden Beispielinhalte angelegt.
2. **Gästemappe:** Texte anpassen – überall wo `[hier eintragen]` steht. Formatierung: `**fett**`, Zeilen mit `- ` werden Aufzählungen, Telefonnummern und Links werden automatisch anklickbar.
3. **Unterkünfte:** Namen, WLAN-Name und -Passwort eintragen. Bei Camping „Nach Stellplatz-Nummer fragen“ einschalten, bei der Almhütte das Frühstück ausschalten.
4. **Einstellungen:** Produkte und Preise anpassen (Bäcker oder vom Hof), WhatsApp-Nummer der Bäckerei und eure Kontaktdaten eintragen.
5. **Unterkünfte › QR-Codes für alle drucken** – ausschneiden, laminieren, in jede Unterkunft hängen.
6. Verwaltung als App aufs Handy:
   - **iPhone:** `admin.html` in Safari › Teilen › Zum Home-Bildschirm
   - **Android:** in Chrome › Menü ⋮ › App installieren

---

## Täglicher Ablauf

1. **Bis 17:00 Uhr** bestellen die Gäste für den nächsten Morgen. Die Verwaltung zeigt einen Countdown.
2. **Nach 17:00 Uhr** steht oben „Bestellschluss vorbei – jetzt beim Bäcker bestellen“. Unter **Für die Bäckerei** sind alle Unterkünfte zusammengezählt → **WhatsApp** tippen, die fertige Nachricht geht an die Bäckerei. (Oder **Teilen** / **Kopieren** für SMS oder E-Mail.)
3. **Vom Hof herrichten** zeigt, wie viel Milch, Eier usw. du vorbereiten musst.
4. **In der Früh** mit der **Verteilliste** ausliefern und abhaken – die Gäste sehen „geliefert“.
5. **Bei der Abreise** unter **Abrechnung** die Summe der Unterkunft kassieren und auf „bezahlt“ tippen.

Tipp: Stell dir am Handy einen täglichen Wecker um 17:00 Uhr als Erinnerung.

---

## Updates einspielen

Geänderte Dateien auf GitHub hochladen und in `sw.js` die Zeile `const CACHE = 'gaeste-v1';` hochzählen (`v2`, `v3` …).

## Kosten

Nichts – GitHub Pages und der Firebase-Gratistarif reichen für einen Hof um ein Vielfaches.
