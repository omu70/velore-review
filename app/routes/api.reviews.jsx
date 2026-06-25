// =============================================================
// Public storefront API for reviews — serves a BAKED-IN dataset
// (app/seed-reviews.js). No external database, no env vars.
// GET  /api/reviews?shop=<domain>&productHandle=<handle>&page=1&limit=12
// GET  /api/reviews?shop=<domain>&store=true
// POST /api/reviews   (accepted, not persisted in this build)
// =============================================================
import { json } from "@remix-run/node";
import { SEED_REVIEWS } from "../seed-reviews";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain",
  "Access-Control-Max-Age": "86400",
};

const respond = (body, init = {}) =>
  json(body, {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers || {}) },
  });

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  // Reviews are served from a baked-in dataset (no DB in this build), so a new
  // submission is accepted gracefully but not stored.
  return respond({ ok: true, message: "Thanks! Your review has been received." });
};

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const productId = url.searchParams.get("productId");
  const productHandle = url.searchParams.get("productHandle");
  const storeOnly = url.searchParams.get("store") === "true";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "12", 10)));

  // Scope to the shop if we have reviews for it; otherwise fall back to all
  // seed data (keeps the widget working even if the shop param differs).
  let pool = SEED_REVIEWS;
  if (shop) {
    const scoped = pool.filter((r) => r.shop_domain === shop);
    if (scoped.length) pool = scoped;
  }

  let all;
  if (storeOnly) {
    all = pool.filter((r) => !r.product_handle && !r.product_id);
  } else {
    const key = productHandle || productId;
    all = pool.filter(
      (r) => r.product_handle === key || (r.product_id && String(r.product_id) === String(key))
    );
  }

  all = all.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const totalRatings = all.length;
  const average = totalRatings
    ? Number((all.reduce((s, r) => s + r.rating, 0) / totalRatings).toFixed(1))
    : 0;
  const total = totalRatings;
  const from = (page - 1) * limit;
  const reviews = all.slice(from, from + limit);

  return respond({
    reviews,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    average,
    totalRatings,
  });
};
