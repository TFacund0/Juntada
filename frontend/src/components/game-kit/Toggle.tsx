import { S } from "../../theme/styles";

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/** Switch on/off con su propio label, controlado — el componente no guarda estado propio. */
export function Toggle({ label, value, onChange }: ToggleProps) {
  return (
    <label
      className="jt-btn-anim"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        width: "fit-content",
        transition: "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
      onClick={() => onChange(!value)}
    >
      <div style={S.toggle(value)}>
        <div style={S.knob(value)} />
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: value ? "#5DCAA5" : "var(--jt-muted-text)",
          transition: "color 0.2s",
        }}
      >
        {label}
      </span>
    </label>
  );
}
