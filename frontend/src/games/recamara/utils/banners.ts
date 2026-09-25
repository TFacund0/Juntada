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
