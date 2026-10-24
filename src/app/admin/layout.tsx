import type { Metadata } from "next";
import "./admin.css";
import TruncationBanner from "@/components/admin/erp/TruncationBanner";

export const metadata: Metadata = {
  title: { default: "Alya Admin", template: "%s | Alya Admin" },
  robots: "noindex,nofollow",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="adm">{children}<TruncationBanner /></div>;
}
