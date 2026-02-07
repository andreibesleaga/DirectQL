#!/bin/bash
# Check if ollama is installed and display models if it is already running
if ! command -v ollama &> /dev/null; then
    echo "❌ Error: 'ollama' command not found."
    echo "   This script is intended to run inside the docker container."
    echo "   If you want to run it locally, please install Ollama first: https://ollama.com/"
    echo ""
    curl http://localhost:11434/api/tags
    exit 1
fi

# Start Ollama in background
ollama serve &

# Wait for it to wake up
echo "Waiting for Ollama..."
until ollama list > /dev/null 2>&1; do
  sleep 1
done

# Ollama is ready - models should be pulled manually via scripts/pull-ollama-model.sh
echo "✅ Ollama server is ready."
echo "   To download a model, run: ./scripts/pull-ollama-model.sh"

wait
