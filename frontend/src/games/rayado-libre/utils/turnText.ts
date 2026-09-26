// Textos de la cabecera del turno y del indicador de escritura, tal como
// los muestra la referencia.

/** "Dibuja X · adiviná la palabra (N letras)" / "Dibujás vos · los demás adivinan". */
export function turnSubtitle({ isDrawer, drawerName, letters }: { isDrawer: boolean; drawerName: string; letters: number }): string {
  if (isDrawer) return "Dibujás vos · los demás adivinan";
  return `Dibuja ${drawerName} · adiviná la palabra (${letters} ${letters === 1 ? "letra" : "letras"})`;
}

/** Texto del cartel que aparece cuando el reloj salta a otra zona. */
export function clockJumpLabel(to: number): string {
  return `¡El reloj saltó a ${to}!`;
}

/** "Tomi está escribiendo…" / "Tomi y Nacho están escribiendo…"; vacío si nadie escribe. */
export function typingLabel(names: readonly string[]): string {
  if (names.length === 0) return "";
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  return `${who} ${names.length > 1 ? "están" : "está"} escribiendo…`;
}

/** Cuenta regresiva de la elección de palabra: "Se elige sola en Ns". */
export function autoPickLabel(seconds: number): string {
  return `Se elige sola en ${seconds}s`;
}
