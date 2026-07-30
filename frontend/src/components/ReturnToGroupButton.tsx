import { useState } from "react";
import { Btn } from "./Btn";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * Se exporta para que cualquier OTRO control que también pueda disparar
 * `leave_instance` (ver el botón "Volver" global del header de `App.tsx`,
 * que puede mandar al jugador de vuelta al grupo de la misma forma que
 * este botón) muestre exactamente la misma advertencia en vez de escribir
 * la propia a mano — una sola redacción para una sola acción subyacente,
 * sin importar qué control la disparó.
 */
export const RETURN_TO_GROUP_CONFIRM = {
  title: "¿Volver al grupo?",
  message: "Vas a salir de esta partida en curso y perder tu progreso. El resto puede seguir jugando sin vos.",
  confirmLabel: "Sí, volver",
};

/**
 * El único lugar donde se decide, para una sala, si "hay algo que perder en
 * este momento" — cualquier fase que no sea "lobby" significa que una
 * ronda (o su pantalla de resultado) está en curso. Compartido para que
 * todo control de salir/volver haga la misma pregunta en vez de que cada
 * uno adivine su propia condición.
 */
export function roomHasProgress(roomPhase: string | null | undefined): boolean {
  return roomPhase != null && roomPhase !== "lobby";
}

/**
 * El control "👥 Volver al grupo" que se muestra cada vez que una sala
 * pertenece a una instancia de grupo (`room.groupCode !== null`) —
 * compartido por `LobbyScreen` (se renderiza mientras `roomPhase` siempre
 * es "lobby": nada arrancó todavía, nada que perder, así que sale de
 * inmediato) y `RoundScreen` (se renderiza a mitad de ronda/resultado:
 * `roomPhase` nunca es "lobby" ahí, así que pide confirmación primero) en
 * vez de que cada uno arme a mano su propio botón + diálogo con su propio
 * texto. La decisión de confirmar o no se toma una sola vez, acá, a partir
 * de `roomPhase` — no se duplica por pantalla.
 */
export function ReturnToGroupButton({
  groupCode,
  roomPhase,
  onLeave,
}: {
  groupCode: string | null;
  roomPhase: string;
  onLeave: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (groupCode === null) return null;
  const inProgress = roomHasProgress(roomPhase);

  return (
    <>
      <Btn variant="ghost" onClick={() => (inProgress ? setConfirming(true) : onLeave())} style={{ marginTop: 10 }}>
        👥 Volver al grupo
      </Btn>
      {confirming && (
        <ConfirmDialog
          {...RETURN_TO_GROUP_CONFIRM}
          onConfirm={() => {
            setConfirming(false);
            onLeave();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
