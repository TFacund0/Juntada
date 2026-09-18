import clsx from "clsx";
import { T } from "../../theme/styles/classes";
import { Btn } from "../ui/Btn";
import { ErrorBanner } from "../ui/ErrorBanner";

/**
 * Formulario compartido de "sumar jugador" — misma card, mismo layout, en
 * todo modo local que arma su propia lista de jugadores (el setup de
 * círculo/revelado de limón-limón, el setup pasa-y-juega de
 * color-correcto, ...). La deduplicación/validación de nombres queda del
 * lado de quien lo usa (necesita la lista de jugadores en vivo), esto solo
 * renderiza el input + confirmar + error.
 */
export function AddPlayerForm({
  name,
  onNameChange,
  onSubmit,
  error,
  errorKey,
}: {
  name: string;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
  error: string;
  errorKey: number;
}) {
  return (
    <div className={T.card}>
      <span className={T.label}>Sumar jugador</span>
      <div className="flex gap-2">
        <input
          className={clsx(T.input, "flex-1 min-w-0")}
          placeholder="Nombre"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") onSubmit();
          }}
        />
        <Btn variant="ghost" onClick={onSubmit} style={{ width: "auto", padding: "11px 18px" }}>
          Sumar
        </Btn>
      </div>
      <ErrorBanner message={error} flashKey={errorKey} variant="inline" />
    </div>
  );
}
