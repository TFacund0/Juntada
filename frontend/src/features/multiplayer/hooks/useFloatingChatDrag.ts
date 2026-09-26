import { useEffect, useRef, useState } from "react";

// `bottom` sale de una variable CSS para que una pantalla puntual pueda
// subir la burbuja sin cambiarla en todos los juegos (ver
// useLiftRoomChatBubble de Rayado Libre, que la saca de encima de su input
// de respuestas).
const DEFAULT_POS = { right: 18, bottom: "var(--jt-chat-bubble-bottom, 96px)" };

interface UseFloatingChatDragArgs {
  onTap: () => void;
}

interface UseFloatingChatDragResult {
  bubbleRef: React.RefObject<HTMLButtonElement | null>;
  bubbleStyle: React.CSSProperties;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

function clampToViewport(x: number, y: number): { x: number; y: number } {
  const size = 56;
  const margin = 8;
  const maxX = window.innerWidth - size - margin;
  const maxY = window.innerHeight - size - margin;
  return { x: Math.min(Math.max(x, margin), Math.max(margin, maxX)), y: Math.min(Math.max(y, margin), Math.max(margin, maxY)) };
}

/**
 * Estado de arrastre de la burbuja flotante (posición, refs de puntero, y
 * los 3 handlers de pointer) — extraído de FloatingChat.tsx verbatim, más
 * un fix: antes solo se re-clampeaba `pos` dentro de onPointerMove, así que
 * arrastrar la burbuja y después achicar la ventana (rotar el celular,
 * resize de escritorio, reflow del teclado/barra de URL en mobile) la podía
 * dejar renderizada fuera del viewport hasta el próximo remount. El listener
 * de "resize" de abajo la vuelve a clampear cada vez, sin tocar nada
 * mientras `pos` siga en null (posición por defecto anclada por CSS).
 */
export function useFloatingChatDrag({ onTap }: UseFloatingChatDragArgs): UseFloatingChatDragResult {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  useEffect(() => {
    const onResize = () => setPos(p => (p ? clampToViewport(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = bubbleRef.current!.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top, moved: false };
    bubbleRef.current!.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
    setPos(clampToViewport(drag.origX + dx, drag.origY + dy));
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    bubbleRef.current?.releasePointerCapture(e.pointerId);
    if (drag && !drag.moved) onTap();
  }

  const bubbleStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : { right: DEFAULT_POS.right, bottom: DEFAULT_POS.bottom };

  return { bubbleRef, bubbleStyle, onPointerDown, onPointerMove, onPointerUp };
}
