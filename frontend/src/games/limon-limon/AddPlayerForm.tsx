import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";

// Shared "sumar jugador" form — same card, same layout, in both local modes
// (players can join mid-deck in circle mode, mid-deal in reveal mode). Name
// dedupe/validation stays with the caller (it needs the live players list),
// this just renders the input + confirm + error.
export function AddPlayerForm({
  name,
  onNameChange,
  onSubmit,
  error,
}: {
  name: string;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
  error: string;
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
      {error && <p style={{ fontSize: 12, color: "#F09595", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
