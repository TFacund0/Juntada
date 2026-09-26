// ─── Rayado Libre: chat de respuestas online (dos jugadores reales) ─────────
// Cubre el cierre de la fase 3 del rediseño: el indicador "escribiendo…" le
// llega al otro jugador, un intento "cerca" se marca SOLO para quien lo
// escribió (el otro lo ve como mensaje normal), y después el acierto.
//
// Necesita dos cuentas reales (el login es obligatorio y el e2e por defecto
// no tiene base de datos), así que corre contra servidores ya levantados y
// se saltea solo si faltan las credenciales — la corrida normal de CI no se
// entera. Cómo correrlo, con `pnpm dev` (backend + frontend) ya andando:
//
//   E2E_EXTERNAL=1 E2E_BASE_URL=http://localhost:5173 \
//   E2E_USER_A=usuario_a E2E_PASS_A=... E2E_USER_B=usuario_b E2E_PASS_B=... \
//   pnpm test:e2e e2e/rayado-chat-online.spec.ts
//
// E2E_EXTERNAL=1 evita que playwright.config.ts levante su propio backend
// (puerto 3011, sin base de datos) y frontend: con eso, Vite en 5173 se
// reusaría pero apuntando a un backend distinto del de `pnpm dev`.
// Cada corrida hace un login por cuenta: el backend limita los logins, así
// que no conviene repetirlo en loop.

import { test, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { DEV_NOTICE_SEEN_KEY } from "./fixtures";

const accountA = { user: process.env.E2E_USER_A, pass: process.env.E2E_PASS_A };
const accountB = { user: process.env.E2E_USER_B, pass: process.env.E2E_PASS_B };
const hasAccounts = !!(accountA.user && accountA.pass && accountB.user && accountB.pass);

const CLOSE_HINT = "¡Estás cerca! · solo lo ves vos";

async function loggedInPage(browser: Browser, user: string, pass: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(key => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      // best-effort, igual que seedPlayerContext
    }
  }, DEV_NOTICE_SEEN_KEY);
  const page = await context.newPage();
  await page.goto("/");
  const identifier = page.getByPlaceholder("ej. nacho_23 o tu@email.com");
  await identifier.fill(user);
  await page.locator('input[type="password"]').fill(pass);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await identifier.waitFor({ state: "detached", timeout: 15_000 });
  return page;
}

// Un intento a una letra de distancia (o un prefijo de 4+ letras), que el
// servidor marca como "cerca": sin la última letra si la palabra es larga,
// si no, con la última letra cambiada.
function closeVariant(word: string): string {
  if (word.length > 4) return word.slice(0, -1);
  const last = word[word.length - 1].toLowerCase();
  return word.slice(0, -1) + (last === "x" ? "z" : "x");
}

// Quién dibuja es aleatorio. Puede además haber un duplicado viejo de un
// jugador en la sala (bug conocido de "doble sesión"): si el turno le toca a
// ese fantasma, ninguna de las dos páginas ve las cartas — se falla con un
// mensaje claro en vez de colgarse esperando.
async function findDrawer(a: Page, b: Page): Promise<{ drawer: Page; guesser: Page }> {
  const choosing = (p: Page) => p.getByText("Elegí qué vas a dibujar");
  await expect(a.getByText(/Elegí qué vas a dibujar|está eligiendo la palabra/)).toBeVisible({ timeout: 15_000 });
  await expect(b.getByText(/Elegí qué vas a dibujar|está eligiendo la palabra/)).toBeVisible({ timeout: 15_000 });
  const [aDraws, bDraws] = [await choosing(a).isVisible(), await choosing(b).isVisible()];
  if (aDraws === bDraws) {
    throw new Error(
      aDraws
        ? "Las dos páginas ven las cartas de elegir palabra — ¿las dos cuentas son la misma?"
        : "Ninguna de las dos páginas dibuja: el turno es de otro jugador de la sala (¿una sesión duplicada vieja?). Borrá la sala y volvé a correr.",
    );
  }
  return aDraws ? { drawer: a, guesser: b } : { drawer: b, guesser: a };
}

