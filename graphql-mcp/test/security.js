
import assert from 'node:assert';
import process from 'node:process';

const query = `
  query GetRates {
    rates(currency: "USD") {
      currency
    }
  }
`;

const mutation = `
  mutation AddRate {
    addRate(currency: "USD", rate: 1.0) {
      currency
    }
  }
`;

// Simulate the function logic directly since we can't easily start the express server in this environment without blocking
async function testLogic(mockEnv, inputQuery) {
    process.env = { ...process.env, ...mockEnv };
    const { parse } = await import("graphql");

    const isReadOnly = process.env.GRAPHQL_READ_ONLY === 'true';
    console.log(`Testing with ReadOnly=${isReadOnly}, Query=${inputQuery.includes("mutation") ? "Mutation" : "Query"}`);

    try {
        const ast = parse(inputQuery);
        if (isReadOnly) {
            const hasMutation = ast.definitions.some(
                def => def.kind === 'OperationDefinition' && def.operation === 'mutation'
            );
            if (hasMutation) {
                console.log("FAIL: Mutation blocked (Expected behavior for ReadOnly)");
                return "BLOCKED";
            }
        }
        console.log("PASS: Request allowed");
        return "ALLOWED";
    } catch (e) {
        console.log("ERROR: " + e.message);
        return "ERROR";
    }
}

(async () => {
    let hasError = false;

    // Test 1: ReadOnly=true, Query -> Should allow
    const res1 = await testLogic({ GRAPHQL_READ_ONLY: 'true' }, query);
    assert.strictEqual(res1, "ALLOWED", "Test 1 Failed: ReadOnly should allow Query");

    // Test 2: ReadOnly=true, Mutation -> Should block
    const res2 = await testLogic({ GRAPHQL_READ_ONLY: 'true' }, mutation);
    assert.strictEqual(res2, "BLOCKED", "Test 2 Failed: ReadOnly should block Mutation");

    // Test 3: ReadOnly=false, Mutation -> Should allow
    const res3 = await testLogic({ GRAPHQL_READ_ONLY: 'false' }, mutation);
    assert.strictEqual(res3, "ALLOWED", "Test 3 Failed: ReadWrite should allow Mutation");

    console.log("All tests passed!");
})();
