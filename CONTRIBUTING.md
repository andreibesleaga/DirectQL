# Contributing

Thanks for your interest in improving **DirectQL**.

DirectQL is a four-service stack (`graphql-mcp`, `open-webui`, `ollama`,
`db-mcp`). The only first-party code lives in **`mcp/graphql-mcp/`** (Node.js,
ESM); the other three services are upstream Docker images configured via
`docker-compose.yml` and `infra/`.

## Prerequisites

- Node.js 20+ (CI runs the test matrix on Node 20 and 22).
- npm (use the committed `mcp/graphql-mcp/package-lock.json`).
- Docker + Docker Compose (only needed for the full-stack e2e flow).

## Getting started

```bash
cd mcp/graphql-mcp
npm ci
```

## Development workflow

Run the gates locally before opening a PR — these mirror CI:

```bash
cd mcp/graphql-mcp
npm run lint          # ESLint (report-only)
npm test              # Jest unit + integration tests
npm run test:security # read-only-mode enforcement check
```

Full-stack end-to-end (requires Docker and a GitHub token in `.env`):

```bash
./scripts/test-local-setup.sh           # builds the stack, runs e2e_simulation.js
node mcp/graphql-mcp/test/e2e/mcp_protocol.js   # MCP protocol suite vs a running server
```

## Pull-request checklist

- [ ] lint and tests (`npm test`, `npm run test:security`) pass.
- [ ] New code ships with tests (happy path, edge cases, and error cases).
- [ ] Public behavior preserved unless intentionally breaking. The MCP tool/
      resource surface, JSON-RPC shapes, CLI entrypoints (`cli.js`/`index.js`),
      and config env vars are a contract — **additions with behavior-preserving
      defaults are fine; removals/renames need a major-version bump.**
- [ ] `CHANGELOG.md` updated under `[Unreleased]`.

## Security

Report vulnerabilities privately — see [SECURITY.md](SECURITY.md). Never commit a
real token; see [SECRETS.md](SECRETS.md).

## License

By contributing you agree your contributions are licensed under the project's
[GPL-3.0-or-later](LICENSE).
