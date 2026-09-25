import { useEffect, useRef, useState } from "react";
import { escapeHtml } from "@juntada/core-utils";
import "./css/index.css";
import {
  createInitialState,
  describeFireOutcome,
  describeFireResult,
  describeItemResult,
  describeSkippedTurn,
  fireShot,
  ITEMS_PER_RELOAD,
  useItem as applyItem,
  type FireResult,
  type GameState,
  type ItemKind,
  type ItemResult,
  type LogLine,
  type Player,
} from "@juntada/recamara-engine";
import { PlayerItemsSheet } from "./components/PlayerItemsSheet";
import { ItemUseModal } from "./components/ItemUseModal";
import { ResultBanner } from "./components/ResultBanner";
import { RoundOverlay } from "./components/RoundOverlay";
import { EndScreen } from "./components/EndScreen";
import { ItemEffect } from "./components/ItemEffect";
import { DuelScene } from "./components/DuelScene";
import { frontAngle, seatAngle, shortestGunAngle } from "./utils/arena";
import { localPlayingFx } from "./utils/playingFx";
import { itemBannerTitle, shotBanner } from "./utils/banners";
import { useLogVisible } from "./hooks/logVisibility";
import { useEventDirector } from "./hooks/eventDirector";
import { useRecamaraSfx } from "./hooks/recamaraSfx";
import { useEventSfx } from "./hooks/eventSfx";
import { useKnownShell } from "./hooks/knownShell";
import { statusLine } from "./utils/statusLine";
import { aimingAt, shellsLeft } from "./utils/scene";

// ═══════════════════════════════════════════════════════════════════════════
// RECÁMARA — un solo dispositivo, pasándoselo por turnos.
// Este componente es solo la capa de UI: todas las reglas del juego (armado
// de la recámara, daño, turnos, ítems) viven en engine.ts como funciones
// puras. Acá solo se llaman esas funciones y se decora el resultado con lo
// que es puramente visual — el recoil/flash/apuntado del arma, el overlay de
// cada ronda y el timing del log.
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

interface LocalShot {
  result: FireResult;
  playersBefore: Player[];
}

