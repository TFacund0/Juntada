import { useState } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Btn } from "../../../components/ui/Btn";
import { AddPlayerForm } from "../../../components/game-kit/AddPlayerForm";
import { useFlashError } from "../../../hooks/ui/useFlashError";
import { nextPlayerName } from "../../../utils/nextPlayerName";

// Local pass-and-play's "who's playing" editor — add/remove names before
// starting. Reuses the same "sumar jugador" form (AddPlayerForm) and empty-
// name/dedupe behavior (nextPlayerName, useFlashError) as every other local
// mode's roster, e.g. limon-limon's — same UX everywhere a game asks "who's
// playing" for one shared device.
export function PlayersConfig({ names, onChange }: { names: string[]; onChange: (next: string[]) => void }) {
  const [newName, setNewName] = useState("");
  const [nameError, nameErrorKey, setNameError] = useFlashError();

  const addName = () => {
    const trimmed = newName.trim() || nextPlayerName(names);
    if (names.some(n => n.toLowerCase() === trimmed.toLowerCase())) {
      setNameError("Ya hay un jugador con ese nombre");
      return;
    }
    setNameError("");
    onChange([...names, trimmed]);
    setNewName("");
  };

  const removeName = (i: number) => onChange(names.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className={T.card}>
        <span className={T.label}>Jugadores</span>
        {names.map((name, i) => (
          <div key={name} className="flex items-center gap-2 mb-2">
            <div className={clsx(T.input, "flex-1 min-w-0 truncate")}>{name}</div>
            {names.length > 1 && (
              <Btn variant="ghost" onClick={() => removeName(i)} style={{ width: "auto", padding: "11px 14px" }}>
                ✕
              </Btn>
            )}
          </div>
        ))}
      </div>
      <AddPlayerForm name={newName} onNameChange={setNewName} onSubmit={addName} error={nameError} errorKey={nameErrorKey} />
    </div>
  );
}
