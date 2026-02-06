
export default {
    transform: {},
    testEnvironment: 'node',
    setupFilesAfterEnv: ['./test/setup.js'],
    testMatch: ['**/test/integration/**/*.test.js', '**/test/unit/**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/', '/test/e2e/']
};
