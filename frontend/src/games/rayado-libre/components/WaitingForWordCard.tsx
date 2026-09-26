import clsx from "clsx";
import { Avatar } from "../../../components/ui/Avatar";
import { useCountdownSeconds } from "../../../components/game-kit/hooks/useCountdownSeconds";
import { CountdownRing } from "./CountdownRing";

const DOT = "inline-block animate-rl-dot motion-reduce:animate-none";

/** El anillo que rodea al avatar: el mismo del reloj del turno, sin número (late en los últimos 5 s). */
function ChooseCountdownRing({ timerEnd, total }: { timerEnd: number; total: number }) {
  const { secs, total: t } = useCountdownSeconds(timerEnd, total);
  return (
    <CountdownRing
      progress={t > 0 ? secs / t : 0}
      urgent={secs > 0 && secs <= 5}
      label={`Quedan ${secs} segundos para elegir`}
      className="!absolute inset-0 after:inset-[5px]"
    />
  );
}

/**
 * Pantalla de espera para quien no dibuja durante "choosing": avatar grande
 * envuelto en el anillo del reloj (CountdownRing, sin número: la cuenta
 * regresiva se ve en el propio anillo) sobre un halo arcoíris quieto — sin
 * el giro borroso de antes (nada de `blur` animado, ver el plan de Rayado).
 * `min-height` (no `flex-1`) porque nada en la cadena de ancestros hasta acá
 * es un contenedor flex con altura real dentro del cual centrar.
 */
export function WaitingForWordCard({ drawerName, timerEnd, total }: { drawerName: string; timerEnd?: number; total?: number }) {
  return (
    <div className="flex min-h-[min(50vh,420px)] flex-col items-center justify-center gap-[22px] font-figtree">
      <div className="relative flex h-[132px] w-[132px] items-center justify-center">
        <div
          aria-hidden="true"
          className="absolute -inset-[18px] rounded-full opacity-[.18] bg-[conic-gradient(var(--color-rl-r1),var(--color-rl-r2),var(--color-rl-r3),var(--color-rl-r4),var(--color-rl-r5),var(--color-rl-r1))]"
        />
        {timerEnd != null && total != null && <ChooseCountdownRing timerEnd={timerEnd} total={total} />}
        {/* `relative`: por encima del centro relleno del anillo. */}
        <Avatar name={drawerName} size={92} className="relative" />
      </div>
      <div className="text-center">
        <p className="m-0 font-marker text-[26px] text-rl-ink">{drawerName}</p>
        <p className="mb-0 mt-1.5 text-[15px] text-rl-muted">
          está eligiendo la palabra
          <span className={DOT}>.</span>
          <span className={clsx(DOT, "[animation-delay:.15s]")}>.</span>
          <span className={clsx(DOT, "[animation-delay:.3s]")}>.</span>
        </p>
      </div>
    </div>
  );
}
