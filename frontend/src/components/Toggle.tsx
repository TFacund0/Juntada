import { S } from "../theme/styles";

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function Toggle({ label, value, onChange }: ToggleProps) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => onChange(!value)}>
      <div style={S.toggle(value)}>
        <div style={S.knob(value)} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: value ? "#5DCAA5" : "#6b6490" }}>{label}</span>
    </label>
  );
}
