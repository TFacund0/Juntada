import type { RouteObject } from "react-router-dom";
import App from "./App";
import { JoinRedirect } from "./features/multiplayer/JoinRedirect";
import { RootLayout } from "./RootLayout";
import { ROUTES } from "./hooks/appRoutes";

// Route tree derived from ROUTES (hooks/appRoutes.ts) — the single source of
// truth for the app's path scheme. App itself stays a single, non-remounting
// layout route: every path under it (/, /game/:gameId, /game/:gameId/local,
// /room/:gameId/:code?, /group/:code?) still reads its own state via
// useAppNavigation/routeInitFromMatches rather than per-route elements, so
// remounting App on every path change would destroy that state. /join/:code
// is the only route that needs its own component (JoinRedirect) and sits as
// a sibling OUTSIDE App, so a join link never mounts App at all.
//
// Both App and /join live under one shared root route (RootLayout) so the
// service-worker update overlay (useServiceWorkerUpdate/AppUpdateOverlay)
// keeps seeing both, matching the previous main.tsx/Root behavior exactly.
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      {
        id: "home",
        path: ROUTES.home,
        element: <App />,
      },
      {
        id: "game",
        path: ROUTES.game,
        element: <App />,
      },
      {
        id: "gameLocal",
        path: ROUTES.gameLocal,
        element: <App />,
      },
      {
        id: "room",
        path: ROUTES.room,
        element: <App />,
      },
      {
        id: "group",
        path: ROUTES.group,
        element: <App />,
      },
      {
        id: "join",
        path: ROUTES.join,
        element: <JoinRedirect />,
      },
    ],
  },
];
