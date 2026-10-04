// ProductSpec (P1): structured intake for landing | webapp | expo builds.
// Turns vague goals into a constrained, verifiable build contract.
import { z } from "zod";

export const ScreenSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(120),
  route: z.string().min(1).max(120),
  bullets: z.array(z.string().max(200)).max(12).default([])
});

export const DataModelSchema = z.object({
  name: z.string().min(1).max(64),
  fields: z.array(z.string().max(64)).max(24).default([])
});

export const ProductSpecSchema = z.object({
  productType: z.enum(["landing", "webapp", "expo"]),
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  tagline: z.string().max(160).default(""),
  features: z.array(z.string().min(2).max(160)).min(1).max(20),
  screens: z.array(ScreenSchema).min(1).max(12),
  dataModel: z.array(DataModelSchema).max(12).default([]),
  auth: z.enum(["none", "email", "oauth"]).default("none"),
  style: z.enum(["dark", "light", "minimal"]).default("dark"),
  constraints: z.array(z.string().max(200)).max(10).default([])
});

export type ProductSpec = z.infer<typeof ProductSpecSchema>;
export type Screen = z.infer<typeof ScreenSchema>;

function slugify(name: string): string {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || "my-product";
}

// Deterministic free-text -> spec fallback (offline, no model spend).
// Model-assisted refinement can replace/augment this later; contract stays identical.
export function specFromGoal(goal: string): ProductSpec {
  const g = goal.toLowerCase();
  const productType: ProductSpec["productType"] = /android|apk|expo/.test(g) ? "expo" : /webapp|web app|dashboard|saas/.test(g) ? "webapp" : "landing";
  const nameMatch = goal.match(/(?:for|called|named)\s+([A-Z][\w&' .-]{1,60})/);
  const name = (nameMatch?.[1] ?? (productType === "expo" ? "My Expo App" : productType === "webapp" ? "My Web App" : "My Landing Page")).trim().slice(0, 80);
  const auth: ProductSpec["auth"] = /oauth|google login|sso/.test(g) ? "oauth" : /login|sign in|auth|account/.test(g) ? "email" : "none";
  const features = goal.split(/[,.;\n]+/).map(s => s.trim()).filter(s => s.length > 4).slice(0, 8);
  const screens: Screen[] =
    productType === "landing"
      ? [{ key: "home", title: name, route: "/", bullets: (features.length ? features : ["Fast", "Free-tier friendly"]).slice(0, 6) }]
      : (features.length ? features : ["Home", "About"]).slice(0, 4).map((f, i) => ({
          key: i === 0 ? "home" : `screen-${i}`,
          title: f.slice(0, 60),
          route: i === 0 ? "/" : `/${f.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || `screen-${i}`}`,
          bullets: []
        }));
  return ProductSpecSchema.parse({
    productType,
    name,
    slug: slugify(name),
    tagline: goal.slice(0, 160),
    features: features.length ? features : ["Core experience"],
    screens,
    dataModel: [],
    auth,
    style: /light/.test(g) ? "light" : "dark",
    constraints: ["free-tier only", "npm run build must pass"]
  });
}
