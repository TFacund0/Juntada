import clsx from "clsx";

/** Los tres puntitos animados de "escribiendo" (lista de jugadores y chat). Decorativos: el texto al lado ya lo dice. */
export function TypingDots() {
  return (
    <span aria-hidden="true" className="inline-flex gap-[3px] align-middle">
      {["", "[animation-delay:.15s]", "[animation-delay:.3s]"].map((delay, i) => (
        <i key={i} className={clsx("h-[5px] w-[5px] rounded-full bg-rl-muted animate-rl-dot motion-reduce:animate-none", delay)} />
      ))}
    </span>
  );
}
