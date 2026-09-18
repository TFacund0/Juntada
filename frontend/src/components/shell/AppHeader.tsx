import type { RefObject } from "react";
import { HomeNavbar } from "./HomeNavbar";
import { GameNavbar } from "./GameNavbar";
import type { GameDef } from "../../games/gameTypes";
import "./AppHeader.css";

interface AppHeaderProps {
  gameId: string | null;
  mode: "local" | "multi" | null;
  groupFlow: boolean;
  // Con esto (y gameId) es como goBack (useAppNavigation) decide si "Volver"
  // manda de vuelta a la pantalla de grupo en vez de salir del juego — el
  // ícono/tooltip acá reflejan la misma condición para no prometer una
  // acción con la flecha y hacer otra al tocarla.
  groupAttached: boolean;
  game: GameDef | null | undefined;
  accentColor: string;
  mutedColor: string;
  playerName: string;
  onSavePlayerName: (name: string) => void;
  onBack: () => void;
  onExit: () => void;
  showProfileMenu: boolean;
  onToggleProfileMenu: () => void;
  profileMenuRef: RefObject<HTMLDivElement>;
  onStartGroupFlow: (intent: "create" | "join") => void;
  showRules: boolean;
  onToggleRules: () => void;
}

/**
 * El header compartido que se muestra arriba de cada pantalla. Tiene dos
 * looks bien distintos:
 * - Menú principal (elegir juego, sin juego ni grupo activo): ver
 *   HomeNavbar.
 * - Cualquier pantalla con un juego ya elegido (eligiendo modo, jugando, o
 *   ya en una sala): ver GameNavbar. Solo el flujo neutral de crear/unirse
 *   a un grupo (sin juego puntual todavía) se queda con este mismo look
 *   compacto, no el "hero" grande de antes.
 *
 * Este componente es solo un dispatcher fino: decide qué navbar renderizar
 * y deriva `backLabel`; el JSX de cada rama vive en HomeNavbar/GameNavbar.
 */
export function AppHeader({
  gameId,
  mode,
  groupFlow,
  groupAttached,
  game,
  accentColor,
  mutedColor,
  playerName,
  onSavePlayerName,
  onBack,
  onExit,
  showProfileMenu,
  onToggleProfileMenu,
  profileMenuRef,
  onStartGroupFlow,
  showRules,
  onToggleRules,
}: AppHeaderProps) {
  const isHome = !gameId && !groupFlow;
  // Misma condición que goBack (useAppNavigation): con un grupo activo y una
  // instancia puntual en pantalla, "Volver" no sale del juego, manda de
  // vuelta a la pantalla de grupo.
  const backGoesToGroup = groupAttached && !!gameId;
  const backLabel = backGoesToGroup ? "Volver al grupo" : "Volver";

  if (isHome) {
    return (
      <HomeNavbar
        mutedColor={mutedColor}
        playerName={playerName}
        onSavePlayerName={onSavePlayerName}
        showProfileMenu={showProfileMenu}
        onToggleProfileMenu={onToggleProfileMenu}
        profileMenuRef={profileMenuRef}
        onStartGroupFlow={onStartGroupFlow}
      />
    );
  }

  if (gameId || groupFlow) {
    return (
      <GameNavbar
        mode={mode}
        groupFlow={groupFlow}
        game={game}
        accentColor={accentColor}
        mutedColor={mutedColor}
        onBack={onBack}
        onExit={onExit}
        showRules={showRules}
        onToggleRules={onToggleRules}
        backLabel={backLabel}
      />
    );
  }

  // isHome y (gameId || groupFlow) son exhaustivos: no queda un tercer caso.
  return null;
}
