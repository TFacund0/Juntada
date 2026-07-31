import { S } from "../../../../theme/styles";
import { TabRow } from "../../../../components/TabRow";

export type ConfigTabKey = "cats" | "rules" | "order";

// The "Categorías / Reglas / Orden" sub-tab switcher for configuring the
// game — shared by LocalGame's setup screen and ConfigPanel (the online
// host's lobby editor) so both look and behave the same way.
export function ConfigTabs({ active, onChange }: { active: ConfigTabKey; onChange: (tab: ConfigTabKey) => void }) {
  return (
    <div style={S.card}>
      <span style={S.label}>Configuración</span>
      <TabRow
        tabs={[
          { key: "cats", label: "Categorías" },
          { key: "rules", label: "Reglas" },
          { key: "order", label: "Orden" },
        ]}
        active={active}
        onChange={onChange}
        buttonPadding="8px"
      />
    </div>
  );
}
