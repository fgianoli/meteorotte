# Immagine unica per worker, bot e push (cambia solo il comando).
FROM node:22-alpine
WORKDIR /app
COPY web/js/alerts.js web/js/i18n.js web/data/hotspots.js ./shared/
COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/worker.js server/bot.js server/push.js ./
COPY server/lib ./lib
RUN mkdir -p /data/public /data/private && chown -R node:node /data
USER node
ENV PUBLIC_DIR=/data/public PRIVATE_DIR=/data/private NODE_ENV=production
CMD ["node", "worker.js"]
