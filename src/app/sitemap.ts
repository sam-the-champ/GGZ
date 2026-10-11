import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return ["", "/register", "/privacy", "/terms"].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" }));
}
