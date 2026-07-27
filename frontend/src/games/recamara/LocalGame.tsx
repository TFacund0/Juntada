import { useEffect, useMemo, useRef, useState } from "react";
import "./recamara.css";
import {
  createInitialState,
  describeFireOutcome,
  describeFireResult,
  describeItemResult,
  fireShot,
  ITEM_LABEL,
  ITEMS_PER_RELOAD,
  useItem as applyItem,
  type FireResult,
  type GameState,
  type ItemKind,
  type ItemResult,
  type LogLine,
  type Player,
  type ShellKind,
} from "@juntada/recamara-engine";
import { PlayerToken } from "./components/PlayerToken";
import { PlayerItemsSheet } from "./components/PlayerItemsSheet";
import { ItemUseModal } from "./components/ItemUseModal";
import { ChestReveal } from "./components/ChestReveal";
import { OutcomeBanner } from "./components/OutcomeBanner";
import { RoundAnnounce } from "./components/RoundAnnounce";
import { ChamberCard } from "./components/ChamberCard";
import { FlashOverlay } from "./components/FlashOverlay";
import { ItemActivatingOverlay } from "./components/ItemActivatingOverlay";
import { frontAngle, randomShellSpot, seatAngle, seatStyle, shuffledBulletIcons } from "./arena";
import { AIM_MS, SHOT_MS, ITEM_ACTIVATE_MS, ROUND_INTRO_MS, ROUND_ANNOUNCE_MS } from "./timing";

// ═══════════════════════════════════════════════════════════════════════════
// RECÁMARA — un solo dispositivo, pasándoselo por turnos.
// Este componente es solo la capa de UI: todas las reglas del juego (armado
// de la recámara, daño, turnos, ítems) viven en engine.ts como funciones
// puras. Acá solo se llaman esas funciones y se decora el resultado con lo
// que es puramente visual — el recoil/flash/apuntado del arma, el cofre de
// ítems y el timing del log.
// ═══════════════════════════════════════════════════════════════════════════

// "reveal" plays once at game start and again every time the chamber
// reloads mid-game — see fire()'s result.reloaded — before "duel" lets you
// actually shoot again.
type Phase = "setup" | "reveal" | "duel" | "final";

interface DisplayLogLine extends LogLine {
  id: number;
}

// describeFireResult/describeItemResult (shared engine) take a name
// resolver rather than searching a Player[] themselves — this is that
// resolver for local, where ids are already the engine's own numeric ones.
function nameOf(players: Player[]): (id: number) => string {
  return id => players.find(p => p.id === id)?.name ?? "?";
}

