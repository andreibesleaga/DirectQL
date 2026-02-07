#!/bin/bash

# DirectQL Stack Monitoring Script

echo "========================================================"
echo " 🔍 DirectQL Local Stack Monitor"
echo "========================================================"

# 1. Check if Docker Compose is running
if [ -z "$(docker-compose ps -q)" ]; then
  echo "❌ No services running. Start the stack with ./test-local-setup.sh or docker-compose up -d"
  exit 1
fi

echo ""
echo "📊 SERVICE STATUS (docker-compose ps)"
echo "-------------------------------------"
docker-compose ps

echo ""
echo "📈 RESOURCE USAGE (docker stats --no-stream)"
echo "--------------------------------------------"
# Get IDs of our services
IDS=$(docker-compose ps -q)
docker stats --no-stream $IDS --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

echo ""
echo "🚨 RECENT ERRORS (Last 5 lines containing 'error' or 'fail')"
echo "-----------------------------------------------------------"
echo ">> GraphQL MCP Errors:"
docker-compose logs --tail=20 graphql-mcp | grep -iE "error|fail|exception" | tail -n 5 || echo "   (No recent errors found)"

echo ""
echo ">> Open WebUI Errors:"
docker-compose logs --tail=20 open-webui | grep -iE "error|fail|exception" | tail -n 5 || echo "   (No recent errors found)"

echo ""
echo ">> Ollama Errors:"
docker-compose logs --tail=20 ollama | grep -iE "error|fail|exception" | tail -n 5 || echo "   (No recent errors found)"

echo ""
echo ">> MindsDB Errors:"
docker-compose logs --tail=20 db-mcp | grep -iE "error|fail|exception" | tail -n 5 || echo "   (No recent errors found)"

echo ""
echo "========================================================"
echo "📝 LATEST LOG SNAPSHOT (Last 3 lines per service)"
echo "========================================================"
docker-compose logs --tail=3

echo ""
read -p "Press [Enter] to stream live logs (Ctrl+C to exit)..."
docker-compose logs -f
