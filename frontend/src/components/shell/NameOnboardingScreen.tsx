import { useState } from "react";
import { S } from "../../theme/styles";
import logo from "../../assets/brand/logo.webp";
import { ScreenFade } from "../ui/ScreenFade";
import { Btn } from "../ui/Btn";
import "./NameOnboardingScreen.css";

interface NameOnboardingScreenProps {
  onSave: (name: string) => void;
}

/**
 * Lo primerísimo que pregunta la app — antes de elegir un juego, antes que
 * cualquier otra cosa. Una vez guardado (el `playerName` de `App.tsx` deja
 * de estar vacío), esta pantalla nunca vuelve a aparecer en este
 * dispositivo. Mismo lenguaje visual que el Hero del home y el modal de
 * "Crear grupo" (blobs difuminados + card flotante, ver
 * NameOnboardingScreen.css) para que se sienta parte de la misma app en vez
 * de un form de sistema aparte.
 */
export function NameOnboardingScreen({ onSave }: NameOnboardingScreenProps) {
  const [nameDraft, setNameDraft] = useState("");
  const save = () => onSave(nameDraft);

  return (
    <div style={S.app}>
      <ScreenFade transitionKey="onboarding">
        <div className="jt-onboarding">
          <div aria-hidden className="jt-onboarding-glow jt-onboarding-glow--a" />
          <div aria-hidden className="jt-onboarding-glow jt-onboarding-glow--b" />

          <div className="jt-onboarding-card jt-animate-rise">
            <img src={logo} alt="Juntada" className="jt-onboarding-logo" />
            <h1 className="jt-onboarding-title jt-text-gradient">Juntada</h1>
            <p className="jt-onboarding-sub">Antes de ver los juegos, decinos cómo te llamás.</p>

            <div className="jt-onboarding-field">
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
              <p style={{ ...S.muted, textAlign: "center" }} className="jt-onboarding-hint">
                Así te van a ver los demás jugadores. Lo guardamos en este dispositivo, no te lo va a volver a pedir.
              </p>
            </div>

            <Btn onClick={save} disabled={!nameDraft.trim()} style={{ marginTop: 20 }}>
              Continuar
            </Btn>
          </div>
        </div>
      </ScreenFade>
    </div>
  );
}
