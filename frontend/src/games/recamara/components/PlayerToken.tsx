import { STARTING_LIVES, type Player } from "@juntada/recamara-engine";

interface PlayerTokenProps {
  player: Player;
  isActive: boolean;
  // This device's own seat (online) — its card gets its own border.
  isYou?: boolean;
  // It's your turn and this rival can be shot: tapping the card fires (the
  // reference's "tocá a un rival"). Its accessible name then says so, since
  // the tap now shoots instead of opening the item sheet.
  targetable?: boolean;
  // While the round overlay covers the table the items stay hidden; once it
  // lifts they're "dealt" onto the card with a pop (the reference's reload
  // ending) — keyed by round so each reload replays it.
  hideItems?: boolean;
  dealtRound?: number;
  // How many of the remaining lives are being shot off right now (they
  // burst), and whether a life is being smoked back (it pops in).
  losing?: number;
  regen?: boolean;
  // The effect already played and its banner is up: show its outcome as is
  // (the lost lives gone, the smoked one back), no animation — the state on
  // screen is still the pre-event one until the banner is dismissed.
  settled?: boolean;
  onClick: () => void;
}

// One player's card, standing at their seat around the table (see DuelTable) — just
// enough to identify them and their state at a glance. Tapping it opens
// PlayerItemsSheet with the actual item list — or shoots them, when targetable.
export function PlayerToken({
  player,
  isActive,
  isYou = false,
  targetable = false,
  hideItems = false,
  dealtRound,
  losing = 0,
  regen = false,
  settled = false,
  onClick,
}: PlayerTokenProps) {
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
        {Array.from({ length: STARTING_LIVES }).map((_, i) => {
          const regenDot = regen && i === player.lives;
          const losingDot = !regenDot && i < player.lives && i >= player.lives - losing;
          const spent = (i >= player.lives && !regenDot) || (settled && losingDot);
          const cls = spent ? " spent" : settled ? "" : losingDot ? " burst" : regenDot ? " regen" : "";
          return <i key={i} className={`life-dot${cls}`} />;
        })}
      </span>
      {!hideItems && player.items.length > 0 && (
        <span key={dealtRound} className={`token-items${dealtRound ? " dealt" : ""}`}>
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
