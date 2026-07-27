import { S } from "../theme/styles";

// The "Necesitás mínimo N jugadores" hint shown under a disabled start
// button — same text/style hand-copied across most games' setup screens.
// Renders nothing once the minimum's met, so call sites can drop it in
// unconditionally instead of guarding it themselves.
export function MinPlayersHint({ count, min }: { count: number; min: number }) {
  if (count >= min) return null;
  return <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Necesitás mínimo {min} jugadores</p>;
}
