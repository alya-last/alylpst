import type { Dil } from "@/lib/diller";
export const UM: Record<Dil, { etiket: string; baslik: string; aciklama: string; ara: string; tumu: string; ic: string; dis: string; mekan: string; kategori: string; bulunamadi: string; urun: string; temizle: string; meta: string }> = {
  tr: { etiket: "ÜRÜNLER", baslik: "Tüm ürünlerimiz", aciklama: "Önce bahçeniz, sonra eviniz: dış mekan ve iç mekan koleksiyonlarımızı keşfedin.", ara: "Ürün adı veya kodu ara", tumu: "Tümü", ic: "İç Mekan", dis: "Dış Mekan", mekan: "Mekan", kategori: "Kategori", bulunamadi: "Bu süzgece uygun ürün bulunamadı.", urun: "ürün", temizle: "Süzgeçleri temizle", meta: "Ürünler | Alya Plastik" },
  en: { etiket: "PRODUCTS", baslik: "All our products", aciklama: "Garden first, then home: explore our outdoor and indoor collections.", ara: "Search by product name or code", tumu: "All", ic: "Indoor", dis: "Outdoor", mekan: "Space", kategori: "Category", bulunamadi: "No products match this filter.", urun: "products", temizle: "Clear filters", meta: "Products | Alya Plastik" },
  ru: { etiket: "ПРОДУКЦИЯ", baslik: "Вся наша продукция", aciklama: "Сначала сад, затем дом: коллекции для улицы и для дома.", ara: "Поиск по названию или коду", tumu: "Все", ic: "Для дома", dis: "Для улицы", mekan: "Назначение", kategori: "Категория", bulunamadi: "Нет товаров, подходящих под фильтр.", urun: "товаров", temizle: "Сбросить фильтры", meta: "Продукция | Alya Plastik" },
  zh: { etiket: "产品", baslik: "全部产品", aciklama: "先看花园，再看家居：探索我们的户外与室内系列。", ara: "按产品名称或编号搜索", tumu: "全部", ic: "室内", dis: "户外", mekan: "场景", kategori: "类别", bulunamadi: "没有符合筛选条件的产品。", urun: "款产品", temizle: "清除筛选", meta: "产品 | Alya Plastik" },
};

export const IM: Record<Dil, { baslik: string; aciklama: string }> = {
  tr: { baslik: "İletişim", aciklama: "Toptan sipariş, özel kalıp, ihracat ve katalog talepleriniz için bize ulaşın. Teklifiniz 72 saat içinde hazır." },
  en: { baslik: "Contact", aciklama: "Reach us for wholesale orders, custom molds, export and catalog requests. Your quote is ready within 72 hours." },
  ru: { baslik: "Контакты", aciklama: "Свяжитесь с нами по вопросам опта, индивидуальных пресс-форм, экспорта и каталога. Предложение — в течение 72 часов." },
  zh: { baslik: "联系我们", aciklama: "批发订单、定制模具、出口和目录需求，欢迎联系我们。72小时内提供报价。" },
};
