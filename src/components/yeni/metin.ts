import type { Dil } from "@/lib/diller";

// Yeni (açık renkli) ana sayfa metinleri — 4 dil. Ürün/kategori adları veriden gelir.
export type YMetin = {
  ustLink: { hakkimizda: string; uretim: string; sertifika: string; katalog: string };
  nav: { anasayfa: string; kurumsal: string; urunler: string; katalog: string; iletisim: string; teklif: string; ara: string; sonucYok: string; menu: string };
  slayt: { etiket: string; baslik: string; alt: string; dugme: string; href: "uretim" | "urunler" | "iletisim" | "katalog" }[];
  katBolum: { etiket: string; baslik: string; alt: string; model: string; tumUrun: string; temizle: string };
  yeni: { baslik: string; tum: string; yeni: string };
  koleksiyon: { baslik: string; alt: string; ic: { ad: string; alt: string }; dis: { ad: string; alt: string }; incele: string };
  uretim: { etiket: string; baslik: (m: number) => string; alt: string; yil: string; ulke: string; model: string; kesfet: string };
  katalogKutu: { etiket: string; baslik: string; alt: string; dugme: string };
  b2b: { etiket: string; baslik: string; alt: string; dugme: string };
  alt: { kurumsal: string; urunler: string; tum: string; ozel: string; iletisim: string; haklar: string };
  hakkimizdaAd: string; uretimAd: string; sertifikaAd: string; katalogAd: string;
};

