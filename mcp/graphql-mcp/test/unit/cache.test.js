import { jest } from '@jest/globals';
import {
    getCachedOrFetch,
    clearCache,
    listLocalSchemas,
    readLocalSchema
} from '../../src/cache.js';
import { register } from '../../src/metrics.js';

async function counterValue(name, labels = {}) {
    const metric = register.getSingleMetric(name);
    if (!metric) return 0;
    let total = 0;
    const data = await metric.get();
    for (const v of data.values) {
        const matches = Object.entries(labels).every(([k, val]) => v.labels[k] === val);
        if (matches) total += v.value;
    }
    return total;
}

describe('Cache metrics', () => {
    test('records a miss then a memory hit for the same key', async () => {
        clearCache();
        const key = `metrics-key-${Date.now()}`;
        const missesBefore = await counterValue('directql_schema_cache_misses_total');
        const memHitsBefore = await counterValue('directql_schema_cache_hits_total', { tier: 'memory' });

        await getCachedOrFetch(key, async () => 'value'); // miss -> fetch -> cache
        await getCachedOrFetch(key, async () => 'value2'); // memory hit

        expect(await counterValue('directql_schema_cache_misses_total')).toBe(missesBefore + 1);
        expect(await counterValue('directql_schema_cache_hits_total', { tier: 'memory' })).toBe(memHitsBefore + 1);
    });
});

describe('Local schema helpers (path-traversal safe)', () => {
    test('listLocalSchemas includes the bundled schema file', async () => {
        const files = await listLocalSchemas();
        expect(files).toContain('schema.docs.graphql');
    });

    test('readLocalSchema returns contents for a real file', async () => {
        const content = await readLocalSchema('schema.docs.graphql');
        expect(typeof content).toBe('string');
        expect(content.length).toBeGreaterThan(0);
    });

    test('readLocalSchema rejects a traversal attempt', async () => {
        await expect(readLocalSchema('../../../etc/passwd')).rejects.toThrow('Invalid local schema name');
    });

    test('readLocalSchema rejects non-schema extensions', async () => {
        await expect(readLocalSchema('package.json')).rejects.toThrow('Invalid local schema name');
    });

    test('getCachedOrFetch does not serve files outside schemas/ via a crafted key', async () => {
        clearCache();
        const fetchFn = jest.fn().mockResolvedValue('fetched');
        // basename('../../../../etc/hosts') -> 'hosts' -> schemas/hosts.graphql (does not exist) -> fetch
        const result = await getCachedOrFetch('../../../../etc/hosts', fetchFn);
        expect(result).toBe('fetched');
        expect(fetchFn).toHaveBeenCalled();
    });
});
