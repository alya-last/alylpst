import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  // Sayfayı başka siteye gömmeyi, <base>/<object> enjeksiyonunu ve formun dış adrese gönderilmesini engeller (script/img kaynaklarını kısıtlamaz; siteyi bozmaz)
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
  async headers() {
    const kapali = [{ key: "Cache-Control", value: "no-store, max-age=0" }];
    return [
      // Giriş gerektiren sayfalar ve API yanıtları tarayıcı/ara önbelleklerde saklanmaz
      { source: "/admin/dashboard/:path*", headers: kapali },
      { source: "/api/:path*", headers: kapali },
      // Servis çalışanı her zaman güncel alınır
      { source: "/admin/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0" }, { key: "Service-Worker-Allowed", value: "/admin/" }] },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
