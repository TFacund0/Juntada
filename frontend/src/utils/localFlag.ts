// Shared by every "seen it once, remember that forever" flag stored in
// localStorage (e.g. App.tsx's dev notice) — each used to hand-roll the same
// try/catch-and-degrade-silently boilerplate around getItem/setItem itself.
export function readLocalFlag(key: string): boolean {
  try {
    return Boolean(localStorage.getItem(key));
  } catch {
    return false;
  }
}

export function setLocalFlag(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* storage unavailable (private mode, etc.) — degrade silently */
  }
}
