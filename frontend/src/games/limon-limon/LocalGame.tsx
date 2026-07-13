import { useState, useEffect } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";
import { buildDeck, buildDefaultDescriptions, getDescription } from "./deck";
import type { Card } from "./deck";
import { CardView } from "./CardView";
import { DescriptionsEditor } from "./DescriptionsEditor";

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

function nextTurnId(players: LocalPlayer[], currentId: number | null): number {
  const ids = players.map(p => p.id);
  const idx = ids.indexOf(currentId as number);
  if (idx === -1) return ids[0];
  return ids[(idx + 1) % ids.length];
}

function Ranking({ players, piles }: { players: LocalPlayer[]; piles: Record<number, Card[]> }) {
  const ranked = players.map(p => ({ ...p, count: (piles[p.id] || []).length })).sort((a, b) => b.count - a.count);
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
  const [players, setPlayers] = useState<LocalPlayer[]>([
    { id: 1, name: "Jugador 1" },
    { id: 2, name: "Jugador 2" },
    { id: 3, name: "Jugador 3" },
  ]);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");
  const [descriptions, setDescriptions] = useState(buildDefaultDescriptions());

  const [deck, setDeck] = useState<Card[]>([]);
  const [current, setCurrent] = useState<Card | null>(null);
  const [turnId, setTurnId] = useState<number | null>(null);
  const [piles, setPiles] = useState<Record<number, Card[]>>({});
  const [showRanking, setShowRanking] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [votingEnd, setVotingEnd] = useState(false);
  const [endVotes, setEndVotes] = useState<number[]>([]); // ids que votaron terminar antes

  // Con la mitad (redondeando para arriba) de los jugadores votando, se corta
  // la partida ya y se muestra la tabla tal cual está en ese momento.
  useEffect(() => {
    if (phase === "play" && endVotes.length > 0 && endVotes.length >= Math.ceil(players.length / 2)) {
      setPhase("result");
    }
  }, [endVotes, players.length, phase]);

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

  const addPlayer = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (isDuplicateName(trimmed, null)) {
      setNameError("Ya hay un jugador con ese nombre");
      return;
    }
    setNameError("");
    setPlayers(p => [...p, { id: Date.now(), name: trimmed }]);
    setNewName("");
    setAddingPlayer(false);
  };

  const startGame = () => {
    setDeck(buildDeck());
    setCurrent(null);
    setPiles({});
    setTurnId(players[0].id);
    setShowRanking(false);
    setAddingPlayer(false);
    setVotingEnd(false);
    setEndVotes([]);
    setPhase("play");
  };

  const playAgain = () => {
    setDeck(buildDeck());
    setCurrent(null);
    setPiles({});
    setTurnId(players[0].id);
    setShowRanking(false);
    setAddingPlayer(false);
    setVotingEnd(false);
    setEndVotes([]);
    setPhase("play");
  };

  const reveal = () => {
    if (current || deck.length === 0) return;
    const next = [...deck];
    const card = next.pop()!;
    setDeck(next);
    setCurrent(card);
  };

  const assign = (targetId: number) => {
    if (!current) return;
    setPiles(prev => ({ ...prev, [targetId]: [...(prev[targetId] || []), current] }));
    const finishedTurnId = turnId;
    setCurrent(null);
    if (deck.length === 0) {
      setPhase("result");
    } else {
      setTurnId(nextTurnId(players, finishedTurnId));
    }
  };

  const turnPlayer = players.find(p => p.id === turnId);
  const endThreshold = Math.ceil(players.length / 2);
  const toggleEndVote = (id: number) => setEndVotes(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  // ── SETUP ──
  if (phase === "setup")
    return (
      <div>
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
          {nameError && <p style={{ fontSize: 12, color: "#F09595", marginTop: 8 }}>{nameError}</p>}
        </div>

        <DescriptionsEditor descriptions={descriptions} onChange={(key, value) => setDescriptions(d => ({ ...d, [key]: value }))} />

        <Btn onClick={startGame} disabled={players.length < MIN_PLAYERS}>
          Empezar a jugar
        </Btn>
        {players.length < MIN_PLAYERS && (
          <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Necesitás mínimo {MIN_PLAYERS} jugadores</p>
        )}
      </div>
    );

  // ── PLAY (ronda en círculo) ──
  if (phase === "play")
    return (
      <div>
        {!current && (
          <p style={{ textAlign: "center", fontSize: 14, color: "#9089c0", marginBottom: 14 }}>
            Turno de <strong style={{ color: "#5DCAA5" }}>{turnPlayer?.name}</strong> — toquen el mazo
          </p>
        )}

        <CardView card={current} onClick={!current ? reveal : undefined} />

        <p style={{ textAlign: "center", ...S.muted, margin: "10px 0 0" }}>Quedan {deck.length} cartas en el mazo</p>

        {current && (
          <div style={{ ...S.cardHighlight, marginTop: 14 }}>
            {getDescription(descriptions, current) && (
              <p style={{ textAlign: "center", fontSize: 13, color: "#b8b0d4", margin: "0 0 12px" }}>
                "{getDescription(descriptions, current)}"
              </p>
            )}
            <span style={{ ...S.label, textAlign: "center", display: "block" }}>¿Quién se la queda?</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
              {players.map(p => (
                <button
                  key={p.id}
                  onClick={() => assign(p.id)}
                  style={{
                    ...S.btn("ghost"),
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    justifyContent: "flex-start",
                    padding: "10px 14px",
                  }}
                >
                  <Avatar name={p.name} size={26} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 14, marginBottom: 14 }}>
          <button onClick={() => setShowRanking(v => !v)} style={{ ...S.btn("ghost"), flex: 1, fontSize: 13 }}>
            {showRanking ? "Ocultar puntaje" : "Ver puntaje"}
          </button>
          <button onClick={() => setAddingPlayer(v => !v)} style={{ ...S.btn("ghost"), flex: 1, fontSize: 13 }}>
            + Sumar jugador
          </button>
          <button
            onClick={() => setVotingEnd(v => !v)}
            style={{ ...S.btn(endVotes.length > 0 ? "danger" : "ghost"), flex: 1, fontSize: 13 }}
          >
            Terminar antes {endVotes.length > 0 ? `(${endVotes.length}/${endThreshold})` : ""}
          </button>
        </div>

        {showRanking && <Ranking players={players} piles={piles} />}

        {addingPlayer && (
          <div style={S.card}>
            <span style={S.label}>Sumar jugador</span>
            <div style={{ display: "flex", gap: 8 }}>
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
                Sumar
              </Btn>
            </div>
            {nameError && <p style={{ fontSize: 12, color: "#F09595", marginTop: 8 }}>{nameError}</p>}
          </div>
        )}

        {votingEnd && (
          <div style={S.card}>
            <span style={S.label}>
              Votar terminar antes ({endVotes.length}/{endThreshold})
            </span>
            <p style={{ ...S.muted, marginTop: -6, marginBottom: 10 }}>
              Con la mitad de los jugadores votando, se corta la partida y se muestra la tabla como está ahora.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {players.map(p => {
                const voted = endVotes.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleEndVote(p.id)}
                    style={{
                      ...S.btn(voted ? "danger" : "ghost"),
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      justifyContent: "flex-start",
                      padding: "10px 14px",
                    }}
                  >
                    <Avatar name={p.name} size={26} />
                    <span>{p.name}</span>
                    {voted && <span style={{ marginLeft: "auto", fontSize: 12 }}>votó ✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Btn variant="ghost" onClick={() => setPhase("setup")} style={{ marginTop: 4 }}>
          Abandonar partida
        </Btn>
      </div>
    );

  // ── RESULT ──
  return (
    <div>
      <div style={{ ...S.cardHighlight, textAlign: "center" }}>
        <p style={S.bigReveal}>{deck.length > 0 ? "Partida terminada por votación" : "Se acabó el mazo"}</p>
      </div>
      {current && (
        <div style={{ ...S.card, textAlign: "center" }}>
          <span style={S.label}>Quedó sin repartir</span>
          <CardView card={current} size="small" />
          <p style={{ ...S.muted, marginTop: 8 }}>
            Se votó terminar justo cuando se estaba por decidir quién se la quedaba, así que no se le sumó a nadie.
          </p>
        </div>
      )}
      <Ranking players={players} piles={piles} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        <Btn variant="success" onClick={playAgain}>
          Jugar de nuevo
        </Btn>
        <Btn variant="ghost" onClick={() => setPhase("setup")}>
          Volver a jugadores
        </Btn>
      </div>
    </div>
  );
}
