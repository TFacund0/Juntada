import { useState } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
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
      <div className={T.card}>
        <label className="flex cursor-pointer items-center gap-2.5" onClick={onToggleTrackGoals}>
          <div className={T.toggle(trackGoals)}>
            <div className={T.knob(trackGoals)} />
          </div>
          <span className={clsx("text-[13px] font-semibold", trackGoals ? "text-[#5DCAA5]" : "text-[#6b6490]")}>
            {trackGoals ? "Contabilizar goles (goleador, valla menos vencida)" : "Solo ganador/perdedor, sin goles"}
          </span>
        </label>
      </div>

      <div className={T.card}>
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
        <div className={T.card}>
          <span className={T.label}>Equipos disponibles ({teams.length})</span>
          <div className="mb-2.5 flex flex-wrap gap-2">
            {teams.map(t => (
              <span key={t} className={clsx(T.pill(true), "cursor-pointer max-w-full")} onClick={() => onRemoveTeam(t)}>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">🏳️ {t}</span>{" "}
                <span className="ml-1 shrink-0 opacity-60">×</span>
              </span>
            ))}
          </div>
          {/* flex-wrap + min-w: sin esto, en un contenedor angosto el botón
              "Agregar" (no se achica más allá de su texto+padding) le comía
              casi todo el ancho al input flex-1, dejándolo inservible. */}
          <div className="flex flex-wrap gap-2">
            <input
              className={clsx(T.input, "min-w-[140px] flex-1")}
              placeholder="Agregar equipo..."
              value={newTeam}
              onChange={e => setNewTeam(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") addTeam();
              }}
            />
            <Btn variant="ghost" onClick={addTeam} className="w-auto px-[18px] py-[11px]">
              Agregar
            </Btn>
          </div>
          {teams.length < players.length && (
            <p className="mt-2 text-xs text-[#F09595]">Necesitás al menos {players.length} equipos (uno por jugador)</p>
          )}
        </div>
      )}

      {tab === "assign" && (
        <>
          <div className={T.card}>
            <div className="mb-4 text-center">
              <p className="mb-2.5 text-[13px] text-[#9089c0]">Asigná un equipo a cada jugador: con la ruleta o elegilo vos manualmente.</p>
              <Btn variant="success" onClick={runRouletteAll} disabled={!!spinningId || teams.length < players.length}>
                🎰 Girar la ruleta para todos
              </Btn>
              {teams.length < players.length && (
                <p className="mt-2.5 text-xs text-[#F09595]">
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
                <div key={p.id} className={clsx(i !== 0 && "mt-3.5 pt-3.5 border-t border-[rgba(127,119,221,0.12)]")}>
                  <div className={clsx("flex items-center gap-2.5", team && !isSpinning ? "mb-0" : "mb-3")}>
                    <Avatar name={p.name} size={32} />
                    <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-bold">{p.name}</span>
                    {isSpinning ? (
                      <span className="text-xs font-bold text-[#EF9F27]">Girando...</span>
                    ) : team ? (
                      <span className={clsx(T.pill(true), "cursor-pointer max-w-[55%] shrink-0")} onClick={() => clearAssignment(p.id)}>
                        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">🏳️ {team}</span>{" "}
                        <span className="ml-1 shrink-0 opacity-60">×</span>
                      </span>
                    ) : (
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => spinForPlayer(p.id)}
                          disabled={!!spinningId || noTeamsLeft}
                          title={noTeamsLeft ? "No quedan equipos disponibles" : undefined}
                          className={clsx(T.btn("success", !!spinningId || noTeamsLeft), "w-auto px-3 py-2 text-[13px]")}
                        >
                          🎰
                        </button>
                        <Btn
                          variant="ghost"
                          onClick={() => setManualPick(manualPick === p.id ? null : p.id)}
                          disabled={!!spinningId || noTeamsLeft}
                          className="w-auto px-3.5 py-2 text-[13px]"
                        >
                          Elegir equipo
                        </Btn>
                      </div>
                    )}
                  </div>

                  {!team && !isSpinning && noTeamsLeft && (
                    <p className="mt-2 text-xs text-[#F09595]">No quedan equipos disponibles — agregá más en la pestaña "Equipos".</p>
                  )}

                  {isSpinning && (
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap rounded-[10px] border border-[rgba(239,159,39,0.35)] bg-[rgba(239,159,39,0.1)] p-[10px_8px] text-center">
                      <span className="text-[15px] font-extrabold text-[#EF9F27]">🏳️ {spinLabel}</span>
                    </div>
                  )}

                  {!team && !isSpinning && manualPick === p.id && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {teams
                        .filter(t => !usedTeams.has(t))
                        .map(t => (
                          <button
                            key={t}
                            onClick={() => assignManually(p.id, t)}
                            className={clsx(T.btn("ghost"), "w-auto rounded-lg px-3.5 py-2 text-[13px]")}
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

          <div className={T.card}>
            <span className={T.label}>
              Equipos restantes ({teams.length - usedTeams.size} de {teams.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {teams.map(t => {
                const taken = usedTeams.has(t);
                const landed = !!spinningId && spinLabel === t;
                return (
                  <span
                    key={t}
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-[20px] px-3 py-1 text-xs font-bold max-w-full transition-[background,border-color,color] duration-[80ms]",
                      landed
                        ? "bg-[rgba(239,159,39,0.18)] text-[#EF9F27] border border-[rgba(239,159,39,0.5)]"
                        : taken
                          ? "bg-white/[0.03] text-[#4a4568] border border-white/[0.06] line-through"
                          : "bg-[rgba(93,202,165,0.1)] text-[#5DCAA5] border border-[rgba(93,202,165,0.3)]",
                    )}
                  >
                    🏳️ <span className="overflow-hidden text-ellipsis whitespace-nowrap">{t}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </>
      )}

      {tab === "bracket" && (
        <div className={T.card}>
          <span className={T.label}>Cruces de la primera ronda</span>
          <p className={clsx(T.muted, "mb-3")}>Cada par se enfrenta entre sí. Usá las flechas para reordenar, o sorteá el orden al azar.</p>
          <Btn variant="ghost" onClick={randomizeSeed} className="mb-3">
            🎲 Sortear cruces al azar
          </Btn>
          {seedWasDiscarded && (
            <p className="mb-3 text-xs text-[#E2C44A]">
              El orden que habían armado se reinició porque cambió la lista de jugadores — se volvió a un orden simple.
            </p>
          )}
          {byeCount > 0 && (
            <p className={clsx(T.muted, "mb-3")}>
              {order.length} jugadores no completan un cuadro parejo:{" "}
              {byeCount === 1 ? "el último de la lista" : `los últimos ${byeCount} de la lista`} pasa
              {byeCount === 1 ? "" : "n"} directo a la siguiente ronda (bye).
            </p>
          )}
          {order.length < 2 && <p className={T.muted}>Necesitás al menos 2 jugadores para armar los cruces.</p>}
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
              <div className="flex flex-1 min-w-0 items-center gap-2.5">
                <Avatar name={p.name} size={28} />
                <div className="flex-1 min-w-0">
                  <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold">{p.name}</p>
                  <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[#7F77DD]">
                    {assignments[p.id] || "sin equipo"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    onClick={() => idx > 0 && moveSeed(idx, -1)}
                    className={clsx(T.btn("ghost", idx === 0), "h-[18px] w-6 rounded-md p-0 text-[10px] leading-none")}
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => idx < order.length - 1 && moveSeed(idx, 1)}
                    className={clsx(T.btn("ghost", idx === order.length - 1), "h-[18px] w-6 rounded-md p-0 text-[10px] leading-none")}
                  >
                    ▼
                  </button>
                </div>
              </div>
            );

            return (
              <div key={pairIdx} className={T.bracketPairCard(isBye)}>
                <p
                  className={clsx(
                    "mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em]",
                    isBye ? "text-[#6b6490]" : "text-[#7F77DD]",
                  )}
                >
                  {isBye ? "Pasa directo (bye)" : `Cruce ${pairIdx + 1}`}
                </p>
                {row(pA, idxA)}
                {!isBye && (
                  <>
                    <div className="my-1.5 flex items-center gap-2.5">
                      <div className="h-px flex-1 bg-[rgba(127,119,221,0.18)]" />
                      <span className="text-[10px] font-extrabold text-[#6b6490]">VS</span>
                      <div className="h-px flex-1 bg-[rgba(127,119,221,0.18)]" />
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
