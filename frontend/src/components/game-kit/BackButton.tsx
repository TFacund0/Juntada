import { Btn } from "../ui/Btn";

/**
 * La acción secundaria de "volver al setup/lobby" que se muestra debajo de
 * la principal en pantallas de resultado/juego — mismo estilo ghost y
 * espaciado en todos lados, sin importar el juego o el modo (local/online).
 * Cada lugar donde se usa solo aporta su propio label ("Volver a
 * jugadores", "Volver al lobby", ...).
 */
export function BackButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <Btn variant="ghost" onClick={onClick} style={{ marginTop: 10 }}>
      {children}
    </Btn>
  );
}
