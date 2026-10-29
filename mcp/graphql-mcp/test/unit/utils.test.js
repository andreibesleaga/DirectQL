import { maskHeaders, summarize } from '../../src/utils.js';

describe('maskHeaders', () => {
    test('masks authorization, x-api-key and cookie, whatever their length', () => {
        const masked = maskHeaders({
            authorization: 'Bearer short',
            'x-api-key': 'k',
            Cookie: 'sid=1',
            host: 'localhost:3000',
        });
        expect(masked.authorization).toBe('[REDACTED]');
        expect(masked['x-api-key']).toBe('[REDACTED]');
        expect(masked.Cookie).toBe('[REDACTED]');
        expect(masked.host).toBe('localhost:3000');
    });

    test('does not modify the input and tolerates missing headers', () => {
        const input = { authorization: 'Bearer abc' };
        maskHeaders(input);
        expect(input.authorization).toBe('Bearer abc');
        expect(maskHeaders(undefined)).toEqual({});
    });

    test('the logged summary never contains the credential', () => {
        const logged = JSON.stringify(summarize(maskHeaders({ authorization: 'Bearer ghp_secret' })));
        expect(logged).not.toContain('ghp_secret');
    });
});
