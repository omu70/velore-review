// =============================================================
// AI Review Generator UI — multi-product, batch generation
// File: /app/routes/app.generate.jsx
// =============================================================
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page, Card, BlockStack, Text, Button, Banner, ChoiceList,
  TextField, InlineStack, Badge, Box, Divider, Select,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useMemo } from "react";
import { authenticate } from "../shopify.server";
import { supabaseAdmin } from "../utils/supabase.server";
import { generateForProducts } from "../utils/ai.server";

// ---------------- Loader: list products ----------------
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const res = await admin.graphql(
    `#graphql
    query {
      products(first: 100, sortKey: UPDATED_AT, reverse: true) {
        edges { node { id handle title description } }
      }
    }`
  );
  const body = await res.json();
  const products = (body.data?.products?.edges || []).map((e) => ({
    id: e.node.id.replace("gid://shopify/Product/", ""),
    handle: e.node.handle,
    title: e.node.title,
    description: e.node.description,
  }));
  return json({ products });
};

// ---------------- Action ----------------
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const form = await request.formData();
  const productsJSON = form.get("products");
  const count = Math.min(50, Math.max(1, parseInt(form.get("count") || "10", 10)));
  const style = String(form.get("style") || "hinglish");

  let products;
  try { products = JSON.parse(productsJSON || "[]"); }
  catch { return json({ ok: false, error: "Invalid product list" }, { status: 400 }); }

  if (!Array.isArray(products) || products.length === 0) {
    return json({ ok: false, error: "Pick at least one product" }, { status: 400 });
  }

  let records;
  try {
    records = await generateForProducts({
      shopDomain: shop,
      products,
      countPerProduct: count,
      style,
    });
  } catch (e) {
    return json({ ok: false, error: e.message }, { status: 500 });
  }

  if (records.length === 0) {
    return json({ ok: false, error: "AI returned no usable reviews" }, { status: 500 });
  }

  const { error } = await supabaseAdmin.from("reviews").insert(records);
  if (error) return json({ ok: false, error: error.message }, { status: 500 });

  return json({
    ok: true,
    inserted: records.length,
    productsCount: products.length,
  });
};

// ---------------- Component ----------------
export default function GeneratePage() {
  const { products } = useLoaderData();
  const action = useActionData();
  const nav = useNavigation();

  const [selected, setSelected] = useState([]);     // product IDs
  const [count, setCount] = useState("10");
  const [style, setStyle] = useState("hinglish");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.title.toLowerCase().includes(q) || (p.handle || "").includes(q));
  }, [products, search]);

  const choices = filtered.map((p) => ({
    label: p.title + (p.handle ? `  ·  /${p.handle}` : ""),
    value: p.id,
  }));

  const selectedProducts = products.filter((p) => selected.includes(p.id));

  const submitting = nav.state === "submitting";

  return (
    <Page
      backAction={{ content: "Reviews", url: "/app" }}
      title="Generate sample reviews"
    >
      <TitleBar title="Generate sample reviews" />
      <BlockStack gap="400">
        <Banner tone="info" title="Free template-based generator">
          <p>
            Reviews are composed from a pool of varied templates. No external API,
            no cost. Tagged with <code>source = ai_sample</code> so you can filter them.
            Make sure you comply with local consumer laws when displaying generated reviews.
          </p>
        </Banner>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">1. Select products</Text>
            <TextField
              label="Search products"
              labelHidden
              value={search}
              onChange={setSearch}
              placeholder="Search by title or handle…"
              autoComplete="off"
              clearButton
              onClearButtonClick={() => setSearch("")}
            />
            <Box maxWidth="100%" maxHeight="380px" overflowY="scroll" padding="200" borderRadius="200" borderWidth="025" borderColor="border">
              <ChoiceList
                title="Products"
                titleHidden
                allowMultiple
                choices={choices}
                selected={selected}
                onChange={setSelected}
              />
            </Box>
            <InlineStack gap="200" align="space-between">
              <InlineStack gap="200">
                <Button onClick={() => setSelected(filtered.map((p) => p.id))}>Select all visible</Button>
                <Button onClick={() => setSelected([])}>Clear</Button>
              </InlineStack>
              <Badge tone={selected.length ? "success" : undefined}>
                {selected.length + " selected"}
              </Badge>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <Form method="post">
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">2. Settings</Text>
              <TextField
                label="Reviews per product"
                type="number"
                min="1" max="50"
                value={count}
                onChange={setCount}
                autoComplete="off"
                helpText="Tip: 10 per product is plenty. Maximum 50."
              />
              <Select
                label="Tone & language style"
                options={[
                  { label: "Hinglish (Indian casual mix)", value: "hinglish" },
                  { label: "Plain English", value: "english" },
                ]}
                value={style}
                onChange={setStyle}
              />

              <Divider />

              <Text as="p" variant="bodySm" tone="subdued">
                Will generate <strong>{selected.length * parseInt(count || "0", 10)}</strong> reviews
                across <strong>{selected.length}</strong> product{selected.length === 1 ? "" : "s"}.
              </Text>

              <input type="hidden" name="products" value={JSON.stringify(selectedProducts)} />
              <input type="hidden" name="count" value={count} />
              <input type="hidden" name="style" value={style} />

              <Button
                variant="primary"
                submit
                disabled={submitting || selected.length === 0}
                loading={submitting}
              >
                {submitting ? "Generating reviews…" : "Generate reviews"}
              </Button>
            </BlockStack>
          </Form>
        </Card>

        {action?.ok ? (
          <Banner tone="success" title={`Generated ${action.inserted} reviews across ${action.productsCount} products`}>
            <p>They're saved with <code>source = ai_sample</code> and will appear on your storefront immediately.</p>
          </Banner>
        ) : null}
        {action?.ok === false ? (
          <Banner tone="critical" title="Generation failed"><p>{action.error}</p></Banner>
        ) : null}
      </BlockStack>
    </Page>
  );
}
