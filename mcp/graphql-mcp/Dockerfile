# Service 1: GraphQL MCP Server
FROM node:18-alpine
WORKDIR /app

# Install dependencies first (caching)
COPY mcp/graphql-mcp/package*.json ./
RUN npm ci --only=production

# Copy source code
COPY mcp/graphql-mcp/ .

# Railway sets PORT env var automatically
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
