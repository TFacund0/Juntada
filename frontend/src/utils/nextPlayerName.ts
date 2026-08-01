// Shared by every local-mode game's "sumar jugador" form: pressing "Agregar"
// with an empty name shouldn't just no-op — it should add "Jugador N" for
// whatever N is actually free, so tapping the button repeatedly is a valid
// way to fill out a roster without having to type anything. Starts counting
// from the current roster size (so with 4 players already loaded, the next
// suggestion is "Jugador 5"), but keeps incrementing past that if that
// number's already taken — e.g. someone renamed a player to "Jugador 5"
// by hand, or a suggested name was accepted then a player before it removed.
export function nextPlayerName(existingNames: readonly string[], prefix = "Jugador"): string {
  const taken = new Set(existingNames.map(n => n.trim().toLowerCase()));
  let n = existingNames.length + 1;
  while (taken.has(`${prefix} ${n}`.toLowerCase())) n++;
  return `${prefix} ${n}`;
}
