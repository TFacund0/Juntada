# Delta Spec: OpenGraph Tags for Room and Group Invites

Change: `sdd/room-og-tags`
Domain: `seo-opengraph`

## Requirements

### R1: Default OpenGraph tags in static HTML

`frontend/index.html` MUST include standard OpenGraph and Twitter card meta tags:

- `og:site_name`: "Juntada"
- `og:type`: "website"
- `og:title`: "Juntada"
- `og:description`: "Juegos para jugar en grupo"
- `og:image`: "/icon-512.png"
- `twitter:card`: "summary"

### R2: Dynamic injection for active Room invites

When an HTTP request is made to `/join/:code` (or `/room/:gameId/:code`) and `:code` matches an active room in memory:

- Server MUST inject customized OpenGraph tags into the HTML response:
  - `<title>` and `og:title`: `"Juntada · ¡Unite a la partida!"` (or with game name if known: `"Juntada · ¡Unite a ${gameName}!"`)
  - `og:description`: `"Sala ${room.code} · ${playerCount} esperando para jugar"`
  - `og:url`: the requested canonical URL.

### R3: Dynamic injection for active Group invites

When an HTTP request is made to `/join/:code` (with `kind=group` or matching a group) or `/group/:code`, and `:code` matches an active group in memory:

- Server MUST inject customized OpenGraph tags into the HTML response:
  - `<title>` and `og:title`: `"Juntada · ¡Unite a ${group.name}!"`
  - `og:description`: `"Grupo ${group.code} · ${memberCount} miembros"`
  - `og:url`: the requested canonical URL.

### R4: Graceful fallback on inactive or non-matching codes

If `:code` does not match any active room or group in memory:

- Server MUST serve the default `index.html` with default meta tags without errors or delays.

## Scenarios

### Scenario 1: Default home route

- Request `GET /`
- Response contains default `og:title` "Juntada" and `og:description` "Juegos para jugar en grupo".

### Scenario 2: Active room join link

- GIVEN an active room with code "XYZ12", gameType "impostor" and 3 players
- WHEN bot requests `GET /join/XYZ12`
- THEN response contains `<meta property="og:title" content="Juntada · ¡Unite a la partida!"/>` and `og:description` containing "XYZ12" and "3".

### Scenario 3: Active group join link

- GIVEN an active group with code "GRP99", name "Los Pibes" and 4 members
- WHEN bot requests `GET /join/GRP99` or `GET /group/GRP99`
- THEN response contains `<meta property="og:title" content="Juntada · ¡Unite a Los Pibes!"/>` and `og:description` containing "GRP99" and "4".
