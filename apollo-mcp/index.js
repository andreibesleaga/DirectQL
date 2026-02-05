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


// Initialize MCP Server
const server = new McpServer({
  name: "Apollo GraphQL MCP",
  version: "1.0.0"
});

// Tool: Query GraphQL
server.tool(
  "query-graphql",
  "Executes a GraphQL query against the configured API. Use this to fetch data.",
  { query: { type: "string", description: "The GraphQL query string" } },
  async ({ query }) => {
    const endpoint = process.env.APOLLO_MCP_ENDPOINT;
    const apiKey = process.env.APOLLO_KEY;
    const isReadOnly = process.env.GRAPHQL_READ_ONLY === 'true';

    if (!endpoint) {
      return { content: [{ type: "text", text: "Error: APOLLO_MCP_ENDPOINT not set." }] };
    }

    try {
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

      // Determine Auth Headers
      // GitHub requires: 'Authorization: Bearer <token>' and 'User-Agent'
      // Default (Apollo/Original): 'x-api-key: <token>'
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
        body: JSON.stringify({ query })
      });

      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error fetching GraphQL: ${error.message}` }] };
    }
  }
);

// Mount SSE Transport
// We need to store active transports to handle incoming POST messages
const transports = new Map();

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;

  transports.set(sessionId, transport);

  transport.onclose = () => {
    transports.delete(sessionId);
  };

  await server.connect(transport);
});

// Middleware for parsing JSON bodies (needed for POST /sse logging/handling)
app.use(express.json());

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).send("Session not found");
    return;
  }

  await transport.handlePostMessage(req, res);
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
    // For stateless HTTP, we take the first message and send it as the HTTP response.
    // NOTE: This assumes 1 Request -> 1 Response.
    // If McpServer sends multiple notifications, this might break or we ignore subsequent ones.
    // For 'initialize' and 'call_tool', it's usually 1-to-1.
    if (!this.res.headersSent) {
      this.res.json(message);
    }
  }

  // Called by us to inject the incoming message
  async handleMessage(message) {
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
    const transport = transports.get(sessionId);
    if (transport) {
      await transport.handlePostMessage(req, res);
      return;
    }
    return res.status(404).send("Session not found");
  }

  // Case 2: Stateless JSON-RPC (e.g. Open WebUI Init)
  if (body && body.jsonrpc) {
    console.log('Detected Stateless JSON-RPC request');
    const transport = new StatelessHttpTransport(res);
    await server.connect(transport);
    await transport.handleMessage(body);
    // Transport.send() will handle the response.
    // We should probably close/disconnect after response is likely sent?
    // Since send() writes res.json(), the response ends there.
    // We can trigger close.
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
