import { Avatar } from "../../../components/ui/Avatar";

/**
 * Pantalla "pasale el dispositivo" del modo local, entre que termina el
 * turno anterior y quien dibuja confirma que ya tiene el aparato en mano —
 * mismo tratamiento visual (avatar + halo arcoíris) que `WaitingForWordCard`
 * usa online para el momento equivalente (esperando a que alguien más
 * elija), así el botón grande no queda solo en medio de una pantalla vacía.
 * `flex-1`: ocupa el alto que le deja la pantalla (ver WordRevealScreen) y
 * se centra ahí.
 */
export function PassDeviceCard({ drawerName, onReady }: { drawerName: string; onReady: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[22px] font-figtree">
      <div className="relative flex size-[132px] items-center justify-center">
        <div
          aria-hidden="true"
          className="absolute -inset-[18px] animate-rl-spin-slow rounded-full opacity-[.18] blur-[6px] motion-reduce:animate-none bg-[conic-gradient(var(--color-rl-r1),var(--color-rl-r2),var(--color-rl-r3),var(--color-rl-r4),var(--color-rl-r5),var(--color-rl-r1))]"
        />
        <Avatar name={drawerName} size={92} />
      </div>
      <div className="text-center">
        <p className="m-0 bg-linear-to-r from-rl-accent-strong to-rl-mint bg-clip-text text-2xl font-extrabold tracking-[-0.01em] text-transparent">
          {drawerName}
        </p>
        <p className="mb-0 mt-1.5 text-sm text-rl-muted">Pasale el dispositivo — el resto no tiene que ver la pantalla todavía</p>
      </div>
      <button
        type="button"
        onClick={onReady}
        className="animate-rl-pulse cursor-pointer rounded-full border-none bg-linear-to-r from-rl-accent to-rl-mint px-[30px] py-4 text-[15px] font-extrabold text-white shadow-[0_10px_26px_-10px_rgba(127,119,221,0.6)] transition-[scale] duration-150 hover:scale-[1.06] focus-visible:scale-[1.06] active:scale-[.97] motion-reduce:animate-none"
      >
        📱 Ya tengo el dispositivo
      </button>
    </div>
  );
}
