import type { Metadata } from "next";
import "./globals.css";
import VisitTracker from "@/components/VisitTracker";

const SITE_URL = "https://alyatest-alyis.vercel.app";
const SITE_NAME = "Alya Plastik";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  // ── Title ─────────────────────────────────────────────
  title: {
    default: "Alya Plastik | Plastik Saksı, Sepet & Depolama Üreticisi — 1968",
    template: "%s | Alya Plastik",
  },

  // ── Description ───────────────────────────────────────
  description:
    "1968'den bu yana İstanbul OSB'de plastik üretim. Saksı, sepet, sandık, banyo ürünleri. 200+ model, 20+ ülke ihracat. B2B toplu sipariş.",

  // ── Authors / Publisher ───────────────────────────────
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,

  // ── Robots ────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ── Canonical ─────────────────────────────────────────
  alternates: {
    canonical: SITE_URL,
    languages: {
      "tr-TR": SITE_URL,
      en: `${SITE_URL}/en`,
      ru: `${SITE_URL}/ru`,
      "zh-Hans": `${SITE_URL}/zh`,
      "x-default": SITE_URL,
    },
  },

  // ── Open Graph ────────────────────────────────────────
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Alya Plastik | Plastik Saksı, Sepet & Depolama Üreticisi — 1968",
    description:
      "1968'den bu yana İstanbul OSB'de plastik ürün üretimi. Saksı, sepet, sandık, banyo ve bahçe ürünleri. 200+ model, 20+ ülke ihracat.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Alya Plastik — Plastik Ürün Üreticisi",
        type: "image/jpeg",
      },
    ],
  },

  // ── Twitter / X ───────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    title: "Alya Plastik | Plastik Saksı & Sepet Üreticisi",
    description:
      "1968'den bu yana İstanbul OSB'de plastik ürün üretimi. 200+ model, 20+ ülke ihracat.",
    images: ["/og-image.jpg"],
  },

  // ── Verification ──────────────────────────────────────
  // Google Search Console doğrulama kodu buraya eklenecek
  // verification: { google: "xxx" },

  // ── Icons ─────────────────────────────────────────────
  // Not: "/icon.svg" burada bilerek KALDIRILDI — public/icon.svg gerçek marka
  // logosundan (koyu lacivert + turuncu iki dağ) farklı, eski/placeholder tek
  // renkli bir üçgendi ve tarayıcılar SVG favicon'u ico'ya tercih ettiği için
  // yanlış ikon görünüyordu. favicon.ico ve apple-touch-icon.png (src/app/icon.png
  // ve apple-icon.png'den — asıl logo) doğru ikonu taşıyor.
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    apple: "/apple-touch-icon.png",
  },

  // ── App ───────────────────────────────────────────────
  applicationName: SITE_NAME,
  category: "manufacturing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        {/* Preconnect — Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Preconnect — Supabase */}
        <link rel="preconnect" href="https://cwhxrusysuumndijapeb.supabase.co" />
        {/* Cloudinary */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
      </head>
      <body>
        <VisitTracker />
        {children}
      </body>
    </html>
  );
}
