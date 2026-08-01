// Tiny module-level store (no context, no provider) so two unrelated trees —
// App.tsx (knows whether a round is on screen) and useServiceWorkerUpdate.ts
// (mounted one level above App, outside its tree) — can agree on "is it safe
// to reload right now" without wiring props through everything in between.
let inGame = false;
const idleListeners = new Set<() => void>();

export function setAppInGame(active: boolean) {
  const wasInGame = inGame;
  inGame = active;
  // Fire only on the true → false transition, not on every render that
  // happens to already be idle — a listener firing early would reload the
  // page the instant it subscribes, defeating the whole point of waiting.
  if (wasInGame && !active) idleListeners.forEach(cb => cb());
}

export function isAppInGame() {
  return inGame;
}

// Runs `cb` once, the next time the app goes idle (or immediately if it
// already is) — used to defer a pending service worker reload until the
// player isn't mid-round.
export function onceAppIdle(cb: () => void) {
  if (!inGame) {
    cb();
    return () => {};
  }
  const listener = () => {
    idleListeners.delete(listener);
    cb();
  };
  idleListeners.add(listener);
  return () => idleListeners.delete(listener);
}
