import clsx from "clsx";
import { Avatar } from "../../../components/ui/Avatar";
import { CircularTimer } from "./CircularTimer";

const DOT = "inline-block animate-rl-dot motion-reduce:animate-none";

/**
 * Pantalla de espera para quien no dibuja durante "choosing": avatar grande
 * envuelto en el `CircularTimer` (sin número, la cuenta regresiva se ve en
 * el propio anillo) sobre un halo arcoíris quieto — sin el giro borroso de
 * antes (nada de `blur` animado, ver el plan de Rayado). `min-height` (no
 * `flex-1`) porque nada en la cadena de ancestros hasta acá es un contenedor
 * flex con altura real dentro del cual centrar.
 */
export function WaitingForWordCard({ drawerName, timerEnd, total }: { drawerName: string; timerEnd?: number; total?: number }) {
  return (
    <div className="flex min-h-[min(50vh,420px)] flex-col items-center justify-center gap-[22px] font-figtree">
      <div className="relative flex h-[132px] w-[132px] items-center justify-center">
        <div
          aria-hidden="true"
          className="absolute -inset-[18px] rounded-full opacity-[.18] bg-[conic-gradient(var(--color-rl-r1),var(--color-rl-r2),var(--color-rl-r3),var(--color-rl-r4),var(--color-rl-r5),var(--color-rl-r1))]"
        />
        {timerEnd != null && total != null && (
          <div className="absolute inset-0">
            <CircularTimer timerEnd={timerEnd} total={total} size={132} strokeWidth={5} showNumber={false} />
          </div>
        )}
        <Avatar name={drawerName} size={92} />
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
