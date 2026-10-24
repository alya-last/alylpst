import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/supabase";
import { DILLER, HREFLANG, SITE_URL, isDil, kurumsalYolu, type Dil } from "@/lib/diller";
import { SERTIFIKA } from "@/lib/kurumsal-metin";
import KurumsalSayfa from "@/components/kurumsal/KurumsalSayfa";

export const revalidate = 3600;
const LOCALE: Record<string, string> = { en: "en_US", ru: "ru_RU", zh: "zh_CN" };

export function generateStaticParams() {
  return DILLER.filter(d => d !== "tr").map(d => ({ lang: d }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") return { robots: { index: false } };
  const t = SERTIFIKA[lang];
  const baslik = `${t.etiket.replace("— ", "")} | Alya Plastik`;
  const languages = Object.fromEntries(DILLER.map(d => [HREFLANG[d], `${SITE_URL}${kurumsalYolu(d, "sertifikalar")}`]));
  return {
    title: t.etiket.replace("— ", ""),
    alternates: { canonical: `${SITE_URL}${kurumsalYolu(lang, "sertifikalar")}`, languages },
    openGraph: { type: "website", locale: LOCALE[lang], url: `${SITE_URL}${kurumsalYolu(lang, "sertifikalar")}`, siteName: "Alya Plastik", title: baslik, images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Alya Plastik" }] },
    twitter: { card: "summary_large_image", title: baslik, images: ["/og-image.jpg"] },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") notFound();
  const dil = lang as Dil;

  let settings: Awaited<ReturnType<typeof getSettings>> = null;
  try { settings = await getSettings(); } catch (e) { console.error("Supabase fetch error:", e); }
  const email = settings?.email ?? "info@alyaplastik.com";
  const t = SERTIFIKA[dil];
  const altDiller = Object.fromEntries(DILLER.map(d => [d, kurumsalYolu(d, "sertifikalar")]));

  return (
    <KurumsalSayfa settings={settings} dil={dil} altDiller={altDiller} etiket={t.etiket} baslik={t.baslik}>
      <p>{t.p1}</p>
      <p>
        {t.p2On}<a href={`mailto:${email}`} className="underline hover:text-[#0b0e0b]">{email}</a>{t.p2Son}
      </p>
    </KurumsalSayfa>
  );
}
