// =============================================================
// Landing route — redirects into the embedded admin when Shopify
// opens the app with a ?shop= param; otherwise shows a tiny notice.
// File: /app/routes/_index.jsx
// =============================================================
import { redirect } from "@remix-run/node";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return null;
};

export default function Index() {
  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "48px",
        maxWidth: 640,
        margin: "0 auto",
        lineHeight: 1.5,
      }}
    >
      <h1>Velore Reviews</h1>
      <p>
        This is a private product-reviews app. Open it from your Shopify admin
        under <strong>Apps</strong>.
      </p>
    </div>
  );
}
