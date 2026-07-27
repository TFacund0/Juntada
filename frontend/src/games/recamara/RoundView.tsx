import { useEffect, useMemo, useRef, useState } from "react";
import "./recamara.css";
import { LeaveToLobbyButton } from "../../components/LeaveToLobbyButton";
import { StartButton } from "../../components/StartButton";
import {
  describeFireOutcome,
  describeItemResult,
  ITEM_LABEL,
  ITEMS_PER_RELOAD,
  type ItemKind,
  type LastItemEvent,
  type PublicGameState,
  type RecamaraRoundView,
  type ShellKind,
} from "@juntada/recamara-engine";
import { PlayerToken } from "./PlayerToken";
import { PlayerItemsSheet } from "./PlayerItemsSheet";
import { ItemUseModal } from "./ItemUseModal";
import { ChestReveal } from "./ChestReveal";
import { OutcomeBanner } from "./OutcomeBanner";
import { RoundAnnounce } from "./RoundAnnounce";
import { ChamberCard } from "./ChamberCard";
import { ItemActivatingOverlay } from "./ItemActivatingOverlay";
import { frontAngle, randomShellSpot, seatAngle, seatStyle, shuffledBulletIcons } from "./arena";
import { AIM_MS, SHOT_MS, ITEM_ACTIVATE_MS, ROUND_INTRO_MS, ROUND_ANNOUNCE_MS } from "./timing";
import type { RoundViewProps } from "../gameTypes";

// ═══════════════════════════════════════════════════════════════════════════
// RECÁMARA — modo online. Mismo duelo que el modo local (misma UI incluso:
// PlayerToken/ChestReveal/ItemUseModal/PlayerItemsSheet/OutcomeBanner se
// reusan tal cual) pero el estado real vive en el servidor
// (backend/src/games/recamara/engine.ts) — acá solo se renderiza `room.round`
// y se manda `fire`/`use_item`/`ready_for_duel`. Cada disparo/uso de ítem ya
// se aplicó en el servidor para cuando este componente se entera; la
// animación de acá es puramente una puesta en escena de algo que ya pasó,
// no algo que se está decidiendo en el cliente — ver el efecto que vigila
// pendingFire.seq/lastItemEvent.seq más abajo.
// ═══════════════════════════════════════════════════════════════════════════

