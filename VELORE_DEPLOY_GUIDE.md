# Velore Reviews — Go-Live Guide (private app, your store only)

Deploy this as a **custom (private) Shopify app** installed on **your store only** — not listed on the App Store, not shared with anyone else. When it's done, star badges and review grids show live across your storefront.

## The 3 parts

| Part | What it does | Where it lives |
|------|--------------|----------------|
| **Remix app + API** | Serves `/api/reviews` (read/write) + the admin dashboard | **Vercel** |
| **Supabase database** | Stores reviews, shop record, and the app's login sessions | **Supabase** |
| **Theme extension** (`reviews-widget`) | The badges + review grids on your storefront | **Shopify** (your theme) |

"Private" means nothing is publicly *listed*. The API still runs on Vercel (it has to, so your storefront can fetch reviews) — but only your store uses it.

---

## ✅ Already done for you

I rebuilt the project so it actually compiles and deploys (it was missing its Shopify backend before). Specifically I:

- Added the missing backend: `app/shopify.server.js`, `app/root.jsx`, `app/entry.server.jsx`, `app/entry.client.jsx`, `app/routes/app.jsx` (admin layout), `app/routes/_index.jsx`, and `vite.config.js`.
- Added **Supabase-backed login sessions** (`app/utils/sessionStorage.server.js`) — no Prisma, no extra database, no new environment variable. It reuses your existing `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- Fixed `package.json` and `vercel.json`, retired the old `api/index.js` (via `.vercelignore`), and added `.npmrc` (`legacy-peer-deps=true`) so installs resolve cleanly on Vercel.
- **Verified `npm run build` compiles cleanly** (client bundle + Vercel server bundle).

Helper files in this folder: `supabase_setup.sql` (Phase 1), `.gitignore`, `.npmrc`, `.vercelignore`.

You now just need to wire up the accounts. ~30 minutes.

---

## Phase 1 — Supabase database

1. Open your Supabase project. You have two (`peptide-app-v2`, `veyragate-outreach`) — pick the one you want this app to use, or make a new one. Use **one** and remember it.
2. **SQL Editor → New query** → paste **all** of `supabase_setup.sql` → **Run**. This creates the `shops`, `reviews`, and `shopify_sessions` tables, indexes, RLS policies, and the `review-images` storage bucket. Safe to re-run.
3. **Project Settings → API** → copy:
   - **Project URL** → `SUPABASE_URL` (e.g. `https://xxxx.supabase.co`)
   - **`service_role` secret key** → `SUPABASE_SERVICE_ROLE_KEY`

> 🔒 The `service_role` key is all-powerful. Only ever put it in Vercel's env vars — never in the theme, the browser, or Git.

---

## Phase 2 — Push the code to GitHub

Your repo `omhastagcreator-max/velore-review` is empty. The `.gitignore` keeps secrets and the marketing images in this folder out of the push.

In a terminal **in this folder**:

```bash
git init
git add .
git commit -m "Velore Reviews — private store app"
git branch -M main
git remote add origin https://github.com/omhastagcreator-max/velore-review.git
git push -u origin main
```

---

## Phase 3 — Deploy to Vercel

1. **vercel.com → Add New → Project → Import Git Repository** → pick **velore-review**.
2. Framework auto-detects as **Remix** (the `@vercel/remix` preset + `vercel.json` handle the rest).
3. Add **Environment Variables** (Production):

| Name | Value | Where to get it |
|------|-------|-----------------|
| `SHOPIFY_API_KEY` | your app's Client ID | Partners → your app → **API credentials** |
| `SHOPIFY_API_SECRET` | your app's API secret key | same place |
| `SHOPIFY_APP_URL` | `https://<your-project>.vercel.app` | known after first deploy (step 5) |
| `SCOPES` | `write_products,read_products` | use exactly this |
| `SUPABASE_URL` | from Phase 1 | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | from Phase 1 | Supabase → Settings → API |
| `NODE_ENV` | `production` | use exactly this |

4. **Deploy**, then copy your live URL (e.g. `https://velore-review.vercel.app`).
5. Set `SHOPIFY_APP_URL` to that URL and **redeploy** so it takes effect.

---

## Phase 4 — Make the Shopify app private + point it at Vercel

