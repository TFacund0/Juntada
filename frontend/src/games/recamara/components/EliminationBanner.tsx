import { useBannerDismiss } from "../hooks/bannerDismiss";
import { ELIMINATION_AUTO_MS } from "../utils/timing";

interface EliminationBannerProps {
  // Plain text — a player name, never markup.
  name: string;
  isMe: boolean;
  // Who shot whom, as the engine phrases it (escaped HTML).
  whoHtml?: string;
  onContinue: () => void;
}

// A live shell that takes someone's last life gets its own moment instead of
// the ordinary result banner: a red flash over the whole screen, a skull
// slamming down, the verdict shaking in, and the name underneath — while
// their card falls off the table (see .seat.eliminated). Moves on like any
// result card, just with a longer beat (ELIMINATION_AUTO_MS).
// Layout and type are Tailwind; the flash and the motion live in finale.css.
export function EliminationBanner({ name, isMe, whoHtml, onContinue }: EliminationBannerProps) {
  const finish = useBannerDismiss(onContinue, ELIMINATION_AUTO_MS);

  return (
    <div
      className="elim-overlay fixed inset-0 z-[var(--jt-z-fullscreen-flash,200)] flex items-center justify-center overflow-hidden p-6"
      role="alert"
    >
      <div className="elim-flash pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="elim-card relative text-center">
        <span className="elim-skull block text-[4.5rem] leading-none drop-shadow-[0_0_24px_rgba(255,60,40,0.8)]" aria-hidden="true">
          💀
        </span>
        <p className="elim-title display mt-2.5 mb-0 text-[clamp(3rem,14vw,4.6rem)] leading-[0.95] text-rec-live-glow [text-shadow:0_0_24px_rgba(255,60,40,0.8),0_4px_0_#5a0d08]">
          {isMe ? "Quedaste afuera" : "Eliminado"}
        </p>
        {!isMe && <p className="elim-name display mt-1.5 mb-0 text-[clamp(1.6rem,7vw,2.2rem)] text-rec-ink">{name}</p>}
        {whoHtml && <p className="elim-who mt-3 mb-0 text-[0.85rem] text-rec-ink-dim" dangerouslySetInnerHTML={{ __html: whoHtml }} />}
        <button type="button" className="result-banner-tap" aria-label="Continuar" onClick={finish}>
          tocá para seguir
        </button>
      </div>
    </div>
  );
}
