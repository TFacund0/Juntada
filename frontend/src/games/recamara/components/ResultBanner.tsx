import { useEffect, useRef } from "react";
import { BANNER_AUTO_MS, BANNER_TAP_GUARD_MS } from "../utils/timing";

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
  onContinue: () => void;
}

// The verdict over the table (the reference's #banner): no modal — the table
// stays visible behind it. Tapping anywhere or pressing a key moves on
// (after a short guard, so the tap that fired the shot doesn't also skip its
// result), and it moves on by itself after BANNER_AUTO_MS. Every path goes
// through the same once-only finish: a tap on the button would otherwise
// count twice (pointerdown, then click) and skip the next queued event.
export function ResultBanner({ tone, big, sub, subHtml, whoHtml, onContinue }: ResultBannerProps) {
  const latest = useRef(onContinue);
  useEffect(() => {
    latest.current = onContinue;
  });
  const done = useRef(false);
  const finish = useRef(() => {
    if (done.current) return;
    done.current = true;
    latest.current();
  }).current;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") finish();
    };
    const guard = setTimeout(() => {
      window.addEventListener("pointerdown", finish);
      window.addEventListener("keydown", onKey);
    }, BANNER_TAP_GUARD_MS);
    const auto = setTimeout(finish, BANNER_AUTO_MS);
    return () => {
      clearTimeout(guard);
      clearTimeout(auto);
      window.removeEventListener("pointerdown", finish);
      window.removeEventListener("keydown", onKey);
    };
  }, [finish]);

  return (
    <div className={`result-banner ${tone}`} role="status" aria-live="assertive">
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
