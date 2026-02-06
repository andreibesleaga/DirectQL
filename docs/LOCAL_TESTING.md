# Local Testing Walkthrough

Complete guide to set up and test DirectQL locally with MCP server and Ollama.

---

## Prerequisites

- Docker & Docker Compose installed
- GitHub Personal Access Token (for GitHub GraphQL API)

---

## Step 1: Configure Environment

Create/edit `.env` in the project root:
```env
GRAPHQL_MCP_ENDPOINT=https://api.github.com/graphql
GRAPHQL_API_KEY=your_github_personal_access_token
PORT=3000
AUTH_TYPE=Bearer
GRAPHQL_READ_ONLY=true
```

---

## Step 2: Start the Stack

```bash
./scripts/test-local-setup.sh
```

**Expected output:**
```
✅ GraphQL MCP is UP
✅ Open WebUI is RUNNING  
✅ E2E Simulation Completed Successfully.
🎉 Success! Local Stack is running.
```

---

## Step 3: Download Ollama Model

```bash
./scripts/pull-ollama-model.sh llama3.2:1b
```

---

## Step 4: Run MCP Protocol Tests

```bash
node graphql-mcp/test/integration/mcp_protocol.test.js
```

**Expected:** 30/30 tests pass

---

## Step 5: Configure MCP in Open WebUI

1. Open http://localhost:8080 in browser
2. Create admin account (first user)
3. Go to **Admin Panel** → **Settings** → **Connections**
4. Add MCP connection:
   - **Type**: MCP (SSE)
   - **URL**: `http://graphql-mcp:3000/sse` (internal Docker network)
   - **Headers**: None (internal network)

---

## Step 6: Test GitHub Query

In the Open WebUI chat, try these prompts:

### Example 1: Repository Info
```
What are the top 5 repositories by stars on GitHub about "machine learning"?
```

### Example 2: User Info
```
Can you query the GitHub API to find information about the user "torvalds"?
```

### Example 3: Issue Search
```
Find the latest 3 open issues in the repository facebook/react
```

### Behind the Scenes
The AI will:
1. Use `introspect-graphql-schema` tool to understand GitHub's API
2. Use `query-graphql` tool to execute the query
3. Return results in natural language

---

## Verification Commands

```bash
# Check all services are running
docker ps

# View MCP server logs
docker logs graphql-mcp

# Run all tests
node graphql-mcp/test/integration/mcp_protocol.test.js
cd graphql-mcp && npm test
cd graphql-mcp && npm run test:security
```

---

## Access Points

| Service | URL |
|---------|-----|
| Open WebUI | http://localhost:8080 |
| MCP Server | http://localhost:3000/sse |
| Health Check | http://localhost:3000/health |
| OpenAPI Spec | http://localhost:3000/openapi.json |

---

## Troubleshooting

**MCP not connecting?**
- Ensure `graphql-mcp` container is healthy: `docker ps`
- Check logs: `docker logs graphql-mcp`

**GitHub queries failing?**
- Verify `GRAPHQL_API_KEY` in `.env` has valid GitHub PAT
- Token needs `public_repo` scope minimum

**Ollama not responding?**
- Confirm model is downloaded: `docker exec ollama ollama list`
- Pull model: `./scripts/pull-ollama-model.sh`
