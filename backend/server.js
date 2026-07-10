const { createApp } = require("./src/app");

const server = createApp();
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🕵️  Impostor server on :${PORT}`));
