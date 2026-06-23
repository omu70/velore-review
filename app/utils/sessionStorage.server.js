// =============================================================
// Supabase-backed Shopify session storage
// File: /app/utils/sessionStorage.server.js
//
// Stores OAuth sessions in the `shopify_sessions` table so they
// survive Vercel's serverless cold starts. Reuses the same
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars — no Prisma,
// no extra database, no new env var.
// =============================================================
import { createClient } from "@supabase/supabase-js";
import { Session } from "@shopify/shopify-app-remix/server";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const TABLE = "shopify_sessions";

export class SupabaseSessionStorage {
  async storeSession(session) {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        {
          id: session.id,
          shop: session.shop,
          data: session.toPropertyArray(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    return !error;
  }

  async loadSession(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("data")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return undefined;
    return Session.fromPropertyArray(data.data);
  }

  async deleteSession(id) {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    return !error;
  }

  async deleteSessions(ids) {
    const { error } = await supabase.from(TABLE).delete().in("id", ids);
    return !error;
  }

  async findSessionsByShop(shop) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("data")
      .eq("shop", shop);
    if (error || !data) return [];
    return data.map((row) => Session.fromPropertyArray(row.data));
  }
}