export const Y: Record<Dil, YMetin> = {
  tr: {
    ustLink: { hakkimizda: "Hakkımızda", uretim: "Üretim Süreci", sertifika: "Sertifikalar", katalog: "Katalog" },
    nav: { anasayfa: "Ana Sayfa", kurumsal: "Kurumsal", urunler: "Ürünler", katalog: "Katalog", iletisim: "İletişim", teklif: "Teklif İste", ara: "Ürün ara", sonucYok: "Sonuç bulunamadı", menu: "Menü" },
    slayt: [
      { etiket: "KÖKLÜ GEÇMİŞ, GÜÇLÜ ÜRETİM", baslik: "1968'den beri plastik üretiyoruz", alt: "Saksı, sepet ve depolama ürünleri — kendi kalıp ve enjeksiyon hatlarımızda", dugme: "Bizi tanıyın", href: "uretim" },
      { etiket: "GENİŞ ÜRÜN GAMI", baslik: "200'den fazla model, tek çatı altında", alt: "İç mekan ve dış mekan koleksiyonlarımızı keşfedin", dugme: "Ürünleri inceleyin", href: "urunler" },
      { etiket: "İHRACAT", baslik: "20'den fazla ülkeye ihracat", alt: "Toptan sipariş, özel kalıp ve markalı üretim için ekibimizle görüşün", dugme: "Teklif iste", href: "iletisim" },
    ],
    katBolum: { etiket: "ÜRÜN GRUPLARI", baslik: "Kategoriye göre keşfedin", alt: "Bir kategori seçin, ürünler aşağıda süzülsün", model: "model", tumUrun: "Tüm ürünler", temizle: "Süzgeci temizle" },
    yeni: { baslik: "Yeni modeller", tum: "Tümünü gör", yeni: "YENİ" },
    koleksiyon: { baslik: "Koleksiyonlarımız", alt: "İki koleksiyon, tek üretici", ic: { ad: "İç Mekan", alt: "Salon, balkon ve ev için" }, dis: { ad: "Dış Mekan", alt: "Bahçe, teras ve peyzaj için" }, incele: "İncele" },
    uretim: { etiket: "ÜRETİM", baslik: m => `${m}'den fazla model, kendi tesisimizde`, alt: "İstanbul OSB'deki tesisimizde kalıptan sevkiyata tüm süreci kendimiz yönetiyoruz.", yil: "kuruluş", ulke: "ihracat ülkesi", model: "model", kesfet: "Üretimi keşfedin" },
    katalogKutu: { etiket: "KATALOG", baslik: "Tüm modeller tek katalogda", alt: "Güncel ürün kataloğumuzu inceleyin.", dugme: "Kataloğu aç" },
    b2b: { etiket: "B2B", baslik: "Alya Plastik ile iş birliği", alt: "Bayi, toptancı, ihracat ve özel üretim talepleriniz için ekibimizle görüşün.", dugme: "Teklif iste" },
    alt: { kurumsal: "Kurumsal", urunler: "Ürünler", tum: "Tüm ürünler", ozel: "Özel sipariş", iletisim: "İletişim", haklar: "Tüm hakları saklıdır." },
    hakkimizdaAd: "Hakkımızda", uretimAd: "Üretim Süreci", sertifikaAd: "Sertifikalar", katalogAd: "Katalog",
  },
  en: {
    ustLink: { hakkimizda: "About", uretim: "Production", sertifika: "Certificates", katalog: "Catalog" },
    nav: { anasayfa: "Home", kurumsal: "Company", urunler: "Products", katalog: "Catalog", iletisim: "Contact", teklif: "Get a Quote", ara: "Search products", sonucYok: "No results", menu: "Menu" },
    slayt: [
      { etiket: "ROOTED HISTORY, STRONG PRODUCTION", baslik: "Manufacturing plastics since 1968", alt: "Pots, baskets and storage — made on our own molds and injection lines", dugme: "About us", href: "uretim" },
      { etiket: "WIDE PRODUCT RANGE", baslik: "200+ models under one roof", alt: "Discover our indoor and outdoor collections", dugme: "Browse products", href: "urunler" },
      { etiket: "EXPORT", baslik: "Exporting to 20+ countries", alt: "Talk to our team about wholesale, custom molds and private label", dugme: "Get a quote", href: "iletisim" },
    ],
    katBolum: { etiket: "PRODUCT GROUPS", baslik: "Explore by category", alt: "Pick a category to filter the products below", model: "models", tumUrun: "All products", temizle: "Clear filter" },
    yeni: { baslik: "New models", tum: "View all", yeni: "NEW" },
    koleksiyon: { baslik: "Our collections", alt: "Two collections, one manufacturer", ic: { ad: "Indoor", alt: "For living rooms, balconies and homes" }, dis: { ad: "Outdoor", alt: "For gardens, terraces and landscaping" }, incele: "Explore" },
    uretim: { etiket: "PRODUCTION", baslik: m => `${m}+ models made in our own facility`, alt: "At our Istanbul OSB plant we manage everything from mold to shipment ourselves.", yil: "founded", ulke: "export countries", model: "models", kesfet: "Discover production" },
    katalogKutu: { etiket: "CATALOG", baslik: "All models in one catalog", alt: "Browse our current product catalog.", dugme: "Open catalog" },
    b2b: { etiket: "B2B", baslik: "Partner with Alya Plastik", alt: "Talk to our team about dealers, wholesale, export and custom production.", dugme: "Get a quote" },
    alt: { kurumsal: "Company", urunler: "Products", tum: "All products", ozel: "Custom orders", iletisim: "Contact", haklar: "All rights reserved." },
    hakkimizdaAd: "About", uretimAd: "Production", sertifikaAd: "Certificates", katalogAd: "Catalog",
  },
  ru: {
    ustLink: { hakkimizda: "О нас", uretim: "Производство", sertifika: "Сертификаты", katalog: "Каталог" },
    nav: { anasayfa: "Главная", kurumsal: "О компании", urunler: "Продукция", katalog: "Каталог", iletisim: "Контакты", teklif: "Запросить цену", ara: "Поиск товаров", sonucYok: "Ничего не найдено", menu: "Меню" },
    slayt: [
      { etiket: "ГЛУБОКИЕ КОРНИ, МОЩНОЕ ПРОИЗВОДСТВО", baslik: "Производим пластик с 1968 года", alt: "Горшки, корзины и системы хранения — на собственных пресс-формах и линиях литья", dugme: "О нас", href: "uretim" },
      { etiket: "ШИРОКИЙ АССОРТИМЕНТ", baslik: "Более 200 моделей под одной крышей", alt: "Коллекции для дома и для сада", dugme: "Смотреть продукцию", href: "urunler" },
      { etiket: "ЭКСПОРТ", baslik: "Экспорт в более чем 20 стран", alt: "Опт, индивидуальные формы и собственная торговая марка — свяжитесь с нами", dugme: "Запросить цену", href: "iletisim" },
    ],
    katBolum: { etiket: "ГРУППЫ ТОВАРОВ", baslik: "Выберите категорию", alt: "Выберите категорию — товары ниже отфильтруются", model: "моделей", tumUrun: "Вся продукция", temizle: "Сбросить фильтр" },
    yeni: { baslik: "Новые модели", tum: "Смотреть все", yeni: "НОВИНКА" },
    koleksiyon: { baslik: "Наши коллекции", alt: "Две коллекции, один производитель", ic: { ad: "Для дома", alt: "Для комнат, балконов и интерьера" }, dis: { ad: "Для улицы", alt: "Для сада, террасы и ландшафта" }, incele: "Смотреть" },
    uretim: { etiket: "ПРОИЗВОДСТВО", baslik: m => `Более ${m} моделей на собственном заводе`, alt: "На нашем заводе в Стамбуле мы сами ведём весь процесс — от пресс-формы до отгрузки.", yil: "основана", ulke: "стран экспорта", model: "моделей", kesfet: "О производстве" },
    katalogKutu: { etiket: "КАТАЛОГ", baslik: "Все модели в одном каталоге", alt: "Ознакомьтесь с актуальным каталогом.", dugme: "Открыть каталог" },
    b2b: { etiket: "B2B", baslik: "Сотрудничество с Alya Plastik", alt: "Дилеры, опт, экспорт и индивидуальное производство — свяжитесь с нашей командой.", dugme: "Запросить цену" },
    alt: { kurumsal: "О компании", urunler: "Продукция", tum: "Вся продукция", ozel: "Индивидуальный заказ", iletisim: "Контакты", haklar: "Все права защищены." },
    hakkimizdaAd: "О нас", uretimAd: "Производство", sertifikaAd: "Сертификаты", katalogAd: "Каталог",
  },
  zh: {
    ustLink: { hakkimizda: "关于我们", uretim: "生产工艺", sertifika: "认证", katalog: "产品目录" },
    nav: { anasayfa: "首页", kurumsal: "公司", urunler: "产品", katalog: "目录", iletisim: "联系", teklif: "获取报价", ara: "搜索产品", sonucYok: "未找到结果", menu: "菜单" },
    slayt: [
      { etiket: "深厚历史，强大制造", baslik: "自1968年起生产塑料制品", alt: "花盆、篮子和收纳产品——使用自有模具和注塑生产线", dugme: "了解我们", href: "uretim" },
      { etiket: "丰富产品线", baslik: "200多款型号，一站式提供", alt: "探索我们的室内和户外系列", dugme: "浏览产品", href: "urunler" },
      { etiket: "出口", baslik: "出口至20多个国家", alt: "批发、定制模具和贴牌生产，欢迎联系我们", dugme: "获取报价", href: "iletisim" },
    ],
    katBolum: { etiket: "产品分类", baslik: "按类别浏览", alt: "选择类别，下方产品将自动筛选", model: "款", tumUrun: "全部产品", temizle: "清除筛选" },
    yeni: { baslik: "新品", tum: "查看全部", yeni: "新品" },
    koleksiyon: { baslik: "我们的系列", alt: "两大系列，同一制造商", ic: { ad: "室内", alt: "适用于客厅、阳台和家居" }, dis: { ad: "户外", alt: "适用于花园、露台和园林" }, incele: "查看" },
    uretim: { etiket: "生产", baslik: m => `${m}多款型号，自有工厂生产`, alt: "在伊斯坦布尔工厂，我们自行管理从模具到发货的全部流程。", yil: "成立", ulke: "出口国家", model: "款型号", kesfet: "了解生产" },
    katalogKutu: { etiket: "目录", baslik: "所有型号尽在一本目录", alt: "查看我们最新的产品目录。", dugme: "打开目录" },
    b2b: { etiket: "B2B", baslik: "与 Alya Plastik 合作", alt: "经销、批发、出口和定制生产，欢迎联系我们的团队。", dugme: "获取报价" },
    alt: { kurumsal: "公司", urunler: "产品", tum: "全部产品", ozel: "定制订单", iletisim: "联系", haklar: "版权所有。" },
    hakkimizdaAd: "关于我们", uretimAd: "生产工艺", sertifikaAd: "认证", katalogAd: "产品目录",
  },
  de: {
    ustLink: { hakkimizda: "Über uns", uretim: "Produktion", sertifika: "Zertifikate", katalog: "Katalog" },
    nav: { anasayfa: "Startseite", kurumsal: "Unternehmen", urunler: "Produkte", katalog: "Katalog", iletisim: "Kontakt", teklif: "Angebot anfordern", ara: "Produkte suchen", sonucYok: "Keine Ergebnisse", menu: "Menü" },
    slayt: [
      { etiket: "TRADITION UND STARKE PRODUKTION", baslik: "Wir produzieren Kunststoffprodukte seit 1968", alt: "Töpfe, Körbe und Aufbewahrung — gefertigt auf unseren eigenen Werkzeug- und Spritzgusslinien", dugme: "Über uns", href: "uretim" },
      { etiket: "BREITES SORTIMENT", baslik: "Über 200 Modelle unter einem Dach", alt: "Entdecken Sie unsere Indoor- und Outdoor-Kollektionen", dugme: "Produkte ansehen", href: "urunler" },
      { etiket: "EXPORT", baslik: "Export in mehr als 20 Länder", alt: "Sprechen Sie mit uns über Großhandel, Sonderwerkzeuge und Eigenmarken", dugme: "Angebot anfordern", href: "iletisim" },
    ],
    katBolum: { etiket: "PRODUKTGRUPPEN", baslik: "Nach Kategorie entdecken", alt: "Wählen Sie eine Kategorie, die Produkte unten werden gefiltert", model: "Modelle", tumUrun: "Alle Produkte", temizle: "Filter zurücksetzen" },
    yeni: { baslik: "Neue Modelle", tum: "Alle ansehen", yeni: "NEU" },
    koleksiyon: { baslik: "Unsere Kollektionen", alt: "Zwei Kollektionen, ein Hersteller", ic: { ad: "Indoor", alt: "Für Wohnzimmer, Balkone und Zuhause" }, dis: { ad: "Outdoor", alt: "Für Garten, Terrasse und Landschaftsbau" }, incele: "Entdecken" },
    uretim: { etiket: "PRODUKTION", baslik: m => `Über ${m} Modelle aus eigener Fertigung`, alt: "In unserem Werk im Istanbuler OSB steuern wir den gesamten Prozess vom Werkzeug bis zum Versand selbst.", yil: "gegründet", ulke: "Exportländer", model: "Modelle", kesfet: "Produktion entdecken" },
    katalogKutu: { etiket: "KATALOG", baslik: "Alle Modelle in einem Katalog", alt: "Stöbern Sie in unserem aktuellen Produktkatalog.", dugme: "Katalog öffnen" },
    b2b: { etiket: "B2B", baslik: "Partner von Alya Plastik werden", alt: "Sprechen Sie mit unserem Team über Händlerschaft, Großhandel, Export und Auftragsfertigung.", dugme: "Angebot anfordern" },
    alt: { kurumsal: "Unternehmen", urunler: "Produkte", tum: "Alle Produkte", ozel: "Sonderanfertigungen", iletisim: "Kontakt", haklar: "Alle Rechte vorbehalten." },
    hakkimizdaAd: "Über uns", uretimAd: "Produktion", sertifikaAd: "Zertifikate", katalogAd: "Katalog",
  },
  fr: {
    ustLink: { hakkimizda: "À propos", uretim: "Production", sertifika: "Certificats", katalog: "Catalogue" },
    nav: { anasayfa: "Accueil", kurumsal: "Entreprise", urunler: "Produits", katalog: "Catalogue", iletisim: "Contact", teklif: "Demander un devis", ara: "Rechercher des produits", sonucYok: "Aucun résultat", menu: "Menu" },
    slayt: [
      { etiket: "UN HÉRITAGE SOLIDE, UNE PRODUCTION PUISSANTE", baslik: "Nous fabriquons du plastique depuis 1968", alt: "Pots, paniers et rangements — fabriqués sur nos propres lignes de moules et d'injection", dugme: "À propos", href: "uretim" },
      { etiket: "UNE GAMME ÉTENDUE", baslik: "Plus de 200 modèles sous un même toit", alt: "Découvrez nos collections d'intérieur et d'extérieur", dugme: "Voir les produits", href: "urunler" },
      { etiket: "EXPORT", baslik: "Export vers plus de 20 pays", alt: "Parlez à notre équipe de vente en gros, de moules sur mesure et de marque blanche", dugme: "Demander un devis", href: "iletisim" },
    ],
    katBolum: { etiket: "GROUPES DE PRODUITS", baslik: "Explorer par catégorie", alt: "Choisissez une catégorie pour filtrer les produits ci-dessous", model: "modèles", tumUrun: "Tous les produits", temizle: "Effacer le filtre" },
    yeni: { baslik: "Nouveaux modèles", tum: "Tout voir", yeni: "NOUVEAU" },
    koleksiyon: { baslik: "Nos collections", alt: "Deux collections, un seul fabricant", ic: { ad: "Intérieur", alt: "Pour le salon, le balcon et la maison" }, dis: { ad: "Extérieur", alt: "Pour le jardin, la terrasse et l'aménagement paysager" }, incele: "Découvrir" },
    uretim: { etiket: "PRODUCTION", baslik: m => `Plus de ${m} modèles fabriqués dans notre usine`, alt: "Dans notre usine d'Istanbul, nous gérons nous-mêmes tout le processus, du moule à l'expédition.", yil: "fondée en", ulke: "pays d'export", model: "modèles", kesfet: "Découvrir la production" },
    katalogKutu: { etiket: "CATALOGUE", baslik: "Tous les modèles dans un seul catalogue", alt: "Parcourez notre catalogue de produits actuel.", dugme: "Ouvrir le catalogue" },
    b2b: { etiket: "B2B", baslik: "Devenez partenaire d'Alya Plastik", alt: "Parlez à notre équipe de revendeurs, de vente en gros, d'export et de production sur mesure.", dugme: "Demander un devis" },
    alt: { kurumsal: "Entreprise", urunler: "Produits", tum: "Tous les produits", ozel: "Commandes sur mesure", iletisim: "Contact", haklar: "Tous droits réservés." },
    hakkimizdaAd: "À propos", uretimAd: "Production", sertifikaAd: "Certificats", katalogAd: "Catalogue",
  },
  ar: {
    ustLink: { hakkimizda: "من نحن", uretim: "الإنتاج", sertifika: "الشهادات", katalog: "الكتالوج" },
    nav: { anasayfa: "الرئيسية", kurumsal: "الشركة", urunler: "المنتجات", katalog: "الكتالوج", iletisim: "اتصل بنا", teklif: "اطلب عرض سعر", ara: "ابحث عن المنتجات", sonucYok: "لا توجد نتائج", menu: "القائمة" },
    slayt: [
      { etiket: "تاريخ عريق وإنتاج قوي", baslik: "نصنع البلاستيك منذ عام 1968", alt: "أحواض وسلال ومنتجات تخزين — تُصنع على خطوط القوالب والحقن الخاصة بنا", dugme: "من نحن", href: "uretim" },
      { etiket: "تشكيلة واسعة من المنتجات", baslik: "أكثر من 200 طراز تحت سقف واحد", alt: "اكتشف مجموعاتنا للاستخدام الداخلي والخارجي", dugme: "تصفّح المنتجات", href: "urunler" },
      { etiket: "التصدير", baslik: "نصدّر إلى أكثر من 20 دولة", alt: "تحدّث مع فريقنا عن الجملة والقوالب المخصصة والعلامة الخاصة", dugme: "اطلب عرض سعر", href: "iletisim" },
    ],
    katBolum: { etiket: "مجموعات المنتجات", baslik: "استكشف حسب الفئة", alt: "اختر فئة لتصفية المنتجات أدناه", model: "طراز", tumUrun: "كل المنتجات", temizle: "مسح التصفية" },
    yeni: { baslik: "طرازات جديدة", tum: "عرض الكل", yeni: "جديد" },
    koleksiyon: { baslik: "مجموعاتنا", alt: "مجموعتان من مصنّع واحد", ic: { ad: "داخلي", alt: "لغرف المعيشة والشرفات والمنزل" }, dis: { ad: "خارجي", alt: "للحدائق والتراسات وتنسيق المواقع" }, incele: "استكشف" },
    uretim: { etiket: "الإنتاج", baslik: m => `أكثر من ${m} طراز من إنتاج مصنعنا`, alt: "في مصنعنا بإسطنبول ندير كل المراحل بأنفسنا، من القالب إلى الشحن.", yil: "تأسست", ulke: "دول التصدير", model: "طراز", kesfet: "اكتشف الإنتاج" },
    katalogKutu: { etiket: "الكتالوج", baslik: "كل الطرازات في كتالوج واحد", alt: "تصفّح كتالوج منتجاتنا الحالي.", dugme: "افتح الكتالوج" },
    b2b: { etiket: "B2B", baslik: "كن شريكًا لألْيا بلاستيك", alt: "تحدّث مع فريقنا عن الوكالة والجملة والتصدير والإنتاج حسب الطلب.", dugme: "اطلب عرض سعر" },
    alt: { kurumsal: "الشركة", urunler: "المنتجات", tum: "كل المنتجات", ozel: "طلبات خاصة", iletisim: "اتصل بنا", haklar: "جميع الحقوق محفوظة." },
    hakkimizdaAd: "من نحن", uretimAd: "الإنتاج", sertifikaAd: "الشهادات", katalogAd: "الكتالوج",
  },
};
