
import request from 'supertest';
import { app } from '../../src/app.js';
import { jest } from '@jest/globals';
import { clearCache } from '../../src/cache.js';

describe('MCP Server Integration', () => {

    it('GET /health returns 200', async () => {
        const res = await request(app).get('/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    it('GET /openapi.json returns valid spec', async () => {
        const res = await request(app).get('/openapi.json');
        expect(res.statusCode).toBe(200);
        expect(res.body.openapi).toBeDefined();
        expect(res.body.info.title).toBe('GraphQL MCP Server');
    });

    describe('JSON-RPC Tool Execution', () => {
        const originalFetch = global.fetch;

        beforeAll(() => {
            clearCache(); // Ensure fresh start

            // Mock Schema Introspection Response
            const introspectionResult = {
                data: {
                    __schema: {
                        queryType: { name: "Query" },
                        mutationType: null,
                        subscriptionType: null,
                        types: [
                            {
                                kind: "OBJECT",
                                name: "Query",
                                fields: [
                                    {
                                        name: "hello",
                                        args: [],
                                        type: { kind: "SCALAR", name: "String" }
                                    },
                                    {
                                        name: "error",
                                        args: [],
                                        type: { kind: "SCALAR", name: "String" }
                                    }
                                ],
                                interfaces: []
                            },
                            { kind: "SCALAR", name: "String" }
                        ],
                        directives: []
                    }
                }
            };

            global.fetch = jest.fn(async (url, options) => {
                const body = JSON.parse(options.body);

                // Check if introspection (simplified check)
                if (body.query && (body.query.length > 500 || body.query.indexOf("__schema") !== -1 || body.query.indexOf("IntrospectionQuery") !== -1)) {
                    return { ok: true, json: async () => introspectionResult };
                }

                // Check for specific test queries
                if (body.query && body.query.includes("hello")) {
                    return {
                        ok: true,
                        json: async () => ({ data: { hello: "world" } })
                    };
                }

                // Simulate upstream error
                if (body.query && body.query.includes("error")) {
                    return {
                        ok: true,
                        json: async () => ({
                            errors: [{
                                message: "Upstream Error",
                                extensions: { stacktrace: "hidden" }
                            }]
                        })
                    };
                }

                return { ok: true, json: async () => ({ data: {} }) };
            });
        });

        afterAll(() => {
            global.fetch = originalFetch;
        });

        it('POST /sse tools/call query-graphql (Success)', async () => {
            const res = await request(app)
                .post('/sse')
                .send({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "tools/call",
                    params: {
                        name: "query-graphql",
                        arguments: { query: "{ hello }" }
                    }
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.result).toBeDefined();
            const content = JSON.parse(res.body.result.content[0].text);
            expect(content.hello).toBe("world");
        });

        it('POST /sse tools/call query-graphql (Schema Validation Error)', async () => {
            // Querying non-existent field 'goodbye'
            const res = await request(app)
                .post('/sse')
                .send({
                    jsonrpc: "2.0",
                    id: 2,
                    method: "tools/call",
                    params: {
                        name: "query-graphql",
                        arguments: { query: "{ goodbye }" }
                    }
                });

            expect(res.statusCode).toBe(200);
            const content = res.body.result.content[0].text;
            expect(content).toContain("Error: Schema Validation Error");
            expect(content).toContain("How to fix");
        });

        it('POST /sse tools/call query-graphql (Sanitized Error)', async () => {
            // Trigger upstream error mock
            const res = await request(app)
                .post('/sse')
                .send({
                    jsonrpc: "2.0",
                    id: 3,
                    method: "tools/call",
                    params: {
                        name: "query-graphql",
                        arguments: { query: "query { error }" } // Just needs to contain 'error' keyword for mock
                    }
                });

            expect(res.statusCode).toBe(200);
            const content = JSON.parse(res.body.result.content[0].text);
            expect(content.errors).toBeDefined();
            expect(content.errors[0].message).toBe("Upstream Error");
            // Verify sanitation
            expect(content.errors[0].extensions).toBeDefined();
            expect(content.errors[0].extensions.stacktrace).toBeUndefined();
        });
    });
});
