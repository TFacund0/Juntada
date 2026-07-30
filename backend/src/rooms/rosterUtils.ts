// ─── Shared Roster Helpers ───────────────────────────────────────────────────
// Room.players and Group.members are structurally identical for these two
// checks (id/name/online), so both roomService.ts and groupService.ts share
// this instead of each re-implementing the same rule against its own type.

interface RosterEntry {
  id: string;
  name: string;
  online: boolean;
}

// Only an online entry actually blocks a name reuse — an offline one is
// either about to be reaped (the disconnect grace period) or the very
// person trying to get back in (e.g. their saved session was lost and
// they're joining fresh instead of rejoining). Without the online check,
// they'd be locked out of their own name for the whole grace period even
// though nobody else is actually using it.
function isNameTaken(roster: RosterEntry[], name: string): boolean {
  return roster.some(e => e.online && e.name.toLowerCase() === name.toLowerCase());
}

// Picks who a departing host hands off to: prefers another online entry,
// only reaching for an offline one if literally everyone else is offline
// too (about to be cleaned up anyway either way).
function pickHostReplacement(roster: RosterEntry[], leavingId: string): RosterEntry | undefined {
  return roster.find(e => e.id !== leavingId && e.online) ?? roster.find(e => e.id !== leavingId);
}

module.exports = { isNameTaken, pickHostReplacement };
