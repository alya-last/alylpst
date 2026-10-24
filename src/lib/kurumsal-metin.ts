import type { Dil } from "@/lib/diller";

// Kurumsal sayfaların (Hakkımızda, Üretim Süreci, Sertifikalar, KVKK) çok dilli metinleri —
// site-metin.ts'deki M/UI örüntüsünün aynısı. Sayfa bileşenleri (src/app/hakkimizda, .../[lang]/hakkimizda
// vb.) yalnızca bu objeden veriyi çekip render eder; metin tek yerde tutulur, TR ve diğer diller arasında
// kopya bakım yükü oluşmaz.

export type HakkimizdaMetin = {
  etiket: string; baslik: string;
  p1: (kurulus: number, model: number) => string;
  p2: (adres: string, ulke: number) => string;
  p3: (yil: number) => string;
  iletisimOn: string; iletisimLink: string;
};

export const HAKKIMIZDA: Record<Dil, HakkimizdaMetin> = {
  tr: {
    etiket: "— Hakkımızda", baslik: "1968'DEN BU YANA ÜRETİYORUZ.",
    p1: (k, m) => `Alya Plastik, ${k} yılından bu yana İstanbul'da plastik enjeksiyon ürünleri üretiyor. Saksı, sepet, depolama sandığı ve ev gereçleri kategorilerinde ${m}+ ürün modelini kendi kalıp ve enjeksiyon hatlarımızda tasarlıyor ve üretiyoruz.`,
    p2: (a, u) => `Üretim tesisimiz ${a} adresinde yer alıyor. Yurt içi toptan satışın yanı sıra ${u}+ ülkeye ihracat yapıyor, B2B müşterilerimize toplu sipariş ve özel kalıp imkânı sunuyoruz.`,
    p3: y => `${y}+ yıllık üretim tecrübemizle kalite ve teslim güvenilirliğini önceliğimiz olarak görüyoruz — ürün geliştirmeden kalıp üretimine, enjeksiyondan sevkiyata kadar tüm süreci kendi bünyemizde yönetiyoruz.`,
    iletisimOn: "Toptan sipariş, özel kalıp veya ihracat iş birlikleri için ", iletisimLink: "bizimle iletişime geçebilirsiniz",
  },
  en: {
    etiket: "— About Us", baslik: "MANUFACTURING SINCE 1968.",
    p1: (k, m) => `Alya Plastik has been manufacturing plastic injection products in Istanbul since ${k}. We design and produce ${m}+ product models across flower pots, baskets, storage crates and household items on our own moulds and injection lines.`,
    p2: (a, u) => `Our production facility is located at ${a}. Alongside domestic wholesale, we export to ${u}+ countries and offer our B2B customers bulk ordering and custom mould production.`,
    p3: y => `With ${y}+ years of manufacturing experience, quality and delivery reliability are our top priorities — we manage the entire process in-house, from product development and mould making to injection and shipping.`,
    iletisimOn: "For wholesale orders, custom moulds or export partnerships, ", iletisimLink: "you can reach us here",
  },
  ru: {
    etiket: "— О нас", baslik: "ПРОИЗВОДИМ С 1968 ГОДА.",
    p1: (k, m) => `Alya Plastik производит изделия методом пластиковой инъекции в Стамбуле с ${k} года. Мы разрабатываем и выпускаем более ${m} моделей продукции — цветочные горшки, корзины, ящики для хранения и предметы для дома — на собственных линиях пресс-форм и литья.`,
    p2: (a, u) => `Наше производство расположено по адресу: ${a}. Помимо оптовых продаж внутри страны, мы экспортируем более чем в ${u} стран и предлагаем B2B-клиентам оптовые заказы и изготовление форм по индивидуальному заказу.`,
    p3: y => `Имея более ${y} лет производственного опыта, мы ставим качество и надёжность сроков поставки на первое место — весь процесс, от разработки продукта и изготовления форм до литья и отгрузки, мы контролируем самостоятельно.`,
    iletisimOn: "По вопросам оптовых заказов, изготовления форм на заказ или экспортного сотрудничества ", iletisimLink: "свяжитесь с нами",
  },
  zh: {
    etiket: "— 关于我们", baslik: "自1968年起持续生产。",
    p1: (k, m) => `Alya Plastik 自 ${k} 年起在伊斯坦布尔从事塑料注塑产品生产。我们在花盆、篮子、储物箱和家居用品等品类中，凭借自有模具与注塑生产线，设计并生产 ${m}+ 款产品。`,
    p2: (a, u) => `我们的生产基地位于 ${a}。除国内批发业务外，我们还出口至 ${u}+ 个国家，并为 B2B 客户提供批量订购与定制模具服务。`,
    p3: y => `凭借 ${y}+ 年的生产经验，我们将质量与交付可靠性视为首要任务——从产品开发、模具制造到注塑与发货，全流程均由我们自主管理。`,
    iletisimOn: "如需批发订单、定制模具或出口合作，", iletisimLink: "欢迎与我们联系",
  },
};