export function LocalGame() {
  const [names, setNames] = useState(["Jugador 1", "Jugador 2"]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [subPhase, setSubPhase] = useState<"reveal" | "duel">("reveal");
  const [winner, setWinner] = useState<Player | null>(null);
  // "reveal" itself has four beats, each its own screen, in order: a plain
  // "Ronda N" announcement, the chest-cycling ("chests") players open one
  // at a time, the "chamber" card (gun + real/falso shell count, held up
  // 5s), then a themed "duelTransition" flash on the way into the duel —
  // never combined into one screen, so a round change never reads as one
  // abrupt cut. roundNumber counts game start as round 1 and increments on
  // every reload.
  const [revealStage, setRevealStage] = useState<"announce" | "chests" | "chamber">("announce");
  const [introEndsAt, setIntroEndsAt] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [duelTransition, setDuelTransition] = useState(false);
  // During the "chests" beat, players claim their new items one at a time
  // (index into state.order) instead of all seeing them at once — see
  // ChestReveal. revealedCount is how many of *that* player's items have
  // been popped so far; both reset every time a fresh reveal starts.
  // handoffName is set while a "Turno de X" flash plays between one
  // player's chest and the next's, same idea as duelTransition.
  const [revealIdx, setRevealIdx] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [handoffName, setHandoffName] = useState<string | null>(null);

  const [recoil, setRecoil] = useState(false);
  const [flash, setFlash] = useState(false);
  // The fire sequence is staged so each beat is actually visible: swing the
  // gun onto the target ("aiming"), fire it ("firing"), then hold on a
  // full-screen result banner until the player taps through ("result") —
  // only then does the engine result actually get committed to state.
  const [fireStage, setFireStage] = useState<"idle" | "aiming" | "firing" | "result">("idle");
  const [pendingFire, setPendingFire] = useState<{ result: FireResult; playersBefore: Player[] } | null>(null);
  const [gunAngle, setGunAngle] = useState(0);
  // The shell casing ejected onto the table after the most recent shot —
  // only ever the last one, colored by real/blank, so it's the one place
  // bullet info is visible without exposing the rest of the chamber's
  // history. "eject" briefly parks it back at the gun before "landed"
  // flies it out to a fresh spot, so it visibly comes out of the gun each
  // time instead of just appearing.
  const [lastShell, setLastShell] = useState<ShellKind | null>(null);
  const [shellSpot, setShellSpot] = useState({ left: 50, top: 50, rot: 0 });
  const [shellPhase, setShellPhase] = useState<"eject" | "landed">("eject");
  const [log, setLog] = useState<DisplayLogLine[]>([]);
  const logId = useRef(0);

  // Tapping a player opens their item list (read-only unless it's their own
  // turn); tapping one of your own items while it's your turn opens the big
  // confirmation modal, which first plays a short "activating" animation on
  // the icon before showing a result banner, same as firing does.
  const [sheetPlayerId, setSheetPlayerId] = useState<number | null>(null);
  const [pendingItem, setPendingItem] = useState<ItemKind | null>(null);
  const [activatingItem, setActivatingItem] = useState<ItemKind | null>(null);
  const [pendingItemResult, setPendingItemResult] = useState<ItemResult | null>(null);

  const addLog = (line: LogLine) => {
    logId.current += 1;
    setLog(l => [...l.slice(-5), { ...line, id: logId.current }]);
  };

  const phase: Phase = !gameState ? "setup" : winner ? "final" : subPhase;
  const busy = fireStage !== "idle" || activatingItem !== null || pendingItemResult !== null;

  // The chamber card (gun + shell count) moves on by itself into the duel
  // after ROUND_INTRO_MS — everyone at the table gets the same few seconds
  // to actually look at it, not just whoever taps through fastest. Comes
  // after every player's chest is done, not before.
  useEffect(() => {
    if (phase !== "reveal" || revealStage !== "chamber" || !gameState) return;
    setIntroEndsAt(Date.now() + ROUND_INTRO_MS);
    const t = setTimeout(() => enterDuel(gameState), ROUND_INTRO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, revealStage, gameState]);

  // The plain "Ronda N" announcement moves on by itself into the chests —
  // brief on purpose, just registering the round changed before items show.
  useEffect(() => {
    if (phase !== "reveal" || revealStage !== "announce") return;
    const t = setTimeout(() => setRevealStage("chests"), ROUND_ANNOUNCE_MS);
    return () => clearTimeout(t);
  }, [phase, revealStage]);

  // Computed unconditionally (hooks can't live inside the phase branches
  // below) — shuffled once per round via useMemo so it doesn't reshuffle
  // on every unrelated re-render.
  const liveCount = gameState ? gameState.shells.filter(s => s.kind === "live").length : 0;
  const blankCount = gameState ? gameState.shells.length - liveCount : 0;
  const bulletIcons = useMemo(() => shuffledBulletIcons(liveCount, blankCount), [liveCount, blankCount, roundNumber]);

  const addPlayerName = () => setNames(n => (n.length < 4 ? [...n, `Jugador ${n.length + 1}`] : n));
  const removePlayerName = (i: number) => setNames(n => (n.length > 2 ? n.filter((_, idx) => idx !== i) : n));
  const renamePlayer = (i: number, v: string) => setNames(n => n.map((name, idx) => (idx === i ? v : name)));

  const startGame = () => {
    const state = createInitialState(names);
    setGameState(state);
    setSubPhase("reveal");
    setRevealStage("announce");
    setRoundNumber(1);
    setRevealIdx(0);
    setRevealedCount(0);
    setWinner(null);
    setLog([]);
    addLog({ text: `Se cargó la recámara. Empieza <b>${state.players[0].name}</b>.` });
  };

  const revealNextItem = () => setRevealedCount(c => c + 1);

  const playAgain = () => {
    setGameState(null);
    setWinner(null);
  };

  const enterDuel = (state: GameState) => {
    setGunAngle(frontAngle(state.order, state.order[state.turnPos]));
    setDuelTransition(true);
    setTimeout(() => {
      setDuelTransition(false);
      setSubPhase("duel");
    }, 800);
  };

  const advanceReveal = (state: GameState) => {
    if (revealIdx + 1 < state.order.length) {
      const nextPlayer = state.players.find(p => p.id === state.order[revealIdx + 1])!;
      setHandoffName(nextPlayer.name);
      setTimeout(() => {
        setHandoffName(null);
        setRevealIdx(i => i + 1);
        setRevealedCount(0);
      }, 800);
    } else {
      // Every player has opened their chest — on to the chamber card
      // (gun + shell count), not straight into the duel.
      setRevealStage("chamber");
    }
  };

  const fire = (targetId: number) => {
    if (busy || !gameState) return;
    const playersBefore = gameState.players;
    const result = fireShot(gameState, targetId);
    setPendingFire({ result, playersBefore });

    setFireStage("aiming");
    setGunAngle(seatAngle(gameState.order, targetId));

    setTimeout(() => {
      setFireStage("firing");
      setRecoil(false);
      requestAnimationFrame(() => setRecoil(true));
      if (result.shellKind === "live") {
        setFlash(false);
        requestAnimationFrame(() => setFlash(true));
      }

      // Park the shell back at the gun first (so it visibly comes out of
      // it every time, even after a previous shot already landed
      // somewhere), then fly it out to a fresh spot on the next frame.
      setLastShell(result.shellKind);
      setShellPhase("eject");
      const spot = randomShellSpot();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setShellSpot(spot);
          setShellPhase("landed");
        }),
      );

      setTimeout(() => setFireStage("result"), SHOT_MS);
    }, AIM_MS);
  };

  const continueAfterFire = () => {
    if (!pendingFire) return;
    const { result, playersBefore } = pendingFire;
    addLog(describeFireResult(result, nameOf(playersBefore)));
    setGameState(result.state);
    setPendingFire(null);
    setFireStage("idle");

    if (result.gameOver) {
      setWinner(result.winner);
      return;
    }
    if (result.reloaded) {
      addLog({ text: `Recámara vacía — se recarga y cada jugador recibe <b>${ITEMS_PER_RELOAD} ítems</b> nuevos.` });
      setRoundNumber(n => n + 1);
      setRevealStage("announce");
      setRevealIdx(0);
      setRevealedCount(0);
      setSubPhase("reveal");
    } else {
      setGunAngle(frontAngle(result.state.order, result.state.order[result.state.turnPos]));
    }
  };

  const showItemResult = (result: ItemResult) => {
    const item = pendingItem;
    setActivatingItem(item);
    setPendingItem(null);
    setSheetPlayerId(null);
    setTimeout(() => {
      setActivatingItem(null);
      setPendingItemResult(result);
    }, ITEM_ACTIVATE_MS);
  };

  const useItemSimple = () => {
    if (!gameState || !pendingItem) return;
    showItemResult(applyItem(gameState, pendingItem));
  };

  const useItemSteal = (targetId: number, stolenItem: ItemKind) => {
    if (!gameState || !pendingItem) return;
    showItemResult(applyItem(gameState, pendingItem, { targetId, stolenItem }));
  };

  const useItemStealNoTarget = () => {
    if (!gameState || !pendingItem) return;
    showItemResult(applyItem(gameState, pendingItem));
  };

  const continueAfterItem = () => {
    if (!gameState || !pendingItemResult) return;
    addLog(describeItemResult(pendingItemResult, nameOf(gameState.players)));
    setGameState(pendingItemResult.state);
    setPendingItemResult(null);
  };

  // ─── setup ───
  if (phase === "setup")
    return (
      <div className="recamara">
        <div className="setup-card">
          <h2>Jugadores (2 a 4)</h2>
          {names.map((name, i) => (
            <div className="name-row" key={i}>
              <input value={name} onChange={e => renamePlayer(i, e.target.value)} maxLength={16} placeholder={`Jugador ${i + 1}`} />
              <button className="icon-btn" onClick={() => removePlayerName(i)} disabled={names.length <= 2} title="Quitar">
                ✕
              </button>
            </div>
          ))}
          <button
            className="icon-btn"
            style={{ width: "100%" }}
            onClick={addPlayerName}
            disabled={names.length >= 4}
            title="Agregar jugador"
          >
            + Agregar jugador
          </button>
        </div>
        <div className="controls">
          <button className="act primary" onClick={startGame}>
            Cargar la recámara
          </button>
        </div>
      </div>
    );

  // ─── final ───
  if (phase === "final")
    return (
      <div className="recamara">
        <div className="table final-card">
          <p className="mono eyebrow">Fin del duelo</p>
          <p className="display winner">
            Gana <span>{winner ? winner.name : "nadie"}</span>
          </p>
        </div>
        <div className="controls">
          <button className="act primary" onClick={playAgain}>
            Jugar de nuevo
          </button>
        </div>
      </div>
    );

  const state = gameState as GameState;

  // ─── reveal (game start, and every reload) ───
  if (phase === "reveal") {
    // Beat 1: a plain "Ronda N" announcement — nothing else on it, moves on
    // by itself shortly after, so the round change itself gets its own
    // moment before items/gun show up.
    if (revealStage === "announce") return <RoundAnnounce roundNumber={roundNumber} />;

    // Beat 2: the chest-cycling players open one at a time — items only,
    // nothing about the gun/shells here on purpose (that's its own separate
    // screen next, not mixed into this one).
    if (revealStage === "chests") {
      const revealPlayerId = state.order[revealIdx];
      const revealPlayer = state.players.find(p => p.id === revealPlayerId)!;
      const revealNewItems = revealPlayer.items.slice(-ITEMS_PER_RELOAD);
      const isLastPlayer = revealIdx + 1 >= state.order.length;
      const chestDone = revealedCount >= revealNewItems.length;

      return (
        <div className="recamara">
          <div className="table">
            {state.order.length > 1 && (
              <p className="reveal-progress mono">
                Jugador {revealIdx + 1} de {state.order.length}
              </p>
            )}

            <ChestReveal player={revealPlayer} newItems={revealNewItems} revealedCount={revealedCount} onReveal={revealNextItem} />
          </div>
          <div className="controls">
            <button className="act primary" disabled={!chestDone || handoffName !== null} onClick={() => advanceReveal(state)}>
              {isLastPlayer ? "Ver la recámara" : "Siguiente jugador"}
            </button>
          </div>

          {/* Between one player's chest and the next's — plays right after
              "Siguiente jugador", before the next chest actually swaps in. */}
          {handoffName && <FlashOverlay text={`Turno de ${handoffName}`} />}
        </div>
      );
    }

    // Beat 3: the chamber card — gun + real/falso shell count, its own
    // separate screen (not mixed in with the chests above), held up for
    // ROUND_INTRO_MS with a visible countdown.
    return (
      <ChamberCard
        shellCount={state.shells.length}
        bulletIcons={bulletIcons}
        introEndsAt={introEndsAt}
        introMs={ROUND_INTRO_MS}
        controls={
          <button className="act primary" onClick={() => enterDuel(state)}>
            Empezar a disparar
          </button>
        }
        // Plays once the countdown above finishes (or the button's tapped
        // early), before subPhase actually flips to "duel".
        overlay={duelTransition && <FlashOverlay text="A disparar" />}
      />
    );
  }

  // ─── duel ───
  const currentId = state.order[state.turnPos];
  const current = state.players.find(p => p.id === currentId)!;
  const alive = state.players.filter(p => p.lives > 0);
  const shell = state.shells[state.idx];
  const sheetPlayer = sheetPlayerId != null ? state.players.find(p => p.id === sheetPlayerId) : undefined;

  return (
    <div className="recamara">
      <div className="table">
        <div className="turn-banner">
          <span className="dot" />
          <span className="txt">
            Turno de <strong>{current.name}</strong>
          </span>
          <span className="direction-tag" title={state.direction === 1 ? "Sentido horario" : "Sentido antihorario"}>
            {state.direction === 1 ? "↻" : "↺"}
          </span>
        </div>

        <div className={`arena${busy ? " busy" : ""}`}>
          <div className="gun-aim" style={{ transform: `translate(-50%, -50%) rotate(${gunAngle}deg)` }}>
            <div className={`shotgun${recoil ? " recoil" : ""}${state.sawedOff ? " sawed" : ""}`}>
              <div className="stock" />
              <div className="barrel" />
              <div className={`muzzle${flash ? " flash" : ""}`} />
            </div>
          </div>

          {lastShell && (
            <div
              className={`last-shell ${lastShell}`}
              title={lastShell === "live" ? "Última bala: real" : "Última bala: falsa"}
              style={{
                left: `${shellPhase === "eject" ? 50 : shellSpot.left}%`,
                top: `${shellPhase === "eject" ? 50 : shellSpot.top}%`,
                transform: `translate(-50%, -50%) rotate(${shellPhase === "eject" ? 0 : shellSpot.rot}deg)`,
              }}
            />
          )}

          {state.order.map(pid => {
            const player = state.players.find(p => p.id === pid);
            if (!player) return null;
            return (
              <PlayerToken
                key={pid}
                player={player}
                isActive={pid === currentId}
                style={seatStyle(state.order, pid)}
                onClick={() => !busy && setSheetPlayerId(pid)}
              />
            );
          })}
        </div>

        <div className="log">
          {log.map((l, i) => (
            <div key={`${l.id}-${i}`} className={`line${l.cls ? ` ${l.cls}` : ""}`} dangerouslySetInnerHTML={{ __html: l.text }} />
          ))}
        </div>

        <div className="controls">
          <button className="act primary" disabled={busy || !shell} onClick={() => fire(current.id)}>
            Dispararte a vos mismo
          </button>
          {alive
            .filter(p => p.id !== current.id)
            .map(p => (
              <button key={p.id} className="act" disabled={busy || !shell} onClick={() => fire(p.id)}>
                Dispararle a {p.name}
              </button>
            ))}
        </div>

        {current.items.length > 0 && (
          <div className="your-items">
            <span className="your-items-label">Tus ítems</span>
            <div className="your-items-row">
              {current.items.map((item, i) => (
                <button key={i} className="item-btn" disabled={busy} onClick={() => setPendingItem(item)} data-tooltip={ITEM_LABEL[item]}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {fireStage === "result" &&
        pendingFire &&
        (() => {
          const outcome = describeFireOutcome(pendingFire.result, nameOf(pendingFire.playersBefore));
          return (
            <OutcomeBanner
              line={{ text: outcome.actionLine }}
              subLine={{ text: outcome.shellLine, cls: outcome.cls }}
              onContinue={continueAfterFire}
            />
          );
        })()}

      {pendingItemResult && gameState && (
        <OutcomeBanner line={describeItemResult(pendingItemResult, nameOf(gameState.players))} onContinue={continueAfterItem} />
      )}

      {activatingItem && <ItemActivatingOverlay icon={activatingItem} />}

      {sheetPlayer && !pendingItem && !busy && !pendingItemResult && !activatingItem && (
        <PlayerItemsSheet
          player={sheetPlayer}
          interactive={sheetPlayer.id === currentId}
          onUseItem={item => setPendingItem(item)}
          onClose={() => setSheetPlayerId(null)}
        />
      )}

      {pendingItem && (
        <ItemUseModal
          item={pendingItem}
          opponents={alive.filter(p => p.id !== current.id)}
          onClose={() => setPendingItem(null)}
          onUseSimple={useItemSimple}
          onSteal={useItemSteal}
          onStealNoTarget={useItemStealNoTarget}
        />
      )}
    </div>
  );
}
