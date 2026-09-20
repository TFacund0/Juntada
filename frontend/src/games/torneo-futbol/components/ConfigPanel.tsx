import { TeamConfigPanel } from "./TeamConfigPanel";
import type { ConfigPanelProps } from "../../gameTypes";

// ═══════════════════════════════════════════════════════════════════════════════
// TORNEO DE FÚTBOL — panel del anfitrión en el lobby multijugador. Todo el
// contenido (equipos, asignación, cruces) vive en TeamConfigPanel, compartido
// con el modo local — acá solo se lo conecta a room.config vía updateConfig.
// El bracket recién se arma (server-side) cuando el host aprieta "Iniciar ronda".
// ═══════════════════════════════════════════════════════════════════════════════

export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const { players } = room;
  const config = room.config as { trackGoals: boolean; teams: string[]; assignments: Record<string, string>; seedOrder: string[] };
  const { trackGoals, teams, assignments, seedOrder } = config;

  return (
    <TeamConfigPanel
      players={players}
      teams={teams}
      onAddTeam={name => updateConfig({ teams: [...teams, name] })}
      onRemoveTeam={name => updateConfig({ teams: teams.filter(x => x !== name) })}
      assignments={assignments}
      setAssignments={next => updateConfig({ assignments: next })}
      seedOrder={seedOrder}
      setSeedOrder={next => updateConfig({ seedOrder: next })}
      trackGoals={trackGoals}
      onToggleTrackGoals={() => updateConfig({ trackGoals: !trackGoals })}
    />
  );
}
