/**
 * Comprehensive MCP Protocol Test Suite
 * Tests the full MCP server protocol according to spec 2024-11-05
 * 
 * Run: node test/integration/mcp_protocol.test.js
 */

import assert from 'assert';

const BASE_URL = process.env.MCP_SERVER_URL || "http://localhost:3000";
const SSE_ENDPOINT = `${BASE_URL}/sse`;

// Test state
let requestId = 0;
const getNextId = () => ++requestId;

// Helper: Send JSON-RPC request
async function sendJsonRpc(method, params = {}) {
    const id = getNextId();
    const response = await fetch(SSE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            method,
            params
        })
    });
    return response.json();
}

// Helper: Send notification (no id)
async function sendNotification(method, params = {}) {
    const response = await fetch(SSE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method,
            params
        })
    });
    return response.json();
}

// Test results tracking
const results = { passed: 0, failed: 0, tests: [] };

function logTest(name, passed, details = "") {
    const status = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status}: ${name}`);
    if (!passed && details) console.log(`   Details: ${details}`);
    results.tests.push({ name, passed, details });
    if (passed) results.passed++;
    else results.failed++;
}

// ============================================
// SECTION 1: MCP LIFECYCLE TESTS
// ============================================
async function testLifecycle() {
    console.log("\n📋 SECTION 1: MCP LIFECYCLE TESTS\n");

    // Test 1.1: Initialize
    {
        const res = await sendJsonRpc("initialize", {
            protocolVersion: "2024-11-05",
            capabilities: { roots: { listChanged: true } },
            clientInfo: { name: "TestClient", version: "1.0.0" }
        });

        const hasResult = !!res.result;
        const hasProtocolVersion = res.result?.protocolVersion === "2024-11-05";
        const hasServerInfo = !!res.result?.serverInfo?.name;
        const hasCapabilities = !!res.result?.capabilities;

        logTest("1.1 Initialize returns valid response",
            hasResult && hasProtocolVersion && hasServerInfo && hasCapabilities,
            JSON.stringify(res).substring(0, 200));
    }

    // Test 1.2: Initialized notification
    {
        const res = await sendNotification("notifications/initialized");
        const isEmptyObject = JSON.stringify(res) === "{}";
        logTest("1.2 Initialized notification acknowledged", isEmptyObject, JSON.stringify(res));
    }

    // Test 1.3: Invalid method returns error
    {
        const res = await sendJsonRpc("nonexistent/method");
        const hasError = !!res.error || (res.result === undefined && res.error);
        logTest("1.3 Invalid method returns error",
            res.error?.code === -32601 || res.error !== undefined,
            JSON.stringify(res));
    }
}

// ============================================
// SECTION 2: TOOLS TESTS
// ============================================
async function testTools() {
    console.log("\n🔧 SECTION 2: TOOLS TESTS\n");

    // Test 2.1: List tools
    {
        const res = await sendJsonRpc("tools/list");
        const hasTools = Array.isArray(res.result?.tools);
        const hasExpectedTools = res.result?.tools?.some(t => t.name === "query-graphql") &&
            res.result?.tools?.some(t => t.name === "introspect-graphql-schema");

        logTest("2.1 tools/list returns array", hasTools, `Tools count: ${res.result?.tools?.length}`);
        logTest("2.2 tools/list has expected tools", hasExpectedTools,
            `Tools: ${res.result?.tools?.map(t => t.name).join(", ")}`);
    }

    // Test 2.3: Tool has required fields
    {
        const res = await sendJsonRpc("tools/list");
        const tool = res.result?.tools?.[0];
        const hasName = typeof tool?.name === "string";
        const hasDescription = typeof tool?.description === "string";
        const hasInputSchema = typeof tool?.inputSchema === "object";

        logTest("2.3 Tool has required fields (name, description, inputSchema)",
            hasName && hasDescription && hasInputSchema,
            `name: ${hasName}, description: ${hasDescription}, inputSchema: ${hasInputSchema}`);
    }

    // Test 2.4: Call introspect tool
    {
        const res = await sendJsonRpc("tools/call", {
            name: "introspect-graphql-schema",
            arguments: {}
        });
        const hasContent = Array.isArray(res.result?.content);
        const hasTextType = res.result?.content?.[0]?.type === "text";
        const hasSchemaData = res.result?.content?.[0]?.text?.includes("__schema") ||
            res.result?.content?.[0]?.text?.includes("Error");

        logTest("2.4 tools/call introspect returns content",
            hasContent && hasTextType,
            `Content type: ${res.result?.content?.[0]?.type}`);
    }

    // Test 2.5: Call query-graphql with valid query
    {
        const res = await sendJsonRpc("tools/call", {
            name: "query-graphql",
            arguments: { query: "query { __typename }" }
        });
        const hasContent = Array.isArray(res.result?.content);
        const hasTextType = res.result?.content?.[0]?.type === "text";

        logTest("2.5 tools/call query-graphql works", hasContent && hasTextType,
            `Response: ${res.result?.content?.[0]?.text?.substring(0, 100)}`);
    }

    // Test 2.6: Call unknown tool returns error
    {
        const res = await sendJsonRpc("tools/call", {
            name: "unknown-tool",
            arguments: {}
        });
        const hasError = !!res.error;
        logTest("2.6 Unknown tool returns error", hasError, JSON.stringify(res.error || res.result));
    }
}

// ============================================
// SECTION 3: RESOURCES TESTS
// ============================================
async function testResources() {
    console.log("\n📚 SECTION 3: RESOURCES TESTS\n");

    // Test 3.1: List resources
    {
        const res = await sendJsonRpc("resources/list");
        const hasResources = Array.isArray(res.result?.resources);
        const hasSchemaResource = res.result?.resources?.some(r => r.uri === "graphql://schema");

        logTest("3.1 resources/list returns array", hasResources,
            `Resources count: ${res.result?.resources?.length}`);
        logTest("3.2 resources/list has graphql://schema", hasSchemaResource,
            `URIs: ${res.result?.resources?.map(r => r.uri).join(", ")}`);
    }

    // Test 3.3: Resource has required fields
    {
        const res = await sendJsonRpc("resources/list");
        const resource = res.result?.resources?.[0];
        const hasUri = typeof resource?.uri === "string";
        const hasName = typeof resource?.name === "string";

        logTest("3.3 Resource has required fields (uri, name)", hasUri && hasName,
            `uri: ${hasUri}, name: ${hasName}`);
    }

    // Test 3.4: Read schema resource
    {
        const res = await sendJsonRpc("resources/read", { uri: "graphql://schema" });
        const hasContents = Array.isArray(res.result?.contents);
        const hasText = typeof res.result?.contents?.[0]?.text === "string";
        const hasSchemaContent = res.result?.contents?.[0]?.text?.includes("type") ||
            res.result?.contents?.[0]?.text?.includes("Error");

        logTest("3.4 resources/read graphql://schema works",
            hasContents && hasText,
            `Schema preview: ${res.result?.contents?.[0]?.text?.substring(0, 80)}...`);
    }

    // Test 3.5: Read unknown resource returns error
    {
        const res = await sendJsonRpc("resources/read", { uri: "unknown://resource" });
        const hasError = !!res.error;
        logTest("3.5 Unknown resource returns error", hasError, JSON.stringify(res.error || res.result));
    }
}

// ============================================
// SECTION 4: PROMPTS TESTS
// ============================================
async function testPrompts() {
    console.log("\n💬 SECTION 4: PROMPTS TESTS\n");

    // Test 4.1: List prompts
    {
        const res = await sendJsonRpc("prompts/list");
        const hasPrompts = Array.isArray(res.result?.prompts);
        const hasWriteQueryPrompt = res.result?.prompts?.some(p => p.name === "write-graphql-query");

        logTest("4.1 prompts/list returns array", hasPrompts,
            `Prompts count: ${res.result?.prompts?.length}`);
        logTest("4.2 prompts/list has write-graphql-query", hasWriteQueryPrompt,
            `Prompts: ${res.result?.prompts?.map(p => p.name).join(", ")}`);
    }

    // Test 4.3: Get prompt
    {
        const res = await sendJsonRpc("prompts/get", {
            name: "write-graphql-query",
            arguments: { request: "list all users" }
        });
        const hasMessages = Array.isArray(res.result?.messages);
        const hasUserRole = res.result?.messages?.[0]?.role === "user";
        const hasContent = !!res.result?.messages?.[0]?.content;

        logTest("4.3 prompts/get returns messages", hasMessages && hasUserRole,
            `Response: ${JSON.stringify(res.result?.messages?.[0]).substring(0, 100)}`);
    }

    // Test 4.4: Get unknown prompt returns error
    {
        const res = await sendJsonRpc("prompts/get", { name: "unknown-prompt" });
        const hasError = !!res.error;
        logTest("4.4 Unknown prompt returns error", hasError, JSON.stringify(res.error || res.result));
    }
}

// ============================================
// SECTION 5: SECURITY TESTS
// ============================================
async function testSecurity() {
    console.log("\n🔒 SECTION 5: SECURITY TESTS\n");

    // Test 5.1: CORS headers present
    {
        const res = await fetch(`${BASE_URL}/health`);
        const corsHeader = res.headers.get("access-control-allow-origin");
        logTest("5.1 CORS headers present", !!corsHeader, `CORS: ${corsHeader}`);
    }

    // Test 5.2: Health endpoint works
    {
        const res = await fetch(`${BASE_URL}/health`);
        const data = await res.json();
        logTest("5.2 Health endpoint returns ok", data.status === "ok", JSON.stringify(data));
    }

    // Test 5.3: OpenAPI spec available
    {
        const res = await fetch(`${BASE_URL}/openapi.json`);
        const data = await res.json();
        logTest("5.3 OpenAPI spec available", data.openapi === "3.0.1", `Version: ${data.openapi}`);
    }

    // Test 5.4: Rate limiting configured (check header)
    {
        const res = await fetch(`${BASE_URL}/health`);
        const rateLimitHeader = res.headers.get("ratelimit-limit") ||
            res.headers.get("x-ratelimit-limit") ||
            res.headers.get("ratelimit-remaining");
        // Rate limit headers may or may not be present, just check for presence
        logTest("5.4 Rate limiting headers present",
            rateLimitHeader !== null,
            `Rate limit header: ${rateLimitHeader || "not found (may still be configured)"}`);
    }

    // Test 5.5: Invalid JSON returns error
    {
        const res = await fetch(SSE_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "not-valid-json"
        });
        const isError = res.status >= 400 || (await res.text()).includes("error");
        logTest("5.5 Invalid JSON returns error", res.status >= 400, `Status: ${res.status}`);
    }

    // Test 5.6: Empty body returns error
    {
        const res = await fetch(SSE_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}"
        });
        const data = await res.json();
        const hasError = !!data.error || res.status >= 400;
        logTest("5.6 Empty/invalid JSON-RPC returns error", hasError, JSON.stringify(data));
    }
}

// ============================================
// SECTION 6: GRAPHQL READ-ONLY MODE TESTS
// ============================================
async function testReadOnlyMode() {
    console.log("\n📖 SECTION 6: GRAPHQL READ-ONLY MODE TESTS\n");

    // Test 6.1: Query is allowed in read-only mode
    {
        const res = await sendJsonRpc("tools/call", {
            name: "query-graphql",
            arguments: { query: "query { __typename }" }
        });
        const textContent = res.result?.content?.[0]?.text || "";
        const isAllowed = !textContent.includes("NOT allowed") && !textContent.includes("Error: Mutations");

        logTest("6.1 Query allowed in read-only mode", isAllowed,
            `Response: ${textContent.substring(0, 100)}`);
    }

    // Test 6.2: Mutation is blocked in read-only mode
    {
        const mutation = `mutation { addStar(input: { starrableId: "test" }) { clientMutationId } }`;
        const res = await sendJsonRpc("tools/call", {
            name: "query-graphql",
            arguments: { query: mutation }
        });
        const textContent = res.result?.content?.[0]?.text || "";
        const isBlocked = textContent.includes("NOT allowed") || textContent.includes("Mutations are NOT allowed");

        logTest("6.2 Mutation blocked in read-only mode (GRAPHQL_READ_ONLY=true)", isBlocked,
            `Response: ${textContent.substring(0, 150)}`);
    }

    // Test 6.3: Introspection query works
    {
        const introspectionQuery = `query { __schema { queryType { name } } }`;
        const res = await sendJsonRpc("tools/call", {
            name: "query-graphql",
            arguments: { query: introspectionQuery }
        });
        const textContent = res.result?.content?.[0]?.text || "";
        const hasSchemaData = textContent.includes("queryType") || textContent.includes("__schema") || textContent.includes("Query");

        logTest("6.3 Introspection query works", hasSchemaData || !textContent.includes("Error"),
            `Response: ${textContent.substring(0, 100)}`);
    }
}

// ============================================
// SECTION 7: JSON-RPC PROTOCOL COMPLIANCE
// ============================================
async function testJsonRpcCompliance() {
    console.log("\n📨 SECTION 7: JSON-RPC 2.0 COMPLIANCE\n");

    // Test 7.1: Response has jsonrpc: "2.0"
    {
        const res = await sendJsonRpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } });
        logTest("7.1 Response has jsonrpc: 2.0", res.jsonrpc === "2.0", `jsonrpc: ${res.jsonrpc}`);
    }

    // Test 7.2: Response has matching id
    {
        const testId = 9999;
        const response = await fetch(SSE_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: testId, method: "tools/list" })
        });
        const res = await response.json();
        logTest("7.2 Response has matching id", res.id === testId, `Expected: ${testId}, Got: ${res.id}`);
    }

    // Test 7.3: Error response has proper structure
    {
        const res = await sendJsonRpc("unknown/method");
        const hasErrorCode = typeof res.error?.code === "number";
        const hasErrorMessage = typeof res.error?.message === "string";

        logTest("7.3 Error has code and message", hasErrorCode && hasErrorMessage,
            `Error: code=${res.error?.code}, message=${res.error?.message}`);
    }
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runAllTests() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("       MCP PROTOCOL COMPREHENSIVE TEST SUITE");
    console.log("       Target: " + BASE_URL);
    console.log("═══════════════════════════════════════════════════════════");

    try {
        await testLifecycle();
        await testTools();
        await testResources();
        await testPrompts();
        await testSecurity();
        await testReadOnlyMode();
        await testJsonRpcCompliance();

        console.log("\n═══════════════════════════════════════════════════════════");
        console.log(`       TEST SUMMARY: ${results.passed} passed, ${results.failed} failed`);
        console.log("═══════════════════════════════════════════════════════════\n");

        if (results.failed > 0) {
            console.log("Failed tests:");
            results.tests.filter(t => !t.passed).forEach(t => {
                console.log(`  ❌ ${t.name}`);
                if (t.details) console.log(`     ${t.details}`);
            });
            process.exit(1);
        } else {
            console.log("🎉 All tests passed!");
            process.exit(0);
        }
    } catch (error) {
        console.error("❌ Test suite crashed:", error);
        process.exit(1);
    }
}

runAllTests();
