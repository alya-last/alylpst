import type { Metadata } from "next";
import { notFound } from "next/navigation";
import UrunSayfasi from "@/components/urun/UrunSayfasi";
import { getSettings } from "@/lib/supabase";
import { getKategoriAdlari, HREFLANG, SITE_URL, aciklama, getBenzer, getTumUrunler, getUrun, kisalt, mevcutDiller, urunUrl } from "@/lib/urun-sayfasi";

export const revalidate = 300;

export async function generateStaticParams() {
  try { return (await getTumUrunler()).map(u => ({ slug: u.slug })); } catch { return []; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const u = await getUrun(slug);
  if (!u) return { title: "Ürün bulunamadı", robots: { index: false } };
  const desc = kisalt(aciklama(u, "tr") || `${u.name} — Alya Plastik ${u.category}. Toptan ve ihracat için.`, 155);
  const languages: Record<string, string> = Object.fromEntries(mevcutDiller(u).map(d => [HREFLANG[d], urunUrl(d, u.slug)]));
  languages["x-default"] = urunUrl("tr", u.slug);
  return {
    title: `${u.name} — ${u.code}`,
    description: desc,
    alternates: { canonical: urunUrl("tr", u.slug), languages },
    openGraph: { type: "website", locale: "tr_TR", url: urunUrl("tr", u.slug), siteName: "Alya Plastik", title: `${u.name} | Alya Plastik`, description: desc, images: u.image_url ? [{ url: u.image_url, alt: u.name }] : [{ url: `${SITE_URL}/og-image.jpg` }] },
    twitter: { card: "summary_large_image", title: `${u.name} | Alya Plastik`, description: desc, images: u.image_url ? [u.image_url] : undefined },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = await getUrun(slug);
  if (!u) notFound();
  const [settings, benzer, kategoriler] = await Promise.all([getSettings().catch(() => null), getBenzer(u).catch(() => []), getKategoriAdlari().catch(() => ({}))]);
  return <UrunSayfasi urun={u} dil="tr" settings={settings} benzer={benzer} kategoriler={kategoriler} />;
}
