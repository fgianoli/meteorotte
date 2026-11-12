# MeteoRotte – allerte meteo lungo le rotte migratorie

Prototipo di web app (PWA) che calcola allerte meteo-idrologiche per i punti critici di:
Ventimiglia e Val Roja, i valichi alpini (Monginevro, Colle della Scala), il Carso e il FVG,
il confine Slovenia–Croazia (Kolpa/Kupa), la Bosnia (Una, Drina, Plješevica), Serbia, Bulgaria e Grecia (Evros).

Le allerte servono agli **operatori delle associazioni**, che inoltrano i messaggi multilingue
(Telegram/WhatsApp, cartelli nei punti di accoglienza). L'app **non traccia nessuno**: lavora su luoghi, non su persone.

## Avvio con Docker (consigliato)

```bash
cp .env.example .env          # compila PUBLIC_URL, CAP_SENDER, eventualmente TELEGRAM_TOKEN
docker compose up -d --build                  # web + worker
docker compose --profile bot up -d --build    # + bot Telegram
docker compose logs -f worker
```

L'app risponde su `http://server:8080` (`WEB_PORT`). Dietro il reverse proxy già attivo su studiogis.eu basta
inoltrare un sottodominio (es. `meteorotte.studiogis.eu`) alla porta 8080, con HTTPS.

| Servizio | Cosa fa |
|---|---|
| `worker` | due cicli: ogni `FAST_MIN` minuti (default 5) idrometri Hub'Eau e allerte MeteoAlarm; ogni `INTERVAL_MIN` minuti (default 60) i modelli (Open-Meteo, GloFAS, bollettini valanghe), che non cambiano più spesso. A ogni giro ricalcola le allerte e pubblica i file. Se una fonte non risponde la segnala e prosegue; senza Open-Meteo tiene i dati precedenti e riprova dopo 10 minuti |
| `web` | nginx: web app + `/api/` in sola lettura, nessun log degli accessi |
| `bot` | bot Telegram per gli operatori (profilo `bot`) |

Due volumi separati: `public` (servito dal web) e `private` (iscrizioni al bot e storico, mai esposti).

### Deploy su un server con Nginx Proxy Manager

```bash
DEPLOY_HOST=root@studiogis.eu ./deploy.sh   # clona/aggiorna in /opt/stacks/meteorotte e avvia lo stack
```

Sul server: copia `docker-compose.override.example.yml` in `docker-compose.override.yml` e indica la rete di NPM.
In NPM crea un Proxy Host verso `meteorotte-web-1:80` con certificato Let's Encrypt, Force SSL e, nella scheda Advanced, `access_log off;`.

### API pubblicate

