import { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/_next/",
      allow: "/",
    },
    sitemap: "https://example.com/sitemap.xml",
  }
}
