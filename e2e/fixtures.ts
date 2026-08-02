import { test as base, expect } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";

// Same localStorage key as frontend/src/features/multiplayer/utils/playerName.ts
// — kept as a plain string here rather than importing from the frontend
// package, since e2e/ isn't part of that TS project and doesn't need to be.
export const PLAYER_NAME_KEY = "impostorgame:playerName";

// Same key as App.tsx's showDevNotice — a first-run "dev build" modal
// unrelated to anything these tests exercise, but it blocks every click
// underneath it until dismissed, so it's seeded away just like the player
// name.
export const DEV_NOTICE_SEEN_KEY = "impostorgame:devNoticeSeen";

// Seeds a fresh context so it skips both NameOnboardingScreen and the dev
// notice modal — shared by the `context` fixture below (single-player specs)
// and by tests that need more than one real BrowserContext at once (see
// flujo-dos-jugadores-grupo.spec.ts), which can't go through a fixture since
// each context there needs a different player name in the same test.
export async function seedPlayerContext(context: BrowserContext, playerName: string): Promise<void> {
  await context.addInitScript(
    ([nameKey, name, noticeKey]) => {
      localStorage.setItem(nameKey, name);
      localStorage.setItem(noticeKey, "1");
    },
    [PLAYER_NAME_KEY, playerName, DEV_NOTICE_SEEN_KEY] as [string, string, string],
  );
}

export const test = base.extend<{ playerName: string }>({
  playerName: ["Ana", { option: true }],
  context: async ({ context, playerName }, use) => {
    await seedPlayerContext(context, playerName);
    await use(context);
  },
});

export { expect };
