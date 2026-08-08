import { useState } from "react";
import { getStoredPlayerName, setStoredPlayerName } from "../features/multiplayer/utils/playerName";

/**
 * El nombre del jugador — extraído de `App.tsx`. Se pregunta una sola vez,
 * apenas se abre la app por primera vez (ver `NameOnboardingScreen`), y
 * queda guardado localmente para que nada más adelante (crear/unirse a una
 * sala o grupo) tenga que volver a pedirlo. Editable después desde la
 * pantalla de inicio ("Cambiar").
 */
export function usePlayerName() {
  const [playerName, setPlayerName] = useState(() => getStoredPlayerName());

  const savePlayerName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStoredPlayerName(trimmed);
    setPlayerName(trimmed);
  };

  return { playerName, savePlayerName };
}
