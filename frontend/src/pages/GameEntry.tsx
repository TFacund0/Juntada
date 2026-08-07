import { useParams } from "react-router-dom";
import { getGame } from "../games/registry";
import { LocalOnlyGamePage } from "./LocalOnlyGamePage";
import { ModePickerPage } from "./ModePickerPage";

// Dispatch component for the /game/:gameId route.
//
// CORRECTED DESIGN DECISION (see design.md): the original proposal wanted to
// resolve a localOnly game at this route via a <Navigate> redirect (e.g. to
// /game/:gameId/local) — that was proven invalid. useUrlSync's state-to-URL
// sync effect always computes /game/:gameId when mode is null (buildPath in
// appRoutes.ts), and a localOnly game's `mode` stays null by design (it never
// goes through ModePicker) — so any redirect away from /game/:gameId would
// bounce forever against that sync effect.
//
// The approved fix: GameEntry never touches the URL. It just decides, purely
// in its own render output, which of the two pages to show for this
// gameId — LocalOnlyGamePage if that game is localOnly, ModePickerPage
// otherwise — while the URL stays exactly /game/:gameId in both cases,
// matching what useUrlSync already puts there today.
//
// Each of those two pages still carries its own original guard (see their
// files) as the "one-render lag" safety net — GameEntry deciding which one
// to render does not replace that guard, it's an additional layer on top.
export function GameEntry() {
  const { gameId } = useParams<{ gameId: string }>();
  const game = gameId ? getGame(gameId) : null;

  if (game?.localOnly) return <LocalOnlyGamePage />;
  return <ModePickerPage />;
}
