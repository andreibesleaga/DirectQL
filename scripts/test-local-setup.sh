#!/bin/bash
set -e

echo "🛑 Cleaning up existing containers..."
docker-compose down --remove-orphans || true

echo "🧪 Running Unit & Integration Tests..."
# Run local tests first to fail fast
if [ -d "mcp/graphql-mcp" ]; then
  cd mcp/graphql-mcp
  npm test
  cd ../..
else 
  echo "⚠️ mcp/graphql-mcp directory not found, skipping tests"
fi

echo "🏗️ Building and Starting Stack..."
# Build without cache to ensure latest code, run in background
docker-compose up -d --build

echo "⏳ Waiting for services to become healthy..."
# Simple wait loop for GraphQL MCP
echo "   Waiting for GraphQL MCP on port 3000..."
MAX_RETRIES=30
COUNT=0
until curl -s http://localhost:3000/health | grep "ok" > /dev/null; do
  sleep 1
  COUNT=$((COUNT+1))
  if [ $COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Timeout waiting for GraphQL MCP"
    exit 1
  fi
  echo -n "."
done
echo " ✅ GraphQL MCP is UP"

echo "   Waiting for MindsDB (db-mcp) on port 47334..."
COUNT=0
MAX_RETRIES_MDB=60
until curl -s http://localhost:47334/api/status | grep "mindsdb_version" > /dev/null; do
  sleep 1
  COUNT=$((COUNT+1))
  if [ $COUNT -ge $MAX_RETRIES_MDB ]; then
    echo "❌ Timeout waiting for MindsDB"
    exit 1
  fi
  echo -n "."
done
echo " ✅ MindsDB is UP"

# Optional: Wait for others
echo "   Checking Open WebUI container status..."
if [ "$(docker inspect -f '{{.State.Running}}' open-webui)" = "true" ]; then
    echo " ✅ Open WebUI is RUNNING"
else
    echo " ❌ Open WebUI failed to start"
    exit 1
fi

echo "   Checking MindsDB container status..."
if [ "$(docker inspect -f '{{.State.Running}}' db-mcp)" = "true" ]; then
    echo " ✅ MindsDB is RUNNING"
else
    echo " ❌ MindsDB failed to start"
    exit 1
fi

echo "🧪 Running E2E Verification..."
# Run the node simulation script locally, pointing to the localhost exposed port
# Ensure env vars are loaded
export MCP_SERVER_URL="http://localhost:3000/sse"
# We need the API key for the test script's internal logic if it simulates calls
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Run the test
node mcp/graphql-mcp/test/e2e_simulation.js

echo "🎉 Success! Local Stack is running."
echo "   - Open WebUI: http://localhost:8080"
echo "   - GraphQL MCP: http://localhost:3000/sse"
echo "   - MindsDB UI: http://localhost:47334"
echo "   - OpenAPI Spec: http://localhost:3000/openapi.json"
