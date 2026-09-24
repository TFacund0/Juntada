import { STARTING_LIVES, type Player } from "@juntada/recamara-engine";

interface PlayerTokenProps {
  player: Player;
  isActive: boolean;
  onClick: () => void;
}

// One player's card, standing at their seat around the table (see DuelTable) — just
// enough to identify them and their state at a glance. Tapping it opens
// PlayerItemsSheet with the actual item list, so this stays uncluttered.
export function PlayerToken({ player, isActive, onClick }: PlayerTokenProps) {
  const isDead = player.lives <= 0;
  return (
    <button type="button" className={`token${isActive ? " active" : ""}${isDead ? " dead" : ""}`} onClick={onClick}>
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
