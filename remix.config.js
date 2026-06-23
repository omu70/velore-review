/**
 * Remix config tuned for Vercel Serverless Functions.
 * File location: /remix.config.js
 */
/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ["**/.*"],
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  publicPath: "/build/",
  serverBuildPath: "build/index.js",
  serverModuleFormat: "esm",
  serverPlatform: "node",
  // Vercel preset handles serverBuildTarget under the hood.
  future: {
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_throwAbortReason: true,
  },
  // Bundle the supabase client into the server build.
  serverDependenciesToBundle: [/^@supabase\//],
};
