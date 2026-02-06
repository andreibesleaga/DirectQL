# DirectQL Infrastructure & Deployment

This directory contains resources for deploying the DirectQL stack to various environments.

## 1. Kubernetes
**Path**: `infra/kubernetes/manifests.yaml`

A single-file manifest defining a Pod with 3 containers (Sidecar pattern):
- **Ollama**: Local LLM runner.
- **GraphQL-MCP**: The MCP server.
- **Open-WebUI**: The user interface.

**Deploy**:
```bash
kubectl apply -f infra/kubernetes/manifests.yaml
```

**Notes**:
- Includes `PersistentVolumeClaims` for Ollama models and WebUI data.
- Ensure you create the secret for the GitHub API key:
```bash
kubectl create secret generic directql-secrets --from-literal=graphql-api-key=YOUR_TOKEN
```

## 2. AWS (Terraform)
**Path**: `infra/terraform/aws/main.tf`

Provisions a VPC, ECS Cluster, and Fargate Service to run the stack serverlessly.

**Deploy**:
```bash
cd infra/terraform/aws
terraform init
terraform apply
```

**Prerequisites**:
- AWS CLI configured.
- Docker images pushed to ECR (references `my-repo/graphql-mcp` - update this in `main.tf`).

## 3. Open WebUI Configuration

**Important**: Open WebUI currently **does not** support automatically registering arbitrary MCP servers via environment variables (only standard Ollama/OpenAI peers).

### Manual Setup Required
1.  Deploy the stack.
2.  Log in to Open WebUI (create first admin account).
3.  Navigate to **Admin Panel > Settings > Connections**.
4.  Adding the MCP Server:
    -   **Type**: MCP (SSE)
    -   **URL**: `http://localhost:3000/sse` (or the internal service URL).
    -   **Key**: If `AUTH_TYPE` is set, provide the Bearer token.
5.  Save the connection.

### Troubleshooting
-   If Open WebUI cannot reach `localhost:3000`, ensure they are in the same Pod (K8s) or Network (Docker).
-   For K8s sidecars, `localhost` works.
-   For Docker Compose, use the service name `http://graphql-mcp:3000/sse`.

## 4. Railway (PaaS)
**Path**: `infra/railway/railway.json`

This file defines the services for a Railway One-Click deploy or monorepo setup.

**Configuration**:
- **GraphQL MCP**: Deployed from `graphql-mcp/` directory using the Dockerfile.
  - Variables: `GRAPHQL_MCP_ENDPOINT`, `GRAPHQL_API_KEY`, etc.
- **DirectQL (Open WebUI)**: Deployed from `open-webui/` directory.
  - Variables: `OPENAI_API_BASE_URL` (defaults to OpenRouter), `OPENAI_API_KEY`.

**Deploy**:
1.  Push this repo to GitHub.
2.  Login to [Railway](https://railway.app).
3.  "New Project" > "Deploy from GitHub repo".
4.  Railway should detect `railway.json` and prompt for the defined variables.

**Networking**:
Both services will be deployed. Ensure Open WebUI is configured to reach the GraphQL MCP service. In Railway, you typically use the private networking DNS or the public URL if exposed.
