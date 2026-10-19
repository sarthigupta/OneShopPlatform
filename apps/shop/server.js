import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3000);
const shopName = escapeHtml(process.env.SHOP_NAME ?? "OneShop demo shop");
const shopSlug = escapeHtml(process.env.SHOP_SLUG ?? "demo");

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
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

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ status: "ok", shop: shopSlug }));
    return;
  }

  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${shopName}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f0e8; color: #17221b; font: 16px system-ui, sans-serif; }
      main { max-width: 38rem; padding: 3rem; text-align: center; }
      p { color: #59645c; }
      small { color: #9b4a2f; }
    </style>
  </head>
  <body>
    <main>
      <small>OneShop</small>
      <h1>${shopName}</h1>
      <p>This shop is running and ready for its owner to customize.</p>
    </main>
  </body>
</html>`);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Shop ${shopSlug} listening on port ${port}`);
});
