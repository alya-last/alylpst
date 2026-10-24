import type { Metadata } from "next";
import Link from "next/link";
import { getSettings, getStats } from "@/lib/supabase";
import { DILLER, HREFLANG, SITE_URL, kurumsalYolu } from "@/lib/diller";
import { HAKKIMIZDA } from "@/lib/kurumsal-metin";
import KurumsalSayfa from "@/components/kurumsal/KurumsalSayfa";

export const revalidate = 3600;

const BASLIK = "Hakkımızda | Alya Plastik"; // OG/Twitter'da olduğu gibi kullanılır (şablon uygulanmaz)
const ACIKLAMA = "1968'den bu yana İstanbul'da plastik saksı, sepet, sandık ve ev ürünleri üreten Alya Plastik hakkında.";

export const metadata: Metadata = {
  // Kök layout'un title template'i ("%s | Alya Plastik") otomatik ekleneceği için burada marka adı TEKRAR eklenmez.
  title: "Hakkımızda",
  description: ACIKLAMA,
  alternates: { canonical: `${SITE_URL}/hakkimizda`, languages: Object.fromEntries(DILLER.map(d => [HREFLANG[d], `${SITE_URL}${kurumsalYolu(d, "hakkimizda")}`])) },
  openGraph: { type: "website", locale: "tr_TR", url: `${SITE_URL}/hakkimizda`, siteName: "Alya Plastik", title: BASLIK, description: ACIKLAMA, images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Alya Plastik" }] },
  twitter: { card: "summary_large_image", title: BASLIK, description: ACIKLAMA, images: ["/og-image.jpg"] },
};

export default async function HakkimizdaPage() {
  let settings: Awaited<ReturnType<typeof getSettings>> = null;
  let stats: Awaited<ReturnType<typeof getStats>> = null;
  try { [settings, stats] = await Promise.all([getSettings(), getStats()]); } catch (e) { console.error("Supabase fetch error:", e); }

  const kurulus = settings?.founded ?? 1968;
  const yil = stats?.years ?? new Date().getFullYear() - kurulus;
  const model = stats?.models ?? 200;
  const ulke = stats?.countries ?? 20;
  const adres = settings?.address ?? "İkitelli OSB 4B Blok No:26-28 Kat:2, Başakşehir, İstanbul";
  const t = HAKKIMIZDA.tr;
  const altDiller = Object.fromEntries(DILLER.map(d => [d, kurumsalYolu(d, "hakkimizda")]));

  return (
    <KurumsalSayfa settings={settings} altDiller={altDiller} etiket={t.etiket} baslik={t.baslik}>
      <p>{t.p1(kurulus, model)}</p>
      <p>{t.p2(adres, ulke)}</p>
      <p>{t.p3(yil)}</p>
      <p className="text-sm text-[#6b7366]">
        {t.iletisimOn}<Link href="/#contact" className="underline hover:text-[#0b0e0b]">{t.iletisimLink}</Link>.
      </p>
    </KurumsalSayfa>
  );
}
