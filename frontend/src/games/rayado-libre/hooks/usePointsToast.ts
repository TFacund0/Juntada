import { useEffect, useRef, useState } from "react";

export interface LastGuess {
  playerId: string;
  points: number;
  guessId: number;
}

/**
 * Shows a brief "+N puntos" toast exactly once per correct guess, diffing
 * guessId the same way impostor diffs rerollCount — private_role can arrive
 * again for unrelated reasons and shouldn't replay the toast each time.
 */
export function usePointsToast(lastGuess: LastGuess | undefined): number | null {
  const [pointsToast, setPointsToast] = useState<number | null>(null);
  const lastGuessId = useRef<number | null>(null);

  useEffect(() => {
    if (lastGuess && lastGuess.guessId !== lastGuessId.current) {
      lastGuessId.current = lastGuess.guessId;
      setPointsToast(lastGuess.points);
      const t = setTimeout(() => setPointsToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [lastGuess]);

  return pointsToast;
}
