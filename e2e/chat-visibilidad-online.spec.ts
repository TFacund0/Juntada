import { test as base, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { seedPlayerContext } from "./fixtures";

// Regression coverage for two chat bugs found on 2026-08-02:
// 1) FloatingChat (frontend/src/features/multiplayer/components/FloatingChat.tsx)
//    stayed mounted during a round but got visually buried under
//    EliminationRevealOverlay because both used ad-hoc z-index values —
//    fixed by centralizing the scale in theme/sharedChrome.css (--jt-z-*),
//    keeping the chat above round-end overlays but below dialogs/toasts.
// 2) DiscussionChat's text input could end up hidden behind the fixed
//    StickyActionBar — fixed by giving it the same STICKY_ACTION_BAR_CLEARANCE
//    margin every screen using that bar already reserves.

async function newPlayerPage(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext();
  await seedPlayerContext(context, name);
  return context.newPage();
}

async function enterOnlineRoom(page: Page, code?: string): Promise<void> {
  await page.goto("/");
  await page.getByText("El Impostor", { exact: true }).click();
  await page.getByRole("button", { name: "Jugar" }).click();
  await page.getByText("Jugar online con amigos").click();

  if (code) {
    await page.getByRole("tab", { name: "Unirme" }).click();
    await page.getByPlaceholder("XXXXX").fill(code);
    await page.getByRole("button", { name: "Unirse →" }).click();
    await page.waitForURL(new RegExp(`/room/impostor/${code}$`));
  } else {
    await page.getByRole("button", { name: "Crear partida" }).click();
    await page.waitForURL(/\/room\/impostor\/\w+$/);
  }
}

// Drives all 3 players from lobby through clue-giving up to (and including)
// one full vote, so the elimination reveal overlay fires — chat must stay
// visible/reachable through every one of these phases.
async function playThroughToElimination(host: Page, guests: Page[], names: string[]): Promise<void> {
  const all = [host, ...guests];

  // Host config: at least one category (server rejects startRound otherwise)
  // and chat-mode discussion so DiscussionChat actually renders.
  await host.getByRole("button", { name: "Categorías" }).click();
  await host.getByRole("button", { name: "Seleccionar todas" }).click();
  await host.getByRole("button", { name: "Reglas" }).click();
  await host.getByRole("button", { name: "Chat de texto" }).click();

  await host.getByRole("button", { name: "Empezar partida" }).click();

  for (const p of all) {
    await p.getByRole("button", { name: "Empezar pistas" }).click();
  }

  // Turn order is randomized server-side — poll every page until its
  // "Enviar palabra" becomes visible, submit, repeat until all 3 are done.
  const discussionReady = host.getByRole("button", { name: "Listo para votar" });
  for (let i = 0; i < all.length; i++) {
    let submitted = false;
    for (const p of all) {
      const submit = p.getByRole("button", { name: "Enviar palabra" });
      if (await submit.isVisible().catch(() => false)) {
        await p.getByPlaceholder("Escribí tu palabra...").fill(`pista-${i}`);
        await submit.click();
        submitted = true;
        break;
      }
    }
    if (!submitted) break;
  }
  await expect(discussionReady).toBeVisible({ timeout: 15000 });

  for (const p of all) {
    await p.getByRole("button", { name: "Listo para votar" }).click();
  }

  // Everyone votes for the same target so a single elimination results —
  // except that player, who votes for someone else (can't vote for self).
  const target = names[0];
  for (let i = 0; i < all.length; i++) {
    const voteFor = names[i] === target ? names[1] : target;
    await all[i].getByRole("button", { name: voteFor }).first().click();
    await all[i].getByRole("button", { name: "Confirmar voto" }).click();
  }
}

base("el chat flotante se mantiene visible por encima del reveal de eliminación en Impostor", async ({ browser }) => {
  const ana = await newPlayerPage(browser, "Ana");
  const beto = await newPlayerPage(browser, "Beto");
  const cami = await newPlayerPage(browser, "Cami");

  try {
    await enterOnlineRoom(ana);
    const code = await ana.getByTestId("code-display").first().textContent();
    expect(code).toMatch(/^[A-Z0-9]{4,8}$/);

    await enterOnlineRoom(beto, code!);
    await enterOnlineRoom(cami, code!);

    await expect(ana.getByText("Cami")).toBeVisible();

    await playThroughToElimination(ana, [beto, cami], ["Ana", "Beto", "Cami"]);

    // Elimination reveal overlay is up now (EliminationRevealOverlay).
    await expect(ana.getByText("quedó eliminado/a")).toBeVisible();

    // Chat bubble must still be clickable/on top despite the overlay —
    // this is exactly the z-index regression: before the fix, the overlay
    // (formerly zIndex 1000) buried the bubble (900).
    await ana.getByRole("button", { name: "Abrir chat" }).click();
    await expect(ana.getByPlaceholder("Escribí o mandá una reacción…")).toBeVisible();
  } finally {
    await ana.context().close();
    await beto.context().close();
    await cami.context().close();
  }
});

base("el input del chat de discusión de Impostor no queda tapado por la barra de acción fija", async ({ browser }) => {
  const ana = await newPlayerPage(browser, "Ana");
  const beto = await newPlayerPage(browser, "Beto");
  const cami = await newPlayerPage(browser, "Cami");

  try {
    await ana.setViewportSize({ width: 390, height: 640 });
    await beto.setViewportSize({ width: 390, height: 640 });
    await cami.setViewportSize({ width: 390, height: 640 });

    await enterOnlineRoom(ana);
    const code = await ana.getByTestId("code-display").first().textContent();
    await enterOnlineRoom(beto, code!);
    await enterOnlineRoom(cami, code!);
    await expect(ana.getByText("Cami")).toBeVisible();

    // Narrow viewport collapses the lobby into "Jugadores"/"Configuración"
    // tabs — the config tabs (Categorías/Reglas) only render once switched.
    await ana.getByRole("button", { name: "Configuración" }).click();

    await ana.getByRole("button", { name: "Categorías" }).click();
    await ana.getByRole("button", { name: "Seleccionar todas" }).click();
    await ana.getByRole("button", { name: "Reglas" }).click();
    await ana.getByRole("button", { name: "Chat de texto" }).click();
    await ana.getByRole("button", { name: "Empezar partida" }).click();

    for (const p of [ana, beto, cami]) {
      await p.getByRole("button", { name: "Empezar pistas" }).click();
    }
    for (let i = 0; i < 3; i++) {
      for (const p of [ana, beto, cami]) {
        const submit = p.getByRole("button", { name: "Enviar palabra" });
        if (await submit.isVisible().catch(() => false)) {
          await p.getByPlaceholder("Escribí tu palabra...").fill(`pista-${i}`);
          await submit.click();
          break;
        }
      }
    }

    const chatInput = ana.getByPlaceholder("Escribí un mensaje...");
    await expect(chatInput).toBeVisible({ timeout: 15000 });

    // Scroll all the way down, the way a player reaching for the chat
    // naturally would on a short viewport — the regression only shows up
    // once the page is scrolled to its end, not while sitting mid-page.
    await ana.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const stickyBar = ana.getByRole("button", { name: "Listo para votar" });
    await expect(stickyBar).toBeVisible();

    const inputBox = await chatInput.boundingBox();
    const barBox = await stickyBar.boundingBox();
    expect(inputBox).not.toBeNull();
    expect(barBox).not.toBeNull();

    // Regression check: the input's bottom edge must sit above the sticky
    // bar's top edge — before the fix (no bottom clearance on DiscussionChat)
    // this could overlap on a short viewport.
    expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(barBox!.y);
  } finally {
    await ana.context().close();
    await beto.context().close();
    await cami.context().close();
  }
});
