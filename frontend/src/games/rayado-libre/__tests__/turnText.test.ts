import { describe, expect, test } from "vitest";
import { clockJumpLabel, turnSubtitle, typingLabel } from "../utils/turnText";

describe("turnSubtitle", () => {
  test("guesser: who draws and how many letters", () => {
    expect(turnSubtitle({ isDrawer: false, drawerName: "Lucía", letters: 4 })).toBe("Dibuja Lucía · adiviná la palabra (4 letras)");
    expect(turnSubtitle({ isDrawer: false, drawerName: "Tomi", letters: 1 })).toBe("Dibuja Tomi · adiviná la palabra (1 letra)");
  });

  test("drawer", () => {
    expect(turnSubtitle({ isDrawer: true, drawerName: "Vos", letters: 4 })).toBe("Dibujás vos · los demás adivinan");
  });
});

describe("clockJumpLabel", () => {
  test("names the zone the clock jumped to", () => {
    expect(clockJumpLabel(30)).toBe("¡El reloj saltó a 30!");
  });
});

describe("typingLabel", () => {
  test("empty, one, two and more names", () => {
    expect(typingLabel([])).toBe("");
    expect(typingLabel(["Tomi"])).toBe("Tomi está escribiendo…");
    expect(typingLabel(["Tomi", "Nacho"])).toBe("Tomi y Nacho están escribiendo…");
    expect(typingLabel(["Tomi", "Nacho", "Lucía"])).toBe("Tomi, Nacho y Lucía están escribiendo…");
  });
});
