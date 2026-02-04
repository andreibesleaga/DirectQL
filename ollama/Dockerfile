# Service 3: Ollama (Optional Local AI)
FROM ollama/ollama:latest

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

ENTRYPOINT ["/start.sh"]
