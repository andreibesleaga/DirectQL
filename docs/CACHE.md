# Schema Caching

`graphql-mcp` uses a **3-tier schema cache** to avoid repeating expensive GraphQL
introspection calls (which are slow and rate-limited on endpoints like GitHub).
Implemented in [`mcp/graphql-mcp/src/cache.js`](../mcp/graphql-mcp/src/cache.js).

## Tiers (lookup order)

1. **Memory** — an in-process `node-cache`. Fastest; cleared on restart.
2. **Local disk** — files under `mcp/graphql-mcp/schemas/`. A key `K` maps to
   `schemas/<basename(K)>.graphql`. Used as a fallback/override and seeded into
   memory on a hit. See [`schemas/README.md`](../mcp/graphql-mcp/schemas/README.md).
3. **Remote introspection** — the configured `GRAPHQL_MCP_ENDPOINT` is introspected
   and the result cached in memory.

## TTL & eviction

| Setting | Value | Source |
| ------- | ----- | ------ |
| Memory TTL (`stdTTL`) | **3600 s** (1 hour) | `CACHE_TTL_SECONDS` |
| Expiry check period (`checkperiod`) | **600 s** (10 min) | `CACHE_CHECK_PERIOD_SECONDS` |

Memory entries expire after the TTL and are re-fetched on next access. Disk files
never expire — they are an explicit operator-provided override; delete or replace
them to invalidate. `clearCache()` flushes the memory tier.

## Cache keys

Keys are internal identifiers (`parsed_schema`, `schema_sdl`, `schema`). They are
**not** derived from untrusted input, and the disk tier additionally reduces any
key to `path.basename(...)`, so a crafted key cannot traverse outside `schemas/`.

> **Multi-tenant note:** the current cache keys are **per-endpoint**, not
> per-principal. For a shared-tenant deployment where different users present
> different upstream credentials, treat schema content as shared. Per-principal
> cache keys are tracked as a future (breaking) change.

## Path-traversal safety

Both the disk-cache lookup and the `graphql://local/<filename>` resource pass
names through `path.basename()` and require a `.graphql`/`.gql` extension, so
inputs like `../../../etc/passwd` cannot escape `schemas/`.

## Observability

When `METRICS_ENABLED=true` (default), `GET /metrics` exposes:

- `directql_schema_cache_hits_total{tier="memory|file"}`
- `directql_schema_cache_misses_total`
- `directql_schema_cache_keys`
