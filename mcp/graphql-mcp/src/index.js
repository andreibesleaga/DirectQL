
import { app } from "./app.js";
import { config } from "./config.js";
import logger from "./logger.js";

app.listen(config.PORT, () => {
    logger.info(`GraphQL MCP Server running on port ${config.PORT}`);
});
