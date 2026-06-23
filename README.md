# Shopify Reviews App — File Index

A premium D2C-style product reviews app for Shopify, built with Remix + Supabase + Polaris and deployed to Vercel's free tier.

## Folder structure (drop-in)

```
shopify-reviews-app/
├── app/
│   ├── routes/
│   │   ├── auth.$.jsx               # Install + free-tier gate (first 50 stores)
│   │   ├── api.reviews.jsx          # GET / POST / OPTIONS public storefront API
│   │   └── app._index.jsx           # Polaris admin dashboard (IndexTable)
│   └── utils/
│       └── supabase.server.js       # Service-role Supabase client + CORS headers
├── extensions/
│   └── reviews-widget/
│       ├── shopify.extension.toml
│       └── blocks/
│           ├── star-badge.liquid    # App Block 1 — under product title
│           └── review-widget.liquid # App Block 2 — bottom of product page
├── supabase/
│   └── schema.sql                   # Run once in Supabase SQL editor
├── api/
│   └── index.js                     # Vercel serverless adapter for Remix
├── remix.config.js
├── vercel.json
├── package.json
└── .env.example
```

## Setup steps

1. `cd` into the repo and run `npm install`.
2. Run the SQL in `supabase/schema.sql` against your Supabase project.
3. Copy `.env.example` → `.env` and fill in the Shopify + Supabase credentials.
4. `npm run dev` (uses Shopify CLI) to develop locally.
5. `npm run deploy` to push the Theme App Extension to Shopify.
6. Push to GitHub and import the repo into Vercel — set the same env vars there.

## Free-tier logic

`/app/routes/auth.$.jsx` queries `count(*)` of the `shops` table on each new install. Stores 1–50 receive `plan_type = 'early_adopter_free'`; subsequent stores receive `'standard'`. The Polaris dashboard shows a green banner for early-adopter stores.

## Storefront API

The Theme App Extension calls `https://<your-vercel-url>/api/reviews` for both reading and writing reviews. CORS headers are configured in both the route handler and `vercel.json` so the storefront can call the API cross-origin.

## Theme App Extension

Two blocks are exposed in the Shopify theme editor:

- **Star Badge** — placed directly under the product title.
- **Review Grid** — placed at the bottom of the product page.

Each block has a single setting: `api_base` (your Vercel URL). The blocks are responsive (4 / 2 / 1 columns) and call the API via `fetch` with vanilla JS — no theme JS bundles touched.
