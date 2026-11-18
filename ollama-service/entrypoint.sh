#!/bin/sh
set -e

MODEL="${OLLAMA_MODEL:-gemma2:2b}"

echo "[Ollama Cloud] Iniciando servidor Ollama na porta 11434..."
ollama serve &
SERVER_PID=$!

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
