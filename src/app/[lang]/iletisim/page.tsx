import type { Metadata } from "next";
import { notFound } from "next/navigation";
import IletisimSayfasi from "@/components/yeni/IletisimSayfasi";
import { IM } from "@/components/yeni/urunler-metin";
import { DILLER, HREFLANG, SITE_URL, isDil, kurumsalYolu } from "@/lib/diller";

export const revalidate = 3600;
const LOCALE: Record<string, string> = { en: "en_US", ru: "ru_RU", zh: "zh_CN" };

export function generateStaticParams() {
  return DILLER.filter(d => d !== "tr").map(d => ({ lang: d }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") return { robots: { index: false } };
  const t = IM[lang];
  return {
    title: t.baslik, description: t.aciklama,
    alternates: { canonical: `${SITE_URL}${kurumsalYolu(lang, "iletisim")}`, languages: Object.fromEntries(DILLER.map(d => [HREFLANG[d], `${SITE_URL}${kurumsalYolu(d, "iletisim")}`])) },
    openGraph: { type: "website", locale: LOCALE[lang], url: `${SITE_URL}${kurumsalYolu(lang, "iletisim")}`, siteName: "Alya Plastik", title: `${t.baslik} | Alya Plastik`, description: t.aciklama, images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Alya Plastik" }] },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") notFound();
  return <IletisimSayfasi dil={lang} />;
}
