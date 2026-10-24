import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Personel Giriş-Çıkış", robots: "noindex,nofollow" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", background: "#0b0e0b", color: "#eae6dd" }}>{children}</div>;
}
