# pages/

Route-leaf page components, grouped by what stage of the flow they belong to:

- `picker/` — screens for choosing a game and mode before a match starts (`PickerPage`, `ModePickerPage`, `GameEntry`).
- `game/` — screens for an active or joining match (`LocalGamePage`, `LocalOnlyGamePage`, `GroupPage`, `RoomPage`, `GameLoading`).

`AppOutletContext.ts` stays at the root of `pages/` rather than in either subfolder: it's a shared type (the outlet context contract every page reads via `useOutletContext<AppOutletContext>()`), not a page component itself, and both `picker/` and `game/` depend on it.
