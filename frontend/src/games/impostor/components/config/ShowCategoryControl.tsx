import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";
import { Toggle } from "../../../../components/game-kit/Toggle";

interface ShowCategoryControlProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

// "Mostrar la categoría junto a la palabra" — byte-identical between
// LocalGame y ConfigPanel's "Reglas" tab, just wired to a different write
// path (local React state vs a patch sent to the server).
export function ShowCategoryControl({ value, onChange }: ShowCategoryControlProps) {
  return (
    <>
      <Toggle label="Mostrar la categoría junto a la palabra" value={value} onChange={onChange} />
      <p className={clsx(T.muted, "mt-2.5 leading-[1.4]")}>
        {value
          ? "Todos ven de qué categoría es la palabra al revelar su carta — inocentes e impostor por igual."
          : "Nadie ve la categoría, solo la palabra (o la pista, si el impostor tiene una activada)."}
      </p>
    </>
  );
}
