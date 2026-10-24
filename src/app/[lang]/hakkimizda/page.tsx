import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings, getStats } from "@/lib/supabase";
import { DILLER, HREFLANG, SITE_URL, isDil, kurumsalYolu, type Dil } from "@/lib/diller";
import { HAKKIMIZDA } from "@/lib/kurumsal-metin";
import KurumsalSayfa from "@/components/kurumsal/KurumsalSayfa";

export const revalidate = 3600;
const LOCALE: Record<string, string> = { en: "en_US", ru: "ru_RU", zh: "zh_CN" };

export function generateStaticParams() {
  return DILLER.filter(d => d !== "tr").map(d => ({ lang: d }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") return { robots: { index: false } };
  const t = HAKKIMIZDA[lang];
  const baslik = `${t.etiket.replace("— ", "")} | Alya Plastik`;
  const languages = Object.fromEntries(DILLER.map(d => [HREFLANG[d], `${SITE_URL}${kurumsalYolu(d, "hakkimizda")}`]));
  return {
    title: t.etiket.replace("— ", ""),
    alternates: { canonical: `${SITE_URL}${kurumsalYolu(lang, "hakkimizda")}`, languages },
    openGraph: { type: "website", locale: LOCALE[lang], url: `${SITE_URL}${kurumsalYolu(lang, "hakkimizda")}`, siteName: "Alya Plastik", title: baslik, images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Alya Plastik" }] },
    twitter: { card: "summary_large_image", title: baslik, images: ["/og-image.jpg"] },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") notFound();
  const dil = lang as Dil;

  let settings: Awaited<ReturnType<typeof getSettings>> = null;
  let stats: Awaited<ReturnType<typeof getStats>> = null;
  try { [settings, stats] = await Promise.all([getSettings(), getStats()]); } catch (e) { console.error("Supabase fetch error:", e); }

  const kurulus = settings?.founded ?? 1968;
  const yil = stats?.years ?? new Date().getFullYear() - kurulus;
  const model = stats?.models ?? 200;
  const ulke = stats?.countries ?? 20;
  const adres = settings?.address ?? "İkitelli OSB 4B Blok No:26-28 Kat:2, Başakşehir, İstanbul";
  const t = HAKKIMIZDA[dil];
  const altDiller = Object.fromEntries(DILLER.map(d => [d, kurumsalYolu(d, "hakkimizda")]));
  const contactHref = dil === "tr" ? "/#contact" : `/${dil}#contact`;

  return (
    <KurumsalSayfa settings={settings} dil={dil} altDiller={altDiller} etiket={t.etiket} baslik={t.baslik}>
      <p>{t.p1(kurulus, model)}</p>
      <p>{t.p2(adres, ulke)}</p>
      <p>{t.p3(yil)}</p>
      <p className="text-sm text-[#6b7366]">
        {t.iletisimOn}<Link href={contactHref} className="underline hover:text-[#0b0e0b]">{t.iletisimLink}</Link>.
      </p>
    </KurumsalSayfa>
  );
}
