import { useState, useEffect } from "react";
import { S } from "../../theme/styles";
import { shuffle } from "../../utils/shuffle";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";
import type { ConfigPanelProps } from "../gameTypes";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ═══════════════════════════════════════════════════════════════════════════════
// TORNEO DE FÚTBOL — panel del anfitrión en el lobby multijugador. Acá se define la
// lista de equipos, se sortea (ruleta) o elige a mano el equipo de cada
// jugador conectado, y se arman los cruces de la primera ronda. Todo se
// sincroniza al resto de la sala vía updateConfig; el bracket recién se arma
// (server-side) cuando el host aprieta "Iniciar ronda".
// ═══════════════════════════════════════════════════════════════════════════════

export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const { players } = room;
  const config = room.config as { trackGoals: boolean; teams: string[]; assignments: Record<string, string>; seedOrder: string[] };
  const { trackGoals, teams, assignments, seedOrder } = config;
  const [newTeam, setNewTeam] = useState("");
  const [manualPick, setManualPick] = useState<string | null>(null);
  const [spinningId, setSpinningId] = useState<string | null>(null);
  const [spinLabel, setSpinLabel] = useState("");

  const usedTeams = new Set(Object.values(assignments || {}));
  const validSeed = Array.isArray(seedOrder) && seedOrder.length === players.length && players.every(p => seedOrder.includes(p.id));
  const order = validSeed ? seedOrder : players.map(p => p.id);

  useEffect(() => {
    if (!validSeed) updateConfig({ seedOrder: players.map(p => p.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.length, validSeed]);

  const addTeam = () => {
    const trimmed = newTeam.trim();
    if (!trimmed || teams.includes(trimmed)) return;
    updateConfig({ teams: [...teams, trimmed] });
    setNewTeam("");
  };

  const removeTeam = (t: string) => updateConfig({ teams: teams.filter(x => x !== t) });

  const assignManually = (playerId: string, team: string) => {
    updateConfig({ assignments: { ...assignments, [playerId]: team } });
    setManualPick(null);
  };

  const clearAssignment = (playerId: string) => {
    const next = { ...assignments };
    delete next[playerId];
    updateConfig({ assignments: next });
  };

  const spin = async (playerId: string, pool: string[], finalTeam: string) => {
    setSpinningId(playerId);
    let delay = 70;
    for (let i = 0; i < 18; i++) {
      setSpinLabel(pool[Math.floor(Math.random() * pool.length)]);
      await sleep(delay);
      delay += 12;
    }
    setSpinLabel(finalTeam);
    await sleep(500);
    setSpinningId(null);
  };

  const runRouletteAll = async () => {
    if (spinningId) return;
    const finalTeams = shuffle(teams).slice(0, players.length);
    let acc: Record<string, string> = {};
    updateConfig({ assignments: acc });
    for (let i = 0; i < players.length; i++) {
      await spin(players[i].id, teams, finalTeams[i]);
      acc = { ...acc, [players[i].id]: finalTeams[i] };
      updateConfig({ assignments: acc });
    }
  };

  const spinForPlayer = async (playerId: string) => {
    if (spinningId) return;
    const pool = teams.filter(t => !usedTeams.has(t));
    if (!pool.length) return;
    const finalTeam = pool[Math.floor(Math.random() * pool.length)];
    await spin(playerId, pool, finalTeam);
    updateConfig({ assignments: { ...assignments, [playerId]: finalTeam } });
  };

  const moveSeed = (idx: number, dir: number) => {
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= order.length) return;
    const next = [...order];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    updateConfig({ seedOrder: next });
  };

  const byeCount =
    order.length > 0
      ? (() => {
          let p = 1;
          while (p < order.length) p *= 2;
          return p - order.length;
        })()
      : 0;

  return (
    <div>
      <div style={S.card}>
        <label
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          onClick={() => updateConfig({ trackGoals: !trackGoals })}
        >
          <div style={S.toggle(trackGoals)}>
            <div style={S.knob(trackGoals)} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: trackGoals ? "#5DCAA5" : "#6b6490" }}>
            {trackGoals ? "Contabilizar goles (goleador, valla menos vencida)" : "Solo ganador/perdedor, sin goles"}
          </span>
        </label>
      </div>

      <div style={S.card}>
        <span style={S.label}>Equipos disponibles ({teams.length})</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {teams.map(t => (
            <span key={t} style={{ ...S.pill(true), cursor: "pointer", maxWidth: "100%" }} onClick={() => removeTeam(t)}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🏳️ {t}</span>{" "}
              <span style={{ marginLeft: 4, opacity: 0.6, flexShrink: 0 }}>×</span>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...S.input, flex: 1 }}
            placeholder="Agregar equipo..."
            value={newTeam}
            onChange={e => setNewTeam(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") addTeam();
            }}
          />
          <Btn variant="ghost" onClick={addTeam} style={{ width: "auto", padding: "11px 18px" }}>
            Agregar
          </Btn>
        </div>
        {teams.length < players.length && (
          <p style={{ fontSize: 12, color: "#F09595", marginTop: 8 }}>Necesitás al menos {players.length} equipos (uno por jugador)</p>
        )}
      </div>

      <div style={{ ...S.cardHighlight, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#9089c0", margin: "0 0 10px" }}>
          Asigná un equipo a cada jugador: con la ruleta o elegilo vos manualmente. Todos ven el resultado en vivo.
        </p>
        <Btn variant="success" onClick={runRouletteAll} disabled={!!spinningId || teams.length < players.length}>
          🎰 Girar la ruleta para todos
        </Btn>
      </div>

      <div style={S.card}>
        <span style={S.label}>
          Equipos restantes ({teams.length - usedTeams.size} de {teams.length})
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {teams.map(t => {
            const taken = usedTeams.has(t);
            const landed = !!spinningId && spinLabel === t;
            return (
              <span
                key={t}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  maxWidth: "100%",
                  transition: "background 0.08s, border-color 0.08s, color 0.08s",
                  background: landed ? "rgba(239,159,39,0.18)" : taken ? "rgba(255,255,255,0.03)" : "rgba(93,202,165,0.1)",
                  color: landed ? "#EF9F27" : taken ? "#4a4568" : "#5DCAA5",
                  border: `1px solid ${landed ? "rgba(239,159,39,0.5)" : taken ? "rgba(255,255,255,0.06)" : "rgba(93,202,165,0.3)"}`,
                  textDecoration: taken && !landed ? "line-through" : "none",
                }}
              >
                🏳️ <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</span>
              </span>
            );
          })}
        </div>
      </div>

      {players.map(p => {
        const team = assignments[p.id];
        const isSpinning = spinningId === p.id;
        return (
          <div key={p.id} style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: team && !isSpinning ? 0 : 12 }}>
              <Avatar name={p.name} size={32} />
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.name}
              </span>
              {isSpinning ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#EF9F27" }}>Girando...</span>
              ) : team ? (
                <span style={{ ...S.pill(true), cursor: "pointer", maxWidth: "55%", flexShrink: 0 }} onClick={() => clearAssignment(p.id)}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🏳️ {team}</span>{" "}
                  <span style={{ marginLeft: 4, opacity: 0.6, flexShrink: 0 }}>×</span>
                </span>
              ) : (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => spinForPlayer(p.id)}
                    disabled={!!spinningId}
                    style={{ ...S.btn("success", !!spinningId), width: "auto", padding: "8px 12px", fontSize: 13 }}
                  >
                    🎰
                  </button>
                  <Btn
                    variant="ghost"
                    onClick={() => setManualPick(manualPick === p.id ? null : p.id)}
                    disabled={!!spinningId}
                    style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}
                  >
                    Elegir equipo
                  </Btn>
                </div>
              )}
            </div>

            {isSpinning && (
              <div
                style={{
                  textAlign: "center",
                  padding: "10px 8px",
                  borderRadius: 10,
                  background: "rgba(239,159,39,0.1)",
                  border: "1px solid rgba(239,159,39,0.35)",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 800, color: "#EF9F27" }}>🏳️ {spinLabel}</span>
              </div>
            )}

            {!team && !isSpinning && manualPick === p.id && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {teams
                  .filter(t => !usedTeams.has(t))
                  .map(t => (
                    <button
                      key={t}
                      onClick={() => assignManually(p.id, t)}
                      style={{ ...S.btn("ghost"), width: "auto", padding: "8px 14px", fontSize: 13, borderRadius: 8 }}
                    >
                      {t}
                    </button>
                  ))}
              </div>
            )}
          </div>
        );
      })}

      <div style={S.card}>
        <span style={S.label}>Cruces de la primera ronda</span>
        <p style={{ ...S.muted, marginBottom: 12 }}>Cada par se enfrenta entre sí. Usá las flechas para reordenar.</p>
        {Array.from({ length: Math.ceil(order.length / 2) }, (_, pairIdx) => {
          const idxA = pairIdx * 2;
          const idxB = idxA + 1;
          const pA = players.find(x => x.id === order[idxA]);
          const pB = idxB < order.length ? players.find(x => x.id === order[idxB]) : null;
          const isBye = !pB || !pA;
          if (!pA) return null;

          const row = (p: typeof pA, idx: number) => (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              <Avatar name={p!.name} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p!.name}
                </p>
                <p
                  style={{ margin: 0, fontSize: 11, color: "#7F77DD", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {assignments[p!.id] || "sin equipo"}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                <button
                  onClick={() => idx > 0 && moveSeed(idx, -1)}
                  style={{ ...S.btn("ghost", idx === 0), width: 24, height: 18, padding: 0, borderRadius: 6, fontSize: 10, lineHeight: 1 }}
                >
                  ▲
                </button>
                <button
                  onClick={() => idx < order.length - 1 && moveSeed(idx, 1)}
                  style={{
                    ...S.btn("ghost", idx === order.length - 1),
                    width: 24,
                    height: 18,
                    padding: 0,
                    borderRadius: 6,
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                >
                  ▼
                </button>
              </div>
            </div>
          );

          return (
            <div
              key={pairIdx}
              style={{
                border: `1px solid ${isBye ? "rgba(255,255,255,0.08)" : "rgba(127,119,221,0.35)"}`,
                background: isBye ? "rgba(255,255,255,0.02)" : "rgba(127,119,221,0.06)",
                borderRadius: 12,
                padding: "10px 12px",
                marginBottom: 10,
              }}
            >
              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: isBye ? "#6b6490" : "#7F77DD",
                }}
              >
                {isBye ? "Pasa directo (bye)" : `Cruce ${pairIdx + 1}`}
              </p>
              {row(pA, idxA)}
              {!isBye && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0" }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(127,119,221,0.18)" }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#6b6490" }}>VS</span>
                    <div style={{ flex: 1, height: 1, background: "rgba(127,119,221,0.18)" }} />
                  </div>
                  {row(pB, idxB)}
                </>
              )}
            </div>
          );
        })}
        {byeCount > 0 && (
          <p style={{ ...S.muted, fontSize: 12 }}>
            {byeCount} jugador{byeCount > 1 ? "es" : ""} pasa{byeCount > 1 ? "n" : ""} directo por no completar un cuadro parejo.
          </p>
        )}
      </div>
    </div>
  );
}
