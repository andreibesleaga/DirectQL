// Set test environment variables before any imports
process.env.GRAPHQL_MCP_ENDPOINT = 'https://api.github.com/graphql';
process.env.GRAPHQL_API_KEY = 'test-key';
process.env.AUTH_TYPE = 'Bearer';
process.env.GRAPHQL_READ_ONLY = 'true';
process.env.PORT = '3000';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
