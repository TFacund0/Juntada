import clsx from "clsx";
import { SIZES, SIZE_NAMES } from "../../utils/palette";
import { SEGMENT, segmentButton } from "./segment";

// Puntito de cada grosor (4, 9 y 14 px, como en la referencia).
const DOT_SIZE = ["size-1", "size-[9px]", "size-[14px]"] as const;

interface SizePickerProps {
  size: number;
  /** Color del puntito: el del trazo, o blanco si está la goma. */
  dotColor: string;
  onSelect: (size: number) => void;
}

/** Selector de grosor: fino, medio y grueso. */
export function SizePicker({ size, dotColor, onSelect }: SizePickerProps) {
  return (
    <div role="radiogroup" aria-label="Grosor" className={SEGMENT}>
      {SIZES.map((s, i) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={s === size}
          aria-label={`Grosor ${SIZE_NAMES[i]}`}
          title={`Grosor ${SIZE_NAMES[i]} ([ y ])`}
          onClick={() => onSelect(s)}
          className={segmentButton(s === size)}
        >
          <i
            aria-hidden="true"
            className={clsx("block rounded-full bg-(--dot) shadow-[0_0_0_1px_rgba(255,255,255,.35)]", DOT_SIZE[i])}
            // El puntito toma el color actual del trazo.
            style={{ "--dot": dotColor } as React.CSSProperties}
          />
        </button>
      ))}
    </div>
  );
}
