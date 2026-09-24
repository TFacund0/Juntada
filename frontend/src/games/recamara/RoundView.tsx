import { useEffect, useMemo, useRef, useState } from "react";
import "./css/index.css";
import { LeaveToLobbyButton } from "../../components/game-kit/LeaveToLobbyButton";
import { StartButton } from "../../components/setup/StartButton";
import {
  describeFireOutcome,
  describeItemResult,
  ITEM_LABEL,
  type ItemKind,
  type RecamaraRoundView,
  type ShellKind,
} from "@juntada/recamara-engine";
import { PlayerItemsSheet } from "./components/PlayerItemsSheet";
import { ItemUseModal } from "./components/ItemUseModal";
import { ChestReveal } from "./components/ChestReveal";
import { OutcomeBanner } from "./components/OutcomeBanner";
import { RoundAnnounce } from "./components/RoundAnnounce";
import { ChamberCard } from "./components/ChamberCard";
import { ItemActivatingOverlay } from "./components/ItemActivatingOverlay";
import { DuelTable } from "./components/DuelTable";
import { SoundToggle } from "./components/SoundToggle";
import { FlashOverlay } from "./components/FlashOverlay";
import { frontAngle, shortestGunAngle, shuffledBulletIcons } from "./utils/arena";
import { ROUND_INTRO_MS, DUEL_TRANSITION_MS } from "./utils/timing";
import { useLogVisible } from "./hooks/logVisibility";
import { useDuelEntryFlash } from "./hooks/duelTransition";
import { useOnlineRoundDirector } from "./hooks/onlineRoundDirector";
import { useRecamaraSfx } from "./hooks/recamaraSfx";
import { useEventSfx } from "./hooks/eventSfx";
import { useChamberCountdown } from "./hooks/chamberCountdown";
import type { RoundViewProps } from "../gameTypes";

// ═══════════════════════════════════════════════════════════════════════════
// RECÁMARA — modo online. Mismo duelo que el modo local (misma UI incluso:
// PlayerToken/ChestReveal/ItemUseModal/PlayerItemsSheet/OutcomeBanner se
// reusan tal cual) pero el estado real vive en el servidor
// (backend/src/games/recamara/engine.ts) — acá solo se renderiza `room.round`
// y se manda `fire`/`use_item`/`ready_for_duel`. Cada disparo/uso de ítem ya
// se aplicó en el servidor para cuando este componente se entera; la
// animación de acá es puramente una puesta en escena de algo que ya pasó,
// no algo que se está decidiendo en el cliente — ver useOnlineRoundDirector,
// que encola cada disparo/ítem y los reproduce de a uno.
// ═══════════════════════════════════════════════════════════════════════════

