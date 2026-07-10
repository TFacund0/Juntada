// ─── Frontend Game Registry ──────────────────────────────────────────────────
// Mirrors backend/src/games/registry.js: every game Juntada offers plugs in
// here instead of being hardcoded into the shell components. Adding a game
// means creating games/<id>/ with these pieces and adding one entry below —
// App.jsx, MultiplayerGame.jsx and useMultiplayerSocket.js never change.
//
// Each entry:
//   id            string, matches backend room.gameType
//   label, description   shown on the game picker
//   minPlayers    lobby "start round" is disabled below this
//   LocalGame     component for the single-device pass-and-play mode
//   ConfigPanel   component rendered in the multiplayer lobby for the host
//                 to tweak this game's rules. Props: { room, updateConfig }
//   RoundView     component for the multiplayer round/voting/result phases.
//                 Props: { room, me, myPlayer, myRole, wordReveal, isHost, send }
//   comingSoon    optional: true hides "start round" behind a placeholder
//                 while the game is still being built (see games/sintonia).

import { impostorGame } from "./impostor";
import { sintoniaGame } from "./sintonia";
import { tutifrutiGame } from "./tutifruti";
import { tatetiGame } from "./tateti";
import { triviaGame } from "./trivia";
import { ruletaGame } from "./ruleta";
import { torneoFifaGame } from "./torneo-fifa";

export const GAMES = {
  [impostorGame.id]: impostorGame,
  [sintoniaGame.id]: sintoniaGame,
  [tutifrutiGame.id]: tutifrutiGame,
  [tatetiGame.id]: tatetiGame,
  [triviaGame.id]: triviaGame,
  [ruletaGame.id]: ruletaGame,
  [torneoFifaGame.id]: torneoFifaGame,
};

export const GAME_LIST = Object.values(GAMES);

export function getGame(gameId) {
  return GAMES[gameId];
}
