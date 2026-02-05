
import assert from 'assert';


const BASE_URL = process.env.MCP_SERVER_URL || "http://localhost:3000/sse";

async function runTest() {
    console.log(`Starting E2E Simulation against: ${BASE_URL}`);

    // 1. Check Health/OpenAPI
    console.log("1. Checking Health and OpenAPI...");
    // Parse base URL to get origin (handle /sse path)
    const origin = new URL(BASE_URL).origin;

    const health = await fetch(`${origin}/health`).then(r => r.json());
    assert.equal(health.status, "ok", "Health check failed");

    const openapi = await fetch(`${origin}/openapi.json`).then(r => r.json());
    assert.equal(openapi.openapi, "3.0.1", "OpenAPI spec missing");
    console.log("✅ Health & OpenAPI OK");

    // 2. Initialize (Stateless)
    console.log("2. Initializing (Stateless)...");
    const initResponse = await fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "test-client", version: "1.0.0" }
            }
        })
    }).then(r => r.json());

    assert(initResponse.result, "Initialize missing result");
    assert(initResponse.result.serverInfo, "Server info missing");
    console.log("✅ Initialize OK");

    // 3. Send Notification (initialized)
    console.log("3. Sending Notification (initialized)...");
    const notifyResponse = await fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "notifications/initialized"
        })
    });

    // Expecting 200 OK with empty JSON
    assert.equal(notifyResponse.status, 200, "Notification status incorrect");
    const notifyBody = await notifyResponse.json();
    assert.deepStrictEqual(notifyBody, {}, "Notification body should be empty JSON");
    console.log("✅ Notification OK");

    // 4. List Tools
    console.log("4. Listing Tools...");
    const toolsResponse = await fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list"
        })
    }).then(r => r.json());

    const tools = toolsResponse.result.tools;
    assert(tools.length >= 2, "Expected at least 2 tools");
    const queryTool = tools.find(t => t.name === "query-graphql");
    assert(queryTool, "query-graphql tool missing");

    // Verify Zod Schema structure (properties should verify the fix)
    assert(queryTool.inputSchema.properties.query, "query property missing in schema");
    console.log("✅ Tools OK");

    // 5. List Resources
    console.log("5. Listing Resources...");
    const resourcesResponse = await fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            method: "resources/list"
        })
    }).then(r => r.json());

    const resources = resourcesResponse.result.resources;
    assert(resources.some(r => r.uri === "graphql://schema"), "graphql://schema resource missing");
    console.log("✅ Resources OK");

    // 6. Test Introspection Execution (Mocking a call)
    // We won't actually introspect GitHub (might fail on network/auth in simple test), 
    // but we verify the call structure works.
    // Actually, let's try calling `introspect-graphql-schema`. 
    // If it fails due to Auth, that's fine, as long as it's an API failure not a Protocol failure.

    console.log("6. Executing Tool (Introspection)...");
    const callResponse = await fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 4,
            method: "tools/call",
            params: {
                name: "introspect-graphql-schema",
                arguments: {}
            }
        })
    }).then(r => r.json());

    // We expect a Result, even if inside the content it says "Error"
    assert(callResponse.result, "Tool call missing result");
    // Check if content exists
    const content = callResponse.result.content[0].text;
    console.log("Tool verification output snippet:", content.substring(0, 100));

    console.log("✅ E2E Simulation Completed Successfully.");
}

runTest().catch(err => {
    console.error("❌ Test Failed:", err);
    process.exit(1);
});
