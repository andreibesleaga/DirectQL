
import winston from 'winston';

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'graphql-mcp-server' },
    transports: [
        // Every level goes to stderr, without colour codes: in stdio mode stdout carries only MCP JSON-RPC.
        new winston.transports.Console({
            stderrLevels: Object.keys(winston.config.npm.levels),
            format: winston.format.simple()
        })
    ]
});

export default logger;
