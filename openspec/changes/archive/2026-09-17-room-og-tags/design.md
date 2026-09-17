# Technical Design: OpenGraph Tags for Room and Group Invites

Change: `sdd/room-og-tags`
Domain: `seo-opengraph`

## Architectural Context

`index.html` is the single entry point for all frontend routes. It is served statically by Express (`backend/src/http/routes.ts`) with `Cache-Control: no-cache` on HTML responses.

Social scrapers (WhatsApp, Telegram, Twitter/X, Discord, Facebook) do not evaluate client-side JavaScript; they parse the raw HTML returned from the initial HTTP GET request.

## Design Details

### 1. `frontend/index.html`

Add base OpenGraph & Twitter tags into `<head>`:

```html
<meta property="og:site_name" content="Juntada" />
<meta property="og:type" content="website" />
<meta property="og:title" content="Juntada" />
<meta property="og:description" content="Juegos para jugar en grupo" />
<meta property="og:image" content="/icon-512.png" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="Juntada" />
<meta name="twitter:description" content="Juegos para jugar en grupo" />
<meta name="twitter:image" content="/icon-512.png" />
```

### 2. `backend/src/http/routes.ts`

Extract an HTML injection helper:

```ts
function renderHtmlWithMeta(template: string, meta: { title: string; description: string; url?: string }): string {
  let html = template;
  html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`);
  html = html.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${escapeHtml(meta.title)}" />`);
  html = html.replace(
    /<meta property="og:description" content=".*?" \/>/,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
  );
  html = html.replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`);
  html = html.replace(
    /<meta name="twitter:description" content=".*?" \/>/,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
  );
  return html;
}
```

In the wildcard route `app.get("/{*path}", ...)`:

- Read the cached or disk `index.html` template.
- Check req.path regex:
  - `^/join/([A-Za-z0-9]{5})$`: check `rooms.get(code)` or `groups.get(code)`.
  - `^/room/[^/]+/([A-Za-z0-9]{5})$`: check `rooms.get(code)`.
  - `^/group/([A-Za-z0-9]{5})$`: check `groups.get(code)`.
- If a match is found in memory:
  - For a room:
    - title: `Juntada · ¡Unite a la partida!`
    - description: `Sala ${room.code} · ${room.players.length} esperando para jugar`
  - For a group:
    - title: `Juntada · ¡Unite a ${group.name}!`
    - description: `Grupo ${group.code} · ${group.members.length} miembros`
  - Render transformed HTML and respond with `res.type("html").send(renderedHtml)`.
- Otherwise:
  - Respond with default template.

### 3. Tests (`backend/test/core/ogRoutes.test.ts`)

- Test standard `GET /` returns default tags.
- Test `GET /join/:code` with active room returns personalized room tags.
- Test `GET /join/:code` with active group returns personalized group tags.
- Test `GET /room/:gameId/:code` with active room returns personalized room tags.
- Test `GET /group/:code` with active group returns personalized group tags.
- Test unknown code returns default tags.
