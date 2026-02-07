This directory is used to provide fallback or cached GraphQL schema files to the GraphQL MCP Server.

## How it works
1.  Place your `.graphql` or `.gql` files in this directory.
2.  The MCP Server scans this directory when a connection is established.
3.  Each file is exposed as an MCP Resource with the URI: `graphql://local/<filename>`.

## Usage
-   **Fallback**: If the live introspection fails (e.g. network issues), you can ask the LLM to "Read the local schema named <filename>".
-   **Context**: You can provide specific sub-schemas or historical versions here.

## Example
If you include `myschema.graphql`, the LLM can read it via `graphql://local/myschema.graphql`.

Example schema included: `github.graphql` (GitHub GraphQL API v5)
