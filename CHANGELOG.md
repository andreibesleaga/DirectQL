# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `graphql-mcp`: `engines.node >= 20`; the Docker image and CI now run on
  **Node 22 LTS** (was Node 18 in the image).
- `graphql-mcp`: configurable query guardrails — `GRAPHQL_MAX_DEPTH` (default 15,
  matching the previous hardcoded limit), opt-in `GRAPHQL_COMPLEXITY_LIMIT`
  (default 0 = disabled), and `INTROSPECTION_ALLOWLIST` (default empty = allow
  the configured endpoint).
- `graphql-mcp`: Prometheus metrics at `GET /metrics` (toggle with
  `METRICS_ENABLED`, default on) — `directql_schema_cache_hits_total{tier}`,
  `directql_schema_cache_misses_total`, `directql_schema_cache_keys`.
- `graphql-mcp`: the documented `graphql://local/<filename>` MCP resource is now
  implemented (list + read of files under `schemas/`), path-traversal safe.
- Governance files: `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`,
  `SECRETS.md`, `docs/THREAT-MODEL.md`, `docs/CACHE.md`.
- CI: `security-baseline.yml` (OSV-Scanner, Trivy fs + image, gitleaks, CycloneDX
  SBOM, npm audit, license check) and `.github/dependabot.yml`.
- `graphql-mcp`: ESLint config + `npm run lint`.

### Changed

- CI (`ci-cd.yml`): upgraded to `actions/checkout@v4` + `actions/setup-node@v4`,
  standardized on the **Node 22 LTS** runner, and now runs both `npm test` and
  `npm run test:security`.
- CI (`security-baseline.yml`): `actions/upload-artifact` v4 → v7.
- Dependencies (safe, in-range bumps; **Express held at 4.x** to preserve
  behavior): `@modelcontextprotocol/sdk` → ^1.29, `dotenv` → ^17.4, `graphql` →
  ^16.14, `zod` → ^4.4.
- `package.json`: declared `"license": "GPL-3.0-or-later"`.

### Fixed

- `graphql-mcp`: `sanitizeResponse()` no longer throws on `null`/non-object error
  items in an upstream GraphQL error array.
- `graphql-mcp`: disk-tier schema cache keys are reduced to their basename,
  preventing directory traversal via crafted cache keys.
- Docs: corrected the CLI config example (`GRAPHQL_MCP_ENDPOINT`, was
  `GRAPHQL_ENDPOINT`) and the bundled local-schema filename.

### Security

- Documented GitHub-token scope minimization and 90-day rotation (`SECRETS.md`),
  and the T1–T6 threat model with mitigations (`docs/THREAT-MODEL.md`).
- Resolved all 9 known dependency advisories (8 moderate + 1 high, incl.
  `fast-uri`, `qs`/`express`, `hono`, `ip-address`/`express-rate-limit`,
  `brace-expansion`) via a semver-compatible `npm audit fix` — lockfile only, no
  direct-dependency or API changes. `npm audit` now reports **0 vulnerabilities**.

## [1.0.0]

### Added

- Initial release: `graphql-mcp` server, Open WebUI, Ollama, and MindsDB
  (`db-mcp`) composed via Docker Compose, with multi-target infra (Kubernetes,
  AWS, Railway).

[Unreleased]: https://github.com/andreibesleaga/DirectQL/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/andreibesleaga/DirectQL/releases/tag/v1.0.0
