// "Volver al grupo" ya no es un control propio en pantalla — es lo que hace
// la flecha "Volver" del navbar (AppHeader) cuando el jugador está dentro de
// una instancia de un grupo (ver goBack en hooks/useAppNavigation.ts). Este
// archivo solo junta la pregunta y el texto de confirmación que esa acción
// comparte entre el hook de navegación (decide si confirmar) y el diálogo
// (AppConfirmDialogs) que efectivamente la muestra.

/**
 * El único lugar donde se decide, para una sala, si "hay algo que perder en
 * este momento" — cualquier fase que no sea "lobby" significa que una ronda
 * (o su pantalla de resultado) está en curso.
 */
export function roomHasProgress(roomPhase: string | null | undefined): boolean {
  return roomPhase != null && roomPhase !== "lobby";
}

export const RETURN_TO_GROUP_CONFIRM = {
  title: "¿Volver al grupo?",
  message: "Vas a salir de esta partida en curso y perder tu progreso. El resto puede seguir jugando sin vos.",
  confirmLabel: "Sí, volver",
};
