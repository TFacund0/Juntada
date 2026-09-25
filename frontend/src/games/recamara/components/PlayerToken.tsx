import { STARTING_LIVES, type Player } from "@juntada/recamara-engine";

interface PlayerTokenProps {
  player: Player;
  isActive: boolean;
  // This device's own seat (online) — its card gets its own border.
  isYou?: boolean;
  // It's your turn and this rival can be shot: the card pulses and tapping
  // it fires (the reference's "tocá a un rival"). Its accessible name then
  // says so, since the tap now shoots instead of opening the item sheet.
  targetable?: boolean;
  onClick: () => void;
}

// One player's card, standing at their seat around the table (see DuelTable) — just
// enough to identify them and their state at a glance. Tapping it opens
// PlayerItemsSheet with the actual item list — or shoots them, when targetable.
export function PlayerToken({ player, isActive, isYou = false, targetable = false, onClick }: PlayerTokenProps) {
  const isDead = player.lives <= 0;
  const cls = `token${isActive ? " active" : ""}${isDead ? " dead" : ""}${isYou ? " you" : ""}${targetable ? " targetable" : ""}`;
  return (
    <button type="button" className={cls} onClick={onClick} aria-label={targetable ? `Dispararle a ${player.name}` : undefined}>
      <span className="token-name">
        {isDead && (
          <span className="token-dead-skull" aria-hidden="true">
            💀{" "}
          </span>
        )}
        {player.name}
      </span>
      <span className="token-lives" role="img" aria-label={`${player.lives} de ${STARTING_LIVES} vidas`}>
        {Array.from({ length: STARTING_LIVES }).map((_, i) => (
          <i key={i} className={`life-dot${i >= player.lives ? " spent" : ""}`} />
        ))}
      </span>
      {player.items.length > 0 && (
        <span className="token-items">
          {player.items.map((item, i) => (
            <span key={i} className="token-item">
              {item}
            </span>
          ))}
        </span>
      )}
      {player.cuffed && (
        <span className="token-cuffed" title="Esposado: pierde su próximo turno">
          🔒
        </span>
      )}
    </button>
  );
}
