import type { CSSProperties } from "react";
import { Btn } from "../ui/Btn";

/**
 * La acción principal de "arrancar el juego" que se muestra abajo de toda
 * pantalla de setup (ver `StickyActionBar`) — mismo botón verde en todos
 * lados, sin importar de qué juego se trate. Cada juego solo aporta su
 * propio label ("Empezar a jugar", "Iniciar ronda", ...).
 */
export function StartButton({
  children,
  onClick,
  disabled,
  className,
  style,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Btn variant="success" onClick={onClick} disabled={disabled} className={className} style={style}>
      {children}
    </Btn>
  );
}
