import { S } from "../../theme/styles";
import { Avatar } from "../../components/Avatar";

// Result-screen card showing who got voted out and (once revealed) whether
// they were the impostor — identical between the online RoundView and local
// mode's result screen, so it lives here once instead of copy-pasted. Wraps
// on narrow screens (flexWrap + minWidth: 0 + name truncation) so a long
// name or a small phone screen can't push the role pill off the card.
export function EliminatedPlayerCard({
  name,
  wasImpostor,
}: {
  name: string;
  wasImpostor: boolean | undefined;
}) {
  const roleColor = wasImpostor ? "#F09595" : "#5DCAA5";
  return (
    <div
      style={{
        ...S.cardHighlight,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        border: `1px solid ${wasImpostor == null ? "rgba(127,119,221,0.35)" : roleColor}66`,
      }}
    >
      <Avatar name={name} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 800, fontSize: 16, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </p>
        <p style={{ ...S.muted, margin: 0 }}>quedó eliminado/a</p>
      </div>
      {wasImpostor != null && (
        <span
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.02em",
            color: roleColor,
            background: wasImpostor ? "rgba(240,149,149,0.15)" : "rgba(93,202,165,0.15)",
            border: `1px solid ${wasImpostor ? "rgba(240,149,149,0.4)" : "rgba(93,202,165,0.4)"}`,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {wasImpostor ? "ERA EL IMPOSTOR" : "ERA INOCENTE"}
        </span>
      )}
    </div>
  );
}
