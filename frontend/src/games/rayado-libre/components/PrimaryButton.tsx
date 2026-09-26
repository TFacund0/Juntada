import clsx from "clsx";

/** Botón principal de la revelación y del podio (`.primary` de la referencia): ancho completo, degradé violeta. */
export function PrimaryButton({ children, onClick, className }: { children: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "w-full cursor-pointer rounded-[14px] border-0 p-3.5 font-figtree text-base font-extrabold text-white",
        "bg-linear-[135deg] from-rl-accent to-rl-accent-deep shadow-[0_10px_26px_-8px] shadow-rl-accent/70",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** El mismo lugar que el botón, cuando ya no hay nada para tocar ("Listo — esperando a los demás"). */
export function PrimaryNote({ children }: { children: string }) {
  return (
    <p className="m-0 rounded-[14px] border border-rl-ok-line bg-rl-ok-soft p-3.5 text-center font-figtree text-sm font-extrabold text-rl-ok-text">
      {children}
    </p>
  );
}
