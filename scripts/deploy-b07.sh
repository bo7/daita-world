#!/bin/bash
# deploy-b07.sh – Deploy daita-web nach b07 (PROD)
# Wird von GitHub Actions aufgerufen oder manuell

set -e

B07_HOST="10.200.0.50"
B07_PORT="2608"
B07_USER="b07"
B07_PATH="/opt/docker/daita-web"
APP_DIR="apps/daita-web"

echo "[deploy] Starte Deploy nach b07..."

# rsync: alles außer .env, cv-PDFs, node_modules, volumes
rsync -avz --delete \
  --exclude='.env' \
  --exclude='cv/*.pdf' \
  --exclude='node_modules/' \
  --exclude='.git/' \
  -e "ssh -p ${B07_PORT}" \
  ${APP_DIR}/ \
  ${B07_USER}@${B07_HOST}:${B07_PATH}/

echo "[deploy] Dateien synchronisiert"

# src → astro-dist (nginx volume mount)
ssh -p ${B07_PORT} ${B07_USER}@${B07_HOST} "
  cd ${B07_PATH} &&
  docker compose pull --quiet 2>/dev/null || true &&
  docker compose up -d --build --remove-orphans
"

echo "[deploy] Deploy abgeschlossen"
echo "[deploy] URL: https://hands.trembling-hands.com"
