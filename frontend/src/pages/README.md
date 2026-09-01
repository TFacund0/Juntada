# pages/

Route-leaf page components, grouped by what stage of the flow they belong to:

- `picker/` — screens for choosing a game and mode before a match starts (`PickerPage`, `ModePickerPage`, `GameEntry`).
- `game/` — screens for an active or joining match (`LocalGamePage`, `LocalOnlyGamePage`, `GroupPage`, `RoomPage`, `GameLoading`).

`context/` stays at the root of `pages/` rather than in either subfolder: it holds the 5 domain contexts (`GameSessionContext`, `GameBridgeContext`, `CurtainContext`, `PlayerSessionContext`, `AppShellContext`) that `AppMainContent` provides around `<Outlet>` and every page reads via their `useXContext()` hooks — not page components themselves, and both `picker/` and `game/` depend on them.
