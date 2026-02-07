
import request from 'supertest';
import { jest } from '@jest/globals';
import { getCachedOrFetch, setCache } from '../../src/cache.js';

describe('Cache Module', () => {
    beforeEach(() => {
        // Clear cache if possible or just rely on keys
    });

    it('should return cached value if present', async () => {
        const key = 'test-key';
        const val = 'test-val';
        setCache(key, val);
        const fetchFn = jest.fn();

        const result = await getCachedOrFetch(key, fetchFn);
        expect(result).toBe(val);
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should fetch and cache if missing', async () => {
        const key = 'missing-key';
        const val = 'fetched-val';
        const fetchFn = jest.fn().mockResolvedValue(val);

        const result = await getCachedOrFetch(key, fetchFn);
        expect(result).toBe(val);
        expect(fetchFn).toHaveBeenCalled();

        // subsequent call should hit cache
        const fetchFn2 = jest.fn();
        const result2 = await getCachedOrFetch(key, fetchFn2);
        expect(result2).toBe(val);
        expect(fetchFn2).not.toHaveBeenCalled();
    });
});
