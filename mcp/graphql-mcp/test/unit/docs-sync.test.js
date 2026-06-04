import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CACHE_TTL_SECONDS, CACHE_CHECK_PERIOD_SECONDS } from '../../src/cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDoc = fs.readFileSync(
    path.join(__dirname, '../../../../docs/CACHE.md'),
    'utf-8'
);

describe('docs/CACHE.md stays in sync with code constants', () => {
    test('documents the memory TTL value', () => {
        expect(CACHE_TTL_SECONDS).toBe(3600);
        expect(cacheDoc).toContain(`${CACHE_TTL_SECONDS} s`);
    });

    test('documents the expiry check period', () => {
        expect(CACHE_CHECK_PERIOD_SECONDS).toBe(600);
        expect(cacheDoc).toContain(`${CACHE_CHECK_PERIOD_SECONDS} s`);
    });

    test('documents the metric names that the code exposes', () => {
        for (const name of [
            'directql_schema_cache_hits_total',
            'directql_schema_cache_misses_total',
            'directql_schema_cache_keys'
        ]) {
            expect(cacheDoc).toContain(name);
        }
    });
});
