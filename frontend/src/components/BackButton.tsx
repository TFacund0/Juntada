import { Btn } from "./Btn";

// The secondary "go back to setup/lobby" action shown below the primary
// action on result/play screens — same ghost styling and spacing everywhere,
// regardless of which game or mode (local/online) it's in. Each call site
// only supplies its own label ("Volver a jugadores", "Volver al lobby", ...).
export function BackButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <Btn variant="ghost" onClick={onClick} style={{ marginTop: 10 }}>
      {children}
    </Btn>
  );
}
