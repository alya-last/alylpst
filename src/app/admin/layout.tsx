import type { Metadata } from "next";
import "./admin.css";
import TruncationBanner from "@/components/admin/erp/TruncationBanner";

export const metadata: Metadata = {
  title: { default: "Alya Admin", template: "%s | Alya Admin" },
  robots: "noindex,nofollow",
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Alya Admin", statusBarStyle: "black-translucent" },
  icons: { apple: "/admin/ikon-192.png" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="adm">{children}<TruncationBanner /></div>;
}
