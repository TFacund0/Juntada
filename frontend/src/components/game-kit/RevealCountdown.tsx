import { useState, useEffect } from "react";
import { S } from "../../theme/styles";

/**
 * Genera un momento de suspenso antes de mostrar el resultado de una
 * ronda, en vez de mostrar el desenlace apenas cambia la fase. `resetKey`
 * debería ser algo que cambia una vez por cada resultado nuevo (ej.
 * `room.roundHistory.length`) para que la cuenta regresiva se reinicie en
 * cada ronda pero no se reinicie en cada re-render no relacionado mientras
 * la fase se mantiene en "result".
 */
export function useRevealCountdown(resetKey: unknown, seconds = 3): number {
  const [count, setCount] = useState(seconds);
  // Registra el resetKey visto en el último render para poder detectar un
  // cambio de forma síncrona durante el render (ver abajo) en vez de solo
  // en un efecto, que corre *después* de que el navegador ya pintó el
  // count (desactualizado) de este render — ese hueco era lo que hacía que
  // la cuenta regresiva terminada (0) de la ronda anterior mostrara el
  // resultado real por un instante antes de reiniciarse a 3.
  const [prevResetKey, setPrevResetKey] = useState(resetKey);

  // "Ajustar estado durante el render" (ver la documentación de React):
  // actualizar el estado acá, en medio del render, dispara inmediatamente
  // un re-render antes de pintar, así el primerísimo render de una ronda
  // nueva ya muestra el count reiniciado en vez de filtrar el valor
  // terminado de la ronda anterior.
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setCount(seconds);
  }

  useEffect(() => {
    if (seconds <= 0) return;
    const interval = setInterval(() => {
      setCount(c => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [resetKey, seconds]);

  return count; // 0 una vez que la cuenta regresiva terminó — seguro para revelar
}

interface RevealCountdownProps {
  count: number;
  label?: string;
}

export function RevealCountdown({ count, label = "Revelando resultado..." }: RevealCountdownProps) {
  return (
    <div style={{ ...S.cardHighlight, textAlign: "center", padding: "48px 20px" }}>
      <p style={{ fontSize: 13, color: "var(--jt-muted-text)", marginBottom: 10 }}>{label}</p>
      <p style={{ fontSize: 56, fontWeight: 800, color: "var(--jt-accent-strong, #AFA9EC)", margin: 0, lineHeight: 1 }}>{count}</p>
    </div>
  );
}
