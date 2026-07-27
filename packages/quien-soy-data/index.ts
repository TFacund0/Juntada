// ─── Game Data ───────────────────────────────────────────────────────────────
// Word pools for "¿Quién Soy?"'s "categorías" word source (the alternative to
// "sugerida", where players write their own words instead) — same
// Record<string, Category> shape as impostor-data, just without hints since
// nobody here needs a bluffing clue.
import { normalizeWord } from "@juntada/tutifruti-words";

export interface Category {
  label: string;
  icon: string;
  words: string[];
}

// How many wrong guesses a player gets before they're eliminated from the
// round — shared by the backend engine (enforces it) and both frontend
// modes (display "intentos fallidos: x/y"), so all three can never silently
// drift to different limits.
export const MAX_WRONG_GUESSES = 3;

// A guess counts even if it's only one significant word of a multi-word
// answer (e.g. guessing "Messi" for "Lionel Messi") — exact equality still
// wins first and is the common case, but this covers someone not
// remembering/typing every word of a name or phrase. Only kicks in when the
// actual word genuinely has more than one significant token, and skips
// short filler ones (≤2 chars, e.g. "de", "la") so guessing those doesn't
// cheaply solve something like "Rey de Corazones". Shared by the backend
// engine and local pass-and-play, so both modes score a guess the same way
// instead of local silently being stricter.
export function isCorrectGuess(guess: string, actualWord: string): boolean {
  const normalizedGuess = normalizeWord(guess);
  const normalizedActual = normalizeWord(actualWord);
  if (normalizedGuess === normalizedActual) return true;
  const tokens = normalizedActual.split(/\s+/).filter(t => t.length > 2);
  return tokens.length > 1 && tokens.includes(normalizedGuess);
}

export type QuienSoyOutcome = "solved" | "eliminated" | "conceded";

export interface QuienSoyResult {
  playerId: string;
  outcome: QuienSoyOutcome;
  lap: number;
}

// Points favor earlier laps; ties (same lap) share the same rank instead of
// one edging out the other just because their turn happened to come first.
// Shared by the backend engine (applies points to the persistent score) and
// the frontend's Standings display (computes the same ranks purely to show
// them) — one algorithm instead of two hand-copied ones that could silently
// diverge on a scoring tweak.
export function computeMatchRanks(results: QuienSoyResult[], playerCount: number): Record<string, { rank: number; points: number }> {
  const solved = results.filter(r => r.outcome === "solved").sort((a, b) => a.lap - b.lap);
  const out: Record<string, { rank: number; points: number }> = {};
  let rank = 0;
  let lastLap: number | null = null;
  solved.forEach((res, i) => {
    if (res.lap !== lastLap) {
      rank = i + 1;
      lastLap = res.lap;
    }
    out[res.playerId] = { rank, points: Math.max(0, playerCount - rank + 1) };
  });
  return out;
}

// ─── Online wire types ───────────────────────────────────────────────────
// The exact shape backend/src/games/quien-soy/engine.ts's
// getPublicRoundView/getPrivateView/getRevealMessage return, and what
// frontend/.../quien-soy/RoundView.tsx reads room.round/myRole/wordReveal
// as — one shared definition instead of hand-mirrored copies that could
// silently drift apart on a field rename.
export interface QAResponse {
  answer: "si" | "no" | "skip";
  comment: string | null;
}

export interface QAEntry {
  turnPlayerId: string;
  question: string;
  responses: Record<string, QAResponse>;
}

export interface GuessLogEntry {
  playerId: string;
  text: string;
  correct: boolean;
}

export interface QuienSoyRoundView {
  wordSource?: "categories" | "suggested";
  submittedCount?: number | null;
  currentVoteTarget?: string | null;
  voteSubmittedCount?: number | null;
  voteEligibleCount?: number | null;
  currentTurnPlayerId?: string | null;
  turnOrder?: string[];
  lapNumber?: number;
  pendingQuestion?: { by: string; text: string; responses: Record<string, QAResponse> } | null;
  qaLog?: QAEntry[];
  guessLog?: GuessLogEntry[];
  wrongGuesses?: Record<string, number>;
  results?: QuienSoyResult[];
  words?: Record<string, string> | null;
}

export interface QuienSoyPrivateRole {
  wordsVisibleToMe: Record<string, string>;
  myWrongGuesses: number;
  mySuggestionSubmitted: boolean;
  voteSuggestions: string[] | null;
  myVote: number | null;
  myWord: string | null;
}

export interface QuienSoyReveal {
  words: Record<string, string>;
}

export const CATEGORIES: Record<string, Category> = {
  "personajes-famosos": {
    label: "Personajes Famosos",
    icon: "🌟",
    words: [
      "Lionel Messi",
      "Diego Maradona",
      "Shakira",
      "Freddie Mercury",
      "Albert Einstein",
      "Leonardo da Vinci",
      "Frida Kahlo",
      "Charly García",
      "Michael Jackson",
      "Elvis Presley",
      "Marilyn Monroe",
      "Charlie Chaplin",
      "Pablo Picasso",
      "Steve Jobs",
      "Walt Disney",
      "Beyoncé",
      "Madonna",
      "Bad Bunny",
      "Cristiano Ronaldo",
      "Serena Williams",
    ],
  },
  "personajes-de-ficcion": {
    label: "Personajes de Ficción",
    icon: "🎬",
    words: [
      "Harry Potter",
      "Batman",
      "Spider-Man",
      "Homero Simpson",
      "Shrek",
      "Woody",
      "Mickey Mouse",
      "Darth Vader",
      "Sherlock Holmes",
      "Frodo Bolsón",
      "James Bond",
      "Indiana Jones",
      "Forrest Gump",
      "El Joker",
      "Wonder Woman",
      "Gandalf",
      "Elsa",
      "Buzz Lightyear",
      "Pikachu",
      "Chapulín Colorado",
    ],
  },
  animales: {
    label: "Animales",
    icon: "🦁",
    words: [
      "León",
      "Elefante",
      "Delfín",
      "Águila",
      "Pingüino",
      "Tiburón",
      "Jirafa",
      "Canguro",
      "Pulpo",
      "Oso Panda",
      "Cocodrilo",
      "Búho",
      "Tortuga",
      "Zorro",
      "Lobo",
      "Camaleón",
      "Koala",
      "Murciélago",
      "Flamenco",
      "Erizo",
    ],
  },
  profesiones: {
    label: "Profesiones",
    icon: "👷",
    words: [
      "Médico",
      "Bombero",
      "Policía",
      "Maestro",
      "Astronauta",
      "Piloto",
      "Chef",
      "Abogado",
      "Arquitecto",
      "Periodista",
      "Veterinario",
      "Dentista",
      "Peluquero",
      "Fotógrafo",
      "Electricista",
      "Cartero",
      "Jardinero",
      "Actor",
      "Músico",
      "Programador",
    ],
  },
  superheroes: {
    label: "Superhéroes y Villanos",
    icon: "🦸",
    words: [
      "Superman",
      "Wolverine",
      "Iron Man",
      "Thor",
      "Capitán América",
      "Flash",
      "Hulk",
      "Thanos",
      "Magneto",
      "Deadpool",
      "Catwoman",
      "Doctor Extraño",
      "Viuda Negra",
      "Green Lantern",
      "Aquaman",
      "Loki",
      "Lex Luthor",
      "Venom",
      "Star-Lord",
      "Harley Quinn",
    ],
  },
};