export type UretimMetin = {
  etiket: string; baslik: string; giris: string;
  adimlar: { b: string; a: string }[];
  iletisimOn: string; iletisimLink: string; iletisimSon: string;
};

export const URETIM: Record<Dil, UretimMetin> = {
  tr: {
    etiket: "— Üretim Süreci", baslik: "KALIPTAN SEVKİYATA TÜM SÜREÇ BİZDE.",
    giris: "Alya Plastik'te ürün geliştirmeden sevkiyata kadar tüm üretim adımlarını kendi tesisimizde yönetiyoruz. Bu sayede kaliteyi ve teslim sürelerini uçtan uca kontrol edebiliyoruz.",
    adimlar: [
      { b: "Kalıp Tasarımı", a: "Ürün talebine veya kendi koleksiyonumuza göre kalıp tasarımını kendi mühendislik ekibimizle yapıyor, kalıpları kendi atölyemizde üretiyoruz." },
      { b: "Hammadde Seçimi", a: "Ürünün kullanım amacına uygun plastik hammadde (PP, PE vb.) ve renk reçetesi seçilir." },
      { b: "Enjeksiyon", a: "Hammadde, kendi enjeksiyon hatlarımızda ısıtılıp kalıba basılarak nihai ürün şekli oluşturulur." },
      { b: "Kalite Kontrol", a: "Her üretim partisinden numuneler alınarak ölçü, dayanıklılık ve yüzey kalitesi kontrol edilir." },
      { b: "Paketleme", a: "Onaylanan ürünler sevkiyat türüne (yurt içi / ihracat) uygun şekilde paketlenir." },
      { b: "Sevkiyat", a: "Toptan siparişler yurt içi teslimat veya ihracat için sevkiyata hazırlanır." },
    ],
    iletisimOn: "Özel kalıp veya numune talepleriniz için ", iletisimLink: "iletişim formunu", iletisimSon: " kullanabilirsiniz.",
  },
  en: {
    etiket: "— Production Process", baslik: "FROM MOULD TO SHIPMENT, ALL IN-HOUSE.",
    giris: "At Alya Plastik, we manage every production step — from product development to shipping — in our own facility. This lets us control quality and delivery times end to end.",
    adimlar: [
      { b: "Mould Design", a: "Based on a customer request or our own collection, our in-house engineering team designs the mould, which we then manufacture in our own workshop." },
      { b: "Raw Material Selection", a: "Plastic raw material (PP, PE, etc.) and colour formula are chosen to match the product's intended use." },
      { b: "Injection", a: "The raw material is heated and injected into the mould on our own injection lines, forming the final product shape." },
      { b: "Quality Control", a: "Samples from every production batch are checked for dimensions, durability and surface quality." },
      { b: "Packaging", a: "Approved products are packaged appropriately for their shipping type (domestic / export)." },
      { b: "Shipping", a: "Wholesale orders are prepared for shipment, whether for domestic delivery or export." },
    ],
    iletisimOn: "For custom mould or sample requests, you can use the ", iletisimLink: "contact form", iletisimSon: ".",
  },
  ru: {
    etiket: "— Производственный процесс", baslik: "ОТ ПРЕСС-ФОРМЫ ДО ОТГРУЗКИ — ВСЁ У НАС.",
    giris: "В Alya Plastik мы управляем всеми этапами производства — от разработки продукта до отгрузки — на собственном предприятии. Это позволяет нам полностью контролировать качество и сроки поставки.",
    adimlar: [
      { b: "Проектирование пресс-формы", a: "По запросу клиента или для собственной коллекции наша инженерная команда проектирует пресс-форму, которую мы затем изготавливаем в собственной мастерской." },
      { b: "Выбор сырья", a: "Пластиковое сырьё (ПП, ПЭ и т.д.) и цветовая рецептура подбираются в соответствии с назначением изделия." },
      { b: "Литьё под давлением", a: "Сырьё нагревается и впрыскивается в форму на наших собственных линиях литья, формируя окончательную форму изделия." },
      { b: "Контроль качества", a: "Из каждой производственной партии отбираются образцы для проверки размеров, прочности и качества поверхности." },
      { b: "Упаковка", a: "Одобренные изделия упаковываются в соответствии с типом отгрузки (внутренний рынок / экспорт)." },
      { b: "Отгрузка", a: "Оптовые заказы готовятся к отгрузке — для внутренней доставки или на экспорт." },
    ],
    iletisimOn: "По вопросам изготовления форм на заказ или образцов используйте ", iletisimLink: "форму обратной связи", iletisimSon: ".",
  },
  zh: {
    etiket: "— 生产流程", baslik: "从模具到发货，全流程自主完成。",
    giris: "在 Alya Plastik，从产品开发到发货的每一个生产环节都由我们自有工厂管理，从而实现质量与交付周期的端到端把控。",
    adimlar: [
      { b: "模具设计", a: "根据客户需求或自有产品系列，由我们的内部工程团队设计模具，并在自有车间制造。" },
      { b: "原材料选择", a: "根据产品用途选择合适的塑料原料（PP、PE 等）及配色方案。" },
      { b: "注塑成型", a: "原料在自有注塑生产线上加热并注入模具，形成最终产品形状。" },
      { b: "质量检验", a: "每批生产均抽取样品，检验尺寸、耐久性与表面质量。" },
      { b: "包装", a: "合格产品根据发货方式（国内/出口）进行相应包装。" },
      { b: "发货", a: "批量订单按国内配送或出口要求准备发货。" },
    ],
    iletisimOn: "如需定制模具或样品，请使用", iletisimLink: "联系表单", iletisimSon: "。",
  },
};

