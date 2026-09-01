import { useState } from "react";
import { S } from "../../../theme/styles";
import { Btn } from "../../../components/ui/Btn";
import { Avatar } from "../../../components/ui/Avatar";
import { TabRow } from "../../../components/setup/TabRow";
import { shuffle } from "@juntada/core-utils";
import { nextPowerOf2 } from "@juntada/torneo-futbol-bracket";

// ═══════════════════════════════════════════════════════════════════════════════
// Shared "Equipos / Asignar / Cruces" config UI for Torneo de Fútbol — used
// identically by the online lobby's ConfigPanel and local mode's setup
// screen (both just wire it to their own way of persisting state: updateConfig
// over the socket for online, plain useState for local). Keeping this in one
// place means a tweak to how team assignment or bracket seeding works only
// has to happen once.
// ═══════════════════════════════════════════════════════════════════════════════

export interface TeamConfigPlayer<Id extends string | number> {
  id: Id;
  name: string;
}

type ConfigTab = "teams" | "assign" | "bracket";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface TeamConfigPanelProps<Id extends string | number> {
  players: TeamConfigPlayer<Id>[];
  teams: string[];
  onAddTeam: (name: string) => void;
  onRemoveTeam: (name: string) => void;
  assignments: Record<Id, string>;
  // Always called with a full replacement object (not a patch) — the online
  // caller forwards it straight to updateConfig, the local one to setState,
  // neither needs to merge anything itself.
  setAssignments: (next: Record<Id, string>) => void;
  seedOrder: Id[];
  setSeedOrder: (next: Id[]) => void;
  trackGoals: boolean;
  onToggleTrackGoals: () => void;
}

