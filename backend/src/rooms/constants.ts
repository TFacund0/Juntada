// ─── Shared Room/Group Timing Constants ─────────────────────────────────────
// Values both roomService.ts and groupService.ts need identically — kept here
// instead of each file importing the other, since neither should ever depend
// on the other's internals (see their own file-level comments).

// How long an entirely-offline room/group is kept around before being reaped
// (see scheduleRoomCleanup/scheduleGroupCleanup) — long enough that everyone
// briefly losing connection at once (e.g. the server itself restarting)
// doesn't instantly nuke every room/group, short enough that an abandoned one
// doesn't linger forever.
const ONLINE_CLEANUP_DELAY_MS = 5 * 60 * 1000;

module.exports = { ONLINE_CLEANUP_DELAY_MS };
