import { useEffect, useRef } from "react";
import clsx from "clsx";
import { usePrefersReducedMotion } from "../../../../components/game-kit/hooks/usePrefersReducedMotion";

// Igual que las palabras propias del anfitrión (ver CustomWordsEditor).
const MAX_GUESS_LENGTH = 30;

interface GuessFormProps {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  /** Ya adiviné: input verde y bloqueado, sin botón. */
  done: boolean;
  /** La palabra, una vez adivinada (puede tardar un instante en llegar, ver PrivateChatView). */
  doneWord?: string;
  /** Sube con cada intento "cerca": el input tiembla. */
  closeShake: number;
}

/** Input de respuestas fijo al pie del panel (`enterkeyhint="send"`). */
export function GuessForm({ value, onChange, onSubmit, done, doneWord, closeShake }: GuessFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const input = inputRef.current;
    if (closeShake === 0 || reduced || !input || typeof input.animate !== "function") return;
    input.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(5px)" }, { transform: "none" }],
      { duration: 260 },
    );
  }, [closeShake, reduced]);

  const placeholder = !done
    ? "Escribí lo que ves…"
    : doneWord
      ? `¡Era ${doneWord.toUpperCase()}! Esperá al resto…`
      : "¡Adivinaste! Esperá al resto…";

  return (
    <form
      autoComplete="off"
      className="flex flex-none gap-2 border-t border-rl-card-border px-2.5 pb-2.5 pt-2"
      onSubmit={e => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <input
        ref={inputRef}
        aria-label="Tu respuesta"
        enterKeyHint="send"
        maxLength={MAX_GUESS_LENGTH}
        placeholder={placeholder}
        disabled={done}
        value={done ? "" : value}
        onChange={e => onChange(e.target.value)}
        className={clsx(
          "min-w-0 flex-1 rounded-xl border bg-jt-bg px-[13px] py-[11px] font-figtree text-base font-semibold text-rl-ink placeholder:text-rl-muted",
          done ? "border-rl-ok-line placeholder:text-rl-ok-text" : "border-rl-card-border",
        )}
      />
      {!done && (
        <button
          type="submit"
          className="cursor-pointer rounded-xl border-0 bg-[linear-gradient(135deg,var(--color-rl-accent),#5b52c7)] px-4 font-extrabold text-white"
        >
          Enviar
        </button>
      )}
    </form>
  );
}
