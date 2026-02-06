#!/bin/bash
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
