# MeteoRotte – Il bot Telegram

Il bot manda le allerte agli **operatori** (volontari, associazioni), che decidono se e come inoltrarle alle persone. Non scrive mai direttamente alle persone in cammino.

## 1. Mettere in funzione il bot (una volta sola, chi gestisce il server)

1. Su Telegram apri la chat con **@BotFather** e scrivi `/newbot`. Scegli un nome (per esempio «MeteoRotte allerte») e un nome utente che finisca per `bot`. BotFather risponde con un **token**: una riga lunga di lettere e numeri.
2. Sul server apri il file `/opt/meteorotte/.env` e compila tre righe:
   ```
   TELEGRAM_TOKEN=il-token-di-BotFather
   BOT_ACCESS_CODE=una-parola-scelta-da-te
   BOT_REPEAT_HOURS=12
   ```
   - `BOT_ACCESS_CODE` è la parola da dare solo agli operatori. Senza questa parola il bot non risponde a nessuno. Se la lasci vuota, chiunque trovi il bot può iscriversi.
   - `BOT_REPEAT_HOURS` è il numero di ore prima che lo stesso avviso venga ripetuto.
3. Avvia il bot:
   ```bash
   cd /opt/meteorotte && sudo docker compose --profile bot up -d --build
   sudo docker compose logs bot | tail -3      # deve comparire "Bot avviato"
   ```
4. Facoltativo: sempre con BotFather, `/setdescription` per spiegare a cosa serve il bot e `/setcommands` per far comparire l'elenco dei comandi.

Il token è una chiave: chi lo possiede controlla il bot. Non va scritto in chat né pubblicato. Se finisce in mani sbagliate, con BotFather si rigenera (`/revoke`) e si sostituisce nel file `.env`.

## 2. Iscriversi (ogni operatore)

1. Cerca il bot su Telegram con il suo nome utente e apri la chat.
2. Scrivi `/start` seguito dal codice ricevuto, per esempio `/start parola`.
3. Scrivi `/zone` per vedere l'elenco numerato delle zone.
4. Scegli le zone: `/iscrivi 1 3` oppure `/iscrivi tutte`.
5. Scegli le lingue dei messaggi: `/lingue it ar fa`.
6. Scegli da che livello essere avvisato: `/livello 2` (1 giallo, 2 arancione, 3 rosso). All'inizio il livello è 2 e le lingue sono italiano e inglese.

Il bot funziona anche in un **gruppo**: aggiungilo al gruppo e scrivi lì gli stessi comandi. Le allerte arrivano a tutto il gruppo.

## 3. I comandi

| Comando | Cosa fa |
|---|---|
| `/start codice` | attiva il bot per questa chat |
| `/zone` | elenco delle zone, con un segno su quelle attive |
| `/iscrivi 1 3` · `/iscrivi tutte` | aggiunge zone |
| `/disiscrivi 2` · `/disiscrivi tutte` | toglie zone |
| `/lingue it ar fa` | lingue dei messaggi (it en fr ar fa ps ur ti wo mnk ff) |
| `/livello 2` | livello minimo: 1 giallo, 2 arancione, 3 rosso |
| `/stato` | situazione attuale delle proprie zone |
| `/punti` | elenco dei punti con il loro codice |
| `/punto ventimiglia-roja` | messaggio completo per un punto |
| `/stop` | cancella l'iscrizione |
| `/help` | riepilogo dei comandi |

## 4. Come arrivano le allerte

- Il server ricalcola le allerte ogni 5 minuti. Il bot controlla ogni minuto se è cambiato qualcosa.
- Quando un punto delle tue zone raggiunge il livello che hai scelto, ricevi **un messaggio per quel punto** con:
  - il testo pronto da inoltrare, in ognuna delle lingue scelte, separate da una riga;
  - sotto, i **dettagli per l'operatore**: quale dato ha fatto scattare l'allerta e da quale fonte.
- Lo stesso pericolo allo stesso livello non viene ripetuto per 12 ore. Se il livello **sale** (da arancione a rosso), l'avviso parte subito.
- Quando l'allerta rientra il bot non manda nulla: per controllare usa `/stato`.

Prima di inoltrare: le traduzioni sono bozze. Quelle in wolof, mandinka e pulaar non sono validate, e il bot lo ricorda quando le scegli.

## 5. Gestione

- **Chi è iscritto:** il bot conserva solo il numero della chat, le zone, le lingue e il livello, nel file `subs.json` dentro il volume privato del server. Non conserva nomi né numeri di telefono.
- **Togliere un operatore:** l'operatore scrive `/stop`. In alternativa chi gestisce il server cancella la sua riga da `subs.json` e riavvia il bot. Chi blocca il bot viene tolto in automatico.
- **Cambiare il codice di accesso:** cambia `BOT_ACCESS_CODE` nel file `.env` e riavvia. Chi è già iscritto resta iscritto: il codice serve solo per entrare.
- **Lingua del bot:** comandi e risposte sono in italiano.

## 6. Se qualcosa non va

| Problema | Controllo |
|---|---|
| Il bot non risponde | `sudo docker compose ps`: il servizio `bot` deve essere attivo. Parte solo con `--profile bot`. |
| Nei log compare «TELEGRAM_TOKEN mancante» | il token non è nel file `.env`, oppure il bot non è stato riavviato dopo averlo scritto |
| Risponde «Questo bot è riservato agli operatori» | manca il codice: `/start codice` |
| Non arrivano allerte | controlla `/stato`: forse nessun punto raggiunge il tuo livello. Prova `/livello 1`. |
| Arrivano troppi messaggi | alza il livello (`/livello 3`) o riduci le zone |
