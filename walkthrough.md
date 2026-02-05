# DirectQL/GraphQL-MCP Local Verification Walkthrough

## Prerequisites
- **GraphQL MCP Server**: Running on `http://localhost:3000` (Verified).
- **Ollama**: Running on `http://localhost:11434` (Assumed managed by user).
- **Open WebUI**: Installed/Running locally.

## Step 1: Start Open WebUI 
If you haven't started Open WebUI yet, run it using your preferred method.
(./test-local-setup.sh will start it for you)
*   **Docker**:
    ```bash
    docker run -d -p 8080:8080 --add-host=host.docker.internal:host-gateway \
      -v open-webui:/app/backend/data --name open-webui \
      --restart always ghcr.io/open-webui/open-webui:main
    ```
*   **Python/Pip**: `open-webui serve`

### 3. Open WebUI Configuration

1.  **Add MCP Server**:
    *   Go to **Admin Panel > Settings > Connections > MCP**.
    *   Click **+ Add**.
    *   **Type**: `SSE` (or `HTTP/SSE`).
    *   **URL**:
        *   **Local/Docker Compose**: `http://graphql-mcp:3000/sse` (CRITICAL: Do NOT use localhost, use the Docker service name!)
        *   **Deployed (Railway)**: `https://your-app.up.railway.app/sse`
    *   **Authentication**: Set to `None`.
    *   **Click Verify/Save**.

2.  **Troubleshooting**:
    *   **"Failed to connect"**:
        *   Ensure `Auth Type` is `None` (not `Bearer` with empty token).
        *   Check if `Function Name Filter List` is empty (try adding a comma `,` if prompted).
    *   **Logs**: Check the terminal running `node index.js` to see if requests are arriving.

## Step 2: Configure GraphQL MCP Connection
1.  Open your browser to `http://localhost:8080`.
2.  Log in (or create the admin account if fresh install).
3.  Click on **User Profile** (bottom left) -> **Admin Settings**.
4.  Navigate to **External Tools** (or **Connections** in newer versions).
5.  Look for an **MCP** section.
6.  Click **+ Add Server**.
    - **Type**: `MCP (Access via HTTP/SSE)` (Select the SSE/HTTP option).
    - **URL**: 
        - If Open WebUI is in **Docker**: `http://host.docker.internal:3000/sse`
        - If Open WebUI is **Native**: `http://localhost:3000/sse`
    - **Name**: `GraphQL MCP`
    7.  Click **Save/Connect**. You should see a green "Connected" status or tool list (e.g., `query-graphql`).

## Step 3: Test End-to-End
1.  Go to **New Chat**.
2.  Select a model (e.g., `llama3` from Ollama).
3.  Ensure the **GraphQL MCP** tool is enabled (look for a tool toggle or mention it in prompt).
4.  **Test 1: Query Execution (Tool)**
    - Prompt: "Find the description of the repository 'DirectQL' using the GraphQL API."
5.  **Test 2: Schema Inspection (Resource)**
    - Prompt: "Read the `graphql://schema` resource and tell me what types are available."
    - *Note: Open WebUI typically shows resources in the context menu ('#') or allows direct reference if the model supports it.*
3.  **Test 3: Query Generation (Prompt)**
    - Prompt: Use the `write-graphql-query` prompt (if UI supports prompt templates) to generate a query for "My starred repositories".
7.  **Test 4: Local Schema Fallback (Resource)**
    - Prompt: "Read the `graphql://local/example.graphql` resource."
    - Expected: The model should see the content of the example schema file.

### 4. Full Local Stack (Docker Compose)
To run everything locally (GraphQL MCP + Open WebUI + Ollama) in one command:
```bash
./test-local-setup.sh
```
This script:
1.  Cleans up old containers.
2.  Builds and Starts the stack (detached).
3.  Waits for health checks.
4.  Runs the E2E Simulation Test against the local instance.

**Access Points:**
*   **Open WebUI**: [http://localhost:8080](http://localhost:8080)
*   **GraphQL MCP**: [http://localhost:3000/sse](http://localhost:3000/sse) (Internal: `http://graphql-mcp:3000/sse`)
*   **Ollama**: [http://localhost:11434](http://localhost:11434)

### 5. Managing Models in Ollama
Since Ollama runs in Docker, you execute commands inside the container:
```bash
# 1. Enter the container
docker exec -it ollama /bin/bash

# 2. Pull a model (e.g., Llama 3)
ollama pull llama3

# 3. List available models
ollama list
```
*Note: Models are persisted in the `ollama` Docker volume.*



### 6. Monitoring the Stack
To check service status, resource usage, and view recent errors or live logs:
```bash
./monitor-stack.sh
```
This interactive script dashboard provides a real-time health overview of your local stack.

## Step 5: E2E Testing on Deployment

To verify your deployed server (e.g., Railway) is working correctly without manually clicking in the UI, you can run the simulation script against the remote URL.

1.  **Get your Public URL** from Railway (e.g., `https://directql-production.up.railway.app`).
2.  **Run the Test Script**:
    ```bash
    # Ensure you are in the project root
    export MCP_SERVER_URL="https://directql-production.up.railway.app/sse"
    
    # If your local .env has the API key, it will be used for the query test
    node graphql-mcp/test/e2e_simulation.js
    ```
3.  **Expected Output**:
    - "Health & OpenAPI OK"
    - "Initialize OK"
    - "Notification OK"
    - "Tools OK"
    - "Resources OK"
    - "E2E Simulation Completed Successfully"

## Troubleshooting
- **Connection Refused**: Ensure `graphql-mcp` is running (`ps aux | grep node`) and port 3000 is open.
- **Docker Networking**: If `host.docker.internal` fails, try your local IP address (e.g., `192.168.1.x`).
