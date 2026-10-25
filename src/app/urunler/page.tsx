import type { Metadata } from "next";
import UrunlerSayfasi from "@/components/yeni/UrunlerSayfasi";
import { UM } from "@/components/yeni/urunler-metin";
import { DILLER, HREFLANG, SITE_URL, kurumsalYolu } from "@/lib/diller";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Ürünler",
  description: UM.tr.aciklama,
  alternates: { canonical: `${SITE_URL}/urunler`, languages: Object.fromEntries(DILLER.map(d => [HREFLANG[d], `${SITE_URL}${kurumsalYolu(d, "urunler")}`])) },
  openGraph: { type: "website", locale: "tr_TR", url: `${SITE_URL}/urunler`, siteName: "Alya Plastik", title: UM.tr.meta, description: UM.tr.aciklama, images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Alya Plastik" }] },
};

export default function Page() { return <UrunlerSayfasi dil="tr" />; }
