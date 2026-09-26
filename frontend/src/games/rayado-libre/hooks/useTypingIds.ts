import { useEffect, useMemo, useState } from "react";
import { activeTypingIds, nextTypingExpiry } from "../utils/typing";

/**
 * Quiénes están escribiendo ahora. El servidor no avisa cuando alguien deja
 * de escribir: cada marca vence sola (ver `typingUntil`), así que acá se
 * agenda un re-render para el próximo vencimiento y los puntitos se apagan
 * a los ~4 s del último aviso sin que llegue ningún mensaje nuevo.
 */
export function useTypingIds(typingUntil: Record<string, number> | undefined, excludeId?: string): string[] {
  // El objeto cambia de identidad en cada broadcast (cada trazo, cada
  // mensaje); la clave evita recalcular y reprogramar si el contenido es igual.
  const key = JSON.stringify(typingUntil ?? {});
  const [tick, setTick] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` resume `typingUntil`; `tick` fuerza la re-evaluación al vencer.
  const ids = useMemo(() => activeTypingIds(typingUntil, Date.now(), excludeId), [key, tick, excludeId]);

  useEffect(() => {
    const now = Date.now();
    const next = nextTypingExpiry(typingUntil, now);
    if (next === null) return;
    const t = setTimeout(() => setTick(n => n + 1), next - now + 20);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ver arriba.
  }, [key, tick]);

  return ids;
}