In **partners.shopify.com → Apps → your app**:

1. **Distribution** → choose **Custom distribution** (this keeps it private to one store, not the App Store). Enter your store's domain when asked; it generates a one-click install link — keep that link for Phase 6.
2. **Configuration**:
   - **App URL:** `https://<your-vercel-url>`
   - **Allowed redirection URL(s):**
     - `https://<your-vercel-url>/auth/callback`
     - `https://<your-vercel-url>/auth/shopify/callback`
     - `https://<your-vercel-url>/api/auth`
   - **Save.**

---

## Phase 5 — Deploy the storefront widget (theme extension)

In a terminal **in this folder**:

```bash
npm install
npx shopify app config link   # links this code to your Partner app (creates shopify.app.toml)
npx shopify app deploy         # uploads the "Reviews Widget" extension
```

The CLI opens a browser to log in and pick your app. (`npm install` uses the `.npmrc` already in the folder, so it resolves cleanly.)

---

## Phase 6 — Turn it on across your store ⭐

1. Install the app on your store using the **custom-distribution install link** from Phase 4 (or Partners → *Test your app*).
2. In your Shopify admin: **Online Store → Themes → Customize**.
3. Bottom-left, open the **App embeds** panel.
4. Toggle **“Reviews — Auto Display”** on.
5. Set **App API URL (Vercel)** to `https://<your-vercel-url>` (no trailing slash).
6. Leave on: *star badge under product title*, *review grid at bottom*, *star rating on every product card*.
7. **Save.**

That one embed injects badges on product pages **and** star ratings on every collection/search/related card — live across the whole store. (Optional: add the individual **Star Badge**, **Review Grid**, or **Store Reviews** blocks to specific sections via **Add block**.)

---

## Phase 7 — Seed reviews & test

1. Open the app from your store admin → **Apps** → Velore Reviews. Use **Generate** or **Import** to add reviews (otherwise the widget correctly shows “0 reviews”).
2. Visit a product page → gold star badge under the title + review grid lower down.
3. Click **Write a review**, submit one, confirm it saves (live `POST /api/reviews` → Supabase).
4. Check a collection page → product cards show star ratings.

✅ Reviews are live on your store.

---

## Appendix A — Environment variables

```
SHOPIFY_API_KEY=            # Partners → app → API credentials (Client ID)
SHOPIFY_API_SECRET=         # Partners → app → API secret key
SHOPIFY_APP_URL=            # https://<your-vercel-url>
SCOPES=write_products,read_products
SUPABASE_URL=               # https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=  # Supabase → Settings → API (secret!)
NODE_ENV=production
# No DATABASE_URL / Prisma needed — sessions live in Supabase via the service-role key.
# Optional: GEMINI_API_KEY  # only for AI-written sample reviews; templates work free without it.
```

## Appendix B — Troubleshooting

- **Vercel build fails** → confirm `.npmrc` (`legacy-peer-deps=true`) is committed; check all 7 env vars are set.
- **Admin won't load / blank iframe** → `SHOPIFY_APP_URL` must exactly match your Vercel URL, and the redirect URLs in Partners must match too. Redeploy after changing env vars.
- **Widget shows “0 reviews”** → (a) no approved reviews yet (seed some), (b) the **App API URL** in the theme embed doesn't match your Vercel URL, or (c) open `https://<your-vercel-url>/api/reviews?shop=your-store.myshopify.com` — you should get JSON.
- **Reviews submit but don't show** → new ones may be `pending`; approve them in the admin (storefront only shows `approved`).

## Appendix C — What changed in the repo (reference)

Added: `app/shopify.server.js`, `app/utils/sessionStorage.server.js`, `app/root.jsx`, `app/entry.server.jsx`, `app/entry.client.jsx`, `app/routes/app.jsx`, `app/routes/_index.jsx`, `vite.config.js`, `.npmrc`, `.vercelignore`, `.gitignore`, `supabase_setup.sql`.
Updated: `package.json` (Remix 2 + Vite + `@vercel/remix`, dropped the broken `@remix-run/vercel`), `vercel.json` (removed the old function entry).
Retired: `api/index.js` (now inert + ignored by Vercel), `remix.config.js` (unused with Vite — safe to delete).
