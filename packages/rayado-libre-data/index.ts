// ─── Rayado Libre Word Bank ──────────────────────────────────────────────────
// Deliberately its own word bank, separate from impostor-data/tutifruti-data —
// this game's words need to be drawable (concrete, mostly nouns), which is a
// different requirement than Impostor's "hard to describe" pick or
// Tutifrutti's "starts with a letter" one, so mixing the pools wouldn't make
// sense even if it were convenient to share.
export interface Category {
  label: string;
  icon: string;
  words: string[];
}

function shuffleArray<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Every word across the given active categories, combined (not one category
// at a time) — shared by the backend engine and LocalGame so "which words
// are even eligible right now" can never drift between the two.
export function activeWordPool(categories: Record<string, Category>, activeKeys: readonly string[]): string[] {
  return activeKeys.flatMap(k => categories[k]?.words ?? []);
}

// Offers 3 words at random from the pool, avoiding ones already used this
// game. `resetUsed` comes back true when the pool didn't have 3 unused words
// left (so this call had to allow repeats) — the caller decides whether/how
// to persist clearing its own used-words bookkeeping, since that lives in a
// different shape server-side (room.usedWords.words) than in LocalGame (a
// plain ref array).
export function pickThreeWords(pool: readonly string[], usedWords: readonly string[]): { words: string[]; resetUsed: boolean } {
  const available = pool.filter(w => !usedWords.includes(w));
  const resetUsed = available.length < 3;
  return { words: shuffleArray(resetUsed ? pool : available).slice(0, 3), resetUsed };
}

export const CATEGORIES: Record<string, Category> = {
  animales: {
    label: "Animales",
    icon: "🦁",
    words: [
      "León",
      "Elefante",
      "Jirafa",
      "Perro",
      "Gato",
      "Pingüino",
      "Serpiente",
      "Tiburón",
      "Pulpo",
      "Araña",
      "Mono",
      "Canguro",
      "Tortuga",
      "Delfín",
      "Búho",
      "Murciélago",
      "Camello",
      "Cebra",
      "Cocodrilo",
      "Águila",
      "Oso",
      "Conejo",
      "Rana",
      "Abeja",
      "Caracol",
      "Pulga",
      "Vaca",
      "Cerdo",
      "Oveja",
      "Gallina",
    ],
  },
  objetos: {
    label: "Objetos Cotidianos",
    icon: "🪑",
    words: [
      "Silla",
      "Mesa",
      "Reloj",
      "Paraguas",
      "Bicicleta",
      "Teléfono",
      "Lámpara",
      "Anteojos",
      "Tijeras",
      "Escalera",
      "Llave",
      "Candado",
      "Espejo",
      "Cepillo de dientes",
      "Peine",
      "Sombrero",
      "Zapato",
      "Mochila",
      "Guitarra",
      "Piano",
      "Tambor",
      "Cámara de fotos",
      "Televisor",
      "Ventilador",
      "Escoba",
      "Balde",
      "Martillo",
      "Destornillador",
      "Tijera de podar",
      "Regadera",
    ],
  },
  comida: {
    label: "Comida",
    icon: "🍕",
    words: [
      "Pizza",
      "Hamburguesa",
      "Helado",
      "Torta",
      "Sandía",
      "Banana",
      "Pan",
      "Huevo frito",
      "Salchicha",
      "Queso",
      "Taco",
      "Sushi",
      "Espagueti",
      "Pochoclo",
      "Alfajor",
      "Empanada",
      "Choripán",
      "Manzana",
      "Uva",
      "Zanahoria",
      "Papa frita",
      "Donut",
      "Galleta",
      "Chocolate",
      "Café",
      "Limón",
      "Piña",
      "Cereza",
      "Maní",
      "Miel",
    ],
  },
  profesiones: {
    label: "Profesiones",
    icon: "💼",
    words: [
      "Médico",
      "Bombero",
      "Policía",
      "Cocinero",
      "Maestro",
      "Pintor",
      "Payaso",
      "Astronauta",
      "Pescador",
      "Carpintero",
      "Peluquero",
      "Piloto",
      "Buzo",
      "Mago",
      "Detective",
      "Granjero",
      "Fotógrafo",
      "Panadero",
      "Cartero",
      "Salvavidas",
      "Arquitecto",
      "Jardinero",
      "Electricista",
      "Plomero",
      "Veterinario",
    ],
  },
  deportes: {
    label: "Deportes y Juegos",
    icon: "🏅",
    words: [
      "Fútbol",
      "Básquet",
      "Tenis",
      "Natación",
      "Boxeo",
      "Ciclismo",
      "Ajedrez",
      "Surf",
      "Esquí",
      "Yoga",
      "Golf",
      "Voleibol",
      "Karate",
      "Patinaje",
      "Pesca",
      "Escalada",
      "Arquería",
      "Bowling",
      "Rugby",
      "Béisbol",
    ],
  },
  lugares: {
    label: "Lugares",
    icon: "🗺️",
    words: [
      "Playa",
      "Montaña",
      "Desierto",
      "Selva",
      "Isla",
      "Volcán",
      "Castillo",
      "Faro",
      "Cueva",
      "Puente",
      "Aeropuerto",
      "Estadio",
      "Zoológico",
      "Escuela",
      "Hospital",
      "Iglesia",
      "Supermercado",
      "Granja",
      "Cascada",
      "Bosque",
    ],
  },
  personajes: {
    label: "Personajes y Fantasía",
    icon: "🦸",
    words: [
      "Superhéroe",
      "Pirata",
      "Fantasma",
      "Vampiro",
      "Dragón",
      "Robot",
      "Extraterrestre",
      "Sirena",
      "Bruja",
      "Duende",
      "Momia",
      "Zombi",
      "Hada",
      "Unicornio",
      "Príncipe",
      "Princesa",
      "Caballero",
      "Gigante",
      "Ninja",
      "Vikingo",
    ],
  },
  naturaleza: {
    label: "Naturaleza y Clima",
    icon: "🌦️",
    words: [
      "Sol",
      "Luna",
      "Estrella",
      "Nube",
      "Lluvia",
      "Nieve",
      "Arcoíris",
      "Rayo",
      "Árbol",
      "Flor",
      "Cactus",
      "Río",
      "Océano",
      "Terremoto",
      "Huracán",
      "Iceberg",
      "Volcán en erupción",
      "Estrella fugaz",
    ],
  },
};
