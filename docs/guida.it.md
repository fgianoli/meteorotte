# MeteoRotte – Guida all'uso

## 1. Che cos'è

MeteoRotte segnala i pericoli legati al meteo (piene, freddo, neve e valanghe, vento, caldo) nei luoghi attraversati dalle persone migranti tra Ventimiglia, le Alpi, il Carso e la rotta balcanica. È pensata per gli operatori e i volontari, che inoltrano gli avvisi alle persone.

**Non è un servizio di protezione civile.** Le allerte sono calcolate in automatico e non sostituiscono quelle ufficiali. Verde non significa sicuro.

## 2. I colori

- **Verde**: nessuna soglia superata nelle prossime 72 ore.
- **Giallo**: attenzione.
- **Arancione**: pericolo, conviene avvisare le persone.
- **Rosso**: pericolo grave.

Le soglie sono più prudenti di quelle usate per la popolazione generale, perché pensate per chi è all'aperto senza riparo.

## 3. La mappa

I cerchi sono i punti critici: il colore è il livello di allerta, l'icona il pericolo principale. Dal riquadro in alto a destra (sul telefono: l'icona dei livelli) si accendono:

- **Allerte ufficiali per area**: regioni italiane e dipartimenti francesi con un'allerta in vigore.
- **Idrometri**: livello dei fiumi, con il bordo colorato secondo lo stato.
- **Pericolo valanghe**: le zone dei bollettini, scala europea da 1 a 5.
- **Stazioni meteo**: temperatura misurata; toccando, vento e neve al suolo.
- **Radar pioggia**, **vento**, **sentieri segnati** (estivi: con la neve non si vedono), **bivacchi e ripari liberi**, **punti di aiuto**.

Toccando un'area, un idrometro o una stazione si apre il dettaglio.

## 4. La scheda di un punto

Toccando un punto, sulla mappa o nell'elenco, si vede:

- la **striscia delle 72 ore**: il livello previsto ora per ora, da adesso a tre giorni;
- le **ore di buio**, il dato **misurato** dalla stazione meteo più vicina e il livello degli **idrometri** con le soglie;
- l'elenco dei **pericoli**, con il momento in cui iniziano e la fonte;
- il **messaggio** pronto da inoltrare e i link alle allerte ufficiali.

## 5. Messaggi e lingue

Scegli la lingua in alto (*Lingua messaggio*). **Copia messaggio** lo copia per incollarlo su WhatsApp o Telegram; **Copia in tutte le lingue** li copia tutti insieme. **Cartello** apre una versione a schermo intero, da proiettare o stampare, con il QR dell'app.

Le traduzioni sono bozze. Quelle segnalate come non validate (wolof, mandinka, pulaar) non vanno inoltrate prima di averle fatte controllare a un madrelingua.

## 6. Avvisi di prossimità

Il tasto **Avvisami se sono in un punto pericoloso** usa il GPS del telefono: quando ci si trova vicino a un punto critico compare l'avviso e il telefono vibra. Nel letto di un fiume l'avviso compare sempre, anche senza allerta.

La posizione resta sul telefono: non viene inviata né salvata. Funziona solo con l'app aperta.

## 7. Ricevere gli avvisi

- **Notifiche** (tasto con la campana): un avviso sul telefono da arancione in su, per la zona e la lingua selezionate. Su iPhone bisogna prima aggiungere l'app alla schermata Home.
- **Bot Telegram**, riservato agli operatori: `/start codice`, poi `/zone`, `/iscrivi 1 3` oppure `/iscrivi tutte`, `/lingue it ar fa`, `/livello 2`. Altri comandi: `/stato`, `/punti`, `/punto nome`, `/stop`. Lo stesso avviso non viene ripetuto per 12 ore.

## 8. Da dove vengono i dati

- Previsioni meteo: Open-Meteo (modelli ECMWF, DWD, Météo-France), aggiornate ogni ora.
- Fiumi: idrometri ARPAL (Roja), Hub'Eau (Roya francese), ARSO (Isonzo, Kolpa), controllati ogni 5 minuti; previsioni di piena GloFAS (Copernicus).
- Allerte ufficiali: MeteoAlarm e Vigilance Météo-France, ogni 5 minuti.
- Valanghe: bollettini AINEVA e Météo-France (in stagione).
- Stazioni meteo: Météo-France, ARSO, DHMZ, ARPAL.
- Sentieri e bivacchi: OpenStreetMap.

L'ora dell'ultimo aggiornamento è in alto. Se una fonte non risponde, compare lì il suo nome.

## 9. Riservatezza

Nessun account, nessun dato personale, nessun registro degli accessi. Chi attiva le notifiche lascia solo l'indirizzo tecnico del browser, la zona e la lingua.

## 10. Limiti da conoscere

- Possono esserci falsi allarmi e pericoli non segnalati: rilasci di dighe, temporali locali, valanghe.
- Coordinate, soglie e traduzioni vanno verificate con chi lavora sul posto.
- I bollettini valanghe ci sono solo in stagione; fuori stagione resta un indicatore ricavato dalla neve prevista.
- In pericolo chiamare il **112**.

Per impostare e usare il bot Telegram: [bot-telegram.it.md](bot-telegram.it.md).
