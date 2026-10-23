# Kalorien – Installation

## 1. Dateien auf den Server

Den ganzen Ordner `kalorien/` auf deinen Server kopieren, z. B. nach `/var/www/kalorien`:

```
kalorien/
├── index.html
├── app.js
├── foods.js
├── style.css
├── sw.js
├── manifest.webmanifest
├── icons/
└── vendor/zxing.min.js
```

## 2. Caddy konfigurieren

**Variante A – eigene Subdomain** (DNS-Eintrag muss auf deinen Server zeigen):

```caddy
kalorien.deinedomain.at {
    root * /var/www/kalorien
    file_server
    encode gzip

    header /sw.js Cache-Control "no-cache"
    header /index.html Cache-Control "no-cache"
}
```

**Variante B – als Unterordner einer bestehenden Seite:**

```caddy
deinedomain.at {
    # ... deine bestehende Konfiguration ...

    handle_path /kalorien/* {
        root * /var/www/kalorien
        file_server
    }
}
```

Dann `sudo systemctl reload caddy`. Caddy holt automatisch ein HTTPS-Zertifikat – HTTPS ist Pflicht, sonst darf Safari die Kamera nicht verwenden.

## 3. Aufs iPhone

1. Die Adresse in **Safari** öffnen
2. Unten auf **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm**
3. Ab jetzt die App über das Icon starten – nur so bleiben die Daten dauerhaft gespeichert

## 4. Gratis-KI einrichten (Google Gemini)

1. <https://aistudio.google.com/apikey> öffnen, mit Google-Konto anmelden
2. **Create API key** → Key kopieren
3. In der App: Zahnrad → *KI-Fotoanalyse* → Key einfügen → **Verbindung testen** → **Speichern**

Der Gratis-Zugang hat ein Tages- und Minutenlimit, das für normales Essen-Tracken locker reicht. Im Gratis-Zugang darf Google die gesendeten Bilder zur Verbesserung seiner Dienste nutzen. Ist das Limit erreicht, weicht die App automatisch auf das Modell *Flash-Lite* aus.

Falls Google ein Modell abschaltet: In den Einstellungen unter *Modell* → *Anderes Modell eingeben …* den neuen Namen eintragen (aktuelle Namen stehen auf <https://ai.google.dev/gemini-api/docs/models>).

## Funktionen

- **Foto (KI):** Essen fotografieren → KI erkennt die Lebensmittel, schätzt Menge und Kalorien → Mengen anpassen → hinzufügen. Geht auch nur mit Textbeschreibung („2 Leberkässemmeln und ein Almdudler“).
- **Barcode:** Live-Scan mit der Kamera, Foto vom Barcode oder Nummer eintippen. Daten von Open Food Facts. Unbekannte Produkte: Nährwerttabelle fotografieren → wird auf dem Gerät gespeichert.
- **Suche:** Über 220 Lebensmittel in 13 Kategorien (Richtwerte, inkl. österreichischer Klassiker), zuletzt gegessene Lebensmittel und die Open-Food-Facts-Datenbank. Die Suche versteht auch andere Namen (Quark ↔ Topfen, Hackfleisch ↔ Faschiertes, Kartoffel ↔ Erdäpfel).
- **Eigene Lebensmittel ergänzen:** In `foods.js` eine Zeile in der passenden Kategorie hinzufügen – das Format steht oben in der Datei.
- **Tagesbilanz:** Ring mit übrigen Kalorien, Makros (Kohlenhydrate/Eiweiß/Fett), 4 Mahlzeiten, 7-Tage-Übersicht.
- **Tagesziel:** Berechnung nach Mifflin-St-Jeor aus Alter, Größe, Gewicht, Aktivität und Ziel.
- **Backup:** Export/Import als JSON-Datei (Einstellungen → Daten).

## Updates einspielen

Geänderte Dateien hochladen und in `sw.js` die Zeile `const CACHE = 'kalorien-v1';` hochzählen (v2, v3 …). Beim nächsten Öffnen holt sich die App die neue Version.

## Datenschutz

Alle Einträge liegen nur im Speicher des iPhones (localStorage). An Google gehen nur die Fotos/Beschreibungen, die du analysieren lässt; an Open Food Facts nur Barcodes und Suchbegriffe.
