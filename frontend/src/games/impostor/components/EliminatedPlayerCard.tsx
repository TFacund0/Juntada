import { S } from "../../../theme/styles";
import { Avatar } from "../../../components/Avatar";

// Result-screen card showing who got voted out and (once revealed) whether
// they were the impostor — identical between the online RoundView and local
// mode's result screen, so it lives here once instead of copy-pasted. The
// role pill sits on its own line below the name (not squeezed to the side
// of it) precisely so it never has to share horizontal space with a long
// name — no width a narrow phone screen can run out of.
export function EliminatedPlayerCard({ name, wasImpostor }: { name: string; wasImpostor: boolean | undefined }) {
  const roleColor = wasImpostor ? "#F09595" : "#5DCAA5";
  return (
    <div
      style={{
        ...S.cardHighlight,
        textAlign: "center",
        border: `1px solid ${wasImpostor == null ? "rgba(127,119,221,0.35)" : roleColor}66`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <Avatar name={name} size={44} />
        <div style={{ maxWidth: "100%" }}>
          <p style={{ fontWeight: 800, fontSize: 16, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </p>
          <p style={{ ...S.muted, margin: 0 }}>quedó eliminado/a</p>
        </div>
      </div>
      {wasImpostor != null && (
        <span
          style={{
            display: "inline-block",
            marginTop: 10,
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.02em",
            color: roleColor,
            background: wasImpostor ? "rgba(240,149,149,0.15)" : "rgba(93,202,165,0.15)",
            border: `1px solid ${wasImpostor ? "rgba(240,149,149,0.4)" : "rgba(93,202,165,0.4)"}`,
          }}
        >
          {wasImpostor ? "ERA EL IMPOSTOR" : "ERA INOCENTE"}
        </span>
      )}
    </div>
  );
}
