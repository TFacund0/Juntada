import { Btn } from "./Btn";

// The primary "start the game" action shown at the bottom of every setup
// screen (see StickyActionBar) — same green button everywhere, regardless of
// which game it's in. Each game only supplies its own label ("Empezar a
// jugar", "Iniciar ronda", ...).
export function StartButton({ children, onClick, disabled }: { children: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Btn variant="success" onClick={onClick} disabled={disabled}>
      {children}
    </Btn>
  );
}
