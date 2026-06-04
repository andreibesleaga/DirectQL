
import NodeCache from 'node-cache';
import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js';
import { recordCacheHit, recordCacheMiss, setCacheKeyCount } from './metrics.js';

// Cache TTL: 1 hour (3600 seconds). Exported so docs/CACHE.md can be asserted in sync.
export const CACHE_TTL_SECONDS = 3600;
export const CACHE_CHECK_PERIOD_SECONDS = 600;
const schemaCache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, checkperiod: CACHE_CHECK_PERIOD_SECONDS });
const LOCAL_SCHEMAS_DIR = path.join(process.cwd(), 'schemas');

// Keep the cache-key gauge in sync after any mutation.
function syncKeyGauge() {
    try {
        setCacheKeyCount(schemaCache.keys().length);
    } catch {
        // Gauge updates are best-effort; never let metrics break the cache.
    }
}

export async function getCachedOrFetch(key, fetchFn) {
    // 1. Try In-Memory Cache
    const cached = schemaCache.get(key);
    if (cached) {
        logger.debug(`Cache hit (memory) for ${key}`);
        recordCacheHit('memory');
        return cached;
    }

    // 2. Try Local File Override (if key maps to a file)
    // For 'schema', we might look for 'schema.graphql'.
    // path.basename() prevents directory traversal via crafted keys (defense-in-depth).
    try {
        const sanitizedKey = path.basename(key);
        const localFilePath = path.join(LOCAL_SCHEMAS_DIR, `${sanitizedKey}.graphql`);
        const stats = await fs.stat(localFilePath);
        if (stats.isFile()) {
            logger.info(`Cache hit (file) for ${key}`);
            const content = await fs.readFile(localFilePath, 'utf-8');
            // Cache the file content in memory too
            schemaCache.set(key, content);
            syncKeyGauge();
            recordCacheHit('file');
            return content;
        }
    } catch (err) {
        // Ignore file not found
    }

    // 3. Fetch from Remote
    logger.info(`Cache miss for ${key}. Fetching from remote...`);
    recordCacheMiss();
    try {
        const data = await fetchFn();
        schemaCache.set(key, data);
        syncKeyGauge();
        return data;
    } catch (error) {
        logger.error(`Failed to fetch ${key}`, { error: error.message });
        throw error;
    }
}

export function setCache(key, val) {
    schemaCache.set(key, val);
    syncKeyGauge();
}

export function clearCache() {
    schemaCache.flushAll();
    syncKeyGauge();
}

/**
 * Lists the local schema files available under the schemas/ directory.
 * These are exposed as MCP resources under the `graphql://local/<filename>` URI scheme.
 *
 * @returns {Promise<string[]>} The filenames (e.g. ["schema.docs.graphql"]). Empty if the dir is missing.
 */
export async function listLocalSchemas() {
    try {
        const entries = await fs.readdir(LOCAL_SCHEMAS_DIR, { withFileTypes: true });
        return entries
            .filter(e => e.isFile() && /\.(graphql|gql)$/i.test(e.name))
            .map(e => e.name)
            .sort();
    } catch (err) {
        logger.debug('No local schemas directory or unreadable', { error: err.message });
        return [];
    }
}

/**
 * Reads a single local schema file by name. The name is reduced to its basename so a
 * crafted value (e.g. "../../etc/passwd") can never escape the schemas/ directory.
 *
 * @param {string} name - The schema filename (basename only is honoured).
 * @returns {Promise<string>} The file contents.
 * @throws {Error} If the file does not exist or is not readable.
 */
export async function readLocalSchema(name) {
    const sanitizedName = path.basename(String(name || ''));
    if (!sanitizedName || !/\.(graphql|gql)$/i.test(sanitizedName)) {
        throw new Error(`Invalid local schema name: ${name}`);
    }
    const filePath = path.join(LOCAL_SCHEMAS_DIR, sanitizedName);
    return await fs.readFile(filePath, 'utf-8');
}
