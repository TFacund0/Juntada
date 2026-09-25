import clsx from "clsx";

// Clases compartidas de los selectores segmentados (`.seg` de la
// referencia): grosor y herramienta.

export const SEGMENT = "flex gap-[2px] rounded-xl bg-black/25 p-[3px] @max-[360px]:p-[2px] landscape-short:flex-col";

export function segmentButton(selected: boolean): string {
  return clsx(
    "flex h-[34px] min-w-9 cursor-pointer items-center gap-[6px] rounded-[9px] border-0 px-2 text-[13px] font-bold",
    "@max-[360px]:min-w-[30px] @max-[360px]:px-[5px] landscape-short:h-6 landscape-short:justify-center",
    selected ? "bg-rl-accent text-white shadow-[0_2px_8px_rgba(127,119,221,.5)]" : "bg-transparent text-rl-muted",
  );
}
