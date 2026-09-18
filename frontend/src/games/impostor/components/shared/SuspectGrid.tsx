import clsx from "clsx";
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
    <div className="grid grid-cols-3 gap-2 mt-3">
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
            className={clsx(
              "impostor-suspect-tile impostor-stagger-pop relative mb-0 rounded-2xl px-1.5 py-3 flex flex-col items-center gap-1.5 cursor-pointer text-[#e8e4f0] font-[inherit]",
              p.online === false ? "opacity-60" : "opacity-100",
              isSelected
                ? "bg-[rgba(224,32,43,0.15)] border border-[#E24B4A]"
                : "bg-[var(--jt-card-bg,rgba(255,255,255,0.04))] border border-[var(--jt-card-border,rgba(127,119,221,0.18))]",
            )}
            aria-label={p.name}
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-[5px] rounded-full bg-[#E24B4A] text-white text-[11px] font-extrabold flex items-center justify-center shadow-[0_0_0_2px_var(--jt-bg,#0a0a0a)]">
                {count}
              </span>
            )}
            <Avatar name={p.name} size={32} />
            <span className="text-xs font-bold text-center truncate max-w-full">{p.name}</span>
            {p.online === false && <span className="text-[10px] text-[var(--jt-muted-text)]">desconectado</span>}
          </button>
        );
      })}
    </div>
  );
}
