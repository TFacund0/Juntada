import { useState, useEffect, useRef } from "react";
import { CATEGORIES } from "@juntada/impostor-data";
import { maxImpostors, matchWinner } from "@juntada/impostor-match-rules";
import { shuffle } from "@juntada/core-utils";
import { useFlashError } from "../../hooks/useFlashError";
import { SetupScreen } from "./components/local/SetupScreen";
import { IntroScreen } from "./components/local/IntroScreen";
import { RevealScreen } from "./components/local/RevealScreen";
import { ClueEntryScreen } from "./components/local/ClueEntryScreen";
import { ClueReadyScreen } from "./components/local/ClueReadyScreen";
import { DiscussionScreen } from "./components/local/DiscussionScreen";
import { VoteScreen } from "./components/local/VoteScreen";
import { VoteResultsFlash } from "./components/local/VoteResultsFlash";
import { RoundStartFlash } from "./components/shared/RoundStartFlash";
import { ResultScreen } from "./components/local/ResultScreen";
import type { LocalPlayer, Round, Config } from "./types/localGame";

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL GAME MODE — un solo dispositivo, se pasa de mano en mano.
// Las pistas se dicen en voz alta por defecto; "Pistas escritas" en la config
// hace que cada uno la tipee al final de su turno de revelación, para poder
// repasarlas juntos antes de votar. Cada fase (setup/reveal/discussion/
// vote/result) vive en su propio componente bajo components/ — este archivo
// solo decide cuál mostrar y sostiene el estado que se comparte entre fases.
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_REVOTES = 2;

