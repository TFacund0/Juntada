import { useEffect, useState } from "react";
import { ROUND_ANNOUNCE_MS, ROUND_END_MS } from "../timing";

// Beat 1 of "reveal" — shown identically by both LocalGame and RoundView
// before it moves on by itself into the chests. When `previousRoundNumber`
// is given (every reload except the game's very first round), it first
// closes out that round with a "Ronda N terminada" line, then crossfades
// (opacity only, no unmount in between) into "Ronda N+1" — so a reload
// reads as one continuous beat instead of an abrupt cut straight to the
// next round's number.
export function RoundAnnounce({
  roundNumber,
  previousRoundNumber,
  onDone,
}: {
  roundNumber: number;
  previousRoundNumber?: number;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<"ended" | "next">(previousRoundNumber != null ? "ended" : "next");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (stage !== "ended") return;
    // Fade the "terminada" line out, then swap the text in while invisible,
    // then fade the new round number in — never both readable at once.
    const fadeOut = setTimeout(() => setVisible(false), ROUND_END_MS);
    const swap = setTimeout(() => {
      setStage("next");
      setVisible(true);
    }, ROUND_END_MS + 250);
    return () => {
      clearTimeout(fadeOut);
      clearTimeout(swap);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== "next") return;
    const t = setTimeout(onDone, ROUND_ANNOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  return (
    <div className="recamara">
      <div className="table round-intro">
        <div className={`round-intro-fade${visible ? " visible" : ""}`}>
          {stage === "ended" ? (
            <>
              <p className="round-intro-eyebrow mono">Ronda {previousRoundNumber}</p>
              <p className="round-intro-number display">Terminada</p>
            </>
          ) : (
            <>
              <p className="round-intro-eyebrow mono">Ronda</p>
              <p className="round-intro-number display">{roundNumber}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
