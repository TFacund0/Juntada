import { RAYADO_RAINBOW } from "../rainbow";

// Parámetros al azar de los efectos (`inkSplash` y `confetti` de la
// referencia). El azar entra por `rng`, así los tests pueden fijarlo.

export type Rng = () => number;

const between = (rng: Rng, a: number, b: number) => a + rng() * (b - a);

export interface InkBlob {
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  borderRadius: string;
  delay: number;
  duration: number;
}

/**
 * Manchas de tinta alrededor de (x, y): 4 chicas del color del jugador, o 7
 * grandes de colores del arcoíris (`big`, el acierto propio sobre el tablero).
 */
export function inkBlobs(rng: Rng, { x, y, color, big = false }: { x: number; y: number; color: string; big?: boolean }): InkBlob[] {
  const count = big ? 7 : 4;
  return Array.from({ length: count }, (_, i) => {
    const size = big ? between(rng, 60, 160) : between(rng, 24, 60);
    const radius = () => `${between(rng, 40, 60).toFixed(0)}%`;
    return {
      left: x - size / 2 + between(rng, -40, 40),
      top: y - size / 2 + between(rng, -40, 40),
      width: size,
      height: size * between(rng, 0.8, 1.2),
      color: big ? RAYADO_RAINBOW[Math.floor(rng() * RAYADO_RAINBOW.length) % RAYADO_RAINBOW.length] : color,
      borderRadius: `${radius()} ${radius()} ${radius()} ${radius()}`,
      delay: i * 40,
      duration: big ? 1100 : 800,
    };
  });
}

export interface ConfettiPiece {
  /** Posición horizontal de salida, en vw. */
  left: number;
  color: string;
  /** Deriva horizontal al caer, en px. */
  drift: number;
  /** Giros totales, en grados. */
  spin: number;
  duration: number;
  delay: number;
}

const CONFETTI_COLORS = [...RAYADO_RAINBOW, "#ffffff"];

/** `n` papelitos que caen desde arriba de la pantalla. */
export function confettiPieces(rng: Rng, n: number): ConfettiPiece[] {
  return Array.from({ length: n }, (_, i) => ({
    left: between(rng, 0, 100),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    drift: between(rng, -80, 80),
    spin: between(rng, 360, 1080),
    duration: between(rng, 1800, 3000),
    delay: between(rng, 0, 300),
  }));
}
