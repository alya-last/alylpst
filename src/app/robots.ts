import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const url = "https://alyatest-alyis.vercel.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/", "/admin/", "/kiosk"],
      },
      // AI crawler yönetimi (seo-technical skill kuralı)
      {
        userAgent: "GPTBot",
        allow: "/",
      },
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
      },
      {
        userAgent: "Claude-SearchBot",
        allow: "/",
      },
    ],
    sitemap: `${url}/sitemap.xml`,
    host: url,
  };
}
