#!/bin/bash
set -e

echo "[deploy] $(date) — démarrage"

cd /opt/notretab
git pull origin main

echo "[deploy] Build et redémarrage des conteneurs..."
docker compose up -d --build --remove-orphans

echo "[deploy] Nettoyage des images obsolètes..."
docker image prune -f

echo "[deploy] Terminé."
