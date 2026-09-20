import { T } from "../../../theme/styles/classes";

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
    <div className={T.card}>
      <span className={T.label}>Modo</span>
      <label className="flex items-center gap-2.5 cursor-pointer my-2.5" onClick={() => onChange("keep")}>
        <input type="radio" readOnly checked={mode === "keep"} />
        <span className="text-sm font-bold">{keepLabel}</span>
      </label>
      <label className="flex items-center gap-2.5 cursor-pointer" onClick={() => onChange("eliminate")}>
        <input type="radio" readOnly checked={mode === "eliminate"} />
        <span className="text-sm font-bold">Eliminación — la que sale se saca de la ruleta</span>
      </label>
    </div>
  );
}
