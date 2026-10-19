"use client";

import { FormEvent, useState } from "react";

export default function Home() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, ...(mode === "register" ? { name } : {}) }),
    });
    if (response.ok) { window.location.href = "/shops"; return; }
    const body = (await response.json()) as { error?: string };
    setError(body.error ?? "Something went wrong");
    setBusy(false);
  }

  return (
    <main>
      <section className="auth-panel">
        <p className="eyebrow">OneShopPlatform</p>
        <h1>{mode === "login" ? "Sign in" : "Create account"}</h1>
        <form className="form" onSubmit={submit}>
          {mode === "register" && <label>Name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>}
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 8 : 1} required /></label>
          {error && <p className="error">{error}</p>}
          <button className="button" type="submit" disabled={busy}>{busy ? "Working..." : mode === "login" ? "Sign in" : "Create account"}</button>
          <button className="link-button" type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Create an account" : "Already have an account? Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}