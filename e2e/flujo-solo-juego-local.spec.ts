import { test, expect } from "./fixtures";

test("jugar Ruleta en modo local respeta la URL y sobrevive a un refresh", async ({ page }) => {
  await page.goto("/");

  await page.getByText("Ruleta", { exact: true }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await page.waitForURL(/\/game\/ruleta$/);

  await page.getByText("Jugar en persona").click();
  await page.waitForURL(/\/game\/ruleta\/local$/);

  // A refresh on this route must land back on the same screen, not home.
  await page.reload();
  await expect(page).toHaveURL(/\/game\/ruleta\/local$/);
  await expect(page.getByPlaceholder("Nombre (ej: Juan, o 'Prenda 1')")).toBeVisible();

  await page.getByPlaceholder("Nombre (ej: Juan, o 'Prenda 1')").fill("Juan");
  await page.getByRole("button", { name: "Agregar a la ruleta" }).click();
  await page.getByPlaceholder("Nombre (ej: Juan, o 'Prenda 1')").fill("Ana");
  await page.getByRole("button", { name: "Agregar a la ruleta" }).click();

  await page.getByRole("button", { name: "Empezar a girar" }).click();
  await page.getByRole("button", { name: "Girar la ruleta" }).click();

  // The spin animation resolves into a result screen — its exact copy isn't
  // this test's concern, just that the local game still works post-refresh.
  await expect(page.getByRole("button", { name: "Girar la ruleta" })).toBeHidden({ timeout: 10_000 });
});
