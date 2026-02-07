#!/bin/bash
# If PORT is set (Railway), use it for MINDSDB_PORT_HTTP
if [ -n "$PORT" ]; then
    export MINDSDB_PORT_HTTP="$PORT"
    echo "Detected PORT environment variable. Setting MINDSDB_PORT_HTTP to $PORT"
fi

# Default to 47334 if not set
export MINDSDB_PORT_HTTP=${MINDSDB_PORT_HTTP:-47334}

echo "Starting MindsDB on port $MINDSDB_PORT_HTTP..."

# Execute the default MindsDB command
# Using exec to replace the shell process
exec python -Im mindsdb --api=http,mysql
