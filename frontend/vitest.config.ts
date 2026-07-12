import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Separate from vite.config.ts (rather than a `test` block in there) so the
// PWA plugin's build-time globbing doesn't run during `vitest`, and so tests
// aren't accidentally forced into `vite build`'s asset pipeline.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
    },
  }),
);