export type SertifikaMetin = { etiket: string; baslik: string; p1: string; p2On: string; p2Son: string };

export const SERTIFIKA: Record<Dil, SertifikaMetin> = {
  tr: {
    etiket: "— Sertifikalar", baslik: "KALİTE VE UYGUNLUK BELGELERİMİZ.",
    p1: "Bu sayfada üretim ve kalite süreçlerimize ilişkin sertifikalarımızı yakında yayınlayacağız.",
    p2On: "Belirli bir sertifika veya uygunluk belgesine acil ihtiyacınız varsa, güncel kopyasını doğrudan ", p2Son: " adresine yazarak talep edebilirsiniz.",
  },
  en: {
    etiket: "— Certificates", baslik: "OUR QUALITY AND COMPLIANCE CERTIFICATES.",
    p1: "We will publish our production and quality certificates on this page soon.",
    p2On: "If you urgently need a specific certificate or compliance document, you can request an up-to-date copy by writing directly to ", p2Son: ".",
  },
  ru: {
    etiket: "— Сертификаты", baslik: "НАШИ СЕРТИФИКАТЫ КАЧЕСТВА И СООТВЕТСТВИЯ.",
    p1: "Мы скоро опубликуем на этой странице сертификаты, относящиеся к нашим производственным и качественным процессам.",
    p2On: "Если вам срочно необходим конкретный сертификат или документ о соответствии, вы можете запросить актуальную копию, написав напрямую на ", p2Son: ".",
  },
  zh: {
    etiket: "— 认证证书", baslik: "我们的质量与合规认证。",
    p1: "我们即将在本页发布与生产及质量流程相关的认证证书。",
    p2On: "如您急需特定证书或合规文件，可直接发送邮件至 ", p2Son: " 索取最新版本。",
  },
};

