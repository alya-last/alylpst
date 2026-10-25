import type { Metadata } from "next";
import IletisimSayfasi from "@/components/yeni/IletisimSayfasi";
import { IM } from "@/components/yeni/urunler-metin";
import { DILLER, HREFLANG, SITE_URL, kurumsalYolu } from "@/lib/diller";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: IM.tr.baslik,
  description: IM.tr.aciklama,
  alternates: { canonical: `${SITE_URL}/iletisim`, languages: Object.fromEntries(DILLER.map(d => [HREFLANG[d], `${SITE_URL}${kurumsalYolu(d, "iletisim")}`])) },
  openGraph: { type: "website", locale: "tr_TR", url: `${SITE_URL}/iletisim`, siteName: "Alya Plastik", title: `${IM.tr.baslik} | Alya Plastik`, description: IM.tr.aciklama, images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Alya Plastik" }] },
};

export default function Page() { return <IletisimSayfasi dil="tr" />; }
