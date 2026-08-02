import { S } from "../../../../theme/styles";
import { Avatar } from "../../../../components/ui/Avatar";
import { staggerPopStyle } from "./staggerPopStyle";

export interface SuspectGridPlayer {
  id: string;
  name: string;
  online?: boolean;
}

interface SuspectGridProps {
  suspects: SuspectGridPlayer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  // Live running tally, keyed by suspect id — shown as a small badge on the
  // corner of each tile when > 0. Optional since local's VoteScreen may
  // pass an empty object before anyone's voted.
  voteCounts?: Record<string, number>;
}

// The suspect picker — a grid of avatar+name tiles instead of a plain list,
// with the currently selected one highlighted and (if provided) a live vote
// count badge. Shared by LocalGame's VoteScreen (one grid per still-voting
// player, all shown at once on the shared device) and online's
// VotingPhaseScreen (a single grid, just for you).
export function SuspectGrid({ suspects, selectedId, onSelect, voteCounts }: SuspectGridProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
      <style>{staggerPopStyle}</style>
      <style>{`
        .impostor-suspect-tile {
          transition: transform 0.15s ease-out, filter 0.15s ease-out, border-color 0.2s ease-out, background 0.2s ease-out;
        }
        .impostor-suspect-tile:hover {
          transform: translateY(-2px);
          filter: brightness(1.15);
        }
        .impostor-suspect-tile:active {
          transform: scale(0.96);
        }
      `}</style>
      {suspects.map((p, i) => {
        const isSelected = selectedId === p.id;
        const count = voteCounts?.[p.id] ?? 0;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="impostor-suspect-tile impostor-stagger-pop"
            aria-label={p.name}
            style={{
              ...S.card,
              position: "relative",
              marginBottom: 0,
              padding: "12px 6px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              color: "#e8e4f0",
              font: "inherit",
              opacity: p.online === false ? 0.6 : 1,
              background: isSelected ? "rgba(224,32,43,0.15)" : "var(--jt-card-bg, rgba(255,255,255,0.04))",
              border: isSelected ? "1px solid #E24B4A" : "1px solid var(--jt-card-border, rgba(127,119,221,0.18))",
              animationDelay: `${i * 0.04}s`,
            }}
          >
            {count > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  minWidth: 20,
                  height: 20,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: "#E24B4A",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 0 2px var(--jt-bg, #0a0a0a)",
                }}
              >
                {count}
              </span>
            )}
            <Avatar name={p.name} size={32} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              {p.name}
            </span>
            {p.online === false && <span style={{ fontSize: 10, color: "var(--jt-muted-text)" }}>desconectado</span>}
          </button>
        );
      })}
    </div>
  );
}
