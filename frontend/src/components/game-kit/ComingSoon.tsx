import clsx from "clsx";
import { T } from "../../theme/styles/classes";

interface ComingSoonProps {
  label?: string;
}

/**
 * Placeholder compartido para cualquier juego que ya está registrado (así
 * aparece en el picker) pero todavía no está implementado. Ver
 * `games/registry.ts`.
 */
export function ComingSoon({ label = "Este juego" }: ComingSoonProps) {
  return (
    <div className={clsx(T.cardHighlight, "text-center")}>
      <p className="font-extrabold text-lg mb-1.5">{label} está en construcción</p>
      <p className="text-[#9089c0] text-[13px]">Todavía no se puede jugar, pero ya aparece en el menú.</p>
    </div>
  );
}
