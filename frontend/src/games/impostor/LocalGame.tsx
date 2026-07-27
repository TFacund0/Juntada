import { useState, useEffect, useRef } from "react";
import { S } from "../../theme/styles";
import { CATEGORIES } from "@juntada/impostor-data";
import { maxImpostors, matchWinner } from "@juntada/impostor-match-rules";
import { shuffle } from "../../utils/shuffle";
import { nextPlayerName } from "../../utils/playerNames";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";
import { TabRow } from "../../components/TabRow";
import { SetupTabs, type SetupTab } from "../../components/SetupTabs";
import { StickyActionBar } from "../../components/StickyActionBar";
import { StartButton } from "../../components/StartButton";
import { BackButton } from "../../components/BackButton";
import { MinPlayersHint } from "../../components/MinPlayersHint";
import { EliminatedPlayerCard } from "./EliminatedPlayerCard";
import { ErrorBanner } from "../../components/ErrorBanner";
import { useFlashError } from "../../hooks/useFlashError";

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL GAME MODE — un solo dispositivo, se pasa de mano en mano.
// Las pistas se dicen en voz alta por defecto; "Pistas escritas" en la config
// hace que cada uno la tipee al final de su turno de revelación, para poder
// repasarlas juntos antes de votar.
// ═══════════════════════════════════════════════════════════════════════════════

interface LocalPlayer {
  id: number;
  name: string;
}

interface Round {
  word: string;
  categoryKey: string;
  categoryLabel: string;
  // Fixed for the whole match — set once by startRound, carried over
  // unchanged by continueMatch across every subsequent vote.
  impostors: number[];
  // Cumulative across the whole match.
  matchEliminated: number[];
  // Whoever was still alive at the start of this round's vote.
  voters: number[];
  eliminated?: number;
  wasImpostor?: boolean;
  tally?: Record<number, number>;
  matchOver: boolean;
  winner: "innocents" | "impostors" | null;
  // Set when the top vote count is tied — same idea as the online engine's
  // revoteCandidates/revoteCount (see @juntada/impostor-match-rules and
  // engine.ts's tallyVotes): repeat the vote among just the tied suspects
  // instead of eliminating one at random, up to MAX_REVOTES times.
  revoteCandidates?: number[];
  revoteCount: number;
}

const MAX_REVOTES = 2;

interface Config {
  numImpostors: number;
  hintsEnabled: boolean;
  writtenClues: boolean;
  discussionTime: number;
  discussionUnlimited: boolean;
  revealOnElimination: boolean;
  enabledCategories: Record<string, boolean>;
}

function CluesReview({ clues, players }: { clues: Record<number, string>; players: LocalPlayer[] }) {
  const entries = Object.entries(clues || {}).filter(([, clue]) => clue);
  if (entries.length === 0) return null;
  return (
    <div style={S.card}>
      <span style={S.label}>Pistas</span>
      {entries.map(([playerId, clue]) => {
        const p = players.find(x => String(x.id) === playerId);
        if (!p) return null;
        return (
          <p key={playerId} style={{ fontSize: 14, margin: "4px 0", color: "#b8b0d4" }}>
            <strong style={{ color: "#AFA9EC" }}>{p.name}:</strong> {clue}
          </p>
        );
      })}
    </div>
  );
}

