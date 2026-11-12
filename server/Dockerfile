# Immagine unica per worker e bot (cambia solo il comando). Nessuna dipendenza npm.
FROM node:22-alpine
WORKDIR /app
COPY web/js/alerts.js web/js/i18n.js web/data/hotspots.js ./shared/
COPY server/package.json server/worker.js server/bot.js ./
COPY server/lib ./lib
RUN mkdir -p /data/public /data/private && chown -R node:node /data
USER node
ENV PUBLIC_DIR=/data/public PRIVATE_DIR=/data/private NODE_ENV=production
CMD ["node", "worker.js"]
