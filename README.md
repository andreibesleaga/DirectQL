# DirectQL - Interactive GraphQL AI Platform

This repository contains a complete **AI agent stack** designed for local development and deployment of a interactive AI chat agent that can access GraphQL APIs and communicate with natural language to make requests and get information from graphql endpoints with particular focus of this version on **GitHub GraphQL APIs**.

(Use case scenario: direct user communication and/or agentic AI, on federated introspective graphql schemas endpoints, with less effort/resources than REST APIs).

Online deployed version: https://directql.up.railway.app (**Open WebUI, GitHub GraphQL API, Apollo Tools MCP Server, OpenRouter**).

## Services
1. **apollo-mcp**: A server that exposes your GraphQL API as a tool for AI agents.
2. **open-webui**: The chat interface (ChatGPT clone).
3. **ollama**: (Optional) A local LLM runner.

---

### Configuration 1: The "Smart & Cheap" (Recommended)
*Uses OpenRouter (DeepSeek/Gemini/GPT) + Apollo Tools.*

**Service: open-webui**
- `ROOT DIRECTORY`: `/open-webui`
- Variables:
  - `OPENAI_API_BASE_URL`: `https://openrouter.ai/api/v1`
  - `OPENAI_API_KEY`: `sk-or-....` (Get from openrouter.ai)
  - `ENABLE_OPENAI_API`: `true`
  - `WEBUI_SECRET_KEY`: `(random string)`
  - `GRAPHQL_READ_ONLY`: `true`

**Service: apollo-mcp**
- `ROOT DIRECTORY`: `/apollo-mcp`
- Variables:
  - `APOLLO_MCP_ENDPOINT`: `https://your-api.com/graphql`
  - `APOLLO_KEY`: `(Optional) Key`

### Configuration GitHub API
*Connect the agent to your GitHub repositories.*
- `APOLLO_MCP_ENDPOINT`: `https://api.github.com/graphql`
- `APOLLO_KEY`: `ghp_...` (Your Personal Access Token)
- `GRAPHQL_READ_ONLY`: `true` (Recommended)

---

### Configuration 2: The "Fully Local"
*Uses Ollama running llama3.2:1b*

**Service: ollama**
- `ROOT DIRECTORY`: `/ollama`
- **Volume**: Mount `/root/.ollama` (Important!)

**Service: open-webui**
- Variables:
  - `OLLAMA_BASE_URL`: `http://ollama-production:11434` (Replace with actual service name)
  - `ENABLE_OPENAI_API`: `false`

---

The AI Agent can connect to Apollo MCP using the following configuration:
1. Open your deployed WebUI (`https://webui-xxx.app`)
2. Go to **Admin Panel** > **Settings** > **Connections**
3. Under **MCP**, add a new connection:
   - **Type**: SSE
   - **URL**: `https://apollo-mcp-xxx.app/sse`