- `/api/alerts.json` – tutti i punti: livello, pericoli, serie orarie per i grafici, idrometri, messaggi nelle 8 lingue, stato delle fonti
- `/api/feed.atom` – feed Atom delle allerte attive
- `/api/cap/<id>.xml` – un messaggio **CAP 1.2** per punto in allerta (scope *Restricted*, con la nota che non è un'allerta ufficiale)

La web app usa `/api/alerts.json` quando c'è. Altrimenti, per esempio aperta da file o su un hosting statico,
interroga direttamente Open-Meteo dal telefono.

### Bot Telegram

1. Crea il bot con @BotFather e metti il token in `TELEGRAM_TOKEN`; scegli un `BOT_ACCESS_CODE` da dare solo agli operatori.
2. L'operatore scrive `/start <codice>`, poi `/iscrivi 1 4` (oppure `tutte`), `/lingue it ar fa ti`, `/livello 2`.
3. Il bot manda un messaggio quando un punto delle sue zone raggiunge il livello scelto: testo pronto da inoltrare in tutte le lingue, più i dettagli tecnici.
   Lo stesso pericolo allo stesso livello non viene ripetuto prima di `BOT_REPEAT_HOURS`; un aumento di livello parte subito.
4. Altri comandi: `/stato`, `/punti`, `/punto <id>`, `/stop`. Funziona anche nei gruppi.

Il bot parla **solo con gli operatori**: sono loro a decidere se e dove inoltrare.

### Senza Docker

```bash
cd web && python3 -m http.server 8000             # solo web app, modalità diretta
cd server && PUBLIC_DIR=../web/api PRIVATE_DIR=./private RUN_ONCE=1 node worker.js   # un giro del worker (Node ≥ 20)
cd server && npm test                              # test motore + test end-to-end worker/bot (~70 s)
python3 tools/snap_glofas.py                       # ricalcola le celle GloFAS sui fiumi
```

## Cosa fa

| Pericolo | Dato | Soglie giallo / arancione / rosso |
|---|---|---|
| Freddo / ipotermia | temperatura percepita (Open-Meteo: ECMWF IFS, ICON, AROME) | ≤ 0 / −5 / −12 °C; pioggia con T ≤ 5 °C → almeno giallo |
| Caldo | temperatura percepita | ≥ 32 / 37 / 41 °C |
| Vento / temporali | raffiche, codice WMO ≥ 95 | 60 / 80 / 100 km/h; temporale → arancione |
| Piena improvvisa | pioggia sul punto **e sui punti a monte del bacino** | 15 / 30 / 50 mm/h oppure 50 / 100 / 150 mm/24h |
| Piena fluviale | GloFAS (Copernicus EMS) via Open-Meteo Flood API | portata prevista / mediana 30 gg ≥ 3 / 6 / 10 |
| Neve / valanghe (indicativo) | neve cumulata, neve ventata | 5 / 20 / 40 cm/24h, 20 / 40 / 70 cm/72h |
| Valanghe (ufficiale) | bollettini AINEVA/Arpa Piemonte e Météo-France in CAAMLv6, dall'aggregatore EAWS (`static.avalanche.report`), alla quota del valico | grado 2 / 3 / 4–5 della scala europea |
| Risalita del fiume (Roja) | idrometri Hub'Eau/Vigicrues a Breil, Saorge, Tenda, ogni 5–15 min | +20 / 40 / 70 cm in 1 h, oppure +30 / 60 / 100 cm in 3 h |
| Allerte ufficiali | MeteoAlarm (CAP delle protezioni civili nazionali) | colore dell'allerta; l'evento viene tradotto nel consiglio pratico corrispondente |

Le soglie sono più basse di quelle delle protezioni civili perché pensate per persone senza riparo: vanno tarate con chi lavora sul posto.
Si trovano tutte in `js/alerts.js` → `THRESHOLDS`.

Sulla mappa ci sono anche il **radar** (RainViewer, ultime 2 h con animazione) e la **griglia del vento** attuale sulla zona inquadrata.

## Struttura

```
docker-compose.yml, .env.example
web/                    web app (PWA): index.html, js/app.js, sw.js
web/js/alerts.js        motore di allerta: funzioni pure, condivise tra web e server
web/js/i18n.js          messaggi in it, en, fr, ar, fa/dari, ps, ur, ti, wo, mnk, ff
web/data/hotspots.js    punti critici, bacini a monte, celle GloFAS, aree MeteoAlarm, idrometri, numeri d'emergenza, link
server/worker.js        raccolta dati e pubblicazione (JSON, CAP, Atom, storico)
server/bot.js           bot Telegram
server/lib/             fonti dati, CAP, utilità
server/test/            test
nginx/default.conf
tools/snap_glofas.py    aggancia ogni punto fluviale alla cella GloFAS sull'asta principale
```

## Limiti noti (da leggere)

- **Roja: GloFAS non lo vede.** La cella più vicina ha portate di circa 1 m³/s: il bacino è troppo piccolo per la griglia a 0,05°.
  Per Ventimiglia l'allerta si basa sulla pioggia prevista sul bacino (Breil, Tenda) e sugli idrometri francesi in tempo reale
  (Hub'Eau). Mancano ancora gli idrometri ARPAL sul tratto italiano. Le soglie di risalita vanno tarate sulle piene storiche.
- **Aree MeteoAlarm**: un'area compare nel feed solo quando ha un'allerta attiva. Alcuni nomi (Serbia, Grecia, Tuzla) sono stime
  da verificare il primo giorno in cui risultano in allerta.
- **Rilasci delle dighe** (impianti idroelettrici in Val Roja, Isonzo, Drina): non sono nei dati aperti. Serve un accordo con i gestori.
- **Valanghe**: il worker legge i bollettini ufficiali per le micro-regioni EAWS dei valichi (IT-21-TO-03 Alpi Graie/Val di Susa, FR-13 Briançonnais). Fuori stagione (di solito fino a dicembre) i bollettini non ci sono e resta solo l'indicatore ricavato dalla neve. Per aggiungere altre zone basta indicare nel punto le micro-regioni (`eaws`) e la quota del valico (`quota`). Le altitudini "treeline" sono considerate 2000 m. Croazia e Bosnia non fanno parte di EAWS. Solo in modalità server.
- **Coordinate** dei punti e celle GloFAS: approssimative, da verificare con le associazioni.
- **Traduzioni**: bozze. Wolof, mandinka e pulaar sono le meno affidabili (segnalate come non validate nell'app e nel bot). Vanno validate da mediatori prima di qualsiasi uso, soprattutto pashto, tigrino, urdu e dari.
- **Open-Meteo gratuito** è solo per uso non commerciale. Col worker si fanno circa 50 chiamate al giorno, ben sotto i limiti.
  Per un servizio stabile conviene una chiave API (`OPENMETEO_APIKEY`) oppure un'istanza Open-Meteo propria (`OPENMETEO_URL`).
- **Tile OSM**: per un servizio pubblico vanno sostituite con tile proprie (PMTiles su studiogis.eu).

## Prossimi passi

1. **Validare con i partner** traduzioni, coordinate e soglie: Caritas Intemelia, WeWorld, Kesha Niya, Rifugio Massi, Refuges Solidaires, ICS Trieste, No Name Kitchen, SOS Balkanroute.
2. **Tarare le soglie** con lo storico che il worker salva in `private/history/` e con le piene passate (Hub'Eau ha le serie storiche).
3. **Altre fonti**: idrometri ARPAL (Roja italiano) e ARSO (Kolpa), bollettini valanghe EAWS in CAAML, EFAS/ERICHA tramite accesso CEMS.
4. **Livello cartografico statico**: alvei e zone allagabili (PGRA, ISPRA), pendii valanghivi, ripari e punti d'acqua, in PMTiles su studiogis.eu.
5. **Canale per le persone in transito**, solo dopo la validazione: canali Telegram/WhatsApp gestiti dalle associazioni, schermi nei centri, cartelli con QR.

## Avvertenze

MeteoRotte è un prototipo sperimentale, fornito senza alcuna garanzia. Non è un servizio di protezione civile e non emette allerte ufficiali.
Le allerte sono calcolate in automatico: possono esserci falsi allarmi e pericoli non segnalati; l'assenza di allerta non significa sicurezza.
Le stesse avvertenze compaiono al primo accesso alla web app, nel bot e in ogni file CAP.

Sulla mappa: bivacchi, rifugi e ripari entro 15 km dai punti (OpenStreetMap, `tools/fetch_osm.py`) e sentieri segnati (Waymarked Trails).
`web/data/aiuti.js` è predisposto per i punti di aiuto, da compilare solo con luoghi confermati dalle associazioni.

## Principi

Nessuna geolocalizzazione degli utenti, nessun account, nessun log di accesso conservato. I messaggi parlano di luoghi e di comportamenti sicuri, non di percorsi.
Ogni scheda rimanda alle allerte ufficiali, che restano prevalenti.

Dati: © OpenStreetMap · Open-Meteo (ECMWF, DWD, Météo-France) · Copernicus Emergency Management Service – GloFAS · RainViewer.

## Licenza

- **Codice**: licenza MIT (vedi `LICENSE`).
- **Contenuti propri** (elenco dei punti critici, soglie, messaggi e traduzioni, documentazione): Creative Commons Attribuzione 4.0 (CC BY 4.0).
- **Dati di terzi**: restano sotto le loro licenze. In particolare `web/data/shelters.js` deriva da OpenStreetMap ed è sotto ODbL; i dati meteo e le allerte seguono le condizioni di Open-Meteo, Copernicus, MeteoAlarm, Hub'Eau, EAWS e RainViewer.
