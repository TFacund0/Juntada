import { S } from "../../../theme/styles";

interface ModeSelectorProps {
  mode: "keep" | "eliminate";
  onChange: (mode: "keep" | "eliminate") => void;
  // Online addresses the whole (remote) group ("quieran"); local mode
  // addresses the one person holding the device ("quieras") — same
  // structure, deliberately different copy, so this stays a prop instead
  // of a hardcoded string.
  keepLabel: string;
}

export function ModeSelector({ mode, onChange, keepLabel }: ModeSelectorProps) {
  return (
    <div style={S.card}>
      <span style={S.label}>Modo</span>
      <label
        style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: 10, marginBottom: 10 }}
        onClick={() => onChange("keep")}
      >
        <input type="radio" readOnly checked={mode === "keep"} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>{keepLabel}</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => onChange("eliminate")}>
        <input type="radio" readOnly checked={mode === "eliminate"} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>Eliminación — la que sale se saca de la ruleta</span>
      </label>
    </div>
  );
}
