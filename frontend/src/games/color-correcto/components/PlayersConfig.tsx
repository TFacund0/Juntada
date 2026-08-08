import { useState } from "react";
import { S } from "../../../theme/styles";
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
      <div style={S.card}>
        <span style={S.label}>Jugadores</span>
        {names.map((name, i) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ ...S.input, flex: 1 }}>{name}</div>
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
