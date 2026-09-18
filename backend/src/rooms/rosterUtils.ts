// ─── Shared Roster Helpers ───────────────────────────────────────────────────
// Room.players and Group.members are structurally identical for this check
// (id/name/online), so both roomService.ts and groupService.ts share it
// instead of each re-implementing the same rule against its own type.
//
// isNameTaken/duplicate-name-suffix logic used to live here too, but was
// deleted once usernames became globally unique at the account level (see
// design.md's room-membership delta): two players in the same room can no
// longer collide on name, so the check became dead code.

interface RosterEntry {
  id: string;
  name: string;
  online: boolean;
}

// Picks who a departing host hands off to: prefers another online entry,
// only reaching for an offline one if literally everyone else is offline
// too (about to be cleaned up anyway either way).
function pickHostReplacement(roster: RosterEntry[], leavingId: string): RosterEntry | undefined {
  return roster.find(e => e.id !== leavingId && e.online) ?? roster.find(e => e.id !== leavingId);
}

module.exports = { pickHostReplacement };
