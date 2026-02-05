# Service 1: GraphQL MCP Server
FROM node:18-alpine
WORKDIR /app

# Install dependencies first (caching)
COPY graphql-mcp/package.json ./
RUN npm install

# Copy source code
COPY graphql-mcp/ .

# Railway sets PORT env var automatically
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
