import { S } from "../../../theme/styles";
import { Btn } from "../../../components/Btn";
import { PhaseTransition } from "../../../components/PhaseTransition";
import type { LocalPlayer } from "../types/localGame";

interface WordRevealScreenProps {
  turnNumber: number;
  totalTurns: number;
  drawer: LocalPlayer | undefined;
  choicesRevealed: boolean;
  revealChoices: () => void;
  wordChoices: string[];
  chooseWord: (word: string) => void;
}

/** Pantalla "wordReveal" del modo local: el dispositivo recién pasó de mano y quien dibuja elige palabra en privado. */
export function WordRevealScreen({
  turnNumber,
  totalTurns,
  drawer,
  choicesRevealed,
  revealChoices,
  wordChoices,
  chooseWord,
}: WordRevealScreenProps) {
  return (
    <PhaseTransition phaseKey="wordReveal">
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#9089c0" }}>
            Turno {turnNumber}/{totalTurns}
          </p>
          <p style={{ fontSize: 16, fontWeight: 800, color: "#AFA9EC", margin: "6px 0" }}>Le toca dibujar a {drawer?.name}</p>
          <p style={{ fontSize: 13, color: "#9089c0" }}>Pasale el dispositivo — el resto no tiene que ver la pantalla todavía</p>
        </div>

        {!choicesRevealed ? (
          <Btn variant="primary" onClick={revealChoices}>
            Ya tengo el dispositivo — ver mis palabras
          </Btn>
        ) : (
          <div style={S.card}>
            <span style={S.label}>Elegí qué vas a dibujar</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              {wordChoices.map(w => (
                <Btn key={w} variant="success" onClick={() => chooseWord(w)}>
                  {w}
                </Btn>
              ))}
            </div>
          </div>
        )}
      </div>
    </PhaseTransition>
  );
}
