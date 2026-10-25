import type { Metadata } from "next";
import { notFound } from "next/navigation";
import UrunlerSayfasi from "@/components/yeni/UrunlerSayfasi";
import { UM } from "@/components/yeni/urunler-metin";
import { DILLER, HREFLANG, SITE_URL, isDil, kurumsalYolu } from "@/lib/diller";

export const revalidate = 300;
const LOCALE: Record<string, string> = { en: "en_US", ru: "ru_RU", zh: "zh_CN" };

export function generateStaticParams() {
  return DILLER.filter(d => d !== "tr").map(d => ({ lang: d }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") return { robots: { index: false } };
  const u = UM[lang];
  return {
    title: u.baslik, description: u.aciklama,
    alternates: { canonical: `${SITE_URL}${kurumsalYolu(lang, "urunler")}`, languages: Object.fromEntries(DILLER.map(d => [HREFLANG[d], `${SITE_URL}${kurumsalYolu(d, "urunler")}`])) },
    openGraph: { type: "website", locale: LOCALE[lang], url: `${SITE_URL}${kurumsalYolu(lang, "urunler")}`, siteName: "Alya Plastik", title: u.meta, description: u.aciklama, images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Alya Plastik" }] },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") notFound();
  return <UrunlerSayfasi dil={lang} />;
}
