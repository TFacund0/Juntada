import { test as base, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { seedPlayerContext } from "./fixtures";

async function newPlayerPage(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext();
  await seedPlayerContext(context, name);
  const page = await context.newPage();
  return page;
}

base("dos jugadores en Rayado Libre online recuperan la sesión tras desconexión mid-round via WebSocket", async ({ browser }) => {
  base.setTimeout(120_000);

  const ana = await newPlayerPage(browser, "Ana");
  const beto = await newPlayerPage(browser, "Beto");

  ana.on("console", msg => console.log("[ANA CONSOLE]", msg.type(), msg.text()));
  ana.on("websocket", ws => {
    console.log("[ANA WS URL]", ws.url());
    ws.on("framesent", frame => console.log("[ANA WS SENT]", frame.payload));
    ws.on("framereceived", frame => console.log("[ANA WS RECV]", frame.payload));
  });

  try {
    // 1. Ana abre la landing y navega a crear grupo
    await ana.goto("/");
    await ana.getByRole("button", { name: "Crear grupo" }).first().click();
    await expect(ana).toHaveURL(/\/group$/, { timeout: 15_000 });

    // Completar el nombre del grupo
    const nameInput = ana.getByPlaceholder("Ej: Los pibes");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Grupo Ana");

    // Clickear el botón de envío
    const submitBtn = ana.locator(".jt-group-tab-panel button").filter({ hasText: "Crear grupo" });
    await expect(submitBtn).toBeVisible({ timeout: 10_000 });
    await submitBtn.click();

    await expect(ana).toHaveURL(/\/group\/\w+$/, { timeout: 30_000 });

    const code = await ana.getByTestId("code-display").first().textContent();
    expect(code).toMatch(/^[A-Z0-9]{4,8}$/);

    // 2. Beto se une al grupo
    await beto.goto("/");
    await beto.getByRole("button", { name: "Unirme" }).first().click();
    await beto.getByPlaceholder("XXXXX").fill(code!);

    const joinBtn = beto.getByRole("button", { name: "Unirse →" });
    await expect(joinBtn).toBeVisible({ timeout: 10_000 });
    await joinBtn.click();

    await expect(beto).toHaveURL(new RegExp(`/group/${code}$`), { timeout: 30_000 });

    await expect(ana.getByText("2 de 2 conectados")).toBeVisible({ timeout: 20_000 });
    await expect(beto.getByText("2 de 2 conectados")).toBeVisible({ timeout: 20_000 });

    // 3. Ana selecciona Rayado Libre e inicia la partida
    await ana.getByText("Elegir un juego").click();
    await ana.getByText("Rayado", { exact: true }).click();
    await ana.getByText("Animales").click();
    await ana.getByRole("button", { name: "Iniciar ronda" }).click();

    // 4. Confirmar que ambos ven la partida activa
    await expect(ana.getByText(/Elegí qué vas a dibujar|está eligiendo la palabra/)).toBeVisible({ timeout: 20_000 });
    await expect(beto.getByText(/Elegí qué vas a dibujar|está eligiendo la palabra/)).toBeVisible({ timeout: 20_000 });

    // 5. Simular caída de red temporal en Beto vía su BrowserContext
    await beto.context().setOffline(true);
    await beto.waitForTimeout(2000);

    // 6. Restablecer la red de Beto
    await beto.context().setOffline(false);

    // 7. Verificar que Beto auto-recupera la sesión y vuelve a estar sincronizado
    await expect(beto.getByText(/Elegí qué vas a dibujar|está eligiendo la palabra/)).toBeVisible({ timeout: 25_000 });
    await expect(ana.getByText("Beto")).toBeVisible();
    await expect(beto.getByText("Ana")).toBeVisible();
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
