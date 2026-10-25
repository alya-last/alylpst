import { getFeaturedProducts, getAllProducts, getStats, getSettings, getExportCountries, getTemaGorselleri } from "@/lib/supabase";
import { resolveImg } from "@/data/images";
import { Outfit } from "next/font/google";
import type { Dil } from "@/lib/urun-sayfasi";
import HtmlLang         from "@/components/layout/HtmlLang";
import HashDuzelt       from "@/components/layout/HashDuzelt";
import SchemaOrg        from "@/components/layout/SchemaOrg";
import WhatsAppFab      from "@/components/ui/WhatsAppFab";
import ChatAsistan      from "@/components/ui/ChatAsistan";
import YHeader from "@/components/yeni/YHeader";
import YHero from "@/components/yeni/YHero";
import YSerit from "@/components/yeni/YSerit";
import YUrunler from "@/components/yeni/YUrunler";
import YKoleksiyon from "@/components/yeni/YKoleksiyon";
import YUretim from "@/components/yeni/YUretim";
import YIsbirligi from "@/components/yeni/YIsbirligi";
import YFooter from "@/components/yeni/YFooter";
import YIhracat from "@/components/yeni/YIhracat";
import YIletisim from "@/components/yeni/YIletisim";

const outfit = Outfit({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "500", "600", "700"], display: "swap" });

// Ana sayfa gövdesi — tüm diller için ortak (tr: "/", diğerleri: "/en", "/ru", "/zh").
export default async function Anasayfa({ dil }: { dil: Dil }) {
  // Env yoksa graceful fallback
  let featured: Awaited<ReturnType<typeof getFeaturedProducts>> = [];
  let all:      Awaited<ReturnType<typeof getAllProducts>>      = [];
  let stats:    Awaited<ReturnType<typeof getStats>>           = null;
  let settings: Awaited<ReturnType<typeof getSettings>>        = null;
  let countries: string[] = [];
  let temaOverride: Awaited<ReturnType<typeof getTemaGorselleri>> = null;

  try {
    [featured, all, stats, settings, countries, temaOverride] = await Promise.all([
      getFeaturedProducts(),
      getAllProducts(),
      getStats(),
      getSettings(),
      getExportCountries(),
      getTemaGorselleri(),
    ]);
  } catch (e) {
    console.error("Supabase fetch error:", e);
  }
  // Ana sayfada yalnızca fotoğrafı olan ürünler gösterilir (fotoğrafsız yeni kayıtlar boş kutu oluşturmasın)
  const resimli = <T extends { image_url?: string | null }>(l: T[]) => l.filter(p => typeof p.image_url === "string" && p.image_url.startsWith("https://"));
  featured = resimli(featured);
  const gorunenler = resimli(all);
  const img = resolveImg(temaOverride);

  // Yeni açık renkli tasarım: yeni ürünler (yoksa öne çıkanlar) kaydırıcıda, koleksiyon kartları mekan görselleriyle
  const yeniler = gorunenler.filter(p => p.is_new);
  const vitrin = (yeniler.length ? yeniler : featured.length ? featured : gorunenler).slice(0, 14);
  const ilk = (mekan: "ic" | "dis") => gorunenler.find(p => p.mekan === mekan)?.image_url;
  const kat = Object.entries(gorunenler.reduce<Record<string, number>>((a, p) => { if (p.category) a[p.category] = (a[p.category] || 0) + 1; return a; }, {})).map(([k, adet]) => ({ k, adet, gorsel: gorunenler.find(p => p.category === k)?.image_url })).sort((x, y) => y.adet - x.adet);
  const slaytGorsel = [img.hero2, img.fikir, img.ufo];

  return (
    <div className={`yt ${outfit.className}`}>
      <HtmlLang dil={dil} />
      <HashDuzelt />
      <SchemaOrg settings={settings} stats={stats} dil={dil} />
      <YHeader settings={settings} dil={dil} urunler={gorunenler} />
      <main>
        <YHero dil={dil} gorseller={slaytGorsel} />
        <YSerit kategoriler={kat} products={gorunenler} dil={dil} />
        <YUrunler products={vitrin} dil={dil} />
        <YKoleksiyon dil={dil} icGorsel={ilk("ic")} disGorsel={ilk("dis")} />
        <YUretim dil={dil} stats={stats} settings={settings} gorsel={img.hero2} />
        <YIsbirligi dil={dil} gorselSol={gorunenler[0]?.image_url} gorselSag={gorunenler[1]?.image_url} />
        <YIhracat countries={countries} dil={dil} />
        <YIletisim settings={settings} dil={dil} />
      </main>
      <YFooter settings={settings} dil={dil} />
      <WhatsAppFab settings={settings} dil={dil} />
      <ChatAsistan dil={dil} />
    </div>
  );
}
