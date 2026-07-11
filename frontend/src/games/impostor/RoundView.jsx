import { useState, useEffect } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";
import { Timer } from "../../components/Timer";

function PlayerReadyPills({ players }) {
  return (
    <div style={{ ...S.card, marginTop: 16 }}>
      <span style={S.label}>Estado de jugadores</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {players.map(p => (
          <div key={p.id} style={S.pill(p.ready)}>{p.name}{p.ready ? " · listo" : ""}</div>
        ))}
      </div>
    </div>
  );
}

function CluesReview({ clues, players }) {
  const entries = Object.entries(clues || {}).filter(([, clue]) => clue);
  if (entries.length === 0) return null;
  return (
    <div style={S.card}>
      <span style={S.label}>Pistas</span>
      {entries.map(([playerId, clue]) => {
        const p = players.find(x => x.id === playerId);
        if (!p) return null;
        return <p key={playerId} style={{ fontSize: 14, margin: "4px 0", color: "#b8b0d4" }}><strong style={{ color: "#AFA9EC" }}>{p.name}:</strong> {clue}</p>;
      })}
    </div>
  );
}

// Covers this game's in-progress phases (round/discussion/voting/result)
// inside a multiplayer room. The generic shell (MultiplayerGame.jsx) only
// knows to render this while room.phase is one of those — everything about
// what those phases *mean* for Impostor lives here.
export function RoundView({ room, me, myPlayer, myRole, wordReveal, isHost, send }) {
  const [wordVisible, setWordVisible] = useState(false);
  const [skipRequested, setSkipRequested] = useState(false);
  const [clueText, setClueText] = useState("");
  const [clueSubmitted, setClueSubmitted] = useState(false);
  const [selectedSuspect, setSelectedSuspect] = useState(null);
  const [voteConfirmed, setVoteConfirmed] = useState(false);

  // A fresh private_role arrives on round start AND on a word reroll — either
  // way it's a new word, so re-hide it and clear per-round local UI state.
  useEffect(() => {
    setWordVisible(false);
    setSkipRequested(false);
    setClueText("");
    setClueSubmitted(false);
    setSelectedSuspect(null);
    setVoteConfirmed(false);
  }, [myRole]);

  // A tie triggers a fresh vote among just the tied suspects — clear the
  // previous selection/confirmation so nobody's stuck showing a stale vote.
  useEffect(() => {
    setSelectedSuspect(null);
    setVoteConfirmed(false);
  }, [room.round?.revoteCount]);

  if (room.phase === "round") {
    const myReadyState = myPlayer?.ready;
    const requiresWrittenClue = room.config.writtenClues;
    const canMarkReady = !requiresWrittenClue || clueSubmitted;

    const submitClue = () => {
      if (!clueText.trim()) return;
      send({ type: "submit_clue", clue: clueText.trim() });
      setClueSubmitted(true);
    };

    return (
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 11, letterSpacing: "0.1em", color: "#7F77DD", fontWeight: 700 }}>CATEGORÍA</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "#AFA9EC", margin: "4px 0" }}>
            {room.round?.categoryLabel}
          </p>
        </div>

        {room.round?.timerEnd && <Timer timerEnd={room.round.timerEnd} total={room.config.clueTime} />}

        <div style={{ ...S.card, textAlign: "center", cursor: myReadyState ? "default" : "pointer", minHeight: 140, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
          onClick={() => !myReadyState && setWordVisible(v => !v)}>
          {!myRole ? (
            <p style={{ color: "#6b6490" }}>Cargando tu rol...</p>
          ) : !wordVisible ? (
            <p style={{ color: "#6b6490", fontSize: 14 }}>Tocá para ver tu palabra</p>
          ) : myRole.isImpostor ? (
            <>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#F09595", margin: "0 0 8px" }}>Sos el impostor</p>
              {myRole.hint && <p style={{ fontSize: 13, color: "#9089c0" }}>{myRole.hint}</p>}
              <p style={{ fontSize: 12, color: "#5a5280", marginTop: 8 }}>Tocá para ocultar</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#9089c0", marginBottom: 4 }}>Tu palabra secreta</p>
              <p style={S.bigReveal}>{myRole.word}</p>
              <p style={{ fontSize: 12, color: "#5a5280", marginTop: 6 }}>Tocá para ocultar</p>
            </>
          )}
        </div>

        {room.round && !myReadyState && <div style={{ ...S.card, textAlign: "center" }}>
          {!skipRequested ? (
            <Btn variant="secondary" onClick={() => { setSkipRequested(true); send({ type: "skip_word" }); }}>
              No conozco esta palabra, pedir otra
            </Btn>
          ) : (
            <p style={{ fontSize: 13, color: "#9089c0" }}>
              Pediste cambiarla — {room.round.skipVotes}/{room.round.skipVotesNeeded} necesarios para cambiarla
            </p>
          )}
        </div>}

        {requiresWrittenClue && !myReadyState && (
          <div style={S.card}>
            <span style={S.label}>Tu pista</span>
            {!clueSubmitted ? (
              <>
                <input style={S.input} placeholder="Escribí tu pista..." value={clueText} onChange={e => setClueText(e.target.value)} />
                <Btn variant="secondary" disabled={!clueText.trim()} onClick={submitClue} style={{ marginTop: 8 }}>Enviar pista</Btn>
              </>
            ) : (
              <p style={{ color: "#5DCAA5", fontSize: 14 }}>Pista enviada: "{clueText}"</p>
            )}
          </div>
        )}

        <PlayerReadyPills players={room.players} />

        {!myReadyState && <Btn variant="success" disabled={!canMarkReady} onClick={() => send({ type: "player_ready" })} style={{ marginTop: 8 }}>Ya di mi pista, listo</Btn>}
        {myReadyState && <div style={{ ...S.card, textAlign: "center" }}><p style={{ color: "#5DCAA5" }}>Marcado como listo — esperando a los demás</p></div>}
      </div>
    );
  }

  if (room.phase === "discussion") {
    const myReadyState = myPlayer?.ready;
    return (
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: "#9089c0" }}>Momento de pensar</p>
          <p style={{ fontSize: 12, color: "#7F77DD" }}>Analicen las pistas antes de votar</p>
        </div>

        {room.round?.discussionEnd
          ? <Timer timerEnd={room.round.discussionEnd} total={room.config.discussionTime} />
          : <p style={{ ...S.muted, textAlign: "center" }}>Sin límite de tiempo — avancen cuando estén listos</p>}

        <CluesReview clues={room.round?.clues} players={room.players} />

        <PlayerReadyPills players={room.players} />

        {!myReadyState && <Btn variant="success" onClick={() => send({ type: "player_ready" })} style={{ marginTop: 8 }}>Listo para votar</Btn>}
        {myReadyState && <div style={{ ...S.card, textAlign: "center" }}><p style={{ color: "#5DCAA5" }}>Listo — esperando a los demás para pasar a la votación</p></div>}
      </div>
    );
  }

  if (room.phase === "voting") {
    const totalVoted = room.players.filter(p => p.hasVoted).length;
    const revoteCandidates = room.round?.revoteCandidates;
    const isRevote = !!revoteCandidates;
    const suspects = room.players.filter(p => p.id !== me.playerId && (!revoteCandidates || revoteCandidates.includes(p.id)));

    const confirmVote = () => {
      if (!selectedSuspect) return;
      send({ type: "vote", suspectId: selectedSuspect });
      setVoteConfirmed(true);
    };

    return (
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: "#9089c0" }}>¿Quién es el impostor?</p>
          <p style={{ fontSize: 12, color: "#7F77DD" }}>{totalVoted}/{room.players.length} confirmaron su voto</p>
        </div>

        {isRevote && (
          <div style={{ ...S.card, textAlign: "center", border: "1px solid rgba(226,196,74,0.35)", background: "rgba(226,196,74,0.08)" }}>
            <p style={{ fontSize: 14, color: "#E2C44A", fontWeight: 700, margin: 0 }}>Hubo un empate</p>
            <p style={{ fontSize: 13, color: "#b8b0d4", marginTop: 4 }}>Se vota de nuevo solo entre los más votados</p>
          </div>
        )}

        <CluesReview clues={room.round?.clues} players={room.players} />

        {!voteConfirmed ? (
          <>
            <p style={{ fontSize: 14, color: "#9089c0", marginBottom: 12, textAlign: "center" }}>Elegí a quién sospechás y confirmá</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {suspects.map(p => (
                <button key={p.id} onClick={() => setSelectedSuspect(p.id)}
                  style={{ ...S.btn(selectedSuspect === p.id ? "danger" : "secondary"), display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", textAlign: "left", borderRadius: 12 }}>
                  <Avatar name={p.name} size={36} />
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>{p.name}</span>
                </button>
              ))}
            </div>
            <Btn variant="success" disabled={!selectedSuspect} onClick={confirmVote}>Confirmar voto</Btn>
          </>
        ) : (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ fontSize: 15, color: "#9089c0" }}>Voto confirmado. Esperando a los demás</p>
            <p style={{ fontSize: 13, color: "#5a5280", marginTop: 6 }}>
              {totalVoted}/{room.players.length} confirmaron su voto
            </p>
          </div>
        )}
      </div>
    );
  }

  if (room.phase === "result") {
    const round = room.round;
    const lastH = room.roundHistory?.[room.roundHistory.length - 1];
    const word = wordReveal?.word || lastH?.word;
    const catLabel = wordReveal?.categoryLabel || lastH?.categoryLabel;
    const eliminated = room.players.find(p => p.id === round?.eliminated);
    const wasImpostor = round?.wasImpostor ?? lastH?.wasImpostor;
    const impostors = round ? room.players.filter(p => round.impostors?.includes(p.id)) : [];
    const tally = round?.votes || lastH?.tally || {};

    return (
      <div>
        <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: wasImpostor ? "#5DCAA5" : "#F09595", marginTop: 8 }}>
            {wasImpostor ? "Impostor atrapado" : "El impostor escapó"}
          </p>
        </div>

        {word && <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#9089c0" }}>La palabra era</p>
          <p style={{ fontSize: 30, fontWeight: 800, color: "#AFA9EC", margin: "4px 0" }}>{word}</p>
          <p style={{ fontSize: 13, color: "#7F77DD" }}>{catLabel}</p>
        </div>}

        {impostors.length > 0 && <div style={S.card}>
          <span style={S.label}>Impostores</span>
          {impostors.map(p => <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}><Avatar name={p.name} size={32} /><span style={{ fontWeight: 700 }}>{p.name}</span></div>)}
        </div>}

        {eliminated && <div style={S.card}>
          <span style={S.label}>Eliminado</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={eliminated.name} size={36} />
            <span style={{ fontWeight: 700 }}>{eliminated.name}</span>
            <span style={S.pill(wasImpostor)}>{wasImpostor ? "Era el impostor" : "Era inocente"}</span>
          </div>
        </div>}

        <div style={S.card}>
          <span style={S.label}>Votos</span>
          {room.players.map(p => {
            const pid = p.id;
            const count = Object.values(tally).filter(v => v === pid).length;
            const total = room.players.length - 1 || 1;
            const isImp = round?.impostors?.includes(pid) || lastH?.impostors?.includes(pid);
            return <div key={pid} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 13 }}>{p.name}</span><span style={S.muted}>{count} votos</span></div>
              <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}><div style={{ height: "100%", borderRadius: 3, width: `${Math.round((count / total) * 100)}%`, background: isImp ? "#E24B4A" : "#534AB7", transition: "width 0.6s" }} /></div>
            </div>;
          })}
        </div>

        {isHost && <Btn variant="success" onClick={() => send({ type: "start_round" })}>Nueva ronda</Btn>}
        {isHost && <Btn variant="secondary" onClick={() => send({ type: "back_to_lobby" })} style={{ marginTop: 10 }}>Volver al lobby</Btn>}
        {!isHost && <div style={{ ...S.card, textAlign: "center" }}><p style={{ color: "#9089c0", fontSize: 14 }}>Esperando que el anfitrión inicie otra ronda</p></div>}
      </div>
    );
  }

  return null;
}
