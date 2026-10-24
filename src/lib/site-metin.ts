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
