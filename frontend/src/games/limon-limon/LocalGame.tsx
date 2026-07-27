import { useState, useEffect, useRef } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";
import { SetupTabs, type SetupTab } from "../../components/SetupTabs";
import { StickyActionBar } from "../../components/StickyActionBar";
import { StartButton } from "../../components/StartButton";
import { BackButton } from "../../components/BackButton";
import { MinPlayersHint } from "../../components/MinPlayersHint";
import { buildDeck, buildDefaultDescriptions, cardKey, getDescription } from "./deck";
import type { Card } from "./deck";
import { CardView, DeckStack } from "./CardView";
import { AssignPicker } from "./AssignPicker";
import { DescriptionToggle } from "./DescriptionToggle";
import { DescriptionsEditor } from "./DescriptionsEditor";
import { ScoreToggleButton } from "./ScoreToggleButton";
import { AddPlayerForm } from "../../components/AddPlayerForm";
import { EndMatchButton } from "./EndMatchButton";
import { ErrorBanner } from "../../components/ErrorBanner";
import { useFlashError } from "../../hooks/useFlashError";
import { nextPlayerName } from "../../utils/playerNames";

// ═══════════════════════════════════════════════════════════════════════════════
// LIMÓN LIMÓN — un solo dispositivo en el centro de la ronda, jugando con un
// mazo de baraja española. Por turno alguien toca el mazo para revelar la
// carta de arriba, y el grupo decide en voz alta (y confirma acá) quién se la
// come — el juego nunca asigna nada solo. Se pueden sumar jugadores en
// cualquier momento, incluso a mitad de partida. Al vaciarse el mazo se
// muestra el ranking: quien acumuló más cartas, pierde.
// ═══════════════════════════════════════════════════════════════════════════════

interface LocalPlayer {
  id: number;
  name: string;
}

const MIN_PLAYERS = 2;
const SLIDE_MS = 350;

function nextTurnId(players: LocalPlayer[], currentId: number | null): number {
  const ids = players.map(p => p.id);
  const idx = ids.indexOf(currentId as number);
  if (idx === -1) return ids[0];
  return ids[(idx + 1) % ids.length];
}