export function LocalGame({
  onExposeBack,
  onExposeReset,
}: {
  onExposeBack?: (fn: () => boolean) => void;
  onExposeReset?: (fn: () => void) => void;
}) {
  const [phase, setPhase] = useState<
    "setup" | "intro" | "roundFlash" | "reveal" | "clues" | "cluesReady" | "discussion" | "vote" | "result"
  >("setup");
  const [players, setPlayers] = useState<LocalPlayer[]>([
    { id: 1, name: "Jugador 1" },
    { id: 2, name: "Jugador 2" },
    { id: 3, name: "Jugador 3" },
    { id: 4, name: "Jugador 4" },
  ]);
  const [wordError, wordErrorKey, setWordError] = useFlashError();
  const [config, setConfig] = useState<Config>({
    numImpostors: 1,
    hintsEnabled: true,
    writtenClues: false,
    discussionTime: 30,
    discussionUnlimited: false,
    revealOnElimination: true,
    showCategory: false,
    // Off by default — you have to actively pick which categories are in
    // play rather than opt out of a preselected set.
    enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {} as Record<string, boolean>),
  });
  const [round, setRound] = useState<Round | null>(null);
  // Gates the result screen behind two sequential overlays: first who got
  // eliminated and their role, then (only once the match itself is over)
  // who won/the word — the group taps "Continuar" through each at their own
  // pace, same idea as Recámara's OutcomeBanner.
  const [revealStep, setRevealStep] = useState<"elimination" | "outcome" | "done">("elimination");
  const [revealIdx, setRevealIdx] = useState(0);
  const [wordVisible, setWordVisible] = useState(false);
  const [clueIdx, setClueIdx] = useState(0);
  const [clueInput, setClueInput] = useState("");
  const [clues, setClues] = useState<Record<number, string>>({});
  // Which lap of clue-giving this is within the current match (1 on a brand-
  // new match, +1 every continueMatch) — keys clueHistory below so a vote
  // that comes back around for another lap doesn't overwrite what got
  // written the first time.
  const [matchRound, setMatchRound] = useState(1);
  const [clueHistory, setClueHistory] = useState<Record<number, Record<number, string>>>({});
  const [selection, setSelection] = useState<Record<number, number>>({}); // voterId -> suspectId not yet confirmed
  const [votes, setVotes] = useState<Record<number, number>>({});
  // True for a beat right after the last vote confirms — holds the vote
  // screen behind a full-screen dark flash (see VoteResultsFlash) instead
  // of cutting straight to the result screen the instant votes resolve.
  const [resultsFlashing, setResultsFlashing] = useState(false);
  const [usedWords, setUsedWords] = useState<Record<string, string[]>>({});
  // Bumped every time a round starts (a fresh match via startRound, or
  // another lap within one via continueMatch) — mirrors the online engine's
  // turnRotation so the same player isn't stuck always going first.
  const [turnRotation, setTurnRotation] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeCats = Object.keys(config.enabledCategories).filter(k => config.enabledCategories[k]);

  // Lets the app's global header "Volver" send an in-progress match back to
  // the players/setup screen instead of exiting local mode entirely — only
  // relevant once past setup, so it reports "not handled" from there and
  // the header falls back to its normal exit-mode confirm. A pure check (no
  // side effect) so App.tsx can confirm with the player *before* anything
  // actually resets — see onExposeReset below for the actual action.
  useEffect(() => {
    onExposeBack?.(() => phase !== "setup");
  }, [onExposeBack, phase]);

  useEffect(() => {
    onExposeReset?.(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase("setup");
    });
  }, [onExposeReset]);

  // A host who sets e.g. 2 impostors then removes players down to where
  // maxImpostors(players.length) is only 1 would otherwise keep seeing "2"
  // selected in the Rules tab even though startRound silently clamps it at
  // draw time — this corrects the config the moment the roster shrinks, so
  // what's shown always matches what would actually happen.
  useEffect(() => {
    const cap = maxImpostors(players.length);
    setConfig(c => (c.numImpostors > cap ? { ...c, numImpostors: cap } : c));
  }, [players.length]);

  // Picks a fresh word from a random active category, marking it used —
  // shared by both a brand-new match and another round within one.
  const drawWord = (): { word: string; catKey: string; catLabel: string } | null => {
    const catKey = activeCats[Math.floor(Math.random() * activeCats.length)];
    const cat = CATEGORIES[catKey];
    const used = usedWords[catKey] || [];
    const available = cat.words.filter((w: string) => !used.includes(w));
    if (!available.length) {
      setWordError(`Sin palabras disponibles en ${cat.label}`);
      return null;
    }
    const word = available[Math.floor(Math.random() * available.length)];
    setUsedWords(prev => ({ ...prev, [catKey]: [...(prev[catKey] || []), word] }));
    return { word, catKey, catLabel: cat.label };
  };

  const beginReveal = () => {
    setRevealIdx(0);
    setWordVisible(false);
    setClueInput("");
    setClues({});
    setSelection({});
    setVotes({});
    setPhase("reveal");
  };

  // Bridges into a fresh round of reveals with the same brief full-screen
  // flash (see RoundStartFlash) whether it's the very first round after the
  // intro screen or another lap via continueMatch — instead of cutting
  // straight to the first card either way.
  const goToReveal = () => {
    setPhase("roundFlash");
    setTimeout(beginReveal, 1300);
  };

  // Once everyone's seen their card, "Pistas escritas" gets its own
  // turn-based phase to actually type them (see ClueEntryScreen) instead of
  // typing inline while still looking at your word/role — otherwise it's
  // the same instant flip from reveal straight to discussion.
  const afterReveal = () => {
    if (config.writtenClues) {
      setClueIdx(0);
      setClueInput("");
      setPhase("clues");
    } else {
      setPhase("cluesReady");
    }
  };

  // Snapshots this lap's words into clueHistory (see matchRound above)
  // before actually moving to discussion, so a later lap's ClueHistoryCard
  // can still show what got written earlier instead of only the latest.
  const finishClueEntry = () => {
    setClueHistory(h => ({ ...h, [matchRound]: clues }));
    goToDiscussion();
  };

  // Rotates a list of ids so the same player isn't always first — offset
  // advances by one every round (see startRound/continueMatch below).
  const rotateIds = (ids: number[]) => {
    if (ids.length === 0) return ids;
    const offset = ((turnRotation % ids.length) + ids.length) % ids.length;
    return [...ids.slice(offset), ...ids.slice(0, offset)];
  };

  // Starts a brand-new match: fresh impostors, empty elimination history.
  const startRound = () => {
    const drawn = drawWord();
    if (!drawn) return;
    const ids = shuffle(players.map(p => p.id));
    const impostors = ids.slice(0, Math.min(config.numImpostors, maxImpostors(players.length)));
    setRound({
      word: drawn.word,
      categoryKey: drawn.catKey,
      categoryLabel: drawn.catLabel,
      impostors,
      matchEliminated: [],
      voters: rotateIds(players.map(p => p.id)),
      matchOver: false,
      winner: null,
      revoteCount: 0,
    });
    setTurnRotation(r => r + 1);
    setMatchRound(1);
    setClueHistory({});
    // A brand-new match gets the "Comienza la partida" intro beat first —
    // it's the group's one chance to hear how the handoff works before the
    // first card shows up. continueMatch (another lap within the same
    // match, below) skips straight to reveal since that's already known.
    setPhase("intro");
  };

  // Starts another round of clue-giving within the same match: a fresh turn
  // among whoever's still alive, but the *same* word/category as before —
  // it's still the same investigation, not a new one, so the word only
  // changes when a genuinely new match starts (see startRound). Same
  // impostors and elimination history carry over too — called after a vote
  // that didn't decide the match yet.
  const continueMatch = () => {
    const prev = round;
    if (!prev) return;
    const alive = players.filter(p => !prev.matchEliminated.includes(p.id)).map(p => p.id);
    setRound({
      word: prev.word,
      categoryKey: prev.categoryKey,
      categoryLabel: prev.categoryLabel,
      impostors: prev.impostors,
      matchEliminated: prev.matchEliminated,
      voters: rotateIds(alive),
      matchOver: false,
      winner: null,
      revoteCount: 0,
    });
    setTurnRotation(r => r + 1);
    setMatchRound(r => r + 1);
    goToReveal();
  };

  const goToDiscussion = () => {
    if (config.discussionUnlimited) {
      setPhase("discussion");
      return;
    }
    if (config.discussionTime <= 0) {
      setPhase("vote");
      return;
    }
    setPhase("discussion");
    setTimeLeft(config.discussionTime);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        // A short buzz as the last few seconds tick down — same reasoning as
        // the pulsing card: a pass-around device isn't necessarily being
        // watched right when time runs out. Feature-detected since vibrate
        // isn't available on iOS Safari/desktop.
        if (t - 1 > 0 && t - 1 <= 5) navigator.vibrate?.(80);
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          navigator.vibrate?.([120, 60, 120]);
          setPhase("vote");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const confirmVote = (voterId: number) => {
    const suspectId = selection[voterId];
    if (!suspectId) return;
    const next = { ...votes, [voterId]: suspectId };
    setVotes(next);
    if (Object.keys(next).length >= round!.voters.length) {
      const tally: Record<number, number> = {};
      round!.voters.forEach(id => {
        tally[id] = 0;
      });
      Object.values(next).forEach(id => {
        tally[id] = (tally[id] || 0) + 1;
      });
      const maxV = Math.max(...Object.values(tally));
      const top = Object.entries(tally)
        .filter(([, v]) => v === maxV)
        .map(([id]) => Number(id));

      // Tie at the top: repeat the vote among just the tied suspects instead
      // of eliminating one at random, up to MAX_REVOTES times — same as the
      // online engine's tallyVotes.
      if (top.length > 1 && maxV > 0 && round!.revoteCount < MAX_REVOTES) {
        setRound({ ...round!, revoteCandidates: top, revoteCount: round!.revoteCount + 1 });
        setSelection({});
        setVotes({});
        return;
      }

      const eliminated = top[Math.floor(Math.random() * top.length)];
      const wasImpostor = round!.impostors.includes(eliminated);
      const matchEliminated = [...round!.matchEliminated, eliminated];

      // otherwise there's another round of clue-giving to go (continueMatch)
      // — see @juntada/impostor-match-rules for the actual win condition.
      const winner = matchWinner(round!.impostors, matchEliminated, players.length);

      const resolved: Round = {
        ...round!,
        eliminated,
        wasImpostor,
        tally,
        votesByVoter: next,
        matchEliminated,
        matchOver: winner !== null,
        winner,
      };
      setRound(resolved);
      setRevealStep("elimination");
      setResultsFlashing(true);
      setTimeout(() => {
        setResultsFlashing(false);
        setPhase("result");
      }, 1400);
    }
  };

  if (phase === "setup") {
    return (
      <SetupScreen
        players={players}
        setPlayers={setPlayers}
        config={config}
        setConfig={setConfig}
        usedWords={usedWords}
        startRound={startRound}
        wordError={wordError}
        wordErrorKey={wordErrorKey}
      />
    );
  }

  if (phase === "intro" && round) {
    return <IntroScreen onStart={goToReveal} />;
  }

  if (phase === "roundFlash" && round) {
    return <RoundStartFlash matchRound={matchRound} />;
  }

  if (phase === "reveal" && round) {
    return (
      <RevealScreen
        round={round}
        players={players}
        config={config}
        revealIdx={revealIdx}
        setRevealIdx={setRevealIdx}
        wordVisible={wordVisible}
        setWordVisible={setWordVisible}
        onDone={afterReveal}
      />
    );
  }

  if (phase === "clues" && round) {
    return (
      <ClueEntryScreen
        round={round}
        players={players}
        clues={clues}
        clueIdx={clueIdx}
        setClueIdx={setClueIdx}
        clueInput={clueInput}
        setClueInput={setClueInput}
        setClues={setClues}
        onDone={finishClueEntry}
      />
    );
  }

  if (phase === "cluesReady" && round) {
    return <ClueReadyScreen round={round} players={players} config={config} matchRound={matchRound} onStart={goToDiscussion} />;
  }

  if (phase === "discussion" && round) {
    return (
      <DiscussionScreen
        config={config}
        clueHistory={clueHistory}
        players={players}
        timeLeft={timeLeft}
        onGoToVote={() => {
          if (timerRef.current) clearInterval(timerRef.current);
          setPhase("vote");
        }}
      />
    );
  }

  if (phase === "vote" && round) {
    return (
      <>
        <VoteScreen
          round={round}
          players={players}
          selection={selection}
          setSelection={setSelection}
          votes={votes}
          confirmVote={confirmVote}
        />
        {resultsFlashing && <VoteResultsFlash />}
      </>
    );
  }

  if (phase === "result" && round) {
    return (
      <ResultScreen
        round={round}
        players={players}
        config={config}
        revealStep={revealStep}
        setRevealStep={setRevealStep}
        continueMatch={continueMatch}
        onNewMatch={() => setPhase("setup")}
        wordError={wordError}
        wordErrorKey={wordErrorKey}
      />
    );
  }

  return null;
}
