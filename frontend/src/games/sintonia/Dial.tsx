// Dial semicircular tipo "Wavelength": un valor 0-100 se mapea a un ángulo
// entre 180° (extremo izquierdo) y 0° (extremo derecho), pasando por arriba.
// Si se pasa `target`, dibuja las zonas de puntaje alrededor del objetivo con
// su valor en puntos. `markers` dibuja una marca por cada adivinanza ya
// confirmada, para ver en qué zona cayó cada una.

import { SCORE_ZONES } from "@juntada/sintonia-scoring";

const CX = 150;
const CY = 150;
const R = 130;

function pointAt(radius: number, valuePct: number): [number, number] {
  const angle = (180 - (valuePct / 100) * 180) * (Math.PI / 180);
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
}

function arcPath(radiusOuter: number, radiusInner: number, fromPct: number, toPct: number): string {
  const [x1, y1] = pointAt(radiusOuter, fromPct);
  const [x2, y2] = pointAt(radiusOuter, toPct);
  const [x3, y3] = pointAt(radiusInner, toPct);
  const [x4, y4] = pointAt(radiusInner, fromPct);
  const large = toPct - fromPct > 50 ? 1 : 0;
  return `M ${x1} ${y1} A ${radiusOuter} ${radiusOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${radiusInner} ${radiusInner} 0 ${large} 0 ${x4} ${y4} Z`;
}

// Thresholds come from @juntada/sintonia-scoring — the single source of
// truth for how many points each distance from the target is worth; colors
// are purely a rendering concern, applied here in the same order.
const ZONE_COLORS = ["#EF9F27", "#5DCAA5", "rgba(93,202,165,0.35)"];
const ZONES = SCORE_ZONES.map((z, i) => ({ ...z, color: ZONE_COLORS[i] }));

const MARKER_COLORS = ["#534AB7", "#4A9FE0", "#C77DE0", "#E0C24A", "#6BD1C0", "#F09595"];

interface Marker {
  value: number;
  label?: string;
  color?: string;
}

interface DialProps {
  value: number;
  target?: number | null;
  leftLabel: string;
  rightLabel: string;
  markers?: Marker[];
}

export function Dial({ value, target = null, leftLabel, rightLabel, markers = [] }: DialProps) {
  const [needleX, needleY] = pointAt(R - 14, value);
  return (
    <div style={{ width: "100%", maxWidth: 320, margin: "0 auto" }}>
      <svg viewBox="0 0 300 175" width="100%" style={{ overflow: "visible" }}>
        <path d={arcPath(R, R - 22, 0, 100)} fill="rgba(255,255,255,0.06)" />
        {target != null &&
          ZONES.slice()
            .reverse()
            .map((z, i) => {
              const from = Math.max(0, target - z.spread);
              const to = Math.min(100, target + z.spread);
              return <path key={i} d={arcPath(R, R - 22, from, to)} fill={z.color} />;
            })}
        {target != null &&
          ZONES.map((z, i) => {
            const prevSpread = i > 0 ? ZONES[i - 1].spread : 0;
            const mid = (prevSpread + z.spread) / 2;
            return [1, -1].map(sign => {
              const v = target + sign * mid;
              if (v <= 1 || v >= 99) return null; // no hay lugar visible cerca del borde
              const [lx, ly] = pointAt(R - 11, v);
              return (
                <text
                  key={`${i}-${sign}`}
                  x={lx}
                  y={ly}
                  fill="#0f0c1d"
                  fontSize={11}
                  fontWeight={800}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {z.points}
                </text>
              );
            });
          })}
        {target != null &&
          (() => {
            const [tx, ty] = pointAt(R - 11, target);
            return <circle cx={tx} cy={ty} r={5} fill="#fff" stroke="#0f0c1d" strokeWidth={1.5} />;
          })()}
        {markers.map((m, i) => {
          const [mx, my] = pointAt(R - 11, m.value);
          const color = m.color || MARKER_COLORS[i % MARKER_COLORS.length];
          return (
            <g key={i}>
              <circle cx={mx} cy={my} r={8} fill={color} stroke="#0f0c1d" strokeWidth={1.5} />
              {m.label && (
                <text x={mx} y={my} fontSize={9} fontWeight={800} fill="#fff" textAnchor="middle" dominantBaseline="middle">
                  {m.label}
                </text>
              )}
            </g>
          );
        })}
        <line x1={CX} y1={CY} x2={needleX} y2={needleY} stroke="#E24B4A" strokeWidth={4} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={11} fill="#E24B4A" stroke="#0f0c1d" strokeWidth={2} />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#AFA9EC", textAlign: "left" }}>{leftLabel}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#AFA9EC", textAlign: "right" }}>{rightLabel}</span>
      </div>
    </div>
  );
}
