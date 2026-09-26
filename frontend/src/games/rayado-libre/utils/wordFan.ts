import { RAYADO_RAINBOW } from "../rainbow";

// Abanico de 3 cartas para elegir palabra (`chooseWord` en la referencia).

const POSITIONS = [
  { r: -14, x: -96, y: 20 },
  { r: 0, x: 0, y: 0 },
  { r: 14, x: 96, y: 20 },
];

/** Dónde queda cada carta en el abanico (izquierda, centro, derecha). */
export function fanTransform(i: number): string {
  const p = POSITIONS[i] ?? POSITIONS[1];
  return `translateX(${p.x}px) translateY(${p.y}px) rotate(${p.r}deg)`;
}

/** Color de la franja de arriba de cada carta: rojo, verde, violeta. */
export const stripeColor = (i: number) => RAYADO_RAINBOW[(i * 2) % RAYADO_RAINBOW.length];

// Tiempos y curvas de la referencia.
export const CARD_STAGGER_MS = 110;
export const CARD_ENTER_MS = 520;
export const CARD_CHOSEN_MS = 700;
/** Lo que se espera tras tocar una carta antes de seguir (la animación de salida). */
export const CARD_CHOOSE_WAIT_MS = 720;

export const cardEnter = (transform: string): Keyframe[] => [
  { transform: "translateY(260px) rotate(0) scale(.6)", opacity: 0 },
  { transform, opacity: 1 },
];
export const cardLift = (transform: string, up: boolean): Keyframe[] =>
  up ? [{ transform }, { transform: `${transform} translateY(-14px)` }] : [{ transform: `${transform} translateY(-14px)` }, { transform }];
export const cardChosen = (transform: string): Keyframe[] => [
  { transform },
  { transform: "translateY(-30px) scale(1.25) rotate(0)" },
  { transform: "translateY(-60px) scale(.2)", opacity: 0 },
];
export const cardDropped = (transform: string): Keyframe[] => [
  { transform, opacity: 1 },
  { transform: `${transform} translateY(200px) rotate(20deg)`, opacity: 0 },
];
