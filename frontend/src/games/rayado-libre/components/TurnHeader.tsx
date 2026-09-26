/**
 * Badge "Turno X/Y" arriba de las pantallas de elegir palabra (online y
 * local), con el mismo verde menta en vez de un texto gris plano.
 */
export function TurnHeader({ turnNumber, totalTurns }: { turnNumber: number; totalTurns: number }) {
  return (
    <div className="mb-2.5 flex flex-col items-center">
      <span className="rounded-[20px] border border-rl-mint/35 bg-rl-mint/15 px-2.5 py-[3px] text-[11px] font-extrabold uppercase tracking-[.08em] text-rl-mint">
        Turno {turnNumber}/{totalTurns}
      </span>
    </div>
  );
}
