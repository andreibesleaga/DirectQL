#!/bin/bash
# Start Ollama in background
ollama serve &

# Wait for it to wake up
echo "Waiting for Ollama..."
until ollama list > /dev/null 2>&1; do
  sleep 1
done

# Define model (Change to llama3.2:3b for better results if you have RAM)
MODEL_NAME="llama3.2:1b"

if ollama list | grep -q "$MODEL_NAME"; then
  echo "Model $MODEL_NAME ready."
else
  echo "Downloading $MODEL_NAME..."
  ollama pull $MODEL_NAME
fi

wait
