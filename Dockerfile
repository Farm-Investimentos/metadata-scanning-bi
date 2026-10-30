# Imagem da extração: roda bi_catalog.py e regenera os dados do painel.
# Build e execução ficam no EC2 (docker compose); ninguém precisa de Docker na própria máquina.
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY 01-extracao/bi_catalog.py 01-extracao/
COPY 02-processamento/*.py 02-processamento/

ENV PYTHONUNBUFFERED=1 \
    CATALOGO_AUTH_DIR=/app/auth

ENTRYPOINT ["python", "01-extracao/bi_catalog.py"]
CMD ["--all", "--atualizar-uso", "--gerar-painel"]
