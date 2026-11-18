#!/bin/sh
set -e

MODEL="${OLLAMA_MODEL:-gemma2:2b}"

echo "[Ollama Cloud] Iniciando servidor Ollama na porta 11434..."
ollama serve &
SERVER_PID=$!

# Proxy público com senha. Sem OLLAMA_API_KEY ele não sobe, para nunca expor o Ollama aberto.
if [ -n "${OLLAMA_API_KEY}" ]; then
  echo "[Ollama Cloud] Iniciando proxy protegido por senha na porta ${PORT:-8080}..."
  caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
else
  echo "[Ollama Cloud] AVISO: OLLAMA_API_KEY vazia. Proxy público desligado; só a rede privada acessa o Ollama."
fi

# Aguarda o servidor responder localmente
until ollama list >/dev/null 2>&1; do
  sleep 2
done

if ! ollama list | grep -q "${MODEL}"; then
  echo "[Ollama Cloud] Baixando modelo ${MODEL}..."
  ollama pull "${MODEL}" || true
else
  echo "[Ollama Cloud] Modelo ${MODEL} já disponível em cache."
fi

wait "$SERVER_PID"
