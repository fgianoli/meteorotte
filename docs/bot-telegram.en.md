# MeteoRotte – The Telegram bot

The bot sends alerts to **aid workers** (volunteers, organisations), who decide whether and how to pass them on. It never writes directly to people on the move. Commands and replies are in Italian.

## 1. Setting up the bot (once, by whoever runs the server)

1. On Telegram open a chat with **@BotFather** and send `/newbot`. Choose a name and a username ending in `bot`. BotFather replies with a **token**.
2. On the server edit `/opt/meteorotte/.env`:
   ```
   TELEGRAM_TOKEN=token-from-BotFather
   BOT_ACCESS_CODE=a-word-you-choose
   BOT_REPEAT_HOURS=12
   ```
   - `BOT_ACCESS_CODE` is the word you give only to aid workers. If left empty, anyone who finds the bot can subscribe.
   - `BOT_REPEAT_HOURS` is how long before the same alert is repeated.
3. Start it:
   ```bash
   cd /opt/meteorotte && sudo docker compose --profile bot up -d --build
   sudo docker compose logs bot | tail -3      # should show "Bot avviato"
   ```

The token is a key: whoever has it controls the bot. If it leaks, regenerate it with BotFather (`/revoke`) and replace it in `.env`.

## 2. Subscribing (each aid worker)

1. Find the bot on Telegram and open the chat.
2. Send `/start` followed by the access code.
3. Send `/zone` to see the numbered list of areas.
4. Choose areas: `/iscrivi 1 3` or `/iscrivi tutte` (all).
5. Choose message languages: `/lingue en ar fa`.
6. Choose the minimum level: `/livello 2` (1 yellow, 2 orange, 3 red). Defaults: level 2, Italian and English.

The bot also works in a **group**: add it and use the same commands there.

## 3. Commands

| Command | What it does |
|---|---|
| `/start code` | activates the bot for this chat |
| `/zone` | list of areas |
| `/iscrivi 1 3` · `/iscrivi tutte` | add areas |
| `/disiscrivi 2` · `/disiscrivi tutte` | remove areas |
| `/lingue en ar fa` | message languages (it en fr ar fa ps ur ti wo mnk ff) |
| `/livello 2` | minimum level |
| `/stato` | current situation in your areas |
| `/punti` | list of points with their code |
| `/punto ventimiglia-roja` | full message for one point |
| `/stop` | delete the subscription |

## 4. How alerts arrive

- The server recomputes alerts every 5 minutes; the bot checks every minute.
- When a point in your areas reaches your level you get **one message for that point**: the text ready to forward in each chosen language, then the **details for the aid worker** (which data triggered it and the source).
- The same hazard at the same level is not repeated for 12 hours. If the level **rises**, the alert is sent at once.
- Nothing is sent when an alert ends: use `/stato` to check.

Translations are drafts; Wolof, Mandinka and Pulaar are unchecked.

## 5. Management

- The bot stores only the chat number, areas, languages and level (`subs.json` in the server's private volume). No names or phone numbers.
- To remove someone: they send `/stop`, or the server administrator deletes their entry from `subs.json` and restarts the bot. Anyone who blocks the bot is removed automatically.
- Changing `BOT_ACCESS_CODE` does not remove existing subscribers.

## 6. Troubleshooting

| Problem | Check |
|---|---|
| The bot does not reply | `sudo docker compose ps`: the `bot` service must be running (it only starts with `--profile bot`) |
| Logs show “TELEGRAM_TOKEN mancante” | the token is not in `.env`, or the bot was not restarted |
| It replies that the bot is reserved | the access code is missing: `/start code` |
| No alerts arrive | check `/stato`; try `/livello 1` |