export function RoundView({ room, me, isHost, send }: RoundViewProps) {
  // RecamaraRoundView (see @juntada/recamara-engine) is the exact shape
  // backend/src/games/recamara/engine.ts's getPublicRoundView is typed to
  // return — one shared definition instead of two hand-mirrored copies
  // that could silently drift apart on a field rename.
  const round = room.round as RecamaraRoundView | null;
  const myPlayerId = me?.playerId ?? null;

  // Buffered display of the shot in progress: frozen to how things looked
  // right before this shot while it plays out, so lives/turn don't jump to
  // the post-shot reality until the player taps through the result banner
  // — same suspense the local mode gets from computing the shot client-side
  // instead of over the network.
  const [fireStage, setFireStage] = useState<"idle" | "aiming" | "firing" | "result">("idle");
  const [frozenState, setFrozenState] = useState<PublicGameState | null>(null);
  const settledStateRef = useRef<PublicGameState | null>(null);
  const lastFireSeqRef = useRef(0);
  // Read inside the fire-processing effect below instead of putting
  // fireStage in that effect's own deps — that effect sets fireStage
  // itself partway through (aiming -> firing -> result), and depending on
  // it directly would make each of those transitions re-run the effect,
  // whose cleanup would cancel the very timeout chain it just started.
  const fireStageRef = useRef(fireStage);
  useEffect(() => {
    fireStageRef.current = fireStage;
  }, [fireStage]);

  const [recoil, setRecoil] = useState(false);
  const [flash, setFlash] = useState(false);
  const [gunAngle, setGunAngle] = useState(0);
  const [lastShell, setLastShell] = useState<ShellKind | null>(null);
  const [shellSpot, setShellSpot] = useState({ left: 50, top: 50, rot: 0 });
  const [shellPhase, setShellPhase] = useState<"eject" | "landed">("eject");

  // Item use: purely decorative on top of state that's already public and
  // already changed server-side — no freezing needed, just a brief "pulse"
  // then a dismissable banner.
  const lastItemSeqRef = useRef(0);
  const [activatingItem, setActivatingItem] = useState<ItemKind | null>(null);
  const [itemBanner, setItemBanner] = useState<LastItemEvent | null>(null);

  // Reveal: each player pops their own chest at their own pace (see
  // ChestReveal) — purely client-side, since the items themselves were
  // never secret (same as local mode, just one shared screen there).
  const lastRoundNumberRef = useRef(0);
  const [revealStage, setRevealStage] = useState<"announce" | "chests" | "chamber">("announce");
  const [introEndsAt, setIntroEndsAt] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [readySent, setReadySent] = useState(false);

  const [sheetPlayerId, setSheetPlayerId] = useState<number | null>(null);
  const [pendingItem, setPendingItem] = useState<ItemKind | null>(null);

  // A fresh reveal beat (game start, or right after a reload) resets the
  // local chest/ready UI — never mid an in-flight shot animation, so a
  // reload that lands as part of a shot still finishes playing out first.
  useEffect(() => {
    if (!round || fireStage !== "idle") return;
    if (round.roundNumber !== lastRoundNumberRef.current) {
      lastRoundNumberRef.current = round.roundNumber;
      setRevealStage("announce");
      setRevealedCount(0);
      setReadySent(false);
    }
  }, [round?.roundNumber, fireStage]);

  // The plain "Ronda N" announcement moves on by itself into the chests —
  // brief on purpose, just registering the round changed before items show.
  useEffect(() => {
    if (!round || round.subPhase !== "reveal" || revealStage !== "announce") return;
    const t = setTimeout(() => setRevealStage("chests"), ROUND_ANNOUNCE_MS);
    return () => clearTimeout(t);
  }, [round?.subPhase, revealStage]);

  // The chamber card (gun + shell count) moves on by itself — sending
  // ready_for_duel — after ROUND_INTRO_MS, once your own chest is done.
  // Every player gets the same few seconds to actually look at the gun/
  // shell count, not just whoever taps through fastest.
  useEffect(() => {
    if (!round || round.subPhase !== "reveal" || revealStage !== "chamber") return;
    setIntroEndsAt(Date.now() + ROUND_INTRO_MS);
    const t = setTimeout(() => {
      send({ type: "ready_for_duel" });
      setReadySent(true);
    }, ROUND_INTRO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.subPhase, revealStage]);

  // Idle aim: whenever nothing's mid-animation, the gun rests pointing away
  // from whoever's turn it currently is.
  useEffect(() => {
    if (!round || round.subPhase !== "duel" || fireStage !== "idle") return;
    const currentEngineId = round.state.order[round.state.turnPos];
    setGunAngle(frontAngle(round.state.order, currentEngineId));
  }, [round?.subPhase, round?.state.turnPos, round?.state.order, fireStage]);

  // A new shot arrived from the server (already fully resolved there) —
  // play it out: swing the gun, fire, hold the result banner, and only
  // then let the real (already-current) state show through. Merged with
  // "keep the settled snapshot current" into one effect on purpose: the
  // same round update that carries a new pendingFire also already carries
  // the post-shot round.state, so a separate "settledStateRef = round.state
  // whenever idle" effect could win the race and clobber the snapshot with
  // the very state this one needs to freeze *before* it ever runs. Only
  // safe to advance the snapshot once there's no unprocessed shot to freeze.
  useEffect(() => {
    if (!round) return;
    if (round.pendingFire && round.pendingFire.seq !== lastFireSeqRef.current) {
      lastFireSeqRef.current = round.pendingFire.seq;
      const pf = round.pendingFire;
      const preShotOrder = settledStateRef.current?.order ?? round.state.order;
      const targetEngineId = round.seatOrder.indexOf(pf.targetId);

      setFrozenState(settledStateRef.current);
      setFireStage("aiming");
      setGunAngle(seatAngle(preShotOrder, targetEngineId));

      const t1 = setTimeout(() => {
        setFireStage("firing");
        setRecoil(false);
        requestAnimationFrame(() => setRecoil(true));
        if (pf.shellKind === "live") {
          setFlash(false);
          requestAnimationFrame(() => setFlash(true));
        }
        setLastShell(pf.shellKind);
        const spot = randomShellSpot();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            setShellSpot(spot);
            setShellPhase("landed");
          }),
        );
        setTimeout(() => setFireStage("result"), SHOT_MS);
      }, AIM_MS);

      return () => clearTimeout(t1);
    }
    if (fireStageRef.current === "idle") settledStateRef.current = round.state;
  }, [round?.pendingFire?.seq, round?.state]);

  // An item just got used (by whoever's turn it is — everyone watches the
  // same reveal, same as local pass-and-play).
  useEffect(() => {
    if (!round?.lastItemEvent) return;
    if (round.lastItemEvent.seq === lastItemSeqRef.current) return;
    lastItemSeqRef.current = round.lastItemEvent.seq;
    const event = round.lastItemEvent;
    setActivatingItem(event.item);
    const t = setTimeout(() => {
      setActivatingItem(null);
      setItemBanner(event);
    }, ITEM_ACTIVATE_MS);
    return () => clearTimeout(t);
  }, [round?.lastItemEvent?.seq]);

  // Shuffled once per round via useMemo so it doesn't reshuffle on every
  // unrelated re-render (this component re-renders on every server update).
  const bulletIcons = useMemo(
    () => shuffledBulletIcons(round?.liveCount ?? 0, round?.blankCount ?? 0),
    [round?.liveCount, round?.blankCount, round?.roundNumber],
  );

  if (!round || !myPlayerId) return null;

  const continueAfterFire = () => {
    setFireStage("idle");
    setFrozenState(null);
  };

  const continueAfterItem = () => setItemBanner(null);

  const nameFor = (roomId: string | null): string => {
    if (!roomId) return "";
    return room.players.find(p => p.id === roomId)?.name ?? "";
  };

  // Everything below reads from `effectiveState` — the frozen pre-shot
  // snapshot while a shot is animating, the live server state otherwise —
  // so lives/turn/items only ever change on screen once the animation
  // finishes and the player taps through.
  const busy = fireStage !== "idle";
  const effectiveState: PublicGameState = busy && frozenState ? frozenState : round.state;
  const myEngineId = round.seatOrder.indexOf(myPlayerId);
  const myPlayer = effectiveState.players.find(p => p.id === myEngineId);

  if (round.subPhase === "reveal" && !busy) {
    if (readySent) {
      return (
        <div className="recamara">
          <div className="table" style={{ textAlign: "center" }}>
            <p className="mono eyebrow">Esperando a los demás</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              {round.seatOrder.map(id => (
                <p key={id} style={{ margin: 0 }}>
                  {round.readyForDuel.includes(id) ? "✅" : "⏳"} {nameFor(id)}
                </p>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Beat 1: a plain "Ronda N" announcement — nothing else on it, moves on
    // by itself shortly after, so the round change itself gets its own
    // moment before items/gun show up.
    if (revealStage === "announce") return <RoundAnnounce roundNumber={round.roundNumber} />;

    // Beat 2: your own chest, items only — nothing about the gun/shells
    // here on purpose (that's its own separate screen next).
    if (revealStage === "chests") {
      const myNewItems = myPlayer?.items.slice(-ITEMS_PER_RELOAD) ?? [];
      const chestDone = revealedCount >= myNewItems.length;
      return (
        <div className="recamara">
          <div className="table">
            <ChestReveal
              player={myPlayer ?? { id: myEngineId, name: "Vos", lives: 0, items: [] }}
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
        controls={
          <button
            className="act primary"
            onClick={() => {
              send({ type: "ready_for_duel" });
              setReadySent(true);
            }}
          >
            Listo, a disparar
          </button>
        }
      />
    );
  }

  // ─── duel ───
  const currentEngineId = effectiveState.order[effectiveState.turnPos];
  const current = effectiveState.players.find(p => p.id === currentEngineId)!;
  const currentRoomId = round.seatOrder[currentEngineId];
  const alive = effectiveState.players.filter(p => p.lives > 0);
  const isMyTurn = currentRoomId === myPlayerId;
  const sheetPlayer = sheetPlayerId != null ? effectiveState.players.find(p => p.id === sheetPlayerId) : undefined;

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

  return (
    <div className="recamara">
      <div className="table">
        <div className="turn-banner">
          <span className="dot" />
          <span className="txt">
            Turno de <strong>{isMyTurn ? "vos" : current.name}</strong>
          </span>
          <span className="direction-tag" title={effectiveState.direction === 1 ? "Sentido horario" : "Sentido antihorario"}>
            {effectiveState.direction === 1 ? "↻" : "↺"}
          </span>
        </div>

        <div className={`arena${busy ? " busy" : ""}`}>
          <div className="gun-aim" style={{ transform: `translate(-50%, -50%) rotate(${gunAngle}deg)` }}>
            <div className={`shotgun${recoil ? " recoil" : ""}${effectiveState.sawedOff ? " sawed" : ""}`}>
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

          {round.seatOrder.map((roomId, engineId) => {
            const player = effectiveState.players.find(p => p.id === engineId);
            if (!player) return null;
            return (
              <PlayerToken
                key={engineId}
                player={roomId === myPlayerId ? { ...player, name: "Vos" } : player}
                isActive={engineId === currentEngineId}
                style={seatStyle(effectiveState.order, engineId)}
                onClick={() => !busy && setSheetPlayerId(engineId)}
              />
            );
          })}
        </div>

        <div className="log">
          {round.log.map((l, i) => (
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
          <p className="mono" style={{ textAlign: "center", color: "var(--rec-ink-faint)", marginTop: 18 }}>
            Esperando a que dispare {current.name}...
          </p>
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

      {fireStage === "result" &&
        round.pendingFire &&
        (() => {
          const outcome = describeFireOutcome(round.pendingFire, nameFor);
          return (
            <OutcomeBanner
              line={{ text: outcome.actionLine }}
              subLine={{ text: outcome.shellLine, cls: outcome.cls }}
              onContinue={continueAfterFire}
            />
          );
        })()}

      {itemBanner && <OutcomeBanner line={describeItemResult(itemBanner, nameFor)} onContinue={continueAfterItem} />}

      {activatingItem && <ItemActivatingOverlay icon={activatingItem} />}

      {sheetPlayer && !pendingItem && !busy && !itemBanner && (
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
        />
      )}

      {round.winnerRoomId && (
        <div className="rec-overlay">
          <div className="table final-card" style={{ maxWidth: 420 }}>
            <p className="mono eyebrow">Fin del duelo</p>
            <p className="display winner">
              Gana <span>{round.winnerRoomId === myPlayerId ? "vos" : nameFor(round.winnerRoomId)}</span>
            </p>
            {isHost ? (
              <StartButton onClick={() => send({ type: "start_round" })}>Nueva ronda</StartButton>
            ) : (
              <p style={{ color: "var(--rec-ink-dim)", fontSize: 14 }}>Esperando que el anfitrión inicie otra ronda</p>
            )}
            <LeaveToLobbyButton groupCode={room.groupCode} send={send} confirm={{ message: "Se interrumpe el duelo para todos." }} />
          </div>
        </div>
      )}
    </div>
  );
}
