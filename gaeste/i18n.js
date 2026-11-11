/* Übersetzungen für die Gästeseite (Deutsch, Englisch, Niederländisch).
   Die Texte der Gästemappe selbst werden in der Verwaltung pro Abschnitt übersetzt –
   hier stehen nur die Knöpfe/Hinweise der Seite und die Übersetzungen der Start-Texte. */
(() => {
const G = window.G;

G.LANGS = { de: 'Deutsch', en: 'English', nl: 'Nederlands' };
G.LOCALES = { de: 'de-AT', en: 'en-GB', nl: 'nl-NL' };
G.lang = 'de';

G.I18N = {
  de: {
    guestFolder: 'Eure digitale Gästemappe', welcome: 'Willkommen', tagline: 'Natur. Ruhe. Erholung.',
    unitNotFound: 'Diese Unterkunft wurde nicht gefunden. Bitte scannt den QR-Code in eurer Unterkunft noch einmal.',
    breakfast: 'Frühstück bestellen', breakfastIntro: 'Frisch vom Bäcker, mit Liebe für euch – direkt zu eurer Unterkunft',
    breakfastHof: '. Dazu gibt es Produkte von unserem Bio-Bauernhof', orderableFor: 'Für {day} bestellbar bis {deadline} (noch {left})',
    orderNow: 'Jetzt bestellen', yourOrders: 'Eure Bestellungen',
    scanQr: 'Scannt den QR-Code in eurer Unterkunft – dann seht ihr hier eure Gästemappe{bf}.', scanQrBf: ' und könnt Frühstück bestellen',
    landing: 'Drei besondere Orte – eingebettet in die wunderschöne Bergwelt am Hochkönig. Ob zu zweit, mit der Familie oder in großer Runde: Bei uns findet jeder seinen Lieblingsplatz.',
    ourPlaces: 'Unsere Unterkünfte', network: 'Netzwerk', password: 'Passwort', contact: 'Kontakt', call: 'Anrufen', email: 'E-Mail', website: 'Webseite',
    footer: 'Wir wünschen euch einen schönen Aufenthalt!',
    st_offen: 'bestellt', st_geliefert: 'geliefert', st_storniert: 'storniert', changeableUntil: 'änderbar bis {t}', cancel: 'Stornieren',
    forWhichDay: 'Für welchen Tag?', until: 'bis', yourDetails: 'Eure Angaben', name: 'Name', namePh: 'z. B. Familie Huber', spot: 'Stellplatz-Nummer',
    note: 'Anmerkung (optional)', notePh: 'z. B. Allergien, Wunschzeit', sum: 'Summe', orderFor: 'Für {day} bestellen', pickSomething: 'Bitte etwas auswählen', sending: 'Wird gesendet …',
    errName: 'Bitte gebt euren Namen an', errSpot: 'Bitte die Stellplatz-Nummer angeben',
    errDeadline: 'Der Bestellschluss für diesen Tag ({t}) ist leider vorbei. Bitte wählt einen anderen Tag.',
    errPermission: 'Die Bestellung wurde nicht angenommen – vermutlich ist der Bestellschluss vorbei. Bitte wählt einen anderen Tag.',
    errNet: 'Keine Verbindung. Bitte prüft euer Internet und versucht es nochmal.', errGeneric: 'Das hat leider nicht geklappt. Bitte versucht es nochmal oder ruft uns an.',
    thanks: 'Danke, {name}!', arrived: 'Eure Bestellung für {day} ist bei uns angekommen.', canChange: 'Ändern oder stornieren könnt ihr bis {t}.', back: 'Zurück zur Gästemappe',
    copied: 'Kopiert', confirmCancel: 'Diese Bestellung wirklich stornieren?', cancelled: 'Bestellung storniert', cancelTooLate: 'Stornieren nicht mehr möglich – der Bestellschluss ist vorbei.',
    g_baecker: 'Vom Bäcker', g_hof: 'Vom Hof', g_fleisch: 'Fleisch vom Stegerbauer',
    meatNote: 'Vakuumiert und tiefgekühlt. Abgerechnet wird nach tatsächlichem Gewicht – die Summe ist ein Richtwert.', perKg: 'pro kg', kg: 'kg', approx: 'ca.',
    weather: 'Wetter', rain: 'Regen', today: 'heute', tomorrow: 'morgen', dayAfter: 'übermorgen', yesterday: 'gestern', at: 'um', oclock: ' Uhr',
    hours: 'Std.', minutes: 'Min.', day1: 'Tag', days: 'Tagen',
    reviewTitle: 'Hat es euch gefallen?', reviewText: 'Wir würden uns riesig über eine kurze Bewertung freuen – das hilft uns als kleinem Familienbetrieb sehr.', reviewBtn: 'Bewertung schreiben',
    notTranslated: 'Einige Infos gibt es nur auf Deutsch.', language: 'Sprache',
  },
  en: {
    guestFolder: 'Your digital guest folder', welcome: 'Welcome', tagline: 'Nature. Peace. Relaxation.',
    unitNotFound: 'This accommodation was not found. Please scan the QR code in your accommodation again.',
    breakfast: 'Order breakfast', breakfastIntro: 'Fresh from the bakery – delivered right to your door',
    breakfastHof: ', plus products from our organic farm', orderableFor: 'Order for {day} until {deadline} ({left} left)',
    orderNow: 'Order now', yourOrders: 'Your orders',
    scanQr: 'Scan the QR code in your accommodation to see your guest folder{bf}.', scanQrBf: ' and order breakfast',
    landing: 'Three special places in the beautiful mountains around the Hochkönig. Whether as a couple, with the family or in a big group – everyone finds their favourite spot with us.',
    ourPlaces: 'Our accommodations', network: 'Network', password: 'Password', contact: 'Contact', call: 'Call', email: 'Email', website: 'Website',
    footer: 'We wish you a wonderful stay!',
    st_offen: 'ordered', st_geliefert: 'delivered', st_storniert: 'cancelled', changeableUntil: 'can be changed until {t}', cancel: 'Cancel',
    forWhichDay: 'For which day?', until: 'until', yourDetails: 'Your details', name: 'Name', namePh: 'e.g. Smith family', spot: 'Pitch number',
    note: 'Note (optional)', notePh: 'e.g. allergies, preferred time', sum: 'Total', orderFor: 'Order for {day}', pickSomething: 'Please choose something', sending: 'Sending …',
    errName: 'Please enter your name', errSpot: 'Please enter your pitch number',
    errDeadline: 'Sorry, the order deadline for this day ({t}) has passed. Please choose another day.',
    errPermission: 'The order was not accepted – the deadline has probably passed. Please choose another day.',
    errNet: 'No connection. Please check your internet and try again.', errGeneric: 'Sorry, that did not work. Please try again or give us a call.',
    thanks: 'Thank you, {name}!', arrived: 'We have received your order for {day}.', canChange: 'You can change or cancel it until {t}.', back: 'Back to the guest folder',
    copied: 'Copied', confirmCancel: 'Really cancel this order?', cancelled: 'Order cancelled', cancelTooLate: 'It is too late to cancel – the deadline has passed.',
    g_baecker: 'From the bakery', g_hof: 'From our farm', g_fleisch: 'Meat from our farm',
    meatNote: 'Vacuum-packed and frozen. Charged by actual weight – the total is an estimate.', perKg: 'per kg', kg: 'kg', approx: 'approx.',
    weather: 'Weather', rain: 'Rain', today: 'today', tomorrow: 'tomorrow', dayAfter: 'the day after tomorrow', yesterday: 'yesterday', at: 'at', oclock: '',
    hours: 'h', minutes: 'min', day1: 'day', days: 'days',
    reviewTitle: 'Did you enjoy your stay?', reviewText: 'We would be delighted about a short review – it helps our small family business a lot.', reviewBtn: 'Write a review',
    notTranslated: 'Some information is only available in German – your browser can translate this page.', language: 'Language',
  },
  nl: {
    guestFolder: 'Jullie digitale gastenmap', welcome: 'Welkom', tagline: 'Natuur. Rust. Ontspanning.',
    unitNotFound: 'Deze accommodatie is niet gevonden. Scan de QR-code in jullie accommodatie nog een keer.',
    breakfast: 'Ontbijt bestellen', breakfastIntro: 'Vers van de bakker – tot aan jullie deur gebracht',
    breakfastHof: ', plus producten van onze biologische boerderij', orderableFor: 'Bestellen voor {day} kan tot {deadline} (nog {left})',
    orderNow: 'Nu bestellen', yourOrders: 'Jullie bestellingen',
    scanQr: 'Scan de QR-code in jullie accommodatie om jullie gastenmap te zien{bf}.', scanQrBf: ' en ontbijt te bestellen',
    landing: 'Drie bijzondere plekken in de prachtige bergen rond de Hochkönig. Met z’n tweeën, met het gezin of in een grote groep – bij ons vindt iedereen zijn favoriete plek.',
    ourPlaces: 'Onze accommodaties', network: 'Netwerk', password: 'Wachtwoord', contact: 'Contact', call: 'Bellen', email: 'E-mail', website: 'Website',
    footer: 'Wij wensen jullie een fijn verblijf!',
    st_offen: 'besteld', st_geliefert: 'bezorgd', st_storniert: 'geannuleerd', changeableUntil: 'te wijzigen tot {t}', cancel: 'Annuleren',
    forWhichDay: 'Voor welke dag?', until: 'tot', yourDetails: 'Jullie gegevens', name: 'Naam', namePh: 'bijv. familie de Vries', spot: 'Plaatsnummer',
    note: 'Opmerking (optioneel)', notePh: 'bijv. allergieën, gewenste tijd', sum: 'Totaal', orderFor: 'Bestellen voor {day}', pickSomething: 'Kies eerst iets', sending: 'Wordt verzonden …',
    errName: 'Vul alsjeblieft jullie naam in', errSpot: 'Vul alsjeblieft het plaatsnummer in',
    errDeadline: 'Helaas is de besteltermijn voor deze dag ({t}) voorbij. Kies een andere dag.',
    errPermission: 'De bestelling is niet aangenomen – waarschijnlijk is de besteltermijn voorbij. Kies een andere dag.',
    errNet: 'Geen verbinding. Controleer jullie internet en probeer het opnieuw.', errGeneric: 'Dat is helaas niet gelukt. Probeer het opnieuw of bel ons.',
    thanks: 'Dank je wel, {name}!', arrived: 'Jullie bestelling voor {day} is bij ons binnengekomen.', canChange: 'Wijzigen of annuleren kan tot {t}.', back: 'Terug naar de gastenmap',
    copied: 'Gekopieerd', confirmCancel: 'Deze bestelling echt annuleren?', cancelled: 'Bestelling geannuleerd', cancelTooLate: 'Annuleren kan niet meer – de besteltermijn is voorbij.',
    g_baecker: 'Van de bakker', g_hof: 'Van onze boerderij', g_fleisch: 'Vlees van onze boerderij',
    meatNote: 'Vacuüm verpakt en ingevroren. Afgerekend wordt op het werkelijke gewicht – het totaal is een richtbedrag.', perKg: 'per kg', kg: 'kg', approx: 'ca.',
    weather: 'Weer', rain: 'Regen', today: 'vandaag', tomorrow: 'morgen', dayAfter: 'overmorgen', yesterday: 'gisteren', at: 'om', oclock: '',
    hours: 'u', minutes: 'min', day1: 'dag', days: 'dagen',
    reviewTitle: 'Hebben jullie het naar je zin gehad?', reviewText: 'We zouden heel blij zijn met een korte beoordeling – dat helpt ons kleine familiebedrijf enorm.', reviewBtn: 'Beoordeling schrijven',
    notTranslated: 'Sommige informatie is alleen in het Duits beschikbaar – jullie browser kan deze pagina vertalen.', language: 'Taal',
  },
};
G.t = (key, vars) => {
  const s = (G.I18N[G.lang] && G.I18N[G.lang][key]) ?? G.I18N.de[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? '')) : s;
};
// Kategorien des Bäckers
G.CAT_TR = {
  'Gebäck': { en: 'Rolls & pastries', nl: 'Broodjes' },
  Brot: { en: 'Bread', nl: 'Brood' },
  'Süßes & Feines': { en: 'Sweet treats', nl: 'Zoetigheden' },
};
G.catName = (c) => (G.lang !== 'de' && G.CAT_TR[c] && G.CAT_TR[c][G.lang]) || c;
G.pname = (p) => (p && G.lang !== 'de' && p[`name_${G.lang}`]) || (p && p.name) || '';
G.tr = (obj, key) => (obj && G.lang !== 'de' && obj[`${key}_${G.lang}`]) || (obj && obj[key]) || '';

// Produktnamen (Standard-Produkte)
G.PRODUCT_TR = {
  vollkorn: ['Wholegrain roll', 'Volkorenbolletje'], handstangerl: ['Hand-formed bread stick', 'Handgevormd stokbroodje'], laugenstangerl: ['Pretzel stick', 'Pretzelstokje'],
  milchkipferl: ['Milk croissant', 'Melkcroissantje'], brezen: ['Pretzel', 'Pretzel'], semmel: ['Bread roll (Semmel)', 'Wit broodje (Semmel)'],
  dinkelhandsemmel: ['Organic spelt roll', 'Biologisch speltbroodje'], holzofenbrot: ['Wood-fired bread', 'Brood uit de houtoven'], almwiesenbrot: ['Alpine meadow bread', 'Alpenweidebrood'],
  hausbrot: ['House bread', 'Huisbrood'], dinkelbrot: ['Spelt bread', 'Speltbrood'], wurzelbrot: ['Twisted rustic bread', 'Gedraaid boerenbrood'], bauernwecken: ['Farmhouse loaf', 'Boerenbrood'],
  baguette: ['Baguette', 'Stokbrood'], croissant: ['Croissant', 'Croissant'], nussnugatcroissant: ['Nut nougat croissant', 'Hazelnoot-nougatcroissant'],
  mohnstangerl: ['Poppy seed pastry', 'Maanzaadbroodje'], nussstangerl: ['Nut pastry', 'Notenbroodje'], topfengolatsche: ['Quark pastry (Golatsche)', 'Kwarkbroodje (Golatsche)'],
  krapfen: ['Doughnut (winter only)', 'Oliebol-donut (alleen in de winter)'], eier: ['Organic eggs from our hens (6)', 'Biologische eieren van onze kippen (6)'], marmelade: ['Homemade jam', 'Huisgemaakte jam'],
  beiried: ['Sirloin steak', 'Entrecote'], huefte: ['Rump steak', 'Biefstuk (staartstuk)'], schnitzel: ['Beef schnitzel', 'Runderschnitzel'], braten: ['Beef roast', 'Rundergebraad'],
  gulasch: ['Goulash meat', 'Goulashvlees'], faschiertes: ['Minced beef', 'Rundergehakt'], mischpaket: ['Mixed meat box 10 kg', 'Gemengd vleespakket 10 kg'],
};

// Übersetzungen der Start-Abschnitte (werden nur genutzt, solange der deutsche Text unverändert ist)
const NOTRUF_EN = '- **112** – European emergency number\n- **144** – Ambulance\n- **122** – Fire brigade\n- **133** – Police\n- **140** – Mountain rescue\n- **141** – Doctor on call\n- **1450** – Health advice line';
const NOTRUF_NL = '- **112** – Europees alarmnummer\n- **144** – Ambulance\n- **122** – Brandweer\n- **133** – Politie\n- **140** – Bergredding\n- **141** – Huisartsenpost\n- **1450** – Medisch advies';
const CARD_EN = 'With the **Hochkönig Card** you get lots of benefits as our guests:\n\n**Summer**\n- Unlimited free rides on the mountain lifts in Maria Alm, Hintermoos, Hinterthal, Dienten and Mühlbach\n- Free entry to the outdoor pools in Maria Alm and Mühlbach\n\n**Winter**\n- One free night-skiing session in Maria Alm\n- Free GoPro helmet camera rental\n- More discounts in the region\n\nJust ask us for your card.';
const CARD_NL = 'Met de **Hochkönig Card** hebben jullie als onze gasten veel voordelen:\n\n**Zomer**\n- Onbeperkt gratis met de bergbanen in Maria Alm, Hintermoos, Hinterthal, Dienten en Mühlbach\n- Gratis toegang tot het openluchtzwembad in Maria Alm en Mühlbach\n\n**Winter**\n- Eén keer gratis avondskiën in Maria Alm\n- Gratis huur van een GoPro-helmcamera\n- Meer kortingen in de regio\n\nVraag ons gewoon naar jullie kaart.';
const MUELL_EN = 'Please separate your rubbish – thank you! You will find the bins [hier eintragen].\n\n- **General waste** – black bin\n- **Organic** – brown bin\n- **Paper** – red bin\n- **Plastic & metal** – yellow bag\n- **Glass** – [hier eintragen]';
const MUELL_NL = 'Scheid alsjeblieft jullie afval – dank je wel! De containers staan [hier eintragen].\n\n- **Restafval** – zwarte bak\n- **GFT** – bruine bak\n- **Papier** – rode bak\n- **Plastic & metaal** – gele zak\n- **Glas** – [hier eintragen]';
const MEAT_LIST_EN = '- **Sirloin steak** – € 45 / kg\n- **Rump steak** – € 40 / kg\n- **Schnitzel** – € 30 / kg\n- **Beef roast** – € 20 / kg\n- **Goulash meat** – € 15 / kg\n- **Minced beef** – € 15 / kg\n- **Mixed box 10 kg** (various cuts) – € 180\n\nEverything is **vacuum-packed and frozen** – perfect to take home or for your stay. You can also order it here in the app together with your breakfast.\n\nJust ask us – we are happy to advise you!';
const MEAT_LIST_NL = '- **Entrecote** – € 45 / kg\n- **Biefstuk** – € 40 / kg\n- **Schnitzel** – € 30 / kg\n- **Rundergebraad** – € 20 / kg\n- **Goulashvlees** – € 15 / kg\n- **Rundergehakt** – € 15 / kg\n- **Gemengd pakket 10 kg** (verschillende soorten) – € 180\n\nAlles is **vacuüm verpakt en ingevroren** – perfect om mee te nemen of voor jullie verblijf. Jullie kunnen het ook hier in de app samen met het ontbijt bestellen.\n\nVraag het ons gerust – wij adviseren jullie graag!';
const RULES_EN = '- Quiet time from 10 pm to 7 am\n- Smoking outdoors only, please';
const RULES_NL = '- Nachtrust van 22:00 tot 7:00 uur\n- Roken alleen buiten, alsjeblieft';

G.SECTION_TR = {
  stegerbauer: {
    willkommen: {
      en: ['Welcome', 'How lovely that you are staying with us at the **Bio-Bauernhof Stegerbauer** organic farm in Maria Alm!\n\nComfortable holiday apartments with lots of heart and mountain views – the perfect place for a relaxing break in every season.\n\nHere you will find everything you need for your holiday. If anything is missing or not right, just let us know – we are happy to help.\n\nThe Herzog family'],
      nl: ['Hartelijk welkom', 'Fijn dat jullie bij ons op de **Bio-Bauernhof Stegerbauer** in Maria Alm zijn!\n\nComfortabele vakantieappartementen met veel liefde en uitzicht op de bergen – de perfecte plek voor ontspannen dagen in elk seizoen.\n\nHier vinden jullie alles wat belangrijk is voor jullie vakantie. Mist er iets of klopt er iets niet, laat het ons gerust weten – we helpen graag.\n\nFamilie Herzog'],
    },
    anreise: {
      en: ['Arrival & departure', '- Address: **Stegen 16, 5761 Maria Alm**\n- Check-in from **[Uhrzeit eintragen]**\n- Check-out by **[Uhrzeit eintragen]**\n- Parking: [hier eintragen]'],
      nl: ['Aankomst & vertrek', '- Adres: **Stegen 16, 5761 Maria Alm**\n- Aankomst vanaf **[Uhrzeit eintragen]**\n- Vertrek uiterlijk **[Uhrzeit eintragen]**\n- Parkeren: [hier eintragen]'],
    },
    wohnung: {
      en: ['Your apartment', 'Our **4 holiday apartments** are furnished for 2 to 5 people.\n\n- Free **Wi-Fi** – network name and password are shown above\n- Cable TV, safe\n- Kitchen with stove, dishwasher, microwave, fridge with freezer compartment, coffee machine and kettle\n- Balcony\n- For the little ones: **cot, changing mat and baby bath** – just let us know'],
      nl: ['Jullie appartement', 'Onze **4 vakantieappartementen** zijn ingericht voor 2 tot 5 personen.\n\n- Gratis **wifi** – naam en wachtwoord staan hierboven\n- Kabel-tv, kluisje\n- Keuken met fornuis, vaatwasser, magnetron, koelkast met vriesvak, koffiezetapparaat en waterkoker\n- Balkon\n- Voor de kleintjes: **babybedje, aankleedkussen en babybadje** – laat het ons gewoon weten'],
    },
    stellplatz: {
      en: ['Motorhome pitch', '**Prices per night** (1 vehicle and 1 person)\n\n**Summer**\n- without electricity: **€ 23**\n- with electricity: **€ 25**\n\n**Winter**\n- without electricity: **€ 25**\n- with electricity: **€ 30**\n\nEach additional person over 15: **€ 4** per night\n\n- Electricity, fresh water and waste disposal right at the pitch\n- Open all year round\n- About 10 minutes to the village centre\n- You can order fresh bread rolls for the next morning here in the app'],
      nl: ['Camperplaats', '**Prijzen per nacht** (1 voertuig en 1 persoon)\n\n**Zomer**\n- zonder stroom: **€ 23**\n- met stroom: **€ 25**\n\n**Winter**\n- zonder stroom: **€ 25**\n- met stroom: **€ 30**\n\nElke extra persoon ouder dan 15 jaar: **€ 4** per nacht\n\n- Stroom, vers water en afvalwaterlozing direct bij de plaats\n- Het hele jaar geopend\n- Ongeveer 10 minuten naar het dorpscentrum\n- Verse broodjes voor de volgende ochtend kunnen jullie hier in de app bestellen'],
    },
    tiere: {
      en: ['Our animals', 'Our farm is home to **suckler cows with calves and bulls, Noriker horses and ponies with foals, sheep, goats, chickens, rabbits, cats** and our farm dog **Lea**.\n\nIn summer most of the animals are up on the alpine pasture – you can visit them there. The goats, sheep, chickens, cats and Lea stay at the farm.\n\nPlease only feed the animals after checking with us.'],
      nl: ['Onze dieren', 'Op onze boerderij wonen **zoogkoeien met kalveren en stieren, Noriker-paarden en pony’s met veulens, schapen, geiten, kippen, konijnen, katten** en onze boerderijhond **Lea**.\n\nIn de zomer staan de meeste dieren boven op de alm – daar kunnen jullie ze bezoeken. Geiten, schapen, kippen, katten en Lea blijven op de boerderij.\n\nGeef de dieren alleen te eten na overleg met ons.'],
    },
    fleisch: {
      en: ['Meat from our farm', 'The best meat from our own animals – raised with great care and of the highest quality.\n\n' + MEAT_LIST_EN],
      nl: ['Vlees van onze boerderij', 'Het beste vlees van onze eigen dieren – met veel zorg grootgebracht en van de beste kwaliteit.\n\n' + MEAT_LIST_NL],
    },
    spielplatz: {
      en: ['Playground', 'In front of the house there is a big playground with a **slide, swing, sandpit, playhouse, climbing tower, trampolines, slackline, go-karts and toy tractors** – and a small fish pond.\n\nPlease keep an eye on the little ones, especially near the pond.'],
      nl: ['Speeltuin', 'Voor het huis is een grote speeltuin met **glijbaan, schommel, zandbak, speelhuisje, klimtoren, trampolines, slackline, skelters en speelgoedtractoren** – en een kleine visvijver.\n\nLet alsjeblieft goed op de kleintjes, vooral bij de vijver.'],
    },
    hausregeln: {
      en: ['House rules', RULES_EN + '\n- Pets are welcome (one-off fee € 20)\n- We are a working farm: please do not leave children unattended near the barn, the machines or in the farmyard.'],
      nl: ['Huisregels', RULES_NL + '\n- Huisdieren zijn welkom (eenmalig € 20)\n- Wij zijn een werkend boerenbedrijf: laat kinderen niet zonder toezicht bij de stal, de machines of op het erf.'],
    },
    card: { en: ['Hochkönig Card', CARD_EN], nl: ['Hochkönig Card', CARD_NL] },
    tipps: {
      en: ['Excursion tips', '**Summer**\n- **Abergbahn** cable car – just a few minutes’ walk from us\n- **Natrun adventure mountain**\n- Hiking in the **Steinernes Meer** and around the **Hochkönig**\n- Mountain biking and golf in Maria Alm\n\n**Winter**\n- Hochkönig ski area – the Abergbahn is right nearby\n- Cross-country skiing and tobogganing\n\nWeather & webcam: https://www.urlaub-hochkoenig.at/maria-alm-land-salzburg/wetter-webcam-maria-alm'],
      nl: ['Uitstapjes', '**Zomer**\n- **Abergbahn** – op een paar minuten lopen\n- **Belevenisberg Natrun**\n- Wandelen in het **Steinernes Meer** en rond de **Hochkönig**\n- Mountainbiken en golf in Maria Alm\n\n**Winter**\n- Skigebied Hochkönig – de Abergbahn ligt vlakbij\n- Langlaufen en rodelen\n\nWeer & webcam: https://www.urlaub-hochkoenig.at/maria-alm-land-salzburg/wetter-webcam-maria-alm'],
    },
    muell: { en: ['Rubbish & recycling', MUELL_EN], nl: ['Afval & recycling', MUELL_NL] },
    notfall: {
      en: ['Emergency & important numbers', NOTRUF_EN + '\n\nNearest doctor: [hier eintragen]\nNearest pharmacy: [hier eintragen]'],
      nl: ['Noodgevallen & belangrijke nummers', NOTRUF_NL + '\n\nDichtstbijzijnde arts: [hier eintragen]\nDichtstbijzijnde apotheek: [hier eintragen]'],
    },
  },
  alm: {
    willkommen: {
      en: ['Welcome', 'How lovely that you are staying at the **Nösslau Alm**!\n\nYour hut lies at around **1,220 m**, just outside Dienten am Hochkönig – in a quiet, sunny, secluded spot with a view.\n\nOur rustic self-catering hut is ideal for families, friends or clubs (10 to 15 people) – pure nature and unforgettable moments in the mountains.\n\nIf you need anything, just get in touch with us at any time.\n\nThe Herzog family'],
      nl: ['Hartelijk welkom', 'Fijn dat jullie op de **Nösslau Alm** zijn!\n\nJullie hut ligt op ongeveer **1.220 m**, net buiten Dienten am Hochkönig – rustig, zonnig en vrijstaand met uitzicht.\n\nOnze sfeervolle alm voor zelfverzorgers is ideaal voor gezinnen, vrienden of verenigingen (10 tot 15 personen) – pure natuur en onvergetelijke momenten in de bergen.\n\nAls jullie iets nodig hebben, neem dan gerust contact met ons op.\n\nFamilie Herzog'],
    },
    anreise: {
      en: ['Arrival & departure', '- Check-in from **[Uhrzeit eintragen]**\n- Check-out by **[Uhrzeit eintragen]**\n- In high season the hut is let from **Saturday to Saturday**\n- Keys: [hier eintragen]\n\n**In winter** you need a **four-wheel-drive vehicle and snow chains**. If the snow conditions are difficult, there is a car park right by the hut.'],
      nl: ['Aankomst & vertrek', '- Aankomst vanaf **[Uhrzeit eintragen]**\n- Vertrek uiterlijk **[Uhrzeit eintragen]**\n- In het hoogseizoen wordt verhuurd van **zaterdag tot zaterdag**\n- Sleutels: [hier eintragen]\n\n**In de winter** hebben jullie een **auto met vierwielaandrijving en sneeuwkettingen** nodig. Bij lastige sneeuwomstandigheden is er een parkeerplaats direct bij de hut.'],
    },
    huette: {
      en: ['The hut', '- **5 bedrooms** (3 double rooms, one of them with bunk beds, and 2 multi-bed rooms)\n- Large, cosy **living room** with tiled stove\n- Kitchen with electric cooker and oven, **wood-burning stove**, dishwasher, microwave, coffee machine, toaster, kettle and fridge\n- **3 toilets, 2 showers and a sauna**\n- TV and radio\n- Terrace and balcony\n- Drying room for clothes and shoes\n- Storage cellar with chest freezer'],
      nl: ['De hut', '- **5 slaapkamers** (3 tweepersoonskamers, waarvan één met stapelbed, en 2 meerpersoonskamers)\n- Grote, gezellige **woonkamer** met tegelkachel\n- Keuken met elektrisch fornuis en oven, **houtfornuis**, vaatwasser, magnetron, koffiezetapparaat, broodrooster, waterkoker en koelkast\n- **3 toiletten, 2 douches en sauna**\n- Tv en radio\n- Terras en balkon\n- Droogruimte voor kleding en schoenen\n- Voorraadkelder met vrieskist'],
    },
    heizen: {
      en: ['Heating with wood', 'You heat the hut yourselves with wood – we provide the firewood. You will find it [hier eintragen].\n\n- Always close the stove doors after adding wood\n- Only put ashes in the ash bucket once they are completely cold – never in the rubbish\n- Please do not add more wood before going to bed'],
      nl: ['Stoken met hout', 'Jullie verwarmen de hut zelf met hout – het hout krijgen jullie van ons. Het ligt [hier eintragen].\n\n- Sluit de kacheldeurtjes altijd na het bijvullen\n- Doe de as pas helemaal afgekoeld in de asemmer – nooit bij het afval\n- Leg voor het slapengaan geen hout meer bij'],
    },
    kuehe: {
      en: ['Cows on the alpine pasture', 'From spring to autumn **suckler cows with their calves** graze around the hut.\n\n- Please keep your distance and never walk between a cow and her calf\n- Keep dogs on a short lead\n- Close the pasture gates behind you'],
      nl: ['Koeien op de alm', 'Van het voorjaar tot de herfst grazen **zoogkoeien met hun kalveren** rond de hut.\n\n- Houd afstand en loop nooit tussen een koe en haar kalf\n- Honden aan de korte lijn\n- Sluit de weidehekken weer achter jullie'],
    },
    fleisch: {
      en: ['Meat from our farm', 'The best meat from our own animals at the **Bio-Bauernhof Stegerbauer** in Maria Alm – ideal for grilling and cooking at the hut.\n\n' + MEAT_LIST_EN],
      nl: ['Vlees van onze boerderij', 'Het beste vlees van onze eigen dieren van de **Bio-Bauernhof Stegerbauer** in Maria Alm – ideaal om te grillen en te koken in de hut.\n\n' + MEAT_LIST_NL],
    },
    card: { en: ['Hochkönig Card', CARD_EN], nl: ['Hochkönig Card', CARD_NL] },
    tipps: {
      en: ['Excursion tips', 'Around Dienten there are many hiking trails with wonderful views of the Hochkönig.\n\n- [Wanderung – Gehzeit, Einkehr]\n- [Hütten-Tipp]\n- [Ausflug bei Schlechtwetter]\n\nWeather: https://www.almhuette-hochkoenig.at/wetter-in-maria-alm'],
      nl: ['Uitstapjes', 'Rond Dienten zijn veel wandelpaden met een prachtig uitzicht op de Hochkönig.\n\n- [Wanderung – Gehzeit, Einkehr]\n- [Hütten-Tipp]\n- [Ausflug bei Schlechtwetter]\n\nWeer: https://www.almhuette-hochkoenig.at/wetter-in-maria-alm'],
    },
    muell: { en: ['Rubbish & recycling', MUELL_EN], nl: ['Afval & recycling', MUELL_NL] },
    notfall: {
      en: ['Emergency & important numbers', NOTRUF_EN + '\n\nWhen calling the emergency services say: **“Nösslau Alm above Dienten am Hochkönig”**\nExact location: [GPS-Koordinaten eintragen]\n\nNearest doctor: [hier eintragen]'],
      nl: ['Noodgevallen & belangrijke nummers', NOTRUF_NL + '\n\nZeg bij een noodoproep: **“Nösslau Alm boven Dienten am Hochkönig”**\nExacte locatie: [GPS-Koordinaten eintragen]\n\nDichtstbijzijnde arts: [hier eintragen]'],
    },
  },
  schoberhof: {
    willkommen: {
      en: ['Welcome', 'How lovely that you are staying at the **Schoberhof** self-catering house!\n\nThe house lies at around **1,100 m**, about 3 km from Dienten am Hochkönig – quiet and sunny, surrounded by meadows and forests. Children can run around freely here.\n\nPlenty of space for time together (15 to 23 people) – perfect for groups, relaxation and peaceful moments.\n\nIf you need anything, just get in touch with us at any time.\n\nThe Herzog family'],
      nl: ['Hartelijk welkom', 'Fijn dat jullie in het **vakantiehuis Schoberhof** zijn!\n\nHet huis ligt op ongeveer **1.100 m**, zo’n 3 km van Dienten am Hochkönig – rustig en zonnig, midden tussen weilanden en bossen. Hier kunnen de kinderen vrij rondrennen.\n\nVeel ruimte om samen te zijn (15 tot 23 personen) – perfect voor groepen, ontspanning en rustige momenten.\n\nAls jullie iets nodig hebben, neem dan gerust contact met ons op.\n\nFamilie Herzog'],
    },
    anreise: {
      en: ['Arrival & departure', '- Address: **Lindlweg 5, 5761 Maria Alm**\n- Check-in from **[Uhrzeit eintragen]**\n- Check-out by **[Uhrzeit eintragen]**\n- Parking right at the house – even with lots of snow\n- Keys: [hier eintragen]\n\n**In winter** you need a **four-wheel-drive vehicle and snow chains**.'],
      nl: ['Aankomst & vertrek', '- Adres: **Lindlweg 5, 5761 Maria Alm**\n- Aankomst vanaf **[Uhrzeit eintragen]**\n- Vertrek uiterlijk **[Uhrzeit eintragen]**\n- Parkeerplaatsen direct bij het huis – ook bij veel sneeuw\n- Sleutels: [hier eintragen]\n\n**In de winter** hebben jullie een **auto met vierwielaandrijving en sneeuwkettingen** nodig.'],
    },
    haus: {
      en: ['The house', '- **10 bedrooms**\n- Large farmhouse **parlour** with tiled stove, TV and **Wi-Fi** (network name and password are shown above)\n- Kitchen with dishwasher, microwave, coffee machine, fridge and freezer\n- **6 showers and 8 toilets**\n- **Washing machine and tumble dryer**\n- **Sauna**\n- Balcony and 2 terraces'],
      nl: ['Het huis', '- **10 slaapkamers**\n- Grote **boerenkamer** met tegelkachel, tv en **wifi** (naam en wachtwoord staan hierboven)\n- Keuken met vaatwasser, magnetron, koffiezetapparaat, koelkast en vriezer\n- **6 douches en 8 toiletten**\n- **Wasmachine en droger**\n- **Sauna**\n- Balkon en 2 terrassen'],
    },
    fischteich: {
      en: ['Fish pond', 'You can **catch trout** in the pond belonging to the house.\n\n[Angelausrüstung, Preis pro Fisch und Regeln hier eintragen]'],
      nl: ['Visvijver', 'In de eigen visvijver kunnen jullie **forel vangen**.\n\n[Angelausrüstung, Preis pro Fisch und Regeln hier eintragen]'],
    },
    essen: {
      en: ['Food & celebrations', '- Inns with traditional cuisine are not far away\n- **Party catering** on request – just ask us'],
      nl: ['Eten & feesten', '- Restaurants met traditionele keuken zijn niet ver weg\n- **Partyservice** op aanvraag – vraag het ons gerust'],
    },
    fleisch: {
      en: ['Meat from our farm', 'The best meat from our own animals at the **Bio-Bauernhof Stegerbauer** in Maria Alm – ideal for a big group.\n\n' + MEAT_LIST_EN],
      nl: ['Vlees van onze boerderij', 'Het beste vlees van onze eigen dieren van de **Bio-Bauernhof Stegerbauer** in Maria Alm – ideaal voor een grote groep.\n\n' + MEAT_LIST_NL],
    },
    hausregeln: {
      en: ['House rules', RULES_EN + '\n- [weitere Regeln hier eintragen]'],
      nl: ['Huisregels', RULES_NL + '\n- [weitere Regeln hier eintragen]'],
    },
    card: { en: ['Hochkönig Card', CARD_EN], nl: ['Hochkönig Card', CARD_NL] },
    tipps: {
      en: ['Excursion tips', '- Hochkönig ski area – lifts in Dienten very close by\n- Hiking around Dienten and Maria Alm\n- [eigener Tipp]\n\nWeather: https://www.ferienhaus-dienten.at/wetter-in-maria-alm'],
      nl: ['Uitstapjes', '- Skigebied Hochkönig – liften in Dienten vlakbij\n- Wandelen rond Dienten en Maria Alm\n- [eigener Tipp]\n\nWeer: https://www.ferienhaus-dienten.at/wetter-in-maria-alm'],
    },
    muell: { en: ['Rubbish & recycling', MUELL_EN], nl: ['Afval & recycling', MUELL_NL] },
    notfall: {
      en: ['Emergency & important numbers', NOTRUF_EN + '\n\nAddress for emergency calls: **Schoberhof, Lindlweg 5, near Dienten am Hochkönig**\n\nNearest doctor: [hier eintragen]'],
      nl: ['Noodgevallen & belangrijke nummers', NOTRUF_NL + '\n\nAdres voor noodoproepen: **Schoberhof, Lindlweg 5, bij Dienten am Hochkönig**\n\nDichtstbijzijnde arts: [hier eintragen]'],
    },
  },
};
G.PROPERTY_TR = {
  stegerbauer: { subtitle: ['4 holiday apartments for 2–5 people · Maria Alm', '4 vakantieappartementen voor 2–5 personen · Maria Alm'],
    deliveryText: ['We bring the bread to your apartment or motorhome in the morning.', 'Wij brengen het brood ’s ochtends naar jullie appartement of camper.'] },
  alm: { subtitle: ['Self-catering hut for 10–15 people · Dienten am Hochkönig', 'Zelfverzorgingshut voor 10–15 personen · Dienten am Hochkönig'],
    deliveryText: ['Bread service in the winter season – we bring the bread to the hut in the morning.', 'Broodservice in het winterseizoen – wij brengen het brood ’s ochtends naar de hut.'] },
  schoberhof: { subtitle: ['Self-catering house for 15–23 people · Dienten am Hochkönig', 'Vakantiehuis voor zelfverzorgers voor 15–23 personen · Dienten am Hochkönig'],
    deliveryText: ['Bread service in the winter season – we bring the bread to the house in the morning.', 'Broodservice in het winterseizoen – wij brengen het brood ’s ochtends naar het huis.'] },
};

// Übersetzungen auf Start-Inhalte anwenden (nur wo Felder noch leer sind)
G.applyDefaultTranslations = (props) => (props || []).map((p) => {
  const ptr = G.PROPERTY_TR[p.id];
  const np = { ...p };
  if (ptr) ['subtitle', 'deliveryText'].forEach((k) => { if (!np[`${k}_en`] && ptr[k]) { np[`${k}_en`] = ptr[k][0]; np[`${k}_nl`] = ptr[k][1]; } });
  const str = G.SECTION_TR[p.id] || {};
  np.sections = (p.sections || []).map((s) => {
    const t = str[s.id];
    if (!t || s.title_en || s.text_en) return s;
    return { ...s, title_en: t.en[0], text_en: t.en[1], title_nl: t.nl[0], text_nl: t.nl[1], trSrc: G.hash(`${s.title}\n${s.text}`) };
  });
  return np;
});
G.applyProductTranslations = (products) => (products || []).map((p) => {
  const t = G.PRODUCT_TR[p.id];
  return t && !p.name_en ? { ...p, name_en: t[0], name_nl: t[1] } : p;
});
})();
