
import express from "express";
import rateLimit from "express-rate-limit";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "./config.js";
import logger from "./logger.js";
import { getCachedOrFetch } from "./cache.js";
import { summarize } from "./utils.js";
import { validateQuery, sanitizeResponse } from "./validator.js";

const app = express();

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Request Logging Middleware
app.use((req, res, next) => {
    logger.info("Incoming Request", { method: req.method, url: req.url, headers: summarize(req.headers) });
    next();
});

// CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, mcp-protocol-version");
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(express.json());

// JSON parsing error handler
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        logger.warn("JSON Parse Error", { error: err.message, url: req.url });
        return res.status(400).json({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse error: Invalid JSON" },
            id: null
        });
    }
    next(err);
});

// --- ROUTES ---

// Healthcheck
app.get("/health", (req, res) => {
    // Logic: connection to GitHub / schemas could be checked here
    // For now, simple up status
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/openapi.json", (req, res) => {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.get("host");
    const serverUrl = `${protocol}://${host}`;

    res.json({
        openapi: "3.0.1",
        info: {
            title: "GraphQL MCP Server",
            description: "Model Context Protocol Server for GraphQL",
            version: "1.0.0"
        },
        servers: [
            {
                url: serverUrl
            }
        ],
        paths: {
            "/sse": {
                get: {
                    summary: "Connect via Server-Sent Events",
                    responses: {
                        "200": {
                            description: "SSE Stream"
                        }
                    }
                },
                post: {
                    summary: "Send JSON-RPC Message",
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object"
                                }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "JSON-RPC Response"
                        },
                        "204": {
                            description: "Notification Acknowledgment"
                        }
                    }
                }
            }
        }
    });
});

// Helper: Use a separate cache key for the parsed Schema object
async function getOrFetchSchema() {
    return await getCachedOrFetch("parsed_schema", async () => {
        const { getIntrospectionQuery, buildClientSchema } = await import("graphql");
        // Use executeGraphQL with skipValidation=true to avoid infinite recursion
        const query = getIntrospectionQuery();
        const data = await executeGraphQL(query, {}, true);
        return buildClientSchema(data);
    });
}

