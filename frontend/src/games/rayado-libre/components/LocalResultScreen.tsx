import { useMemo } from "react";
import type { LocalPlayer } from "../types/localGame";
import { RayadoPodium } from "./podium/RayadoPodium";
import { PrimaryButton } from "./PrimaryButton";

interface LocalResultScreenProps {
  players: LocalPlayer[];
  scores: Record<number, number>;
  backToSetup: () => void;
}

/** Pantalla "result" del modo local: el mismo podio que online, festejando al ganador sea quien sea (la pantalla es de toda la mesa). */
export function LocalResultScreen({ players, scores, backToSetup }: LocalResultScreenProps) {
  const entries = useMemo(() => players.map(p => ({ id: String(p.id), name: p.name, score: scores[p.id] || 0 })), [players, scores]);
  return (
    <RayadoPodium
      entries={entries}
      celebrateAnyWinner
      // Vuelve a la pantalla de jugadores/configuración en vez de reiniciar
      // al instante: así la mesa puede ajustar algo antes de la próxima.
      foot={<PrimaryButton onClick={backToSetup}>Jugar de nuevo</PrimaryButton>}
    />
  );
}
