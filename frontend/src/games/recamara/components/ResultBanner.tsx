import { useBannerDismiss } from "../hooks/bannerDismiss";
import { BANNER_AUTO_MS } from "../utils/timing";

interface ResultBannerProps {
  tone: "live" | "blank";
  big: string;
  // Exactly one of these: plain text (shots — built from player names, so it
  // must never be treated as markup), or the engine's describeItemResult
  // HTML (items), which escapes names itself.
  sub?: string;
  subHtml?: string;
  // Who shot whom / who used what, as the engine phrases it (escaped HTML).
  whoHtml?: string;
  // Items: a smaller headline — their titles and descriptions run longer
  // than a shot's one-word REAL/FALSA.
  compact?: boolean;
  onContinue: () => void;
}

// The verdict over the table (the reference's #banner): no modal — the table
// stays visible behind it. Moves on with a tap/key or by itself after
// BANNER_AUTO_MS (see useBannerDismiss).
export function ResultBanner({ tone, big, sub, subHtml, whoHtml, compact = false, onContinue }: ResultBannerProps) {
  const finish = useBannerDismiss(onContinue, BANNER_AUTO_MS);

  return (
    <div className={`result-banner ${tone}${compact ? " compact" : ""}`} role="status" aria-live="assertive">
      {whoHtml && <p className="result-banner-who" dangerouslySetInnerHTML={{ __html: whoHtml }} />}
      <p className={`result-banner-big display ${tone}`}>{big}</p>
      {subHtml != null ? (
        <p className="result-banner-sub" dangerouslySetInnerHTML={{ __html: subHtml }} />
      ) : (
        <p className="result-banner-sub">{sub}</p>
      )}
      <button type="button" className="result-banner-tap" aria-label="Continuar" onClick={finish}>
        tocá para seguir
      </button>
    </div>
  );
}
