import { test, expect } from "./fixtures";

// Regression test for the bug found on 2026-08-02: with every URL update
// using history.replaceState, the browser's back gesture had nothing of its
// own to land on inside the app — it silently left the page instead of
// tripping the same confirmation the header's own "Volver" button already
// showed. Fixed by pushing a history checkpoint the moment useUrlSync's
// `midRound` turns true (see frontend/src/hooks/useUrlSync.ts).
//
// For a local match, goBack() takes the "reset to setup" branch specifically
// (Impostor's LocalGame reports mid-match via onExposeBack) rather than the
// generic "leave local mode" one — so the dialog here is "¿Volver a
// jugadores?", not "¿Volver atrás?" (that one only fires for a game that
// doesn't expose this reset hook, or for an online room/group).

async function enterImpostorLocalMatch(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByText("El Impostor", { exact: true }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await page.waitForURL(/\/game\/impostor$/);

  await page.getByText("Jugar en persona").click();
  await page.waitForURL(/\/game\/impostor\/local$/);

  // Default setup already has 4 players (above impostor's minPlayers: 3),
  // but no category is enabled by default — "Empezar partida" stays
  // disabled until at least one is picked.
  await page.getByRole("button", { name: "Configuración" }).click();
  await page.getByRole("button", { name: "Categorías" }).click();
  await page.getByRole("button", { name: "Seleccionar todas" }).click();

  await page.getByRole("button", { name: "Empezar partida" }).click();

  // Past setup means exposeLocalGameBack now reports "mid-match" — this is
  // what flips useUrlSync's `midRound` to true and pushes the checkpoint.
  await expect(page.getByRole("button", { name: "Empezar partida" })).toBeHidden();
}

test("el botón atrás del navegador durante una partida local de Impostor pide confirmación en vez de perder el progreso", async ({
  page,
}) => {
  await enterImpostorLocalMatch(page);

  await page.goBack();

  await expect(page.getByText("¿Volver a jugadores?")).toBeVisible();
  await expect(page.getByText("Vas a volver a la pantalla de jugadores y perder el progreso de esta partida.")).toBeVisible();

  await page.getByRole("button", { name: "Seguir jugando" }).click();

  // Cancelling must leave the match exactly where it was — same route, same
  // phase (setup never comes back).
  await expect(page).toHaveURL(/\/game\/impostor\/local$/);
  await expect(page.getByRole("button", { name: "Empezar partida" })).toBeHidden();
});

test("confirmar 'Sí, volver' desde el diálogo del botón atrás reinicia la partida a la pantalla de jugadores", async ({ page }) => {
  await enterImpostorLocalMatch(page);

  await page.goBack();
  await expect(page.getByText("¿Volver a jugadores?")).toBeVisible();

  await page.getByRole("button", { name: "Sí, volver" }).click();

  // localGameResetRef.current() resets the match without leaving local mode
  // at all — same route, back to the setup screen.
  await expect(page).toHaveURL(/\/game\/impostor\/local$/);
  await expect(page.getByRole("button", { name: "Empezar partida" })).toBeVisible();
});
