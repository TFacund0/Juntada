import { S } from "../../theme/styles";

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/** Switch on/off con su propio label, controlado — el componente no guarda estado propio. */
export function Toggle({ label, value, onChange }: ToggleProps) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => onChange(!value)}>
      <div style={S.toggle(value)}>
        <div style={S.knob(value)} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: value ? "#5DCAA5" : "var(--jt-muted-text)" }}>{label}</span>
    </label>
  );
}