test.describe("Rayado Libre — chat de respuestas online", () => {
  test.skip(!hasAccounts, "Necesita E2E_USER_A/E2E_PASS_A/E2E_USER_B/E2E_PASS_B (cuentas reales) y E2E_EXTERNAL=1");

  test("escribiendo…, intento 'cerca' visible solo para quien lo escribió, y acierto", async ({ browser }) => {
    test.setTimeout(90_000);
    const a = await loggedInPage(browser, accountA.user!, accountA.pass!);
    const b = await loggedInPage(browser, accountB.user!, accountB.pass!);

    try {
      await a.getByText("Rayado", { exact: true }).click();
      await a.getByRole("button", { name: "Jugar" }).click();
      await a.getByText("Jugar online con amigos").click();
      await a.getByRole("button", { name: "Crear partida" }).click();
      await a.waitForURL(/\/room\/rayado-libre\/\w+$/);
      // El cartel del código se muestra enmascarado ("•••••") hasta tocar el
      // ojo; la URL de la sala siempre lo tiene en claro.
      const code = new URL(a.url()).pathname.split("/").pop();
      expect(code).toMatch(/^[A-Z0-9]{4,8}$/);
      await a.getByText("Animales").click();

      // Mismo respaldo que flujo-rayado-libre-online.spec.ts: la unión
      // automática por link puede perder la carrera con el primer render.
      await b.goto(`/join/${code}?game=rayado-libre`);
      await b
        .getByRole("button", { name: "Unirse →" })
        .click({ timeout: 5_000 })
        .catch(() => {});
      await b.waitForURL(new RegExp(`/room/rayado-libre/${code}$`));

      const start = a.getByRole("button", { name: "Iniciar ronda" });
      await expect(start).toBeEnabled({ timeout: 10_000 });
      await start.click();

      const { drawer, guesser } = await findDrawer(a, b);
      await drawer.locator(".rl-word-card").first().click();
      const word = (await drawer.locator(".rl-board-word p").first().textContent())?.trim();
      expect(word, "quien dibuja debería ver su palabra").toBeTruthy();

      // 1) "escribiendo…": teclear (sin mandar) le llega al que dibuja.
      const input = guesser.getByRole("textbox", { name: "Tu respuesta" });
      await input.pressSequentially("mmm", { delay: 80 });
      await expect(drawer.getByText(/está escribiendo…/)).toBeVisible({ timeout: 5_000 });
      await input.fill("");

      // 2) "cerca": quien lo escribió ve la burbuja amarilla; el otro, un mensaje normal.
      const close = closeVariant(word!);
      await input.fill(close);
      await input.press("Enter");
      await expect(guesser.getByText(CLOSE_HINT)).toBeVisible({ timeout: 5_000 });
      await expect(drawer.getByText(close, { exact: true })).toBeVisible({ timeout: 5_000 });
      await expect(drawer.getByText(CLOSE_HINT)).toHaveCount(0);
      // Mandar el intento apaga el "escribiendo…" (a más tardar a los ~4 s).
      await expect(drawer.getByText(/está escribiendo…/)).toHaveCount(0, { timeout: 6_000 });

      // 3) Acierto: con un solo adivinador conectado, el turno termina enseguida.
      await input.fill(word!);
      await input.press("Enter");
      await expect(drawer.getByText("La palabra era")).toBeVisible({ timeout: 8_000 });
      await expect(guesser.getByText("La palabra era")).toBeVisible();
      // El recap de la revelación sigue marcando el "cerca" solo para su autor.
      await expect(guesser.getByText(CLOSE_HINT)).toBeVisible();
      await expect(drawer.getByText(CLOSE_HINT)).toHaveCount(0);
    } finally {
      await a.context().close();
      await b.context().close();
    }
  });
});
