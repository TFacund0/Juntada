import { TabRow } from "./TabRow";

export type SetupTab = "players" | "config";

// The Jugadores/Configuración split shown at the top of every local setup
// screen (see StickyActionBar for the matching bottom action) — same two
// tabs and labels everywhere, so each game only owns its own tab content.
export function SetupTabs({ tab, onChange }: { tab: SetupTab; onChange: (tab: SetupTab) => void }) {
  return (
    <TabRow
      tabs={[
        { key: "players", label: "Jugadores" },
        { key: "config", label: "Configuración" },
      ]}
      active={tab}
      onChange={onChange}
      style={{ marginBottom: 14 }}
    />
  );
}
