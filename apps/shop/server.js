import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3000);
const shopName = process.env.SHOP_NAME ?? "OneShop demo shop";
const shopSlug = process.env.SHOP_SLUG ?? "demo";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function readContent() {
  try {
    const parsed = JSON.parse(process.env.SHOP_CONTENT_JSON ?? "{}");
    const accentColor = /^#[\da-fA-F]{6}$/.test(parsed.accentColor ?? "") ? parsed.accentColor : "#9b4a2f";
    const products = Array.isArray(parsed.products)
      ? parsed.products.filter((product) => product && typeof product.name === "string")
      : [];

    return {
      tagline: typeof parsed.tagline === "string" ? parsed.tagline : "Thoughtfully chosen, made for you.",
      description: typeof parsed.description === "string" ? parsed.description : "A little shop with something special to share.",
      announcement: typeof parsed.announcement === "string" ? parsed.announcement : "",
      accentColor,
      products,
    };
  } catch {
    return {
      tagline: "Thoughtfully chosen, made for you.",
      description: "A little shop with something special to share.",
      announcement: "",
      accentColor: "#9b4a2f",
      products: [],
    };
  }
}

function renderProducts(products, accentColor) {
  if (products.length === 0) {
    return '<p class="empty">Products are coming soon. Check back shortly.</p>';
  }

  return products.map((product) => {
    const name = escapeHtml(product.name);
    const initial = escapeHtml(String(product.name).slice(0, 1));
    const description = escapeHtml(product.description ?? "");
    const priceCents = Number.isInteger(product.priceCents) ? product.priceCents : 0;
    const price = `$${(priceCents / 100).toFixed(2)}`;
    return `<article class="product-card">
      <div class="product-art" style="--accent:${accentColor}" aria-hidden="true"><span>${initial}</span></div>
      <div class="product-copy"><h3>${name}</h3><p>${description || "A lovely find from our shop."}</p><strong>${price}</strong></div>
    </article>`;
  }).join("");
}

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ status: "ok", shop: shopSlug }));
    return;
  }

  const content = readContent();
  const safeName = escapeHtml(shopName);
  const announcement = content.announcement
    ? `<div class="announcement">${escapeHtml(content.announcement)}</div>`
    : "";

  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(content.description)}" />
    <title>${safeName}</title>
    <style>
      :root { --accent: ${content.accentColor}; --ink: #22231f; --paper: #fbf9f4; --muted: #74736d; }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.5 system-ui, sans-serif; }
      .announcement { padding: .7rem 1rem; background: var(--accent); color: white; text-align: center; font-size: .86rem; }
      header { display: flex; justify-content: space-between; align-items: center; max-width: 1120px; margin: auto; padding: 1.5rem 2rem; border-bottom: 1px solid #e8e4dc; }
      .brand { color: var(--ink); font: 700 1.15rem Georgia, serif; text-decoration: none; }
      .brand-mark { color: var(--accent); margin-right: .45rem; }
      .shop-label { color: var(--muted); font-size: .82rem; }
      main { max-width: 1120px; margin: auto; padding: 0 2rem 5rem; }
      .hero { padding: clamp(4rem, 12vw, 8rem) 0 5rem; max-width: 760px; }
      .eyebrow { margin: 0 0 1rem; color: var(--accent); font-size: .75rem; font-weight: 750; letter-spacing: .15em; text-transform: uppercase; }
      h1 { margin: 0; font: 500 clamp(3.2rem, 9vw, 7rem)/.94 Georgia, serif; letter-spacing: -.055em; }
      .tagline { max-width: 600px; margin: 1.5rem 0 0; color: var(--muted); font: clamp(1.05rem, 2.4vw, 1.3rem)/1.7 Georgia, serif; }
      .section-heading { display: flex; justify-content: space-between; align-items: end; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #e8e4dc; }
      h2 { margin: 0; font: 500 2rem Georgia, serif; }
      .section-heading span { color: var(--muted); font-size: .82rem; }
      .products { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 1.5rem; padding-top: 1.5rem; }
      .product-card { overflow: hidden; border: 1px solid #e8e4dc; border-radius: 8px; background: white; }
      .product-art { display: grid; min-height: 190px; place-items: center; background: color-mix(in srgb, var(--accent) 12%, #f5f0e8); color: var(--accent); }
      .product-art span { display: grid; width: 76px; height: 76px; place-items: center; border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); border-radius: 50%; font: 2.3rem Georgia, serif; }
      .product-copy { padding: 1.2rem; }
      h3 { margin: 0; font: 600 1.1rem Georgia, serif; }
      .product-copy p { min-height: 2.8em; margin: .45rem 0 1rem; color: var(--muted); font-size: .9rem; }
      .product-copy strong { color: var(--accent); font-size: .92rem; }
      .empty { padding: 2rem 0; color: var(--muted); }
      footer { padding: 2rem; border-top: 1px solid #e8e4dc; color: var(--muted); text-align: center; font-size: .8rem; }
      @media (max-width: 600px) { header { padding: 1rem 1.25rem; } main { padding: 0 1.25rem 3rem; } .shop-label { display: none; } }
    </style>
  </head>
  <body>
    ${announcement}
    <header><a class="brand" href="#top"><span class="brand-mark">✳</span>${safeName}</a><span class="shop-label">Independent shop · ${escapeHtml(shopSlug)}</span></header>
    <main id="top">
      <section class="hero"><p class="eyebrow">Welcome to our shop</p><h1>${safeName}</h1><p class="tagline">${escapeHtml(content.tagline)} ${escapeHtml(content.description)}</p></section>
      <section aria-labelledby="products-title"><div class="section-heading"><h2 id="products-title">Shop the collection</h2><span>Made with care</span></div><div class="products">${renderProducts(content.products, content.accentColor)}</div></section>
    </main>
    <footer>Thanks for stopping by ${safeName}.</footer>
  </body>
</html>`);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Shop ${shopSlug} listening on port ${port}`);
});