export function TeamConfigPanel<Id extends string | number>({
  players,
  teams,
  onAddTeam,
  onRemoveTeam,
  assignments,
  setAssignments,
  seedOrder,
  setSeedOrder,
  trackGoals,
  onToggleTrackGoals,
}: TeamConfigPanelProps<Id>) {
  const [tab, setTab] = useState<ConfigTab>("teams");
  const [newTeam, setNewTeam] = useState("");
  const [manualPick, setManualPick] = useState<Id | null>(null);
  const [spinningId, setSpinningId] = useState<Id | null>(null);
  const [spinLabel, setSpinLabel] = useState("");

  // Only counts assignments that still belong to a current player — a kicked
  // or departed player's old pick otherwise lingers in `assignments` forever
  // (nothing clears it when they leave the room), permanently marking their
  // team "taken" for everyone else even though nobody actually has it.
  const usedTeams = new Set(players.filter(p => assignments[p.id]).map(p => assignments[p.id]));
  const validSeed = seedOrder.length === players.length && players.every(p => seedOrder.includes(p.id));
  const order = validSeed ? seedOrder : players.map(p => p.id);
  // A previously-arranged seed goes invalid the moment the roster changes
  // (someone joins/leaves) — silently falling back to plain player order
  // with no explanation would look like the host's manual arrangement was
  // just ignored.
  const seedWasDiscarded = seedOrder.length > 0 && !validSeed;

  const addTeam = () => {
    const trimmed = newTeam.trim();
    if (!trimmed || teams.includes(trimmed)) return;
    onAddTeam(trimmed);
    setNewTeam("");
  };

  const assignManually = (playerId: Id, team: string) => {
    setAssignments({ ...assignments, [playerId]: team });
    setManualPick(null);
  };

  const clearAssignment = (playerId: Id) => {
    const next = { ...assignments };
    delete next[playerId];
    setAssignments(next);
  };

  const spin = async (playerId: Id, pool: string[], finalTeam: string) => {
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
    let acc = {} as Record<Id, string>;
    setAssignments(acc);
    // Each spin's animation should only ever roll through teams nobody's
    // landed on yet in this run — shrink the pool as each player gets their
    // final team, same as spinForPlayer already does for a single player.
    let pool = [...teams];
    for (let i = 0; i < players.length; i++) {
      await spin(players[i].id, pool, finalTeams[i]);
      pool = pool.filter(t => t !== finalTeams[i]);
      acc = { ...acc, [players[i].id]: finalTeams[i] };
      setAssignments(acc);
    }
  };

  const spinForPlayer = async (playerId: Id) => {
    if (spinningId) return;
    const pool = teams.filter(t => !usedTeams.has(t));
    if (!pool.length) return;
    const finalTeam = pool[Math.floor(Math.random() * pool.length)];
    await spin(playerId, pool, finalTeam);
    setAssignments({ ...assignments, [playerId]: finalTeam });
  };

  const moveSeed = (idx: number, dir: number) => {
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= order.length) return;
    const next = [...order];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    setSeedOrder(next);
  };

  const randomizeSeed = () => setSeedOrder(shuffle(order));

  const size = nextPowerOf2(order.length);
  const byeCount = size - order.length;
  // Mirrors buildBracket's own round-0 layout (see
  // packages/torneo-futbol-bracket): the first `normalPairs` entries of
  // `order`, taken two at a time, are real matches; every entrant after
  // that gets their own solo bye — byes are never paired with each other,
  // even when there are 2+ of them.
  const pairCount = size / 2;
  const normalPairs = pairCount - byeCount;

  return (
    <>
      <div style={S.card}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={onToggleTrackGoals}>
          <div style={S.toggle(trackGoals)}>
            <div style={S.knob(trackGoals)} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: trackGoals ? "#5DCAA5" : "#6b6490" }}>
            {trackGoals ? "Contabilizar goles (goleador, valla menos vencida)" : "Solo ganador/perdedor, sin goles"}
          </span>
        </label>
      </div>

      <div style={S.card}>
        <TabRow
          tabs={[
            { key: "teams", label: "Equipos" },
            { key: "assign", label: "Asignar" },
            { key: "bracket", label: "Cruces" },
          ]}
          active={tab}
          onChange={setTab}
          compact
        />
      </div>

      {tab === "teams" && (
        <div style={S.card}>
          <span style={S.label}>Equipos disponibles ({teams.length})</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {teams.map(t => (
              <span key={t} style={{ ...S.pill(true), cursor: "pointer", maxWidth: "100%" }} onClick={() => onRemoveTeam(t)}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🏳️ {t}</span>{" "}
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
      )}

      {tab === "assign" && (
        <>
          <div style={S.card}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: "#9089c0", margin: "0 0 10px" }}>
                Asigná un equipo a cada jugador: con la ruleta o elegilo vos manualmente.
              </p>
              <Btn variant="success" onClick={runRouletteAll} disabled={!!spinningId || teams.length < players.length}>
                🎰 Girar la ruleta para todos
              </Btn>
              {teams.length < players.length && (
                <p style={{ fontSize: 12, color: "#F09595", marginTop: 10 }}>
                  Necesitás al menos {players.length} equipos para poder sortear — agregá {players.length - teams.length} más en la pestaña
                  "Equipos".
                </p>
              )}
            </div>

            {players.map((p, i) => {
              const team = assignments[p.id];
              const isSpinning = spinningId === p.id;
              const noTeamsLeft = teams.filter(t => !usedTeams.has(t)).length === 0;
              return (
                <div
                  key={p.id}
                  style={{
                    paddingTop: i === 0 ? 0 : 14,
                    marginTop: i === 0 ? 0 : 14,
                    borderTop: i === 0 ? undefined : "1px solid rgba(127,119,221,0.12)",
                  }}
                >
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
                      <span
                        style={{ ...S.pill(true), cursor: "pointer", maxWidth: "55%", flexShrink: 0 }}
                        onClick={() => clearAssignment(p.id)}
                      >
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🏳️ {team}</span>{" "}
                        <span style={{ marginLeft: 4, opacity: 0.6, flexShrink: 0 }}>×</span>
                      </span>
                    ) : (
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => spinForPlayer(p.id)}
                          disabled={!!spinningId || noTeamsLeft}
                          title={noTeamsLeft ? "No quedan equipos disponibles" : undefined}
                          style={{ ...S.btn("success", !!spinningId || noTeamsLeft), width: "auto", padding: "8px 12px", fontSize: 13 }}
                        >
                          🎰
                        </button>
                        <Btn
                          variant="ghost"
                          onClick={() => setManualPick(manualPick === p.id ? null : p.id)}
                          disabled={!!spinningId || noTeamsLeft}
                          style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}
                        >
                          Elegir equipo
                        </Btn>
                      </div>
                    )}
                  </div>

                  {!team && !isSpinning && noTeamsLeft && (
                    <p style={{ fontSize: 12, color: "#F09595", margin: "8px 0 0" }}>
                      No quedan equipos disponibles — agregá más en la pestaña "Equipos".
                    </p>
                  )}

                  {isSpinning && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "10px 8px",
                        borderRadius: 10,
                        background: "rgba(239,159,39,0.1)",
                        border: "1px solid rgba(239,159,39,0.35)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
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
        </>
      )}

      {tab === "bracket" && (
        <div style={S.card}>
          <span style={S.label}>Cruces de la primera ronda</span>
          <p style={{ ...S.muted, marginBottom: 12 }}>
            Cada par se enfrenta entre sí. Usá las flechas para reordenar, o sorteá el orden al azar.
          </p>
          <Btn variant="ghost" onClick={randomizeSeed} style={{ marginBottom: 12 }}>
            🎲 Sortear cruces al azar
          </Btn>
          {seedWasDiscarded && (
            <p style={{ fontSize: 12, color: "#E2C44A", marginBottom: 12 }}>
              El orden que habían armado se reinició porque cambió la lista de jugadores — se volvió a un orden simple.
            </p>
          )}
          {byeCount > 0 && (
            <p style={{ ...S.muted, marginBottom: 12 }}>
              {order.length} jugadores no completan un cuadro parejo:{" "}
              {byeCount === 1 ? "el último de la lista" : `los últimos ${byeCount} de la lista`} pasa
              {byeCount === 1 ? "" : "n"} directo a la siguiente ronda (bye).
            </p>
          )}
          {order.length < 2 && <p style={S.muted}>Necesitás al menos 2 jugadores para armar los cruces.</p>}
          {Array.from({ length: pairCount }, (_, pairIdx) => {
            const isRealPair = pairIdx < normalPairs;
            const idxA = isRealPair ? pairIdx * 2 : normalPairs * 2 + (pairIdx - normalPairs);
            const idxB = isRealPair ? idxA + 1 : null;
            const idA = order[idxA];
            const idB = idxB != null ? order[idxB] : null;
            const pA = players.find(x => x.id === idA);
            const pB = idB != null ? players.find(x => x.id === idB) : null;
            const isBye = !pB || !pA;
            if (!pA) return null;

            const row = (p: TeamConfigPlayer<Id>, idx: number) => (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <Avatar name={p.name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{ margin: 0, fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {p.name}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: "#7F77DD",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {assignments[p.id] || "sin equipo"}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                  <button
                    onClick={() => idx > 0 && moveSeed(idx, -1)}
                    style={{
                      ...S.btn("ghost", idx === 0),
                      width: 24,
                      height: 18,
                      padding: 0,
                      borderRadius: 6,
                      fontSize: 10,
                      lineHeight: 1,
                    }}
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
                    {row(pB!, idxB!)}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
