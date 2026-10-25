import type { Metadata } from "next";
import YCerceve from "@/components/yeni/YCerceve";
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
    <YCerceve settings={settings} dil={"tr"} altDiller={altDiller}>
      <main>
        <section className="bg-[#f5f5f2]" style={{ paddingBlock: "clamp(32px,5vw,64px)" }}>
          <div className="yt-wrap">
            <p className="text-[13px] tracking-[0.2em] text-[var(--yt-accent)] font-semibold mb-3">{t.etiket.toUpperCase()}</p>
            <h1 className="font-semibold tracking-[-0.025em] leading-[1.05]" style={{ fontSize: "clamp(32px,5vw,60px)" }}>{t.baslik}</h1>
          </div>
        </section>
        <section className="bg-white" style={{ paddingBlock: "clamp(24px,4vw,56px)" }}>
          <div className="yt-wrap">
            {katalog?.url ? (
              <div className="rounded-3xl overflow-hidden bg-[#0b0e0b]">
                <KatalogGoruntuleyici pdfUrl={katalog.url} dil="tr" />
              </div>
            ) : (
              <p className="text-black/60" style={{ maxWidth: "60ch" }}>{t.hazirlaniyor}</p>
            )}
          </div>
        </section>
      </main>
    </YCerceve>
  );
}