function Ranking({ players, counts }: { players: LocalPlayer[]; counts: Record<number, number> }) {
  const ranked = players.map(p => ({ ...p, count: counts[p.id] || 0 })).sort((a, b) => b.count - a.count);
  const maxCount = ranked[0]?.count ?? 0;
  return (
    <div style={S.card}>
      <span style={S.label}>Cartas acumuladas</span>
      {ranked.map((p, i) => (
        <div
          key={p.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 0",
            borderBottom: i < ranked.length - 1 ? "1px solid rgba(127,119,221,0.08)" : "none",
          }}
        >
          <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: "#6b6490" }}>{i + 1}</span>
          <Avatar name={p.name} size={28} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.name}</span>
          {p.count === maxCount && maxCount > 0 && <span style={{ fontSize: 11, color: "#F09595", fontWeight: 700 }}>pierde</span>}
          <span
            style={{
              fontWeight: 800,
              color: p.count === maxCount && maxCount > 0 ? "#F09595" : "#AFA9EC",
              minWidth: 24,
              textAlign: "right",
            }}
          >
            {p.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LocalGame() {
  const [phase, setPhase] = useState<"setup" | "play" | "result">("setup");
  const [mode, setMode] = useState<"circle" | "reveal">("circle");
  const [players, setPlayers] = useState<LocalPlayer[]>([
    { id: 1, name: "Jugador 1" },
    { id: 2, name: "Jugador 2" },
    { id: 3, name: "Jugador 3" },
  ]);
  const [newName, setNewName] = useState("");
  const [nameError, nameErrorKey, setNameError] = useFlashError();
  const [descriptions, setDescriptions] = useState(buildDefaultDescriptions());
  const [tab, setTab] = useState<SetupTab>("players");

  const [deck, setDeck] = useState<Card[]>([]);
  const [current, setCurrent] = useState<Card | null>(null);
  const [turnId, setTurnId] = useState<number | null>(null);
  const [piles, setPiles] = useState<Record<number, Card[]>>({});
  const [showRanking, setShowRanking] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<number | null>(null); // modo círculo: elegido, no confirmado todavía

  // ── modo "revelar": mismo mazo para todos, sin turnos. Ciclo de 3 toques
  // por carta: 1) se revela, 2) se tapa (sigue siendo la misma carta, por
  // si alguien la quiere ver de nuevo), 3) recién ahí se desliza afuera y
  // deja ver la que ya estaba debajo. Anotar quién se queda cada carta es
  // opcional.
  const [revealDeck, setRevealDeck] = useState<Card[]>([]);
  const [revealIdx, setRevealIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [awaitingAdvance, setAwaitingAdvance] = useState(false);
  // La carta que se acaba de tapar se va deslizando (y girando un poco)
  // para dejar ver la que ya estaba debajo en el mazo — esa de abajo no se
  // mueve ni entra de ningún lado, solo queda destapada al asentarse
  // ("idle-instant", sin transición). "idle" es solo el estado inicial.
  const [slideAnim, setSlideAnim] = useState<"idle" | "exit" | "idle-instant">("idle");
  const [manualCounts, setManualCounts] = useState<Record<number, number>>({});
  const [showManualCounts, setShowManualCounts] = useState(false);
  const revealTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      revealTimers.current.forEach(clearTimeout);
    },
    [],
  );

  const isDuplicateName = (name: string, excludeId: number | null) => {
    const norm = name.trim().toLowerCase();
    return players.some(p => p.id !== excludeId && p.name.trim().toLowerCase() === norm);
  };

  const renamePlayer = (id: number, name: string) => {
    if (name.trim() && isDuplicateName(name, id)) {
      setNameError("Ya hay un jugador con ese nombre");
      return;
    }
    setNameError("");
    setPlayers(prev => prev.map(x => (x.id === id ? { ...x, name } : x)));
  };

  // Typing has to allow a momentarily-blank field (you can't erase a name
  // without passing through "") — but leaving it there once you move on
  // would strand that player with an empty display name forever, since
  // nothing else ever revisits it. Falls back to a fresh "Jugador N" only
  // once editing is actually done.
  const handleNameBlur = (id: number) => {
    setPlayers(prev =>
      prev.map(x => (x.id === id && !x.name.trim() ? { ...x, name: nextPlayerName(prev.filter(p => p.id !== id).map(p => p.name)) } : x)),
    );
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
    setAddingPlayer(false);
  };

  const resetForMode = () => {
    if (mode === "circle") {
      setDeck(buildDeck());
      setCurrent(null);
      setPiles({});
      setTurnId(players[0]?.id ?? null);
      setShowRanking(false);
      setAddingPlayer(false);
    } else {
      revealTimers.current.forEach(clearTimeout);
      revealTimers.current = [];
      setRevealDeck(buildDeck());
      setRevealIdx(0);
      setRevealed(false);
      setAwaitingAdvance(false);
      setSlideAnim("idle");
      setManualCounts({});
      setShowManualCounts(false);
      setAddingPlayer(false);
    }
    setPhase("play");
  };

  const startGame = resetForMode;
  const playAgain = resetForMode;

  const reveal = () => {
    if (current || deck.length === 0) return;
    const next = [...deck];
    const card = next.pop()!;
    setDeck(next);
    setCurrent(card);
    setSelectedAssignee(null);
  };

  const assign = (targetId: number) => {
    if (!current) return;
    setPiles(prev => ({ ...prev, [targetId]: [...(prev[targetId] || []), current] }));
    const finishedTurnId = turnId;
    setCurrent(null);
    setSelectedAssignee(null);
    if (deck.length === 0) {
      setPhase("result");
    } else {
      setTurnId(nextTurnId(players, finishedTurnId));
    }
  };

  const confirmAssign = () => {
    if (selectedAssignee == null) return;
    assign(selectedAssignee);
  };

  const turnPlayer = players.find(p => p.id === turnId);

  // Ciclo de 3 toques por carta: 1) revela, 2) tapa (misma carta, por si la
  // quieren volver a mirar), 3) recién ahí se desliza afuera y descubre la
  // que ya estaba debajo — o termina la partida si era la última.
  const revealClick = () => {
    if (slideAnim === "exit") return;

    if (!revealed && !awaitingAdvance) {
      setRevealed(true);
      return;
    }
    if (revealed) {
      setRevealed(false);
      setAwaitingAdvance(true);
      return;
    }

    setAwaitingAdvance(false);
    if (revealIdx + 1 >= revealDeck.length) {
      setPhase("result");
      return;
    }
    setSlideAnim("exit");
    const t = setTimeout(() => {
      setRevealIdx(i => i + 1);
      // La que queda destapada ya estaba ahí, debajo — se asienta en su
      // lugar sin ninguna animación de reaparición.
      setSlideAnim("idle-instant");
    }, SLIDE_MS);
    revealTimers.current.push(t);
  };

  const bumpManualCount = (id: number, delta: number) => setManualCounts(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));

  // ── SETUP ──
  if (phase === "setup")
    return (
      <div style={{ paddingBottom: 88 }}>
        <SetupTabs tab={tab} onChange={setTab} />

        {tab === "players" && (
          <div style={S.card}>
            <span style={S.label}>Jugadores ({players.length})</span>
            {players.map(p => (
              <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <Avatar name={p.name} size={32} />
                <input
                  style={{ ...S.input, flex: 1 }}
                  value={p.name}
                  onChange={e => renamePlayer(p.id, e.target.value)}
                  onBlur={() => handleNameBlur(p.id)}
                />
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
        )}

        {tab === "config" && (
          <>
            <div style={S.card}>
              <span style={S.label}>Modo de juego</span>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button
                  onClick={() => setMode("circle")}
                  style={{ ...S.btn(mode === "circle" ? "primary" : "ghost"), flex: 1, fontSize: 13 }}
                >
                  En círculo
                </button>
                <button
                  onClick={() => setMode("reveal")}
                  style={{ ...S.btn(mode === "reveal" ? "primary" : "ghost"), flex: 1, fontSize: 13 }}
                >
                  Revelar cartas
                </button>
              </div>
              <p style={{ ...S.muted, marginTop: 10, marginBottom: 0 }}>
                {mode === "circle"
                  ? "Van pasando el mazo por turno y el grupo decide quién se come cada carta."
                  : "Se toca la carta para revelarla, se vuelve a tocar para pasar a la siguiente. Anotar quién se queda cada carta es opcional."}
              </p>
            </div>

            <DescriptionsEditor descriptions={descriptions} onChange={(key, value) => setDescriptions(d => ({ ...d, [key]: value }))} />
          </>
        )}

        <StickyActionBar>
          <StartButton onClick={startGame} disabled={players.length < MIN_PLAYERS}>
            Empezar a jugar
          </StartButton>
          <MinPlayersHint count={players.length} min={MIN_PLAYERS} />
        </StickyActionBar>
      </div>
    );

  // ── PLAY (modo revelar cartas) ──
  if (phase === "play" && mode === "reveal") {
    const revealCard = revealed ? revealDeck[revealIdx] : null;
    const cardsLeft = revealDeck.length - revealIdx - (revealed ? 1 : 0);
    // A diferencia de cardsLeft (que cuenta la carta actual mientras no se
    // revela), el volumen del mazo detrás solo debe contar las que están
    // debajo de la actual — nunca la que se está mirando ahora.
    const cardsUnderneath = revealDeck.length - revealIdx - 1;
    return (
      <div>
        <p style={{ textAlign: "center", fontSize: 14, color: "#9089c0", marginBottom: 14 }}>
          Carta {revealIdx + 1} de {revealDeck.length} —{" "}
          {revealed ? "toquen para tapar" : awaitingAdvance ? "toquen para pasar a la siguiente" : "toquen para revelar"}
        </p>

        <div style={{ position: "relative", width: 140, height: 196, margin: "0 auto", zIndex: 0 }}>
          <DeckStack cardsLeft={cardsUnderneath} />
          <div
            style={{
              position: "relative",
              transform: slideAnim === "exit" ? "translate(-26px, -16px) rotate(-10deg)" : "translate(0, 0) rotate(0deg)",
              opacity: slideAnim === "exit" ? 0 : 1,
              transition: slideAnim === "idle-instant" ? "none" : `transform ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease`,
            }}
          >
            <CardView card={revealCard} onClick={revealClick} />
          </div>
        </div>

        <p style={{ textAlign: "center", ...S.muted, margin: "10px 0 0" }}>Quedan {cardsLeft} cartas por revelar</p>

        {revealCard && (
          <div style={{ marginTop: 14 }}>
            <DescriptionToggle key={revealIdx} description={getDescription(descriptions, revealCard)} />
          </div>
        )}

        <ScoreToggleButton show={showManualCounts} onToggle={() => setShowManualCounts(v => !v)} />

        {showManualCounts && (
          <div style={S.card}>
            <span style={S.label}>Cartas de cada uno</span>
            <p style={{ ...S.muted, margin: "4px 0 10px", lineHeight: 1.4 }}>
              En este modo nadie se asigna cartas automáticamente — sumalas vos a mano a medida que se deciden en voz alta.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {players.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={p.name} size={26} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                  <button
                    onClick={() => bumpManualCount(p.id, -1)}
                    style={{ ...S.btn("ghost"), width: 32, height: 32, padding: 0, borderRadius: 8, fontSize: 16 }}
                  >
                    −
                  </button>
                  <span style={{ minWidth: 22, textAlign: "center", fontWeight: 800 }}>{manualCounts[p.id] || 0}</span>
                  <button
                    onClick={() => bumpManualCount(p.id, 1)}
                    style={{ ...S.btn("ghost"), width: 32, height: 32, padding: 0, borderRadius: 8, fontSize: 16 }}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {addingPlayer && (
          <>
            <AddPlayerForm name={newName} onNameChange={setNewName} onSubmit={addPlayer} error={nameError} errorKey={nameErrorKey} />
            <p style={{ ...S.muted, textAlign: "center", fontSize: 12, marginTop: -6 }}>
              En este modo no se le asignan cartas automáticamente — sumalas a mano en "Cartas de cada uno".
            </p>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 4 }}>
          <button onClick={() => setAddingPlayer(v => !v)} style={{ ...S.btn("ghost"), width: "auto", padding: "6px 14px", fontSize: 12 }}>
            {addingPlayer ? "Cancelar" : "+ Sumar jugador"}
          </button>
          <EndMatchButton
            onConfirm={() => {
              revealTimers.current.forEach(clearTimeout);
              revealTimers.current = [];
              setPhase("result");
            }}
          />
        </div>
      </div>
    );
  }

  // ── PLAY (ronda en círculo) ──
  if (phase === "play" && mode === "circle")
    return (
      <div>
        {!current && (
          <p style={{ textAlign: "center", fontSize: 14, color: "#9089c0", marginBottom: 14 }}>
            Turno de <strong style={{ color: "#5DCAA5" }}>{turnPlayer?.name}</strong> — toquen el mazo
          </p>
        )}

        <div style={{ position: "relative", width: 140, height: 196, margin: "0 auto", zIndex: 0 }}>
          <DeckStack cardsLeft={deck.length} />
          <div style={{ position: "relative" }}>
            <CardView card={current} onClick={!current ? reveal : undefined} />
          </div>
        </div>

        <p style={{ textAlign: "center", ...S.muted, margin: "10px 0 0" }}>Quedan {deck.length} cartas en el mazo</p>

        {current && (
          <div style={{ marginTop: 14 }}>
            <DescriptionToggle key={cardKey(current.suit, current.value)} description={getDescription(descriptions, current)} />
          </div>
        )}

        {current && (
          <div style={{ ...S.cardHighlight, marginTop: 14 }}>
            <AssignPicker players={players} selected={selectedAssignee} onSelect={setSelectedAssignee} onConfirm={confirmAssign} />
          </div>
        )}

        <ScoreToggleButton show={showRanking} onToggle={() => setShowRanking(v => !v)} />

        {showRanking && <Ranking players={players} counts={Object.fromEntries(players.map(p => [p.id, (piles[p.id] || []).length]))} />}

        {addingPlayer && (
          <AddPlayerForm name={newName} onNameChange={setNewName} onSubmit={addPlayer} error={nameError} errorKey={nameErrorKey} />
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 4 }}>
          <button onClick={() => setAddingPlayer(v => !v)} style={{ ...S.btn("ghost"), width: "auto", padding: "6px 14px", fontSize: 12 }}>
            {addingPlayer ? "Cancelar" : "+ Sumar jugador"}
          </button>
          <EndMatchButton onConfirm={() => setPhase("result")} />
        </div>
      </div>
    );

  // ── RESULT (modo revelar) ──
  if (mode === "reveal") {
    const hasManualCounts = Object.values(manualCounts).some(c => c > 0);
    return (
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={S.bigReveal}>Partida terminada</p>
        </div>
        {hasManualCounts && <Ranking players={players} counts={manualCounts} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          <StartButton onClick={playAgain}>Jugar de nuevo</StartButton>
          <BackButton onClick={() => setPhase("setup")}>Volver al lobby</BackButton>
        </div>
      </div>
    );
  }

  // ── RESULT (modo círculo) ──
  return (
    <div>
      <div style={{ ...S.cardHighlight, textAlign: "center" }}>
        <p style={S.bigReveal}>{deck.length > 0 ? "Partida terminada" : "Se acabó el mazo"}</p>
      </div>
      {current && (
        <div style={{ ...S.card, textAlign: "center" }}>
          <span style={S.label}>Quedó sin repartir</span>
          <CardView card={current} size="small" />
          <p style={{ ...S.muted, marginTop: 8 }}>
            Se cortó la partida justo cuando se estaba por decidir quién se la quedaba, así que no se le sumó a nadie.
          </p>
        </div>
      )}
      <Ranking players={players} counts={Object.fromEntries(players.map(p => [p.id, (piles[p.id] || []).length]))} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        <StartButton onClick={playAgain}>Jugar de nuevo</StartButton>
        <BackButton onClick={() => setPhase("setup")}>Volver al lobby</BackButton>
      </div>
    </div>
  );
}
