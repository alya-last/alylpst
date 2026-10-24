import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getKatalog, getSettings } from "@/lib/supabase";
import { DILLER, HREFLANG, SITE_URL, isDil, kurumsalYolu, type Dil } from "@/lib/diller";
import { KATALOG } from "@/lib/kurumsal-metin";
import KatalogGoruntuleyici from "@/components/katalog/KatalogGoruntuleyici";

export const revalidate = 300;
const LOCALE: Record<string, string> = { en: "en_US", ru: "ru_RU", zh: "zh_CN" };

export function generateStaticParams() {
  return DILLER.filter(d => d !== "tr").map(d => ({ lang: d }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") return { robots: { index: false } };
  const t = KATALOG[lang];
  const baslik = `${t.baslik} | Alya Plastik`;
  const languages = Object.fromEntries(DILLER.map(d => [HREFLANG[d], `${SITE_URL}${kurumsalYolu(d, "katalog")}`]));
  return {
    title: t.baslik, description: t.aciklama,
    alternates: { canonical: `${SITE_URL}${kurumsalYolu(lang, "katalog")}`, languages },
    openGraph: { type: "website", locale: LOCALE[lang], url: `${SITE_URL}${kurumsalYolu(lang, "katalog")}`, siteName: "Alya Plastik", title: baslik, description: t.aciklama, images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Alya Plastik" }] },
    twitter: { card: "summary_large_image", title: baslik, description: t.aciklama, images: ["/og-image.jpg"] },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") notFound();
  const dil = lang as Dil;

  let settings: Awaited<ReturnType<typeof getSettings>> = null;
  let katalog: Awaited<ReturnType<typeof getKatalog>> = null;
  try { [settings, katalog] = await Promise.all([getSettings(), getKatalog()]); } catch (e) { console.error("Supabase fetch error:", e); }
  const t = KATALOG[dil];
  const altDiller = Object.fromEntries(DILLER.map(d => [d, kurumsalYolu(d, "katalog")]));

  return (
    <div lang={HREFLANG[dil]}>
      <Header settings={settings} dil={dil} altDiller={altDiller} />
      <main className="bg-[#0b0e0b] min-h-svh pt-[84px]">
        <div style={{ paddingInline: "clamp(20px,5vw,80px)", paddingBlock: "clamp(32px,5vw,56px)" }}>
          <p className="eyebrow text-[#e55f28] mb-3">— {t.etiket}</p>
          <h1 className="heading text-[#eae6dd] mb-8" style={{ fontSize: "clamp(32px,5vw,56px)", lineHeight: 0.98 }}>{t.baslik}</h1>
        </div>
        {katalog?.url ? (
          <KatalogGoruntuleyici pdfUrl={katalog.url} dil={dil} />
        ) : (
          <div style={{ paddingInline: "clamp(20px,5vw,80px)", paddingBottom: 96 }}>
            <p className="text-[#9aa294]" style={{ maxWidth: "60ch" }}>{t.hazirlaniyor}</p>
          </div>
        )}
      </main>
      <Footer settings={settings} dil={dil} />
    </div>
  );
}
