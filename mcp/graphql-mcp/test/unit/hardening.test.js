import { validateQuery, sanitizeResponse, assertIntrospectionAllowed } from '../../src/validator.js';
import { config } from '../../src/config.js';

describe('Config defaults (additive, behavior-preserving)', () => {
    test('GRAPHQL_MAX_DEPTH defaults to 15 (the previously hardcoded limit)', () => {
        expect(config.GRAPHQL_MAX_DEPTH).toBe(15);
    });

    test('GRAPHQL_COMPLEXITY_LIMIT defaults to 0 (disabled)', () => {
        expect(config.GRAPHQL_COMPLEXITY_LIMIT).toBe(0);
    });

    test('INTROSPECTION_ALLOWLIST defaults to an empty array (allow all)', () => {
        expect(Array.isArray(config.INTROSPECTION_ALLOWLIST)).toBe(true);
        expect(config.INTROSPECTION_ALLOWLIST).toHaveLength(0);
    });

    test('METRICS_ENABLED defaults to true', () => {
        expect(config.METRICS_ENABLED).toBe(true);
    });
});

describe('Configurable depth limit', () => {
    test('uses config.GRAPHQL_MAX_DEPTH instead of a hardcoded value', () => {
        const original = config.GRAPHQL_MAX_DEPTH;
        config.GRAPHQL_MAX_DEPTH = 2;
        try {
            // depth 3 query: a { b { c } }
            const query = 'query { a { b { c } } }';
            expect(() => validateQuery(query)).toThrow('exceeds maximum allowed depth of 2');
        } finally {
            config.GRAPHQL_MAX_DEPTH = original;
        }
    });

    test('shallow query passes under the configured depth', () => {
        const original = config.GRAPHQL_MAX_DEPTH;
        config.GRAPHQL_MAX_DEPTH = 5;
        try {
            expect(() => validateQuery('query { a { b } }')).not.toThrow();
        } finally {
            config.GRAPHQL_MAX_DEPTH = original;
        }
    });

    test('counts nested depth inside fragment spreads', () => {
        const original = config.GRAPHQL_MAX_DEPTH;
        config.GRAPHQL_MAX_DEPTH = 2;
        try {
            const query = `
                query {
                    a {
                        ...DeepFields
                    }
                }
                fragment DeepFields on Type {
                    b {
                        c
                    }
                }
            `;
            expect(() => validateQuery(query)).toThrow('exceeds maximum allowed depth of 2');
        } finally {
            config.GRAPHQL_MAX_DEPTH = original;
        }
    });
});

describe('Query complexity limit (opt-in)', () => {
    test('is NOT enforced when limit is 0 (default/disabled)', () => {
        const original = config.GRAPHQL_COMPLEXITY_LIMIT;
        config.GRAPHQL_COMPLEXITY_LIMIT = 0;
        try {
            const query = 'query { a b c d e f g h }';
            expect(() => validateQuery(query)).not.toThrow();
        } finally {
            config.GRAPHQL_COMPLEXITY_LIMIT = original;
        }
    });

    test('throws when field count exceeds the configured limit', () => {
        const original = config.GRAPHQL_COMPLEXITY_LIMIT;
        config.GRAPHQL_COMPLEXITY_LIMIT = 3;
        try {
            const query = 'query { a b c d e }'; // 5 fields > 3
            expect(() => validateQuery(query)).toThrow('exceeds maximum allowed complexity of 3');
        } finally {
            config.GRAPHQL_COMPLEXITY_LIMIT = original;
        }
    });

    test('passes when field count is within the configured limit', () => {
        const original = config.GRAPHQL_COMPLEXITY_LIMIT;
        config.GRAPHQL_COMPLEXITY_LIMIT = 10;
        try {
            expect(() => validateQuery('query { a b }')).not.toThrow();
        } finally {
            config.GRAPHQL_COMPLEXITY_LIMIT = original;
        }
    });
});

describe('Introspection allowlist', () => {
    test('is a no-op when the allowlist is empty (previous behavior)', () => {
        const original = config.INTROSPECTION_ALLOWLIST;
        config.INTROSPECTION_ALLOWLIST = [];
        try {
            expect(() => assertIntrospectionAllowed('https://any.example/graphql')).not.toThrow();
        } finally {
            config.INTROSPECTION_ALLOWLIST = original;
        }
    });

    test('permits an allowlisted endpoint', () => {
        const original = config.INTROSPECTION_ALLOWLIST;
        config.INTROSPECTION_ALLOWLIST = ['https://api.github.com/graphql'];
        try {
            expect(() => assertIntrospectionAllowed('https://api.github.com/graphql')).not.toThrow();
        } finally {
            config.INTROSPECTION_ALLOWLIST = original;
        }
    });

    test('rejects an endpoint not in a non-empty allowlist', () => {
        const original = config.INTROSPECTION_ALLOWLIST;
        config.INTROSPECTION_ALLOWLIST = ['https://api.github.com/graphql'];
        try {
            expect(() => assertIntrospectionAllowed('https://evil.example/graphql'))
                .toThrow('not in the introspection allowlist');
        } finally {
            config.INTROSPECTION_ALLOWLIST = original;
        }
    });

    test('defaults to the configured endpoint when called with no argument', () => {
        const original = config.INTROSPECTION_ALLOWLIST;
        config.INTROSPECTION_ALLOWLIST = [config.GRAPHQL_MCP_ENDPOINT];
        try {
            expect(() => assertIntrospectionAllowed()).not.toThrow();
        } finally {
            config.INTROSPECTION_ALLOWLIST = original;
        }
    });
});

describe('sanitizeResponse robustness (null error items)', () => {
    test('does not throw when an error item is null', () => {
        const data = { errors: [null, { message: 'ok' }] };
        expect(() => sanitizeResponse(data)).not.toThrow();
    });

    test('drops null/non-object error items and keeps valid ones', () => {
        const data = { errors: [null, { message: 'real error' }, 'string-item', undefined] };
        const result = sanitizeResponse(data);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toBe('real error');
    });

    test('still strips stacktrace/exception from valid errors', () => {
        const data = {
            errors: [null, { message: 'x', extensions: { stacktrace: 'leak', exception: 'leak', code: 'OK' } }]
        };
        const result = sanitizeResponse(data);
        expect(result.errors[0].extensions.stacktrace).toBeUndefined();
        expect(result.errors[0].extensions.exception).toBeUndefined();
        expect(result.errors[0].extensions.code).toBe('OK');
    });
});
