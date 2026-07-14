import { useState } from "react";
import { S } from "../../theme/styles";
import { TabRow } from "../../components/TabRow";
import { EntriesEditor } from "./EntriesEditor";
import { ModeSelector } from "./ModeSelector";
import type { ConfigPanelProps } from "../gameTypes";

interface Entry {
  id: string;
  name: string;
  description: string;
}

// Host-only, se muestra en el lobby: carga las entradas de la ruleta (nombre
// + descripción opcional) y elige el modo. Todo se guarda en room.config y
// se sincroniza para que LobbyInfo lo espeje a los demás jugadores. Mismo
// esquema de sub-pestañas que el impostor (ConfigPanel.tsx), para que la
// forma de configurar cada juego se sienta consistente en toda la app. La
// edición de entradas y el selector de modo viven en EntriesEditor.tsx /
// ModeSelector.tsx, compartidos con LocalGame.tsx.
export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const [tab, setTab] = useState<"entries" | "mode">("entries");
  const config = room.config as { entries?: Entry[]; mode?: "keep" | "eliminate" };
  const entries = config.entries || [];
  const mode = config.mode || "eliminate";

  return (
    <div>
      <div style={S.card}>
        <span style={S.label}>Configuración</span>
        <TabRow
          tabs={[
            { key: "entries", label: "Entradas" },
            { key: "mode", label: "Modo" },
          ]}
          active={tab}
          onChange={setTab}
          buttonPadding="8px"
        />
      </div>

      {tab === "entries" && (
        <EntriesEditor
          entries={entries}
          onAdd={(name, description) =>
            updateConfig({ entries: [...entries, { id: `${Date.now()}-${Math.random()}`, name, description }] })
          }
          onRemove={id => updateConfig({ entries: entries.filter(e => e.id !== id) })}
        />
      )}

      {tab === "mode" && (
        <ModeSelector
          mode={mode}
          onChange={m => updateConfig({ mode: m })}
          keepLabel="Repetir — se mantienen todas las entradas, se puede girar las veces que quieran"
        />
      )}
    </div>
  );
}
