import type { MetadataRoute } from "next";
import { DILLER, HREFLANG, SITE_URL, getTumUrunler, mevcutDiller, urunUrl } from "@/lib/urun-sayfasi";

export const revalidate = 3600;

// Türkçe'ye özel, dil dışı statik kurumsal sayfalar (yalnızca tr-TR + x-default).
const STATIK_SAYFALAR = ["hakkimizda", "uretim-sureci", "sertifikalar", "kvkk"];

// Ana sayfa + statik sayfalar + her ürün sayfası. Yabancı dil adresleri yalnızca çevirisi girilmiş ürünler için listelenir (hreflang karşılıklı).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const anaDiller = Object.fromEntries(DILLER.map(d => [HREFLANG[d], d === "tr" ? SITE_URL : `${SITE_URL}/${d}`]));
  const kok: MetadataRoute.Sitemap = DILLER.map(d => ({ url: d === "tr" ? SITE_URL : `${SITE_URL}/${d}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: d === "tr" ? 1 : 0.9, alternates: { languages: anaDiller } }));
  const statik: MetadataRoute.Sitemap = STATIK_SAYFALAR.map(yol => ({
    url: `${SITE_URL}/${yol}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.4,
    alternates: { languages: { "tr-TR": `${SITE_URL}/${yol}`, "x-default": `${SITE_URL}/${yol}` } },
  }));
  try {
    const urunler = await getTumUrunler();
    const liste: MetadataRoute.Sitemap = [];
    for (const u of urunler) {
      const diller = mevcutDiller(u);
      const languages = Object.fromEntries(diller.map(d => [HREFLANG[d], urunUrl(d, u.slug)]));
      for (const d of diller) liste.push({ url: urunUrl(d, u.slug), lastModified: u.updated_at ? new Date(u.updated_at) : new Date(), changeFrequency: "monthly", priority: d === "tr" ? 0.8 : 0.6, alternates: diller.length > 1 ? { languages } : undefined });
    }
    return [...kok, ...statik, ...liste];
  } catch { return [...kok, ...statik]; }
}
