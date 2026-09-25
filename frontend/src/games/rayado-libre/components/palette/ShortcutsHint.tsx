const KBD = "rounded border border-rl-card-border px-1 font-figtree text-[10px] font-bold";

/** Línea con los atajos de teclado, debajo de la paleta. Solo en compu. */
export function ShortcutsHint() {
  return (
    <div className="hidden text-center text-[11px] text-rl-muted @min-[1000px]:block landscape-short:hidden">
      <kbd className={KBD}>1</kbd>–<kbd className={KBD}>9</kbd> colores · <kbd className={KBD}>B</kbd> lápiz · <kbd className={KBD}>E</kbd>{" "}
      goma · <kbd className={KBD}>G</kbd> balde · <kbd className={KBD}>[</kbd> <kbd className={KBD}>]</kbd> grosor ·{" "}
      <kbd className={KBD}>Ctrl</kbd>+<kbd className={KBD}>Z</kbd> deshacer
    </div>
  );
}
