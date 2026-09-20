import { useEffect, useMemo, useRef, useState } from "react";
import { escapeHtml } from "@juntada/core-utils";
import "./css/index.css";
import {
  createInitialState,
  describeFireOutcome,
  describeFireResult,
  describeItemResult,
  describeSkippedTurn,
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
import { DirectionRing } from "./components/DirectionRing";
import { frontAngle, seatAngle, seatStyle, shortestGunAngle, shuffledBulletIcons } from "./utils/arena";
import { ITEM_ACTIVATE_MS, ROUND_INTRO_MS, DUEL_TRANSITION_MS } from "./utils/timing";
import { useLogVisible } from "./hooks/logVisibility";
import { useShotAnimation } from "./hooks/shotAnimation";
import { useChamberCountdown } from "./hooks/chamberCountdown";

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
// No separate "final" phase — the winner shows as an overlay on top of the
// duel screen (same as online, see showWinner below), not a hard cut to a
// different screen.
type Phase = "setup" | "reveal" | "duel";

interface DisplayLogLine extends LogLine {
  id: number;
  // 📞/🔍 only: what a shared-screen table sees before this line gets
  // redacted — see addItemLog below. Local pass-and-play has no server to
  // keep the real hint private (unlike online's revealPhoneHint/
  // revealLupaHint, see @juntada/recamara-engine), so the log itself has
  // to do the hiding once the device moves on to someone else: the line
  // reveals the real hint only while it's still privateToPlayerId's turn,
  // falling back to redactedText for everyone after.
  privateToPlayerId?: number;
  redactedText?: string;
}

// describeFireResult/describeItemResult (shared engine) take a name
// resolver rather than searching a Player[] themselves — this is that
// resolver for local, where ids are already the engine's own numeric ones.
function nameOf(players: Player[]): (id: number) => string {
  return id => escapeHtml(players.find(p => p.id === id)?.name ?? "?");
}

export function LocalGame() {
  const [names, setNames] = useState(["Jugador 1", "Jugador 2"]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [subPhase, setSubPhase] = useState<"reveal" | "duel">("reveal");
  const [winner, setWinner] = useState<Player | null>(null);
  // The winner overlay must never fight the final shot's own aim/fire/
  // result banner for the screen (see RoundView's identical gate) — winner
  // is already set the instant that shot resolves, well before its
  // animation finishes playing, so this waits for shotAnim to settle back
  // to idle (the player already tapped through the result banner) and adds
  // a short delay so the overlay fades in instead of popping the moment
  // that banner closes.
  const [showWinner, setShowWinner] = useState(false);
  // "reveal" itself has four beats, each its own screen, in order: a plain
  // "Ronda N" announcement, the chest-cycling ("chests") players open one
  // at a time, the "chamber" card (gun + real/falso shell count, held up
  // 5s), then a themed "duelTransition" flash on the way into the duel —
  // never combined into one screen, so a round change never reads as one
  // abrupt cut. roundNumber counts game start as round 1 and increments on
  // every reload.
  const [revealStage, setRevealStage] = useState<"announce" | "chests" | "chamber">("announce");
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
  // Set only when a reload just ended a round (never on the game's first
  // round) — tells RoundAnnounce to close out that round before crossfading
  // into the new one instead of jumping straight to the new number.
  const [endedRoundNumber, setEndedRoundNumber] = useState<number | null>(null);

  // The fire sequence is staged so each beat is actually visible: swing the
  // gun onto the target ("aiming"), fire it ("firing"), then hold on a
  // full-screen result banner until the player taps through ("result") —
  // only then does the engine result actually get committed to state. The
  // gun/recoil/flash/shell-casing mechanics themselves live in
  // useShotAnimation, shared with RoundView's online version of this same
  // beat — this component only decides *when* to trigger a shot and what
  // happens once its result banner is dismissed.
  const shotAnim = useShotAnimation();

  useEffect(() => {
    if (!winner || shotAnim.busy) {
      setShowWinner(false);
      return;
    }
    const t = setTimeout(() => setShowWinner(true), 900);
    return () => clearTimeout(t);
  }, [winner, shotAnim.busy]);

  const [pendingFire, setPendingFire] = useState<{ result: FireResult; playersBefore: Player[] } | null>(null);
  const [log, setLog] = useState<DisplayLogLine[]>([]);
  const logId = useRef(0);
  const [logVisible, toggleLogVisible] = useLogVisible();

  // Tapping a player opens their item list (read-only unless it's their own
  // turn); tapping one of your own items while it's your turn opens the big
  // confirmation modal, which first plays a short "activating" animation on
  // the icon before showing a result banner, same as firing does.
  const [sheetPlayerId, setSheetPlayerId] = useState<number | null>(null);
  const [pendingItem, setPendingItem] = useState<ItemKind | null>(null);
  const [activatingItem, setActivatingItem] = useState<ItemKind | null>(null);
  const [pendingItemResult, setPendingItemResult] = useState<ItemResult | null>(null);

  const addLog = (line: LogLine & { privateToPlayerId?: number; redactedText?: string }) => {
    logId.current += 1;
    setLog(l => [...l.slice(-5), { ...line, id: logId.current }]);
  };

  // 📞/🔍 reveal something only the player who used the item should
  // know — online keeps that private via the server (see
  // @juntada/recamara-engine's revealPhoneHint/revealLupaHint), but local
  // pass-and-play has no server, just a shared log everyone at the table
  // can read. Logging the real hint text is fine *while it's still that
  // player's turn* (the device is still in their hands), but it must stop
  // being readable the moment the turn moves on to someone else — so this
  // logs both the real line and a redacted fallback, and the log's render
  // picks between them based on whose turn it currently is.
  const addItemLog = (result: ItemResult, players: Player[]) => {
    const line = describeItemResult(result, nameOf(players));
    if (result.item !== "📞" && result.item !== "🔍") {
      addLog(line);
      return;
    }
    const redacted = describeItemResult(result, nameOf(players), {
      revealPhoneHint: result.item === "📞" ? false : undefined,
      revealLupaHint: result.item === "🔍" ? false : undefined,
    });
    addLog({ ...line, privateToPlayerId: result.playerId, redactedText: redacted.text });
  };

  const phase: Phase = !gameState ? "setup" : subPhase;
  const busy = shotAnim.busy || activatingItem !== null || pendingItemResult !== null;

  // Computed unconditionally (hooks can't live inside the phase branches
  // below) — shuffled once per round via useMemo so it doesn't reshuffle
  // on every unrelated re-render.
  const liveCount = gameState ? gameState.shells.filter(s => s.kind === "live").length : 0;
  const blankCount = gameState ? gameState.shells.length - liveCount : 0;
  const bulletIcons = useMemo(() => shuffledBulletIcons(liveCount, blankCount), [liveCount, blankCount, roundNumber]);

  const addPlayerName = () => setNames(n => (n.length < 6 ? [...n, `Jugador ${n.length + 1}`] : n));
  const removePlayerName = (i: number) => setNames(n => (n.length > 2 ? n.filter((_, idx) => idx !== i) : n));
  const renamePlayer = (i: number, v: string) => setNames(n => n.map((name, idx) => (idx === i ? v : name)));

  const startGame = () => {
    const state = createInitialState(names);
    setGameState(state);
    setSubPhase("reveal");
    setRevealStage("announce");
    setRoundNumber(1);
    setEndedRoundNumber(null);
    setRevealIdx(0);
    setRevealedCount(0);
    setWinner(null);
    setLog([]);
    // A fresh game means a fresh gun — otherwise the arena mounting for the
    // very first duel with these still at their default-but-never-reset
    // values wouldn't matter here (nothing fired yet), but it's paired with
    // the same reset below in continueAfterFire's reload branch, which does
    // matter (see that comment).
    shotAnim.resetForNewRound();
    addLog({ text: `Se cargó la recámara. Empieza <b>${escapeHtml(state.players[0].name)}</b>.` });
  };

  const revealNextItem = () => setRevealedCount(c => c + 1);

  const playAgain = () => {
    setGameState(null);
    setWinner(null);
  };

  const enterDuel = (state: GameState) => {
    shotAnim.setGunAngle(prev => shortestGunAngle(prev, frontAngle(state.order, state.order[state.turnPos])));
    // recoil/flash are plain booleans that only ever get set back to false
    // elsewhere on a *reload* — belt-and-suspenders here too, right at the
    // one moment the arena is about to (re)mount for this duel, so it can
    // never paint its very first frame with either class already on (which
    // plays the recoil/muzzle-flash animation immediately, reading as the
    // shotgun firing itself with no shot actually taken).
    shotAnim.resetRecoilFlash();
    setDuelTransition(true);
    setTimeout(() => {
      setDuelTransition(false);
      setSubPhase("duel");
    }, DUEL_TRANSITION_MS);
  };

  // The chamber card (gun + shell count) moves on by itself into the duel
  // after ROUND_INTRO_MS — everyone at the table gets the same few seconds
  // to actually look at it, not just whoever taps through fastest. Comes
  // after every player's chest is done, not before. Shared with RoundView's
  // version of this same countdown (there it sends ready_for_duel instead
  // of calling enterDuel directly) via useChamberCountdown.
  const introEndsAt = useChamberCountdown(
    phase === "reveal" && revealStage === "chamber" && !!gameState,
    ROUND_INTRO_MS,
    () => gameState && enterDuel(gameState),
  );

  // Eliminated players never draw new items on a reload (see
  // @juntada/recamara-engine's reloadIfNeeded) — they're pure spectators
  // now, so the chest-cycling reveal below only ever cycles through
  // whoever's still alive, same as the online mode's ready_for_duel gate.
  const aliveRevealOrder = (state: GameState) => state.order.filter(id => state.players.find(p => p.id === id)!.lives > 0);

  const advanceReveal = (state: GameState) => {
    const aliveOrder = aliveRevealOrder(state);
    if (revealIdx + 1 < aliveOrder.length) {
      const nextPlayer = state.players.find(p => p.id === aliveOrder[revealIdx + 1])!;
      setHandoffName(nextPlayer.name);
      setTimeout(() => {
        setHandoffName(null);
        setRevealIdx(i => i + 1);
        setRevealedCount(0);
      }, 800);
    } else {
      // Every alive player has opened their chest — on to the chamber card
      // (gun + shell count), not straight into the duel.
      setRevealStage("chamber");
    }
  };

  const fire = (targetId: number) => {
    if (busy || !gameState) return;
    const playersBefore = gameState.players;
    const result = fireShot(gameState, targetId);
    setPendingFire({ result, playersBefore });
    shotAnim.playShot(seatAngle(gameState.order, targetId), result.shellKind);
  };

  const continueAfterFire = () => {
    if (!pendingFire) return;
    const { result, playersBefore } = pendingFire;
    addLog(describeFireResult(result, nameOf(playersBefore)));
    result.skippedIds.forEach(id => addLog(describeSkippedTurn(id, nameOf(playersBefore))));
    setGameState(result.state);
    setPendingFire(null);
    shotAnim.finishShot();

    if (result.gameOver) {
      setWinner(result.winner);
      return;
    }
    if (result.reloaded) {
      addLog({ text: `Recámara vacía — se recarga y cada jugador recibe <b>${ITEMS_PER_RELOAD} ítems</b> nuevos.` });
      setEndedRoundNumber(roundNumber);
      setRoundNumber(n => n + 1);
      setRevealStage("announce");
      setRevealIdx(0);
      setRevealedCount(0);
      setSubPhase("reveal");
      // recoil/flash are plain booleans, never toggled back off after a shot
      // (the CSS keyframe animation itself decays, not this state) — fine
      // while the arena stays mounted, but the reveal beats ahead unmount it
      // entirely. Left at true, the next duel's arena would remount with
      // "recoil"/"flash" already on its very first paint, replaying both
      // animations immediately with no shot fired — reading as the shotgun
      // going off by itself right as the new round starts.
      shotAnim.resetForNewRound();
    } else {
      shotAnim.setGunAngle(prev => shortestGunAngle(prev, frontAngle(result.state.order, result.state.order[result.state.turnPos])));
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

  const useItemCuff = (targetId: number) => {
    if (!gameState || !pendingItem) return;
    showItemResult(applyItem(gameState, pendingItem, { targetId }));
  };

  const useItemCuffNoTarget = () => {
    if (!gameState || !pendingItem) return;
    showItemResult(applyItem(gameState, pendingItem));
  };

  const continueAfterItem = () => {
    if (!gameState || !pendingItemResult) return;
    addItemLog(pendingItemResult, gameState.players);
    setGameState(pendingItemResult.state);
    setPendingItemResult(null);
  };

  // ─── setup ───
  if (phase === "setup")
    return (
      <div className="recamara">
        <div className="setup-card">
          <h2>Jugadores (2 a 6)</h2>
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
            disabled={names.length >= 6}
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

  const state = gameState as GameState;

  // ─── reveal (game start, and every reload) ───
  if (phase === "reveal") {
    // Beat 1: a plain "Ronda N" announcement — nothing else on it, moves on
    // by itself shortly after, so the round change itself gets its own
    // moment before items/gun show up.
    if (revealStage === "announce")
      return (
        <RoundAnnounce
          roundNumber={roundNumber}
          previousRoundNumber={endedRoundNumber ?? undefined}
          // Round 1 plays with no items (see createInitialState) — nothing
          // for any chest to reveal yet, so skip straight to the chamber
          // instead of cycling through empty chests.
          onDone={() => setRevealStage(roundNumber === 1 ? "chamber" : "chests")}
        />
      );

    // Beat 2: the chest-cycling players open one at a time — items only,
    // nothing about the gun/shells here on purpose (that's its own separate
    // screen next, not mixed into this one).
    if (revealStage === "chests") {
      const aliveOrder = aliveRevealOrder(state);
      const revealPlayerId = aliveOrder[revealIdx];
      const revealPlayer = state.players.find(p => p.id === revealPlayerId)!;
      const revealNewItems = revealPlayer.lastGrantedItems;
      const isLastPlayer = revealIdx + 1 >= aliveOrder.length;
      const chestDone = revealedCount >= revealNewItems.length;

      return (
        <div className="recamara">
          <div className="rec-table">
            {aliveOrder.length > 1 && (
              <p className="reveal-progress mono">
                Jugador {revealIdx + 1} de {aliveOrder.length}
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
        showLegend={roundNumber === 1}
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
      <div className="rec-table">
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
          <DirectionRing direction={state.direction} />
          <div className="gun-aim" style={{ transform: `translate(-50%, -50%) rotate(${shotAnim.gunAngle}deg)` }}>
            <div className={`shotgun${shotAnim.recoil ? " recoil" : ""}${state.sawedOff ? " sawed" : ""}`}>
              <div className="stock" />
              <div className="barrel" />
              <div className={`muzzle${shotAnim.flash ? " flash" : ""}`} />
            </div>
          </div>

          {shotAnim.lastShell && (
            <div
              className={`last-shell ${shotAnim.lastShell}`}
              title={shotAnim.lastShell === "live" ? "Última bala: real" : "Última bala: falsa"}
              style={{
                left: `${shotAnim.shellPhase === "eject" ? 50 : shotAnim.shellSpot.left}%`,
                top: `${shotAnim.shellPhase === "eject" ? 50 : shotAnim.shellSpot.top}%`,
                transform: `translate(-50%, -50%) rotate(${shotAnim.shellPhase === "eject" ? 0 : shotAnim.shellSpot.rot}deg)`,
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
          <button type="button" className="log-toggle" onClick={toggleLogVisible}>
            {logVisible ? "Ocultar registro ▾" : "Mostrar registro ▸"}
          </button>
          {logVisible &&
            log.map((l, i) => {
              // Redact 📞/🔍's real hint the moment the turn moves on from
              // whoever used it — see addItemLog above.
              const text = l.privateToPlayerId != null && l.privateToPlayerId !== current.id ? (l.redactedText ?? l.text) : l.text;
              return <div key={`${l.id}-${i}`} className={`line${l.cls ? ` ${l.cls}` : ""}`} dangerouslySetInnerHTML={{ __html: text }} />;
            })}
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

      {shotAnim.fireStage === "result" &&
        pendingFire &&
        (() => {
          const outcome = describeFireOutcome(pendingFire.result, nameOf(pendingFire.playersBefore));
          const targetBefore = pendingFire.playersBefore.find(p => p.id === pendingFire.result.targetId);
          const targetAfter = pendingFire.result.state.players.find(p => p.id === pendingFire.result.targetId);
          const isElimination = (targetBefore?.lives ?? 0) > 0 && (targetAfter?.lives ?? 0) <= 0;
          const eliminatedName = isElimination ? targetBefore?.name : undefined;

          return (
            <OutcomeBanner
              line={{ text: outcome.actionLine }}
              subLine={{ text: outcome.shellLine, cls: outcome.cls }}
              isElimination={isElimination}
              eliminatedName={eliminatedName}
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
          onCuff={useItemCuff}
          onCuffNoTarget={useItemCuffNoTarget}
        />
      )}

      {showWinner && winner && (
        <div className="rec-overlay winner-overlay">
          <div className="rec-table final-card winner-in max-w-[420px]">
            <div className="rec-victory-callout">
              <span className="rec-victory-trophy">🏆</span>
              <p className="rec-victory-title display">¡VICTORIA!</p>
            </div>
            <p className="mono eyebrow">Fin del duelo</p>
            <p className="display winner">
              Gana <span>{winner.name}</span>
            </p>
            <div className="controls">
              <button className="act primary" onClick={playAgain}>
                Jugar de nuevo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
