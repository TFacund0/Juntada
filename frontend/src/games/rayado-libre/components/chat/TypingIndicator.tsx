import { typingLabel } from "../../utils/turnText";
import { TypingDots } from "../TypingDots";

/** "Tomi está escribiendo…" con puntitos, entre el chat y el input. Siempre ocupa su alto, así el chat no salta al aparecer. */
export function TypingIndicator({ names }: { names: readonly string[] }) {
  return (
    <div aria-live="polite" className="flex h-[22px] flex-none items-center gap-1.5 px-3 text-xs text-rl-muted">
      {names.length > 0 && (
        <>
          <TypingDots />
          <span className="truncate">{typingLabel(names)}</span>
        </>
      )}
    </div>
  );
}
