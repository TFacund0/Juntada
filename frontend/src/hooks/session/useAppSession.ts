import { useState, useRef, useCallback, useEffect } from "react";
import { useMatches } from "react-router-dom";
import { GAME_LIST, getGame } from "../games/registry";
import { isGameAvailable } from "../games/maintenance";
import { saveActive } from "./useActiveSession";
import { routeInitFromMatches } from "../routing/appRoutes";
import type { JoinLink } from "../features/multiplayer/utils/joinLink";

/**
 * Qué juego/modo está elegido y el flujo de grupo — extraído de
 * useAppNavigation.ts (misma lógica, mismo comportamiento). No conoce
 * confirmaciones/diálogos ni la cortina de transición; eso vive en
 * useAppDialogs/useHeaderUI y useAppShell respectivamente.
 */
export function useAppSession(validJoinLink: JoinLink | null, restored: { gameId: string; mode: "local" | "multi" } | null) {
  const matches = useMatches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const [routeInit] = useState(() => routeInitFromMatches(matches));
  const linkGameId = validJoinLink?.kind === "room" ? validJoinLink.gameId : null;
  const [gameId, setGameId] = useState<string | null>(routeInit.gameId ?? linkGameId ?? restored?.gameId ?? null);
  const [mode, setMode] = useState<"local" | "multi" | null>(routeInit.mode ?? (validJoinLink ? "multi" : (restored?.mode ?? null)));
  const [groupFlow, setGroupFlow] = useState(() => routeInit.groupFlow || validJoinLink?.kind === "group");
  const [roomCode, setRoomCode] = useState<string | null>(routeInit.mode === "multi" && !routeInit.groupFlow ? routeInit.code : null);
  const [groupCode, setGroupCode] = useState<string | null>(routeInit.groupFlow ? routeInit.code : null);
  const [groupIntent, setGroupIntent] = useState<"create" | "join" | undefined>(undefined);
  const [pendingGroupJoinCode, setPendingGroupJoinCode] = useState<string | null>(null);
  const switchToGroupJoin = (code: string) => {
    setPendingGroupJoinCode(code);
    setGroupIntent("join");
    setGroupFlow(true);
  };
  const [groupAttached, setGroupAttached] = useState(false);

  const game = gameId ? getGame(gameId) : null;

  const [inRoom, setInRoom] = useState(false);
  const inGameView = game ? (game.localOnly ? isGameAvailable(game) : mode === "local" || (mode === "multi" && inRoom)) : false;
  const [roomPhase, setRoomPhase] = useState<string | null>(null);
  // Read via a ref (not `gameId` directly) so this callback's identity stays
  // stable across the very setGameId calls it makes — MultiplayerGame's
  // shell effect that calls this on room.gameType change also uses it as its
  // cleanup (see there), so if this identity changed on every gameId update,
  // that cleanup/effect pair would fire back-to-back with stale/fresh
  // closures each render, alternately setting gameId back to null and
  // forward to the room's real game — an infinite ping-pong ("Maximum update
  // depth exceeded") that showed up as the header/theme visibly flicking
  // between "Juntada" and the game's own title on every entry into a themed
  // game from a group.
  //
  // DO NOT replace gameIdRef.current with gameId or add gameId to the deps
  // array below — that reintroduces the bug (see design doc invariant #2).
  const gameIdRef = useRef(gameId);
  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);
  const handleRoomGameType = useCallback(
    (roomGameType: string | null) => {
      setInRoom(roomGameType !== null);
      if (roomGameType === null) {
        if (groupFlow) setGameId(null);
        return;
      }
      if (roomGameType !== gameIdRef.current && getGame(roomGameType)) setGameId(roomGameType);
    },
    [groupFlow],
  );

  useEffect(() => {
    saveActive(mode === "multi" && gameId ? { gameId, mode } : null);
  }, [gameId, mode]);

  return {
    gameId,
    setGameId,
    mode,
    setMode,
    game,
    groupFlow,
    setGroupFlow,
    roomCode,
    setRoomCode,
    groupCode,
    setGroupCode,
    groupIntent,
    setGroupIntent,
    pendingGroupJoinCode,
    setPendingGroupJoinCode,
    switchToGroupJoin,
    groupAttached,
    setGroupAttached,
    inRoom,
    inGameView,
    roomPhase,
    setRoomPhase,
    handleRoomGameType,
    GAME_LIST,
  };
}
