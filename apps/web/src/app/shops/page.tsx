"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type ShopStatus = "PROVISIONING" | "READY" | "UPDATING" | "DELETING" | "ERROR";
type Shop = { id: string; name: string; slug: string; url: string; status: ShopStatus };
type ShopResponse = { shop: Shop };
type ShopListResponse = { shops: Shop[] };
type ErrorResponse = { error?: string };

const activeStatuses: ShopStatus[] = ["PROVISIONING", "UPDATING", "DELETING"];

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadShops = useCallback(async () => {
    try {
      const response = await fetch("/api/shops", { credentials: "include" });
      if (response.status === 401) {
        window.location.href = "/";
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ErrorResponse | null;
        setError(body?.error ? `Could not load shops: ${body.error}` : `Could not load shops (HTTP ${response.status})`);
        return;
      }

      const body = (await response.json()) as ShopListResponse;
      setShops(body.shops);
    } catch {
      setError("Could not load shops. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShops();
  }, [loadShops]);

  const hasActiveShops = shops.some((shop) => activeStatuses.includes(shop.status));
  useEffect(() => {
    if (!hasActiveShops) return;

    const intervalId = window.setInterval(() => void loadShops(), 3000);
    return () => window.clearInterval(intervalId);
  }, [hasActiveShops, loadShops]);

  async function createShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCreating(true);

    try {
      const response = await fetch("/api/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, slug: slug || undefined }),
      });
      if (!response.ok) {
        const body = (await response.json()) as ErrorResponse;
        setError(body.error ?? "Could not create shop");
        return;
      }

      const body = (await response.json()) as ShopResponse;
      setShops((current) => [body.shop, ...current]);
      setName("");
      setSlug("");
    } catch {
      setError("Could not create shop. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  }

  async function updateShop(event: FormEvent<HTMLFormElement>, shopId: string) {
    event.preventDefault();
    setError("");
    setSavingId(shopId);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/shops/${shopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: form.get("name"), slug: form.get("slug") }),
      });
      if (!response.ok) {
        const body = (await response.json()) as ErrorResponse;
        setError(body.error ?? "Could not update shop");
        return;
      }

      const body = (await response.json()) as ShopResponse;
      setShops((current) => current.map((shop) => (shop.id === shopId ? body.shop : shop)));
      setEditingId(null);
    } catch {
      setError("Could not update shop. Check your connection and try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteShop(shopId: string) {
    if (!window.confirm("Delete this shop?")) return;
    setError("");

    try {
      const response = await fetch(`/api/shops/${shopId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        setError("Could not delete shop");
        return;
      }

      const body = (await response.json()) as ShopResponse;
      setShops((current) => current.map((shop) => (shop.id === shopId ? body.shop : shop)));
    } catch {
      setError("Could not delete shop. Check your connection and try again.");
    }
  }

  async function retryShop(shopId: string) {
    setError("");
    setRetryingId(shopId);

    try {
      const response = await fetch(`/api/shops/${shopId}/retry`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const body = (await response.json()) as ErrorResponse;
        setError(body.error ?? "Could not retry shop");
        return;
      }

      const body = (await response.json()) as ShopResponse;
      setShops((current) => current.map((shop) => (shop.id === shopId ? body.shop : shop)));
    } catch {
      setError("Could not retry shop. Check your connection and try again.");
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Your shops</h1>
        </div>
        <button className="link-button" onClick={logout}>Sign out</button>
      </header>

      <form className="create-form" onSubmit={createShop}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Shop name" required />
        <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="Slug (optional)" />
        <button className="button" type="submit" disabled={creating}>
          {creating ? "Creating..." : "Create shop"}
        </button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
      {loading ? (
        <p className="muted">Loading...</p>
      ) : shops.length === 0 ? (
        <p className="muted">No shops yet.</p>
      ) : (
        <ul className="shop-list">
          {shops.map((shop) => {
            const isActive = activeStatuses.includes(shop.status);
            return (
              <li key={shop.id}>
                {editingId === shop.id ? (
                  <form className="edit-form" onSubmit={(event) => updateShop(event, shop.id)}>
                    <input name="name" defaultValue={shop.name} required disabled={savingId === shop.id} />
                    <input name="slug" defaultValue={shop.slug} required disabled={savingId === shop.id} />
                    <button className="link-button" type="submit" disabled={savingId === shop.id}>
                      {savingId === shop.id ? "Saving..." : "Save"}
                    </button>
                    <button className="link-button" type="button" onClick={() => setEditingId(null)} disabled={savingId === shop.id}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="shop-details">
                      <strong>{shop.name}</strong>
                      <span>{shop.slug}</span>
                      {shop.status === "READY" && <a href={shop.url} target="_blank" rel="noreferrer">{shop.url}</a>}
                    </div>
                    <span className={`status status-${shop.status.toLowerCase()}`} aria-live="polite">
                      {shop.status === "PROVISIONING" ? "Provisioning…" : shop.status.toLowerCase()}
                    </span>
                    {shop.status === "ERROR" && (
                      <>
                        <span className="muted">Shop operation failed. Check worker logs, then retry.</span>
                        <button
                          className="link-button"
                          onClick={() => void retryShop(shop.id)}
                          disabled={retryingId === shop.id}
                        >
                          {retryingId === shop.id ? "Retrying..." : "Retry"}
                        </button>
                      </>
                    )}
                    {shop.status === "READY" && (
                      <Link className="link-button" href={`/shops/${shop.id}/storefront`} prefetch>Manage storefront</Link>
                    )}
                    <button className="link-button" onClick={() => setEditingId(shop.id)} disabled={isActive}>
                      Edit
                    </button>
                    <button className="link-button danger" onClick={() => void deleteShop(shop.id)} disabled={isActive}>
                      Delete
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
