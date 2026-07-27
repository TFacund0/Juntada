// ─── HTTP Routes ─────────────────────────────────────────────────────────────
import type { Express } from "express";
import type { Room } from "@juntada/shared-types";

const path = require("path");
const { rooms } = require("../state/roomStore") as { rooms: Map<string, Room> };

function registerRoutes(app: Express): void {
  app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));

  // Servir el frontend buildeado
  const distDir = path.join(__dirname, "..", "..", "..", "frontend", "dist");
  app.use(
    require("express").static(distDir, {
      // Without this, express.static sends no explicit Cache-Control at all
      // — browsers (and some CDNs/proxies in front of Render) then fall back
      // to heuristic caching and can keep serving a deploy-old index.html
      // for a while after a new version ships. Vite's JS/CSS bundles are
      // content-hashed (a new build never reuses an old filename), so those
      // ARE safe to cache aggressively forever — it's specifically
      // index.html (unhashed, and the thing that points at whichever bundle
      // hashes are current) that must always be revalidated.
      setHeaders(res: import("http").ServerResponse, filePath: string) {
        if (path.basename(filePath) === "index.html") {
          res.setHeader("Cache-Control", "no-cache");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
  app.get("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(distDir, "index.html"));
  });
}

module.exports = { registerRoutes };
