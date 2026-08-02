import { test as base, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { seedPlayerContext } from "./fixtures";

// Two real BrowserContexts (not two tabs of the same context) so each
// "player" gets its own isolated localStorage/session — same as two
// different devices joining the same group. Can't go through the `test`
// fixture in fixtures.ts here since that seeds one name per context and
// this test needs two different names alive at once.
async function newPlayerPage(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext();
  await seedPlayerContext(context, name);
  return context.newPage();
}

base("dos jugadores en contextos distintos se ven en el mismo grupo", async ({ browser }) => {
  const ana = await newPlayerPage(browser, "Ana");
  const beto = await newPlayerPage(browser, "Beto");

  try {
    await ana.goto("/");
    await ana.getByRole("button", { name: "Crear grupo" }).click();
    await ana.waitForURL(/\/group$/);
    await ana.getByRole("button", { name: "Crear grupo" }).click();
    await ana.waitForURL(/\/group\/\w+$/);

    const code = await ana.getByTestId("code-display").first().textContent();
    expect(code).toMatch(/^[A-Z0-9]{4,8}$/);

    await beto.goto("/");
    await beto.getByRole("button", { name: "Unirme" }).click();
    await beto.getByPlaceholder("XXXXX").fill(code!);
    await beto.getByRole("button", { name: "Unirme →" }).click();
    await beto.waitForURL(new RegExp(`/group/${code}$`));

    await expect(ana.getByText("2 de 2 conectados")).toBeVisible();
    await expect(beto.getByText("2 de 2 conectados")).toBeVisible();
  } finally {
    await ana.context().close();
    await beto.context().close();
  }
});
