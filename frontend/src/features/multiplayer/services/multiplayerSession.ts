// Backgrounding the tab on mobile (switching to WhatsApp, locking the screen,
// etc.) can kill the socket or even discard the JS context entirely. We
// persist just enough identity to rejoin the same room/group after either
// case — the server already keeps a disconnected player's slot reserved
// (marked offline, not removed) for a grace period, so this is what lets the
// client actually make use of that instead of dumping the player back at the
// menu.
//
// A client can be:
//   - standalone-room-attached only: room session, no group session.
//   - group-attached, no active instance: group session, no room session.
//   - group-attached with an active instance: both sessions set, same playerId.
export const SESSION_KEY = "impostorgame:session";

export interface RoomSession {
  playerId: string;
  roomCode: string;
}

export interface GroupSession {
  playerId: string;
  groupCode: string;
}

export interface PersistedSession {
  room?: RoomSession;
  group?: GroupSession;
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: PersistedSession | null): void {
  try {
    if (session && (session.room || session.group)) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable (private mode, etc.) — degrade silently */
  }
}

// Exposed so the root app can drop a persisted session when the player
// deliberately navigates away (back to menu, picks a different game), rather
// than leaving it around to be wrongly auto-rejoined on a later visit.
export function clearMultiplayerSession(): void {
  saveSession(null);
}
