# DirectQL - Interactive GraphQL AI Platform

This repository contains a complete **AI agent stack** designed for local development and deployment of a interactive AI chat agent that can access GraphQL APIs and communicate with natural language to make requests and get information from graphql endpoints with particular focus of this version on **GitHub GraphQL APIs**.


- **Open WebUI, GitHub GraphQL API, FUll GraphQL MCP Server, OpenRouter**
- Use case scenario: direct user communication and/or agentic AI, on federated graphql introspective schemas endpoints (with local schema caching registration).


## Services
1. **graphql-mcp**: An MCP server that exposes GraphQL APIs as a tool for AI agents.
2. **open-webui**: The chat interface (ChatGPT clone).
3. **ollama**: (Optional) A local LLM runner.

---

### Configuration 1: The "Smart & Cheap" (Recommended)
*Uses OpenRouter (DeepSeek/Gemini/GPT) & Tools.*

## Components

1.  **DirectQL Client (Open WebUI)**
    -   The user interface for interacting with the AI.
    -   Connects to the GraphQL MCP Server via HTTP/SSE.

    **Service: open-webui**
    - `ROOT DIRECTORY`: `/open-webui`
    - Variables:
      - `OPENAI_API_BASE_URL`: `https://openrouter.ai/api/v1`
      - `OPENAI_API_KEY`: `sk-or-....` (Get from openrouter.ai)
      - `ENABLE_OPENAI_API`: `true`
      - `WEBUI_SECRET_KEY`: `(random string)`
      - `GRAPHQL_READ_ONLY`: `true`

2.  **GraphQL MCP Server** (`graphql-mcp/`)
    -   A Model Context Protocol (MCP) server that adapts GraphQL APIs for LLMs.
    -   **Features**:
        -   **Tools**: Execute queries (`query-graphql`) and introspect schemas (`introspect-graphql-schema`).
        -   **Resources**: Read schemas (`graphql://schema`, `graphql://local/...`).
        -   **Prompts**: Helper for writing queries (`write-graphql-query`).
    -   **Authentication**: Supports Bearer tokens and API Keys (x-api-key) for secure access to GraphQL endpoints (e.g., GitHub, Apollo Studio, etc).

### Configuration

  ### Environment Variables
      Create a `.env` file in the root:

      ```env
      # GraphQL MCP Server
      GRAPHQL_MCP_ENDPOINT=https://api.github.com/graphql
      GRAPHQL_API_KEY=your_github_token
      PORT=3000
      AUTH_TYPE=Bearer  # or x-api-key or none
      GRAPHQL_READ_ONLY=true # Enforce read-only queries
      ```
---

### Configuration 2: The "Fully Local"
*Uses Ollama running llama3.2:1b*

**Service: ollama**
- `ROOT DIRECTORY`: `/ollama`
- Volume mount: `/root/.ollama`

**Service: open-webui**
- Variables:
  - `OLLAMA_BASE_URL`: `http://ollama-production:11434` (Replace with actual service name)
  - `ENABLE_OPENAI_API`: `false`

---

The AI Agent can connect to the MCP Server using the following configuration:
1. Open your deployed WebUI (`https://webui-xyz.app`)
2. Go to **Admin Panel** > **Settings** > **Connections**
3. Under **MCP**, add a new connection:
   - **Type**: SSE
   - **URL**: `https://graphql-mcp-xyz.app/sse`
