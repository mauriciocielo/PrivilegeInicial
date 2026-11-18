FROM caddy:2.8.4 AS caddy

FROM ollama/ollama:latest

ENV OLLAMA_HOST=0.0.0.0:11434
ENV OLLAMA_MODEL=gemma2:2b
ENV PORT=8080

COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh /etc/caddy/Caddyfile && chmod +x /entrypoint.sh

# 11434: Ollama na rede privada do Railway (sem senha)
# 8080:  proxy público com senha (OLLAMA_API_KEY)
EXPOSE 11434 8080

ENTRYPOINT ["/entrypoint.sh"]
