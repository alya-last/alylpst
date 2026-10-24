import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/supabase";
import { DILLER, HREFLANG, SITE_URL, isDil, kurumsalYolu, type Dil } from "@/lib/diller";
import { URETIM } from "@/lib/kurumsal-metin";
import KurumsalSayfa from "@/components/kurumsal/KurumsalSayfa";

export const revalidate = 3600;
const LOCALE: Record<string, string> = { en: "en_US", ru: "ru_RU", zh: "zh_CN" };

export function generateStaticParams() {
  return DILLER.filter(d => d !== "tr").map(d => ({ lang: d }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") return { robots: { index: false } };
  const t = URETIM[lang];
  const baslik = `${t.etiket.replace("— ", "")} | Alya Plastik`;
  const languages = Object.fromEntries(DILLER.map(d => [HREFLANG[d], `${SITE_URL}${kurumsalYolu(d, "uretim-sureci")}`]));
  return {
    title: t.etiket.replace("— ", ""),
    alternates: { canonical: `${SITE_URL}${kurumsalYolu(lang, "uretim-sureci")}`, languages },
    openGraph: { type: "website", locale: LOCALE[lang], url: `${SITE_URL}${kurumsalYolu(lang, "uretim-sureci")}`, siteName: "Alya Plastik", title: baslik, images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Alya Plastik" }] },
    twitter: { card: "summary_large_image", title: baslik, images: ["/og-image.jpg"] },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") notFound();
  const dil = lang as Dil;

  let settings: Awaited<ReturnType<typeof getSettings>> = null;
  try { settings = await getSettings(); } catch (e) { console.error("Supabase fetch error:", e); }
  const t = URETIM[dil];
  const altDiller = Object.fromEntries(DILLER.map(d => [d, kurumsalYolu(d, "uretim-sureci")]));
  const contactHref = `/${dil}#contact`;

  return (
    <KurumsalSayfa settings={settings} dil={dil} altDiller={altDiller} etiket={t.etiket} baslik={t.baslik}>
      <p>{t.giris}</p>
      <ol className="flex flex-col gap-4 mt-2">
        {t.adimlar.map((s, i) => (
          <li key={s.b} className="flex gap-4 pb-4 border-b border-[#0b0e0b]/10">
            <span className="eyebrow text-[#e55f28] shrink-0" style={{ fontSize: 13 }}>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className="font-semibold text-[#0b0e0b] text-sm mb-1">{s.b}</p>
              <p className="text-sm text-[#6b7366] leading-relaxed">{s.a}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-sm text-[#6b7366]">
        {t.iletisimOn}<Link href={contactHref} className="underline hover:text-[#0b0e0b]">{t.iletisimLink}</Link>{t.iletisimSon}
      </p>
    </KurumsalSayfa>
  );
}
