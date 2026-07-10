// ─── HTTP Routes ─────────────────────────────────────────────────────────────
const path = require("path");
const { rooms } = require("../state/roomStore");

function registerRoutes(app) {
  app.get("/health", (_, res) => res.json({ ok: true, rooms: rooms.size }));

  // Servir el frontend buildeado
  const distDir = path.join(__dirname, "..", "..", "..", "frontend", "dist");
  app.use(require("express").static(distDir));
  app.get("/{*path}", (_, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

module.exports = { registerRoutes };
