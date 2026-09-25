import { MAX_ITEMS, type Player } from "@juntada/recamara-engine";
import type { ChestTurn } from "../components/ItemChest";

// Who opens a chest after a reload, and with what (Player.lastGrantedItems).
// Round 1 deals nothing, so it never has one. A player gets a chest when
// the reload gave them something — or gave them nothing only because their
// inventory was full, so they're told why. Eliminated players get neither.
function chestFor(player: Player, ownerName: string | null): ChestTurn | null {
  if (player.lives <= 0) return null;
  const inventoryFull = player.items.length >= MAX_ITEMS;
  if (player.lastGrantedItems.length === 0 && !inventoryFull) return null;
  return { ownerName, items: player.lastGrantedItems, inventoryFull };
}

// Pass-and-play: every player's chest, in seating order.
export function localChests(roundNumber: number, order: number[], players: Player[]): ChestTurn[] {
  if (roundNumber <= 1) return [];
  return order.flatMap(id => {
    const p = players.find(pl => pl.id === id);
    const chest = p && chestFor(p, p.name);
    return chest ? [chest] : [];
  });
}

// Online: only this device's own chest — everyone opens theirs at once.
export function ownChest(roundNumber: number, me: Player | undefined): ChestTurn[] {
  if (roundNumber <= 1 || !me) return [];
  const chest = chestFor(me, null);
  return chest ? [chest] : [];
}
