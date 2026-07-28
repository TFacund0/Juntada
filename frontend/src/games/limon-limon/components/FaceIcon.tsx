interface FaceIconProps {
  value: number;
  color: string;
}

// Figuras estilizadas para las cartas de figura (10 Sota, 11 Caballo, 12
// Rey) — formas geométricas simples (rectángulos, triángulos, círculos) en
// vez de curvas libres, para que cada silueta se lea con claridad y no
// dependan una de otra ni del color para distinguirse.
export function FaceIcon({ value, color }: FaceIconProps) {
  if (value === 11) {
    // Caballo: cuello + cabeza angular + oreja, de perfil mirando a la
    // izquierda — la única figura no humana, así no se confunde con las
    // otras dos.
    return (
      <g fill={color}>
        <rect x={-3} y={0} width={12} height={20} />
        <path d="M -3,0 L -17,4 L -14,-9 L -3,-15 Z" />
        <path d="M -7,-15 L -2,-23 L 2,-14 Z" />
        <circle cx={-9} cy={-3} r={1.6} fill="#f2e9d3" />
      </g>
    );
  }

  if (value === 12) {
    // Rey: corona de 3 puntas (patrón clásico en zigzag) sobre un manto
    // rectangular — la silueta más ancha de las tres, inconfundible.
    return (
      <g fill={color}>
        <path d="M -9,-12 L -9,-20 L -4.5,-15 L 0,-23 L 4.5,-15 L 9,-20 L 9,-12 Z" />
        <circle cx={0} cy={-15} r={1.3} fill="#f2e9d3" />
        <rect x={-9} y={-11} width={18} height={19} rx={1.5} />
      </g>
    );
  }

  // Sota (10): paje — cabeza redonda + torso rectangular + banda cruzada,
  // sin corona ni orejas, la silueta más chica y sencilla de las tres.
  return (
    <g fill={color}>
      <circle cx={0} cy={-12} r={6.5} />
      <rect x={-9} y={-1} width={18} height={20} rx={1.5} />
      <rect x={-9} y={2} width={18} height={3} fill="#f2e9d3" opacity={0.55} transform="rotate(-14 0 3.5)" />
    </g>
  );
}
