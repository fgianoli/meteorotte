#!/usr/bin/env bash
# Deploy sul server: il server scarica l'ultima versione da GitHub e riavvia lo stack.
#   DEPLOY_HOST=utente@server ./deploy.sh
# Alla prima esecuzione crea .env da .env.example e si ferma: compilalo sul server e rilancia.
set -euo pipefail
: "${DEPLOY_HOST:?Imposta DEPLOY_HOST, es. root@studiogis.eu}"
DIR="${DEPLOY_DIR:-/opt/stacks/meteorotte}"
REPO="${DEPLOY_REPO:-https://github.com/fgianoli/meteorotte.git}"
PROFILE="${DEPLOY_PROFILE:---profile bot}"

ssh "$DEPLOY_HOST" bash -s <<REMOTE
set -euo pipefail
if [ ! -d "$DIR/.git" ]; then git clone "$REPO" "$DIR"; fi
cd "$DIR"
git pull --ff-only
if [ ! -f .env ]; then
  cp .env.example .env
  echo ">> Creato $DIR/.env: compilalo (PUBLIC_URL, CAP_SENDER, TELEGRAM_TOKEN, BOT_ACCESS_CODE) e rilancia deploy.sh"
  exit 1
fi
docker compose $PROFILE up -d --build
docker compose ps
REMOTE
