import { useState } from "react";
import { S } from "../theme/styles";
import logo from "../assets/brand/logo.webp";

interface NameOnboardingScreenProps {
  onSave: (name: string) => void;
}

/**
 * Lo primerísimo que pregunta la app — antes de elegir un juego, antes que
 * cualquier otra cosa. Una vez guardado (el `playerName` de `App.tsx` deja
 * de estar vacío), esta pantalla nunca vuelve a aparecer en este
 * dispositivo.
 */
export function NameOnboardingScreen({ onSave }: NameOnboardingScreenProps) {
  const [nameDraft, setNameDraft] = useState("");
  const save = () => onSave(nameDraft);

  return (
    <div style={S.app}>
      <div style={S.wrap}>
        <div style={S.header}>
          <img src={logo} alt="Juntada" style={{ width: 64, height: 64, borderRadius: 16 }} />
          <h1 style={S.title}>Juntada</h1>
          <p style={{ color: "#9089c0", fontSize: 15, marginTop: 10, lineHeight: 1.4 }}>Antes de ver los juegos, decinos cómo te llamás.</p>
        </div>
        <div style={S.card}>
          <span style={S.label}>Tu nombre</span>
          <input
            style={S.input}
            placeholder="¿Cómo te llamás?"
            autoFocus
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") save();
            }}
          />
          <p style={{ ...S.muted, marginTop: 10 }}>
            Así te van a ver los demás jugadores. Lo guardamos en este dispositivo, no te lo va a volver a pedir.
          </p>
        </div>
        <button onClick={save} disabled={!nameDraft.trim()} style={S.btn("primary", !nameDraft.trim())}>
          Continuar
        </button>
      </div>
    </div>
  );
}
