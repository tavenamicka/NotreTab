#!/bin/sh
set -e

# Initialise db.json depuis le seed uniquement si le volume est vierge.
# Après le premier démarrage, le volume persiste les données entre les rebuilds.
if [ ! -f /data/db.json ]; then
  echo "[notretab-api] Volume vide — copie du seed initial..."
  cp /app/db.json.seed /data/db.json
fi

echo "[notretab-api] Démarrage json-server..."
exec json-server --watch /data/db.json --port 3001 --host 0.0.0.0 \
  --middlewares /app/server/privacy-middleware.cjs
