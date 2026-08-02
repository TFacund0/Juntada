import type { ReactNode } from "react";
import { S } from "../../../../theme/styles";
import { TabRow } from "../../../../components/setup/TabRow";

export type ConfigTabKey = "cats" | "rules" | "order";

// El switcher "Categorías / Reglas / Orden" Y el contenido de la pestaña
// activa viven en UNA sola card acá (antes eran dos: esto renderizaba su
// propia S.card con el switcher, y cada caller agregaba OTRA S.card debajo
// para el contenido — dos bloques separados para lo que visualmente es una
// sola sección de configuración). children es el contenido de la pestaña
// activa, ya sin su propia card (CategoriesTab/TurnOrderEditor con
// bare/ConfigSection lo dejan así) — compartido entre LocalGame's
// SetupScreen y ConfigPanel (el editor del host online) para que ambos
// modos se vean y se comporten igual.
export function ConfigTabs({
  active,
  onChange,
  children,
}: {
  active: ConfigTabKey;
  onChange: (tab: ConfigTabKey) => void;
  children: ReactNode;
}) {
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
        style={{ marginBottom: 14 }}
      />
      {children}
    </div>
  );
}
