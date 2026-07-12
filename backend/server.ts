import { env } from "./src/env";

const { createApp } = require("./src/app");

const server = createApp();
server.listen(env.PORT, () => console.log(`🕵️  Impostor server on :${env.PORT}`));
