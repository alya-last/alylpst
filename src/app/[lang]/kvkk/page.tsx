import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/supabase";
import { DILLER, HREFLANG, SITE_URL, isDil, kurumsalYolu, type Dil } from "@/lib/diller";
import { KVKK } from "@/lib/kurumsal-metin";
import KurumsalSayfa from "@/components/kurumsal/KurumsalSayfa";

export const revalidate = 3600;
const LOCALE: Record<string, string> = { en: "en_US", ru: "ru_RU", zh: "zh_CN" };

export function generateStaticParams() {
  return DILLER.filter(d => d !== "tr").map(d => ({ lang: d }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") return { robots: { index: false } };
  const t = KVKK[lang];
  const baslik = `${t.baslik} | Alya Plastik`;
  const languages = Object.fromEntries(DILLER.map(d => [HREFLANG[d], `${SITE_URL}${kurumsalYolu(d, "kvkk")}`]));
  return {
    title: t.baslik,
    alternates: { canonical: `${SITE_URL}${kurumsalYolu(lang, "kvkk")}`, languages },
    openGraph: { type: "website", locale: LOCALE[lang], url: `${SITE_URL}${kurumsalYolu(lang, "kvkk")}`, siteName: "Alya Plastik", title: baslik, images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Alya Plastik" }] },
    twitter: { card: "summary_large_image", title: baslik, images: ["/og-image.jpg"] },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isDil(lang) || lang === "tr") notFound();
  const dil = lang as Dil;

  let settings: Awaited<ReturnType<typeof getSettings>> = null;
  try { settings = await getSettings(); } catch (e) { console.error("Supabase fetch error:", e); }
  const sirket = settings?.company ?? "Alya Plastik San. Tic. Ltd. Şti.";
  const adres = settings?.address ?? "İkitelli OSB 4B Blok No:26-28 Kat:2, Başakşehir, İstanbul";
  const email = settings?.email ?? "info@alyaplastik.com";
  const telefon = settings?.phone ?? "+90 212 671 85 65";
  const t = KVKK[dil];
  const altDiller = Object.fromEntries(DILLER.map(d => [d, kurumsalYolu(d, "kvkk")]));

  return (
    <KurumsalSayfa settings={settings} dil={dil} altDiller={altDiller} etiket={t.etiket} baslik={t.baslik}>
      <p>{t.intro(sirket)}</p>

      <h2 className="font-semibold text-[#0b0e0b] text-lg mt-2">{t.s1Baslik}</h2>
      <p>
        {sirket}<br />
        {t.adresEtiket}: {adres}<br />
        {t.epostaEtiket}: {email}<br />
        {t.telefonEtiket}: {telefon}
      </p>

      <h2 className="font-semibold text-[#0b0e0b] text-lg mt-2">{t.s2Baslik}</h2>
      <p>{t.s2}</p>

      <h2 className="font-semibold text-[#0b0e0b] text-lg mt-2">{t.s3Baslik}</h2>
      <p>{t.s3}</p>

      <h2 className="font-semibold text-[#0b0e0b] text-lg mt-2">{t.s4Baslik}</h2>
      <p>{t.s4}</p>

      <h2 className="font-semibold text-[#0b0e0b] text-lg mt-2">{t.s5Baslik}</h2>
      <p>{t.s5}</p>

      <h2 className="font-semibold text-[#0b0e0b] text-lg mt-2">{t.s6Baslik}</h2>
      <p>{t.s6}</p>

      <h2 className="font-semibold text-[#0b0e0b] text-lg mt-2">{t.s7Baslik}</h2>
      <p>{t.s7Giris}</p>
      <ul className="list-disc list-inside flex flex-col gap-1">
        {t.haklar.map(h => <li key={h}>{h}</li>)}
      </ul>
      {t.s7Sonu && <p>{t.s7Sonu}</p>}

      <h2 className="font-semibold text-[#0b0e0b] text-lg mt-2">{t.s8Baslik}</h2>
      <p>
        {t.s8On}<a href={`mailto:${email}`} className="underline hover:text-[#0b0e0b]">{email}</a>{t.s8Son}
      </p>

      <p className="text-sm text-[#6b7366] mt-4">{t.not_}</p>
    </KurumsalSayfa>
  );
}
