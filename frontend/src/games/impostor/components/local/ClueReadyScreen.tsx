import { useState, type CSSProperties } from "react";
import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";
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
      <div className="impostor-clue-ready-scene flex min-h-[calc(100dvh-140px)] flex-col">
        <style>
          {sharedStyle}
          {staggerPopStyle}
          {actionBtnStyle}
        </style>
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          <p className={clsx(T.muted, "mb-4 text-center")}>Carta de {reviewPlayer.name}</p>
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
      <div className="impostor-clue-ready-scene flex min-h-[calc(100dvh-140px)] flex-col">
        <style>
          {sharedStyle}
          {staggerPopStyle}
          {actionBtnStyle}
        </style>
        <p className={clsx(T.muted, "m-0 mb-4 text-center")}>¿Quién necesita ver su carta de nuevo?</p>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {alive.map((p, i) => (
            <button
              key={p.id}
              onClick={() => {
                setPickingReview(false);
                setReviewPlayerId(p.id);
              }}
              className={clsx(
                "impostor-clue-ready-pick-btn impostor-stagger-pop mb-0 flex w-full cursor-pointer items-center gap-2.5 border border-[var(--jt-card-border,rgba(127,119,221,0.18))] text-left font-[inherit] text-[#e8e4f0]",
                T.card,
              )}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <Avatar name={p.name} size={32} />
              <span className="text-sm font-bold text-[#e8e4f0]">{p.name}</span>
            </button>
          ))}
        </div>
        <Btn variant="ghost" onClick={() => setPickingReview(false)} className="mt-2.5">
          Cancelar
        </Btn>
      </div>
    );
  }

  return (
    <div className="impostor-clue-ready-scene flex min-h-[calc(100dvh-140px)] flex-col">
      <style>
        {sharedStyle}
        {staggerPopStyle}
        {actionBtnStyle}
      </style>

      <div>
        <p className="m-0 mb-1.5 text-center text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--jt-accent,#e0202b)]">
          Ronda {matchRound}
        </p>
        <h2 className="m-0 mb-2.5 text-center text-[26px] font-extrabold tracking-[-0.02em]">A dar sus pistas</h2>
        <p className={clsx(T.muted, "mx-auto mb-6 mt-0 max-w-[300px] text-center leading-[1.5]")}>
          Cada uno debe dar una pista sobre la palabra secreta. Después arranca la votación para descubrir al impostor.
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <div className="mt-7 grid grid-cols-3 gap-2.5">
          {alive.map((p, i) => (
            <div
              key={p.id}
              className={clsx("impostor-clue-ready-card impostor-stagger-pop mb-0 flex flex-col items-center px-2 py-4", T.card)}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <Avatar name={p.name} size={40} />
              <p className="m-0 mt-2 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-xs font-bold">{p.name}</p>
            </div>
          ))}
        </div>
      </div>

      <Btn onClick={onStart} className="impostor-action-btn" style={{ "--impostor-action-glow": "rgba(224,32,43,0.35)" } as CSSProperties}>
        {startLabel}
      </Btn>
      <button
        onClick={() => setPickingReview(true)}
        className="impostor-clue-ready-link cursor-pointer border-none bg-transparent px-0 py-3.5 pb-1 text-[13px] font-bold text-[var(--jt-muted-text)]"
      >
        Olvidé la palabra
      </button>
    </div>
  );
}
