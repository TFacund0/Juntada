import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

interface EndScreenProps {
  // Plain text — a player name, never markup.
  winnerName: string;
  // This device's player won (online); local always shows the winner's name.
  isMe: boolean;
  sub: string;
  // The mode's actions (local: play again; online: back to the room).
  children: ReactNode;
}

// Shells (live/blank colors) raining down behind the panel — positions and
// timings spread by index so it never looks like one block falling. These
// are per-element values fed to the animation as CSS variables: Tailwind
// can't generate classes for them, so they're the one inline style here.
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  kind: i % 3 === 0 ? "blank" : "live",
  style: {
    "--x": `${(i * 53) % 100}%`,
    "--d": `${(i * 170) % 1400}ms`,
    "--r": `${((i * 97) % 720) - 360}deg`,
    "--t": `${2.4 + ((i * 37) % 14) / 10}s`,
  } as CSSProperties,
}));

// The end of the duel: a golden flash, light rays turning behind the
// panel and shells raining like confetti, a trophy bouncing in, and the
// verdict slamming down with a gold glow. Focus lands on the first action,
// like the reference. Layout and type are Tailwind; the rays, the shells and
// the motion live in finale.css.
export function EndScreen({ winnerName, isMe, sub, children }: EndScreenProps) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.querySelector("button")?.focus();
  }, []);
  const label = isMe ? "Ganaste" : `Ganó ${winnerName}`;

  return (
    <div className="rec-overlay winner-overlay">
      <div className="end-rays" aria-hidden="true" />
      <div className="end-confetti pointer-events-none absolute inset-0" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <i key={i} className={c.kind} style={c.style} />
        ))}
      </div>
      <div
        ref={panel}
        className="end-panel relative max-w-[360px] rounded-xl border border-rec-gold bg-rec-bg-raised px-6 pt-[26px] pb-6 text-center shadow-[0_0_50px_-6px_rgba(255,215,90,0.7),inset_0_0_18px_2px_rgba(255,231,150,0.2),0_20px_50px_rgba(0,0,0,0.55)]"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <p className="mt-0 mb-2 text-[0.72rem] tracking-[0.18em] text-rec-ink-faint uppercase">Fin del duelo</p>
        <span className="end-trophy block text-[3.6rem] leading-none drop-shadow-[0_0_18px_rgba(255,215,90,0.8)]" aria-hidden="true">
          🏆
        </span>
        <h1 className="end-title display mt-2.5 mb-0 text-[clamp(2.8rem,13vw,3.8rem)] leading-none text-rec-gold [text-shadow:0_0_22px_rgba(255,215,90,0.7),0_3px_0_#6b4f12]">
          {isMe ? "¡Ganaste!" : "Ganó"}
        </h1>
        {!isMe && <p className="end-winner display mt-0.5 mb-0 text-[clamp(1.8rem,8vw,2.4rem)] leading-[1.1] text-rec-ink">{winnerName}</p>}
        <p className="end-sub mt-3 mb-5 leading-[1.55] text-rec-ink-dim">{sub}</p>
        {children}
      </div>
    </div>
  );
}
