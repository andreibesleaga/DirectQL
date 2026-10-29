# AGENTS.md

Instructions for coding agents and new contributors. The [README](README.md) and
[CONTRIBUTING.md](CONTRIBUTING.md) are the full sources; this page is the short form and must
not contradict them.

## What this repository is

DirectQL is a self-hosted stack: a GraphQL MCP server (`graphql-mcp`), Open WebUI, Ollama and
MindsDB (`db-mcp`). Only `graphql-mcp` is code kept here; the other three are upstream images
configured in `docker-compose.yml` and `infra/`.

## Layout

| Path | Contents |
| --- | --- |
| `mcp/graphql-mcp/` | The Node.js (ESM, Node 22 LTS, `engines` `>=20`) MCP server: `src/`, `test/`, `schemas/`, `Dockerfile` |
| `mcp/db-mcp/`, `open-webui/`, `ollama/` | Dockerfiles and notes for the upstream services |
| `scripts/` | Helper scripts for the local stack (`test-local-setup.sh`, `pull-ollama-model.sh`, `monitor-stack.sh`) |
| `infra/` | Kubernetes manifest, AWS Terraform, Railway definition |
| `docs/` | Architecture, schema cache, threat model |
| `site/` | The one-page project site, published by `.github/workflows/pages.yml` |
| `.github/workflows/` | `ci-cd.yml`, `security-baseline.yml`, `pages.yml` |

Module map of `graphql-mcp`: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commands

Run from `mcp/graphql-mcp/`:

```bash
npm ci                  # install from the lockfile (not npm install)
npm test                # Jest unit and integration tests
npm run test:security   # read-only mode check
npm run lint            # ESLint, report-only (warnings do not fail)
npm start               # HTTP and SSE server on PORT (default 3000)
```

Full stack (needs Docker, `docker-compose` and a GitHub token in `.env`): `./scripts/test-local-setup.sh`.

## Rules

- Never commit a real token. Only `.env.example` is tracked; see [SECRETS.md](SECRETS.md).
- Keep `GRAPHQL_READ_ONLY=true` as the default.
- New code ships with tests. The MCP tool and resource surface, JSON-RPC shapes and environment
  variables are a contract: additions need behaviour-preserving defaults; removals and renames
  need a major version.
- Update `CHANGELOG.md` under `[Unreleased]` in the same change.
- `docs/CACHE.md` is checked by `test/unit/docs-sync.test.js`: if you change the cache TTL, check
  period or metric names, change that page too.
- Report vulnerabilities privately, see [SECURITY.md](SECURITY.md).
