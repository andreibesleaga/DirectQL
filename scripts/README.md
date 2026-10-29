# DirectQL Scripts

Helper scripts for managing the local DirectQL stack.

## Scripts

### `test-local-setup.sh`
**Automated E2E setup and test.**

Runs the Jest tests, then starts the full Docker Compose stack, waits for `graphql-mcp` and MindsDB to answer, and runs the E2E simulation. The stack is left running.

The scripts call `docker-compose` (the standalone command), not `docker compose`. `docker-compose.yml` reserves one NVIDIA GPU for the `ollama` service (`deploy.resources.reservations.devices`).

```bash
./scripts/test-local-setup.sh
```

---

### `pull-ollama-model.sh`
**Download an Ollama model (manual step).**

After the stack is running, use this script to download LLM models for local AI inference.

```bash
# Download default model (llama3.2:1b)
./scripts/pull-ollama-model.sh

# Download a specific model
./scripts/pull-ollama-model.sh llama3.2:3b
```

> **Note:** Model download is intentionally separated from stack startup to avoid automatic bandwidth usage and allow faster initial setup.

---

### `monitor-stack.sh`
**Real-time stack monitoring.**

Displays service status, resource usage, recent errors, and streams live logs.

```bash
./scripts/monitor-stack.sh
```
