import { useState } from "react";
import { Btn } from "./Btn";
import { ConfirmDialog } from "./ConfirmDialog";

// Exported so any OTHER control that can also trigger leave_instance (see
// App.tsx's global "Volver" header button, which can send the player back
// to the group the same way this button does) shows the exact same warning
// instead of hand-writing its own — one wording for one underlying action,
// regardless of which control triggered it.
export const RETURN_TO_GROUP_CONFIRM = {
  title: "¿Volver al grupo?",
  message: "Vas a salir de esta partida en curso y perder tu progreso. El resto puede seguir jugando sin vos.",
  confirmLabel: "Sí, volver",
};

// The single place "is there actually something to lose right now" gets
// decided for a room — anything other than "lobby" means a round (or its
// result screen) is live. Shared so every leave/back control asks the same
// question instead of each guessing its own condition.
export function roomHasProgress(roomPhase: string | null | undefined): boolean {
  return roomPhase != null && roomPhase !== "lobby";
}

// The "👥 Volver al grupo" control shown whenever a room belongs to a group
// instance (room.groupCode !== null) — shared by LobbyScreen (rendered
// while roomPhase is always "lobby": nothing started yet, nothing to lose,
// so it leaves immediately) and RoundScreen (rendered mid-round/result:
// roomPhase is never "lobby" there, so it confirms first) instead of each
// hand-rolling its own button + dialog with its own copy. The confirm-or-not
// decision is made once, here, from roomPhase — not duplicated per screen.
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
