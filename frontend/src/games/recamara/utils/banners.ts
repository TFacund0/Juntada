import { ITEM_LABEL, type ItemKind, type ShellKind } from "@juntada/recamara-engine";

// The words on the result banner (the reference's banner()): one big verdict
// plus a short line saying what it meant. Plain text — names are rendered
// as text by ResultBanner, never as markup.

export interface BannerText {
  tone: "live" | "blank";
  big: string;
  sub: string;
}

export interface ShotBannerInput {
  shellKind: ShellKind;
  damage: number;
  shooterName: string;
  shooterIsMe: boolean;
  targetName: string;
  targetIsMe: boolean;
  selfShot: boolean;
  eliminated: boolean;
}

export function shotBanner(s: ShotBannerInput): BannerText {
  if (s.shellKind === "live") {
    const who = s.targetIsMe ? "Perdés" : `${s.targetName} pierde`;
    const out = s.eliminated ? (s.targetIsMe ? " y quedás afuera" : " y queda afuera") : "";
    return { tone: "live", big: "REAL", sub: `${who} ${s.damage} vida${s.damage > 1 ? "s" : ""}${out}` };
  }
  if (s.selfShot) return { tone: "blank", big: "FALSA", sub: s.shooterIsMe ? "Seguís tirando vos" : `${s.shooterName} sigue tirando` };
  return { tone: "blank", big: "FALSA", sub: "No pasó nada" };
}

// Items: the 🪚 gets the reference's own headline; the rest use the item's
// short name. Their sub line is the engine's describeItemResult text.
export function itemBannerTitle(item: ItemKind): string {
  if (item === "🪚") return "CAÑO RECORTADO";
  return ITEM_LABEL[item].split(" — ")[0].toUpperCase();
}

// The engine's item results (describeItemResult) bold what a 🔍 or 📞
// revealed — "es <b>real</b>", "posición <b>3</b>". On the banner those are
// the whole point, so they get the shell's own color (real red, falsa
// yellow) and the position a chip of its own. Matched with the words the
// engine puts before them, so a player who happens to be named "real"
// (names come escaped and bold too) is never recolored.
export function highlightShellHints(html: string): string {
  return html
    .replace(/ es <b>(real|falsa)<\/b>/g, (_, kind: string) =>
      kind === "real" ? ' es <b class="text-rec-live-glow uppercase">real</b>' : ' es <b class="text-rec-gold uppercase">falsa</b>',
    )
    .replace(/posición <b>(\d+)<\/b>/g, 'posición <b class="rounded bg-white/15 px-1.5 text-rec-ink">$1</b>');
}
