import { useEffect, useRef, useState } from "react";
import "./css/index.css";
import { LeaveToLobbyButton } from "../../components/game-kit/LeaveToLobbyButton";
import { StartButton } from "../../components/setup/StartButton";
import { describeFireOutcome, describeItemResult, type ItemKind, type RecamaraRoundView, type ShellKind } from "@juntada/recamara-engine";
import { PlayerItemsSheet } from "./components/PlayerItemsSheet";
import { ItemUseModal } from "./components/ItemUseModal";
import { ResultBanner } from "./components/ResultBanner";
import { RoundOverlay } from "./components/RoundOverlay";
import { ownChest } from "./utils/chests";
import { EndScreen } from "./components/EndScreen";
import { EliminationBanner } from "./components/EliminationBanner";
import { ItemEffect } from "./components/ItemEffect";
import { DuelScene } from "./components/DuelScene";
import { frontAngle, shortestGunAngle } from "./utils/arena";
import { onlinePlayingFx } from "./utils/playingFx";
import { itemBannerTitle, shotBanner } from "./utils/banners";
import { useLogVisible } from "./hooks/logVisibility";
import { useOnlineRoundDirector } from "./hooks/onlineRoundDirector";
import { useRecamaraSfx } from "./hooks/recamaraSfx";
import { useEventSfx } from "./hooks/eventSfx";
import type { RoundViewProps } from "../gameTypes";

