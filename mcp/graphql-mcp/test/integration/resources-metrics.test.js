import request from 'supertest';
import { app } from '../../src/app.js';

describe('GET /metrics (Prometheus)', () => {
    it('returns prometheus text including schema-cache metric names', async () => {
        const res = await request(app).get('/metrics');
        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('directql_schema_cache_hits_total');
        expect(res.text).toContain('directql_schema_cache_misses_total');
        expect(res.text).toContain('directql_schema_cache_keys');
    });
});

describe('Local schema resources (graphql://local/<file>)', () => {
    it('resources/list includes the bundled local schema', async () => {
        const res = await request(app)
            .post('/sse')
            .send({ jsonrpc: '2.0', id: 1, method: 'resources/list' });

        expect(res.statusCode).toBe(200);
        const uris = res.body.result.resources.map(r => r.uri);
        expect(uris).toContain('graphql://schema');
        expect(uris).toContain('graphql://local/schema.docs.graphql');
    });

    it('resources/read returns the contents of a local schema file', async () => {
        const res = await request(app)
            .post('/sse')
            .send({
                jsonrpc: '2.0',
                id: 2,
                method: 'resources/read',
                params: { uri: 'graphql://local/schema.docs.graphql' }
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.result.contents[0].text.length).toBeGreaterThan(0);
        expect(res.body.result.contents[0].uri).toBe('graphql://local/schema.docs.graphql');
    });

    it('resources/read rejects a path-traversal attempt safely', async () => {
        const res = await request(app)
            .post('/sse')
            .send({
                jsonrpc: '2.0',
                id: 3,
                method: 'resources/read',
                params: { uri: 'graphql://local/../../../etc/passwd' }
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.error).toBeDefined();
        expect(res.body.result).toBeUndefined();
    });

    it('resources/read still rejects truly unknown resources', async () => {
        const res = await request(app)
            .post('/sse')
            .send({
                jsonrpc: '2.0',
                id: 4,
                method: 'resources/read',
                params: { uri: 'unknown://thing' }
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBe(-32602);
    });
});
