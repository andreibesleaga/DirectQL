
import dotenv from 'dotenv';
import { z } from 'zod';
import logger from './logger.js';

dotenv.config({ path: ["../.env", "../../.env"] });
dotenv.config(); // Also try local .env

const configSchema = z.object({
    PORT: z.string().default("3000").transform(Number),
    GRAPHQL_MCP_ENDPOINT: z.string().url(),
    GRAPHQL_API_KEY: z.string().optional(),
    AUTH_TYPE: z.enum(['Bearer', 'x-api-key', 'none']).default('Bearer'),
    GRAPHQL_READ_ONLY: z.enum(['true', 'false']).default('true').transform(val => val === 'true'),
    LOG_LEVEL: z.string().default('info'),

    // --- Query guardrails (defaults preserve previous behavior) ---
    // --- Query guardrails (defaults preserve previous behavior) ---
    // Maximum allowed query depth. Default 15 == the value previously hardcoded in validator.js.
    GRAPHQL_MAX_DEPTH: z.coerce.number().int().min(1).default(15),
    // Maximum allowed query complexity (rough field-count score). 0 == disabled (previous behavior).
    // Recommended production value: 1000.
    GRAPHQL_COMPLEXITY_LIMIT: z.coerce.number().int().min(0).default(0),
    // Comma-separated allowlist of endpoints whose schema may be introspected.
    // Empty == allow introspection of any configured endpoint (previous behavior).
    INTROSPECTION_ALLOWLIST: z.string().optional().transform(val => (val ? val.split(',').map(s => s.trim()).filter(Boolean) : [])),

    // --- Observability ---
    // Expose Prometheus metrics at GET /metrics. Default on; the route is purely additive.
    METRICS_ENABLED: z.enum(['true', 'false']).default('true').transform(val => val === 'true')
});

function loadConfig() {
    try {
        const config = configSchema.parse(process.env);
        logger.info("Configuration loaded successfully", {
            endpoint: config.GRAPHQL_MCP_ENDPOINT,
            readOnly: config.GRAPHQL_READ_ONLY
        });
        return config;
    } catch (error) {
        logger.error("Configuration validation failed", { errors: error.errors });
        process.exit(1);
    }
}

export const config = loadConfig();
