import { S } from "../../../theme/styles";
import { wordHint } from "@juntada/impostor-data";
import { Btn } from "../../../components/Btn";
import { Avatar } from "../../../components/Avatar";
import { CluesReview } from "./CluesReview";
import type { LocalPlayer, Round, Config } from "../types/localGame";

interface RevealScreenProps {
  round: Round;
  players: LocalPlayer[];
  config: Config;
  clues: Record<number, string>;
  setClues: (updater: (prev: Record<number, string>) => Record<number, string>) => void;
  revealIdx: number;
  setRevealIdx: (updater: (prev: number) => number) => void;
  handoffConfirmed: boolean;
  setHandoffConfirmed: (value: boolean) => void;
  wordVisible: boolean;
  setWordVisible: (updater: (prev: boolean) => boolean) => void;
  clueInput: string;
  setClueInput: (value: string) => void;
  goToDiscussion: () => void;
}

// The pass-and-play reveal phase: one player at a time confirms the handoff,
// taps to see their word/impostor status, optionally types a clue, then
// passes the device along — until everyone's gone, then moves to discussion.
export function RevealScreen({
  round,
  players,
  config,
  clues,
  setClues,
  revealIdx,
  setRevealIdx,
  handoffConfirmed,
  setHandoffConfirmed,
  wordVisible,
  setWordVisible,
  clueInput,
  setClueInput,
  goToDiscussion,
}: RevealScreenProps) {
  const alive = round.voters.map(id => players.find(p => p.id === id)).filter((p): p is LocalPlayer => Boolean(p));
  const player = alive[revealIdx];
  const isImpostor = round.impostors.includes(player.id);
  const isLast = revealIdx === alive.length - 1;
  const needsClue = config.writtenClues && !clueInput.trim();

  const advance = () => {
    if (config.writtenClues) setClues(c => ({ ...c, [player.id]: clueInput.trim() }));
    setWordVisible(() => false);
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
            <p style={{ margin: 0, fontSize: 13, color: "var(--jt-muted-text)" }}>Pasale el dispositivo a</p>
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
          border: wordVisible ? "1px solid rgba(224,32,43,0.4)" : "1px solid rgba(255,255,255,0.08)",
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
          <p style={{ color: "var(--jt-muted-text)", fontSize: 15 }}>Tocá para revelar tu palabra</p>
        ) : (
          <>
            {config.showCategory && (
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#FF3B3B",
                  margin: "0 0 8px",
                }}
              >
                {round.categoryLabel}
              </p>
            )}
            {isImpostor ? (
              <>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#F09595", margin: "0 0 8px" }}>Sos el impostor</p>
                {config.hintsEnabled && wordHint(round.categoryKey, round.word) && (
                  <p style={{ fontSize: 13, color: "var(--jt-muted-text)" }}>{wordHint(round.categoryKey, round.word)}</p>
                )}
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "var(--jt-muted-text)", marginBottom: 6 }}>Tu palabra</p>
                <p style={S.bigReveal}>{round.word}</p>
              </>
            )}
            <p style={{ fontSize: 12, color: "var(--jt-muted-text)", marginTop: 8 }}>Tocá para ocultar</p>
          </>
        )}
      </div>
      {config.writtenClues && <CluesReview clues={clues} players={players} label="Pistas" />}
      {config.writtenClues && (
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
      <Btn onClick={advance} disabled={needsClue}>
        {isLast ? "Todos listos, empezar" : "Siguiente jugador"}
      </Btn>
    </div>
  );
}
