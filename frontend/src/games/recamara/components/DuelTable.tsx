import type { Player } from "@juntada/recamara-engine";
import type { ShotAnimation } from "../hooks/shotAnimation";
import { seatStyle } from "../utils/arena";
import { DirectionRing } from "./DirectionRing";
import { PlayerToken } from "./PlayerToken";
import { Shotgun } from "./Shotgun";

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
  // Online shows your own seat as "Vos"; local has no "you".
  nameFor?: (player: Player) => string;
}

// The duel table shared by LocalGame and RoundView: felt tilted back in
// perspective (see arena.css), the shotgun and last spent shell lying on it,
// and each player's card standing up at their seat. Everything that moves
// comes from shotAnim; this only lays it out.
export function DuelTable({ order, players, currentId, direction, sawedOff, busy, shotAnim, onSelectPlayer, nameFor }: DuelTableProps) {
  const shell = shotAnim.lastShell;
  const landed = shotAnim.shellPhase === "landed";

  return (
    <div className="duel-stage">
      <div className={`arena${busy ? " busy" : ""}`}>
        <DirectionRing direction={direction} />
        <div className="gun-aim" style={{ transform: `translate(-50%, -50%) rotate(${shotAnim.gunAngle}deg) translateZ(4px)` }}>
          <Shotgun recoil={shotAnim.recoil} flash={shotAnim.flash} sawed={sawedOff} />
        </div>

        {shell && (
          <div
            className={`last-shell ${shell}`}
            title={shell === "live" ? "Última bala: real" : "Última bala: falsa"}
            style={{
              left: `${landed ? shotAnim.shellSpot.left : 50}%`,
              top: `${landed ? shotAnim.shellSpot.top : 50}%`,
              transform: `translate(-50%, -50%) rotate(${landed ? shotAnim.shellSpot.rot : 0}deg)`,
            }}
          />
        )}

        {order.map(id => {
          const player = players.find(p => p.id === id);
          if (!player) return null;
          const name = nameFor?.(player) ?? player.name;
          return (
            <div key={id} className="seat" style={seatStyle(order, id)}>
              <PlayerToken player={{ ...player, name }} isActive={id === currentId} onClick={() => !busy && onSelectPlayer(id)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
