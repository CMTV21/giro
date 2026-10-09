import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Personal and transactional pages stay out of search results; marketing pages are open.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/go", "/account", "/admin/", "/trip/", "/trips", "/shared", "/join/", "/reset/", "/verify/", "/forgot"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
