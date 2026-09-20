import { createPortal } from "react-dom";

interface BigTextFlashProps {
  eyebrow?: string;
  text: string;
}

// A brief, fully opaque full-screen flash — solid background (not a
// translucent modal) so nothing behind it bleeds through, and the group's
// attention lands squarely on this beat instead of a screen just cutting to
// the next one. Shared across games for their own "big letters" transition
// moments — same shell, each caller just supplies its own copy and owns its
// own mount duration.
//
// Rendered via a portal straight into <body>: every caller sits inside
// MultiplayerGame's <ScreenFade>, which applies a `transform` to its wrapper
// div while its own enter animation runs (see screenTransitions.css). Per
// the CSS spec, that transform makes the wrapper the containing block for
// any `position: fixed` descendant — so without the portal, this flash's
// `inset: 0` briefly resolved against that (contentless, near-zero-height)
// wrapper instead of the viewport, squishing it into a sliver at the top for
// that ~0.3s before snapping to fullscreen once the animation ended. Read as
// the flash "starting at the top and suddenly dropping/expanding" instead of
// the intended instant fullscreen cover.
export function BigTextFlash({ eyebrow, text }: BigTextFlashProps) {
  return createPortal(
    <div className="fixed inset-0 z-[var(--jt-z-fullscreen-flash,200)] flex items-center justify-center bg-[#0a0a0a]">
      <style>{`
        .jt-big-text-flash {
          text-align: center;
          animation: jt-big-text-flash 1.4s ease-in-out both;
        }
        @keyframes jt-big-text-flash {
          0% { opacity: 0; transform: scale(0.85); }
          20% { opacity: 1; transform: scale(1.06); }
          80% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.08); }
        }
      `}</style>
      <div className="jt-big-text-flash">
        {eyebrow && (
          <p className="m-0 mb-2.5 text-[13px] font-extrabold uppercase tracking-[0.14em] text-[var(--jt-accent,#e0202b)]">{eyebrow}</p>
        )}
        <p className="m-0 text-[clamp(1.6rem,8vw,2.6rem)] font-extrabold tracking-[-0.02em] text-white">{text}</p>
      </div>
    </div>,
    document.body,
  );
}
