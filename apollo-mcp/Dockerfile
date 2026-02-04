# Service 1: Apollo MCP Server
FROM node:18-alpine
WORKDIR /app

# Install dependencies first (caching)
COPY package.json ./
RUN npm install

# Copy source code
COPY . .

# Railway sets PORT env var automatically
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
