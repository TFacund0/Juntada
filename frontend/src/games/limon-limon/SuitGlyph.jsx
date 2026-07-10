import { suitInfo } from "./deck";

// Dibuja el símbolo de cada palo de la baraja española en un sistema de
// coordenadas local centrado en (0,0), de ~16x16. Se usa tanto para las
// figuras (pips) de la carta como para los índices de esquina y las pestañas
// del editor — no son emojis, son formas propias así el mazo se ve consistente
// en cualquier dispositivo.
export function SuitGlyph({ suit, x = 0, y = 0, scale = 1, color }) {
  const fill = color || suitInfo(suit)?.color || "#999";
  const t = `translate(${x},${y}) scale(${scale})`;

  if (suit === "oro") {
    return (
      <g transform={t}>
        <circle r={6.2} fill="none" stroke={fill} strokeWidth={1.6} />
        <circle r={2.6} fill={fill} />
      </g>
    );
  }

  if (suit === "copa") {
    return (
      <g transform={t} fill={fill}>
        <path d="M -6,-7 L 6,-7 L 4,-1 Q 0,2.5 -4,-1 Z" />
        <rect x={-1} y={-1} width={2} height={4.5} />
        <rect x={-4.5} y={3.2} width={9} height={1.8} rx={0.9} />
      </g>
    );
  }

  if (suit === "espada") {
    return (
      <g transform={t} fill={fill}>
        <polygon points="0,-8.5 1.8,-5.5 1.8,3.5 -1.8,3.5 -1.8,-5.5" />
        <rect x={-4.5} y={2.6} width={9} height={1.8} rx={0.6} />
        <rect x={-1} y={4.2} width={2} height={4} />
      </g>
    );
  }

  // basto — palo/garrote de madera, en diagonal
  return (
    <g transform={t}>
      <rect x={-2.1} y={-8.5} width={4.2} height={17} rx={2.1} fill={fill} transform="rotate(22)" />
    </g>
  );
}
