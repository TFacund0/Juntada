import { test as base, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { seedPlayerContext } from "./fixtures";

// Dos BrowserContext reales (no dos pestañas del mismo contexto) para que
// cada "jugador" tenga su propia sesión, igual que dos dispositivos
// distintos uniéndose a la misma sala — mismo patrón que
// flujo-dos-jugadores-grupo.spec.ts.
async function newPlayerPage(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext();
  await seedPlayerContext(context, name);
  return context.newPage();
}

base("dos jugadores completan una ronda de Rayado Libre online: elegir palabra, adivinar y llegar a reveal", async ({ browser }) => {
  // El default de 30s alcanza para un spec de una sola página — acá se
  // orquestan dos navegadores en paralelo a través de varios pasos
  // secuenciales (elegir juego, crear sala, unirse, elegir palabra,
  // adivinar), y el tiempo se acumula.
  base.setTimeout(60_000);

  const ana = await newPlayerPage(browser, "Ana");
  const beto = await newPlayerPage(browser, "Beto");

  try {
    await ana.goto("/");
    await ana.getByText("Rayado", { exact: true }).click();
    await ana.getByRole("button", { name: "Jugar" }).click();
    await ana.getByText("Jugar online con amigos").click();
    await ana.getByRole("button", { name: "Crear partida" }).click();
    await ana.waitForURL(/\/room\/rayado-libre\/\w+$/);

    const code = await ana.getByTestId("code-display").first().textContent();
    expect(code).toMatch(/^[A-Z0-9]{4,8}$/);

    // Sin esto "Iniciar ronda" falla del lado del servidor (ver
    // engine.ts's startRound) — el juego arranca sin ninguna categoría
    // activa por defecto.
    await ana.getByText("Animales").click();

    // Link de invitación real (/join/CODE?game=rayado-libre), en vez de
    // pasar por la tarjeta del juego de nuevo — mismo camino que produce un
    // QR/enlace compartido (ver buildRoomJoinUrl). Con el nombre ya guardado
    // en localStorage (seedPlayerContext) y el código ya conocido, la sala
    // se une sola al llegar (ver el efecto de auto-join en
    // useMultiplayerGameShell.ts) — pero esa unión automática puede perder
    // la carrera contra el primer render, dejando visible el formulario de
    // "Unirme" con el código ya cargado (mismo diseño que la unión manual).
    // El click de respaldo cubre ambos casos: si el auto-join ya terminó,
    // el botón nunca aparece y el timeout acá abajo simplemente se descarta.
    await beto.goto(`/join/${code}?game=rayado-libre`);
    await beto
      .getByRole("button", { name: "Unirse →" })
      .click({ timeout: 5_000 })
      .catch(() => {});
    await expect(beto.getByText("Ana")).toBeVisible({ timeout: 10_000 });
    await expect(ana.getByText("Beto")).toBeVisible();

    await ana.getByRole("button", { name: "Iniciar ronda" }).click();

    // El primer turno es aleatorio — se detecta dinámicamente quién quedó
    // como dibujante mirando cuál de las dos páginas ve el abanico de
    // palabras en vez de la tarjeta de espera.
    await expect(ana.getByText(/Elegí qué vas a dibujar|está eligiendo la palabra/)).toBeVisible({ timeout: 10_000 });
    const anaIsDrawer = await ana.getByText("Elegí qué vas a dibujar").isVisible();
    const [drawer, guesser] = anaIsDrawer ? [ana, beto] : [beto, ana];

    await drawer.locator(".rl-word-card").first().click();

    // Quien dibuja ve su propia palabra en el header del tablero — se lee
    // acá para poder escribirla exacta como intento desde la otra página
    // (la palabra real es aleatoria, no se puede conocer de antemano).
    const word = (await drawer.locator(".rl-board-word p").first().textContent())?.trim();
    expect(word).toBeTruthy();

    await guesser.getByPlaceholder("Tu respuesta...").fill(word!);
    await guesser.getByRole("button", { name: "Enviar" }).click();

    // Con un solo adivinador en la sala, un acierto correcto termina el
    // turno de inmediato (ver maybeAdvance en engine.ts).
    await expect(drawer.getByText("La palabra era")).toBeVisible({ timeout: 5_000 });
    await expect(guesser.getByText("La palabra era")).toBeVisible();
    await expect(drawer.getByText(word!)).toBeVisible();
  } finally {
    await ana.context().close();
    await beto.context().close();
  }
});
