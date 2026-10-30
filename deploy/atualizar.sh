#!/bin/sh
# Rodado pelo cron do EC2 todo dia 1º (ou à mão): pega o código novo do git, reconstrói a imagem e extrai.
set -e
cd "$(dirname "$0")/.."
echo "== $(date -Is) atualizando catálogo"
git pull --ff-only
docker compose build extracao
docker compose run --rm extracao
docker compose up -d painel
