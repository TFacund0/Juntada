import type { Express } from "express";
import type { Room, Group } from "@juntada/shared-types";
import { escapeHtml } from "@juntada/core-utils";

const fs = require("fs");
const path = require("path");
const { rooms, groups } = require("../state/roomStore") as { rooms: Map<string, Room>; groups: Map<string, Group> };
const { redisHealth } = require("../state/persistence") as { redisHealth: () => "disabled" | "ok" | "degraded" };
const { mountAuthRoutes } = require("../auth");

function injectOpenGraphMeta(template: string, meta: { title: string; description: string }): string {
  let html = template;
  const safeTitle = escapeHtml(meta.title);
  const safeDesc = escapeHtml(meta.description);

  html = html.replace(/<title>.*?<\/title>/, `<title>${safeTitle}</title>`);
  html = html.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${safeTitle}" />`);
  html = html.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${safeDesc}" />`);
  html = html.replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${safeTitle}" />`);
  html = html.replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${safeDesc}" />`);
  return html;
}

function resolveInviteMeta(reqPath: string): { title: string; description: string } | null {
  // 1. /join/:code
  const joinMatch = reqPath.match(/^\/join\/([A-Za-z0-9]{5})$/i);
  if (joinMatch) {
    const code = joinMatch[1].toUpperCase();
    const room = rooms.get(code);
    if (room) {
      return {
        title: "Juntada · ¡Unite a la partida!",
        description: `Sala ${room.code} · ${room.players.length} esperando para jugar`,
      };
    }
    const group = groups.get(code);
    if (group) {
      return {
        title: `Juntada · ¡Unite a ${group.name}!`,
        description: `Grupo ${group.code} · ${group.members.length} miembros`,
      };
    }
    return null;
  }

  // 2. /room/:gameId/:code
  const roomMatch = reqPath.match(/^\/room\/[^/]+\/([A-Za-z0-9]{5})$/i);
  if (roomMatch) {
    const code = roomMatch[1].toUpperCase();
    const room = rooms.get(code);
    if (room) {
      return {
        title: "Juntada · ¡Unite a la partida!",
        description: `Sala ${room.code} · ${room.players.length} esperando para jugar`,
      };
    }
    return null;
  }

  // 3. /group/:code
  const groupMatch = reqPath.match(/^\/group\/([A-Za-z0-9]{5})$/i);
  if (groupMatch) {
    const code = groupMatch[1].toUpperCase();
    const group = groups.get(code);
    if (group) {
      return {
        title: `Juntada · ¡Unite a ${group.name}!`,
        description: `Grupo ${group.code} · ${group.members.length} miembros`,
      };
    }
    return null;
  }

  return null;
}

function registerRoutes(app: Express): void {
  app.get("/health", (_req, res) => {
    const redis = redisHealth();
    // "disabled" (no REDIS_URL — everything-in-memory is the intended setup)
    // is healthy; "degraded" (REDIS_URL is set but not actually connected)
    // is the one case that should flip `ok` to false, since it means an
    // active game would silently lose its persistence on the next restart.
    res.json({ ok: redis !== "degraded", rooms: rooms.size, redis });
  });

  // Auth (register/login/logout/refresh/me/password-reset). Mounted before
  // the SPA catch-all below, same as every other real route — see
  // auth/index.ts for the composition root and auth/http/authRoutes.ts for
  // the route table.
  const apiRouter = require("express").Router();
  mountAuthRoutes(apiRouter);
  app.use("/api", apiRouter);

  // Servir el frontend buildeado
  const distDir = path.join(__dirname, "..", "..", "..", "frontend", "dist");
  const indexPath = path.join(distDir, "index.html");

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

  app.get("/{*path}", (req, res) => {
    res.setHeader("Cache-Control", "no-cache");

    const meta = resolveInviteMeta(req.path);
    if (meta && fs.existsSync(indexPath)) {
      try {
        const rawHtml = fs.readFileSync(indexPath, "utf-8");
        const renderedHtml = injectOpenGraphMeta(rawHtml, meta);
        res.type("html").send(renderedHtml);
        return;
      } catch {
        // Fall back to sendFile below if reading fails
      }
    }

    res.sendFile(indexPath);
  });
}

module.exports = { registerRoutes };
