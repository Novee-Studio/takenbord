# Takenbord-PWA: implementatie- en testplan

## Bestanden
| Bestand | Rol |
|---|---|
| `index.html`, `app.css`, `app.js` | App (statisch, geen dependencies) |
| `manifest.webmanifest`, `icons/*.png` | Installeerbaarheid (iPad gebruikt `apple-touch-icon.png`) |
| `sw.js` | Offline cache (cache-first, versie in `VERSION`) |
| `kinder-takenbord.html` | Oorspronkelijk bestand, ongewijzigd |

## Ontwerpkeuzes
- **Opslag**: `localStorage` onder sleutel `kinder-takenbord-v2`. Elke schrijfactie wordt teruggelezen en vergeleken; mislukt dat, dan verschijnt een rode melding. Een beschadigde opslag wordt nooit overschreven maar apart bewaard (`…-corrupt-<tijd>`). `navigator.storage.persist()` wordt aangevraagd; de status staat onder Ouders ▸ Opslag.
- **Historie**: ongewijzigd formaat `kind|taak|JJJJ-MM-DD`, dus alle weken blijven bladerbaar.
- **Back-up**: JSON via deelmenu (Bewaar in Bestanden) met download als terugval. Herstellen accepteert ook de oude v1-back-ups (emoji in label wordt automatisch pictogram). Na 30 dagen zonder back-up toont de knop Ouders een rood uitroepteken.
- **Ouders**: sommen-poort (voorkomt per ongeluk wissen door kinderen), dan namen/plaatjes, taken + pictogram, back-up, week leegmaken. Wijzigingen worden direct bewaard (geen vergeten "Opslaan").
- **Kindvriendelijk**: grote vakjes (72 px), emoji-pictogram per taak en per kind, 🎉 als alle taken van vandaag klaar zijn, vandaag gemarkeerd.

## Hosting (belangrijk)
Service workers werken alleen via **HTTPS** (of `localhost`). `http://192.168.x.x` vanaf de iPad werkt dus **niet** voor installatie/offline. Opties, allemaal gratis en zonder account voor de gebruiker van de app:
1. **Gratis statische hosting** (GitHub Pages, Cloudflare Pages, Netlify): de map uploaden, URL openen op iPad. Eenvoudigst; de bestanden bevatten geen persoonsgegevens, die blijven op de iPad.
2. **Lokaal HTTPS** met `mkcert` + root-certificaat op de iPad vertrouwen (Instellingen ▸ Algemeen ▸ Info ▸ Certificaatvertrouwen). Volledig privé, meer werk.

Na de eerste keer laden is er geen netwerk meer nodig.

## Testplan iPadOS (Safari 17+)
Uitgevoerd op de ontwikkelmachine (Chromium via Playwright, `localhost`): service worker actief, cache `takenbord-v1`, offline herladen werkt, vinkjes blijven bewaard, ouder-poort, naam wijzigen, taak toevoegen, geen JS-fouten. **Nog te doen op een echte iPad** (kan hier niet getest worden):

| # | Stap | Verwacht |
|---|---|---|
| 1 | Safari: open de HTTPS-URL, wacht 5 s | Bord zichtbaar |
| 2 | Deel ▸ Zet op beginscherm | Icoon ⭐ "Takenbord" op beginscherm |
| 3 | Open vanaf beginscherm | Volledig scherm, geen Safari-balk |
| 4 | Ouders ▸ som oplossen ▸ Opslag | ✅ opslag, ✅ offline beschikbaar, ✅ geïnstalleerd |
| 5 | Vink 3 vakjes aan, wissel van kind, vorige/volgende week | Vinkjes per kind en week correct |
| 6 | App sluiten (omhoog vegen), opnieuw openen | Vinkjes er nog |
| 7 | Vliegtuigmodus aan, app sluiten en openen | Alles werkt, vinkjes zetten werkt |
| 8 | iPad herstarten, nog offline, openen | Idem |
| 9 | Ouders ▸ Back-up maken ▸ Bewaar in Bestanden | Bestand `takenbord-backup-….json` staat in Bestanden |
| 10 | Een vinkje wissen, Back-up herstellen met dat bestand | Vinkje terug; oude v1-back-up laadt ook |
| 11 | Taak hernoemen/pictogram wijzigen/verwijderen | Direct zichtbaar en na herstart behouden |
| 12 | Nieuwe versie: `VERSION` in `sw.js` ophogen, uploaden, app 2× openen met internet | Wijziging zichtbaar; data intact |
| 13 | Safari-privémodus openen | Waarschuwing "Bewaren lukt niet" mogelijk (verwacht) |

## Beloningen en vergrendeling (v3)
- Alleen vandaag en eerdere dagen van de **huidige week** zijn aan te passen; toekomst en andere weken zijn vergrendeld (bladeren blijft mogelijk). Een gemiste dag is na de week definitief.
- Vinkje: pling (toon stijgt per vinkje van die dag) + 👍. Dag compleet: jingle + sterretjes om de kolom, daarna gouden rand. Week compleet (kan alleen op zondag): confetti + muziek + scherm "Gefeliciteerd".
- Geluid: standaard aan, uit te zetten onder Ouders ▸ Geluid (met testknop). Volgt volume en stil-schakelaar van de iPad. "Beweging verminderen" schakelt animaties uit.

| # | Test op iPad | Verwacht |
|---|---|---|
| 14 | Vandaag een vinkje zetten | Pling en 👍 |
| 15 | Alle taken van vandaag afvinken | Jingle, sterretjes om de kolom, gouden rand blijft |
| 16 | Morgen/volgende week/vorige week tikken | Gedimd, reageert niet |
| 17 | Ouders ▸ Geluid uit, vinkje zetten | Wel 👍, geen geluid |
| 18 | Zondag: laatste vinkje van de week | Confetti, muziek, Gefeliciteerd-scherm |

## Bekende beperkingen
- Gegevens in een Safari-tabblad en in de geïnstalleerde app zijn **gescheiden**; migreer via back-up. Wie eerst in Safari test, begint in de app met een leeg bord.
- Apps op het beginscherm zijn uitgezonderd van Safari's 7-dagen-opschoning, maar iOS kan opslag bij zeer weinig ruimte alsnog wissen: maandelijks een back-up blijft nodig.
- De sommen-poort is een drempel voor kinderen, geen beveiliging.
- Alleen deze drie kinderen (zoals in het origineel); synchronisatie tussen apparaten bestaat niet.
