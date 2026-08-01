// Metadata puramente de presentación para las cards del picker (tagline
// corta, tiempo aproximado de partida y rango de jugadores) — no es parte
// del contrato de GameDef (gameTypes.ts) porque no la usa ninguna lógica de
// sala/backend, solo GamePicker/GameGrid. La `tagline` es una versión corta
// de una sola línea de la `description` completa (que sigue viviendo en
// GameDetailDialog, para la vista previa); los tiempos son estimaciones
// editables, no un dato medido; el rango de jugadores usa el minPlayers real
// de cada juego (ver registry.ts) más el techo configurable habitual (16)
// del lobby.
export const PICKER_META: Record<string, { tagline: string; minutes: string; players: string }> = {
  impostor: { tagline: "Descubrí quién miente antes de que sea tarde.", minutes: "10 min", players: "3-16 jugadores" },
  tutifruti: { tagline: "Una letra, mil categorías, cero tiempo.", minutes: "15 min", players: "2-16 jugadores" },
  ruleta: { tagline: "Girá y que decida el azar.", minutes: "5 min", players: "1-16 jugadores" },
  sintonia: { tagline: "¿Qué tanto se conocen? Averígüenlo.", minutes: "10 min", players: "2-16 jugadores" },
  tateti: { tagline: "El clásico de siempre, ahora entre amigos.", minutes: "3 min", players: "2 jugadores" },
  "color-correcto": { tagline: "Reflejos al límite contra el reloj.", minutes: "5 min", players: "2-16 jugadores" },
  "quien-soy": { tagline: "Adiviná tu personaje con preguntas.", minutes: "12 min", players: "2-16 jugadores" },
  "limon-limon": { tagline: "Ritmo, memoria y nervios de acero.", minutes: "8 min", players: "2-16 jugadores" },
  "torneo-futbol": { tagline: "Armá tu equipo y jugá el campeonato.", minutes: "20 min", players: "2-16 jugadores" },
  "rayado-libre": { tagline: "Dibujen, adivinen y ríanse un rato.", minutes: "15 min", players: "3-16 jugadores" },
  recamara: { tagline: "Ruleta rusa de preguntas y prendas.", minutes: "10 min", players: "2-16 jugadores" },
  ahorcado: { tagline: "Adiviná la palabra letra por letra.", minutes: "10 min", players: "2-16 jugadores" },
  bomba: { tagline: "Pasala antes de que explote.", minutes: "10 min", players: "3-16 jugadores" },
  "clave-secreta": { tagline: "Descifrá la clave antes que el otro equipo.", minutes: "15 min", players: "4-16 jugadores" },
  "confesiones-anonimas": { tagline: "¿De quién es cada confesión?", minutes: "10 min", players: "3-16 jugadores" },
  "emoji-pelicula": { tagline: "Adiviná la peli en emojis.", minutes: "10 min", players: "2-16 jugadores" },
  "mas-probable": { tagline: "¿Quién de ustedes es más probable que...?", minutes: "10 min", players: "3-16 jugadores" },
  memotest: { tagline: "Memoria y velocidad, carta por carta.", minutes: "8 min", players: "2-16 jugadores" },
  mimica: { tagline: "Actuá sin hablar y que adivinen.", minutes: "15 min", players: "3-16 jugadores" },
  reaccion: { tagline: "El más rápido se lleva el punto.", minutes: "5 min", players: "2-16 jugadores" },
  "riel-salvaje": { tagline: "Sobrevivan juntos al camino salvaje.", minutes: "12 min", players: "3-16 jugadores" },
  "spam-tap": { tagline: "Tocá más rápido que nadie.", minutes: "3 min", players: "2-16 jugadores" },
  "termina-historia": { tagline: "Sigan la historia, uno por uno.", minutes: "10 min", players: "2-16 jugadores" },
  "tiempo-exacto": { tagline: "Parala justo en el segundo exacto.", minutes: "5 min", players: "1-16 jugadores" },
  trivia: { tagline: "Preguntas rápidas, respuestas más rápidas.", minutes: "10 min", players: "2-16 jugadores" },
  "ultimo-en-tocar": { tagline: "El último en tocar, pierde.", minutes: "5 min", players: "2-16 jugadores" },
  "verdad-o-reto": { tagline: "Verdad incómoda o reto sin salida.", minutes: "15 min", players: "2-16 jugadores" },
  "yo-nunca": { tagline: "Confesá lo que nunca hiciste... o sí.", minutes: "10 min", players: "2-16 jugadores" },
};
