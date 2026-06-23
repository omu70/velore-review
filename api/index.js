// =============================================================
// DEPRECATED — this app now builds with Vite + the @vercel/remix
// preset (see /vite.config.js). This file is intentionally inert
// and is excluded from Vercel via /.vercelignore. Safe to delete.
// =============================================================
export default function handler(req, res) {
  res.statusCode = 410;
  res.end("Gone — this endpoint was replaced by the Vite build.");
}
