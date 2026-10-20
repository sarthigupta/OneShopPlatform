"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type ShopStatus = "PROVISIONING" | "READY" | "UPDATING" | "DELETING" | "ERROR";
type Product = { id: string; name: string; description: string; priceCents: number };
type StoreContent = {
  tagline: string;
  description: string;
  announcement: string;
  accentColor: string;
  products: Product[];
};
type Shop = { id: string; name: string; slug: string; url: string; status: ShopStatus; retryStatus?: ShopStatus | null; content: Partial<StoreContent> };
type ShopResponse = { shop: Shop };
type ErrorResponse = { error?: string };

const defaultContent: StoreContent = {
  tagline: "Thoughtfully chosen, made for you.",
  description: "A little shop with something special to share.",
  announcement: "",
  accentColor: "#9b4a2f",
  products: [],
};
const activeStatuses: ShopStatus[] = ["PROVISIONING", "UPDATING", "DELETING"];

function toStoreContent(content?: Partial<StoreContent>): StoreContent {
  return {
    ...defaultContent,
    ...content,
    products: Array.isArray(content?.products) ? content.products : [],
  };
}

export default function StorefrontEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [content, setContent] = useState<StoreContent>(defaultContent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadShop = useCallback(async () => {
    try {
      const response = await fetch(`/api/shops/${id}`, { credentials: "include" });
      if (response.status === 401) {
        window.location.href = "/";
        return;
      }
      if (!response.ok) {
        setError(response.status === 404 ? "Shop not found." : "Could not load this shop.");
        return;
      }

      const body = (await response.json()) as ShopResponse;
      setShop(body.shop);
      setContent(toStoreContent(body.shop.content));
    } catch {
      setError("Could not load this shop. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadShop();
  }, [loadShop]);

  useEffect(() => {
    if (!shop || !activeStatuses.includes(shop.status)) return;
    const intervalId = window.setInterval(() => void loadShop(), 1000);
    return () => window.clearInterval(intervalId);
  }, [loadShop, shop]);

  function updateProduct(productId: string, field: keyof Product, value: string) {
    setContent((current) => ({
      ...current,
      products: current.products.map((product) => {
        if (product.id !== productId) return product;
        if (field === "priceCents") {
          const dollars = Number(value || "0");
          return { ...product, priceCents: Number.isFinite(dollars) ? Math.round(dollars * 100) : 0 };
        }
        return { ...product, [field]: value };
      }),
    }));
  }

  function addProduct() {
    setContent((current) => ({
      ...current,
      products: [...current.products, {
        id: globalThis.crypto.randomUUID(),
        name: "",
        description: "",
        priceCents: 0,
      }],
    }));
  }

  function removeProduct(productId: string) {
    setContent((current) => ({
      ...current,
      products: current.products.filter((product) => product.id !== productId),
    }));
  }

  async function saveContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shop) return;
    setError("");
    setNotice("");
    setSaving(true);

    try {
      const response = await fetch(`/api/shops/${shop.id}/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(content),
      });
      if (!response.ok) {
        const body = (await response.json()) as ErrorResponse;
        setError(body.error ?? "Could not save storefront");
        return;
      }

      const body = (await response.json()) as ShopResponse;
      setShop(body.shop);
      setNotice("Saved. Your storefront is updating.");
    } catch {
      setError("Could not save storefront. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function retryOperation() {
    if (!shop) return;
    setError("");
    setRetrying(true);
    try {
      const response = await fetch(`/api/shops/${shop.id}/retry`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const body = (await response.json()) as ErrorResponse;
        setError(body.error ?? "Could not retry shop update");
        return;
      }
      const body = (await response.json()) as ShopResponse;
      setShop(body.shop);
      setNotice("Retry started.");
    } catch {
      setError("Could not retry this update. Check your connection and try again.");
    } finally {
      setRetrying(false);
    }
  }

  const busy = saving || (shop !== null && activeStatuses.includes(shop.status));

  return (
    <main className="storefront-editor">
      <Link className="link-button back-link" href="/shops">← Back to shops</Link>
      {loading ? (
        <p className="muted">Loading storefront...</p>
      ) : !shop ? (
        <p className="error" role="alert">{error || "Shop not found."}</p>
      ) : (
        <>
          <header className="editor-header">
            <div>
              <p className="eyebrow">Storefront editor</p>
              <h1>{shop.name}</h1>
              <p className="muted">Content is saved in your shop and published when its update is ready.</p>
            </div>
            <a className="link-button" href={shop.url} target="_blank" rel="noreferrer">View storefront ↗</a>
          </header>

          <div className="editor-status" aria-live="polite">
            <span className={`status status-${shop.status.toLowerCase()}`}>{shop.status.toLowerCase()}</span>
            {shop.status === "ERROR" && <span className="muted">The last shop operation failed. Check worker logs before retrying.</span>}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          {notice && <p className="success" role="status">{notice}</p>}

          <form className="content-form" onSubmit={saveContent}>
            <section className="editor-section">
              <h2>Shop introduction</h2>
              <label>Tagline
                <input maxLength={120} value={content.tagline} onChange={(event) => setContent({ ...content, tagline: event.target.value })} disabled={busy} />
              </label>
              <label>Description
                <textarea maxLength={1500} rows={5} value={content.description} onChange={(event) => setContent({ ...content, description: event.target.value })} disabled={busy} />
              </label>
              <label>Announcement bar
                <input maxLength={160} placeholder="Example: Free shipping this week" value={content.announcement} onChange={(event) => setContent({ ...content, announcement: event.target.value })} disabled={busy} />
              </label>
              <label className="color-label">Accent color
                <input type="color" value={content.accentColor} onChange={(event) => setContent({ ...content, accentColor: event.target.value })} disabled={busy} />
              </label>
            </section>

            <section className="editor-section">
              <div className="section-title-row"><h2>Products</h2><span className="muted">Up to 24 products · prices in USD</span></div>
              {content.products.length === 0 && <p className="muted">Add a few products to give customers something to browse.</p>}
              <div className="product-editor-list">
                {content.products.map((product, index) => (
                  <fieldset className="product-editor" key={product.id} disabled={busy}>
                    <legend>Product {index + 1}</legend>
                    <label>Product name
                      <input required maxLength={100} value={product.name} onChange={(event) => updateProduct(product.id, "name", event.target.value)} />
                    </label>
                    <label>Product description
                      <textarea maxLength={400} rows={3} value={product.description} onChange={(event) => updateProduct(product.id, "description", event.target.value)} />
                    </label>
                    <label>Price (USD)
                      <input type="number" min="0" max="1000000" step="0.01" value={(product.priceCents / 100).toFixed(2)} onChange={(event) => updateProduct(product.id, "priceCents", event.target.value)} />
                    </label>
                    <button className="link-button danger" type="button" onClick={() => removeProduct(product.id)}>Remove product</button>
                  </fieldset>
                ))}
              </div>
              <button className="secondary-button" type="button" onClick={addProduct} disabled={busy || content.products.length >= 24}>Add product</button>
            </section>

            <div className="editor-actions">
              <button className="button" type="submit" disabled={busy || shop.status !== "READY"}>
                {saving ? "Saving..." : shop.status === "UPDATING" ? "Publishing..." : "Save and publish"}
              </button>
              {shop.status === "ERROR" && shop.retryStatus === "UPDATING" && (
                <button className="secondary-button" type="button" onClick={() => void retryOperation()} disabled={retrying}>
                  {retrying ? "Retrying..." : "Retry update"}
                </button>
              )}
              {shop.status === "ERROR" && shop.retryStatus !== "UPDATING" && (
                <span className="muted">Use the shops dashboard to retry this operation.</span>
              )}
              <span className="muted">Status: {shop.status.toLowerCase()}</span>
            </div>
          </form>
        </>
      )}
    </main>
  );
}
