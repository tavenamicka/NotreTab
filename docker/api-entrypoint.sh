#!/bin/sh
set -e

# Initialise db.json depuis le seed uniquement si le volume est vierge.
# Après le premier démarrage, le volume persiste les données entre les rebuilds.
if [ ! -f /data/db.json ]; then
  echo "[notretab-api] Volume vide — copie du seed initial..."
  cp /app/db.json.seed /data/db.json
fi

# Secret de signature des jetons. Persisté dans le volume : sans ça, chaque
# rebuild déconnecterait tout le monde. Peut être imposé par l'environnement
# (NOTRETAB_AUTH_SECRET) pour le sortir du volume.
export NOTRETAB_AUTH_SECRET_FILE=/data/.auth-secret

echo "[notretab-api] Démarrage json-server..."
# Ordre imposé : auth.cjs authentifie et cadre par propriété, puis
# privacy-middleware filtre ce qui sort de la collection users. Inverser les
# deux laisserait privacy-middleware travailler sur une requête non
# authentifiée.
exec json-server --watch /data/db.json --port 3001 --host 0.0.0.0 \
  --middlewares /app/server/auth.cjs /app/server/privacy-middleware.cjs
