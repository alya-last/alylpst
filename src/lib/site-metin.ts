import type { Dil } from "@/lib/urun-sayfasi";

/** Genel site (ana sayfa, üst/alt bilgi, form, asistan) arayüz metinleri. Ürün adları/kodları çevrilmez; ürün açıklamaları veritabanından gelir. */
export type SiteMetin = {
  htmlLang: string; ogLocale: string; dil: string;
  meta: { baslik: string; aciklama: string; ogAciklama: string };
  nav: { urunler: string; koleksiyon: string; neden: string; iletisim: string; teklif: string; waTeklif: string; menu: string };
  hero: { since: (y: number) => string; satir: [string, string, string]; aciklama: (y: number) => string; teklif: string; katalog: string; yil: string; model: string; ulke: string; koleksiyon: string; kaydir: string; alt: string };
  marquee: string[];
  featured: { etiket: string; baslik: string; tum: string; yeni: string };
  pin: { surukle: string; baslik: string[]; urun: string; b2b: string; katalog: [string, string]; form: string; mobEtiket: string; mobBaslik: string; yeni: string };
  koleksiyon: { model: string; surukleKaydir: string; tumKatalog: string; katalog: [string, string]; form: string; yeni: string; tumu: string };
  felsefe: { etiket: string; baslik: [string, string]; aciklama: string; surec: string; teklif: string; stat: [string, string][] };
  neden: {
    miras: (y: number) => string; alinti: [string, string, string]; etiket: string; baslik: (y: number) => [string, string]; alt: (y: number, u: number) => string;
    ozellikler: string[]; teklif: string; yeni: string; stat: { label: string; desc: string }[];
  };
  ihracat: { etiket: string; ulke: string; aciklama: string; bilgi: string };
  iletisim: {
    etiket: string; baslik: [string, string]; aciklama: string; eposta: string; ihracat: string; telefon: string; whatsapp: string;
    alindi: string; alindiMesaj: string; ad: string; firma: string; epostaAlan: string; telAlan: string; konu: string; sec: string;
    konular: { v: string; l: string }[]; mesaj: string; hata: string; gonderiliyor: string; gonder: string; kvkk: string;
  };
  altbilgi: {
    kolonlar: { baslik: string; ogeler: { ad: string; href: string }[] }[]; iletisimBaslik: string; adres: string; lider: (y: number) => string; dunyaya: (yer: string) => string;
    haklar: string; yerel: string; varsayilanYer: string;
  };
  asistan: { selam: string; baslik: string; alt: string; kapat: string; ac: string; soru: string; yer: string; gonder: string; yaziyor: string; hata: string; baglanti: string; aria: string; mesajAria: string };
  wa: { metin: string; buton: string };
  kategori: Record<string, string>;
};

