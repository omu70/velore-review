// =============================================================
// Velore Reviews — standalone admin (no Shopify OAuth)
// File: /app/routes/_index.jsx
//
// Password-gated dashboard that talks straight to Supabase.
// Open it directly at https://<your-vercel-url>/  (not embedded).
// Set ADMIN_PASSWORD in your Vercel env vars.
// =============================================================
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { supabaseAdmin } from "../utils/supabase.server";

const COOKIE_NAME = "evo_admin";
const DEFAULT_SHOP = "velor-living.myshopify.com";

function getPassword() {
  // Defaults to "123456". To make it secure, set ADMIN_PASSWORD in Vercel
  // (the env var overrides this default).
  return process.env.ADMIN_PASSWORD || "123456";
}

function isAuthed(request) {
  const pw = getPassword();
  if (!pw) return false;
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)evo_admin=([^;]+)/);
  return Boolean(m && decodeURIComponent(m[1]) === pw);
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/);
  const a = (parts[0] || "")[0] || "";
  const b = (parts[1] || "")[0] || "";
  return ((a + b).toUpperCase() || "AN").slice(0, 2);
}

// Minimal, forgiving CSV parser (handles quotes + commas + newlines).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

export const loader = async ({ request }) => {
  if (!getPassword()) {
    return json({ authed: false, noPassword: true });
  }
  if (!isAuthed(request)) return json({ authed: false });

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || DEFAULT_SHOP;
  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("id, product_handle, product_id, author_name, rating, content, status, source, created_at")
    .eq("shop_domain", shop)
    .order("created_at", { ascending: false })
    .limit(300);

  return json({ authed: true, shop, reviews: data || [], error: error?.message || null });
};

