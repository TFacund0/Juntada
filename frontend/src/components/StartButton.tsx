import { Btn } from "./Btn";

/**
 * La acción principal de "arrancar el juego" que se muestra abajo de toda
 * pantalla de setup (ver `StickyActionBar`) — mismo botón verde en todos
 * lados, sin importar de qué juego se trate. Cada juego solo aporta su
 * propio label ("Empezar a jugar", "Iniciar ronda", ...).
 */
export function StartButton({ children, onClick, disabled }: { children: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Btn variant="success" onClick={onClick} disabled={disabled}>
      {children}
    </Btn>
  );
}
