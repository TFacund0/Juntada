import { Avatar } from "../../../../components/ui/Avatar";
import { barBackground, barHeightPx, type PodiumSlot } from "../../utils/podium";

const PLACE_LABEL = { 1: "1.º", 2: "2.º", 3: "3.º" } as const;

/**
 * Una columna del podio (`.pcol` de la referencia): avatar (con corona el
 * 1.º), nombre, puntos y la barra con el puesto. `data-podium-drop` marca lo
 * que cae sobre la barra y `data-podium-bar` la barra que crece (ver
 * RayadoPodium, que las anima).
 */
export function PodiumColumn({ slot }: { slot: PodiumSlot }) {
  const { entry, place, height, color } = slot;
  return (
    <li className="flex w-[30%] min-w-0 flex-col items-center justify-end">
      <span data-podium-drop className="relative mb-2">
        <Avatar name={entry.name} size={48} />
        {place === 1 && (
          <span aria-hidden="true" className="absolute -top-[22px] left-1/2 -translate-x-1/2 text-[22px]">
            👑
          </span>
        )}
      </span>
      <span data-podium-drop className="mb-0.5 max-w-full truncate font-extrabold">
        <span className="sr-only">{PLACE_LABEL[place]} </span>
        {entry.name}
        {entry.isMe && <span className="sr-only"> (vos)</span>}
      </span>
      <span data-podium-drop className="mb-1.5 text-[13px] text-rl-muted">
        {entry.score} pts
      </span>
      <div
        data-podium-bar
        aria-hidden="true"
        className="grid w-full shrink-0 origin-bottom rounded-[12px_12px_4px_4px] pt-2.5 font-marker text-[30px] text-white/90 [place-items:start_center]"
        // Alto (fijo, su % del área de barras) y color dependen del puesto.
        style={{ height: barHeightPx(height), background: barBackground(color) }}
      >
        {place}
      </div>
    </li>
  );
}
