import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getKatalog, getSettings } from "@/lib/supabase";
import { DILLER, HREFLANG, SITE_URL, kurumsalYolu } from "@/lib/diller";
import { KATALOG } from "@/lib/kurumsal-metin";
import KatalogGoruntuleyici from "@/components/katalog/KatalogGoruntuleyici";

export const revalidate = 300;

const t = KATALOG.tr;
const BASLIK = `${t.baslik} | Alya Plastik`;

export const metadata: Metadata = {
  title: t.baslik,
  description: t.aciklama,
  alternates: { canonical: `${SITE_URL}/katalog`, languages: Object.fromEntries(DILLER.map(d => [HREFLANG[d], `${SITE_URL}${kurumsalYolu(d, "katalog")}`])) },
  openGraph: { type: "website", locale: "tr_TR", url: `${SITE_URL}/katalog`, siteName: "Alya Plastik", title: BASLIK, description: t.aciklama, images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Alya Plastik" }] },
  twitter: { card: "summary_large_image", title: BASLIK, description: t.aciklama, images: ["/og-image.jpg"] },
};

// Dijital katalog (PDF flipbook) — admin panelde (Katalog) yüklenen PDF anında burada görünür.
export default async function KatalogPage() {
  let settings: Awaited<ReturnType<typeof getSettings>> = null;
  let katalog: Awaited<ReturnType<typeof getKatalog>> = null;
  try { [settings, katalog] = await Promise.all([getSettings(), getKatalog()]); } catch (e) { console.error("Supabase fetch error:", e); }
  const altDiller = Object.fromEntries(DILLER.map(d => [d, kurumsalYolu(d, "katalog")]));

  return (
    <div lang="tr">
      <Header settings={settings} dil="tr" altDiller={altDiller} />
      <main className="bg-[#0b0e0b] min-h-svh pt-[84px]">
        <div style={{ paddingInline: "clamp(20px,5vw,80px)", paddingBlock: "clamp(32px,5vw,56px)" }}>
          <p className="eyebrow text-[#e55f28] mb-3">— {t.etiket}</p>
          <h1 className="heading text-[#eae6dd] mb-8" style={{ fontSize: "clamp(32px,5vw,56px)", lineHeight: 0.98 }}>{t.baslik}</h1>
        </div>
        {katalog?.url ? (
          <KatalogGoruntuleyici pdfUrl={katalog.url} dil="tr" />
        ) : (
          <div style={{ paddingInline: "clamp(20px,5vw,80px)", paddingBottom: 96 }}>
            <p className="text-[#9aa294]" style={{ maxWidth: "60ch" }}>{t.hazirlaniyor}</p>
          </div>
        )}
      </main>
      <Footer settings={settings} dil="tr" />
    </div>
  );
}