// Helper: GraphQL Executor
async function executeGraphQL(query, variables = {}, skipValidation = false) {
    if (!skipValidation) {
        let schema = null;
        try {
            schema = await getOrFetchSchema();
        } catch (e) {
            logger.warn("Schema fetch failed, proceeding with syntax validation only", { error: e.message });
        }

        // Validate Query (Syntax, Security, Structure, Schema)
        validateQuery(query, variables, schema);
    }

    const endpoint = config.GRAPHQL_MCP_ENDPOINT;
    const apiKey = config.GRAPHQL_API_KEY;

    const headers = {
        "Content-Type": "application/json",
        "User-Agent": "DirectQL/GraphQL-MCP-Agent/1.0"
    };

    if (apiKey) {
        if (endpoint.includes("github.com") || config.AUTH_TYPE === "Bearer") {
            headers["Authorization"] = `Bearer ${apiKey}`;
        } else {
            headers["x-api-key"] = apiKey;
        }
    }

    logger.info("Executing GraphQL Query", { query: summarize(query), variables: summarize(variables) });

    const response = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
        throw new Error(`GraphQL Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const sanitizedData = sanitizeResponse(data?.data ? data.data : data);

    // Only log if not skipping validation (internal calls) or if desired
    if (!skipValidation) {
        logger.info("GraphQL Response", { data: summarize(sanitizedData) });
    }
    return sanitizedData;
}

// MCP Server Factory
export function createMcpServer() {
    const server = new McpServer({
        name: "GraphQL MCP Server",
        version: "1.0.0"
    });

    // Resource: Schema with Caching
    server.resource(
        "graphql-schema",
        "graphql://schema",
        async (uri) => {
            try {
                const { printSchema } = await import("graphql");
                // Use the shared schema fetcher
                const schema = await getOrFetchSchema();
                const schemaSDL = printSchema(schema);

                return {
                    contents: [{
                        uri: uri.href,
                        text: schemaSDL,
                        mimeType: "text/plain"
                    }]
                };
            } catch (error) {
                logger.error("Failed to fetch schema", { error: error.message });
                throw new Error(`Failed to fetch schema resource: ${error.message}`);
            }
        }
    );

    // Tool: Introspect
    server.tool(
        "introspect-graphql-schema",
        "Retrieves the full GraphQL schema.",
        {},
        async () => {
            try {
                const { getIntrospectionQuery } = await import("graphql");
                const query = getIntrospectionQuery();
                // We do not cache raw introspection JSON for now, only SDL, but we could.
                const data = await executeGraphQL(query);
                return { content: [{ type: "text", text: JSON.stringify(data) }] };
            } catch (error) {
                return { content: [{ type: "text", text: `Error: ${error.message}` }] };
            }
        }
    );

    // Tool: Query
    server.tool(
        "query-graphql",
        "Executes a GraphQL query.",
        { query: z.string() },
        async ({ query }) => {
            try {
                if (config.GRAPHQL_READ_ONLY) {
                    const { parse } = await import("graphql");
                    const ast = parse(query);
                    const hasMutation = ast.definitions.some(
                        def => def.kind === 'OperationDefinition' && def.operation === 'mutation'
                    );
                    if (hasMutation) {
                        return { content: [{ type: "text", text: "Error: Mutations are NOT allowed in Read-only mode." }] };
                    }
                }
                const data = await executeGraphQL(query);
                return { content: [{ type: "text", text: JSON.stringify(data) }] };
            } catch (error) {
                return { content: [{ type: "text", text: `Error: ${error.message}` }] };
            }
        }
    );

    // Prompt: Write Query
    server.prompt(
        "write-graphql-query",
        "Generate a GraphQL query.",
        { request: { type: "string" } },
        ({ request }) => ({
            messages: [{
                role: "user",
                content: { type: "text", text: `Generate query for: "${request}". Inspect 'graphql://schema'.` }
            }]
        })
    );

    return server;
}

// SSE Transport
const sessions = new Map();

app.get("/sse", async (req, res) => {
    logger.info("New SSE Connection");
    const transport = new SSEServerTransport("/messages", res);
    const server = createMcpServer();
    sessions.set(transport.sessionId, { transport, server });

    transport.onclose = () => sessions.delete(transport.sessionId);
    await server.connect(transport);
});

app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId;
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).send("Session not found");
    await session.transport.handlePostMessage(req, res);
});

// Stateless JSON-RPC Handler for MCP Protocol
app.post("/sse", async (req, res) => {
    const body = req.body;

    if (!body || !body.jsonrpc) {
        return res.status(400).json({ error: "Invalid JSON-RPC request" });
    }

    const { id, method, params } = body;

    // Helper to send JSON-RPC response
    const sendResult = (result) => res.json({ jsonrpc: "2.0", id, result });
    const sendError = (code, message) => res.json({ jsonrpc: "2.0", id, error: { code, message } });

    try {
        switch (method) {
            case "initialize":
                return sendResult({
                    protocolVersion: "2024-11-05",
                    capabilities: {
                        tools: {},
                        resources: { subscribe: false },
                        prompts: {}
                    },
                    serverInfo: {
                        name: "GraphQL MCP Server",
                        version: "1.0.0"
                    }
                });

            case "notifications/initialized":
                // Acknowledge notification with empty response
                return res.json({});

            case "tools/list":
                return sendResult({
                    tools: [
                        {
                            name: "introspect-graphql-schema",
                            description: "Retrieves the full GraphQL schema.",
                            inputSchema: { type: "object", properties: {}, required: [] }
                        },
                        {
                            name: "query-graphql",
                            description: "Executes a GraphQL query.",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    query: { type: "string", description: "The GraphQL query to execute" }
                                },
                                required: ["query"]
                            }
                        }
                    ]
                });

            case "tools/call":
                const toolName = params?.name;
                const toolArgs = params?.arguments || {};

                logger.info(`Tool Call: ${toolName}`, { args: summarize(toolArgs) });

                if (toolName === "introspect-graphql-schema") {
                    try {
                        const { getIntrospectionQuery } = await import("graphql");
                        const query = getIntrospectionQuery();
                        const data = await executeGraphQL(query);
                        // Summary of result for logs
                        logger.info("Tool Result: introspect-graphql-schema", { result: summarize(data) });
                        return sendResult({ content: [{ type: "text", text: JSON.stringify(data) }] });
                    } catch (error) {
                        return sendResult({ content: [{ type: "text", text: `Error: ${error.message}` }] });
                    }
                } else if (toolName === "query-graphql") {
                    try {
                        const query = toolArgs.query;
                        if (!query) {
                            return sendResult({ content: [{ type: "text", text: "Error: Missing 'query' argument" }] });
                        }

                        // Validation happens inside executeGraphQL
                        const data = await executeGraphQL(query);
                        logger.info("Tool Result: query-graphql", { result: summarize(data) });
                        return sendResult({ content: [{ type: "text", text: JSON.stringify(data) }] });
                    } catch (error) {
                        return sendResult({ content: [{ type: "text", text: `Error: ${error.message}` }] });
                    }
                } else {
                    return sendError(-32601, `Unknown tool: ${toolName}`);
                }

            case "resources/list":
                return sendResult({
                    resources: [
                        {
                            uri: "graphql://schema",
                            name: "GraphQL Schema",
                            description: "The introspected GraphQL schema in SDL format",
                            mimeType: "text/plain"
                        }
                    ]
                });

            case "resources/read":
                const uri = params?.uri;
                logger.info(`Resource Read: ${uri}`);
                if (uri === "graphql://schema") {
                    try {
                        // Reuse the centralized schema fetcher if possible, or keep this efficiently caching SDL
                        const schemaSDL = await getCachedOrFetch("schema_sdl", async () => {
                            const { printSchema } = await import("graphql");
                            const schema = await getOrFetchSchema();
                            return printSchema(schema);
                        });
                        return sendResult({
                            contents: [{
                                uri: uri,
                                text: schemaSDL,
                                mimeType: "text/plain"
                            }]
                        });
                    } catch (error) {
                        return sendError(-32000, `Failed to read schema: ${error.message}`);
                    }
                } else {
                    return sendError(-32602, `Unknown resource: ${uri}`);
                }

            case "prompts/list":
                return sendResult({
                    prompts: [
                        {
                            name: "write-graphql-query",
                            description: "Generate a GraphQL query.",
                            arguments: [
                                { name: "request", description: "Description of the query to generate", required: true }
                            ]
                        }
                    ]
                });

            case "prompts/get":
                const promptName = params?.name;
                if (promptName === "write-graphql-query") {
                    const request = params?.arguments?.request || "a query";
                    return sendResult({
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Generate query for: "${request}". Inspect 'graphql://schema'.` }
                        }]
                    });
                } else {
                    return sendError(-32602, `Unknown prompt: ${promptName}`);
                }

            default:
                return sendError(-32601, `Method not found: ${method}`);
        }
    } catch (error) {
        logger.error("Stateless handler error", { error: error.message });
        return sendError(-32603, `Internal error: ${error.message}`);
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    logger.error("Unhandled Exception", { error: err.message, stack: err.stack });
    res.status(500).json({ status: "error", message: "Internal Server Error" });
});

export { app };
