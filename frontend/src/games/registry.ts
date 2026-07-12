// ─── Frontend Game Registry ──────────────────────────────────────────────────
// Mirrors backend/src/games/registry.js: every game Juntada offers plugs in
// here instead of being hardcoded into the shell components. Adding a game
// means creating games/<id>/ with these pieces and adding one entry below —
// App.jsx, MultiplayerGame.jsx and useMultiplayerSocket.js never change.
//
// Each entry (shape: GameDef in ./gameTypes.ts):
//   id            string, matches backend room.gameType
//   label, description   shown on the game picker
//   minPlayers    lobby "start round" is disabled below this
//   LocalGame     component for the single-device pass-and-play mode
//   ConfigPanel   component rendered in the multiplayer lobby for the host
//                 to tweak this game's rules. Props: { room, updateConfig }
//   RoundView     component for the multiplayer round/voting/result phases.
//                 Props: { room, me, myPlayer, myRole, wordReveal, isHost, send }
//   comingSoon    optional: true hides "start round" behind a placeholder
//                 while the game is still being built (see games/trivia).
//   localOnly     optional: true skips the local/multi mode picker and goes
//                 straight into LocalGame — for games with no backend engine
//                 (see games/ruleta).
//   rules         optional: string[] shown in the "¿Cómo se juega?" panel
//                 (App.jsx, via components/GameRules.jsx) — plain sentences,
//                 one per array entry; an entry starting with "- " joins the
//                 previous run into a bullet list. Skip it and the button
//                 just doesn't appear for that game.
//   LobbyInfo     optional: read-only component shown to non-host players in
//                 the multiplayer lobby, mirroring whatever the host is
//                 configuring live (see games/tutifruti). Props: { room }.
//                 Games that skip it just get the generic "esperando..."
//                 message instead (see MultiplayerGame.jsx).

import type { GameDef } from "./gameTypes";
import { impostorGame } from "./impostor";
import { sintoniaGame } from "./sintonia";
import { tutifrutiGame } from "./tutifruti";
import { tatetiGame } from "./tateti";
import { triviaGame } from "./trivia";
import { ruletaGame } from "./ruleta";
import { torneoFifaGame } from "./torneo-fifa";
import { limonLimonGame } from "./limon-limon";
import { codenamesGame } from "./codenames";

export const GAMES: Record<string, GameDef> = {
  [impostorGame.id]: impostorGame,
  [sintoniaGame.id]: sintoniaGame,
  [tutifrutiGame.id]: tutifrutiGame,
  [tatetiGame.id]: tatetiGame,
  [triviaGame.id]: triviaGame,
  [ruletaGame.id]: ruletaGame,
  [torneoFifaGame.id]: torneoFifaGame,
  [limonLimonGame.id]: limonLimonGame,
  [codenamesGame.id]: codenamesGame,
};

export const GAME_LIST = Object.values(GAMES);

export function getGame(gameId: string): GameDef | undefined {
  return GAMES[gameId];
}
