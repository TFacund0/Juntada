import { Avatar } from "../../../components/ui/Avatar";

/**
 * Badge "Turno X/Y" + (opcional) "dibuja Nombre" con degradé — mismo diseño
 * en las tres fases que muestran el turno actual ("choosing", "drawing",
 * "reveal") en vez de que cada una reimplemente su propio texto gris plano.
 * `drawerName` es opcional: "reveal" no lo pasa (ya no hay un dibujante
 * "activo" entre turnos), "choosing" tampoco (el dibujante ya se destaca
 * aparte, en el centro de esa pantalla).
 */
export function TurnHeader({ turnNumber, totalTurns, drawerName }: { turnNumber: number; totalTurns: number; drawerName?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, margin: "0 0 10px" }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#5DCAA5",
          background: "rgba(93,202,165,0.15)",
          border: "1px solid rgba(93,202,165,0.35)",
          borderRadius: 20,
          padding: "3px 10px",
        }}
      >
        Turno {turnNumber}/{totalTurns}
      </span>
      {drawerName && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={drawerName} size={26} />
          <p
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              background: "linear-gradient(90deg,#AFA9EC,#5DCAA5)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            dibuja {drawerName}
          </p>
        </div>
      )}
    </div>
  );
}
