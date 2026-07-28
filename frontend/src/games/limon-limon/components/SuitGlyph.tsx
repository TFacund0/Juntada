import { suitInfo } from "../deck";

interface SuitGlyphProps {
  suit: string;
  x?: number;
  y?: number;
  scale?: number;
  color?: string;
}

// Dibuja el símbolo de cada palo de la baraja española en un sistema de
// coordenadas local centrado en (0,0), de ~16x16. Se usa tanto para las
// figuras (pips) de la carta como para los índices de esquina y las pestañas
// del editor — no son emojis, son formas propias así el mazo se ve consistente
// en cualquier dispositivo.
export function SuitGlyph({ suit, x = 0, y = 0, scale = 1, color }: SuitGlyphProps) {
  const fill = color || suitInfo(suit)?.color || "#999";
  const t = `translate(${x},${y}) scale(${scale})`;

  if (suit === "oro") {
    // Moneda de oro: aro exterior, aro interior fino y marcas a los 4 puntos
    // cardinales, como el borde acanalado de una moneda real.
    return (
      <g transform={t}>
        <circle r={6.3} fill="none" stroke={fill} strokeWidth={1.5} />
        <circle r={4.5} fill="none" stroke={fill} strokeWidth={0.7} opacity={0.55} />
        <circle r={1.9} fill={fill} />
        <line x1={0} y1={-6.3} x2={0} y2={-5.1} stroke={fill} strokeWidth={1.1} />
        <line x1={0} y1={6.3} x2={0} y2={5.1} stroke={fill} strokeWidth={1.1} />
        <line x1={-6.3} y1={0} x2={-5.1} y2={0} stroke={fill} strokeWidth={1.1} />
        <line x1={6.3} y1={0} x2={5.1} y2={0} stroke={fill} strokeWidth={1.1} />
      </g>
    );
  }

  if (suit === "copa") {
    // Copa/cáliz: boca curva y redondeada en vez de un trapecio recto, para
    // que se lea como una copa y no como una forma geométrica plana.
    return (
      <g transform={t} fill={fill}>
        <path d="M -6,-7 Q -6,-8.6 -4.4,-8.6 L 4.4,-8.6 Q 6,-8.6 6,-7 Q 6,-1.3 0,2.6 Q -6,-1.3 -6,-7 Z" />
        <rect x={-1} y={2} width={2} height={3.6} />
        <ellipse cx={0} cy={5.9} rx={4.6} ry={1.4} />
      </g>
    );
  }

  if (suit === "espada") {
    // Espada: hoja en punta más marcada, guarda ancha y pomo redondo en la
    // base — se lee como una espada de verdad, no solo un palo con travesaño.
    return (
      <g transform={t} fill={fill}>
        <polygon points="0,-9 1.7,-5.8 1.7,3.6 -1.7,3.6 -1.7,-5.8" />
        <rect x={-4.6} y={2.8} width={9.2} height={1.7} rx={0.8} />
        <rect x={-1} y={4.3} width={2} height={3.2} />
        <circle cx={0} cy={8.2} r={1.3} />
      </g>
    );
  }

  // basto — garrote/palo de madera nudoso, grueso en la punta y afinado
  // hacia el mango, en diagonal como en la baraja española tradicional.
  return (
    <g transform={t}>
      <g transform="rotate(22)">
        <path d="M -1.3,8.6 Q 0,9.6 1.3,8.6 L 2,-3 Q 2.2,-4.6 0,-4.8 Q -2.2,-4.6 -2,-3 Z" fill={fill} />
        <ellipse cx={0} cy={-6.3} rx={3.6} ry={3.2} fill={fill} />
        <circle cx={-1.1} cy={-7.1} r={0.55} fill="rgba(0,0,0,0.28)" />
        <circle cx={1.2} cy={-5.6} r={0.45} fill="rgba(0,0,0,0.28)" />
        <circle cx={0.2} cy={-7.5} r={0.35} fill="rgba(0,0,0,0.28)" />
      </g>
    </g>
  );
}
