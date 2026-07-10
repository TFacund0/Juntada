// Figuras estilizadas para las cartas de figura (10 Sota, 11 Caballo, 12
// Rey), dibujadas en el mismo estilo de silueta lineal que los palos
// (SuitGlyph.jsx) — no son ilustraciones realistas, pero cada una se
// reconoce por su forma característica.
export function FaceIcon({ value, color }) {
  if (value === 11) {
    // Caballo: cabeza y cuello de caballo de perfil.
    return (
      <g fill={color}>
        <path d="M -6,18 C -12,12 -13,-2 -7,-10 C -3,-15 4,-18 11,-13 C 15,-10 15,-5 10,-5 L 5,-5 C 8,-2 8,4 3,6 L 3,18 Z" />
        <path d="M -1,-16 L 3,-21 L 5,-14 Z" />
        <circle cx={8} cy={-9} r={1.4} fill="#f2e9d3" />
      </g>
    );
  }

  if (value === 12) {
    // Rey: figura con corona.
    return (
      <g fill={color}>
        <path d="M -7,-19 L -3.5,-13 L 0,-20 L 3.5,-13 L 7,-19 L 5,-13 L -5,-13 Z" />
        <circle cx={0} cy={-6} r={6.5} />
        <path d="M -9,4 Q 0,-2 9,4 L 9,19 Q 0,23 -9,19 Z" />
      </g>
    );
  }

  // Sota (10): figura de paje/soldado con una pequeña bandera.
  return (
    <g fill={color}>
      <circle cx={-2} cy={-14} r={6} />
      <path d="M -9,-6 Q -2,-10 6,-6 L 6,14 Q -2,18 -9,14 Z" />
      <path d="M 6,-8 L 19,-3 L 6,2 Z" />
    </g>
  );
}
