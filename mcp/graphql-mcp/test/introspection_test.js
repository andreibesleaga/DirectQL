
// Introspection test
import { getIntrospectionQuery } from "graphql";
// import fetch from "node-fetch"; // Native fetch in Node 18+
import dotenv from "dotenv";
dotenv.config(); // Loads .env from CWD (root)

async function run() {
    const query = getIntrospectionQuery();
    const endpoint = process.env.GRAPHQL_MCP_ENDPOINT;
    const apiKey = process.env.GRAPHQL_API_KEY;

    if (!endpoint || !apiKey) {
        console.error("Missing ENV vars");
        process.exit(1);
    }

    console.log("Fetching schema from:", endpoint);

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + apiKey,
                "User-Agent": "Test/1.0"
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            console.error("HTTP Error:", response.status, await response.text());
            return;
        }

        const data = await response.json();
        const jsonString = JSON.stringify(data);
        console.log("Schema Size (Chars):", jsonString.length);
        console.log("Schema Size (MB):", jsonString.length / 1024 / 1024);
    } catch (err) {
        console.error("Error:", err);
    }
}

run();
