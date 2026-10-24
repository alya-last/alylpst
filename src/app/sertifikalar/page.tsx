import type { Metadata } from "next";
import { getSettings } from "@/lib/supabase";
import { DILLER, HREFLANG, SITE_URL, kurumsalYolu } from "@/lib/diller";
import { SERTIFIKA } from "@/lib/kurumsal-metin";
import KurumsalSayfa from "@/components/kurumsal/KurumsalSayfa";

export const revalidate = 3600;

const BASLIK = "Sertifikalar | Alya Plastik"; // OG/Twitter'da olduğu gibi kullanılır (şablon uygulanmaz)
const ACIKLAMA = "Alya Plastik kalite ve uygunluk sertifikaları.";

export const metadata: Metadata = {
  // Kök layout'un title template'i ("%s | Alya Plastik") otomatik ekleneceği için burada marka adı TEKRAR eklenmez.
  title: "Sertifikalar",
  description: ACIKLAMA,
  alternates: { canonical: `${SITE_URL}/sertifikalar`, languages: Object.fromEntries(DILLER.map(d => [HREFLANG[d], `${SITE_URL}${kurumsalYolu(d, "sertifikalar")}`])) },
  openGraph: { type: "website", locale: "tr_TR", url: `${SITE_URL}/sertifikalar`, siteName: "Alya Plastik", title: BASLIK, description: ACIKLAMA, images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Alya Plastik" }] },
  twitter: { card: "summary_large_image", title: BASLIK, description: ACIKLAMA, images: ["/og-image.jpg"] },
};

export default async function SertifikalarPage() {
  let settings: Awaited<ReturnType<typeof getSettings>> = null;
  try { settings = await getSettings(); } catch (e) { console.error("Supabase fetch error:", e); }
  const email = settings?.email ?? "info@alyaplastik.com";
  const t = SERTIFIKA.tr;
  const altDiller = Object.fromEntries(DILLER.map(d => [d, kurumsalYolu(d, "sertifikalar")]));

  return (
    <KurumsalSayfa settings={settings} altDiller={altDiller} etiket={t.etiket} baslik={t.baslik}>
      <p>{t.p1}</p>
      <p>
        {t.p2On}<a href={`mailto:${email}`} className="underline hover:text-[#0b0e0b]">{email}</a>{t.p2Son}
      </p>
    </KurumsalSayfa>
  );
}
