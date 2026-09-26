/**
 * Alto disponible para una pantalla de Rayado dentro de AppShellLayout: el
 * viewport menos el navbar fijo (`--jt-content-pad-top`) y el `pb-[60px]`
 * que el shell pone debajo de toda pantalla de juego. Para las pantallas de
 * un solo bloque (pasale el dispositivo, elegir palabra, esperando) que se
 * centran en vertical en vez de quedar pegadas arriba.
 */
export const FULL_HEIGHT_SCREEN = "min-h-[calc(100dvh-var(--jt-content-pad-top)-60px)]";

/** El bloque protagonista de esas pantallas: crece hasta llenar lo que sobra y se centra ahí. */
export const CENTERED_BLOCK = "flex flex-1 flex-col justify-center";
