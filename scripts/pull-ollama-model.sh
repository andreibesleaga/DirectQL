#!/bin/bash
# Manual Ollama Model Download Script
# Usage: ./scripts/pull-ollama-model.sh [model_name]

set -e

# Default model
DEFAULT_MODEL="llama3.2:1b"
MODEL="${1:-$DEFAULT_MODEL}"

echo "🔍 Checking if Ollama container is running..."
if ! docker inspect -f '{{.State.Running}}' ollama 2>/dev/null | grep -q "true"; then
    echo "❌ Ollama container is not running."
    echo "   Start the stack first: ./scripts/test-local-setup.sh"
    exit 1
fi

echo "📦 Pulling model: $MODEL"
echo "   This may take several minutes depending on model size..."
echo ""

docker exec -it ollama ollama pull "$MODEL"

echo ""
echo "✅ Model '$MODEL' downloaded successfully!"
echo ""
echo "   Available models:"
docker exec ollama ollama list
