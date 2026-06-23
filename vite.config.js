// =============================================================
// Vite config — Remix v2 + Vercel preset
// File: /vite.config.js
// =============================================================
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import { vercelPreset } from "@vercel/remix/vite";

export default defineConfig({
  plugins: [
    remix({
      presets: [vercelPreset()],
      ignoredRouteFiles: ["**/.*"],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: false,
        v3_lazyRouteDiscovery: false,
      },
    }),
  ],
  ssr: {
    noExternal: ["@shopify/polaris", "@shopify/app-bridge-react"],
  },
});
