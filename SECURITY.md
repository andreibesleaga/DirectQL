# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x | ✅ |
| < 1.0 | ❌ |

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue.

- Preferred: open a [GitHub private security advisory](https://github.com/andreibesleaga/DirectQL/security/advisories/new).

We aim to acknowledge within **15 working days** and to provide a remediation
timeline within **30 working days**. Please allow a **90-day coordinated
disclosure embargo**. Include: affected version/commit, reproduction steps,
impact, and any suggested mitigation.

## Secret & API-key handling

DirectQL composes services that hold high-value secrets — most notably the
**GitHub Personal Access Token** used by `graphql-mcp`, plus any LLM provider
key (OpenAI/OpenRouter) and database credentials configured in MindsDB
(`db-mcp`). See [SECRETS.md](SECRETS.md) for the full inventory and rotation
guidance. In short:

- **Never commit a real key.** Only `.env.example` (placeholders) is tracked;
  `.env` and `.env.local` are git-ignored.
- **Never log the key.** `graphql-mcp` summarizes/redacts request headers in logs
  (`src/utils.js`), and upstream error extensions are stripped
  (`sanitizeResponse` in `src/validator.js`).
- **Use a least-privilege, project-scoped key** and rotate at least every 90 days.
- **Run read-only by default** (`GRAPHQL_READ_ONLY=true`) so an LLM cannot issue
  mutations against an upstream GraphQL API.

## Hardening controls

`graphql-mcp` ships several configurable guardrails (all default to
behavior-preserving values). See the [Threat Model](docs/THREAT-MODEL.md) for the
full mapping:

- `GRAPHQL_MAX_DEPTH` — query depth ceiling (default 15).
- `GRAPHQL_COMPLEXITY_LIMIT` — opt-in query-complexity ceiling (default 0 = off).
- `INTROSPECTION_ALLOWLIST` — restrict which endpoints may be introspected
  (default empty = allow the configured endpoint).
