# Proposal: OpenGraph Tags for Room and Group Invites (Item 4)

## Intent

When sharing links to join a room or a group via WhatsApp, Telegram, Discord, or social networks, scrapers and social preview bots look for OpenGraph (`og:*`) meta tags in the HTML response. Because Juntada is an SPA served by Express, `index.html` currently has no OpenGraph tags at all, producing bare or uninformative link previews.

This proposal introduces:

1. Standard fallback OpenGraph meta tags in `frontend/index.html`.
2. Dynamic OpenGraph tag injection in Express (`backend/src/http/routes.ts`) for invitation routes (`/join/:code`, `/room/:gameId/:code`, `/group/:code`). When the code matches an active room or group in memory, the server replaces the placeholder/default OG tags with room/group-specific titles and descriptions (e.g. `"¡Unite a la partida de El Impostor!"` / `"Sala ABCDE · 3 jugadores esperando"`).

## Scope

- Domain: `seo-opengraph`
- Files:
  - `frontend/index.html`
  - `backend/src/http/routes.ts`
  - `backend/test/core/ogRoutes.test.ts` (new test suite)

## Approach

- In `frontend/index.html`, add base tags:
  - `og:title` -> `"Juntada"`
  - `og:description` -> `"Juegos para jugar en grupo"`
  - `og:image` -> `/icon-512.png`
  - `og:type` -> `"website"`
- In `backend/src/http/routes.ts`:
  - When handling requests that return HTML (`/{*path}`), check if the path matches `/join/:code`, `/room/:gameId/:code`, or `/group/:code`.
  - Look up the room or group from `rooms` / `groups` stores.
  - If found:
    - For room: Title: `"Juntada · ¡Unite a ${gameName}!"`, Description: `"Sala ${room.code} · ${playerCount} jugadores esperando"`.
    - For group: Title: `"Juntada · ¡Unite al grupo ${group.name}!"`, Description: `"Código ${group.code} · ${memberCount} miembros"`.
    - Replace the `<title>` and `<meta property="og:*">` tags before sending the HTML string.
  - If not found or plain route: serve `index.html` as usual.
