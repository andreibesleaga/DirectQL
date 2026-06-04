# Secrets Management

DirectQL handles several high-value secrets. This document lists each one, its
minimum scope, and rotation guidance. **No real secret should ever be committed**
— only `.env.example` (placeholders) is tracked; `.env` and `.env.local` are
git-ignored.

## Inventory

| Secret | Used by | Minimum scope | Rotation |
| ------ | ------- | ------------- | -------- |
| `GRAPHQL_API_KEY` (GitHub PAT) | `graphql-mcp` | A **fine-grained** PAT with **read-only** access to only the repos/orgs you intend to query. For public-data demos, a classic token with `read:public_repo` (or no scopes) is usually enough. **Do not** grant `repo` (full) unless required. | ≤ 90 days |
| `OPENAI_API_KEY` / OpenRouter key | `open-webui` | A project-scoped key. Set a hard billing ceiling at the provider so a runaway agent loop cannot run up unbounded cost. | ≤ 90 days |
| `WEBUI_SECRET_KEY` | `open-webui` | A long random string (e.g. `openssl rand -hex 32`). The committed value `local-dev-secret-key` is for **local dev only** — replace it in any shared/production deploy. | On deploy / on compromise |
| MindsDB data-source credentials | `db-mcp` | Per-source least-privilege DB users (prefer read-only). Configured at runtime via `CREATE DATABASE`, never baked into images. | Per your DB policy |

## Rules

1. **Never commit `.env` or `.env.local`.** They are git-ignored; if you ever
   committed one, rotate the exposed secret immediately and scrub history.
2. **Run read-only by default.** Keep `GRAPHQL_READ_ONLY=true` so the LLM cannot
   issue mutations through `query-graphql`.
3. **Restrict introspection** in shared deployments with
   `INTROSPECTION_ALLOWLIST` so schema details for unintended endpoints cannot be
   pulled.
4. **Treat the GitHub token as the crown jewel.** An LLM that can issue arbitrary
   GraphQL queries can read anything the token can — minimize scope first.
5. **Redaction is on by default.** Request headers are summarized in logs and
   upstream error stacktraces/exceptions are stripped before responses are
   returned.

## Rotating the GitHub token

1. Create a new fine-grained PAT with the minimum scope above.
2. Update `GRAPHQL_API_KEY` in your `.env` / deployment secret store.
3. Restart `graphql-mcp` (or redeploy).
4. Revoke the old token at https://github.com/settings/tokens.
