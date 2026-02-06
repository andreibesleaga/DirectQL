
import request from 'supertest';
import { app } from '../../src/app.js';
import { jest } from '@jest/globals';

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

    // Note: More complex MCP protocol tests would require a mock transport client 
    // or mocking the internal McpServer.connect
});
