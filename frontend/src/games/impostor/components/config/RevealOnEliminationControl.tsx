import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";

interface RevealOnEliminationControlProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

// "¿Se revela el rol al eliminar a alguien?" — byte-identical between
// LocalGame y ConfigPanel's "Reglas" tab, just wired to a different write
// path (local React state vs a patch sent to the server). Rendered inside
// each caller's own ConfigSection, same as every other rule question.
export function RevealOnEliminationControl({ value, onChange }: RevealOnEliminationControlProps) {
  return (
    <>
      <span className={T.label}>¿Se revela el rol al eliminar a alguien?</span>
      <div className="mt-1 flex gap-2">
        <button onClick={() => onChange(true)} className={clsx(T.btn(value ? "primary" : "ghost"), "flex-1 px-2 py-2.5 text-[13px]")}>
          Sí, se revela
        </button>
        <button onClick={() => onChange(false)} className={clsx(T.btn(!value ? "primary" : "ghost"), "flex-1 px-2 py-2.5 text-[13px]")}>
          No, queda en duda
        </button>
      </div>
      <p className={clsx(T.muted, "mt-2.5 leading-[1.4]")}>
        {value
          ? "Al eliminar a alguien se muestra si era el impostor o no."
          : "Al eliminar a alguien no se revela su rol — sigan jugando con la duda."}
      </p>
    </>
  );
}
