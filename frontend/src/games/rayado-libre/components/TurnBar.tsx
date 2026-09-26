import type { ReactNode } from "react";
import clsx from "clsx";
import { Avatar } from "../../../components/ui/Avatar";

interface TurnBarProps {
  drawerName: string;
  /** "Dibuja X · adiviná la palabra (N letras)" / "Dibujás vos · los demás adivinan". */
  subtitle: string;
  /** Pista (quien adivina) o la palabra entera (quien dibuja). */
  word: ReactNode;
  /** Debajo de la pista: avisos (ej. quien dibuja se desconectó). */
  extra?: ReactNode;
  timer: ReactNode;
  /** Soy quien dibuja: en celular horizontal la cabecera ocupa toda la fila, arriba de paleta y tablero. */
  drawing: boolean;
}

/**
 * Cabecera del turno: avatar de quien dibuja, texto de rol, la pista y el
 * reloj — nada más (el silencio vive en la cabecera del chat, ver
 * ChatHeader). Centrada en compu (contenedor ≥1000px).
 */
export function TurnBar({ drawerName, subtitle, word, extra, timer, drawing }: TurnBarProps) {
  return (
    <div
      className={clsx(
        // z-[6]: por encima de las cintas del tablero (z-[3]), que asoman hacia arriba.
        "relative z-[6] mb-2 flex items-center gap-[10px] @min-[1000px]:mb-[10px] @min-[1000px]:justify-center @min-[1000px]:gap-4",
        "landscape-short:mb-1 short-screen:mb-1",
        drawing && "landscape-short:col-span-full",
      )}
    >
      <Avatar name={drawerName} size={34} className="shadow-[0_0_0_2px_rgba(255,255,255,.15)]" />
      {/* Celular horizontal: pista y cantidad en una sola fila, para que entre el tablero. */}
      <div className="min-w-0 flex-1 @min-[1000px]:flex-none @min-[1000px]:text-center landscape-short:flex landscape-short:flex-wrap landscape-short:items-center landscape-short:gap-x-2">
        <small className="block truncate text-xs font-semibold text-rl-muted landscape-short:basis-full">{subtitle}</small>
        {word}
        {extra}
      </div>
      {timer}
    </div>
  );
}