export const action = async ({ request }) => {
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "login") {
    const pw = String(form.get("password") || "");
    if (pw && pw === getPassword()) {
      return redirect("/", {
        headers: {
          "Set-Cookie": `${COOKIE_NAME}=${encodeURIComponent(pw)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
        },
      });
    }
    return json({ msg: "Wrong password.", ok: false });
  }

  if (!isAuthed(request)) return redirect("/");

  if (intent === "logout") {
    return redirect("/", { headers: { "Set-Cookie": `${COOKIE_NAME}=; Path=/; Max-Age=0` } });
  }

  const shop = String(form.get("shop") || DEFAULT_SHOP);
  const back = `/?shop=${encodeURIComponent(shop)}`;

  if (intent === "approve" || intent === "hide" || intent === "delete") {
    const id = String(form.get("id"));
    if (intent === "delete") await supabaseAdmin.from("reviews").delete().eq("id", id);
    else await supabaseAdmin.from("reviews").update({ status: intent === "approve" ? "approved" : "hidden" }).eq("id", id);
    return redirect(back);
  }

  if (intent === "add") {
    const author = String(form.get("author_name") || "").trim();
    const content = String(form.get("content") || "").trim();
    const handle = String(form.get("product_handle") || "").trim() || null;
    let rating = parseInt(String(form.get("rating") || "5"), 10);
    rating = Math.max(1, Math.min(5, rating || 5));
    if (author && content) {
      await supabaseAdmin.from("reviews").insert({
        shop_domain: shop, author_name: author, author_initials: initials(author),
        rating, content, status: "approved", product_handle: handle, source: "manual", is_verified: true,
      });
      return redirect(back);
    }
    return json({ msg: "Name and review text are required.", ok: false });
  }

  if (intent === "import") {
    const rows = parseCSV(String(form.get("csv") || ""));
    if (rows.length < 2) return json({ msg: "Paste a CSV with a header row + at least one review.", ok: false });
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const find = (names) => { for (const n of names) { const i = headers.indexOf(n); if (i >= 0) return i; } return -1; };
    const iAuthor = find(["author", "author_name", "name", "reviewer", "customer_name", "customer"]);
    const iRating = find(["rating", "score", "stars", "star"]);
    const iContent = find(["content", "body", "review", "comment", "message", "text", "review_content", "review_body"]);
    const iHandle = find(["product_handle", "handle", "product", "product_id"]);
    const iTitle = find(["title", "review_title"]);
    const iLoc = find(["author_location", "location", "city", "author_country", "country"]);

    const recs = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const author = (iAuthor >= 0 ? row[iAuthor] : "").trim();
      const content = (iContent >= 0 ? row[iContent] : "").trim();
      if (!author || !content) continue;
      let rating = parseInt(iRating >= 0 ? row[iRating] : "5", 10);
      rating = Math.max(1, Math.min(5, rating || 5));
      const rec = {
        shop_domain: shop, author_name: author, author_initials: initials(author),
        rating, content, status: "approved", source: "csv_import", is_verified: true,
        product_handle: iHandle >= 0 ? (row[iHandle] || "").trim() || null : null,
      };
      if (iTitle >= 0 && row[iTitle]) rec.title = row[iTitle].trim();
      if (iLoc >= 0 && row[iLoc]) rec.author_location = row[iLoc].trim();
      recs.push(rec);
    }
    if (!recs.length) return json({ msg: "No valid rows — need at least 'author' and 'content' columns.", ok: false });

    let inserted = 0, errMsg = null;
    for (let i = 0; i < recs.length; i += 200) {
      const { error } = await supabaseAdmin.from("reviews").insert(recs.slice(i, i + 200));
      if (error) { errMsg = error.message; break; }
      inserted += Math.min(200, recs.length - i);
    }
    return json({ ok: !errMsg, msg: errMsg ? `Imported ${inserted}, then error: ${errMsg}` : `Imported ${inserted} reviews ✓` });
  }

  return redirect(back);
};

const S = {
  wrap: { fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif", maxWidth: 1040, margin: "0 auto", padding: 24, color: "#111827" },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 1px 2px rgba(0,0,0,.04)" },
  btn: { background: "#111827", color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 14 },
  btnLight: { background: "#f3f4f6", color: "#111827", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 13 },
  input: { width: "100%", padding: "9px 11px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" },
  th: { textAlign: "left", fontSize: 12, color: "#6b7280", padding: "8px 8px", borderBottom: "1px solid #e5e7eb", textTransform: "uppercase", letterSpacing: ".03em" },
  td: { padding: "10px 8px", borderBottom: "1px solid #f3f4f6", fontSize: 13.5, verticalAlign: "top" },
};

function Banner({ data }) {
  if (!data?.msg) return null;
  const ok = data.ok;
  return <div style={{ ...S.card, borderColor: ok ? "#bbf7d0" : "#fecaca", background: ok ? "#f0fdf4" : "#fef2f2", color: ok ? "#166534" : "#991b1b" }}>{data.msg}</div>;
}

export default function Admin() {
  const data = useLoaderData();
  const action = useActionData();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  if (!data.authed) {
    return (
      <div style={{ ...S.wrap, maxWidth: 420, paddingTop: 80 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Velore Reviews</h1>
        <p style={{ color: "#6b7280", marginTop: 0 }}>Admin login</p>
        {data.noPassword && (
          <div style={{ ...S.card, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>
            Set an <b>ADMIN_PASSWORD</b> environment variable in Vercel, then redeploy.
          </div>
        )}
        <Banner data={action} />
        <Form method="post" style={S.card}>
          <input type="hidden" name="intent" value="login" />
          <label style={{ fontSize: 13, fontWeight: 600 }}>Password</label>
          <input style={{ ...S.input, marginTop: 6, marginBottom: 14 }} type="password" name="password" autoFocus />
          <button style={S.btn} disabled={busy}>{busy ? "..." : "Log in"}</button>
        </Form>
      </div>
    );
  }

  const { shop, reviews, error } = data;
  return (
    <div style={S.wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Velore Reviews</h1>
          <div style={{ color: "#6b7280", fontSize: 13 }}>{shop} · {reviews.length} reviews</div>
        </div>
        <Form method="post"><input type="hidden" name="intent" value="logout" /><button style={S.btnLight}>Log out</button></Form>
      </div>

      <Form method="get" style={{ ...S.card, display: "flex", gap: 10, alignItems: "end" }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>Store domain</label>
          <input style={{ ...S.input, marginTop: 4 }} name="shop" defaultValue={shop} placeholder="your-store.myshopify.com" />
        </div>
        <button style={S.btn}>Load</button>
      </Form>

      <Banner data={action} />
      {error && <div style={{ ...S.card, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b" }}>DB error: {error}</div>}

      <div style={S.card}>
        <h3 style={{ marginTop: 0 }}>Import reviews (CSV)</h3>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 0 }}>
          Paste CSV text. First row = headers. Recognised columns: <code>author</code>, <code>rating</code>, <code>content</code>, <code>product_handle</code>, <code>title</code>, <code>location</code>. Trustoo exports work.
        </p>
        <Form method="post">
          <input type="hidden" name="intent" value="import" />
          <input type="hidden" name="shop" value={shop} />
          <textarea name="csv" rows={6} style={{ ...S.input, fontFamily: "monospace", fontSize: 12.5 }} placeholder={"author,rating,content,product_handle\nAman Sharma,5,Loved it!,my-product-handle"} />
          <button style={{ ...S.btn, marginTop: 10 }} disabled={busy}>{busy ? "Importing..." : "Import CSV"}</button>
        </Form>
      </div>

      <div style={S.card}>
        <h3 style={{ marginTop: 0 }}>Add a review</h3>
        <Form method="post" style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 10 }}>
          <input type="hidden" name="intent" value="add" />
          <input type="hidden" name="shop" value={shop} />
          <input style={S.input} name="author_name" placeholder="Reviewer name" />
          <select style={S.input} name="rating" defaultValue="5">
            <option value="5">5 ★</option><option value="4">4 ★</option><option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option>
          </select>
          <input style={{ ...S.input, gridColumn: "1 / span 2" }} name="product_handle" placeholder="product handle (optional — leave blank for store-wide)" />
          <textarea style={{ ...S.input, gridColumn: "1 / span 2" }} name="content" rows={2} placeholder="Review text" />
          <button style={{ ...S.btn, gridColumn: "1 / span 2", justifySelf: "start" }} disabled={busy}>Add review</button>
        </Form>
      </div>

      <div style={S.card}>
        <h3 style={{ marginTop: 0 }}>Reviews</h3>
        {!reviews.length && <p style={{ color: "#6b7280" }}>No reviews for this store yet.</p>}
        {reviews.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={S.th}>Author</th><th style={S.th}>★</th><th style={S.th}>Product</th><th style={S.th}>Review</th><th style={S.th}>Status</th><th style={S.th}></th></tr></thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id}>
                    <td style={S.td}>{r.author_name}</td>
                    <td style={S.td}>{r.rating}</td>
                    <td style={{ ...S.td, color: "#6b7280", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>{r.product_handle || (r.product_id ? r.product_id : "—")}</td>
                    <td style={{ ...S.td, maxWidth: 320 }}>{r.content}</td>
                    <td style={S.td}>
                      <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: r.status === "approved" ? "#dcfce7" : r.status === "pending" ? "#fef9c3" : "#f3f4f6", color: r.status === "approved" ? "#166534" : r.status === "pending" ? "#854d0e" : "#6b7280" }}>{r.status}</span>
                    </td>
                    <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                      {r.status !== "approved" && <ActBtn shop={shop} id={r.id} intent="approve" label="Approve" />}
                      {r.status !== "hidden" && <ActBtn shop={shop} id={r.id} intent="hide" label="Hide" />}
                      <ActBtn shop={shop} id={r.id} intent="delete" label="Delete" danger />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ActBtn({ shop, id, intent, label, danger }) {
  return (
    <Form method="post" style={{ display: "inline" }}>
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="shop" value={shop} />
      <button style={{ ...S.btnLight, marginRight: 6, color: danger ? "#b91c1c" : "#111827", borderColor: danger ? "#fecaca" : "#e5e7eb" }}>{label}</button>
    </Form>
  );
}
