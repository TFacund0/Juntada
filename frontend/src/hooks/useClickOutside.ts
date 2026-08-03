import { useEffect, useRef } from "react";
import type { RefObject } from "react";

// Shared by every dropdown/panel that closes on an outside click (profile
// menu, group menu, GroupMenuDropdown's own mobile trigger) — each used to
// hand-roll the same mousedown listener + cleanup itself. `onOutside` is
// read through a ref so callers can pass an inline arrow without it
// re-subscribing the listener on every render.
export function useClickOutside(ref: RefObject<HTMLElement | null>, active: boolean, onOutside: () => void) {
  const onOutsideRef = useRef(onOutside);
  onOutsideRef.current = onOutside;

  useEffect(() => {
    if (!active) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutsideRef.current();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [active, ref]);
}
