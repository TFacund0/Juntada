import type { Player } from "@juntada/recamara-engine";
import type { ShotAnimation } from "../hooks/shotAnimation";
import type { PlayingFx } from "../utils/playingFx";
import { seatStyle } from "../utils/arena";
import { DirectionRing } from "./DirectionRing";
import { PlayerToken } from "./PlayerToken";
import { Shotgun } from "./Shotgun";
import { SpentShells } from "./SpentShells";
import { ShotEffects } from "./ShotEffects";

interface DuelTableProps {
  // Seat order (engine ids) — fixed for the whole game, see seatAngle.
  order: number[];
  players: Player[];
  currentId: number;
  direction: 1 | -1;
  sawedOff: boolean;
  busy: boolean;
  shotAnim: ShotAnimation;
  onSelectPlayer: (playerId: number) => void;
  // What the event director is playing right now (see playingFx.ts) —
  // drives the scene shake, the hit on the target's card and the
  // full-screen flash.
  playing?: PlayingFx | null;
  // Online shows your own seat as "Vos"; local has no "you".
  nameFor?: (player: Player) => string;
  // This device's own seat (online only).
  youId?: number;
  // Set only when it's this device's turn to shoot: every other living
  // player becomes a target, and tapping their card fires at them.
  onFire?: (playerId: number) => void;
}

// The duel table shared by LocalGame and RoundView: felt tilted back in
// perspective (see arena.css), the shotgun and the spent casings lying on
// it, and each player's card standing up at their seat. Everything that
// moves comes from shotAnim and `playing`; this only lays it out.
export function DuelTable(props: DuelTableProps) {
  const { order, players, currentId, direction, sawedOff, busy, shotAnim, onSelectPlayer, playing = null, nameFor, youId, onFire } = props;
  const firing = shotAnim.fireStage === "firing" && playing?.kind === "shot";
  const live = firing && playing?.shellKind === "live";
  const shake = firing ? (live ? " shake-live" : " shake-blank") : "";

  // ShotEffects sits outside .duel-stage on purpose: its perspective (and
  // the shake transform) would make it the containing block of the
  // position: fixed flash, shrinking it to the table instead of the screen.
  return (
    <>
      <div className={`duel-stage${shake}`}>
        <div className={`arena${busy ? " busy" : ""}`}>
          <DirectionRing direction={direction} />
          <div className="gun-aim" style={{ transform: `translate(-50%, -50%) rotate(${shotAnim.gunAngle}deg) translateZ(4px)` }}>
            <Shotgun aiming={shotAnim.fireStage === "aiming"} recoil={shotAnim.recoil} flash={shotAnim.flash} sawed={sawedOff} />
          </div>

          <SpentShells shells={shotAnim.spentShells} />

          {order.map(id => {
            const player = players.find(p => p.id === id);
            if (!player) return null;
            const name = nameFor?.(player) ?? player.name;
            const hit = live && playing?.targetId === id;
            const targetable = !!onFire && !busy && id !== currentId && player.lives > 0;
            return (
              <div key={id} className={`seat${hit ? " hit" : ""}`} style={seatStyle(order, id)}>
                <PlayerToken
                  player={{ ...player, name }}
                  isActive={id === currentId}
                  isYou={id === youId}
                  targetable={targetable}
                  onClick={() => {
                    if (busy) return;
                    if (targetable && onFire) onFire(id);
                    else onSelectPlayer(id);
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <ShotEffects shot={playing} fireStage={shotAnim.fireStage} />
    </>
  );
}
