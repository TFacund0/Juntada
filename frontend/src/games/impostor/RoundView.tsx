import { useState, useEffect, useRef } from "react";
import { useRevealCountdown } from "../../components/RevealCountdown";
import { RoundPhaseScreen } from "./components/RoundPhaseScreen";
import { DiscussionPhaseScreen } from "./components/DiscussionPhaseScreen";
import { VotingPhaseScreen } from "./components/VotingPhaseScreen";
import { ResultPhaseScreen } from "./components/ResultPhaseScreen";
import type { RoundViewProps } from "../gameTypes";
import type { ImpostorRoundState, ImpostorConfigState } from "./types/roundView";

// Covers this game's in-progress phases (round/discussion/voting/result)
// inside a multiplayer room. The generic shell (MultiplayerGame.jsx) only
// knows to render this while room.phase is one of those — everything about
// what those phases *mean* for Impostor lives here (or in the per-phase
// screen it dispatches to, under components/).
export function RoundView({ room, me, myPlayer, myRole, wordReveal, isHost, send }: RoundViewProps) {
  const [wordVisible, setWordVisible] = useState(false);
  const [clueText, setClueText] = useState("");
  const [clueSubmitted, setClueSubmitted] = useState(false);
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null);
  const [voteConfirmed, setVoteConfirmed] = useState(false);
  const [wordChangeCount, setWordChangeCount] = useState(0);
  const prevRerollCount = useRef<number | null>(null);
  const [restartBannerCount, setRestartBannerCount] = useState(0);
  // "unset" is a sentinel outside restartedReason's actual value space
  // ("word_pool_exhausted" | undefined) so the very first render (joining or
  // reconnecting into an already-restarted match) never counts as a change —
  // same first-render guard as prevRerollCount above, just spelled out
  // explicitly since undefined itself is one of the real values here.
  const prevRestartedReason = useRef<string | undefined | "unset">("unset");
  const revealCount = useRevealCountdown(room.roundHistory?.length ?? 0);
  // Gates the result screen behind two sequential overlays (who got
  // eliminated, then — only once the match is over — who won/the word),
  // same as LocalGame's own reveal flow. Resets alongside the reveal
  // countdown above so each new round's result replays it, same idea as
  // useRevealCountdown's own resetKey trick.
  const [revealStep, setRevealStep] = useState<"elimination" | "outcome" | "done">("elimination");
  const [prevRevealResetKey, setPrevRevealResetKey] = useState(room.roundHistory?.length ?? 0);
  if (prevRevealResetKey !== (room.roundHistory?.length ?? 0)) {
    setPrevRevealResetKey(room.roundHistory?.length ?? 0);
    setRevealStep("elimination");
  }

  const round = room.round as ImpostorRoundState | null;
  const config = room.config as unknown as ImpostorConfigState;

  // A fresh private_role arrives on round start AND on a word reroll — either
  // way it's a new word, so re-hide it and clear per-round local UI state.
  useEffect(() => {
    setWordVisible(false);
    setClueText("");
    setClueSubmitted(false);
    setSelectedSuspect(null);
    setVoteConfirmed(false);
  }, [myRole]);

  // round.rerollCount only bumps when skip_word actually swaps the word —
  // show a short "cambiando de palabra" transition instead of the new word
  // just appearing instantly. Skipped on the very first render (joining an
  // in-progress round shouldn't play the transition for old history).
  useEffect(() => {
    const current = round?.rerollCount ?? 0;
    if (prevRerollCount.current !== null && current !== prevRerollCount.current) {
      setWordChangeCount(2);
    }
    prevRerollCount.current = current;
  }, [round?.rerollCount]);

  useEffect(() => {
    if (wordChangeCount <= 0) return;
    const t = setTimeout(() => setWordChangeCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [wordChangeCount]);

  // Someone's "pedir otra palabra" can, rarely, run out of unused words in
  // the category entirely — rerollWord then falls back to a whole new match
  // (new category, new impostors, eliminations cleared). That's a much
  // bigger change than a normal reroll, so it gets its own explicit banner
  // instead of just quietly landing everyone back on "round" with a
  // different word and no explanation. Skipped on the very first render
  // (joining/reconnecting into an already-restarted match shouldn't replay
  // this for old history) — same guard as prevRerollCount above.
  useEffect(() => {
    const current = round?.restartedReason;
    if (prevRestartedReason.current !== "unset" && current === "word_pool_exhausted" && current !== prevRestartedReason.current) {
      setRestartBannerCount(3);
    }
    prevRestartedReason.current = current;
  }, [round?.restartedReason]);

  useEffect(() => {
    if (restartBannerCount <= 0) return;
    const t = setTimeout(() => setRestartBannerCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [restartBannerCount]);

  // A tie triggers a fresh vote among just the tied suspects — clear the
  // previous selection/confirmation so nobody's stuck showing a stale vote.
  useEffect(() => {
    setSelectedSuspect(null);
    setVoteConfirmed(false);
  }, [round?.revoteCount]);

  if (room.phase === "round") {
    return (
      <RoundPhaseScreen
        room={room}
        me={me}
        myRole={myRole}
        send={send}
        round={round}
        config={config}
        wordVisible={wordVisible}
        setWordVisible={setWordVisible}
        clueText={clueText}
        setClueText={setClueText}
        clueSubmitted={clueSubmitted}
        setClueSubmitted={setClueSubmitted}
        wordChangeCount={wordChangeCount}
        restartBannerCount={restartBannerCount}
      />
    );
  }

  if (room.phase === "discussion") {
    return <DiscussionPhaseScreen room={room} myPlayer={myPlayer} send={send} round={round} config={config} />;
  }

  if (room.phase === "voting") {
    return (
      <VotingPhaseScreen
        room={room}
        me={me}
        send={send}
        round={round}
        selectedSuspect={selectedSuspect}
        setSelectedSuspect={setSelectedSuspect}
        voteConfirmed={voteConfirmed}
        setVoteConfirmed={setVoteConfirmed}
      />
    );
  }

  if (room.phase === "result") {
    return (
      <ResultPhaseScreen
        room={room}
        wordReveal={wordReveal}
        isHost={isHost}
        send={send}
        round={round}
        revealCount={revealCount}
        revealStep={revealStep}
        setRevealStep={setRevealStep}
      />
    );
  }

  return null;
}
