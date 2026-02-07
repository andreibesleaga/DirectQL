
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
    LOG_LEVEL: z.string().default('info')
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