// ═══════════════════════════════════════════════════════════════════════════
// RECÁMARA — modo online. Mismo duelo que el modo local (misma UI incluso:
// PlayerToken/DuelScene/ItemUseModal/PlayerItemsSheet/ResultBanner se
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
  const fx = onlinePlayingFx(director.current, {
    seatOrder: round?.seatOrder ?? [],
    players: round?.state.players ?? [],
    myPlayerId,
    myRole,
    nameFor: id => room.players.find(p => p.id === id)?.name ?? "",
  });
  useEventSfx(fx, shotAnim.fireStage, sfx);

  // Every round opens with the round overlay over the table (RoundOverlay):
  // once this device has watched it, it tells the server it's ready and
  // waits for the rest — the duel itself starts server-side once everyone
  // alive is. Remembered per round so a re-render never replays it.
  const lastRoundNumberRef = useRef(0);
  const [overlayDoneRound, setOverlayDoneRound] = useState<number | null>(null);

  const [sheetPlayerId, setSheetPlayerId] = useState<number | null>(null);
  const [pendingItem, setPendingItem] = useState<ItemKind | null>(null);
  const [showWinner, setShowWinner] = useState(false);
  const [logVisible, toggleLogVisible] = useLogVisible();

  // A new round (game start, or right after a reload) sweeps the table.
  // `round` only reaches the new roundNumber once the reloading shot's
  // banner was dismissed, so that shot always finishes playing out first.
  useEffect(() => {
    if (!round) return;
    if (round.roundNumber !== lastRoundNumberRef.current) {
      lastRoundNumberRef.current = round.roundNumber;
      // Off the table go the last round's casing and the recoil/flash
      // classes (plain booleans that never switch themselves back off).
      shotAnim.resetForNewRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.roundNumber]);

  const myEngineId = round?.seatOrder.indexOf(myPlayerId ?? "") ?? -1;
  const myPlayer = round?.state.players.find(p => p.id === myEngineId);
  const amAlive = !myPlayer || myPlayer.lives > 0;

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

  if (!round || !myPlayerId) return null;

  const nameFor = (roomId: string | null): string => {
    if (!roomId) return "";
    return room.players.find(p => p.id === roomId)?.name ?? "";
  };

  const { stage } = director;
  const playingShot = director.current?.kind === "shot" ? director.current : null;
  const playingItem = director.current?.kind === "item" ? director.current : null;
  const state = round.state;

  const showOverlay = round.subPhase === "reveal" && overlayDoneRound !== round.roundNumber && !busy;
  const onOverlayDone = () => {
    setOverlayDoneRound(round.roundNumber);
    // Only alive players are asked to confirm (see the backend's
    // readyForDuel) — an eliminated one just watches.
    if (amAlive) send({ type: "ready_for_duel" });
  };

  // ─── duel ───
  const currentEngineId = state.order[state.turnPos];
  const current = state.players.find(p => p.id === currentEngineId)!;
  const currentRoomId = round.seatOrder[currentEngineId];
  const alive = state.players.filter(p => p.lives > 0);
  const isMyTurn = currentRoomId === myPlayerId;
  const sheetPlayer = sheetPlayerId != null ? state.players.find(p => p.id === sheetPlayerId) : undefined;
  const canShoot = isMyTurn && !busy && round.subPhase === "duel";

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
      <DuelScene
        table={{
          order: state.order,
          players: state.players,
          currentId: currentEngineId,
          direction: state.direction,
          // The 🪚 shortens the barrel while its own effect plays, not only
          // once its banner is dismissed.
          sawedOff: state.sawedOff || fx?.item === "🪚",
          playing: fx,
          busy,
          shotAnim,
          onSelectPlayer: setSheetPlayerId,
          nameFor: p => (p.id === myEngineId ? "Vos" : p.name),
          youId: myEngineId,
          onFire: canShoot ? id => fire(round.seatOrder[id]) : undefined,
          hideItems: showOverlay,
          itemActivating: stage === "item-activating",
          dealtRound: round.roundNumber > 1 ? round.roundNumber : undefined,
        }}
        roundNumber={round.roundNumber}
        canShoot={canShoot}
        onSelfFire={() => fire(myPlayerId)}
        waitingForTurn={!isMyTurn && amAlive && round.subPhase === "duel"}
        items={isMyTurn && round.subPhase === "duel" ? current.items : null}
        itemsDisabled={busy}
        onUseItem={setPendingItem}
        log={round.log.map((l, i) => ({ key: i, html: l.text, cls: l.cls }))}
        logVisible={logVisible}
        onToggleLog={toggleLogVisible}
        muted={sfx.muted}
        onToggleMute={sfx.toggleMuted}
      />

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
          const eliminated = (targetBefore?.lives ?? 0) > 0 && (targetAfter?.lives ?? 0) <= 0;
          const banner = shotBanner({
            shellKind: shot.shellKind,
            damage: shot.damage,
            shooterName: nameFor(shot.shooterId),
            shooterIsMe: shot.shooterId === myPlayerId,
            targetName: nameFor(shot.targetId),
            targetIsMe: shot.targetId === myPlayerId,
            selfShot: shot.targetId === shot.shooterId,
            eliminated,
          });
          // Someone just lost their last life: their own, bigger moment.
          if (eliminated)
            return (
              <EliminationBanner
                key={playingShot.id}
                name={nameFor(shot.targetId)}
                isMe={shot.targetId === myPlayerId}
                whoHtml={outcome.actionLine}
                onContinue={director.finish}
              />
            );
          return (
            <ResultBanner
              key={playingShot.id}
              tone={banner.tone}
              big={banner.big}
              sub={banner.sub}
              whoHtml={outcome.actionLine}
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
          return (
            <ResultBanner
              key={playingItem.id}
              compact
              tone={line.cls === "danger" ? "live" : "blank"}
              big={itemBannerTitle(itemBanner.item)}
              subHtml={line.text}
              onContinue={director.finish}
            />
          );
        })()}

      {stage === "item-activating" && fx?.kind === "item" && <ItemEffect fx={fx} />}

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

      {showOverlay && (
        <RoundOverlay
          key={round.roundNumber}
          roundNumber={round.roundNumber}
          liveCount={round.liveCount}
          blankCount={round.blankCount}
          chests={ownChest(round.roundNumber, myPlayer)}
          sfx={sfx}
          onDone={onOverlayDone}
        />
      )}

      {showWinner && round.winnerRoomId && (
        <EndScreen
          winnerName={nameFor(round.winnerRoomId)}
          isMe={round.winnerRoomId === myPlayerId}
          sub={round.winnerRoomId === myPlayerId ? "Última persona en la mesa." : "La recámara no perdona."}
        >
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
        </EndScreen>
      )}
    </div>
  );
}
