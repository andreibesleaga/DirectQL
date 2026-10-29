# DirectQL Threat Model

Scope: the `graphql-mcp` gateway and the data flows it participates in (Open WebUI
→ graphql-mcp → upstream GraphQL; MindsDB federated data via `db-mcp`). The other
services are upstream images; their own hardening is the operator's
responsibility. Standards vocabulary: OWASP ASVS 5.0.

Each threat lists the asset, attacker, mitigation **as shipped**, residual risk,
and how to validate.

## T1 — GitHub token exfiltration

- **Asset:** `GRAPHQL_API_KEY` (GitHub PAT).
- **Attacker:** A prompt-injected LLM coaxed into echoing the token, or log
  scraping.
- **Mitigation:** Token is environment-only (never in code); the `Authorization`,
  `x-api-key` and `Cookie` request headers are redacted in logs (`src/utils.js` `maskHeaders`); least-privilege scope
  + 90-day rotation documented (`SECRETS.md`).
- **Residual risk:** The token's blast radius equals its scope — minimize it.
- **Validate:** Inspect logs for absence of the raw token; confirm a fine-grained
  read-only PAT is in use.

## T2 — Prompt-injected / abusive GraphQL queries

- **Asset:** Upstream API rate limits and data.
- **Attacker:** Attacker-controlled content (e.g. an issue body) instructing the
  LLM to issue expensive or exfiltrating queries.
- **Mitigation:** `GRAPHQL_READ_ONLY=true` blocks mutations; `GRAPHQL_MAX_DEPTH`
  (default 15) bounds depth; opt-in `GRAPHQL_COMPLEXITY_LIMIT` bounds field count;
  all enforced in `src/validator.js`.
- **Residual risk:** Complexity limiting is off by default — enable it
  (recommended 1000) in exposed deployments.
- **Validate:** `npm test` covers depth/complexity/read-only enforcement; issue a
  deep/large query and confirm rejection.

## T3 — MindsDB SQL injection / over-broad credentials

- **Asset:** Federated databases reachable from `db-mcp`.
- **Attacker:** LLM-driven SQL via the MindsDB MCP surface.
- **Mitigation:** Operator configures per-source least-privilege (read-only) DB
  users; credentials are runtime-only (`CREATE DATABASE`), never in images
  (`SECRETS.md`).
- **Residual risk:** Entirely dependent on the operator's DB-user scoping.
- **Validate:** Review connected MindsDB data sources for read-only grants.

## T4 — Introspection leakage

- **Asset:** Upstream GraphQL schema details.
- **Attacker:** A client introspecting an endpoint the operator did not intend to
  expose.
- **Mitigation:** `INTROSPECTION_ALLOWLIST` gates the `introspect-graphql-schema`
  tool and the `graphql://schema` resource (`assertIntrospectionAllowed` in
  `src/validator.js`); empty allowlist preserves open behavior for single-tenant
  use.
- **Residual risk:** Allowlist is empty by default — set it for shared deploys.
- **Validate:** Set `INTROSPECTION_ALLOWLIST` and confirm introspection of a
  non-listed endpoint returns an error.

## T5 — Schema cache poisoning / traversal

- **Asset:** Cached/served schema content on disk (`schemas/`).
- **Attacker:** Crafted cache keys or resource names attempting directory
  traversal.
- **Mitigation:** All disk paths are reduced to `path.basename` and schema reads
  require a `.graphql`/`.gql` extension (`src/cache.js`); the `graphql://local/`
  resource is traversal-safe.
- **Residual risk:** Anyone with write access to `schemas/` can change served
  content — protect the volume.
- **Validate:** `npm test` includes traversal-rejection cases.

## T6 — Committed secrets / weak defaults

- **Asset:** Any secret in `.env` / `.env.local`; `WEBUI_SECRET_KEY`.
- **Attacker:** Anyone reading the repo or image.
- **Mitigation:** `.env` and `.env.local` are git-ignored; `.env.example` holds
  placeholders only; gitleaks runs in CI (`security-baseline.yml`).
- **Residual risk:** The `WEBUI_SECRET_KEY` placeholders (`change-me-in-production` in
  `.env.example`, `change-this-to-a-secure-random-string` in `infra/railway/railway.json`)
  must be replaced outside local dev.
- **Validate:** `gitleaks` CI job is green; grep the repo for `github_pat_`.

## T7 — Unauthenticated graphql-mcp server

- **Asset:** The upstream API quota and everything the configured `GRAPHQL_API_KEY` can read.
- **Attacker:** Anyone who can reach port 3000, including a web page open in the operator's
  browser (CORS allows any origin).
- **Mitigation:** `docker-compose.yml` publishes port 3000 on `127.0.0.1` only;
  `GRAPHQL_READ_ONLY=true`, depth and complexity limits and the rate limit (100 requests per
  15 minutes) apply to every caller (`src/validator.js`, `src/app.js`).
- **Residual risk:** The server has no token check and answers `Access-Control-Allow-Origin: *`.
  Any local process, or a browser page on the same machine, can issue queries with the
  configured key's scope. Kubernetes, AWS and Railway deployments must restrict access at the
  network layer (private service, ingress allow-list) until the server has its own token check.
- **Validate:** From another host, `curl http://<host>:3000/health` is refused when using Compose.

---

_Review annually or after any architectural change. Last reviewed: 2026-06-04._
