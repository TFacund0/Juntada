import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../../../../components/game-kit/hooks/usePrefersReducedMotion";
import type { ChatFeedItem } from "../../utils/chatFeed";
import { isNearBottom, newMessagesLabel } from "../../utils/chatScroll";
import { useFreshKeys } from "../../hooks/useFreshKeys";
import { ChatLine } from "./ChatLine";

interface ChatFeedProps {
  items: readonly ChatFeedItem[];
  /** Se ve mientras nadie escribió nada (debajo de la línea de sistema, si hay). */
  emptyText: string;
  canAnimate: () => boolean;
}

// Mensajes propios, aciertos y líneas de sistema siempre llevan al final,
// aunque el usuario haya subido a leer (como `pushChat(el, true)` en la
// referencia); el resto solo si ya estaba abajo.
const forcesScroll = (item: ChatFeedItem) => item.kind !== "msg" || item.mine;

/**
 * Historial completo del turno con scroll propio (el de la página no se
 * mueve: `overscroll-contain`). Si el usuario está abajo, cada mensaje nuevo
 * lo lleva al final; si subió a leer, no se lo mueve y aparece "↓ N nuevos",
 * que baja suave.
 */
export function ChatFeed({ items, emptyText, canAnimate }: ChatFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Si estaba abajo ANTES de que llegue lo nuevo — medido en cada scroll,
  // porque para cuando corre el efecto el mensaje ya está en el DOM.
  const atBottom = useRef(true);
  const seen = useRef<Set<string> | null>(null);
  const [unseen, setUnseen] = useState(0);
  const reduced = usePrefersReducedMotion();
  const isFresh = useFreshKeys(
    items.map(i => i.key),
    canAnimate,
  );

  const toBottom = useCallback((smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    if (smooth && typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    if (seen.current === null) {
      // Al montar (o volver a esta pantalla) se arranca por el final.
      seen.current = new Set(items.map(i => i.key));
      toBottom(false);
      return;
    }
    const added = items.filter(i => !seen.current!.has(i.key));
    if (added.length === 0) return;
    added.forEach(i => seen.current!.add(i.key));
    if (atBottom.current || added.some(forcesScroll)) {
      toBottom(false);
      atBottom.current = true;
    } else {
      setUnseen(n => n + added.length);
    }
  }, [items, toBottom]);

  // El teclado del celular (o rotar) achica la columna: quien estaba
  // leyendo lo último sigue viendo lo último.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (atBottom.current) toBottom(false);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [toBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottom.current = isNearBottom(el);
    if (atBottom.current) setUnseen(0);
  };

  // Igual que la referencia: cualquier línea (incluida la de sistema) saca
  // el texto de chat vacío.
  const hasMessages = items.length > 0;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        aria-live="polite"
        className="rl-scrollbar absolute inset-0 flex flex-col gap-1.5 overflow-y-auto overscroll-contain px-3 pb-2 pt-2.5"
      >
        {items.map(item => (
          <ChatLine key={item.key} item={item} fresh={isFresh(item.key)} />
        ))}
        {!hasMessages && <p className="m-auto text-center text-[13px] text-rl-muted">{emptyText}</p>}
      </div>
      {unseen > 0 && (
        <button
          type="button"
          onClick={() => toBottom(!reduced)}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 cursor-pointer rounded-full border-0 bg-rl-accent px-3 py-[5px] text-xs font-extrabold text-white shadow-[0_4px_14px_rgba(0,0,0,.5)]"
        >
          {newMessagesLabel(unseen)}
        </button>
      )}
    </div>
  );
}
