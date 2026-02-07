FROM mindsdb/mindsdb:latest

# Default port for Railway
ENV PORT=47334
EXPOSE 47334


# Create start script inline to avoid build context issues
RUN echo '#!/bin/bash' > /start.sh && \
    echo 'if [ -n "$PORT" ]; then' >> /start.sh && \
    echo '    export MINDSDB_PORT_HTTP="$PORT"' >> /start.sh && \
    echo '    echo "Detected PORT environment variable. Setting MINDSDB_PORT_HTTP to $PORT"' >> /start.sh && \
    echo 'fi' >> /start.sh && \
    echo 'export MINDSDB_PORT_HTTP=${MINDSDB_PORT_HTTP:-47334}' >> /start.sh && \
    echo 'echo "Starting MindsDB on port $MINDSDB_PORT_HTTP..."' >> /start.sh && \
    echo 'exec python -Im mindsdb --api=http,mysql' >> /start.sh && \
    chmod +x /start.sh

ENTRYPOINT ["/start.sh"]
