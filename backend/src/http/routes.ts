// ─── HTTP Routes ─────────────────────────────────────────────────────────────
import type { Express } from "express";
import type { Room } from "@juntada/shared-types";

const path = require("path");
const { rooms } = require("../state/roomStore") as { rooms: Map<string, Room> };

function registerRoutes(app: Express): void {
  app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));

  // Servir el frontend buildeado
  const distDir = path.join(__dirname, "..", "..", "..", "frontend", "dist");
  app.use(require("express").static(distDir));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

module.exports = { registerRoutes };
