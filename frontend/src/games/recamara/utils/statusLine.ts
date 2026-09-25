// The narrative line above the table (ported from the reference's status()):
// whose turn it is, who's aiming at whom mid-shot, what's expected of you.
// Returned as segments instead of an HTML string so names (player input)
// are always rendered as text, never as markup.

export interface StatusSegment {
  text: string;
  bold?: boolean;
}

export interface StatusInput {
  // Who's acting right now and what's being staged, if anything.
  currentName: string;
  currentIsMe: boolean;
  aiming?: { targetName: string; targetIsMe: boolean; targetIsShooter: boolean } | null;
  // Online only: this device's player is out, just watching.
  amEliminated?: boolean;
  // Local only: the device is passed around, so "you" is whoever's turn it is.
  passAndPlay?: boolean;
  // Online only: this device already watched the round overlay and is
  // waiting for everyone else to finish theirs.
  waiting?: boolean;
}

export function statusLine({ currentName, currentIsMe, aiming, amEliminated, passAndPlay, waiting }: StatusInput): StatusSegment[] {
  if (waiting) return [{ text: "Esperando a los demás…" }];
  if (aiming) {
    const shooter = currentIsMe ? "Vos" : currentName;
    const verb = currentIsMe ? " apuntás " : " apunta ";
    if (aiming.targetIsShooter) {
      return [{ text: shooter, bold: true }, { text: `${verb}${currentIsMe ? "a vos mismo" : "a sí mismo"}…` }];
    }
    return [
      { text: shooter, bold: true },
      { text: `${verb}a ` },
      { text: aiming.targetIsMe ? "vos" : aiming.targetName, bold: true },
      { text: "…" },
    ];
  }
  if (amEliminated) return [{ text: "Quedaste afuera. Mirá cómo termina." }];
  if (currentIsMe || passAndPlay) {
    return [
      { text: passAndPlay ? `Te toca, ${currentName}.` : "Te toca.", bold: true },
      { text: " Tocá a un rival para dispararle, o disparate a vos: si es falsa, seguís." },
    ];
  }
  return [{ text: "Turno de " }, { text: currentName, bold: true }, { text: "…" }];
}