export type KvkkMetin = {
  etiket: string; baslik: string;
  intro: (sirket: string) => string;
  s1Baslik: string; adresEtiket: string; epostaEtiket: string; telefonEtiket: string;
  s2Baslik: string; s2: string;
  s3Baslik: string; s3: string;
  s4Baslik: string; s4: string;
  s5Baslik: string; s5: string;
  s6Baslik: string; s6: string;
  s7Baslik: string; s7Giris: string; haklar: string[]; s7Sonu: string;
  s8Baslik: string; s8On: string; s8Son: string;
  not_: string;
};

export const KVKK: Record<Dil, KvkkMetin> = {
  tr: {
    etiket: "— KVKK", baslik: "KİŞİSEL VERİLERİN KORUNMASI HAKKINDA AYDINLATMA METNİ",
    intro: s => `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, veri sorumlusu sıfatıyla ${s} ("Alya Plastik") olarak, web sitemiz üzerinden veya diğer kanallardan bizimle paylaştığınız kişisel verilerinizin işlenmesine ilişkin sizi aşağıda bilgilendiriyoruz.`,
    s1Baslik: "1. Veri Sorumlusu", adresEtiket: "Adres", epostaEtiket: "E-posta", telefonEtiket: "Telefon",
    s2Baslik: "2. İşlenen Kişisel Veriler", s2: "Web sitemizdeki iletişim/teklif formunu kullandığınızda; ad-soyad, firma unvanı, e-posta adresi, telefon numarası ve form aracılığıyla ilettiğiniz mesaj içeriği gibi kişisel verileriniz işlenmektedir.",
    s3Baslik: "3. İşleme Amaçları", s3: "Kişisel verileriniz; talebinizin ve teklif isteğinizin değerlendirilmesi, sizinle iletişime geçilmesi, ürün/hizmetlerimiz hakkında bilgilendirme yapılması, ticari ilişkilerin yürütülmesi ve yasal yükümlülüklerimizin yerine getirilmesi amaçlarıyla işlenmektedir.",
    s4Baslik: "4. Hukuki Sebep ve Toplama Yöntemi", s4: "Kişisel verileriniz, web sitemizdeki iletişim formu, e-posta veya telefon yoluyla, KVKK'nın 5. maddesinde yer alan \"ilgili kişinin talebi üzerine sözleşme kurulması/ifası\" ve \"veri sorumlusunun meşru menfaati\" hukuki sebeplerine dayanılarak toplanmaktadır.",
    s5Baslik: "5. Aktarım", s5: "Kişisel verileriniz, yalnızca hizmet aldığımız barındırma (hosting), e-posta ve benzeri teknik altyapı sağlayıcılarımızla ve yasal olarak yetkili kamu kurum ve kuruluşlarıyla, mevzuatın izin verdiği ölçüde paylaşılabilir; ticari amaçla üçüncü kişilerle paylaşılmaz.",
    s6Baslik: "6. Saklama Süresi", s6: "Kişisel verileriniz, işleme amacının gerektirdiği süre ve ilgili mevzuatta öngörülen zamanaşımı süreleri boyunca saklanır; bu sürelerin sonunda silinir, yok edilir veya anonim hale getirilir.",
    s7Baslik: "7. Haklarınız", s7Giris: "KVKK'nın 11. maddesi uyarınca bize başvurarak;",
    haklar: [
      "kişisel verinizin işlenip işlenmediğini öğrenme,",
      "işlenmişse buna ilişkin bilgi talep etme,",
      "işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,",
      "yurt içinde/yurt dışında aktarıldığı üçüncü kişileri bilme,",
      "eksik/yanlış işlenmişse düzeltilmesini isteme,",
      "KVKK'da öngörülen şartlarda silinmesini/yok edilmesini isteme,",
      "düzeltme/silme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme,",
      "işlenen verilerin münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,",
      "kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme",
    ],
    s7Sonu: "haklarına sahipsiniz.",
    s8Baslik: "8. Başvuru Yöntemi",
    s8On: "Yukarıdaki haklarınızı kullanmak için taleplerinizi kimliğinizi tevsik edici belgelerle birlikte ", s8Son: " adresine yazılı olarak iletebilirsiniz. Talebiniz, niteliğine göre en kısa sürede ve en geç 30 gün içinde sonuçlandırılır.",
    not_: "Bu metin genel bir aydınlatma taslağıdır; şirketinizin veri işleme faaliyetlerine göre gözden geçirilmesi için hukuk danışmanınıza kontrol ettirmenizi öneririz.",
  },
  en: {
    etiket: "— Privacy", baslik: "PERSONAL DATA PROTECTION NOTICE",
    intro: s => `Under Turkish Law No. 6698 on the Protection of Personal Data ("KVKK"), ${s} ("Alya Plastik"), acting as data controller, informs you below about the processing of personal data you share with us through our website or other channels. This notice is provided for information purposes; it is governed by Turkish law.`,
    s1Baslik: "1. Data Controller", adresEtiket: "Address", epostaEtiket: "E-mail", telefonEtiket: "Phone",
    s2Baslik: "2. Personal Data Processed", s2: "When you use the contact/quote form on our website, personal data such as your full name, company name, e-mail address, phone number and the content of the message you submit through the form are processed.",
    s3Baslik: "3. Purposes of Processing", s3: "Your personal data is processed to evaluate your request and quote inquiry, to contact you, to inform you about our products/services, to carry out our commercial relationships, and to fulfil our legal obligations.",
    s4Baslik: "4. Legal Basis and Collection Method", s4: "Your personal data is collected through our website's contact form, e-mail or phone, based on the legal grounds of \"establishment/performance of a contract at the data subject's request\" and \"legitimate interest of the data controller\" set out in Article 5 of the KVKK.",
    s5Baslik: "5. Transfer", s5: "Your personal data may only be shared, to the extent permitted by law, with our hosting, e-mail and similar technical infrastructure providers and with legally authorised public institutions; it is not shared with third parties for commercial purposes.",
    s6Baslik: "6. Retention Period", s6: "Your personal data is retained for as long as required by the purpose of processing and the statutory limitation periods set out in applicable legislation; it is deleted, destroyed or anonymised at the end of these periods.",
    s7Baslik: "7. Your Rights", s7Giris: "Under Article 11 of the KVKK, you may apply to us to:",
    haklar: [
      "learn whether your personal data is being processed,",
      "request information about it if it has been processed,",
      "learn the purpose of processing and whether it is used in accordance with that purpose,",
      "know the third parties to whom it is transferred domestically or abroad,",
      "request correction if it has been processed incompletely or incorrectly,",
      "request its deletion or destruction under the conditions set out in the KVKK,",
      "request that any correction/deletion be notified to third parties to whom the data was transferred,",
      "object to a result that is to your detriment arising solely from automated analysis of the processed data,",
      "request compensation for damages suffered due to unlawful processing",
    ],
    s7Sonu: "",
    s8Baslik: "8. How to Apply",
    s8On: "To exercise the rights above, you may submit your request in writing, together with documents verifying your identity, to ", s8Son: ". Depending on its nature, your request will be concluded as soon as possible and within 30 days at the latest.",
    not_: "This text is a general information draft; we recommend having it reviewed by your legal counsel in line with your company's own data processing activities.",
  },
  ru: {
    etiket: "— Конфиденциальность", baslik: "УВЕДОМЛЕНИЕ О ЗАЩИТЕ ПЕРСОНАЛЬНЫХ ДАННЫХ",
    intro: s => `В соответствии с турецким Законом № 6698 «О защите персональных данных» ("KVKK"), компания ${s} ("Alya Plastik"), выступая в качестве оператора данных, информирует вас ниже об обработке персональных данных, которые вы предоставляете нам через наш сайт или по другим каналам. Настоящий текст носит информационный характер и регулируется законодательством Турции.`,
    s1Baslik: "1. Оператор данных", adresEtiket: "Адрес", epostaEtiket: "Эл. почта", telefonEtiket: "Телефон",
    s2Baslik: "2. Обрабатываемые персональные данные", s2: "При использовании формы обратной связи/запроса цены на нашем сайте обрабатываются такие персональные данные, как ваше имя и фамилия, название компании, адрес электронной почты, номер телефона и содержание сообщения, отправленного через форму.",
    s3Baslik: "3. Цели обработки", s3: "Ваши персональные данные обрабатываются в целях рассмотрения вашего запроса и заявки на коммерческое предложение, связи с вами, информирования о наших продуктах/услугах, ведения деловых отношений и выполнения наших юридических обязательств.",
    s4Baslik: "4. Правовое основание и способ сбора", s4: "Ваши персональные данные собираются через форму обратной связи на сайте, по электронной почте или телефону на основании правовых оснований, предусмотренных статьёй 5 KVKK: «заключение/исполнение договора по требованию субъекта данных» и «законный интерес оператора данных».",
    s5Baslik: "5. Передача данных", s5: "Ваши персональные данные могут передаваться, в объёме, допускаемом законодательством, только нашим поставщикам услуг хостинга, электронной почты и аналогичной технической инфраструктуры, а также уполномоченным государственным органам; в коммерческих целях третьим лицам данные не передаются.",
    s6Baslik: "6. Срок хранения", s6: "Ваши персональные данные хранятся в течение срока, необходимого для цели обработки, и сроков давности, предусмотренных применимым законодательством; по истечении этих сроков данные удаляются, уничтожаются или обезличиваются.",
    s7Baslik: "7. Ваши права", s7Giris: "В соответствии со статьёй 11 KVKK вы можете обратиться к нам, чтобы:",
    haklar: [
      "узнать, обрабатываются ли ваши персональные данные,",
      "запросить информацию об этом, если данные обрабатывались,",
      "узнать цель обработки и используются ли данные в соответствии с этой целью,",
      "узнать третьих лиц, которым данные переданы внутри страны или за рубежом,",
      "потребовать исправления, если данные обработаны неполно или неверно,",
      "потребовать удаления/уничтожения данных на условиях, предусмотренных KVKK,",
      "потребовать уведомления третьих лиц, которым были переданы данные, об исправлении/удалении,",
      "возражать против результата, наносящего вам ущерб, возникшего исключительно из автоматизированного анализа обработанных данных,",
      "потребовать возмещения ущерба, причинённого в результате неправомерной обработки",
    ],
    s7Sonu: "",
    s8Baslik: "8. Порядок обращения",
    s8On: "Для реализации указанных выше прав вы можете направить письменный запрос вместе с документами, подтверждающими вашу личность, на адрес ", s8Son: ". В зависимости от характера запроса он будет рассмотрен в кратчайшие сроки, но не позднее 30 дней.",
    not_: "Этот текст является общим информационным проектом; рекомендуем передать его на проверку вашему юридическому консультанту с учётом особенностей обработки данных в вашей компании.",
  },
  zh: {
    etiket: "— 隐私声明", baslik: "个人数据保护告知书",
    intro: s => `根据土耳其第 6698 号《个人数据保护法》（"KVKK"），${s}（"Alya Plastik"）作为数据控制者，就您通过本网站或其他渠道与我们分享的个人数据的处理方式，向您作出以下说明。本文仅供参考，受土耳其法律管辖。`,
    s1Baslik: "1. 数据控制者", adresEtiket: "地址", epostaEtiket: "电子邮箱", telefonEtiket: "电话",
    s2Baslik: "2. 所处理的个人数据", s2: "当您使用我们网站上的联系/报价表单时，我们会处理您的姓名、公司名称、电子邮箱地址、电话号码以及您通过表单提交的留言内容等个人数据。",
    s3Baslik: "3. 处理目的", s3: "我们处理您的个人数据，用于评估您的咨询与报价请求、与您取得联系、告知您有关我们产品/服务的信息、开展商业往来，以及履行我们的法律义务。",
    s4Baslik: "4. 法律依据与收集方式", s4: "您的个人数据通过网站联系表单、电子邮件或电话收集，依据的是《个人数据保护法》第 5 条规定的“应数据主体要求订立/履行合同”以及“数据控制者的正当利益”这两项法律依据。",
    s5Baslik: "5. 数据传输", s5: "您的个人数据仅在法律允许的范围内，与我们所使用的主机托管、电子邮件等技术基础设施提供商，以及依法有权的公共机构共享；不会出于商业目的与第三方共享。",
    s6Baslik: "6. 保存期限", s6: "您的个人数据将在处理目的所需的期限内，以及相关法律规定的时效期限内予以保存；期限届满后将被删除、销毁或匿名化处理。",
    s7Baslik: "7. 您的权利", s7Giris: "根据《个人数据保护法》第 11 条，您有权向我们申请：",
    haklar: [
      "了解您的个人数据是否正在被处理；",
      "如已处理，要求获取相关信息；",
      "了解处理目的及数据使用是否符合该目的；",
      "了解数据在境内/境外被转移给哪些第三方；",
      "如数据处理不完整或有误，要求予以更正；",
      "在《个人数据保护法》规定的条件下，要求删除/销毁数据；",
      "要求将更正/删除事宜通知已获得数据传输的第三方；",
      "对完全基于自动化分析而产生的、对您不利的结果提出异议；",
      "因违法处理而遭受损失时，要求赔偿损失",
    ],
    s7Sonu: "等权利。",
    s8Baslik: "8. 申请方式",
    s8On: "如需行使上述权利，您可将请求连同能证明您身份的文件，以书面形式发送至 ", s8Son: "。您的请求将根据其性质尽快处理，最迟不超过 30 天。",
    not_: "本文为通用告知范本；建议根据贵公司自身的数据处理活动，交由法律顾问审核后使用。",
  },
};

export type KatalogMetin = { etiket: string; baslik: string; aciklama: string; hazirlaniyor: string };
export const KATALOG: Record<Dil, KatalogMetin> = {
  tr: { etiket: "Katalog", baslik: "Ürün Kataloğumuz", aciklama: "Alya Plastik ürün kataloğunu sayfa sayfa çevirerek inceleyin.", hazirlaniyor: "Katalog şu anda hazırlanıyor — kısa süre sonra burada yayınlanacak." },
  en: { etiket: "Catalogue", baslik: "Our Product Catalogue", aciklama: "Browse the Alya Plastik product catalogue page by page.", hazirlaniyor: "The catalogue is being prepared — it will be published here shortly." },
  ru: { etiket: "Каталог", baslik: "Наш каталог продукции", aciklama: "Листайте каталог продукции Alya Plastik постранично.", hazirlaniyor: "Каталог сейчас готовится — скоро будет опубликован здесь." },
  zh: { etiket: "产品目录", baslik: "我们的产品目录", aciklama: "逐页浏览 Alya Plastik 产品目录。", hazirlaniyor: "目录正在准备中，即将在此发布。" },
};
