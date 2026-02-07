FROM mindsdb/mindsdb:latest

# Default port for Railway
ENV PORT=47334
EXPOSE 47334


# Use shell for variable expansion at runtime
ENTRYPOINT ["/bin/sh", "-c", "export MINDSDB_PORT_HTTP=${PORT:-47334} && echo \"Starting MindsDB on port $MINDSDB_PORT_HTTP\" && exec python -Im mindsdb --api=http,mysql"]
