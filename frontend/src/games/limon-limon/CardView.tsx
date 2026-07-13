import { useEffect, useState, type CSSProperties } from "react";
import { suitInfo, valueLabel } from "./deck";
import type { Card } from "./deck";
import { SuitGlyph } from "./SuitGlyph";
import { FaceIcon } from "./FaceIcon";

// Distribución de figuras (pips) para las cartas numéricas, en el sistema de
// coordenadas del viewBox de la carta (100 de ancho x 140 de alto), tal como
// se distribuyen los palos en un naipe real.
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 70]],
  2: [
    [50, 42],
    [50, 98],
  ],
  3: [
    [50, 35],
    [50, 70],
    [50, 105],
  ],
  4: [
    [32, 42],
    [68, 42],
    [32, 98],
    [68, 98],
  ],
  5: [
    [32, 38],
    [68, 38],
    [50, 70],
    [32, 102],
    [68, 102],
  ],
  6: [
    [32, 35],
    [68, 35],
    [32, 70],
    [68, 70],
    [32, 105],
    [68, 105],
  ],
  7: [
    [32, 32],
    [68, 32],
    [32, 58],
    [68, 58],
    [50, 74],
    [32, 108],
    [68, 108],
  ],
};

function cornerLabel(value: number): string {
  return String(value);
}

function CardFace({ card }: { card: Card }) {
  const suit = suitInfo(card.suit);
  const isFace = card.value >= 10;
  const label = cornerLabel(card.value);

  const Corner = ({ rotate }: { rotate?: boolean }) => (
    <g transform={rotate ? "rotate(180 50 70)" : undefined}>
      <text x={9} y={17} fontSize={11} fontWeight={800} fill={suit.color} fontFamily="inherit">
        {label}
      </text>
    </g>
  );

  return (
    <svg viewBox="0 0 100 140" style={{ display: "block", width: "100%", height: "100%" }}>
      <rect x={1.5} y={1.5} width={97} height={137} rx={9} fill="#f2e9d3" stroke={suit.color} strokeWidth={3} />
      <rect x={6} y={6} width={88} height={128} rx={5} fill="none" stroke={suit.color} strokeWidth={0.6} opacity={0.4} />

      <Corner />
      <Corner rotate />

      {isFace ? (
        <g transform="translate(50,72)">
          <circle r={27} fill="none" stroke={suit.color} strokeWidth={1.4} opacity={0.5} />
          <FaceIcon value={card.value} color={suit.color} />
          <SuitGlyph suit={card.suit} x={0} y={33} scale={0.55} />
          <text y={47} textAnchor="middle" fontSize={11} fontWeight={700} fill={suit.color} fontFamily="inherit">
            {valueLabel(card.value)}
          </text>
        </g>
      ) : (
        PIP_LAYOUTS[card.value].map(([x, y], i) => <SuitGlyph key={i} suit={card.suit} x={x} y={y} scale={0.85} />)
      )}
    </svg>
  );
}

function CardBack() {
  return (
    <svg viewBox="0 0 100 140" style={{ display: "block", width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="limonBack" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4b3f8f" />
          <stop offset="1" stopColor="#2c2454" />
        </linearGradient>
      </defs>
      <rect x={1.5} y={1.5} width={97} height={137} rx={9} fill="url(#limonBack)" stroke="rgba(255,255,255,0.25)" strokeWidth={2} />
      <rect x={8} y={8} width={84} height={124} rx={6} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1.2} />
      <text x={50} y={80} textAnchor="middle" fontSize={34}>
        🍋
      </text>
    </svg>
  );
}

const LAYER_OFFSET_PX = 1.5;

interface DeckStackProps {
  cardsLeft: number;
  size?: "large" | "small";
}

// Capas de dorso apiladas detrás de la carta actual, una por cada carta que
// todavía queda debajo — así el volumen del mazo refleja la cantidad exacta
// y se ve bajar a medida que se van sacando cartas.
export function DeckStack({ cardsLeft, size = "large" }: DeckStackProps) {
  const big = size === "large";
  const width = big ? 140 : 64;
  const height = big ? 196 : 90;

  return (
    <>
      {Array.from({ length: cardsLeft }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            width,
            height,
            marginLeft: -width / 2,
            borderRadius: big ? 14 : 8,
            overflow: "hidden",
            boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
            transform: `translateX(${(i + 1) * LAYER_OFFSET_PX}px)`,
            zIndex: -1 - i,
          }}
        >
          <CardBack />
        </div>
      ))}
    </>
  );
}

interface CardViewProps {
  card?: Card | null;
  size?: "large" | "small";
  onClick?: () => void;
}

// Carta grande (revelada) o el lomo del mazo (dorso) si no se pasa `card`.
// La cara y el dorso conviven en el DOM y se giran en 3D con CSS —
// mantenemos la última carta mostrada (`shownCard`) para que no desaparezca
// a mitad de la animación cuando `card` vuelve a null.
export function CardView({ card, size = "large", onClick }: CardViewProps) {
  const big = size === "large";
  const width = big ? 140 : 64;
  const height = big ? 196 : 90;
  const [shownCard, setShownCard] = useState<Card | null>(card ?? null);
  const flipped = !!card;

  useEffect(() => {
    if (card) setShownCard(card);
  }, [card]);

  const faceStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    borderRadius: big ? 14 : 8,
    overflow: "hidden",
    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
  };

  return (
    <div
      onClick={onClick}
      style={{ width, height, margin: "0 auto", cursor: onClick ? "pointer" : "default", userSelect: "none", perspective: 800 }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 0.45s cubic-bezier(0.4, 0.2, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        <div style={faceStyle}>
          <CardBack />
        </div>
        <div style={{ ...faceStyle, transform: "rotateY(180deg)" }}>{shownCard && <CardFace card={shownCard} />}</div>
      </div>
    </div>
  );
}