export function LocalGame() {
  const [names, setNames] = useState(["Jugador 1", "Jugador 2"]);
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
  // "reveal" is the round overlay (RoundOverlay) over the table: the shells
  // shown, flipped, shuffled and loaded, then the duel goes on right under
  // it. roundNumber counts game start as round 1 and increments on every
  // reload.
  const [roundNumber, setRoundNumber] = useState(1);

  // Shots and items resolve through the engine the instant they're chosen,
  // but go through the same event director RoundView uses: the result is
  // queued with its post-event state, the aim/fire (or item pulse) and the
  // result banner play out, and only once the banner is dismissed does
  // `gameState` (the director's `shown`) move to that state. Same beats and
  // timing as online, from the same code.
  const director = useEventDirector<GameState | null, LocalShot, ItemResult>(null, (shot, before) => ({
    angle: seatAngle(before?.order ?? [], shot.result.targetId),
    shellKind: shot.result.shellKind,
  }));
  const gameState = director.shown;
  const shotAnim = director.shotAnim;
  const busy = director.busy;
  const playingShot = director.current?.kind === "shot" ? director.current : null;
  const playingItem = director.current?.kind === "item" ? director.current : null;

  const sfx = useRecamaraSfx();
  const fx = localPlayingFx(director.current, gameState?.players ?? []);
  useEventSfx(fx, shotAnim.fireStage, sfx);
  const known = useKnownShell(fx, roundNumber);

  useEffect(() => {
    if (!winner || busy) {
      setShowWinner(false);
      return;
    }
    const t = setTimeout(() => setShowWinner(true), 900);
    return () => clearTimeout(t);
  }, [winner, busy]);

  const [log, setLog] = useState<DisplayLogLine[]>([]);
  const logId = useRef(0);
  const [logVisible, toggleLogVisible] = useLogVisible();

  // Tapping a player opens their item list (read-only unless it's their own
  // turn); tapping one of your own items while it's your turn opens the big
  // confirmation modal, which first plays a short "activating" animation on
  // the icon before showing a result banner, same as firing does.
  const [sheetPlayerId, setSheetPlayerId] = useState<number | null>(null);
  const [pendingItem, setPendingItem] = useState<ItemKind | null>(null);

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

  const addPlayerName = () => setNames(n => (n.length < 6 ? [...n, `Jugador ${n.length + 1}`] : n));
  const removePlayerName = (i: number) => setNames(n => (n.length > 2 ? n.filter((_, idx) => idx !== i) : n));
  const renamePlayer = (i: number, v: string) => setNames(n => n.map((name, idx) => (idx === i ? v : name)));

  const startGame = () => {
    const state = createInitialState(names);
    director.reset(state);
    setSubPhase("reveal");
    setRoundNumber(1);
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

  const playAgain = () => {
    director.reset(null);
    setWinner(null);
  };

  // The round overlay is done: aim the gun away from whoever starts and
  // hand the table over to the duel.
  const enterDuel = (state: GameState) => {
    shotAnim.setGunAngle(prev => shortestGunAngle(prev, frontAngle(state.order, state.order[state.turnPos])));
    shotAnim.resetRecoilFlash();
    setSubPhase("duel");
  };

  const fire = (targetId: number) => {
    if (busy || !gameState) return;
    const playersBefore = gameState.players;
    const result = fireShot(gameState, targetId);
    director.enqueue({ kind: "shot", payload: { result, playersBefore }, after: result.state });
  };

  const continueAfterFire = () => {
    if (!playingShot) return;
    const { result, playersBefore } = playingShot.payload;
    addLog(describeFireResult(result, nameOf(playersBefore)));
    result.skippedIds.forEach(id => addLog(describeSkippedTurn(id, nameOf(playersBefore))));
    director.finish();

    if (result.gameOver) {
      setWinner(result.winner);
      return;
    }
    if (result.reloaded) {
      addLog({ text: `Recámara vacía — se recarga y cada jugador recibe <b>${ITEMS_PER_RELOAD} ítems</b> nuevos.` });
      setRoundNumber(n => n + 1);
      setSubPhase("reveal");
      // Off the table go the last round's casing and the recoil/flash
      // classes (plain booleans that never switch themselves back off).
      shotAnim.resetForNewRound();
    } else {
      shotAnim.setGunAngle(prev => shortestGunAngle(prev, frontAngle(result.state.order, result.state.order[result.state.turnPos])));
    }
  };

  const showItemResult = (result: ItemResult) => {
    setPendingItem(null);
    setSheetPlayerId(null);
    director.enqueue({ kind: "item", payload: result, after: result.state });
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
    if (!gameState || !playingItem) return;
    addItemLog(playingItem.payload, gameState.players);
    director.finish();
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
          <button className="icon-btn w-full!" onClick={addPlayerName} disabled={names.length >= 6} title="Agregar jugador">
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

  const showOverlay = phase === "reveal" && !busy;

  // ─── duel ───
  const currentId = state.order[state.turnPos];
  const current = state.players.find(p => p.id === currentId)!;
  const alive = state.players.filter(p => p.lives > 0);
  const shell = state.shells[state.idx];
  const sheetPlayer = sheetPlayerId != null ? state.players.find(p => p.id === sheetPlayerId) : undefined;
  const canShoot = !busy && !!shell && phase === "duel";

  return (
    <div className="recamara">
      <DuelScene
        table={{
          order: state.order,
          players: state.players,
          currentId,
          direction: state.direction,
          sawedOff: state.sawedOff || fx?.item === "🪚",
          playing: fx,
          busy,
          shotAnim,
          onSelectPlayer: setSheetPlayerId,
          onFire: canShoot ? fire : undefined,
          hideItems: showOverlay,
          dealtRound: roundNumber > 1 ? roundNumber : undefined,
        }}
        roundNumber={roundNumber}
        shellsTotal={state.shells.length}
        shellsLeft={shellsLeft(state.shells, fx, shotAnim.fireStage)}
        known={known}
        status={statusLine({
          currentName: current.name,
          currentIsMe: false,
          passAndPlay: true,
          aiming: fx?.kind === "shot" ? aimingAt(fx, state.players, currentId) : null,
        })}
        canShoot={canShoot}
        onSelfFire={() => fire(current.id)}
        items={phase === "duel" ? current.items : null}
        itemsDisabled={busy}
        onUseItem={setPendingItem}
        // Redact 📞/🔍's real hint the moment the turn moves on from
        // whoever used it — see addItemLog above.
        log={log.map((l, i) => ({
          key: `${l.id}-${i}`,
          html: l.privateToPlayerId != null && l.privateToPlayerId !== current.id ? (l.redactedText ?? l.text) : l.text,
          cls: l.cls,
        }))}
        logVisible={logVisible}
        onToggleLog={toggleLogVisible}
        muted={sfx.muted}
        onToggleMute={sfx.toggleMuted}
      />

      {director.stage === "shot-result" &&
        playingShot &&
        (() => {
          const pendingFire = playingShot.payload;
          const outcome = describeFireOutcome(pendingFire.result, nameOf(pendingFire.playersBefore));
          const targetBefore = pendingFire.playersBefore.find(p => p.id === pendingFire.result.targetId);
          const targetAfter = pendingFire.result.state.players.find(p => p.id === pendingFire.result.targetId);
          const { result, playersBefore } = pendingFire;
          const banner = shotBanner({
            shellKind: result.shellKind,
            damage: result.damage,
            shooterName: playersBefore.find(p => p.id === result.shooterId)?.name ?? "",
            shooterIsMe: false,
            targetName: targetBefore?.name ?? "",
            targetIsMe: false,
            selfShot: result.targetId === result.shooterId,
            eliminated: (targetBefore?.lives ?? 0) > 0 && (targetAfter?.lives ?? 0) <= 0,
          });
          return (
            <ResultBanner
              key={playingShot.id}
              tone={banner.tone}
              big={banner.big}
              sub={banner.sub}
              whoHtml={outcome.actionLine}
              onContinue={continueAfterFire}
            />
          );
        })()}

      {director.stage === "item-result" &&
        playingItem &&
        (() => {
          const line = describeItemResult(playingItem.payload, nameOf(state.players));
          return (
            <ResultBanner
              key={playingItem.id}
              tone={line.cls === "danger" ? "live" : "blank"}
              big={itemBannerTitle(playingItem.payload.item)}
              subHtml={line.text}
              onContinue={continueAfterItem}
            />
          );
        })()}

      {director.stage === "item-activating" && fx?.kind === "item" && <ItemEffect fx={fx} />}

      {sheetPlayer && !pendingItem && !busy && (
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

      {showOverlay && (
        <RoundOverlay
          key={roundNumber}
          roundNumber={roundNumber}
          liveCount={state.shells.filter(s => s.kind === "live").length}
          blankCount={state.shells.filter(s => s.kind === "blank").length}
          sfx={sfx}
          onDone={() => enterDuel(state)}
        />
      )}

      {showWinner && winner && (
        <EndScreen title={`Ganó ${winner.name}`} sub="Última persona en la mesa.">
          <div className="controls">
            <button className="act primary" onClick={playAgain}>
              Jugar de nuevo
            </button>
          </div>
        </EndScreen>
      )}
    </div>
  );
}