export function LocalGame() {
  const [phase, setPhase] = useState<"setup" | "reveal" | "discussion" | "vote" | "result">("setup");
  const [players, setPlayers] = useState<LocalPlayer[]>([
    { id: 1, name: "Jugador 1" },
    { id: 2, name: "Jugador 2" },
    { id: 3, name: "Jugador 3" },
    { id: 4, name: "Jugador 4" },
  ]);
  const [newName, setNewName] = useState("");
  const [nameError, nameErrorKey, setNameError] = useFlashError();
  const [wordError, wordErrorKey, setWordError] = useFlashError();
  const [config, setConfig] = useState<Config>({
    numImpostors: 1,
    hintsEnabled: true,
    writtenClues: false,
    discussionTime: 30,
    discussionUnlimited: false,
    revealOnElimination: true,
    // Off by default — you have to actively pick which categories are in
    // play rather than opt out of a preselected set.
    enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {} as Record<string, boolean>),
  });
  const [round, setRound] = useState<Round | null>(null);
  const [revealIdx, setRevealIdx] = useState(0);
  // A pass-and-play device shows the same screen to whoever's holding it —
  // without an explicit "it's my turn now" tap between reveals, the previous
  // player's word/impostor status could flash to the wrong eyes for however
  // long the physical handoff takes. Reset every time revealIdx moves so
  // each new player has to confirm before their own card becomes tappable.
  const [handoffConfirmed, setHandoffConfirmed] = useState(false);
  const [wordVisible, setWordVisible] = useState(false);
  const [clueInput, setClueInput] = useState("");
  const [clues, setClues] = useState<Record<number, string>>({});
  const [selection, setSelection] = useState<Record<number, number>>({}); // voterId -> suspectId not yet confirmed
  const [votes, setVotes] = useState<Record<number, number>>({});
  const [usedWords, setUsedWords] = useState<Record<string, string[]>>({});
  // Bumped every time a round starts (a fresh match via startRound, or
  // another lap within one via continueMatch) — mirrors the online engine's
  // turnRotation so the same player isn't stuck always going first.
  const [turnRotation, setTurnRotation] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tab, setTab] = useState<SetupTab>("players");
  // Mirrors online's ConfigPanel.tsx sub-tabs so both modes organize the
  // rules the same way.
  const [configTab, setConfigTab] = useState<"cats" | "rules" | "order">("cats");

  const activeCats = Object.keys(config.enabledCategories).filter(k => config.enabledCategories[k]);
  const wordsLeftIn = (catKey: string) => CATEGORIES[catKey].words.length - (usedWords[catKey] || []).length;
  // A subtle, word-specific clue for the impostor — never the category name,
  // so it can't be traced back to what everyone else is actually giving
  // clues about (see @juntada/impostor-data's hints, mirrors engine.ts).
  const wordHint = (catKey: string, word: string): string | null => CATEGORIES[catKey]?.hints?.[word] ?? null;
  // drawWord picks a random active category, so as long as at least one of
  // them still has words it'll eventually find it — only actually stuck once
  // every active category is fully exhausted. Checked proactively (not just
  // reactively via drawWord's own wordError) so "Iniciar ronda"/"Nueva
  // partida" doesn't just silently fail on tap after a long match.
  const allCategoriesExhausted = activeCats.length > 0 && activeCats.every(k => wordsLeftIn(k) <= 0);

  // A host who sets e.g. 2 impostors then removes players down to where
  // maxImpostors(players.length) is only 1 would otherwise keep seeing "2"
  // selected in the Rules tab even though startRound silently clamps it at
  // draw time — this corrects the config the moment the roster shrinks, so
  // what's shown always matches what would actually happen.
  useEffect(() => {
    const cap = maxImpostors(players.length);
    setConfig(c => (c.numImpostors > cap ? { ...c, numImpostors: cap } : c));
  }, [players.length]);

  const isDuplicateName = (name: string, excludeId: number | null) => {
    const norm = name.trim().toLowerCase();
    return players.some(p => p.id !== excludeId && p.name.trim().toLowerCase() === norm);
  };

  // The players array's own order doubles as the turn order (see the reveal
  // phase below, which just walks it in sequence) — same idea as online's
  // ConfigPanel "Orden" tab, just reordering the roster directly instead of
  // a separate turnOrder field since there's no separate join order to
  // preserve here.
  const movePlayer = (index: number, dir: number) => {
    const target = index + dir;
    if (target < 0 || target >= players.length) return;
    setPlayers(prev => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const renamePlayer = (id: number, name: string) => {
    if (name.trim() && isDuplicateName(name, id)) {
      setNameError("Ya hay un jugador con ese nombre");
      return;
    }
    setNameError("");
    setPlayers(prev => prev.map(x => (x.id === id ? { ...x, name } : x)));
  };

  const addPlayer = () => {
    const trimmed = newName.trim() || nextPlayerName(players.map(p => p.name));
    if (isDuplicateName(trimmed, null)) {
      setNameError("Ya hay un jugador con ese nombre");
      return;
    }
    setNameError("");
    setPlayers(p => [...p, { id: Date.now(), name: trimmed }]);
    setNewName("");
  };

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
    setHandoffConfirmed(false);
    setWordVisible(false);
    setClueInput("");
    setClues({});
    setSelection({});
    setVotes({});
    setPhase("reveal");
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
    beginReveal();
  };

  // Local's answer to online's skip_word — "no conozco esta palabra, pedir
  // otra" was previously online-only even though a pass-and-play table hits
  // the exact same problem. No vote threshold needed here (unlike online,
  // there's no separate device per player to poll) — same category, same
  // impostors, just a fresh word. Falls back to a whole new match if the
  // category's genuinely out of unused words, same as online's rerollWord.
  const requestNewWord = () => {
    if (!round) return;
    const cat = CATEGORIES[round.categoryKey];
    const used = usedWords[round.categoryKey] || [];
    const available = cat.words.filter((w: string) => !used.includes(w) && w !== round.word);
    if (!available.length) {
      // Falling back to startRound only makes sense if some active category
      // still has words left for it to draw from — otherwise it'd silently
      // no-op (drawWord's own error would just overwrite this one) and leave
      // the player thinking a new match started when nothing actually
      // changed. Checked with the same allCategoriesExhausted this file
      // already uses to gate "Iniciar ronda"/"Nueva partida".
      if (allCategoriesExhausted) {
        setWordError(`Ya no quedan palabras sin usar en ninguna categoría activa — seguí con la palabra actual`);
        return;
      }
      setWordError(`Sin más palabras en ${cat.label} — arrancó una partida nueva`);
      startRound();
      return;
    }
    const word = available[Math.floor(Math.random() * available.length)];
    setUsedWords(prev => ({ ...prev, [round.categoryKey]: [...(prev[round.categoryKey] || []), word] }));
    setRound(r => (r ? { ...r, word } : r));
    setWordVisible(false);
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
    beginReveal();
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

      const resolved: Round = { ...round!, eliminated, wasImpostor, tally, matchEliminated, matchOver: winner !== null, winner };
      setRound(resolved);
      setPhase("result");
    }
  };

  // ── SETUP ──
  if (phase === "setup")
    return (
      <div style={{ paddingBottom: 88 }}>
        <SetupTabs tab={tab} onChange={setTab} />

        {tab === "config" && (
          <TabRow
            tabs={[
              { key: "cats", label: "Categorías" },
              { key: "rules", label: "Reglas" },
              { key: "order", label: "Orden" },
            ]}
            active={configTab}
            onChange={setConfigTab}
            style={{ marginBottom: 14 }}
            buttonPadding="8px"
          />
        )}

        {tab === "players" && (
          <>
            <div style={S.card}>
              <span style={S.label}>Jugadores ({players.length})</span>
              {players.map(p => (
                <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <Avatar name={p.name} size={32} />
                  <input style={{ ...S.input, flex: 1 }} value={p.name} onChange={e => renamePlayer(p.id, e.target.value)} />
                  <button
                    onClick={() => setPlayers(prev => prev.filter(x => x.id !== p.id))}
                    style={{ ...S.btn("danger"), width: 36, height: 36, padding: 0, borderRadius: 8, flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input
                  style={{ ...S.input, flex: 1 }}
                  placeholder="Nombre"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") addPlayer();
                  }}
                />
                <Btn variant="ghost" onClick={addPlayer} style={{ width: "auto", padding: "11px 18px" }}>
                  Agregar
                </Btn>
              </div>
              <ErrorBanner message={nameError} flashKey={nameErrorKey} variant="inline" />
            </div>
          </>
        )}

        {tab === "config" && configTab === "rules" && (
          <>
            <div style={S.card}>
              <span style={S.label}>Impostores</span>
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3].map(n => {
                  const maxImp = maxImpostors(players.length);
                  return (
                    <button
                      key={n}
                      onClick={() => setConfig(c => ({ ...c, numImpostors: n }))}
                      disabled={n > maxImp}
                      style={{
                        ...S.btn(config.numImpostors === n ? "primary" : "ghost"),
                        flex: 1,
                        padding: "10px 0",
                        fontSize: 14,
                        opacity: n > maxImp ? 0.35 : 1,
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              {maxImpostors(players.length) < 3 && (
                <p style={{ ...S.muted, marginTop: 8, lineHeight: 1.4 }}>
                  Con {players.length} jugadores, como máximo puede haber {maxImpostors(players.length)}{" "}
                  {maxImpostors(players.length) === 1 ? "impostor" : "impostores"}.
                </p>
              )}
            </div>
            <div style={S.card}>
              <span style={S.label}>¿El impostor recibe una pista?</span>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setConfig(c => ({ ...c, hintsEnabled: true }))}
                  style={{ ...S.btn(config.hintsEnabled ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
                >
                  Sí, con pista
                </button>
                <button
                  onClick={() => setConfig(c => ({ ...c, hintsEnabled: false }))}
                  style={{ ...S.btn(!config.hintsEnabled ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
                >
                  No, a ciegas
                </button>
              </div>
              <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4 }}>
                {config.hintsEnabled
                  ? "El impostor ve una pista sutil sobre la palabra, para poder disimular."
                  : "El impostor no sabe nada de la palabra secreta — tiene que improvisar."}
              </p>
            </div>
            <div style={S.card}>
              <span style={S.label}>¿Se revela el rol al eliminar a alguien?</span>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setConfig(c => ({ ...c, revealOnElimination: true }))}
                  style={{ ...S.btn(config.revealOnElimination ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
                >
                  Sí, se revela
                </button>
                <button
                  onClick={() => setConfig(c => ({ ...c, revealOnElimination: false }))}
                  style={{ ...S.btn(!config.revealOnElimination ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
                >
                  No, queda en duda
                </button>
              </div>
              <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4 }}>
                {config.revealOnElimination
                  ? "Al eliminar a alguien se muestra si era el impostor o no."
                  : "Al eliminar a alguien no se revela su rol — sigan jugando con la duda."}
              </p>
            </div>
            <div style={S.card}>
              <span style={S.label}>¿Cómo dan su palabra los jugadores?</span>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setConfig(c => ({ ...c, writtenClues: true }))}
                  style={{ ...S.btn(config.writtenClues ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
                >
                  Escrita
                </button>
                <button
                  onClick={() => setConfig(c => ({ ...c, writtenClues: false }))}
                  style={{ ...S.btn(!config.writtenClues ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
                >
                  En voz alta
                </button>
              </div>
              <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4 }}>
                {config.writtenClues
                  ? "Cada uno escribe su palabra en el dispositivo antes de pasarlo, y quedan visibles para repasar antes de votar."
                  : "Cada uno dice su palabra en voz alta, por turnos, sin escribir nada."}
              </p>
              {/* Online tiene un "tiempo por turno" además de este porque cada
                  jugador tiene su propio dispositivo y hay que evitar que uno
                  se cuelgue mientras el resto espera. Acá el dispositivo se va
                  pasando de mano en mano, así que ya queda en manos del grupo
                  cuánto tarda cada uno antes de tocar "Siguiente jugador" —
                  no hace falta un cronómetro server-side para eso. */}
              <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4, fontSize: 12 }}>
                No hay límite de tiempo por turno: como se van pasando el dispositivo de mano en mano, cada uno avanza cuando ya dijo su
                palabra.
              </p>
            </div>
            <div style={S.card}>
              <span style={S.label}>
                Tiempo de discusión:{" "}
                {config.discussionUnlimited
                  ? "Sin límite"
                  : config.discussionTime === 0
                    ? "Sin fase de discusión"
                    : `${config.discussionTime}s`}
              </span>
              <input
                type="range"
                min="0"
                max="180"
                step="15"
                value={config.discussionTime}
                disabled={config.discussionUnlimited}
                onChange={e => setConfig(c => ({ ...c, discussionTime: +e.target.value, discussionUnlimited: false }))}
                style={{ width: "100%", marginTop: 8, opacity: config.discussionUnlimited ? 0.4 : 1 }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, cursor: "pointer" }}>
                <div
                  style={S.toggle(config.discussionUnlimited)}
                  onClick={() => setConfig(c => ({ ...c, discussionUnlimited: !c.discussionUnlimited }))}
                >
                  <div style={S.knob(config.discussionUnlimited)} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: config.discussionUnlimited ? "#5DCAA5" : "#6b6490" }}>
                  Discusión sin límite de tiempo — pasan a votar cuando estén todos listos
                </span>
              </label>
            </div>
          </>
        )}

        {tab === "config" && configTab === "cats" && (
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={S.label}>Categorías</span>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() =>
                    setConfig(c => ({
                      ...c,
                      enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}),
                    }))
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "#7F77DD",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "inherit",
                  }}
                >
                  Todas
                </button>
                <button
                  onClick={() =>
                    setConfig(c => ({
                      ...c,
                      enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {}),
                    }))
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "#7F77DD",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "inherit",
                  }}
                >
                  Ninguna
                </button>
              </div>
            </div>
            <p style={{ ...S.muted, margin: "4px 0 14px", lineHeight: 1.4 }}>
              Elegí de qué van a ser las palabras. Tocá una categoría para activarla.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {Object.entries(CATEGORIES).map(([k, cat]) => {
                const active = !!config.enabledCategories[k];
                const remaining = wordsLeftIn(k);
                const exhausted = remaining <= 0;
                return (
                  <button
                    key={k}
                    onClick={() => setConfig(c => ({ ...c, enabledCategories: { ...c.enabledCategories, [k]: !active } }))}
                    title={exhausted ? "Ya se usaron todas las palabras de esta categoría en esta partida" : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "10px 16px",
                      borderRadius: 999,
                      border: active ? "1px solid rgba(127,119,221,0.6)" : "1px solid rgba(255,255,255,0.12)",
                      background: active ? "linear-gradient(135deg,#7F77DD,#534AB7)" : "rgba(255,255,255,0.04)",
                      color: active ? "#fff" : "#9089c0",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      boxShadow: active ? "0 3px 14px rgba(127,119,221,0.35)" : "none",
                      transition: "all 0.15s",
                      opacity: exhausted ? 0.55 : 1,
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span style={{ fontSize: 11, opacity: 0.75 }}>{exhausted ? "· sin palabras" : `· ${remaining}`}</span>
                  </button>
                );
              })}
            </div>
            <p style={{ ...S.muted, marginTop: 12 }}>
              {activeCats.length === 0
                ? "No elegiste ninguna categoría todavía."
                : `${activeCats.length} categoría${activeCats.length === 1 ? "" : "s"} activa${activeCats.length === 1 ? "" : "s"}.`}
            </p>
            {allCategoriesExhausted && (
              <p style={{ fontSize: 12, color: "#F09595", marginTop: 4 }}>
                Ya se usaron todas las palabras de las categorías activas — activá otra para poder seguir jugando.
              </p>
            )}
          </div>
        )}

        {tab === "config" && configTab === "order" && (
          <div style={S.card}>
            <span style={S.label}>Orden de turno para dar la palabra</span>
            <p style={{ ...S.muted, margin: "4px 0 12px", lineHeight: 1.4 }}>
              Así van a ir pasando el dispositivo y dando su palabra en la ronda.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {players.map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                  <span style={{ width: 18, fontSize: 12, fontWeight: 800, color: "#6b6490" }}>{i + 1}</span>
                  <Avatar name={p.name} size={28} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                  <button
                    onClick={() => movePlayer(i, -1)}
                    disabled={i === 0}
                    style={{
                      ...S.btn("ghost"),
                      width: 32,
                      height: 32,
                      padding: 0,
                      borderRadius: 8,
                      fontSize: 14,
                      opacity: i === 0 ? 0.35 : 1,
                    }}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => movePlayer(i, 1)}
                    disabled={i === players.length - 1}
                    style={{
                      ...S.btn("ghost"),
                      width: 32,
                      height: 32,
                      padding: 0,
                      borderRadius: 8,
                      fontSize: 14,
                      opacity: i === players.length - 1 ? 0.35 : 1,
                    }}
                  >
                    ↓
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <StickyActionBar>
          <StartButton onClick={startRound} disabled={players.length < 3 || activeCats.length === 0 || allCategoriesExhausted}>
            Iniciar ronda
          </StartButton>
          <MinPlayersHint count={players.length} min={3} />
          {players.length >= 3 && activeCats.length === 0 && (
            <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginTop: 8 }}>
              Elegí al menos una categoría en la pestaña "Categorías" para poder arrancar
            </p>
          )}
          {players.length >= 3 && activeCats.length > 0 && allCategoriesExhausted && (
            <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginTop: 8 }}>
              Ya no quedan palabras sin usar en las categorías activas — activá otra en "Categorías"
            </p>
          )}
          <ErrorBanner message={wordError} flashKey={wordErrorKey} variant="inline" />
        </StickyActionBar>
      </div>
    );

  // ── REVEAL ──
  if (phase === "reveal" && round) {
    const alive = round.voters.map(id => players.find(p => p.id === id)).filter((p): p is LocalPlayer => Boolean(p));
    const player = alive[revealIdx];
    const isImpostor = round.impostors.includes(player.id);
    const isLast = revealIdx === alive.length - 1;
    const needsClue = config.writtenClues && !clueInput.trim();

    const advance = () => {
      if (config.writtenClues) setClues(c => ({ ...c, [player.id]: clueInput.trim() }));
      setWordVisible(false);
      setClueInput("");
      setHandoffConfirmed(false);
      if (isLast) goToDiscussion();
      else setRevealIdx(i => i + 1);
    };

    if (!handoffConfirmed) {
      return (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ ...S.muted, marginBottom: 16 }}>
            Jugador {revealIdx + 1} de {alive.length}
          </p>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 28 }}>
            <Avatar name={player.name} size={72} />
            <div>
              <p style={{ margin: 0, fontSize: 13, color: "#9089c0" }}>Pasale el dispositivo a</p>
              <p style={{ margin: "4px 0 0", fontWeight: 800, fontSize: 24 }}>{player.name}</p>
            </div>
          </div>
          <Btn onClick={() => setHandoffConfirmed(true)}>Soy {player.name}, continuar</Btn>
        </div>
      );
    }

    return (
      <div>
        <p style={{ ...S.muted, textAlign: "center", marginBottom: 16 }}>
          Jugador {revealIdx + 1} de {alive.length}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 20 }}>
          <Avatar name={player.name} size={56} />
          <p style={{ fontWeight: 800, fontSize: 20, margin: 0 }}>{player.name}</p>
        </div>
        <div
          style={{
            ...S.card,
            textAlign: "center",
            cursor: "pointer",
            border: wordVisible ? "1px solid rgba(127,119,221,0.4)" : "1px solid rgba(255,255,255,0.08)",
            minHeight: 120,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
          }}
          onClick={() => setWordVisible(v => !v)}
        >
          {!wordVisible ? (
            <p style={{ color: "#6b6490", fontSize: 15 }}>Tocá para revelar tu palabra</p>
          ) : isImpostor ? (
            <>
              <p style={{ fontSize: 22, fontWeight: 800, color: "#F09595", margin: "0 0 8px" }}>Sos el impostor</p>
              {config.hintsEnabled && wordHint(round.categoryKey, round.word) && (
                <p style={{ fontSize: 13, color: "#9089c0" }}>{wordHint(round.categoryKey, round.word)}</p>
              )}
              <p style={{ fontSize: 12, color: "#5a5280", marginTop: 8 }}>Tocá para ocultar</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "#9089c0", marginBottom: 6 }}>Tu palabra</p>
              <p style={S.bigReveal}>{round.word}</p>
              <p style={{ fontSize: 12, color: "#5a5280", marginTop: 8 }}>Tocá para ocultar</p>
            </>
          )}
        </div>
        {config.writtenClues && wordVisible && (
          <div style={S.card}>
            <span style={S.label}>Tu pista</span>
            <input
              style={S.input}
              placeholder="Escribí tu pista antes de pasar el dispositivo..."
              value={clueInput}
              onChange={e => setClueInput(e.target.value)}
            />
          </div>
        )}
        {wordVisible && (
          <Btn variant="ghost" onClick={requestNewWord} style={{ marginBottom: 10 }}>
            No conozco esta palabra, pedir otra
          </Btn>
        )}
        <Btn onClick={advance} disabled={needsClue}>
          {isLast ? "Todos listos, empezar" : "Siguiente jugador"}
        </Btn>
      </div>
    );
  }

  // ── DISCUSSION ──
  if (phase === "discussion" && round) {
    // A pass-around device means nobody's necessarily looking at the screen
    // right when the countdown finishes — unlike online, where each player
    // has their own device to glance at. A pulsing card + a short vibration
    // (where supported) in the last few seconds gives some warning before it
    // auto-advances to voting out from under whoever's holding it.
    const urgent = timeLeft > 0 && timeLeft <= 5;
    return (
      <div>
        <style>{`
          @keyframes discussion-urgent-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.03); }
          }
        `}</style>
        {config.discussionUnlimited ? (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ ...S.muted, margin: 0 }}>Sin límite de tiempo — avancen cuando estén listos</p>
          </div>
        ) : (
          <div style={{ ...S.card, animation: urgent ? "discussion-urgent-pulse 0.5s ease-in-out infinite" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#9089c0" }}>Tiempo restante</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: timeLeft < 15 ? "#E24B4A" : timeLeft < 30 ? "#EF9F27" : "#5DCAA5" }}>
                {timeLeft}s
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 3,
                  width: `${Math.round((timeLeft / config.discussionTime) * 100)}%`,
                  background: timeLeft < 15 ? "#E24B4A" : timeLeft < 30 ? "#EF9F27" : "#5DCAA5",
                  transition: "width 1s, background 0.5s",
                }}
              />
            </div>
          </div>
        )}
        {config.writtenClues ? (
          <CluesReview clues={clues} players={players} />
        ) : (
          <p style={{ ...S.muted, textAlign: "center", marginBottom: 16 }}>Repasen entre todos lo que dijo cada uno antes de votar.</p>
        )}
        <Btn
          variant="ghost"
          onClick={() => {
            if (timerRef.current) clearInterval(timerRef.current);
            setPhase("vote");
          }}
        >
          Ir a votación
        </Btn>
      </div>
    );
  }

  // ── VOTE ──
  if (phase === "vote" && round) {
    const alive = players.filter(p => round.voters.includes(p.id));
    const revoteCandidates = round.revoteCandidates;
    return (
      <div>
        <CluesReview clues={clues} players={players} />
        {revoteCandidates && (
          <div style={{ ...S.card, textAlign: "center", border: "1px solid rgba(226,196,74,0.35)", background: "rgba(226,196,74,0.08)" }}>
            <p style={{ fontSize: 14, color: "#E2C44A", fontWeight: 700, margin: 0 }}>Hubo un empate</p>
            <p style={{ ...S.muted, margin: "4px 0 0" }}>Se vota de nuevo, solo entre quienes empataron</p>
          </div>
        )}
        {alive.map(voter => {
          const confirmed = votes[voter.id] != null;
          const pending = selection[voter.id];
          return (
            <div key={voter.id} style={S.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: confirmed ? 0 : 12 }}>
                <Avatar name={voter.name} size={28} />
                <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{voter.name} sospecha de:</span>
                {confirmed && <span style={S.pill(true)}>Confirmado</span>}
              </div>
              {!confirmed && (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {alive
                      .filter(p => p.id !== voter.id && (!revoteCandidates || revoteCandidates.includes(p.id)))
                      .map(suspect => (
                        <button
                          key={suspect.id}
                          onClick={() => setSelection(s => ({ ...s, [voter.id]: suspect.id }))}
                          style={{
                            ...S.btn(pending === suspect.id ? "danger" : "ghost"),
                            width: "auto",
                            padding: "8px 14px",
                            fontSize: 13,
                            borderRadius: 8,
                          }}
                        >
                          {suspect.name}
                        </button>
                      ))}
                  </div>
                  <Btn variant="success" disabled={!pending} onClick={() => confirmVote(voter.id)} style={{ marginTop: 10 }}>
                    Confirmar voto
                  </Btn>
                </>
              )}
            </div>
          );
        })}
        <p style={{ ...S.muted, textAlign: "center" }}>Faltan {alive.length - Object.keys(votes).length} confirmaciones</p>
      </div>
    );
  }

  // ── RESULT ──
  if (phase === "result" && round) {
    const eliminated = players.find(p => p.id === round.eliminated);
    const impostorPlayers = players.filter(p => round.impostors.includes(p.id));
    const voters = players.filter(p => round.voters.includes(p.id));
    const matchOver = round.matchOver;
    const winner = round.winner;
    // Each elimination reveals the eliminated player's role only if the
    // "revealOnElimination" setting is on — but once the match is over
    // there's nothing left to protect, so the outcome always shows.
    const reveal = config.revealOnElimination || matchOver;
    const wasImpostor = reveal ? round.wasImpostor : undefined;
    const winnerColor = winner === "innocents" ? "#5DCAA5" : "#F09595";

    return (
      <div>
        {matchOver && (
          <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: winnerColor, marginTop: 8 }}>
              {winner === "innocents" ? "Ganaron los inocentes" : "Ganaron los impostores"}
            </p>
          </div>
        )}

        {eliminated && <EliminatedPlayerCard name={eliminated.name} wasImpostor={wasImpostor} />}

        {matchOver && (
          <div style={{ ...S.cardHighlight, textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "#9089c0" }}>La palabra era</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#AFA9EC", margin: "4px 0" }}>{round.word}</p>
          </div>
        )}

        {matchOver && (
          <div style={S.card}>
            <span style={S.label}>{impostorPlayers.length === 1 ? "El impostor era" : "Los impostores eran"}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "8px 0 0" }}>
              {impostorPlayers.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={p.name} size={28} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                </div>
              ))}
            </div>
            {impostorPlayers.length > 1 && (
              <>
                <p style={{ ...S.muted, margin: "14px 0 6px" }}>Atrapados durante la partida</p>
                {impostorPlayers.filter(p => round.matchEliminated.includes(p.id)).length > 0 ? (
                  impostorPlayers
                    .filter(p => round.matchEliminated.includes(p.id))
                    .map(p => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <Avatar name={p.name} size={24} />
                        <span style={{ fontSize: 13 }}>{p.name}</span>
                      </div>
                    ))
                ) : (
                  <p style={{ ...S.muted, margin: 0 }}>Ninguno.</p>
                )}
              </>
            )}
          </div>
        )}

        <div style={S.card}>
          <span style={S.label}>Votos</span>
          {voters.map(p => {
            const count = (round.tally || {})[p.id] || 0;
            const total = Math.max(1, voters.length - 1);
            return (
              <div key={p.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{p.name}</span>
                  <span style={S.muted}>{count} votos</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 3,
                      width: `${Math.round((count / total) * 100)}%`,
                      background: p.id === round.eliminated ? "#E24B4A" : "#534AB7",
                      transition: "width 0.6s",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {matchOver ? (
            <>
              <StartButton onClick={startRound} disabled={allCategoriesExhausted}>
                Nueva partida
              </StartButton>
              {allCategoriesExhausted && (
                <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center" }}>
                  Ya no quedan palabras sin usar en las categorías activas — activá otra en "Configuración" antes de seguir
                </p>
              )}
            </>
          ) : (
            <StartButton onClick={continueMatch}>Siguiente ronda</StartButton>
          )}
          <ErrorBanner message={wordError} flashKey={wordErrorKey} variant="inline" />
          <BackButton onClick={() => setPhase("setup")}>Configuración</BackButton>
        </div>
      </div>
    );
  }

  return null;
}
