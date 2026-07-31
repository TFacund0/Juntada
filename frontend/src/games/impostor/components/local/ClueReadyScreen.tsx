import { useState, type CSSProperties } from "react";
import { S } from "../../../../theme/styles";
import { wordHint } from "@juntada/impostor-data";
import { Btn } from "../../../../components/ui/Btn";
import { Avatar } from "../../../../components/ui/Avatar";
import { FlipRevealCard } from "../shared/FlipRevealCard";
import { staggerPopStyle } from "../shared/staggerPopStyle";
import { actionBtnStyle } from "../shared/actionBtnStyle";
import type { LocalPlayer, Round } from "../../types/localGame";

interface ClueReadyScreenProps {
  round: Round;
  players: LocalPlayer[];
  config: { hintsEnabled: boolean; showCategory: boolean; discussionUnlimited: boolean; discussionTime: number };
  matchRound: number;
  onStart: () => void;
}

// The spoken-clues equivalent of ClueEntryScreen: everyone already saw their
// card in reveal, and there's nothing to type — this is just the "get
// ready, here's who's in this lap" beat before passing the device around
// out loud, with the whole roster visible at once (unlike the turn-by-turn
// writing flow, which only shows one player at a time). "Olvidé la palabra"
// lets anyone re-check their own card without derailing the group back
// through the whole reveal phase.
export function ClueReadyScreen({ round, players, config, matchRound, onStart }: ClueReadyScreenProps) {
  const alive = round.voters.map(id => players.find(p => p.id === id)).filter((p): p is LocalPlayer => Boolean(p));
  const [pickingReview, setPickingReview] = useState(false);
  const [reviewPlayerId, setReviewPlayerId] = useState<number | null>(null);
  const [reviewWordVisible, setReviewWordVisible] = useState(false);

  const reviewPlayer = alive.find(p => p.id === reviewPlayerId) ?? null;
  const reviewIsImpostor = reviewPlayer ? round.impostors.includes(reviewPlayer.id) : false;
  const reviewHint = config.hintsEnabled ? wordHint(round.categoryKey, round.word) : null;
  // Mirrors goToDiscussion's own logic (LocalGame) — if there's no
  // discussion phase to go through, this button skips straight to voting,
  // so its label should say what's actually about to happen.
  const hasDiscussion = config.discussionUnlimited || config.discussionTime > 0;
  const startLabel = hasDiscussion ? "Empezar discusión" : "Empezar votación";

  const closeReview = () => {
    setReviewPlayerId(null);
    setReviewWordVisible(false);
  };

  const sharedStyle = `
    .impostor-clue-ready-link {
      transition: color 0.15s ease-out, transform 0.15s ease-out;
    }
    .impostor-clue-ready-link:hover {
      color: #fff;
      transform: translateY(-1px);
    }
    .impostor-clue-ready-link:active {
      transform: scale(0.95);
    }
    .impostor-clue-ready-pick-btn {
      transition: transform 0.15s ease-out, filter 0.15s ease-out, box-shadow 0.2s ease-out, border-color 0.2s ease-out;
    }
    .impostor-clue-ready-pick-btn:hover {
      transform: translateY(-2px) scale(1.01);
      filter: brightness(1.2);
      border-color: var(--jt-accent, #e0202b);
      box-shadow: 0 6px 18px rgba(224,32,43,0.2);
    }
    .impostor-clue-ready-pick-btn:active {
      transform: scale(0.97);
      filter: brightness(1.05);
    }
    .impostor-clue-ready-scene {
      animation: impostor-clue-ready-scene-in 0.28s ease-out both;
    }
    @keyframes impostor-clue-ready-scene-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;

  // "Olvidé la palabra": someone taps who they are, sees their own card
  // again (tap-to-reveal, same privacy gate as the original reveal), then
  // comes straight back to this same roster screen.
  if (reviewPlayer) {
    return (
      <div className="impostor-clue-ready-scene" style={{ minHeight: "calc(100dvh - 140px)", display: "flex", flexDirection: "column" }}>
        <style>
          {sharedStyle}
          {staggerPopStyle}
          {actionBtnStyle}
        </style>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 0 }}>
          <p style={{ ...S.muted, textAlign: "center", marginBottom: 16 }}>Carta de {reviewPlayer.name}</p>
          <FlipRevealCard
            visible={reviewWordVisible}
            onToggle={() => setReviewWordVisible(v => !v)}
            isImpostor={reviewIsImpostor}
            word={round.word}
            hint={reviewHint}
            categoryLabel={round.categoryLabel}
            showCategory={config.showCategory}
            minHeight={220}
          />
        </div>
        <Btn
          onClick={closeReview}
          className="impostor-action-btn"
          style={{ "--impostor-action-glow": "rgba(224,32,43,0.35)" } as CSSProperties}
        >
          Listo, volver
        </Btn>
      </div>
    );
  }

  // Player picker for "Olvidé la palabra".
  if (pickingReview) {
    return (
      <div className="impostor-clue-ready-scene" style={{ minHeight: "calc(100dvh - 140px)", display: "flex", flexDirection: "column" }}>
        <style>
          {sharedStyle}
          {staggerPopStyle}
          {actionBtnStyle}
        </style>
        <p style={{ ...S.muted, textAlign: "center", margin: "0 0 16px" }}>¿Quién necesita ver su carta de nuevo?</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, overflowY: "auto", minHeight: 0 }}>
          {alive.map((p, i) => (
            <button
              key={p.id}
              onClick={() => {
                setPickingReview(false);
                setReviewPlayerId(p.id);
              }}
              className="impostor-clue-ready-pick-btn impostor-stagger-pop"
              style={{
                ...S.card,
                marginBottom: 0,
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                border: "1px solid var(--jt-card-border, rgba(127,119,221,0.18))",
                color: "#e8e4f0",
                font: "inherit",
                animationDelay: `${i * 0.04}s`,
              }}
            >
              <Avatar name={p.name} size={32} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "#e8e4f0" }}>{p.name}</span>
            </button>
          ))}
        </div>
        <Btn variant="ghost" onClick={() => setPickingReview(false)} style={{ marginTop: 10 }}>
          Cancelar
        </Btn>
      </div>
    );
  }

  return (
    <div className="impostor-clue-ready-scene" style={{ minHeight: "calc(100dvh - 140px)", display: "flex", flexDirection: "column" }}>
      <style>
        {sharedStyle}
        {staggerPopStyle}
        {actionBtnStyle}
      </style>

      <div>
        <p
          style={{
            textAlign: "center",
            margin: "0 0 6px",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--jt-accent, #e0202b)",
          }}
        >
          Ronda {matchRound}
        </p>
        <h2 style={{ textAlign: "center", margin: "0 0 10px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
          A dar sus pistas
        </h2>
        <p style={{ ...S.muted, textAlign: "center", margin: "0 auto 24px", lineHeight: 1.5, maxWidth: 300 }}>
          Cada uno debe dar una pista sobre la palabra secreta. Después arranca la votación para descubrir al impostor.
        </p>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 28 }}>
          {alive.map((p, i) => (
            <div
              key={p.id}
              className="impostor-clue-ready-card impostor-stagger-pop"
              style={{
                ...S.card,
                marginBottom: 0,
                padding: "16px 8px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                animationDelay: `${i * 0.04}s`,
              }}
            >
              <Avatar name={p.name} size={40} />
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                }}
              >
                {p.name}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Btn onClick={onStart} className="impostor-action-btn" style={{ "--impostor-action-glow": "rgba(224,32,43,0.35)" } as CSSProperties}>
        {startLabel}
      </Btn>
      <button
        onClick={() => setPickingReview(true)}
        className="impostor-clue-ready-link"
        style={{
          background: "none",
          border: "none",
          color: "var(--jt-muted-text)",
          fontSize: 13,
          fontWeight: 700,
          padding: "14px 0 4px",
          cursor: "pointer",
        }}
      >
        Olvidé la palabra
      </button>
    </div>
  );
}
