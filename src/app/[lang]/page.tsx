import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Anasayfa from "@/components/Anasayfa";
import { DILLER, HREFLANG, SITE_URL, isDil } from "@/lib/urun-sayfasi";
import { M, dilYolu } from "@/lib/site-metin";

export const revalidate = 60;
export const dynamicParams = false;   // yalnızca tanımlı diller; başka adresler 404

export function generateStaticParams() {
  return DILLER.filter(d => d !== "tr").map(d => ({ lang: d }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") return { robots: { index: false } };
  const m = M[lang];
  const languages: Record<string, string> = Object.fromEntries(DILLER.map(d => [HREFLANG[d], SITE_URL + (d === "tr" ? "" : dilYolu(d))]));
  languages["x-default"] = SITE_URL;
  return {
    title: { absolute: m.meta.baslik }, description: m.meta.aciklama,
    alternates: { canonical: `${SITE_URL}/${lang}`, languages },
    openGraph: { type: "website", locale: m.ogLocale, url: `${SITE_URL}/${lang}`, siteName: "Alya Plastik", title: m.meta.baslik, description: m.meta.ogAciklama, images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Alya Plastik" }] },
    twitter: { card: "summary_large_image", title: m.meta.baslik, description: m.meta.ogAciklama, images: ["/og-image.jpg"] },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") notFound();
  return <Anasayfa dil={lang} />;
}
