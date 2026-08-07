import type { RouteObject } from "react-router-dom";
import App from "./App";
import { JoinRedirect } from "./features/multiplayer/JoinRedirect";
import { RootLayout } from "./RootLayout";
import { ROUTES } from "./hooks/appRoutes";
import { PickerPage } from "./pages/PickerPage";
import { GameEntry } from "./pages/GameEntry";
import { LocalGamePage } from "./pages/LocalGamePage";
import { RoomPage } from "./pages/RoomPage";
import { GroupPage } from "./pages/GroupPage";

// Route tree derived from ROUTES (hooks/appRoutes.ts) — the single source of
// truth for the app's path scheme. App itself stays a single, non-remounting
// PARENT/layout route (pathless, no `path` of its own): every path under it
// (/, /game/:gameId, /game/:gameId/local, /room/:gameId/:code?,
// /group/:code?) is now a CHILD route pointing at a leaf page component under
// frontend/src/pages/, which reads shared state via useOutletContext rather
// than per-route App elements — so App itself stays mounted at the same tree
// position across all of these path changes instead of remounting.
//
// Route ids live on the CHILD routes, NOT on the App parent — appRoutes.ts's
// routeInitFromMatches/matchRouteId reads only the LAST entry in useMatches()
// (the leaf route), so keeping the id here is what lets direct URL entry and
// page refresh correctly derive session state on every one of these routes.
//
// /join/:code is the only route that needs its own component (JoinRedirect)
// and sits as a sibling OUTSIDE App, so a join link never mounts App at all.
//
// Both App and /join live under one shared root route (RootLayout) so the
// service-worker update overlay (useServiceWorkerUpdate/AppUpdateOverlay)
// keeps seeing both, matching the previous main.tsx/Root behavior exactly.
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      {
        element: <App />,
        children: [
          {
            id: "home",
            path: ROUTES.home,
            element: <PickerPage />,
          },
          {
            id: "game",
            path: ROUTES.game,
            element: <GameEntry />,
          },
          {
            id: "gameLocal",
            path: ROUTES.gameLocal,
            element: <LocalGamePage />,
          },
          {
            id: "room",
            path: ROUTES.room,
            element: <RoomPage />,
          },
          {
            id: "group",
            path: ROUTES.group,
            element: <GroupPage />,
          },
        ],
      },
      {
        id: "join",
        path: ROUTES.join,
        element: <JoinRedirect />,
      },
    ],
  },
];
