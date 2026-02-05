import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import rateLimit from "express-rate-limit";

const app = express();
const port = process.env.PORT || 3000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply the rate limiting middleware to all requests
app.use(limiter);

// Add logging to debug incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers));
  next();
});

// Enable CORS for all routes (to allow Open WebUI frontend/backend to connect)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});


// Factory function to create a fresh McpServer instance
function createMcpServer() {
  const server = new McpServer({
    name: "Apollo GraphQL MCP",
    version: "1.0.0"
  });

  // Helper: Execute GraphQL Request
  async function executeGraphQL(query, variables = {}) {
    const endpoint = process.env.APOLLO_MCP_ENDPOINT;
    const apiKey = process.env.APOLLO_KEY;

    if (!endpoint) {
      throw new Error("APOLLO_MCP_ENDPOINT not set");
    }

    // Determine Auth Headers
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "DirectQL/Apollo-MCP-Agent/1.0"
    };

    if (apiKey) {
      if (endpoint.includes("github.com") || process.env.AUTH_TYPE === "Bearer") {
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else {
        headers["x-api-key"] = apiKey;
      }
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ query, variables })
    });

    const data = await response.json();
    return data;
  }

  // Tool: Introspect Schema
  server.tool(
    "introspect-graphql-schema",
    "Retrieves the full GraphQL schema using standard introspection. Use this to understand available types, queries, and mutations.",
    {},
    async () => {
      try {
        const { getIntrospectionQuery } = await import("graphql");
        const query = getIntrospectionQuery();
        const data = await executeGraphQL(query);
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error introspecting schema: ${error.message}` }] };
      }
    }
  );

  // Tool: Query GraphQL
  server.tool(
    "query-graphql",
    "Executes a GraphQL query against the configured API. Use this to fetch data.",
    { query: { type: "string", description: "The GraphQL query string" } },
    async ({ query }) => {
      try {
        const isReadOnly = process.env.GRAPHQL_READ_ONLY === 'true';

        // Security Check: Validate and Enforce Read-Only
        const { parse } = await import("graphql");
        const ast = parse(query);

        if (isReadOnly) {
          const hasMutation = ast.definitions.some(
            def => def.kind === 'OperationDefinition' && def.operation === 'mutation'
          );
          if (hasMutation) {
            return { content: [{ type: "text", text: "Error: Mutations are not allowed in Read-Only mode." }] };
          }
        }

        const data = await executeGraphQL(query);
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error fetching GraphQL: ${error.message}` }] };
      }
    }
  );

  return server;
}

// Mount SSE Transport
// We need to store active transports and servers to handle incoming POST messages
// Map<sessionId, { transport, server }>
const sessions = new Map();

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;
  const server = createMcpServer();

  sessions.set(sessionId, { transport, server });

  transport.onclose = () => {
    sessions.delete(sessionId);
  };

  await server.connect(transport);
});

// Middleware for parsing JSON bodies (needed for POST /sse logging/handling)
app.use(express.json());

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const session = sessions.get(sessionId);

  if (!session) {
    res.status(404).send("Session not found");
    return;
  }

  await session.transport.handlePostMessage(req, res);
});

// Stateless Transport for handling direct HTTP POSTs (Open WebUI Hybrid Mode)
class StatelessHttpTransport {
  constructor(res) {
    this.res = res;
    this.onmessage = undefined;
    this.onclose = undefined;
    this.onerror = undefined;
  }

  async start() {
    // No-op for stateless
  }

  async close() {
    if (this.onclose) {
      this.onclose();
    }
  }

  // Called by McpServer when it wants to send a message back to client
  async send(message) {
    console.log(`[${new Date().toISOString()}] Stateless Response:`, JSON.stringify(message));

    if (!this.res.headersSent) {
      this.res.json(message);
    } else {
      console.warn("Headers already sent, dropping message:", JSON.stringify(message));
    }
  }

  // Called by us to inject the incoming message
  async handleMessage(message) {
    console.log(`[${new Date().toISOString()}] Stateless Request Injection:`, JSON.stringify(message));
    if (this.onmessage) {
      this.onmessage(message);
    }
  }
}

// Handle POST /sse to support clients that Default to POSTing to the endpoint
// Open WebUI verification seems to POST to /sse with JSON-RPC body
app.post("/sse", async (req, res) => {
  console.log(`[${new Date().toISOString()}] Handling POST /sse`);
  const body = req.body;
  console.log('Body:', JSON.stringify(body));

  const sessionId = req.query.sessionId;

  // Case 1: Standard SSE Post-Back (with Session ID)
  if (sessionId) {
    console.log(`Routing POST /sse to transport session: ${sessionId}`);
    const session = sessions.get(sessionId);
    if (session) {
      await session.transport.handlePostMessage(req, res);
      return;
    }
    return res.status(404).send("Session not found");
  }

  // Case 2: Stateless JSON-RPC (e.g. Open WebUI Init)
  if (body && body.jsonrpc) {
    console.log('Detected Stateless JSON-RPC request');
    const transport = new StatelessHttpTransport(res);
    const server = createMcpServer(); // Create a fresh server instance
    await server.connect(transport);
    await transport.handleMessage(body);

    // Transport.send() will handle the response.
    // We manually close to ensure cleanup, though for stateless HTTP the res.json() ends it.
    await transport.close();
    return;
  }

  // Case 3: Unknown / Ping
  console.log('Unknown POST /sse request type');
  res.status(200).json({ status: "ok", message: "Use GET /sse to establish connection first" });
});

app.listen(port, () => {
  console.log(`Apollo MCP Server running on port ${port} at /sse`);
});
