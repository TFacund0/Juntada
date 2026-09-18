# Tasks: OpenGraph Tags for Room and Group Invites

Change: `sdd/room-og-tags`

## Task List

- [x] **T1: Add base OpenGraph & Twitter tags to `frontend/index.html`**
  - Add `og:site_name`, `og:type`, `og:title`, `og:description`, `og:image`.
  - Add `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`.

- [x] **T2: Implement automated tests in `backend/test/core/ogRoutes.test.ts`**
  - Create test verifying default tags on `/`.
  - Create test verifying dynamic tags on `/join/:code` for active room.
  - Create test verifying dynamic tags on `/join/:code` for active group.
  - Create test verifying fallback on non-existent room/group code.

- [x] **T3: Implement dynamic OpenGraph tag injection in `backend/src/http/routes.ts`**
  - Match `/join/:code`, `/room/:gameId/:code`, and `/group/:code`.
  - Retrieve active room/group from `rooms`/`groups` store.
  - Inject customized `<title>`, `og:title`, `og:description`, `twitter:title`, `twitter:description`.

- [x] **T4: Verification**
  - Run `pnpm --filter backend exec tsx --test test/core/ogRoutes.test.ts`.
  - Run `pnpm --filter backend typecheck`.
  - Rebuild frontend with `pnpm --filter frontend build`.
