import type { ReactNode } from "react";
import { getAllProducts, type Settings } from "@/lib/supabase";
import { HREFLANG, type Dil } from "@/lib/diller";
import YHeader from "./YHeader";
import YFooter from "./YFooter";
import { outfit } from "./font";

// İç sayfalar (kurumsal, katalog, ürün) için ortak yeni tasarım çerçevesi: üst çubuk + içerik + alt bilgi.
export default async function YCerceve({ settings, dil = "tr", altDiller, children }: { settings: Settings | null; dil?: Dil; altDiller?: Partial<Record<Dil, string>>; children: ReactNode }) {
  let urunler: Awaited<ReturnType<typeof getAllProducts>> = [];
  try { urunler = (await getAllProducts()).filter(p => typeof p.image_url === "string" && p.image_url.startsWith("https://")); } catch (e) { console.error("Supabase fetch error:", e); }
  const kat = Object.entries(urunler.reduce<Record<string, number>>((a, p) => { if (p.category) a[p.category] = (a[p.category] || 0) + 1; return a; }, {})).map(([k, adet]) => ({ k, adet })).sort((x, y) => y.adet - x.adet);
  return (
    <div lang={HREFLANG[dil]} className={`yt ${outfit.className}`}>
      <YHeader settings={settings} dil={dil} urunler={urunler} altDiller={altDiller} />
      {children}
      <YFooter settings={settings} dil={dil} kategoriler={kat} />
    </div>
  );
}
