// Saf sabitler ve yardımcılar — istemci bileşenleri de kullanır; bu yüzden veritabanı istemcisini (supabase) İÇE AKTARMAZ.
export const SITE_URL = "https://alyatest-alyis.vercel.app";
export const DILLER = ["tr", "en", "ru", "zh"] as const;
export type Dil = (typeof DILLER)[number];
export const DIL_AD: Record<Dil, string> = { tr: "Türkçe", en: "English", ru: "Русский", zh: "中文" };
export const HREFLANG: Record<Dil, string> = { tr: "tr-TR", en: "en", ru: "ru", zh: "zh-Hans" };
export const isDil = (x: string): x is Dil => (DILLER as readonly string[]).includes(x);

/** Bu üründe hangi dillerde içerik var: Türkçe her zaman; diğerleri yalnızca çevirisi girilmişse. */
export function mevcutDiller(u: { description_i18n?: Partial<Record<Dil, string>> | null }): Dil[] {
  const i = u.description_i18n || {};
  return DILLER.filter(d => d === "tr" || (typeof i[d] === "string" && i[d]!.trim().length > 0));
}
export const urunYolu = (d: Dil, slug: string) => (d === "tr" ? `/urun/${slug}` : `/${d}/urun/${slug}`);
/** Ürün kartı bağlantısı: HER ZAMAN o an gezinilen dildeki sayfaya gider — çevirisi olmayan ürünler
 * için de aynı dilde kalınır (açıklama Türkçe'ye düşer, bkz. aciklama()), Türkçe'ye fırlatılmaz. */
export const urunLinki = (p: { slug: string; description_i18n?: unknown }, d: Dil) => urunYolu(d, p.slug);
export const urunUrl = (d: Dil, slug: string) => `${SITE_URL}${urunYolu(d, slug)}`;
/** Kurumsal sayfa yolu (hakkimizda, uretim-sureci, sertifikalar, kvkk) — ürünlerle aynı örüntü. */
export const kurumsalYolu = (d: Dil, slug: string) => (d === "tr" ? `/${slug}` : `/${d}/${slug}`);

/** Ürün adının seçili dildeki karşılığı (çevirisi yoksa Türkçe ada düşer). İstemci bileşenleri de (ana sayfa kartları) kullanır. */
export const ad = (u: { name: string; name_i18n?: Partial<Record<Dil, string>> | null }, d: Dil) => (d === "tr" ? u.name : (u.name_i18n?.[d] || u.name));

/** Türkçe karakterleri ASCII'ye indirger — hem etiket hem alt kategori eşlemede kullanılır. */
export const asciiAnahtar = (k: string) => k.toLocaleLowerCase("tr-TR").replace(/[çğıöşü]/g, c => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" } as Record<string, string>)[c]).replace(/[^a-z0-9]/g, "");

/** Etiket (tag) değerleri (veride Türkçe, ör. "dış mekan", "alya garden") için görünen adlar. */
const ETIKET: Record<string, Record<Dil, string>> = {
  "3d": { tr: "3D", en: "3D", ru: "3D", zh: "3D" },
  alyagarden: { tr: "Alya Garden", en: "Alya Garden", ru: "Alya Garden", zh: "Alya Garden" },
  askili: { tr: "Askılı", en: "Hanging", ru: "Подвесной", zh: "悬挂式" },
  bahce: { tr: "Bahçe", en: "Garden", ru: "Сад", zh: "花园" },
  balkon: { tr: "Balkon", en: "Balcony", ru: "Балкон", zh: "阳台" },
  banyo: { tr: "Banyo", en: "Bathroom", ru: "Ванная", zh: "浴室" },
  buyuk: { tr: "Büyük", en: "Large", ru: "Крупный", zh: "大号" },
  camasir: { tr: "Çamaşır", en: "Laundry", ru: "Бельё", zh: "洗衣" },
  dekoratif: { tr: "Dekoratif", en: "Decorative", ru: "Декоративный", zh: "装饰性" },
  depolama: { tr: "Depolama", en: "Storage", ru: "Хранение", zh: "收纳" },
  dismekan: { tr: "Dış Mekan", en: "Outdoor", ru: "Уличный", zh: "户外" },
  geometrik: { tr: "Geometrik", en: "Geometric", ru: "Геометрический", zh: "几何" },
  guvec: { tr: "Güveç", en: "Casserole-style", ru: "Гювеч", zh: "陶罐款" },
  icmekan: { tr: "İç Mekan", en: "Indoor", ru: "Для помещений", zh: "室内" },
  kaktus: { tr: "Kaktüs", en: "Cactus", ru: "Кактус", zh: "仙人掌" },
  kordon: { tr: "Kordon", en: "Cord", ru: "Кордон", zh: "科尔顿" },
  kozalak: { tr: "Kozalak", en: "Pinecone", ru: "Шишка", zh: "松果" },
  kristal: { tr: "Kristal", en: "Crystal", ru: "Кристалл", zh: "水晶" },
  minimalist: { tr: "Minimalist", en: "Minimalist", ru: "Минималистичный", zh: "极简" },
  modern: { tr: "Modern", en: "Modern", ru: "Современный", zh: "现代" },
  oval: { tr: "Oval", en: "Oval", ru: "Овальный", zh: "椭圆形" },
  peyzaj: { tr: "Peyzaj", en: "Landscaping", ru: "Ландшафт", zh: "园林景观" },
  pp: { tr: "PP", en: "PP", ru: "ПП", zh: "PP" },
  saksi: { tr: "Saksı", en: "Planter", ru: "Кашпо", zh: "花盆" },
  sandik: { tr: "Sandık", en: "Chest", ru: "Сундук", zh: "箱" },
  sepet: { tr: "Sepet", en: "Basket", ru: "Корзина", zh: "篮子" },
};
export const etiketAdi = (t: string, d: Dil) => ETIKET[asciiAnahtar(t)]?.[d] || (d === "tr" ? t : t.charAt(0).toLocaleUpperCase() + t.slice(1));
