import { useEffect, useState } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Btn } from "../../../components/ui/Btn";
import { StickyActionBar, STICKY_ACTION_BAR_CLEARANCE } from "../../../components/setup/StickyActionBar";
import type { RoundViewProps } from "../../gameTypes";
import type { TutifrutiRoundState } from "../types/roundView";
import { RoundBadge } from "./RoundBadge";
import { LetterReveal } from "./LetterReveal";

// Cuánto gira como mínimo la insignia antes de poder revelar la letra
// nueva, aunque el servidor responda antes — sin esto, en una red rápida el
// giro casi ni se nota y se pierde el factor sorpresa.
const MIN_SPIN_MS = 750;

// ── SETUP: letter draw, host can reroll ──
export function SetupPhase({ room, isHost, send }: Pick<RoundViewProps, "room" | "isHost" | "send">) {
  const round = room.round as TutifrutiRoundState;
  // El ícono del botón "Cambiar letra" tiene su propia animación de giro,
  // disparada al toquecito — usar el contador como `key` hace que se repita
  // en cada click, mismo truco que usa LetterReveal con `key={letter}`.
  const [rerollTick, setRerollTick] = useState(0);
  // Mientras `pending`, LetterReveal gira sin mostrar ninguna letra — recién
  // se apaga cuando pasaron los MIN_SPIN_MS *y* la letra del servidor ya
  // cambió respecto de la que había al tocar el botón, lo que tarde más.
  // Así el "factor sorpresa" no depende de la latencia de red: en una
  // respuesta lenta se espera a que llegue, en una rápida se espera el
  // mínimo igual.
  const [pending, setPending] = useState(false);
  const [minSpinDone, setMinSpinDone] = useState(true);
  const [letterAtClick, setLetterAtClick] = useState(round.letter);

  useEffect(() => {
    if (pending && minSpinDone && round.letter !== letterAtClick) setPending(false);
  }, [pending, minSpinDone, round.letter, letterAtClick]);

  const handleReroll = () => {
    setRerollTick(t => t + 1);
    setLetterAtClick(round.letter);
    setPending(true);
    setMinSpinDone(false);
    setTimeout(() => setMinSpinDone(true), MIN_SPIN_MS);
    send({ type: "confirm_letter", reroll: true });
  };

  return (
    <div style={{ paddingBottom: STICKY_ACTION_BAR_CLEARANCE }}>
      <div className="tf-setup-stage">
        <RoundBadge round={round} />
        {/* Ocupa todo el espacio disponible debajo del indicador de ronda y
            centra la letra ahí adentro — así queda en el medio de la
            pantalla en vez de pegada arriba. */}
        <div className="tf-setup-hero-wrap">
          <LetterReveal
            letter={round.letter}
            size="hero"
            pending={pending}
            footer={
              round.rerollsUsed > 0 && (
                <p className={clsx(T.muted, "mt-2.5")}>
                  Letra cambiada {round.rerollsUsed} {round.rerollsUsed === 1 ? "vez" : "veces"}
                </p>
              )
            }
          />
          {isHost ? (
            <button className="tf-reroll-btn" onClick={handleReroll} disabled={pending}>
              <span key={rerollTick} className="tf-reroll-icon">
                🔀
              </span>
              Cambiar letra
            </button>
          ) : (
            <p className={clsx(T.muted, "text-center mt-[18px]")}>Esperando que el anfitrión confirme la letra...</p>
          )}
        </div>
      </div>
      {isHost && (
        <StickyActionBar>
          <Btn
            onClick={() => send({ type: "confirm_letter" })}
            className="jt-btn-anim tf-confirm-btn"
            style={{ borderRadius: 999, padding: "16px 28px", fontSize: 16 }}
          >
            Confirmar y empezar
          </Btn>
        </StickyActionBar>
      )}
    </div>
  );
}
