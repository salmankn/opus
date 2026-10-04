"use client";
import { useState } from "react";

type Result = {
  taskId: string;
  summary: string;
  buildMs: number;
  artifacts: { key: string; url: string }[];
  deploy: { download: string; vercel: string | null; eas: string | null } | null;
  events: string[];
};

export function ProductBuilder() {
  const [productType, setProductType] = useState("landing");
  const [name, setName] = useState("");
  const [features, setFeatures] = useState("");
  const [auth, setAuth] = useState("none");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    const featList = features.split("\n").map((s) => s.trim()).filter(Boolean);
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "my-product";
    const spec = {
      productType,
      name: name || "My Product",
      slug,
      tagline: featList[0] ?? "",
      features: featList.length ? featList : ["Core experience"],
      screens: productType === "landing"
        ? [{ key: "home", title: name || "My Product", route: "/", bullets: featList.slice(0, 6) }]
        : (featList.length ? featList : ["Home"]).slice(0, 4).map((f, i) => ({
            key: i === 0 ? "home" : `screen-${i}`,
            title: f.slice(0, 60),
            route: i === 0 ? "/" : `/${f.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || `screen-${i}`}`,
            bullets: []
          })),
      dataModel: [],
      auth,
      style: "dark",
      constraints: ["free-tier only", "npm run build must pass"]
    };
    const res = await fetch("/api/builds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) setError(data.error ?? "Build failed");
    else setResult(data);
  }

  return (
    <div style={{ border: "1px solid #2a2f3d", borderRadius: 12, padding: 16, marginTop: 24 }}>
      <h2>Build a product</h2>
      <p style={{ opacity: 0.7 }}>Landing, web app (Next.js), or Android (Expo). Build must pass before delivery.</p>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <label>Type <select value={productType} onChange={(e) => setProductType(e.target.value)}>
          <option value="landing">Landing page</option>
          <option value="webapp">Web app</option>
          <option value="expo">Android (Expo)</option>
        </select></label>
        <label>Name <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme CRM" style={{ width: "100%" }} /></label>
        <label>Features (one per line) <textarea rows={4} value={features} onChange={(e) => setFeatures(e.target.value)} placeholder={"Fast onboarding\nFair pricing"} style={{ width: "100%" }} /></label>
        <label>Auth <select value={auth} onChange={(e) => setAuth(e.target.value)}>
          <option value="none">None</option>
          <option value="email">Email</option>
          <option value="oauth">OAuth</option>
        </select></label>
        <button onClick={submit} disabled={busy || !name.trim()}>{busy ? "Building… (install + build can take minutes)" : "Build product"}</button>
      </div>
      {error && <p role="alert">Failed: {error}</p>}
      {result && (
        <div style={{ marginTop: 16 }}>
          <p role="status">{result.summary}</p>
          <p style={{ fontSize: 12, opacity: 0.7 }}>Pipeline: {result.events.join(" → ")}</p>
          <ul>
            {result.artifacts.filter((a) => a.key.endsWith(".zip") || a.key.endsWith("product.json")).map((a) => (
              <li key={a.key}><a href={a.url}>{a.key.split("/").pop()}</a></li>
            ))}
          </ul>
          {result.deploy?.vercel && <p>Deploy: {result.deploy.vercel}</p>}
          {result.deploy?.eas && <p>APK: {result.deploy.eas}</p>}
        </div>
      )}
    </div>
  );
}
