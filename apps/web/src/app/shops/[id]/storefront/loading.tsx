export default function StorefrontLoading() {
  return (
    <main className="storefront-editor route-loading" aria-live="polite" aria-busy="true">
      <span className="loading-indicator" aria-hidden="true" />
      <p className="eyebrow">Storefront editor</p>
      <h1>Opening your shop...</h1>
      <p className="muted">Loading your saved storefront content.</p>
    </main>
  );
}