export const M: Record<Dil, SiteMetin> = {
  tr: {
    htmlLang: "tr", ogLocale: "tr_TR", dil: "Dil",
    meta: {
      baslik: "Alya Plastik | Plastik Saksı, Sepet & Depolama Üreticisi — 1968",
      aciklama: "1968'den bu yana İstanbul OSB'de plastik üretim. Saksı, sepet, sandık, banyo ürünleri. 200+ model, 20+ ülke ihracat. B2B toplu sipariş.",
      ogAciklama: "1968'den bu yana İstanbul OSB'de plastik ürün üretimi. Saksı, sepet, sandık, banyo ve bahçe ürünleri. 200+ model, 20+ ülke ihracat.",
    },
    nav: { urunler: "Ürünler", koleksiyon: "Koleksiyon", neden: "Neden Alya", iletisim: "İletişim", teklif: "Teklif Al →", waTeklif: "WhatsApp ile Teklif Al →", menu: "Menü" },
    hero: { since: y => `${y}'den beri · İstanbul`, satir: ["KÖKLÜ GEÇMİŞ.", "GÜÇLÜ", "ÜRETİM."], aciklama: () => `Saksı, sepet ve depolama ürünlerini kendi kalıp ve enjeksiyon hatlarımızda üretiyoruz.`, teklif: "Teklif Al →", katalog: "Kataloğa Bak", yil: "Yıl Deneyim", model: "Ürün Modeli", ulke: "İhracat Ülkesi", koleksiyon: "KOLEKSİYON 2024/25", kaydir: "KAYDIR", alt: "Alya Plastik plastik ürün koleksiyonu" },
    marquee: ["Plastik Saksı", "Sepet", "Sandık", "B2B", "İhracat", "1968", "Türkiye", "200+ Model", "20+ Ülke", "İstanbul OSB", "Yerli Üretim", "ISO Sertifikalı"],
    featured: { etiket: "— Öne Çıkan Ürünler", baslik: "KOLEKSİYON", tum: "Tüm Ürünler →", yeni: "Yeni" },
    pin: { surukle: "Sürükle", baslik: ["TÜM", "FORM", "LAR."], urun: "ürün", b2b: "B2B Teklif", katalog: ["KATALOG", "İSTE"], form: "Formu Doldur →", mobEtiket: "Koleksiyon", mobBaslik: "TÜM FORMLAR.", yeni: "YENİ" },
    koleksiyon: { model: "MODEL", surukleKaydir: "Sürükle veya kaydır", tumKatalog: "Tüm Katalog", katalog: ["KATALOG", "İSTE"], form: "Formu Doldur →", yeni: "Yeni", tumu: "Tümü" },
    felsefe: { etiket: "Üretim Felsefemiz", baslik: ["FİKİRDEN", "FORMA."], aciklama: "CAD tasarımdan enjeksiyona, kalite kontrolden sevkiyata — her adım İstanbul OSB'deki tesisimizde gerçekleşir.", surec: "Üretim Sürecimiz →", teklif: "Teklif Al", stat: [["ISO", "Sertifikalı"], ["72h", "Teklif Dönüşü"], ["B2B", "Toplu Sipariş"]] },
    neden: {
      miras: y => `${y} Yıllık Miras`, alinti: ["KALIPTAN SEVKİYATA,", "TEK ÇATI ALTINDA", "ÜRETİYORUZ."], etiket: "— Neden Alya Plastik", baslik: y => [`${y} YILLIK`, "BİRİKİM."],
      alt: (y, u) => `${y} yıldır İstanbul'dan dünyaya. ${u}+ ülkeye ihracat.`,
      ozellikler: ["ISO sertifikalı üretim tesisi", "Kalıptan rafa tam tedarik zinciri", "72 saat içinde teklif dönüşü garantisi", "Özel kalıp ve sipariş imkânı", "Tüm lojistik ve gümrük dokümantasyon desteği"],
      teklif: "Teklif Al →", yeni: "Yeni",
      stat: [{ label: "Yıl Deneyim", desc: "1968'den bu yana" }, { label: "Ürün Modeli", desc: "Geniş portföy" }, { label: "İhracat Ülkesi", desc: "Global erişim" }, { label: "Yerli Üretim", desc: "Made in Türkiye" }],
    },
    ihracat: { etiket: "Global Erişim", ulke: "ÜLKE.", aciklama: "Avrupa'dan Orta Doğu'ya, Afrika'dan Orta Asya'ya. Tüm lojistik ve gümrük dokümantasyon desteği.", bilgi: "İhracat hakkında bilgi al →" },
    iletisim: {
      etiket: "— İletişim", baslik: ["BİRLİKTE", "ÜRETELIM."], aciklama: "B2B toplu sipariş, özel kalıp talebi, ihracat ve katalog için bize ulaşın. 72 saat garantisi.",
      eposta: "E-posta", ihracat: "İhracat", telefon: "Telefon", whatsapp: "WhatsApp", alindi: "ALINDI.", alindiMesaj: "En kısa sürede dönüş yapılacaktır.",
      ad: "Ad Soyad *", firma: "Firma", epostaAlan: "E-posta *", telAlan: "Telefon", konu: "Konu", sec: "Seçin",
      konular: [{ v: "Ürün Bilgisi", l: "Ürün Bilgisi" }, { v: "Fiyat Talebi", l: "Fiyat Talebi" }, { v: "İhracat", l: "İhracat / Export" }, { v: "Katalog", l: "Katalog Talebi" }, { v: "Özel Kalıp", l: "Özel Kalıp" }, { v: "Diğer", l: "Diğer" }],
      mesaj: "Mesajınız *", hata: "Bir hata oluştu, lütfen tekrar deneyin.", gonderiliyor: "Gönderiliyor...", gonder: "Gönder →", kvkk: "KVKK kapsamında kişisel verileriniz işlenir.",
    },
    altbilgi: {
      kolonlar: [
        { baslik: "Ürünler", ogeler: [
          { ad: "Saksı Modelleri", href: "/?kategori=saksi#collection" },
          { ad: "Sepet Ürünleri", href: "/?kategori=sepet#collection" },
          { ad: "Depolama Sandığı", href: "/?kategori=sandik#collection" },
          { ad: "Ev Gereçleri", href: "/?kategori=ev#collection" },
          { ad: "Bahçe Ürünleri", href: "/?kategori=bahce#collection" },
          { ad: "Özel Sipariş", href: "/#contact" },
        ] },
        { baslik: "Firma", ogeler: [
          { ad: "Hakkımızda", href: "/hakkimizda" },
          { ad: "Üretim Süreci", href: "/uretim-sureci" },
          { ad: "İhracat", href: "/#export" },
          { ad: "Sertifikalar", href: "/sertifikalar" },
          { ad: "KVKK", href: "/kvkk" },
        ] },
      ],
      iletisimBaslik: "İletişim", adres: "Başakşehir / İstanbul", lider: y => `${y}'den bu yana plastik ürün üretiminde lider.`, dunyaya: yer => `${yer}'dan dünyaya.`,
      haklar: "Tüm hakları saklıdır.", yerel: "İstanbul OSB · Made in Türkiye 🇹🇷", varsayilanYer: "İstanbul Başakşehir OSB",
    },
    asistan: { selam: "Merhaba! Alya Plastik ürünleri, toplu sipariş veya ihracat hakkında sorularınızı yanıtlayabilirim.", baslik: "ALYA ASİSTAN", alt: "Yapay zeka destekli · yanıtlar hata içerebilir", kapat: "Kapat", ac: "Soru Sor", soru: "Sorunuzu yazın…", yer: "Sorunuzu yazın…", gonder: "GÖNDER", yaziyor: "yazıyor…", hata: "Şu an yanıt veremiyorum, lütfen iletişim formunu kullanın.", baglanti: "Bağlantı hatası oluştu, lütfen tekrar deneyin.", aria: "Alya Plastik asistanı", mesajAria: "Mesajınız" },
    wa: { metin: "Merhaba, ürün hakkında bilgi almak istiyorum.", buton: "Teklif Al" },
    kategori: { saksi: "Saksı", sepet: "Sepet", sandik: "Sandık", ev: "Ev Gereçleri", bahce: "Bahçe" },
  },

  en: {
    htmlLang: "en", ogLocale: "en_US", dil: "Language",
    meta: {
      baslik: "Alya Plastik | Plastic Flower Pots, Baskets & Storage Manufacturer — Since 1968",
      aciklama: "Plastic manufacturer in Istanbul since 1968. Flower pots, baskets, crates and bathroom products. 200+ models, exported to 20+ countries. B2B wholesale orders.",
      ogAciklama: "Plastic product manufacturing in Istanbul since 1968. Pots, baskets, crates, bathroom and garden products. 200+ models, exports to 20+ countries.",
    },
    nav: { urunler: "Products", koleksiyon: "Collection", neden: "Why Alya", iletisim: "Contact", teklif: "Get a Quote →", waTeklif: "Get a Quote on WhatsApp →", menu: "Menu" },
    hero: { since: y => `Manufacturing in Istanbul since ${y}`, satir: ["MADE IN", "ISTANBUL,", "WITH CRAFT."], aciklama: y => `We make pots, baskets and storage products on our own mould and injection lines — ${y} years under one roof.`, teklif: "Get a Quote →", katalog: "View Catalogue", yil: "Years of Experience", model: "Product Models", ulke: "Export Countries", koleksiyon: "COLLECTION 2024/25", kaydir: "SCROLL", alt: "Alya Plastik plastic product collection" },
    marquee: ["Plastic Pots", "Baskets", "Crates", "B2B", "Export", "1968", "Türkiye", "200+ Models", "20+ Countries", "Istanbul OSB", "Local Production", "ISO Certified"],
    featured: { etiket: "— Featured Products", baslik: "COLLECTION", tum: "All Products →", yeni: "New" },
    pin: { surukle: "Drag", baslik: ["ALL THE", "FORMS."], urun: "products", b2b: "B2B Quote", katalog: ["REQUEST", "CATALOGUE"], form: "Fill in the Form →", mobEtiket: "Collection", mobBaslik: "ALL THE FORMS.", yeni: "NEW" },
    koleksiyon: { model: "MODELS", surukleKaydir: "Drag or swipe", tumKatalog: "Full Catalogue", katalog: ["REQUEST", "CATALOGUE"], form: "Fill in the Form →", yeni: "New", tumu: "All" },
    felsefe: { etiket: "Our Manufacturing Philosophy", baslik: ["FROM IDEA", "TO FORM."], aciklama: "From CAD design to injection, from quality control to shipping — every step takes place at our Istanbul OSB facility.", surec: "Our Production Process →", teklif: "Get a Quote", stat: [["ISO", "Certified"], ["72h", "Quote Turnaround"], ["B2B", "Bulk Orders"]] },
    neden: {
      miras: y => `${y} Years of Heritage`, alinti: ["FROM MOULD TO SHIPMENT,", "UNDER ONE ROOF", "WE MANUFACTURE."], etiket: "— Why Alya Plastik", baslik: y => [`${y} YEARS OF`, "EXPERTISE."],
      alt: (y, u) => `From Istanbul to the world for ${y} years. Exporting to ${u}+ countries.`,
      ozellikler: ["ISO-certified production facility", "Complete supply chain from mould to shelf", "Quote within 72 hours, guaranteed", "Custom moulds and made-to-order production", "Full logistics and customs documentation support"],
      teklif: "Get a Quote →", yeni: "New",
      stat: [{ label: "Years of Experience", desc: "Since 1968" }, { label: "Product Models", desc: "Wide portfolio" }, { label: "Export Countries", desc: "Global reach" }, { label: "Local Production", desc: "Made in Türkiye" }],
    },
    ihracat: { etiket: "Global Reach", ulke: "COUNTRIES.", aciklama: "From Europe to the Middle East, from Africa to Central Asia. Full logistics and customs documentation support.", bilgi: "Ask about exports →" },
    iletisim: {
      etiket: "— Contact", baslik: ["LET'S MAKE", "IT TOGETHER."], aciklama: "Reach us for B2B bulk orders, custom moulds, exports and catalogues. 72-hour response guarantee.",
      eposta: "E-mail", ihracat: "Export", telefon: "Phone", whatsapp: "WhatsApp", alindi: "RECEIVED.", alindiMesaj: "We will get back to you as soon as possible.",
      ad: "Full name *", firma: "Company", epostaAlan: "E-mail *", telAlan: "Phone", konu: "Subject", sec: "Select",
      konular: [{ v: "Ürün Bilgisi", l: "Product information" }, { v: "Fiyat Talebi", l: "Price request" }, { v: "İhracat", l: "Export" }, { v: "Katalog", l: "Catalogue request" }, { v: "Özel Kalıp", l: "Custom mould" }, { v: "Diğer", l: "Other" }],
      mesaj: "Your message *", hata: "Something went wrong, please try again.", gonderiliyor: "Sending...", gonder: "Send →", kvkk: "Your personal data is processed in accordance with the applicable data protection law (KVKK).",
    },
    altbilgi: {
      kolonlar: [
        { baslik: "Products", ogeler: [
          { ad: "Flower Pot Models", href: "/en?kategori=saksi#collection" },
          { ad: "Baskets", href: "/en?kategori=sepet#collection" },
          { ad: "Storage Crates", href: "/en?kategori=sandik#collection" },
          { ad: "Household Items", href: "/en?kategori=ev#collection" },
          { ad: "Garden Products", href: "/en?kategori=bahce#collection" },
          { ad: "Custom Orders", href: "/en#contact" },
        ] },
        { baslik: "Company", ogeler: [
          { ad: "About Us", href: "/en/hakkimizda" },
          { ad: "Production Process", href: "/en/uretim-sureci" },
          { ad: "Export", href: "/en#export" },
          { ad: "Certificates", href: "/en/sertifikalar" },
          { ad: "Privacy (KVKK)", href: "/en/kvkk" },
        ] },
      ],
      iletisimBaslik: "Contact", adres: "Başakşehir / Istanbul", lider: y => `A leader in plastic product manufacturing since ${y}.`, dunyaya: yer => `From ${yer} to the world.`,
      haklar: "All rights reserved.", yerel: "Istanbul OSB · Made in Türkiye 🇹🇷", varsayilanYer: "Istanbul Başakşehir OSB",
    },
    asistan: { selam: "Hello! I can answer your questions about Alya Plastik products, bulk orders or exports.", baslik: "ALYA ASSISTANT", alt: "AI-powered · answers may contain errors", kapat: "Close", ac: "Ask a Question", soru: "Type your question…", yer: "Type your question…", gonder: "SEND", yaziyor: "typing…", hata: "I can't answer right now, please use the contact form.", baglanti: "Connection error, please try again.", aria: "Alya Plastik assistant", mesajAria: "Your message" },
    wa: { metin: "Hello, I would like to get information about a product.", buton: "Get a Quote" },
    kategori: { saksi: "Flower Pots", sepet: "Baskets", sandik: "Crates", ev: "Household Items", bahce: "Garden" },
  },

  ru: {
    htmlLang: "ru", ogLocale: "ru_RU", dil: "Язык",
    meta: {
      baslik: "Alya Plastik | Производитель пластиковых горшков, корзин и систем хранения — с 1968 года",
      aciklama: "Производство пластиковых изделий в Стамбуле с 1968 года. Горшки, корзины, ящики, товары для ванной. 200+ моделей, экспорт в 20+ стран. Оптовые заказы B2B.",
      ogAciklama: "Производство пластиковых изделий в Стамбуле с 1968 года. Горшки, корзины, ящики, товары для ванной и сада. 200+ моделей, экспорт в 20+ стран.",
    },
    nav: { urunler: "Продукция", koleksiyon: "Коллекция", neden: "Почему Alya", iletisim: "Контакты", teklif: "Запросить цену →", waTeklif: "Запросить цену в WhatsApp →", menu: "Меню" },
    hero: { since: y => `Производство в Стамбуле с ${y} года`, satir: ["ПРОИЗВОДИМ", "В СТАМБУЛЕ", "МАСТЕРСКИ."], aciklama: y => `Горшки, корзины и системы хранения мы производим на собственных пресс-формах и термопластавтоматах — ${y} лет под одной крышей.`, teklif: "Запросить цену →", katalog: "Смотреть каталог", yil: "Лет опыта", model: "Моделей", ulke: "Стран экспорта", koleksiyon: "КОЛЛЕКЦИЯ 2024/25", kaydir: "ЛИСТАЙТЕ", alt: "Коллекция пластиковых изделий Alya Plastik" },
    marquee: ["Пластиковые горшки", "Корзины", "Ящики", "B2B", "Экспорт", "1968", "Турция", "200+ моделей", "20+ стран", "Стамбул OSB", "Собственное производство", "Сертификат ISO"],
    featured: { etiket: "— Рекомендуемая продукция", baslik: "КОЛЛЕКЦИЯ", tum: "Вся продукция →", yeni: "Новинка" },
    pin: { surukle: "Тяните", baslik: ["ВСЕ", "ФОРМЫ."], urun: "товаров", b2b: "Предложение B2B", katalog: ["ЗАПРОСИТЬ", "КАТАЛОГ"], form: "Заполнить форму →", mobEtiket: "Коллекция", mobBaslik: "ВСЕ ФОРМЫ.", yeni: "НОВИНКА" },
    koleksiyon: { model: "МОДЕЛЕЙ", surukleKaydir: "Тяните или листайте", tumKatalog: "Весь каталог", katalog: ["ЗАПРОСИТЬ", "КАТАЛОГ"], form: "Заполнить форму →", yeni: "Новинка", tumu: "Все" },
    felsefe: { etiket: "Наша философия производства", baslik: ["ОТ ИДЕИ", "К ФОРМЕ."], aciklama: "От CAD-проектирования до литья, от контроля качества до отгрузки — каждый этап проходит на нашем предприятии в Стамбуле (OSB).", surec: "Наш процесс производства →", teklif: "Запросить цену", stat: [["ISO", "Сертификат"], ["72h", "Срок ответа"], ["B2B", "Оптовые заказы"]] },
    neden: {
      miras: y => `${y} лет наследия`, alinti: ["ОТ ПРЕСС-ФОРМЫ ДО ОТГРУЗКИ", "ПОД ОДНОЙ КРЫШЕЙ", "МЫ ПРОИЗВОДИМ."], etiket: "— Почему Alya Plastik", baslik: y => [`${y} ЛЕТ`, "ОПЫТА."],
      alt: (y, u) => `Из Стамбула в мир уже ${y} лет. Экспорт в ${u}+ стран.`,
      ozellikler: ["Производство с сертификатом ISO", "Полная цепочка поставок от пресс-формы до полки", "Гарантированный ответ с ценой в течение 72 часов", "Индивидуальные пресс-формы и заказное производство", "Полная поддержка по логистике и таможенным документам"],
      teklif: "Запросить цену →", yeni: "Новинка",
      stat: [{ label: "Лет опыта", desc: "С 1968 года" }, { label: "Моделей", desc: "Широкий ассортимент" }, { label: "Стран экспорта", desc: "Глобальный охват" }, { label: "Местное производство", desc: "Сделано в Турции" }],
    },
    ihracat: { etiket: "Глобальный охват", ulke: "СТРАН.", aciklama: "От Европы до Ближнего Востока, от Африки до Центральной Азии. Полная поддержка по логистике и таможенным документам.", bilgi: "Узнать об экспорте →" },
    iletisim: {
      etiket: "— Контакты", baslik: ["ДАВАЙТЕ", "СОЗДАВАТЬ ВМЕСТЕ."], aciklama: "Оптовые заказы B2B, индивидуальные пресс-формы, экспорт и каталог — свяжитесь с нами. Ответ в течение 72 часов.",
      eposta: "E-mail", ihracat: "Экспорт", telefon: "Телефон", whatsapp: "WhatsApp", alindi: "ПРИНЯТО.", alindiMesaj: "Мы свяжемся с вами в ближайшее время.",
      ad: "Имя и фамилия *", firma: "Компания", epostaAlan: "E-mail *", telAlan: "Телефон", konu: "Тема", sec: "Выберите",
      konular: [{ v: "Ürün Bilgisi", l: "Информация о товаре" }, { v: "Fiyat Talebi", l: "Запрос цены" }, { v: "İhracat", l: "Экспорт" }, { v: "Katalog", l: "Запрос каталога" }, { v: "Özel Kalıp", l: "Индивидуальная пресс-форма" }, { v: "Diğer", l: "Другое" }],
      mesaj: "Ваше сообщение *", hata: "Произошла ошибка, попробуйте ещё раз.", gonderiliyor: "Отправка...", gonder: "Отправить →", kvkk: "Ваши персональные данные обрабатываются в соответствии с законом о защите данных (KVKK).",
    },
    altbilgi: {
      kolonlar: [
        { baslik: "Продукция", ogeler: [
          { ad: "Модели горшков", href: "/ru?kategori=saksi#collection" },
          { ad: "Корзины", href: "/ru?kategori=sepet#collection" },
          { ad: "Ящики для хранения", href: "/ru?kategori=sandik#collection" },
          { ad: "Товары для дома", href: "/ru?kategori=ev#collection" },
          { ad: "Товары для сада", href: "/ru?kategori=bahce#collection" },
          { ad: "Заказное производство", href: "/ru#contact" },
        ] },
        { baslik: "Компания", ogeler: [
          { ad: "О нас", href: "/ru/hakkimizda" },
          { ad: "Процесс производства", href: "/ru/uretim-sureci" },
          { ad: "Экспорт", href: "/ru#export" },
          { ad: "Сертификаты", href: "/ru/sertifikalar" },
          { ad: "Конфиденциальность (KVKK)", href: "/ru/kvkk" },
        ] },
      ],
      iletisimBaslik: "Контакты", adres: "Башакшехир / Стамбул", lider: y => `Лидер в производстве пластиковых изделий с ${y} года.`, dunyaya: yer => `Из ${yer} — в мир.`,
      haklar: "Все права защищены.", yerel: "Стамбул OSB · Сделано в Турции 🇹🇷", varsayilanYer: "Стамбул, Башакшехир OSB",
    },
    asistan: { selam: "Здравствуйте! Я могу ответить на вопросы о продукции Alya Plastik, оптовых заказах и экспорте.", baslik: "ПОМОЩНИК ALYA", alt: "На основе ИИ · ответы могут содержать ошибки", kapat: "Закрыть", ac: "Задать вопрос", soru: "Введите вопрос…", yer: "Введите вопрос…", gonder: "ОТПРАВИТЬ", yaziyor: "печатает…", hata: "Сейчас я не могу ответить, воспользуйтесь формой обратной связи.", baglanti: "Ошибка соединения, попробуйте ещё раз.", aria: "Помощник Alya Plastik", mesajAria: "Ваше сообщение" },
    wa: { metin: "Здравствуйте, я хочу получить информацию о товаре.", buton: "Запросить цену" },
    kategori: { saksi: "Горшки", sepet: "Корзины", sandik: "Ящики", ev: "Товары для дома", bahce: "Сад" },
  },

  zh: {
    htmlLang: "zh-Hans", ogLocale: "zh_CN", dil: "语言",
    meta: {
      baslik: "Alya Plastik | 塑料花盆、收纳篮与储物用品制造商 — 始于1968年",
      aciklama: "自1968年起在伊斯坦布尔生产塑料制品。花盆、收纳篮、周转箱、浴室用品。200多款产品，出口20多个国家。支持B2B批量订购。",
      ogAciklama: "自1968年起在伊斯坦布尔生产塑料制品。花盆、收纳篮、周转箱、浴室及园艺用品。200多款产品，出口20多个国家。",
    },
    nav: { urunler: "产品", koleksiyon: "系列", neden: "为何选择我们", iletisim: "联系我们", teklif: "获取报价 →", waTeklif: "通过 WhatsApp 获取报价 →", menu: "菜单" },
    hero: { since: y => `自${y}年起在伊斯坦布尔生产`, satir: ["伊斯坦布尔", "匠心精神", "品质制造。"], aciklama: y => `花盆、收纳篮和储物用品均由我们自己的模具与注塑生产线制造——${y}年来始终一站式完成。`, teklif: "获取报价 →", katalog: "查看目录", yil: "年经验", model: "产品型号", ulke: "出口国家", koleksiyon: "2024/25 系列", kaydir: "向下滚动", alt: "Alya Plastik 塑料制品系列" },
    marquee: ["塑料花盆", "收纳篮", "周转箱", "B2B", "出口", "1968", "土耳其", "200+ 款式", "20+ 国家", "伊斯坦布尔工业区", "本土生产", "ISO 认证"],
    featured: { etiket: "— 精选产品", baslik: "产品系列", tum: "全部产品 →", yeni: "新品" },
    pin: { surukle: "拖动", baslik: ["百变", "造型。"], urun: "款产品", b2b: "B2B 报价", katalog: ["索取", "产品目录"], form: "填写表单 →", mobEtiket: "系列", mobBaslik: "百变造型。", yeni: "新品" },
    koleksiyon: { model: "款产品", surukleKaydir: "拖动或滑动", tumKatalog: "完整目录", katalog: ["索取", "产品目录"], form: "填写表单 →", yeni: "新品", tumu: "全部" },
    felsefe: { etiket: "我们的生产理念", baslik: ["从创意", "到成品。"], aciklama: "从CAD设计到注塑成型，从质量检验到发货——每一步都在我们位于伊斯坦布尔工业区的工厂内完成。", surec: "我们的生产流程 →", teklif: "获取报价", stat: [["ISO", "认证"], ["72h", "报价回复"], ["B2B", "批量订单"]] },
    neden: {
      miras: y => `${y}年传承`, alinti: ["从模具到发货，", "一站式", "自主生产。"], etiket: "— 为何选择 Alya Plastik", baslik: y => [`${y}年`, "行业积淀。"],
      alt: (y, u) => `${y}年来从伊斯坦布尔走向世界，产品出口至${u}多个国家。`,
      ozellikler: ["通过 ISO 认证的生产工厂", "从模具到货架的完整供应链", "保证72小时内回复报价", "支持定制模具与订制生产", "提供完整的物流与报关文件支持"],
      teklif: "获取报价 →", yeni: "新品",
      stat: [{ label: "年经验", desc: "始于1968年" }, { label: "产品型号", desc: "丰富的产品组合" }, { label: "出口国家", desc: "全球覆盖" }, { label: "本土生产", desc: "土耳其制造" }],
    },
    ihracat: { etiket: "全球覆盖", ulke: "个国家。", aciklama: "从欧洲到中东，从非洲到中亚。提供完整的物流与报关文件支持。", bilgi: "咨询出口事宜 →" },
    iletisim: {
      etiket: "— 联系我们", baslik: ["携手", "共创。"], aciklama: "B2B批量订购、定制模具、出口及产品目录，欢迎联系我们。72小时内回复。",
      eposta: "电子邮件", ihracat: "出口", telefon: "电话", whatsapp: "WhatsApp", alindi: "已收到。", alindiMesaj: "我们将尽快与您联系。",
      ad: "姓名 *", firma: "公司", epostaAlan: "电子邮件 *", telAlan: "电话", konu: "主题", sec: "请选择",
      konular: [{ v: "Ürün Bilgisi", l: "产品信息" }, { v: "Fiyat Talebi", l: "询价" }, { v: "İhracat", l: "出口" }, { v: "Katalog", l: "索取目录" }, { v: "Özel Kalıp", l: "定制模具" }, { v: "Diğer", l: "其他" }],
      mesaj: "留言内容 *", hata: "出现错误，请重试。", gonderiliyor: "发送中...", gonder: "发送 →", kvkk: "我们将依据土耳其个人数据保护法（KVKK）处理您的个人信息。",
    },
    altbilgi: {
      kolonlar: [
        { baslik: "产品", ogeler: [
          { ad: "花盆系列", href: "/zh?kategori=saksi#collection" },
          { ad: "收纳篮", href: "/zh?kategori=sepet#collection" },
          { ad: "储物箱", href: "/zh?kategori=sandik#collection" },
          { ad: "家居用品", href: "/zh?kategori=ev#collection" },
          { ad: "园艺用品", href: "/zh?kategori=bahce#collection" },
          { ad: "定制订单", href: "/zh#contact" },
        ] },
        { baslik: "公司", ogeler: [
          { ad: "关于我们", href: "/zh/hakkimizda" },
          { ad: "生产流程", href: "/zh/uretim-sureci" },
          { ad: "出口", href: "/zh#export" },
          { ad: "认证证书", href: "/zh/sertifikalar" },
          { ad: "隐私政策（KVKK）", href: "/zh/kvkk" },
        ] },
      ],
      iletisimBaslik: "联系方式", adres: "伊斯坦布尔巴沙克舍希尔", lider: y => `自${y}年起，塑料制品制造领域的领先企业。`, dunyaya: yer => `从${yer}走向世界。`,
      haklar: "版权所有。", yerel: "伊斯坦布尔工业区 · 土耳其制造 🇹🇷", varsayilanYer: "伊斯坦布尔巴沙克舍希尔工业区",
    },
    asistan: { selam: "您好！我可以解答有关 Alya Plastik 产品、批量订购或出口的问题。", baslik: "ALYA 智能助手", alt: "由人工智能驱动 · 回答可能有误", kapat: "关闭", ac: "提问", soru: "请输入您的问题…", yer: "请输入您的问题…", gonder: "发送", yaziyor: "正在输入…", hata: "目前无法回答，请使用联系表单。", baglanti: "连接出错，请重试。", aria: "Alya Plastik 助手", mesajAria: "您的留言" },
    wa: { metin: "您好，我想了解产品信息。", buton: "获取报价" },
    kategori: { saksi: "花盆", sepet: "收纳篮", sandik: "周转箱", ev: "家居用品", bahce: "园艺" },
  },
  de: {
    htmlLang: "de", ogLocale: "de_DE", dil: "Sprache",
    meta: {
      baslik: "Alya Plastik | Hersteller von Kunststoff-Blumentöpfen, Körben & Aufbewahrung — seit 1968",
      aciklama: "Kunststoffproduktion in Istanbul seit 1968. Blumentöpfe, Körbe, Kisten und Badartikel. Über 200 Modelle, Export in mehr als 20 Länder. B2B-Großbestellungen.",
      ogAciklama: "Herstellung von Kunststoffprodukten in Istanbul seit 1968. Töpfe, Körbe, Kisten, Bad- und Gartenartikel. Über 200 Modelle, Export in mehr als 20 Länder.",
    },
    nav: { urunler: "Produkte", koleksiyon: "Kollektion", neden: "Warum Alya", iletisim: "Kontakt", teklif: "Angebot anfordern →", waTeklif: "Angebot per WhatsApp anfordern →", menu: "Menü" },
    hero: { since: y => `Produktion in Istanbul seit ${y}`, satir: ["HERGESTELLT IN", "ISTANBUL,", "MIT HANDWERK."], aciklama: y => `Wir fertigen Töpfe, Körbe und Aufbewahrungsprodukte auf unseren eigenen Werkzeug- und Spritzgusslinien — ${y} Jahre unter einem Dach.`, teklif: "Angebot anfordern →", katalog: "Katalog ansehen", yil: "Jahre Erfahrung", model: "Produktmodelle", ulke: "Exportländer", koleksiyon: "KOLLEKTION 2024/25", kaydir: "SCROLLEN", alt: "Alya Plastik Kollektion an Kunststoffprodukten" },
    marquee: ["Kunststofftöpfe", "Körbe", "Kisten", "B2B", "Export", "1968", "Türkiye", "200+ Modelle", "20+ Länder", "Istanbul OSB", "Eigene Produktion", "ISO-zertifiziert"],
    featured: { etiket: "— Ausgewählte Produkte", baslik: "KOLLEKTION", tum: "Alle Produkte →", yeni: "Neu" },
    pin: { surukle: "Ziehen", baslik: ["ALLE", "FOR", "MEN."], urun: "Produkte", b2b: "B2B-Angebot", katalog: ["KATALOG", "ANFORDERN"], form: "Formular ausfüllen →", mobEtiket: "Kollektion", mobBaslik: "ALLE FORMEN.", yeni: "NEU" },
    koleksiyon: { model: "MODELLE", surukleKaydir: "Ziehen oder wischen", tumKatalog: "Gesamtkatalog", katalog: ["KATALOG", "ANFORDERN"], form: "Formular ausfüllen →", yeni: "Neu", tumu: "Alle" },
    felsefe: { etiket: "Unsere Produktionsphilosophie", baslik: ["VON DER IDEE", "ZUR FORM."], aciklama: "Vom CAD-Entwurf über den Spritzguss und die Qualitätskontrolle bis zum Versand — jeder Schritt findet in unserem Werk im Istanbuler OSB statt.", surec: "Unser Produktionsprozess →", teklif: "Angebot anfordern", stat: [["ISO", "Zertifiziert"], ["72h", "Angebotsfrist"], ["B2B", "Großbestellungen"]] },
    neden: {
      miras: y => `${y} Jahre Tradition`, alinti: ["VOM WERKZEUG BIS ZUM VERSAND,", "UNTER EINEM DACH", "PRODUZIEREN WIR."], etiket: "— Warum Alya Plastik", baslik: y => [`${y} JAHRE`, "ERFAHRUNG."],
      alt: (y, u) => `Seit ${y} Jahren von Istanbul in die Welt. Export in mehr als ${u} Länder.`,
      ozellikler: ["ISO-zertifizierter Produktionsstandort", "Komplette Lieferkette vom Werkzeug bis ins Regal", "Angebot innerhalb von 72 Stunden garantiert", "Sonderwerkzeuge und Auftragsfertigung", "Umfassende Unterstützung bei Logistik und Zolldokumenten"],
      teklif: "Angebot anfordern →", yeni: "Neu",
      stat: [{ label: "Jahre Erfahrung", desc: "Seit 1968" }, { label: "Produktmodelle", desc: "Breites Sortiment" }, { label: "Exportländer", desc: "Weltweite Reichweite" }, { label: "Eigene Produktion", desc: "Made in Türkiye" }],
    },
    ihracat: { etiket: "Weltweite Reichweite", ulke: "LÄNDER.", aciklama: "Von Europa bis in den Nahen Osten, von Afrika bis Zentralasien. Umfassende Unterstützung bei Logistik und Zolldokumenten.", bilgi: "Mehr zum Export →" },
    iletisim: {
      etiket: "— Kontakt", baslik: ["LASSEN SIE UNS", "GEMEINSAM PRODUZIEREN."], aciklama: "Kontaktieren Sie uns für B2B-Großbestellungen, Sonderwerkzeuge, Export und Kataloge. 72-Stunden-Antwortgarantie.",
      eposta: "E-Mail", ihracat: "Export", telefon: "Telefon", whatsapp: "WhatsApp", alindi: "ERHALTEN.", alindiMesaj: "Wir melden uns so schnell wie möglich bei Ihnen.",
      ad: "Vor- und Nachname *", firma: "Unternehmen", epostaAlan: "E-Mail *", telAlan: "Telefon", konu: "Betreff", sec: "Auswählen",
      konular: [{ v: "Ürün Bilgisi", l: "Produktinformationen" }, { v: "Fiyat Talebi", l: "Preisanfrage" }, { v: "İhracat", l: "Export" }, { v: "Katalog", l: "Katalogbestellung" }, { v: "Özel Kalıp", l: "Sonderwerkzeug" }, { v: "Diğer", l: "Sonstiges" }],
      mesaj: "Ihre Nachricht *", hata: "Es ist ein Fehler aufgetreten, bitte versuchen Sie es erneut.", gonderiliyor: "Wird gesendet...", gonder: "Senden →", kvkk: "Ihre personenbezogenen Daten werden gemäß dem geltenden Datenschutzgesetz (KVKK) verarbeitet.",
    },
    altbilgi: {
      kolonlar: [
        { baslik: "Produkte", ogeler: [
          { ad: "Blumentopf-Modelle", href: "/de?kategori=saksi#collection" },
          { ad: "Körbe", href: "/de?kategori=sepet#collection" },
          { ad: "Aufbewahrungskisten", href: "/de?kategori=sandik#collection" },
          { ad: "Haushaltsartikel", href: "/de?kategori=ev#collection" },
          { ad: "Gartenprodukte", href: "/de?kategori=bahce#collection" },
          { ad: "Sonderanfertigungen", href: "/de#contact" },
        ] },
        { baslik: "Unternehmen", ogeler: [
          { ad: "Über uns", href: "/de/hakkimizda" },
          { ad: "Produktionsprozess", href: "/de/uretim-sureci" },
          { ad: "Export", href: "/de#export" },
          { ad: "Zertifikate", href: "/de/sertifikalar" },
          { ad: "Datenschutz (KVKK)", href: "/de/kvkk" },
        ] },
      ],
      iletisimBaslik: "Kontakt", adres: "Başakşehir / Istanbul", lider: y => `Führend in der Kunststoffproduktion seit ${y}.`, dunyaya: yer => `Von ${yer} in die Welt.`,
      haklar: "Alle Rechte vorbehalten.", yerel: "Istanbul OSB · Made in Türkiye 🇹🇷", varsayilanYer: "Istanbul Başakşehir OSB",
    },
    asistan: { selam: "Hallo! Ich beantworte gern Ihre Fragen zu Alya-Plastik-Produkten, Großbestellungen oder Export.", baslik: "ALYA ASSISTENT", alt: "KI-gestützt · Antworten können Fehler enthalten", kapat: "Schließen", ac: "Frage stellen", soru: "Stellen Sie Ihre Frage…", yer: "Stellen Sie Ihre Frage…", gonder: "SENDEN", yaziyor: "schreibt…", hata: "Ich kann gerade nicht antworten, bitte nutzen Sie das Kontaktformular.", baglanti: "Verbindungsfehler, bitte versuchen Sie es erneut.", aria: "Alya-Plastik-Assistent", mesajAria: "Ihre Nachricht" },
    wa: { metin: "Hallo, ich möchte Informationen zu einem Produkt erhalten.", buton: "Angebot anfordern" },
    kategori: { saksi: "Blumentöpfe", sepet: "Körbe", sandik: "Kisten", ev: "Haushaltsartikel", bahce: "Garten" },
  },

  fr: {
    htmlLang: "fr", ogLocale: "fr_FR", dil: "Langue",
    meta: {
      baslik: "Alya Plastik | Fabricant de pots de fleurs, paniers et rangements en plastique — depuis 1968",
      aciklama: "Fabricant de produits en plastique à Istanbul depuis 1968. Pots de fleurs, paniers, caisses et articles de salle de bain. Plus de 200 modèles, export dans plus de 20 pays. Commandes en gros B2B.",
      ogAciklama: "Fabrication de produits en plastique à Istanbul depuis 1968. Pots, paniers, caisses, articles de salle de bain et de jardin. Plus de 200 modèles, export dans plus de 20 pays.",
    },
    nav: { urunler: "Produits", koleksiyon: "Collection", neden: "Pourquoi Alya", iletisim: "Contact", teklif: "Demander un devis →", waTeklif: "Demander un devis sur WhatsApp →", menu: "Menu" },
    hero: { since: y => `Fabrication à Istanbul depuis ${y}`, satir: ["FABRIQUÉ À", "ISTANBUL,", "AVEC SAVOIR-FAIRE."], aciklama: y => `Nous fabriquons pots, paniers et produits de rangement sur nos propres lignes de moules et d'injection — ${y} ans sous un même toit.`, teklif: "Demander un devis →", katalog: "Voir le catalogue", yil: "Ans d'expérience", model: "Modèles de produits", ulke: "Pays d'export", koleksiyon: "COLLECTION 2024/25", kaydir: "DÉFILER", alt: "Collection de produits en plastique Alya Plastik" },
    marquee: ["Pots en plastique", "Paniers", "Caisses", "B2B", "Export", "1968", "Türkiye", "200+ modèles", "20+ pays", "Istanbul OSB", "Production locale", "Certifié ISO"],
    featured: { etiket: "— Produits à la une", baslik: "COLLECTION", tum: "Tous les produits →", yeni: "Nouveau" },
    pin: { surukle: "Glisser", baslik: ["TOUTES", "LES FOR", "MES."], urun: "produits", b2b: "Devis B2B", katalog: ["DEMANDER LE", "CATALOGUE"], form: "Remplir le formulaire →", mobEtiket: "Collection", mobBaslik: "TOUTES LES FORMES.", yeni: "NOUVEAU" },
    koleksiyon: { model: "MODÈLES", surukleKaydir: "Glisser ou faire défiler", tumKatalog: "Catalogue complet", katalog: ["DEMANDER LE", "CATALOGUE"], form: "Remplir le formulaire →", yeni: "Nouveau", tumu: "Tout" },
    felsefe: { etiket: "Notre philosophie de production", baslik: ["DE L'IDÉE", "À LA FORME."], aciklama: "De la conception CAO à l'injection, du contrôle qualité à l'expédition — chaque étape a lieu dans notre usine de la zone industrielle d'Istanbul.", surec: "Notre processus de production →", teklif: "Demander un devis", stat: [["ISO", "Certifié"], ["72h", "Délai de devis"], ["B2B", "Commandes en gros"]] },
    neden: {
      miras: y => `${y} ans d'héritage`, alinti: ["DU MOULE À L'EXPÉDITION,", "SOUS UN MÊME TOIT", "NOUS FABRIQUONS."], etiket: "— Pourquoi Alya Plastik", baslik: y => [`${y} ANS`, "D'EXPERTISE."],
      alt: (y, u) => `D'Istanbul vers le monde depuis ${y} ans. Export dans plus de ${u} pays.`,
      ozellikler: ["Site de production certifié ISO", "Chaîne d'approvisionnement complète, du moule au rayon", "Devis garanti sous 72 heures", "Moules sur mesure et fabrication à la commande", "Accompagnement complet en logistique et documents douaniers"],
      teklif: "Demander un devis →", yeni: "Nouveau",
      stat: [{ label: "Ans d'expérience", desc: "Depuis 1968" }, { label: "Modèles de produits", desc: "Large gamme" }, { label: "Pays d'export", desc: "Portée mondiale" }, { label: "Production locale", desc: "Made in Türkiye" }],
    },
    ihracat: { etiket: "Portée mondiale", ulke: "PAYS.", aciklama: "De l'Europe au Moyen-Orient, de l'Afrique à l'Asie centrale. Accompagnement complet en logistique et documents douaniers.", bilgi: "En savoir plus sur l'export →" },
    iletisim: {
      etiket: "— Contact", baslik: ["PRODUISONS", "ENSEMBLE."], aciklama: "Contactez-nous pour les commandes en gros B2B, les moules sur mesure, l'export et les catalogues. Réponse garantie sous 72 heures.",
      eposta: "E-mail", ihracat: "Export", telefon: "Téléphone", whatsapp: "WhatsApp", alindi: "REÇU.", alindiMesaj: "Nous vous répondrons dans les meilleurs délais.",
      ad: "Nom et prénom *", firma: "Société", epostaAlan: "E-mail *", telAlan: "Téléphone", konu: "Objet", sec: "Sélectionner",
      konular: [{ v: "Ürün Bilgisi", l: "Informations produit" }, { v: "Fiyat Talebi", l: "Demande de prix" }, { v: "İhracat", l: "Export" }, { v: "Katalog", l: "Demande de catalogue" }, { v: "Özel Kalıp", l: "Moule sur mesure" }, { v: "Diğer", l: "Autre" }],
      mesaj: "Votre message *", hata: "Une erreur s'est produite, veuillez réessayer.", gonderiliyor: "Envoi en cours...", gonder: "Envoyer →", kvkk: "Vos données personnelles sont traitées conformément à la loi applicable sur la protection des données (KVKK).",
    },
    altbilgi: {
      kolonlar: [
        { baslik: "Produits", ogeler: [
          { ad: "Modèles de pots de fleurs", href: "/fr?kategori=saksi#collection" },
          { ad: "Paniers", href: "/fr?kategori=sepet#collection" },
          { ad: "Caisses de rangement", href: "/fr?kategori=sandik#collection" },
          { ad: "Articles ménagers", href: "/fr?kategori=ev#collection" },
          { ad: "Produits de jardin", href: "/fr?kategori=bahce#collection" },
          { ad: "Commandes sur mesure", href: "/fr#contact" },
        ] },
        { baslik: "Entreprise", ogeler: [
          { ad: "À propos", href: "/fr/hakkimizda" },
          { ad: "Processus de production", href: "/fr/uretim-sureci" },
          { ad: "Export", href: "/fr#export" },
          { ad: "Certificats", href: "/fr/sertifikalar" },
          { ad: "Confidentialité (KVKK)", href: "/fr/kvkk" },
        ] },
      ],
      iletisimBaslik: "Contact", adres: "Başakşehir / Istanbul", lider: y => `Leader de la fabrication de produits en plastique depuis ${y}.`, dunyaya: yer => `De ${yer} vers le monde.`,
      haklar: "Tous droits réservés.", yerel: "Istanbul OSB · Made in Türkiye 🇹🇷", varsayilanYer: "Istanbul Başakşehir OSB",
    },
    asistan: { selam: "Bonjour ! Je peux répondre à vos questions sur les produits Alya Plastik, les commandes en gros ou l'export.", baslik: "ASSISTANT ALYA", alt: "Propulsé par l'IA · les réponses peuvent contenir des erreurs", kapat: "Fermer", ac: "Poser une question", soru: "Saisissez votre question…", yer: "Saisissez votre question…", gonder: "ENVOYER", yaziyor: "écrit…", hata: "Je ne peux pas répondre pour le moment, veuillez utiliser le formulaire de contact.", baglanti: "Erreur de connexion, veuillez réessayer.", aria: "Assistant Alya Plastik", mesajAria: "Votre message" },
    wa: { metin: "Bonjour, je souhaite obtenir des informations sur un produit.", buton: "Demander un devis" },
    kategori: { saksi: "Pots de fleurs", sepet: "Paniers", sandik: "Caisses", ev: "Articles ménagers", bahce: "Jardin" },
  },

  ar: {
    htmlLang: "ar", ogLocale: "ar_AR", dil: "اللغة",
    meta: {
      baslik: "Alya Plastik | مصنّع أحواض الزهور والسلال وحلول التخزين البلاستيكية — منذ 1968",
      aciklama: "تصنيع المنتجات البلاستيكية في إسطنبول منذ عام 1968. أحواض زهور وسلال وصناديق ومنتجات للحمّام. أكثر من 200 طراز وتصدير إلى أكثر من 20 دولة. طلبات الجملة للشركات.",
      ogAciklama: "تصنيع المنتجات البلاستيكية في إسطنبول منذ عام 1968. أحواض وسلال وصناديق ومنتجات للحمّام والحديقة. أكثر من 200 طراز وتصدير إلى أكثر من 20 دولة.",
    },
    nav: { urunler: "المنتجات", koleksiyon: "المجموعة", neden: "لماذا ألْيا", iletisim: "اتصل بنا", teklif: "اطلب عرض سعر ←", waTeklif: "اطلب عرض سعر عبر واتساب ←", menu: "القائمة" },
    hero: { since: y => `نصنع في إسطنبول منذ ${y}`, satir: ["صُنع في", "إسطنبول،", "بإتقان."], aciklama: y => `نصنع الأحواض والسلال ومنتجات التخزين على خطوط القوالب والحقن الخاصة بنا — ${y} عامًا تحت سقف واحد.`, teklif: "اطلب عرض سعر ←", katalog: "تصفّح الكتالوج", yil: "سنوات من الخبرة", model: "طرازات المنتجات", ulke: "دول التصدير", koleksiyon: "مجموعة 2024/25", kaydir: "مرّر", alt: "مجموعة منتجات ألْيا بلاستيك" },
    marquee: ["أحواض بلاستيكية", "سلال", "صناديق", "للشركات B2B", "تصدير", "1968", "تركيا", "أكثر من 200 طراز", "أكثر من 20 دولة", "منطقة إسطنبول الصناعية", "إنتاج محلي", "معتمد ISO"],
    featured: { etiket: "— منتجات مميّزة", baslik: "المجموعة", tum: "كل المنتجات ←", yeni: "جديد" },
    pin: { surukle: "اسحب", baslik: ["كل", "الأشكال."], urun: "منتج", b2b: "عرض سعر للشركات", katalog: ["اطلب", "الكتالوج"], form: "املأ النموذج ←", mobEtiket: "المجموعة", mobBaslik: "كل الأشكال.", yeni: "جديد" },
    koleksiyon: { model: "طراز", surukleKaydir: "اسحب أو مرّر", tumKatalog: "الكتالوج الكامل", katalog: ["اطلب", "الكتالوج"], form: "املأ النموذج ←", yeni: "جديد", tumu: "الكل" },
    felsefe: { etiket: "فلسفتنا في التصنيع", baslik: ["من الفكرة", "إلى الشكل."], aciklama: "من التصميم بالحاسوب إلى الحقن، ومن مراقبة الجودة إلى الشحن — كل مرحلة تتم في مصنعنا بالمنطقة الصناعية في إسطنبول.", surec: "عملية الإنتاج لدينا ←", teklif: "اطلب عرض سعر", stat: [["ISO", "معتمد"], ["72 ساعة", "مدة عرض السعر"], ["B2B", "طلبات بالجملة"]] },
    neden: {
      miras: y => `إرث عمره ${y} عامًا`, alinti: ["من القالب إلى الشحن،", "نصنع كل شيء", "تحت سقف واحد."], etiket: "— لماذا ألْيا بلاستيك", baslik: y => [`${y} عامًا`, "من الخبرة."],
      alt: (y, u) => `من إسطنبول إلى العالم منذ ${y} عامًا. نصدّر إلى أكثر من ${u} دولة.`,
      ozellikler: ["منشأة إنتاج معتمدة وفق ISO", "سلسلة توريد متكاملة من القالب إلى الرف", "عرض سعر خلال 72 ساعة بضمان", "قوالب مخصصة وإنتاج حسب الطلب", "دعم كامل في اللوجستيات ووثائق الجمارك"],
      teklif: "اطلب عرض سعر ←", yeni: "جديد",
      stat: [{ label: "سنوات من الخبرة", desc: "منذ عام 1968" }, { label: "طرازات المنتجات", desc: "تشكيلة واسعة" }, { label: "دول التصدير", desc: "حضور عالمي" }, { label: "إنتاج محلي", desc: "صُنع في تركيا" }],
    },
    ihracat: { etiket: "حضور عالمي", ulke: "دولة.", aciklama: "من أوروبا إلى الشرق الأوسط، ومن أفريقيا إلى آسيا الوسطى. دعم كامل في اللوجستيات ووثائق الجمارك.", bilgi: "استفسر عن التصدير ←" },
    iletisim: {
      etiket: "— اتصل بنا", baslik: ["لنصنع", "معًا."], aciklama: "تواصل معنا لطلبات الجملة للشركات والقوالب المخصصة والتصدير والكتالوجات. ضمان الرد خلال 72 ساعة.",
      eposta: "البريد الإلكتروني", ihracat: "التصدير", telefon: "الهاتف", whatsapp: "واتساب", alindi: "تم الاستلام.", alindiMesaj: "سنرد عليك في أقرب وقت ممكن.",
      ad: "الاسم الكامل *", firma: "الشركة", epostaAlan: "البريد الإلكتروني *", telAlan: "الهاتف", konu: "الموضوع", sec: "اختر",
      konular: [{ v: "Ürün Bilgisi", l: "معلومات عن منتج" }, { v: "Fiyat Talebi", l: "طلب سعر" }, { v: "İhracat", l: "التصدير" }, { v: "Katalog", l: "طلب كتالوج" }, { v: "Özel Kalıp", l: "قالب مخصص" }, { v: "Diğer", l: "أخرى" }],
      mesaj: "رسالتك *", hata: "حدث خطأ، يرجى المحاولة مرة أخرى.", gonderiliyor: "جارٍ الإرسال...", gonder: "إرسال ←", kvkk: "تتم معالجة بياناتك الشخصية وفقًا لقانون حماية البيانات المعمول به (KVKK).",
    },
    altbilgi: {
      kolonlar: [
        { baslik: "المنتجات", ogeler: [
          { ad: "طرازات أحواض الزهور", href: "/ar?kategori=saksi#collection" },
          { ad: "السلال", href: "/ar?kategori=sepet#collection" },
          { ad: "صناديق التخزين", href: "/ar?kategori=sandik#collection" },
          { ad: "مستلزمات المنزل", href: "/ar?kategori=ev#collection" },
          { ad: "منتجات الحدائق", href: "/ar?kategori=bahce#collection" },
          { ad: "طلبات خاصة", href: "/ar#contact" },
        ] },
        { baslik: "الشركة", ogeler: [
          { ad: "من نحن", href: "/ar/hakkimizda" },
          { ad: "عملية الإنتاج", href: "/ar/uretim-sureci" },
          { ad: "التصدير", href: "/ar#export" },
          { ad: "الشهادات", href: "/ar/sertifikalar" },
          { ad: "الخصوصية (KVKK)", href: "/ar/kvkk" },
        ] },
      ],
      iletisimBaslik: "اتصل بنا", adres: "باشاك شهير / إسطنبول", lider: y => `رائدون في تصنيع المنتجات البلاستيكية منذ ${y}.`, dunyaya: yer => `من ${yer} إلى العالم.`,
      haklar: "جميع الحقوق محفوظة.", yerel: "منطقة إسطنبول الصناعية · صُنع في تركيا 🇹🇷", varsayilanYer: "المنطقة الصناعية في باشاك شهير، إسطنبول",
    },
    asistan: { selam: "مرحبًا! يمكنني الإجابة عن أسئلتك حول منتجات ألْيا بلاستيك وطلبات الجملة والتصدير.", baslik: "مساعد ألْيا", alt: "مدعوم بالذكاء الاصطناعي · قد تحتوي الإجابات على أخطاء", kapat: "إغلاق", ac: "اطرح سؤالًا", soru: "اكتب سؤالك…", yer: "اكتب سؤالك…", gonder: "إرسال", yaziyor: "يكتب…", hata: "لا يمكنني الرد الآن، يرجى استخدام نموذج الاتصال.", baglanti: "حدث خطأ في الاتصال، يرجى المحاولة مرة أخرى.", aria: "مساعد ألْيا بلاستيك", mesajAria: "رسالتك" },
    wa: { metin: "مرحبًا، أودّ الحصول على معلومات عن أحد المنتجات.", buton: "اطلب عرض سعر" },
    kategori: { saksi: "أحواض الزهور", sepet: "السلال", sandik: "الصناديق", ev: "مستلزمات المنزل", bahce: "الحديقة" },
  },
};

export const dilYolu = (d: Dil) => (d === "tr" ? "/" : `/${d}`);
export const bolumYolu = (d: Dil, id: string) => `${d === "tr" ? "/" : `/${d}`}#${id}`;
/** Anasayfadaki ürün koleksiyonunu belirli bir kategori seçiliyken açan link (mega menü, footer). */
export const kategoriYolu = (d: Dil, kategori: string) => `${dilYolu(d)}?kategori=${kategori}#collection`;
/** Ürün kategori adı: sözlükte varsa çeviri, yoksa veritabanındaki ad/slug. */
/** "saksı" gibi Türkçe karakterli değerleri harita anahtarlarıyla ("saksi") eşleştirmek için normalize eder. */
const kategoriAnahtar = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/[çğıöşü]/g, c => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" } as Record<string, string>)[c]);
export const kategoriGoster = (d: Dil, slug: string | null | undefined, harita?: Record<string, string>) => {
  if (!slug) return "";
  const k = kategoriAnahtar(slug);
  return M[d].kategori[slug] || M[d].kategori[k] || harita?.[slug] || harita?.[k] || slug;
};
