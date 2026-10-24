import type { Metadata } from "next";
import { notFound } from "next/navigation";
import UrunSayfasi from "@/components/urun/UrunSayfasi";
import { getSettings } from "@/lib/supabase";
import { DILLER, getKategoriAdlari, HREFLANG, SITE_URL, ad, aciklama, getBenzer, getTumUrunler, getUrun, isDil, kisalt, urunUrl, type Dil } from "@/lib/urun-sayfasi";

export const revalidate = 300;
const LOCALE: Record<string, string> = { en: "en_US", ru: "ru_RU", zh: "zh_CN" };

// Her ürün için tüm diller üretilir — çevirisi olmayanlar Türkçe açıklamayla yayınlanır (bkz.
// aciklama()); dil değiştirici bu sayede ürün sayfasında kalabiliyor, Türkçe'ye fırlatılmıyor.
// (Önceden yalnızca çevirisi girilmiş ürünler için sayfa üretiliyordu — bu, çevirisiz ürünlerde
// dil değiştirmeyi Türkçe'ye geri dönmüş gibi gösteren asıl sorundu.)
export async function generateStaticParams() {
  try {
    const urunler = await getTumUrunler();
    return DILLER.filter(d => d !== "tr").flatMap(d => urunler.map(u => ({ lang: d, slug: u.slug })));
  } catch { return []; }
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isDil(lang) || lang === "tr") return { robots: { index: false } };
  const u = await getUrun(slug);
  if (!u) return { title: "Not found", robots: { index: false } };
  const desc = kisalt(aciklama(u, lang), 155);
  const adi = ad(u, lang);
  const languages: Record<string, string> = Object.fromEntries(DILLER.map(d => [HREFLANG[d], urunUrl(d, u.slug)]));
  languages["x-default"] = urunUrl("tr", u.slug);
  return {
    title: `${adi} — ${u.code}`, description: desc,
    alternates: { canonical: urunUrl(lang, u.slug), languages },
    openGraph: { type: "website", locale: LOCALE[lang], url: urunUrl(lang, u.slug), siteName: "Alya Plastik", title: `${adi} | Alya Plastik`, description: desc, images: u.image_url ? [{ url: u.image_url, alt: adi }] : [{ url: `${SITE_URL}/og-image.jpg` }] },
    twitter: { card: "summary_large_image", title: `${adi} | Alya Plastik`, description: desc, images: u.image_url ? [u.image_url] : undefined },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!isDil(lang) || lang === "tr") notFound();
  const dil = lang as Dil;
  const u = await getUrun(slug);
  if (!u) notFound();
  const [settings, benzer, kategoriler] = await Promise.all([getSettings().catch(() => null), getBenzer(u).catch(() => []), getKategoriAdlari().catch(() => ({}))]);
  return <UrunSayfasi urun={u} dil={dil} settings={settings} benzer={benzer} kategoriler={kategoriler} />;
}
