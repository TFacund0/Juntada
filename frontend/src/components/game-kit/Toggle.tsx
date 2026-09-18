import clsx from "clsx";
import { T } from "../../theme/styles/classes";

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/** Switch on/off con su propio label, controlado — el componente no guarda estado propio. */
export function Toggle({ label, value, onChange }: ToggleProps) {
  return (
    <label
      className="jt-btn-anim flex items-center gap-2.5 cursor-pointer w-fit transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      onClick={() => onChange(!value)}
    >
      <div className={T.toggle(value)}>
        <div className={T.knob(value)} />
      </div>
      <span
        className={clsx(
          "text-[13px] font-semibold transition-colors duration-200",
          value ? "text-[#5DCAA5]" : "text-[var(--jt-muted-text)]",
        )}
      >
        {label}
      </span>
    </label>
  );
}
