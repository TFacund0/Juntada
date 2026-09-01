import { TabRow } from "./TabRow";

export type SetupTab = "players" | "config";

/**
 * El split Jugadores/Configuración que se muestra arriba de toda pantalla
 * de setup local (ver `StickyActionBar` para la acción de abajo que hace
 * juego) — mismas dos tabs y labels en todos lados, así cada juego solo es
 * dueño del contenido propio de sus tabs.
 */
export function SetupTabs({ tab, onChange }: { tab: SetupTab; onChange: (tab: SetupTab) => void }) {
  return (
    <TabRow
      tabs={[
        { key: "players", label: "Jugadores" },
        { key: "config", label: "Configuración" },
      ]}
      active={tab}
      onChange={onChange}
      className="mb-3.5"
    />
  );
}
