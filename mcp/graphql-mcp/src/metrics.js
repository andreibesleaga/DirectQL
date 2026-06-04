
import client from 'prom-client';

// Standalone metrics registry. Kept free of imports from cache.js / app.js to avoid
// circular dependencies — those modules import from here, never the other way around.
const register = new client.Registry();
register.setDefaultLabels({ service: 'graphql-mcp-server' });

// Process/runtime metrics (cheap, useful for ops dashboards).
client.collectDefaultMetrics({ register });

const schemaCacheHits = new client.Counter({
    name: 'directql_schema_cache_hits_total',
    help: 'Total GraphQL schema cache hits, by tier (memory|file).',
    labelNames: ['tier'],
    registers: [register]
});

const schemaCacheMisses = new client.Counter({
    name: 'directql_schema_cache_misses_total',
    help: 'Total GraphQL schema cache misses (remote fetch required).',
    registers: [register]
});

const schemaCacheKeys = new client.Gauge({
    name: 'directql_schema_cache_keys',
    help: 'Number of keys currently held in the in-memory schema cache.',
    registers: [register]
});

/**
 * Record a cache hit.
 * @param {('memory'|'file')} tier - The tier that served the value.
 */
export function recordCacheHit(tier) {
    schemaCacheHits.inc({ tier });
}

/** Record a cache miss (value had to be fetched from the remote). */
export function recordCacheMiss() {
    schemaCacheMisses.inc();
}

/**
 * Set the current in-memory cache key count gauge.
 * @param {number} count
 */
export function setCacheKeyCount(count) {
    if (typeof count === 'number' && Number.isFinite(count)) {
        schemaCacheKeys.set(count);
    }
}

export { register };
