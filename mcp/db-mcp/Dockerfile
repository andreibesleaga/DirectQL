FROM mindsdb/mindsdb:latest

# Default port for Railway
ENV PORT=47334
EXPOSE 47334

COPY start.sh /start.sh
RUN chmod +x /start.sh

ENTRYPOINT ["/start.sh"]
