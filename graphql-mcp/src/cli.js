import { createMcpServer } from "./app.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import logger from "./logger.js";

async function main() {
    const server = createMcpServer();
    const transport = new StdioServerTransport();

    logger.info("Starting GraphQL MCP Server via Stdio");

    await server.connect(transport);
}

main().catch(err => {
    logger.error("Fatal Error in Stdio Server", { error: err.message });
    process.exit(1);
});
