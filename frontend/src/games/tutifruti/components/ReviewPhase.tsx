import { useMemo } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Btn } from "../../../components/ui/Btn";
import { StickyActionBar, STICKY_ACTION_BAR_CLEARANCE } from "../../../components/setup/StickyActionBar";
import { shuffle } from "@juntada/core-utils";
import { startsWithLetter } from "@juntada/tutifruti-words";
import type { RoundViewProps } from "../../gameTypes";
import type { TutifrutiRoundState } from "../types/roundView";
import { RoundBadge } from "./RoundBadge";
import { useCountdown } from "../hooks/useCountdown";
import { LetterReveal } from "./LetterReveal";
import { TimerBadge } from "./TimerBadge";

// ── REVIEW: mark everyone's answers valid/invalid, grouped by category —
// anonymous by default (just the word and the votes on it), or with the
// author's name shown next to each word when the host turns on
// config.showAuthor (see ConfigPanel's "Autor de cada palabra" toggle).
// Everyone (including the word's own author) can vote on any word, and every
// player has to confirm before the round's scores get tallied.
export function ReviewPhase({ room, me, send }: Pick<RoundViewProps, "room" | "me" | "send">) {
  const round = room.round as TutifrutiRoundState;
  const answers = round.answers!;
  const marks = round.marks!;
  const showAuthor = !!(room.config as { showAuthor?: boolean }).showAuthor;
  const nameById = new Map(room.players.map(p => [p.id, p.name]));
  const online = room.players.filter(p => p.online);
  const confirmedCount = online.filter(p => round.reviewConfirmed?.[p.id]).length;
  const iConfirmed = !!me && !!round.reviewConfirmed?.[me.playerId];
  const timeLeft = useCountdown(round.reviewEnd ?? null);

  // Always listing answers in room.players order would let anyone learn,
  // round after round, "position 2 is always Fulano" — recomputed only when
  // a new round actually starts (roundNumber changes), not on every
  // re-render from an incoming vote, so it stays stable for the whole review.
  const shuffledPlayerIds = useMemo(() => shuffle(room.players.map(p => p.id)), [round.roundNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // A word nobody votes on defaults to valid (see engine.ts's finishRound) —
  // a group that reviews quickly without touching every row would otherwise
  // never realize some clearly-wrong answers are about to auto-score,
  // unaware anything was skipped.
  let unvotedCount = 0;
  round.categories.forEach(cat => {
    room.players.forEach(p => {
      const word = (answers[p.id] || {})[cat.id];
      if (!word || !word.trim()) return;
      const marksForWord = (marks[p.id] || {})[cat.id] || {};
      if (Object.keys(marksForWord).length === 0) unvotedCount++;
    });
  });

  return (
    <div style={{ paddingBottom: STICKY_ACTION_BAR_CLEARANCE }}>
      <RoundBadge round={round} />
      <LetterReveal letter={round.letter} label="Letra" size="sm" />
      {timeLeft != null && <TimerBadge label="Tiempo para revisar" timeLeft={timeLeft} />}
      <div className="tf-review-grid tf-stagger">
        {round.categories.map(cat => {
          const entries = shuffledPlayerIds
            .map(playerId => ({ playerId, word: (answers[playerId] || {})[cat.id] }))
            // A whitespace-only "answer" (e.g. a stray space bar tap) is
            // truthy as a string but scores as blank once trimmed at result
            // time — filtering it out here too avoids showing reviewers a
            // vote-able row for something that was never really an answer.
            .filter(e => e.word && e.word.trim());
          if (entries.length === 0) return null;
          return (
            <div key={cat.id} className={T.card}>
              <span className={T.label}>
                {cat.icon ? `${cat.icon} ` : ""}
                {cat.label}
              </span>
              {entries.map(({ playerId, word }) => {
                const marksForWord = (marks[playerId] || {})[cat.id] || {};
                const voteValues = Object.values(marksForWord);
                const ticks = voteValues.filter(v => v === true).length;
                const crosses = voteValues.filter(v => v === false).length;
                const wrongLetter = !startsWithLetter(word, round.letter);
                // Half or more of the votes marking it invalid rejects the word live,
                // same rule the backend applies once the round is tallied.
                const rejectedByVotes = ticks + crosses > 0 && crosses >= ticks;
                const struckOut = wrongLetter || rejectedByVotes;
                return (
                  <div key={playerId} className="flex flex-wrap items-center gap-2.5 border-b border-[rgba(127,119,221,0.08)] py-2">
                    {/* The word always takes the full row on its own — on a
                      narrow phone, a long word plus a tally column plus two
                      36px buttons all fighting for one row left almost no
                      breathing room, so the tally+buttons group wraps to its
                      own line below instead. */}
                    <div className="min-w-0 flex-[1_1_100%]">
                      <p
                        className={clsx(
                          "m-0 break-words text-[15px] font-semibold [overflow-wrap:anywhere]",
                          struckOut && "text-[#F09595] line-through",
                        )}
                      >
                        {word}
                      </p>
                      {showAuthor && <p className="m-0 mt-0.5 text-xs text-[#9089c0]">{nameById.get(playerId) ?? "?"}</p>}
                    </div>
                    <div className="flex flex-[1_1_auto] items-center justify-end gap-2.5">
                      <div className="flex flex-wrap justify-end gap-0.5">
                        {Object.values(marksForWord).map((valid, i) => (
                          <span key={i} className={clsx("text-[11px]", valid ? "text-[#5DCAA5]" : "text-[#F09595]")}>
                            {valid ? "✓" : "✗"}
                          </span>
                        ))}
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => send({ type: "mark_word", targetPlayerId: playerId, categoryId: cat.id, valid: true })}
                          disabled={iConfirmed}
                          className={clsx(
                            T.btn(me && marksForWord[me.playerId] === true ? "success" : "ghost", iConfirmed),
                            "h-9 w-9 rounded-lg p-0 text-base",
                          )}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => send({ type: "mark_word", targetPlayerId: playerId, categoryId: cat.id, valid: false })}
                          disabled={iConfirmed}
                          className={clsx(
                            T.btn(me && marksForWord[me.playerId] === false ? "danger" : "ghost", iConfirmed),
                            "h-9 w-9 rounded-lg p-0 text-base",
                          )}
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {!iConfirmed && unvotedCount > 0 && (
        <p className="mb-2 text-center text-xs text-[var(--jt-warn-text,#E2C44A)]">
          {unvotedCount} respuesta{unvotedCount === 1 ? "" : "s"} sin ningún voto todavía — sin votos cuentan como válidas.
        </p>
      )}
      <StickyActionBar>
        {iConfirmed ? (
          <div className={clsx(T.card, "text-center")}>
            <p className="m-0 text-[#5DCAA5]">
              Confirmaste los puntajes — esperando a los demás ({confirmedCount}/{online.length})
            </p>
          </div>
        ) : (
          <Btn variant="success" onClick={() => send({ type: "confirm_review" })}>
            Confirmar puntajes ({confirmedCount}/{online.length})
          </Btn>
        )}
      </StickyActionBar>
    </div>
  );
}
