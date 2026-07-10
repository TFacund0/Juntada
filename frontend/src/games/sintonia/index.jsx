import { ComingSoon } from "../../components/ComingSoon";

// Wavelength-style game: one player secretly places a needle on a 0-100
// dial between two opposite concepts (e.g. "Frío" ↔ "Caliente") and gives a
// clue tied to that point (a movie, a person, anything); the rest try to
// guess where the needle landed. Menu entry only for now — see ComingSoon.
export const sintoniaGame = {
  id: "sintonia",
  label: "Sintonía",
  description: "Uno mueve la flecha a un punto secreto entre dos conceptos opuestos y da una pista. Los demás intentan adivinar dónde quedó.",
  minPlayers: 3,
  comingSoon: true,
  LocalGame: () => <ComingSoon label="Sintonía" />,
  ConfigPanel: () => <ComingSoon label="Sintonía" />,
  RoundView: () => <ComingSoon label="Sintonía" />,
};
