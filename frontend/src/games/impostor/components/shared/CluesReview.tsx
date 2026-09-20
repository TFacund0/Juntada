import { T } from "../../../../theme/styles/classes";

interface CluesReviewProps {
  clues: Record<string, string> | undefined;
  players: { id: string | number; name: string }[];
  // LocalGame's players give their word out loud by default (clues are only
  // ever written when "Pistas escritas" is on, so the label there is "Pistas"
  // to match that framing) — online always writes them, so it reads as
  // "Palabras" instead. Defaults to the online wording.
  label?: string;
  // Caps just the entries list, not the card itself — a roster with lots of
  // players writing long clues would otherwise stretch the card to fill the
  // screen instead of scrolling. The label stays fixed above the scroll.
  maxHeight?: number;
}

// Shared between LocalGame and RoundView — same list of "who wrote what"
// once at least one clue's been submitted, just with a different label and
// player id type (local's are numeric, online's are string room-player ids).
export function CluesReview({ clues, players, label = "Palabras", maxHeight }: CluesReviewProps) {
  const entries = Object.entries(clues || {}).filter(([, clue]) => clue);
  if (entries.length === 0) return null;
  const list = entries.map(([playerId, clue]) => {
    const p = players.find(x => String(x.id) === playerId);
    if (!p) return null;
    return (
      <p key={playerId} className="text-sm my-1 text-[var(--jt-muted-text)]">
        <strong className="text-[#FF8A8A]">{p.name}:</strong> {clue}
      </p>
    );
  });
  return (
    <div className={T.card}>
      <span className={T.label}>{label}</span>
      {maxHeight ? (
        <div className="impostor-clues-review-scroll overflow-y-auto" style={{ maxHeight }}>
          {list}
        </div>
      ) : (
        list
      )}
      {maxHeight && (
        <style>{`
          .impostor-clues-review-scroll {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .impostor-clues-review-scroll::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      )}
    </div>
  );
}
