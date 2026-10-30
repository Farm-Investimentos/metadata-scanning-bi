#!/bin/sh
# Prepara um EC2 (Amazon Linux 2023) para o catálogo. Rodar uma vez, como root, de dentro do clone do repositório:
#   sudo sh deploy/instalar-ec2.sh
set -e
cd "$(dirname "$0")/.."
RAIZ=$(pwd)

dnf install -y docker git cronie
systemctl enable --now docker crond

# plugin docker compose (não vem no Amazon Linux)
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# dados iniciais: histórico de uso e o painel atual, para o site não abrir vazio antes da 1ª extração
mkdir -p dados/saida dados/painel dados/auth
cp -n saida/historico_*.csv dados/saida/ 2>/dev/null || true
cp -n 03-dashboard/data/catalogo_data.js dados/painel/ 2>/dev/null || true
chmod 700 dados/auth

docker compose build extracao
docker compose up -d painel

# extração todo dia 1º do mês, 6h de Brasília (o EC2 usa UTC)
echo "0 9 1 * * root $RAIZ/deploy/atualizar.sh >> /var/log/catalogo-bi.log 2>&1" > /etc/cron.d/catalogo-bi

echo
echo "Painel no ar na porta 80. Próximo passo, o login único:"
echo "  sudo docker compose run --rm extracao --login-dispositivo"
