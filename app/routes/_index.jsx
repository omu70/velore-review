// =============================================================
// Velore Reviews — read-only dashboard of the baked-in reviews.
// No database, no login. Open at https://<your-vercel-url>/.
// =============================================================
import { SEED_REVIEWS } from "../seed-reviews";

export const meta = () => [{ title: "Velore Reviews" }];

const S = {
  wrap: { fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif", maxWidth: 900, margin: "0 auto", padding: 24, color: "#111827" },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, marginBottom: 16 },
  pill: { fontSize: 12, padding: "2px 10px", borderRadius: 999, background: "#eef2ff", color: "#3730a3", marginLeft: 8 },
  th: { textAlign: "left", fontSize: 12, color: "#6b7280", padding: "8px", borderBottom: "1px solid #e5e7eb", textTransform: "uppercase" },
  td: { padding: "10px 8px", borderBottom: "1px solid #f3f4f6", fontSize: 13.5, verticalAlign: "top" },
};

export default function Dashboard() {
  const byProduct = {};
  SEED_REVIEWS.forEach((r) => { (byProduct[r.product_handle || "store-wide"] ||= []).push(r); });
  const handles = Object.keys(byProduct).sort();
  const total = SEED_REVIEWS.length;
  const avg = total ? (SEED_REVIEWS.reduce((s, r) => s + r.rating, 0) / total).toFixed(2) : "0";

  return (
    <div style={S.wrap}>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Velore Reviews</h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>
        {total} reviews live · avg {avg}★ · served to the storefront from this app (no database needed)
      </p>

      <div style={S.card}>
        <h3 style={{ marginTop: 0 }}>By product</h3>
        {handles.map((h) => {
          const list = byProduct[h];
          const a = (list.reduce((s, r) => s + r.rating, 0) / list.length).toFixed(1);
          return (
            <div key={h} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
              <span><code>{h}</code></span>
              <span style={{ color: "#6b7280" }}>{list.length} reviews · {a}★</span>
            </div>
          );
        })}
      </div>

      <div style={S.card}>
        <h3 style={{ marginTop: 0 }}>All reviews</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={S.th}>Author</th><th style={S.th}>★</th><th style={S.th}>Product</th><th style={S.th}>Review</th></tr></thead>
            <tbody>
              {SEED_REVIEWS.map((r) => (
                <tr key={r.id}>
                  <td style={S.td}>{r.author_name}<div style={{ color: "#9ca3af", fontSize: 11 }}>{r.author_location}</div></td>
                  <td style={S.td}>{r.rating}</td>
                  <td style={{ ...S.td, color: "#6b7280" }}><code>{r.product_handle}</code></td>
                  <td style={{ ...S.td, maxWidth: 380 }}>{r.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ color: "#9ca3af", fontSize: 12 }}>
        To change reviews, edit <code>app/seed-reviews.js</code> and push. No login or database required.
      </p>
    </div>
  );
}
