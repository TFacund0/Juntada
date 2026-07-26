import { S } from "../theme/styles";
import { Btn } from "./Btn";
import { ErrorBanner } from "./ErrorBanner";

// Shared "sumar jugador" form — same card, same layout, across every local
// mode that lets you build a roster (limon-limon's circle/reveal setup,
// color-correcto's pass-and-play setup, ...). Name dedupe/validation stays
// with the caller (it needs the live players list), this just renders the
// input + confirm + error.
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
    <div style={S.card}>
      <span style={S.label}>Sumar jugador</span>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...S.input, flex: 1 }}
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
