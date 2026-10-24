import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/supabase";
import { DILLER, HREFLANG, SITE_URL, kurumsalYolu } from "@/lib/diller";
import { URETIM } from "@/lib/kurumsal-metin";
import KurumsalSayfa from "@/components/kurumsal/KurumsalSayfa";

export const revalidate = 3600;

const BASLIK = "Üretim Süreci | Alya Plastik"; // OG/Twitter'da olduğu gibi kullanılır (şablon uygulanmaz)
const ACIKLAMA = "Alya Plastik'te kalıp tasarımından sevkiyata kadar plastik enjeksiyon üretim sürecimiz.";

export const metadata: Metadata = {
  // Kök layout'un title template'i ("%s | Alya Plastik") otomatik ekleneceği için burada marka adı TEKRAR eklenmez.
  title: "Üretim Süreci",
  description: ACIKLAMA,
  alternates: { canonical: `${SITE_URL}/uretim-sureci`, languages: Object.fromEntries(DILLER.map(d => [HREFLANG[d], `${SITE_URL}${kurumsalYolu(d, "uretim-sureci")}`])) },
  openGraph: { type: "website", locale: "tr_TR", url: `${SITE_URL}/uretim-sureci`, siteName: "Alya Plastik", title: BASLIK, description: ACIKLAMA, images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Alya Plastik" }] },
  twitter: { card: "summary_large_image", title: BASLIK, description: ACIKLAMA, images: ["/og-image.jpg"] },
};

export default async function UretimSureciPage() {
  let settings: Awaited<ReturnType<typeof getSettings>> = null;
  try { settings = await getSettings(); } catch (e) { console.error("Supabase fetch error:", e); }
  const t = URETIM.tr;
  const altDiller = Object.fromEntries(DILLER.map(d => [d, kurumsalYolu(d, "uretim-sureci")]));

  return (
    <KurumsalSayfa settings={settings} altDiller={altDiller} etiket={t.etiket} baslik={t.baslik}>
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
        {t.iletisimOn}<Link href="/#contact" className="underline hover:text-[#0b0e0b]">{t.iletisimLink}</Link>{t.iletisimSon}
      </p>
    </KurumsalSayfa>
  );
}
