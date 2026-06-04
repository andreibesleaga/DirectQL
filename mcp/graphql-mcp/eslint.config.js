import js from '@eslint/js';

// Lenient, report-only lint floor for the graphql-mcp service (ESM/Node).
// CI runs this non-gating; tighten rules over time.
export default [
    js.configs.recommended,
    {
        files: ['src/**/*.js', 'test/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                process: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                URL: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
            'no-empty': ['warn', { allowEmptyCatch: true }]
        }
    },
    {
        // Test files use Jest globals.
        files: ['test/**/*.js'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                jest: 'readonly',
                global: 'readonly'
            }
        }
    }
];
