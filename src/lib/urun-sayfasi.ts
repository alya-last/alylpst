import { supabase, type Product } from "@/lib/supabase";
export { SITE_URL, DILLER, DIL_AD, HREFLANG, isDil, mevcutDiller, urunYolu, urunLinki, urunUrl, ad, etiketAdi, type Dil } from "@/lib/diller";
import { DILLER, HREFLANG, SITE_URL, urunYolu, urunUrl, mevcutDiller, ad, type Dil } from "@/lib/diller";


export type UrunKaydi = Product & { description_i18n: Partial<Record<Dil, string>> | null; name_i18n: Partial<Record<Dil, string>> | null };
const SUTUNLAR = "id,code,name,slug,category,subcategory,description,image_url,images,gorunum_360,model_3d_url,specs,paket_bilgisi,renkler,tags,is_featured,is_new,sort_order,created_at,updated_at,description_i18n,name_i18n";

/** Slug yalnızca küçük harf, rakam ve tire içerir; başka bir şey veritabanı sorgusuna hiç girmez. */
export const slugGecerli = (s: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 120;

export async function getUrun(slug: string): Promise<UrunKaydi | null> {
  if (!slugGecerli(slug)) return null;
  const { data } = await supabase.from("products").select(SUTUNLAR).eq("slug", slug).maybeSingle();
  return (data as UrunKaydi) ?? null;
}

export async function getTumUrunler(): Promise<(UrunKaydi & { updated_at?: string })[]> {
  const { data } = await supabase.from("products").select(SUTUNLAR).order("sort_order", { ascending: true }).limit(2000);
  return (data as any[]) ?? [];
}

/** Kategori slug'ı → görünen ad (categories tablosu). Bulunamazsa slug'ın baş harfi büyütülür. */
export async function getKategoriAdlari(): Promise<Record<string, string>> {
  const { data } = await supabase.from("categories").select("slug,name").limit(200);
  return Object.fromEntries((data || []).map((c: any) => [c.slug, c.name]));
}
export const kategoriAdi = (slug: string | null | undefined, harita: Record<string, string>) => (slug ? harita[slug] || slug.charAt(0).toLocaleUpperCase("tr-TR") + slug.slice(1) : "");

/** Teknik özellik anahtarları (veride ASCII, ör. "cap", "agirlik") için görünen etiketler. */
const OZ: Record<string, Record<Dil, string>> = {
  cap: { tr: "Çap", en: "Diameter", ru: "Диаметр", zh: "直径" },
  hacim: { tr: "Hacim", en: "Volume", ru: "Объём", zh: "容积" },
  agirlik: { tr: "Ağırlık", en: "Weight", ru: "Вес", zh: "重量" },
  malzeme: { tr: "Malzeme", en: "Material", ru: "Материал", zh: "材质" },
  yukseklik: { tr: "Yükseklik", en: "Height", ru: "Высота", zh: "高度" },
  genislik: { tr: "Genişlik", en: "Width", ru: "Ширина", zh: "宽度" },
  uzunluk: { tr: "Uzunluk", en: "Length", ru: "Длина", zh: "长度" },
  renk: { tr: "Renk", en: "Colour", ru: "Цвет", zh: "颜色" },
  boyut: { tr: "Boyut", en: "Size", ru: "Размер", zh: "尺寸" },
  kapasite: { tr: "Kapasite", en: "Capacity", ru: "Вместимость", zh: "容量" },
  ebat: { tr: "Ebat", en: "Dimensions", ru: "Размеры", zh: "规格" },
};
const anahtar = (k: string) => k.toLocaleLowerCase("tr-TR").replace(/[çğıöşü]/g, c => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" } as Record<string, string>)[c]).replace(/[^a-z0-9]/g, "");
export const ozellikEtiketi = (k: string, d: Dil) => OZ[anahtar(k)]?.[d] || (k.charAt(0).toLocaleUpperCase(d === "tr" ? "tr-TR" : undefined) + k.slice(1));

export async function getBenzer(u: UrunKaydi, n = 4): Promise<UrunKaydi[]> {
  // Önce fotoğrafı olan benzer ürünler gösterilir (fotoğrafsız kayıtlar boş kutu olarak görünmesin)
  const { data } = await supabase.from("products").select(SUTUNLAR).eq("category", u.category).neq("id", u.id).order("sort_order", { ascending: true }).limit(60);
  const l = (data as UrunKaydi[]) ?? [];
  const resimli = (x: UrunKaydi) => typeof x.image_url === "string" && x.image_url.startsWith("https://");
  return [...l.filter(resimli), ...l.filter(x => !resimli(x))].slice(0, n);
}

// Çevirisi girilmemiş ürünlerde de sayfa boş kalmasın diye Türkçe açıklamaya düşülür — dil
// değiştiricinin bu sayfada kalabilmesi (bkz. urunLinki) buna bağlı, tamamen boş bir sayfadansa
// Türkçe içerik göstermek tercih edildi.
export const aciklama = (u: UrunKaydi, d: Dil) => (d === "tr" ? u.description || "" : (u.description_i18n?.[d] || u.description || "")).trim();
export const kisalt = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");

/** Arayüz metinleri. */
export const UI: Record<Dil, { anasayfa: string; urunler: string; kod: string; kategori: string; ozellikler: string; etiketler: string; teklif: string; whatsapp: string; benzer: string; b2b: string; yeni: string; dil: string; wamesaj: (ad: string, kod: string) => string;
  paketBaslik: string; paketKod: string; paketAdet: string; paketKutuHacmi: string; paketKutuAgirligi: string; paketOlculer: string; paketHacim: string }> = {
  tr: { anasayfa: "Ana sayfa", urunler: "Ürünler", kod: "Ürün kodu", kategori: "Kategori", ozellikler: "Özellikler", etiketler: "Etiketler", teklif: "Teklif iste", whatsapp: "WhatsApp ile sor", benzer: "Benzer ürünler", b2b: "Toptan ve ihracat siparişleri için özel fiyat ve sevkiyat bilgisi alın.", yeni: "Yeni", dil: "Dil", wamesaj: (a, k) => `Merhaba, ${a} (${k}) ürünü için toptan fiyat teklifi almak istiyorum.`,
    paketBaslik: "Ürün Bilgisi", paketKod: "Kod", paketAdet: "Ürün Adedi", paketKutuHacmi: "Kutu Hacmi (m³)", paketKutuAgirligi: "Kutu Ağırlığı (kg)", paketOlculer: "Ölçüler (cm)", paketHacim: "Hacim (L)" },
  en: { anasayfa: "Home", urunler: "Products", kod: "Product code", kategori: "Category", ozellikler: "Specifications", etiketler: "Tags", teklif: "Request a quote", whatsapp: "Ask on WhatsApp", benzer: "Related products", b2b: "Get wholesale and export pricing and shipping information.", yeni: "New", dil: "Language", wamesaj: (a, k) => `Hello, I would like a wholesale quotation for ${a} (${k}).`,
    paketBaslik: "Product Information", paketKod: "Code", paketAdet: "Units per Box", paketKutuHacmi: "Box Volume (m³)", paketKutuAgirligi: "Box Weight (kg)", paketOlculer: "Dimensions (cm)", paketHacim: "Volume (L)" },
  ru: { anasayfa: "Главная", urunler: "Продукция", kod: "Артикул", kategori: "Категория", ozellikler: "Характеристики", etiketler: "Теги", teklif: "Запросить цену", whatsapp: "Написать в WhatsApp", benzer: "Похожие товары", b2b: "Получите оптовые и экспортные цены и информацию о доставке.", yeni: "Новинка", dil: "Язык", wamesaj: (a, k) => `Здравствуйте, я хочу получить оптовое коммерческое предложение на ${a} (${k}).`,
    paketBaslik: "Информация о товаре", paketKod: "Код", paketAdet: "Кол-во в коробке", paketKutuHacmi: "Объём коробки (м³)", paketKutuAgirligi: "Вес коробки (кг)", paketOlculer: "Размеры (см)", paketHacim: "Объём (л)" },
  zh: { anasayfa: "首页", urunler: "产品", kod: "产品编号", kategori: "类别", ozellikler: "规格参数", etiketler: "标签", teklif: "获取报价", whatsapp: "通过 WhatsApp 咨询", benzer: "相关产品", b2b: "获取批发与出口价格及运输信息。", yeni: "新品", dil: "语言", wamesaj: (a, k) => `您好，我想获取 ${a}（${k}）的批发报价。`,
    paketBaslik: "产品信息", paketKod: "编号", paketAdet: "每箱数量", paketKutuHacmi: "箱体积 (m³)", paketKutuAgirligi: "箱重 (kg)", paketOlculer: "尺寸 (cm)", paketHacim: "容积 (L)" },
};

/** JSON-LD içine gömülürken HTML kapatma karakterlerini kaçırır (XSS önlemi). */
export const jsonLdMetni = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");

export function urunJsonLd(u: UrunKaydi, d: Dil, kategori?: string) {
  const resimler = [u.image_url, ...(u.images || [])].filter((x, i, a) => typeof x === "string" && x.startsWith("https://") && a.indexOf(x) === i);
  const ozellik = Object.entries(u.specs || {}).slice(0, 20).map(([k, v]) => ({ "@type": "PropertyValue", name: ozellikEtiketi(String(k), d).slice(0, 80), value: String(v).slice(0, 200) }));
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Product", "@id": `${urunUrl(d, u.slug)}#product`, name: ad(u, d), sku: u.code, category: kategori || u.category, description: kisalt(aciklama(u, d), 500), image: resimler, url: urunUrl(d, u.slug), inLanguage: HREFLANG[d],
        brand: { "@type": "Brand", name: "Alya Plastik" }, manufacturer: { "@type": "Organization", name: "Alya Plastik", url: SITE_URL }, ...(ozellik.length ? { additionalProperty: ozellik } : {}) },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: UI[d].anasayfa, item: d === "tr" ? SITE_URL : `${SITE_URL}/${d}` },
        { "@type": "ListItem", position: 2, name: UI[d].urunler, item: `${SITE_URL}${d === "tr" ? "" : `/${d}`}/#collection` },
        { "@type": "ListItem", position: 3, name: ad(u, d), item: urunUrl(d, u.slug) },
      ] },
    ],
  };
}
