import type { MetadataRoute } from "next";
import { allGuides, guidePath } from "@/lib/guides";
import { siteUrl } from "@/lib/site";

const PAGES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/plan", priority: 0.9, changeFrequency: "monthly" },
  { path: "/explore", priority: 0.8, changeFrequency: "weekly" },
  { path: "/discover", priority: 0.8, changeFrequency: "weekly" },
  { path: "/guides", priority: 0.9, changeFrequency: "weekly" },
  { path: "/signup", priority: 0.4, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/affiliate-disclosure", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages = PAGES.map((p) => ({ url: `${base}${p.path === "/" ? "" : p.path}`, changeFrequency: p.changeFrequency, priority: p.priority }));
  const guides = allGuides().map((g) => ({ url: `${base}${guidePath(g.slug, g.days)}`, changeFrequency: "monthly" as const, priority: 0.7 }));
  return [...pages, ...guides];
}