export function RoundView({ room, me, isHost, send, myRole }: RoundViewProps) {
  // RecamaraRoundView (see @juntada/recamara-engine) is the exact shape
  // backend/src/games/recamara/engine.ts's getPublicRoundView is typed to
  // return — one shared definition instead of two hand-mirrored copies
  // that could silently drift apart on a field rename.
  const liveRound = room.round as RecamaraRoundView | null;
  const myPlayerId = me?.playerId ?? null;

  // Every server update carries its event (a shot, an item) together with
  // the state *after* it. The director queues those and only lets `round`
  // (what this component renders) advance once each event's animation has
  // played and its banner was dismissed — so a shot fired while this client
  // is still watching the previous one waits its turn, and lives/turn/log
  // never spoil an outcome mid-animation. See useOnlineRoundDirector.
  const director = useOnlineRoundDirector(liveRound);
  const round = director.shown;
  const shotAnim = director.shotAnim;
  const busy = director.busy;

  const sfx = useRecamaraSfx();
  const playing = director.current;
  useEventSfx(
    playing && {
      id: playing.id,
      kind: playing.kind,
      shellKind: playing.kind === "shot" ? playing.payload.shellKind : undefined,
      targetIsMe: playing.kind === "shot" && playing.payload.targetId === myPlayerId,
      item: playing.kind === "item" ? playing.payload.item : undefined,
    },
    shotAnim.fireStage,
    sfx,
  );

  // Reveal: each player pops their own chest at their own pace (see
  // ChestReveal) — purely client-side, since the items themselves were
  // never secret (same as local mode, just one shared screen there).
  const lastRoundNumberRef = useRef(0);
  // Set only when a reload just ended a round (never for the very first
  // round we ever see) — tells RoundAnnounce to close out that round before
  // crossfading into the new one instead of jumping straight to the new
  // number.
  const [endedRoundNumber, setEndedRoundNumber] = useState<number | null>(null);
  const [revealStage, setRevealStage] = useState<"announce" | "chests" | "chamber">("announce");
  const [revealedCount, setRevealedCount] = useState(0);
  const [readySent, setReadySent] = useState(false);

  const [sheetPlayerId, setSheetPlayerId] = useState<number | null>(null);
  const [pendingItem, setPendingItem] = useState<ItemKind | null>(null);
  const [showWinner, setShowWinner] = useState(false);
  const [logVisible, toggleLogVisible] = useLogVisible();
  // Same "A disparar" beat LocalGame plays itself before flipping its own
  // subPhase — here subPhase flips server-side with no transition of its
  // own, so this holds the switch to the duel view back for the same
  // beat, flash overlaid on whichever reveal screen is still showing.
  const { flashing: duelTransition, showDuel } = useDuelEntryFlash(round?.subPhase === "duel", DUEL_TRANSITION_MS);

  // A fresh reveal beat (game start, or right after a reload) resets the
  // local chest/ready UI. `round` only reaches the new roundNumber once the
  // reloading shot's banner was dismissed, so that shot always finishes
  // playing out first.
  useEffect(() => {
    if (!round) return;
    if (round.roundNumber !== lastRoundNumberRef.current) {
      // 0 is the ref's initial sentinel (never a real round number), so the
      // very first round we ever see never gets a "terminada" beat, only
      // reloads after it do.
      setEndedRoundNumber(lastRoundNumberRef.current || null);
      lastRoundNumberRef.current = round.roundNumber;
      setRevealStage("announce");
      setRevealedCount(0);
      setReadySent(false);
      // recoil/flash are plain booleans, never toggled back off after a shot
      // (the CSS keyframe animation itself decays, not this state) — fine
      // while the arena stays mounted, but the reveal beats ahead unmount it
      // entirely. Left at true, the next duel's arena would remount with
      // "recoil"/"flash" already on its very first paint, replaying both
      // animations immediately with no shot fired — reading as the shotgun
      // going off by itself right as the new round starts.
      shotAnim.resetForNewRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.roundNumber]);

  // The chamber card (gun + shell count) moves on by itself — sending
  // ready_for_duel — after ROUND_INTRO_MS, once your own chest is done.
  // Every player gets the same few seconds to actually look at the gun/
  // shell count, not just whoever taps through fastest. Shared with
  // LocalGame's version of this same countdown (there it calls enterDuel
  // directly instead of sending ready_for_duel) via useChamberCountdown.
  const myEngineId = round?.seatOrder.indexOf(myPlayerId ?? "") ?? -1;
  const myPlayer = round?.state.players.find(p => p.id === myEngineId);
  const amAlive = !myPlayer || myPlayer.lives > 0;

  const introEndsAt = useChamberCountdown(round?.subPhase === "reveal" && revealStage === "chamber", ROUND_INTRO_MS, () => {
    if (amAlive) {
      send({ type: "ready_for_duel" });
    }
    setReadySent(true);
  });

  // Idle aim: whenever nothing's mid-animation, the gun rests pointing away
  // from whoever's turn it currently is. Also the one guaranteed moment the
  // duel arena settles at rest — recoil/flash only ever get reset to false
  // elsewhere on a *reload* (see the round-change effect above), so
  // re-asserting them false here too covers every path into "resting" (in
  // particular the arena's very first mount into a fresh duel), so it can
  // never paint recoil/flash already on and immediately replay the
  // recoil/muzzle-flash animation with no shot actually fired.
  useEffect(() => {
    if (!round || round.subPhase !== "duel" || busy) return;
    const currentEngineId = round.state.order[round.state.turnPos];
    shotAnim.setGunAngle(prev => shortestGunAngle(prev, frontAngle(round.state.order, currentEngineId)));
    shotAnim.resetRecoilFlash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.subPhase, round?.state.turnPos, round?.state.order, busy]);

  // The final shot's own aim/fire/result banner must fully play out and get
  // dismissed before the winner overlay is allowed to appear — `round` only
  // reaches the winning state once that banner is gone, and `busy` also
  // covers anything still queued behind it. The extra timeout is purely a
  // beat of breathing room so the overlay fades in rather than popping the
  // instant the last banner closes.
  useEffect(() => {
    if (!round?.winnerRoomId || busy) {
      setShowWinner(false);
      return;
    }
    const t = setTimeout(() => setShowWinner(true), 900);
    return () => clearTimeout(t);
  }, [round?.winnerRoomId, busy]);

  // Shuffled once per round via useMemo so it doesn't reshuffle on every
  // unrelated re-render (this component re-renders on every server update).
  const bulletIcons = useMemo(
    () => shuffledBulletIcons(round?.liveCount ?? 0, round?.blankCount ?? 0),
    [round?.liveCount, round?.blankCount, round?.roundNumber],
  );

  if (!round || !myPlayerId) return null;

  const nameFor = (roomId: string | null): string => {
    if (!roomId) return "";
    return room.players.find(p => p.id === roomId)?.name ?? "";
  };

  const { stage } = director;
  const playingShot = director.current?.kind === "shot" ? director.current : null;
  const playingItem = director.current?.kind === "item" ? director.current : null;
  const state = round.state;

  if ((round.subPhase === "reveal" || !showDuel) && !busy) {
    // Only alive players draw new items on a reload (see
    // @juntada/recamara-engine's reloadIfNeeded) and only alive players are
    // required to confirm ready_for_duel (see the backend engine's
    // readyForDuel) — so this "waiting" list only ever shows who's still in
    // the duel, and an eliminated player never has to click through their
    // own (empty) chest/chamber beats either.
    const alivePlayerIds = new Set(round.state.players.filter(p => p.lives > 0).map(p => round.seatOrder[p.id]));

    if (readySent) {
      return (
        <div className="recamara">
          <div className="rec-table text-center">
            <p className="mono eyebrow">{amAlive ? "Esperando a los demás" : "Estás eliminado — mirando la partida"}</p>
            <div className="mt-3 flex flex-col gap-1.5">
              {round.seatOrder
                .filter(id => alivePlayerIds.has(id))
                .map(id => (
                  <p key={id} className="m-0">
                    {round.readyForDuel.includes(id) ? "✅" : "⏳"} {nameFor(id)}
                  </p>
                ))}
            </div>
          </div>
          {duelTransition && <FlashOverlay text="A disparar" />}
        </div>
      );
    }

    // Beat 1: a plain "Ronda N" announcement — nothing else on it, moves on
    // by itself shortly after, so the round change itself gets its own
    // moment before items/gun show up.
    if (revealStage === "announce")
      return (
        <RoundAnnounce
          roundNumber={round.roundNumber}
          previousRoundNumber={endedRoundNumber ?? undefined}
          // Round 1 plays with no items (see createInitialState), and eliminated
          // players never draw items either — so skip straight to the chamber
          // card instead of showing an empty chest.
          onDone={() => setRevealStage(!amAlive || round.roundNumber === 1 ? "chamber" : "chests")}
        />
      );

    // Beat 2: your own chest, items only — nothing about the gun/shells
    // here on purpose (that's its own separate screen next).
    if (revealStage === "chests") {
      const myNewItems = myPlayer?.lastGrantedItems ?? [];
      const chestDone = revealedCount >= myNewItems.length;
      return (
        <div className="recamara">
          <div className="rec-table">
            <ChestReveal
              player={myPlayer ?? { id: myEngineId, name: "Vos", lives: 0, items: [], lastGrantedItems: [] }}
              newItems={myNewItems}
              revealedCount={revealedCount}
              onReveal={() => setRevealedCount(c => c + 1)}
            />
          </div>
          <div className="controls">
            <button className="act primary" disabled={!chestDone} onClick={() => setRevealStage("chamber")}>
              Ver la recámara
            </button>
          </div>
        </div>
      );
    }

    // Beat 3: the chamber card — gun + real/falso shell count, held up for
    // ROUND_INTRO_MS with a visible countdown before signaling ready.
    return (
      <ChamberCard
        shellCount={round.state.shells.length}
        bulletIcons={bulletIcons}
        introEndsAt={introEndsAt}
        introMs={ROUND_INTRO_MS}
        showLegend={round.roundNumber === 1}
        controls={
          amAlive ? (
            <button
              className="act primary"
              onClick={() => {
                send({ type: "ready_for_duel" });
                setReadySent(true);
              }}
            >
              Listo, a disparar
            </button>
          ) : (
            <button className="act cursor-default! opacity-75!" disabled>
              👁️ Mirando como espectador
            </button>
          )
        }
        overlay={duelTransition && <FlashOverlay text="A disparar" />}
      />
    );
  }

  // ─── duel ───
  const currentEngineId = state.order[state.turnPos];
  const current = state.players.find(p => p.id === currentEngineId)!;
  const currentRoomId = round.seatOrder[currentEngineId];
  const alive = state.players.filter(p => p.lives > 0);
  const isMyTurn = currentRoomId === myPlayerId;
  const sheetPlayer = sheetPlayerId != null ? state.players.find(p => p.id === sheetPlayerId) : undefined;

  const fire = (targetRoomId: string) => {
    if (busy || !isMyTurn) return;
    send({ type: "fire", targetId: targetRoomId });
  };
  const useItemSimple = () => {
    if (!pendingItem) return;
    send({ type: "use_item", item: pendingItem });
    setPendingItem(null);
  };
  const useItemSteal = (targetEngineId: number, stolenItem: ItemKind) => {
    if (!pendingItem) return;
    send({ type: "use_item", item: pendingItem, targetId: round.seatOrder[targetEngineId], stolenItem });
    setPendingItem(null);
  };
  const useItemStealNoTarget = () => {
    if (!pendingItem) return;
    send({ type: "use_item", item: pendingItem });
    setPendingItem(null);
  };
  const useItemCuff = (targetEngineId: number) => {
    if (!pendingItem) return;
    send({ type: "use_item", item: pendingItem, targetId: round.seatOrder[targetEngineId] });
    setPendingItem(null);
  };
  const useItemCuffNoTarget = () => {
    if (!pendingItem) return;
    send({ type: "use_item", item: pendingItem });
    setPendingItem(null);
  };

  return (
    <div className="recamara">
      <div className="rec-table">
        <div className="turn-banner">
          <SoundToggle muted={sfx.muted} onToggle={sfx.toggleMuted} />
          <span className="dot" />
          <span className="txt">
            Turno de <strong>{isMyTurn ? "vos" : current.name}</strong>
          </span>
          <span className="direction-tag" title={state.direction === 1 ? "Sentido horario" : "Sentido antihorario"}>
            {state.direction === 1 ? "↻" : "↺"}
          </span>
        </div>

        <DuelTable
          order={state.order}
          players={state.players}
          currentId={currentEngineId}
          direction={state.direction}
          sawedOff={state.sawedOff}
          busy={busy}
          shotAnim={shotAnim}
          onSelectPlayer={setSheetPlayerId}
          nameFor={p => (p.id === myEngineId ? "Vos" : p.name)}
        />

        <div className="log">
          <button type="button" className="log-toggle" onClick={toggleLogVisible}>
            {logVisible ? "Ocultar registro ▾" : "Mostrar registro ▸"}
          </button>
          {logVisible &&
            round.log.map((l, i) => (
              <div key={i} className={`line${l.cls ? ` ${l.cls}` : ""}`} dangerouslySetInnerHTML={{ __html: l.text }} />
            ))}
        </div>

        {isMyTurn && (
          <div className="controls">
            <button className="act primary" disabled={busy} onClick={() => fire(myPlayerId)}>
              Dispararte a vos mismo
            </button>
            {alive
              .filter(p => p.id !== current.id)
              .map(p => (
                <button key={p.id} className="act" disabled={busy} onClick={() => fire(round.seatOrder[p.id])}>
                  Dispararle a {p.name}
                </button>
              ))}
          </div>
        )}
        {!isMyTurn && !busy && (
          <p className="mono mt-[18px] text-center text-[var(--rec-ink-faint)]">Esperando a que dispare {current.name}...</p>
        )}

        {isMyTurn && current.items.length > 0 && (
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

      {stage === "shot-result" &&
        playingShot &&
        (() => {
          // `round` is still the state from before this shot; `after` is the
          // state it leads to (what gets shown once this banner is dismissed).
          const shot = playingShot.payload;
          const outcome = describeFireOutcome(shot, nameFor);
          const targetEngineId = round.seatOrder.indexOf(shot.targetId);
          const targetBefore = state.players.find(p => p.id === targetEngineId);
          const targetAfter = playingShot.after?.state.players.find(p => p.id === targetEngineId);
          const isElimination = (targetBefore?.lives ?? 0) > 0 && (targetAfter?.lives ?? 0) <= 0;
          const eliminatedName = isElimination ? nameFor(shot.targetId) : undefined;

          return (
            <OutcomeBanner
              line={{ text: outcome.actionLine }}
              subLine={{ text: outcome.shellLine, cls: outcome.cls }}
              isElimination={isElimination}
              eliminatedName={eliminatedName}
              onContinue={director.finish}
            />
          );
        })()}

      {stage === "item-result" &&
        playingItem &&
        (() => {
          const itemBanner = playingItem.payload;
          // 📞/🔍 only: the real hint/reveal never travels in itemBanner
          // (public event, same for every client) — it only ever reaches
          // this client's own private_role message, and only when it was
          // this player who called and the seq lines up with this exact call.
          const privateHint = myRole?.phoneHint as { seq: number; positionFromNow: number; shellKind: ShellKind } | undefined;
          const canReveal = itemBanner.item === "📞" && itemBanner.playerId === myPlayerId && privateHint?.seq === itemBanner.seq;
          const privateLupaHint = myRole?.lupaHint as { seq: number; shellKind: ShellKind } | undefined;
          const canRevealLupa = itemBanner.item === "🔍" && itemBanner.playerId === myPlayerId && privateLupaHint?.seq === itemBanner.seq;
          const line = describeItemResult(
            canReveal
              ? { ...itemBanner, phoneHint: { positionFromNow: privateHint.positionFromNow, shellKind: privateHint.shellKind } }
              : canRevealLupa
                ? { ...itemBanner, revealedShellKind: privateLupaHint.shellKind }
                : itemBanner,
            nameFor,
            {
              revealPhoneHint: itemBanner.item === "📞" ? canReveal : true,
              revealLupaHint: itemBanner.item === "🔍" ? canRevealLupa : true,
            },
          );
          return <OutcomeBanner line={line} onContinue={director.finish} />;
        })()}

      {stage === "item-activating" && playingItem && <ItemActivatingOverlay icon={playingItem.payload.item} />}

      {sheetPlayer && !pendingItem && !busy && (
        <PlayerItemsSheet
          player={sheetPlayer}
          interactive={sheetPlayer.id === currentEngineId && isMyTurn}
          onUseItem={item => setPendingItem(item)}
          onClose={() => setSheetPlayerId(null)}
        />
      )}

      {pendingItem && (
        <ItemUseModal
          item={pendingItem}
          opponents={alive.filter(p => p.id !== myEngineId)}
          onClose={() => setPendingItem(null)}
          onUseSimple={useItemSimple}
          onSteal={useItemSteal}
          onStealNoTarget={useItemStealNoTarget}
          onCuff={useItemCuff}
          onCuffNoTarget={useItemCuffNoTarget}
        />
      )}

      {showWinner && round.winnerRoomId && (
        <div className="rec-overlay winner-overlay">
          <div className="rec-table final-card winner-in max-w-[420px]">
            <div className="rec-victory-callout">
              <span className="rec-victory-trophy">🏆</span>
              <p className="rec-victory-title display">¡VICTORIA!</p>
            </div>
            <p className="mono eyebrow">Fin del duelo</p>
            <p className="display winner">
              Gana <span>{round.winnerRoomId === myPlayerId ? "vos" : nameFor(round.winnerRoomId)}</span>
            </p>
            {isHost ? (
              // Recámara's rematch goes back through the lobby (not a
              // straight start_round like other games' "jugar de nuevo") so
              // the host can add/remove players before the next chamber —
              // see backToLobby in backend/src/ws/roomHandlers.ts.
              <StartButton onClick={() => send({ type: "back_to_lobby" })}>Volver a la sala</StartButton>
            ) : (
              <p className="text-sm text-[var(--rec-ink-dim)]">Esperando que el anfitrión vuelva a la sala</p>
            )}
            {/* Host's primary button above already sends back_to_lobby — this is
                only useful for a non-host who doesn't want to wait for the host. */}
            {!isHost && <LeaveToLobbyButton groupCode={room.groupCode} send={send} message="Se interrumpe el duelo para todos." />}
          </div>
        </div>
      )}
    </div>
  );
}
