import { env } from "./src/env";
import { logger } from "./src/logger";

const { createApp } = require("./src/app");

const server = createApp();
server.listen(env.PORT, () => logger.info({ port: env.PORT, env: env.NODE_ENV }, "server listening"));
