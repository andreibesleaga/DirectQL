
import NodeCache from 'node-cache';
import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js';

// Cache TTL: 1 hour (3600 seconds)
const schemaCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const LOCAL_SCHEMAS_DIR = path.join(process.cwd(), 'schemas');

export async function getCachedOrFetch(key, fetchFn) {
    // 1. Try In-Memory Cache
    const cached = schemaCache.get(key);
    if (cached) {
        logger.debug(`Cache hit (memory) for ${key}`);
        return cached;
    }

    // 2. Try Local File Override (if key maps to a file)
    // For 'schema', we might look for 'schema.graphql'
    try {
        const localFilePath = path.join(LOCAL_SCHEMAS_DIR, `${key}.graphql`);
        const stats = await fs.stat(localFilePath);
        if (stats.isFile()) {
            logger.info(`Cache hit (file) for ${key}`);
            const content = await fs.readFile(localFilePath, 'utf-8');
            // Cache the file content in memory too
            schemaCache.set(key, content);
            return content;
        }
    } catch (err) {
        // Ignore file not found
    }

    // 3. Fetch from Remote
    logger.info(`Cache miss for ${key}. Fetching from remote...`);
    try {
        const data = await fetchFn();
        schemaCache.set(key, data);
        return data;
    } catch (error) {
        logger.error(`Failed to fetch ${key}`, { error: error.message });
        throw error;
    }
}

export function setCache(key, val) {
    schemaCache.set(key, val);
}

export function clearCache() {
    schemaCache.flushAll();
}
