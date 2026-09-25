import { test as base, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { seedPlayerContext } from "./fixtures";

// Recámara online: the server resolves every shot instantly, but each client
// only moves its visible state forward once it has played that shot and its
// banner was dismissed (see frontend/src/games/recamara/hooks/eventDirector.ts).
// This covers a second shot landing while the other player is still looking
// at the first one's banner: it has to wait its turn instead of replacing it.
//
// Deterministic without seeding the chamber: round 1 has no items, holds at
// least 3 shells and everyone starts with 5 lives, so two shots can neither
// reload nor end the game. Shooting someone else always passes the turn,
// live or blank.

async function newPlayerPage(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext();
  await seedPlayerContext(context, name);
  return context.newPage();
}

// On your own screen your token reads "Vos" instead of your name.
function livesOf(page: Page, tokenName: string) {
  return page.locator("button.token", { hasText: tokenName }).locator(".token-lives");
}

base("recámara online: un segundo disparo espera mientras el otro jugador sigue mirando el banner del primero", async ({ browser }) => {
  base.setTimeout(120_000);

  const ana = await newPlayerPage(browser, "Ana");
  const beto = await newPlayerPage(browser, "Beto");

  try {
    await ana.goto("/");
    await ana.getByRole("button", { name: "Crear grupo" }).first().click();
    await expect(ana).toHaveURL(/\/group$/, { timeout: 15_000 });
    await ana.getByPlaceholder("Ej: Los pibes").fill("Grupo Ana");
    await ana.locator(".jt-group-tab-panel button").filter({ hasText: "Crear grupo" }).click();
    await expect(ana).toHaveURL(/\/group\/\w+$/, { timeout: 30_000 });
    const code = await ana.getByTestId("code-display").first().textContent();

    await beto.goto("/");
    await beto.getByRole("button", { name: "Unirme" }).first().click();
    await beto.getByPlaceholder("XXXXX").fill(code!);
    await beto.getByRole("button", { name: "Unirse →" }).click();
    await expect(ana.getByText("2 de 2 conectados")).toBeVisible({ timeout: 20_000 });

    await ana.getByText("Elegir un juego").click();
    await ana.getByText("Recámara", { exact: true }).first().click();
    await ana.getByRole("button", { name: "Iniciar ronda" }).click();

    // Each client plays the round overlay and reports ready by itself.
    for (const page of [ana, beto]) {
      await expect(page.locator(".round-overlay")).toBeHidden({ timeout: 30_000 });
    }

    // Whoever got the first turn is "first"; the other one is "second".
    const selfShot = (page: Page) => page.getByRole("button", { name: "Dispararme a mí" });
    await expect(selfShot(ana).or(selfShot(beto))).toBeVisible({ timeout: 20_000 });
    const anaStarts = await selfShot(ana).isVisible();
    const [first, second] = anaStarts ? [ana, beto] : [beto, ana];
    const [firstName, secondName] = anaStarts ? ["Ana", "Beto"] : ["Beto", "Ana"];
    const banner = (page: Page) => page.locator(".result-banner-who");
    const continueBtn = (page: Page) => page.getByRole("button", { name: "Continuar" });

    // Shot 1: first shoots second (tapping their card) and doesn't dismiss
    // its own banner.
    await first.getByRole("button", { name: `Dispararle a ${secondName}` }).click();
    await expect(banner(first)).toHaveText(`${firstName} le dispara a ${secondName}.`, { timeout: 10_000 });
    await expect(banner(second)).toHaveText(`${firstName} le dispara a ${secondName}.`, { timeout: 10_000 });
    const secondLivesAfterShot1 = await livesOf(second, "Vos").getAttribute("aria-label");

    // Shot 2: second dismisses their own banner right away and shoots back
    // — first's banner (which only closes by itself after ~2.6s) is still up.
    await continueBtn(second).click();
    await second.getByRole("button", { name: `Dispararle a ${firstName}` }).click();

    // first is still on shot 1's banner, and nothing from shot 2 shows yet.
    await expect(banner(first)).toHaveText(`${firstName} le dispara a ${secondName}.`);
    await expect(livesOf(first, "Vos")).toHaveAttribute("aria-label", "5 de 5 vidas");
    await expect(livesOf(first, secondName)).toHaveAttribute("aria-label", "5 de 5 vidas");

    // Once it's dismissed, exactly shot 1 commits, then shot 2 plays on its own.
    await continueBtn(first).click();
    await expect(livesOf(first, secondName)).toHaveAttribute("aria-label", secondLivesAfterShot1!);
    await expect(livesOf(first, "Vos")).toHaveAttribute("aria-label", "5 de 5 vidas");
    await expect(banner(first)).toHaveText(`${secondName} le dispara a ${firstName}.`, { timeout: 10_000 });

    // Once both are through (the banners also close by themselves), both
    // screens agree on every player's lives.
    for (const page of [first, second]) await expect(page.locator(".result-banner")).toBeHidden({ timeout: 10_000 });
    await expect(livesOf(first, "Vos")).toHaveAttribute("aria-label", (await livesOf(second, firstName).getAttribute("aria-label"))!);
    await expect(livesOf(first, secondName)).toHaveAttribute("aria-label", (await livesOf(second, "Vos").getAttribute("aria-label"))!);
  } finally {
    await ana
      .context()
      .close()
      .catch(() => {});
    await beto
      .context()
      .close()
      .catch(() => {});
  }
});
