// Muhasebe sayfalarındaki "Bu sayfa ne işe yarar?" kutularının içeriği.
// Dil: hiçbir şey bilmeyen biri anlasın diye çok sade. Sekme anahtarları ilgili sayfadaki sekme değerleriyle aynı olmalı.
export type YardimIcerik = {
  baslik: string
  ozet: string
  /** Animasyonlu akış: sırayla yanan kutucuklar (örn. Taslak → Onaylandı → Ödendi) */
  akis?: string[]
  adimlar: { t: string; a: string }[]
  dikkat?: string[]
  /** "Bu kelime ne demek?" */
  terimler?: { t: string; a: string }[]
  /** Örnek sorular / örnek kullanımlar (yalnızca bilgi amaçlı) */
  ornekler?: string[]
  /** Hangi sekmedeysen o sekmenin ne işe yaradığı */
  sekmeler?: Record<string, { t: string; a: string }>
}

export const YARDIM: Record<string, YardimIcerik> = {
  genel: {
    baslik: 'Finansal Durum',
    ozet: 'Şirketin parasının fotoğrafı. Bu ay ne kadar para girdi, ne kadar çıktı, kasada ne var, kimden alacağımız ve kime borcumuz var — hepsi tek ekranda. Burada hiçbir şey yazmazsın, sadece bakarsın.',
    adimlar: [
      { t: 'Zamanı seç', a: 'Sağ üstteki düğmelerden (Bu ay, Geçen ay, Bu yıl…) bakmak istediğin dönemi seç. Altındaki her şey buna göre değişir.' },
      { t: 'Renkli kutulara bak', a: 'Gelir = giren para. Gider = çıkan para. Net = aradaki fark. Net yeşilse kazanıyoruz, kırmızıysa o dönemde zarardayız.' },
      { t: 'Alacak ve borcu gör', a: 'Toplam Alacak: müşterilerin bize borcu. Toplam Borç: bizim tedarikçilere borcumuz.' },
      { t: 'Yaklaşan ödemeleri kontrol et', a: '"Yaklaşan vadeler" önümüzdeki günlerde para almamız ya da ödememiz gereken şeyleri gösterir. Her sabah bir göz at.' },
    ],
    dikkat: [
      'Bu sayfa "nakit bazlıdır": para kasaya girince gelir, çıkınca gider sayılır. Sadece fatura kesmek gelir yazmaz.',
      'Gelirin içinde "Diğer Gelir" (KDV iadesi, destek primi) de olabilir. Bu satıştan kazanılan para değildir. Satış cirosu sadece "Ürün Satışı"dır.',
      'Kasa toplamı çok büyük ya da eksi görünüyorsa kasa/banka sayfasındaki bakiyelere bak; yanlış girilmiş olabilir.',
    ],
    terimler: [
      { t: 'Alacak', a: 'Başkasından alacağımız para (müşterinin bize borcu).' },
      { t: 'Borç', a: 'Başkasına ödememiz gereken para.' },
      { t: 'Net', a: 'Gelirden gideri çıkarınca kalan. Artıysa kâr, eksiyse zarar.' },
      { t: 'Vade', a: 'Ödemenin ya da tahsilatın son günü.' },
    ],
  },

  islemler: {
    baslik: 'Gelir & Gider Defteri',
    ozet: 'Şirkete giren ve şirketten çıkan her paranın yazıldığı defter. Müşteriden para aldıysan "Gelir", birine para ödediysen "Gider" yazarsın. Doğru yazarsan kasa ve cari hesaplar kendiliğinden güncellenir.',
    adimlar: [
      { t: 'Para girdiyse yeşil düğme', a: '"Gelir Ekle"ye bas. Para çıktıysa "Gider Ekle"ye bas.' },
      { t: 'Bilgileri doldur', a: 'Tutar, tarih ve kategori yaz. En önemlisi hangi KASA/BANKA hesabından geçtiğini seç. Seçmezsen kasanın bakiyesi değişmez.' },
      { t: 'Cariyi seç', a: 'Eğer para bir müşteriden geldiyse ya da bir tedarikçiye gittiyse "Cari" kutusundan o firmayı seç. Böylece onun borcu/alacağı otomatik düşer.' },
      { t: 'Yanlış girdiysen düzelt', a: 'Satıra tıkla, düzenle. Silersen kasa ve cari bakiyeleri otomatik geri alınır, korkma.' },
      { t: 'Bulmak için filtrele', a: 'Üstteki Gelir/Gider ve dönem düğmelerini kullan, arama kutusuna firma adı ya da tutar yaz.' },
    ],
    dikkat: [
      'Maaş, kira, elektrik gibi genel giderlerde cari seçmeyebilirsin, bu normaldir.',
      'Müşteri tahsilatı ya da tedarikçi ödemesi yaptıysan cariyi mutlaka seç; yoksa o firmanın bakiyesi yanlış kalır.',
      'Fatura ödemesini mümkünse buradan değil, Faturalar sayfasında faturayı açıp "Tahsilat/Ödeme" ile yap; böylece fatura da kapanır.',
    ],
    terimler: [
      { t: 'Kategori', a: 'Paranın ne için girdiği ya da çıktığı (örn. Ürün Satışı, Elektrik, Maaş).' },
      { t: 'Cari', a: 'Müşteri ya da tedarikçi hesabı.' },
      { t: 'Kasa/Banka', a: 'Paranın fiilen durduğu yer: nakit kasa ya da banka hesabı.' },
    ],
    sekmeler: {
      hepsi: { t: 'Tümü', a: 'Hem gelirler hem giderler birlikte görünüyor.' },
      gelir: { t: 'Gelir', a: 'Sadece şirkete giren paralar (satış, tahsilat, iade vb.).' },
      gider: { t: 'Gider', a: 'Sadece şirketten çıkan paralar (ödeme, maaş, fatura vb.).' },
    },
  },

  faturalar: {
    baslik: 'Fatura Yönetimi',
    ozet: 'Kestiğimiz (satış) ve bize gelen (alış) faturaların listesi. Faturayı önce taslak olarak hazırlarsın, kontrol edip onaylarsın. Onaylayınca müşterinin borcu yazılır ve stok düşer. Para gelince ya da ödenince "Tahsilat/Ödeme" ile kapatırsın.',
    akis: ['Taslak', 'Onaylandı', 'Ödendi'],
    adimlar: [
      { t: 'Yeni Fatura', a: 'Sağ üstteki "Yeni Fatura"ya bas. Türü seç: Satış (müşteriye kestiğimiz), Alış (tedarikçiden gelen) ya da İade.' },
      { t: 'Bilgileri yaz', a: 'Cariyi, tarihi, vadeyi ve ürünleri yaz. Elinde faturanın fotoğrafı ya da PDF\'i varsa "Belge Oku" ile yükle; yapay zeka okuyup formu doldurur. Sen yine de kontrol et.' },
      { t: 'Taslak ya da onay', a: 'Taslak kaydedersen hiçbir şey değişmez, sonra düzeltebilirsin. "Onayla" dersen cari bakiyesi ve stok işlenir.' },
      { t: 'Parası gelince kapat', a: 'Faturaya tıkla, "Tahsilat" (satış) ya da "Ödeme" (alış) de. Kısmi ödeme de olur. Tamamı ödenince fatura "Ödendi" olur.' },
      { t: 'Yanlışsa iptal', a: 'Onaylı faturayı iptal edersen bakiye ve stok geri alınır. Sadece taslak fatura silinebilir.' },
    ],
    dikkat: [
      'Onaylamadan önce iki kez kontrol et. Onay cari bakiyeyi ve stoğu değiştirir.',
      'Eski programdan aktarılan taslak faturaları ONAYLAMA. Çünkü eski bakiyeler zaten cari kartlarında var, onaylarsan iki kere sayılır.',
      'Aynı numaralı fatura varsa sistem uyarır; uyarıyı dikkatle oku.',
    ],
    terimler: [
      { t: 'Taslak', a: 'Hazırlanmış ama henüz geçerli sayılmayan fatura. Bakiyeyi ve stoğu etkilemez.' },
      { t: 'Onay', a: 'Faturayı geçerli yapmak. Müşteri borcu yazılır, stok düşer.' },
      { t: 'Vade', a: 'Faturanın ödenmesi gereken son gün.' },
      { t: 'KDV', a: 'Faturadaki vergi. Satışta bizim topladığımız, alışta bizim ödediğimiz vergidir.' },
      { t: 'İade', a: 'Satılan malın geri gelmesi. Müşterinin borcunu azaltır.' },
    ],
    sekmeler: {
      hepsi: { t: 'Tümü', a: 'Bütün faturalar karışık. Aramak için kullan.' },
      taslak: { t: 'Taslak', a: 'Henüz onaylanmamış faturalar. Kontrol edip onaylayabilir ya da silebilirsin.' },
      onaylandi: { t: 'Açık', a: 'Onaylanmış ama parası tamamen alınmamış/ödenmemiş faturalar. Takip edilecek olanlar bunlar.' },
      gecikmis: { t: 'Gecikmiş', a: 'Vadesi geçmiş ama hâlâ kapanmamış faturalar. Önce bunları ara/öde!' },
      odendi: { t: 'Ödendi', a: 'Parası tamamen alınmış ya da ödenmiş, kapanmış faturalar.' },
      iptal: { t: 'İptal', a: 'İptal edilmiş faturalar. Hiçbir bakiyeyi etkilemez.' },
    },
  },

  cari: {
    baslik: 'Cari Hesap Yönetimi',
    ozet: 'Müşteri ve tedarikçilerin hesap kartları. Her firmanın bize ne kadar borcu var, bizim ona ne kadar borcumuz var burada yazar. Bir firmaya tıklarsan o firmayla yaptığımız bütün işlemleri (ekstre) görürsün.',
    adimlar: [
      { t: 'Firmayı bul', a: 'Arama kutusuna firma adını yaz. Türkçe karakter yazmasan da bulur.' },
      { t: 'Bakiyeye bak', a: 'Yeşil (artı) bakiye: firma bize borçlu. Kırmızı (eksi) bakiye: biz firmaya borçluyuz. Dolar/Euro bakiyeleri ayrı yazar, TL ile toplanmaz.' },
      { t: 'Detayı aç', a: 'Firmaya tıkla: Bilgiler, Ekstre (eski ve yeni hareketler), Faturalar ve Çek/Senet sekmeleri açılır.' },
      { t: 'Para aldıysan/verdiysen', a: 'Detay ekranındaki Tahsilat (müşteriden para aldık) ya da Ödeme (tedarikçiye verdik) düğmesiyle işle. Bakiye otomatik düşer.' },
      { t: 'Yeni firma', a: '"Yeni Cari" ile ekle. Çok firma varsa "Şablon İndir" ile Excel doldurup "Excel\'den İçe Aktar" yap.' },
    ],
    dikkat: [
      'Aynı firmayı iki kere açma. Kaydetmeden önce sistem benzer adı uyarır, uyarıyı oku.',
      'Eski programdan gelen hareketler sadece geçmiştir, değiştirilemez. Güncel bakiye firma kartındaki değerdir.',
      'Bakiyesi olan ya da faturası olan bir cariyi silme; silmeden önce sistem seni uyarır.',
    ],
    terimler: [
      { t: 'Cari', a: 'Müşteri ya da tedarikçi hesabı.' },
      { t: 'Ekstre', a: 'Bir firmayla aramızdaki bütün alış-veriş ve ödeme hareketlerinin dökümü.' },
      { t: 'Tahsilat', a: 'Müşteriden para almak.' },
      { t: 'Vergi No', a: 'Firmanın vergi numarası; e-fatura ve KDV listesi için gerekir.' },
    ],
    sekmeler: {
      hepsi: { t: 'Tümü', a: 'Bütün müşteriler ve tedarikçiler.' },
      musteri: { t: 'Müşteriler', a: 'Bizden mal alanlar. Bakiyeleri artıysa bize borçlular.' },
      tedarikci: { t: 'Tedarikçiler', a: 'Bizim mal/hizmet aldığımız firmalar. Bakiyeleri eksiyse biz borçluyuz.' },
      bakiyeli: { t: 'Bakiyesi olan', a: 'Borcu ya da alacağı olan firmalar. Sıfır olanlar gizlenir.' },
      gecikmis: { t: 'Vadesi geçen', a: 'Ödemesi gecikmiş firmalar. Önce bunları arayıp tahsilat yapmak gerekir.' },
    },
  },

  'kasa-banka': {
    baslik: 'Nakit Yönetimi (Kasa / Banka)',
    ozet: 'Şirketin parasının durduğu yerler: nakit kasa ve banka hesapları. Her hesabın bakiyesi burada görünür. Gelir/gider yazarken bir hesap seçersen o hesabın bakiyesi kendiliğinden değişir.',
    adimlar: [
      { t: 'Hesapları gör', a: 'Her kutu bir hesap: kasa, banka TL, banka Dolar gibi. Kutuya tıklarsan o hesabın hareketleri açılır.' },
      { t: 'Hesap ekle', a: '"Hesap Ekle" ile yeni kasa ya da banka hesabı aç. Dolar/Euro hesabıysa para birimini doğru seç.' },
      { t: 'Virman', a: 'Para bir hesaptan diğerine geçtiyse (örn. bankadan çekip kasaya koyduk) "Virman" ile yaz. Bu gelir ya da gider değildir, sadece yer değiştirmedir.' },
      { t: 'Döviz kuru', a: 'Dolar/Euro hesapların TL karşılığı için "Döviz Kurları"nı güncel gir.' },
      { t: 'Bakiye yanlışsa', a: 'Hesaba tıkla, "Bakiye Düzelt" de. DİKKAT: buraya bankadaki/kasadaki GERÇEK tutarı yaz (örn. 3.759.758,49). Sistem farkı kendisi hesaplar.' },
    ],
    dikkat: [
      '"Bakiye Düzelt"te rakamı yazarken virgül ve noktaya dikkat et. Yanlış yazarsan bakiye yüzlerce kat şişer ve bütün raporlar yanlış olur.',
      'Kasa eksiye düşmez normalde. Eksi görüyorsan nakit giriş (örn. bankadan çekilen para) yazılmamış demektir.',
      'Kullanmadığın hesabı silme; "Aktif/Pasif" düğmesiyle pasif yap.',
    ],
    terimler: [
      { t: 'Virman', a: 'Parayı bir hesaptan diğerine aktarma. Kâr ya da zarar değildir.' },
      { t: 'Bakiye', a: 'Hesapta şu an duran para.' },
      { t: 'Kur', a: '1 Dolar/Euro\'nun kaç TL olduğu.' },
    ],
  },

  'cek-senet': {
    baslik: 'Çek & Senet Portföyü',
    ozet: 'Müşterilerden aldığımız ve tedarikçilere verdiğimiz çek/senetlerin takibi. Hangi çek elimizde, hangisi bankada, hangisi birine verildi, hangisinin vadesi geldi, hepsi burada.',
    akis: ['Elimizde (Portföy)', 'Bankada / Verildi', 'Tahsil edildi'],
    adimlar: [
      { t: 'Çek geldiyse ekle', a: '"Çek/Senet Ekle" ile yaz: tutar, vade, çek no, banka, kimden aldık. Alınan çekte "101 Resmi" ya da "101 Gayrı Resmi" seçmek zorunlu.' },
      { t: 'Bankaya verdiysen', a: 'Satırdaki banka düğmesine (bina simgesi) bas: "Bankaya takasa ver". Çek "Bankada" sekmesine geçer. Parası hesaba girince "Tahsil oldu" de.' },
      { t: 'Birine ödeme olarak verdiysen', a: 'Satırdaki oklu düğme (Ciro): çeki tedarikçiye vermiş olursun. Tedarikçinin borcu düşer.' },
      { t: 'Vadesi gelince', a: '"Tahsil Et" de, para hangi hesaba girdiyse onu seç. Çek karşılıksız çıktıysa yasak simgesine bas.' },
      { t: 'Yaklaşan vadeler', a: '"7 gün" ve "Vadesi geçmiş" sekmeleri önce bakman gerekenleri gösterir.' },
    ],
    dikkat: [
      'Çeki bir yere verdiğin gün sisteme işle. İşlemezsen çek hâlâ "elimizde" görünür ve rakamlar yanlış çıkar.',
      '"Elimizde" sadece Portföyde sekmesindekilerdir. Bankadakiler ve verilenler elde sayılmaz.',
      'Her ay sistemdeki "Portföyde" listesini kasadaki gerçek çeklerle karşılaştır.',
    ],
    terimler: [
      { t: 'Portföy', a: 'Elimizde duran çek/senetler.' },
      { t: 'Ciro', a: 'Aldığımız çeki arkasını imzalayıp başkasına ödeme olarak vermek.' },
      { t: 'Takas / Tahsile verme', a: 'Çeki bankaya vermek; banka vadesinde parasını tahsil edip hesabımıza yatırır.' },
      { t: 'Karşılıksız', a: 'Çekin hesabında para çıkmaması; çek ödenmedi demek.' },
      { t: 'Vade', a: 'Çekte yazan ödeme günü.' },
      { t: '101 Resmi / Gayrı Resmi', a: 'Çekin hangi muhasebe hesabında izlendiği (resmi kayıt / kayıt dışı ayrımı).' },
    ],
    sekmeler: {
      portfoy: { t: 'Portföyde', a: 'Şu an elimizde olan, henüz bir yere verilmemiş çek/senetler.' },
      yaklasan: { t: '7 gün', a: 'Vadesi önümüzdeki 7 gün içinde olanlar. Hazırlık yap.' },
      gecmis: { t: 'Vadesi geçmiş', a: 'Vadesi geçmiş ama hâlâ portföyde görünenler. Tahsil edilmiş ya da verilmiş olabilir: durumunu güncelle.' },
      bankada: { t: 'Bankada', a: 'Bankaya takasa verdiğimiz çekler. Banka parayı hesaba yatırınca "Tahsil oldu" de.' },
      kapali: { t: 'Kapananlar', a: 'Tahsil edilmiş, ödenmiş ya da başkasına verilmiş (ciro) olanlar. Artık elimizde değiller.' },
      karsiliksiz: { t: 'Karşılıksız', a: 'Ödenmeyen çek/senetler. Hukuki takip ve cari takibi gerekir.' },
      hepsi: { t: 'Tümü', a: 'Her durumdaki bütün çek ve senetler.' },
    },
  },

  'banka-ekstresi': {
    baslik: 'Banka Mutabakatı',
    ozet: 'Bankanın bize gönderdiği hesap dökümü ile bizim sistemdeki kayıtlarımızı yan yana koyup "aynı mı?" diye kontrol etme. Bankada olup bizde olmayan bir işlem varsa buradan tek tıkla sisteme eklersin.',
    akis: ['Ekstreyi bankadan indir', 'Yükle', 'Otomatik eşleştir', 'Kalanları elle işle'],
    adimlar: [
      { t: 'Hesabı seç', a: 'Üstteki kutudan hangi banka hesabının ekstresine bakacağını seç.' },
      { t: 'Ekstreyi yükle', a: 'Bankanın internet şubesinden hareketleri CSV/Excel olarak indir, "Ekstre Yükle"ye bas. Tarih, Açıklama ve Tutar sütunları otomatik tanınır. Çıkan paralar eksi yazılır.' },
      { t: 'Otomatik Eşleştir', a: 'Bu düğme aynı tutarlı ve tarihli kayıtları kendisi eşler. Yeşil "Eşleşti" olanlar tamamdır.' },
      { t: 'Kalanları elle işle', a: 'Eşleşmeyen satırda 3 seçenek var: "Eşleştir" (sistemde zaten var ama bulamadı), "İşlem Oluştur" (sistemde yok, ekle) ya da X (önemsiz, yoksay).' },
      { t: 'Yapay zeka yardımı', a: '"AI ile öner" açıklamaya bakıp hangi cari ve kategori olabileceğini önerir. Yine de sen onayla.' },
    ],
    dikkat: [
      'Eşleşme oranı %100\'e yaklaşınca banka ile sistem tutuyor demektir.',
      'Yanlış eşleştirdiysen "Geri al" düğmesi var.',
      'Aynı ekstreyi iki kere yükleme.',
    ],
    terimler: [
      { t: 'Mutabakat', a: 'İki tarafın kayıtlarının uyuştuğunu doğrulamak.' },
      { t: 'Ekstre', a: 'Bankanın hesap hareket dökümü.' },
      { t: 'Yoksay', a: 'Bu satırı eşleştirme listesinden çıkar, önemsiz.' },
    ],
    sekmeler: {
      eslesmedi: { t: 'Eşleşmemiş', a: 'Henüz sistemdeki bir kayıtla eşleşmemiş banka satırları. Asıl işin burada.' },
      eslesti: { t: 'Eşleşen', a: 'Sistemle tutmuş satırlar. Kontrol amaçlı bakabilirsin.' },
      yoksayildi: { t: 'Yoksayılan', a: 'Önemsiz dediğin satırlar. Yanlışlıkla yoksaydıysan "Geri al".' },
      hepsi: { t: 'Tümü', a: 'Bütün ekstre satırları.' },
    },
  },

  'fiyat-listeleri': {
    baslik: 'Fiyatlandırma',
    ozet: 'Farklı müşteri gruplarına farklı fiyat uygulamak için fiyat listeleri (örn. Perakende, Bayi, İhracat). Listeyi cariye atarsan fatura keserken fiyat kendiliğinden gelir.',
    adimlar: [
      { t: 'Liste oluştur', a: '"Yeni Liste" ile bir liste aç (örn. "Bayi"). Birini "Varsayılan" yaparsan listesi olmayan müşterilere o uygulanır.' },
      { t: 'Fiyatları gir', a: 'Soldan listeyi seç; sağda ürünler çıkar. Her ürünün fiyatını yaz.' },
      { t: 'Toplu zam/indirim', a: '"Toplu Fiyat Güncelle" ile bütün fiyatlara yüzde olarak zam ya da indirim yap. Kopyalarken de yüzde ekleyebilirsin.' },
      { t: 'Miktar iskontosu', a: '"Miktar Kademeli İskonto" bölümünde çok alana indirim tanımla (örn. 1000 adetten sonra %5).' },
      { t: 'Cariye ata', a: 'Cari Hesaplar sayfasında firmayı açıp fiyat listesini seç.' },
    ],
    dikkat: [
      'Fiyatsız ürün varsa üstte "Fiyatsız" sayısı görünür; boş bırakma, faturada fiyat 0 gelir.',
      'Hammadde zammı gelince tüm listeleri güncellemeyi unutma.',
    ],
    terimler: [
      { t: 'Kademe', a: 'Miktar arttıkça uygulanan indirim basamağı.' },
      { t: 'Varsayılan liste', a: 'Özel listesi olmayan herkes için geçerli liste.' },
    ],
    sekmeler: {
      hepsi: { t: 'Tümü', a: 'Bu listedeki bütün ürünler.' },
      fiyatli: { t: 'Fiyatlı', a: 'Fiyatı girilmiş ürünler.' },
      fiyatsiz: { t: 'Fiyatsız', a: 'Fiyatı hâlâ girilmemiş ürünler. Önce bunları doldur.' },
    },
  },

  raporlar: {
    baslik: 'Raporlar',
    ozet: 'Şirketin durumunu özetleyen hazır tablolar ve grafikler: kâr/zarar, nakit akışı, KDV, kimin bize ne kadar geciktirdiği ve satışlar. Yazdırabilir ya da Excel\'e indirebilirsin.',
    adimlar: [
      { t: 'Dönemi seç', a: 'Sağ üstten Bu ay, Geçen ay, Bu yıl ya da "Özel" ile tarih aralığı seç.' },
      { t: 'Rapor türünü seç', a: 'Kâr/Zarar, Nakit Akışı, KDV, Yaşlandırma ya da Satış Analizi sekmelerinden birine geç.' },
      { t: 'Oku', a: 'Üstteki renkli kutular özet, altındaki tablo ve grafikler ayrıntıdır.' },
      { t: 'Dışa aktar', a: 'Yazdır ya da indir düğmeleriyle mali müşavire gönderebilirsin. Mali müşavire verilecek Excel\'ler için Muhasebe AI › Raporlar sekmesine bak.' },
    ],
    dikkat: [
      'Rapor nakit bazlıdır. Virman, kur farkı ve bakiye düzeltmeleri kâr/zarara girmez.',
      'Bir ayın gideri ya da geliri hiç girilmemişse rapor yanıltıcı çıkar (kâr olduğundan yüksek görünür). Önce eksik ayları tamamla.',
    ],
    terimler: [
      { t: 'Kâr marjı', a: 'Satışın yüzde kaçının kâr olarak kaldığı.' },
      { t: 'Yaşlandırma', a: 'Alacak ya da borcun kaç gündür beklediğinin gruplanması (0-30, 31-60, 61-90, 90+ gün).' },
      { t: 'KDV', a: 'Hesaplanan KDV (sattığımızdan) eksi indirilecek KDV (aldığımızdan) = devlete ödeyeceğimiz ya da devletten alacağımız.' },
    ],
    sekmeler: {
      kz: { t: 'Kâr / Zarar', a: 'Gelirden giderleri çıkarır. Kalan pozitifse kâr, negatifse zarar. Hangi kalemde ne kadar harcadığımızı da gösterir.' },
      nakit: { t: 'Nakit Akışı', a: 'Kasa ve bankalara ne kadar para girdi, ne kadar çıktı, hesap hesap.' },
      kdv: { t: 'KDV', a: 'Aylık hesaplanan ve indirilecek KDV. Beyan öncesi mali müşavirle birlikte kontrol edilir.' },
      yas: { t: 'Yaşlandırma', a: 'Müşterilerin ödemelerini ne kadar geciktirdiğini ve bizim tedarikçilere ne kadar geciktirdiğimizi gösterir.' },
      satis: { t: 'Satış Analizi', a: 'Aylık satış, en çok alan müşteriler ve en çok satan ürünler.' },
    },
  },

  ai: {
    baslik: 'Muhasebe AI',
    ozet: 'Yapay zekaya normal bir insana soruyormuş gibi soru sorarsın; sistemdeki gerçek rakamlara bakıp cevap verir. Fatura/dekont fotoğrafını okutabilir, Excel raporları hazırlayabilir. Nihai karar yine mali müşavirindir.',
    adimlar: [
      { t: 'Soru sor', a: '"Soru sor" sekmesine yaz ya da mikrofona basıp konuş. Kısa ve net yaz; firma adını yazman yeter.' },
      { t: 'Belge okut', a: '"Belge yükle"ye fatura, irsaliye ya da dekont fotoğrafı/PDF\'i yükle. İçindeki bilgileri çıkarır; sonra o belge hakkında soru sorabilirsin.' },
      { t: 'Excel raporu indir', a: '"Raporlar" sekmesinden KDV hazırlık, aylık yönetim raporu ya da İndirilecek KDV listesini seç, indir.' },
      { t: 'Mevzuatı kontrol et', a: '"Güncel mevzuat" vergi oranları ve kuralların kayıtlı olduğu yerdir. Sarı uyarı varsa o bilgi eski ya da tek kaynaklı olabilir.' },
    ],
    ornekler: [
      'Elimizde kaç çek var, toplam ne kadar?',
      'X firmanın bakiyesi ne?',
      'Eylül ayında ne kadar sattık, kâr mı zarar mı?',
      'Sistemde hata ya da eksik veri var mı?',
      'Önümüzdeki 3 ayda nakit durumumuz nasıl?',
      'Şirketi nasıl büyütürüz?',
    ],
    dikkat: [
      'Yapay zeka sadece sistemdeki veriye göre konuşur. Veri eksikse eksik cevap verir; bunu zaten uyarır.',
      'Vergi/mevzuat konusunda kesin karar için mali müşavire danış.',
      'Beğenmediğin ya da yanlış bulduğun cevabı bize haber ver.',
    ],
    sekmeler: {
      sor: { t: 'Soru sor', a: 'Yazarak ya da konuşarak soru sor. Önceki sohbetlerine üstten ulaşabilirsin.' },
      belge: { t: 'Belge yükle', a: 'Fatura/dekont fotoğrafını yükle, yapay zeka okusun. Okuduğu bilgiyi sen kontrol et.' },
      rapor: { t: 'Raporlar', a: 'Excel olarak indirilebilen hazır raporlar: KDV, aylık yönetim raporu, indirilecek KDV listesi.' },
      mevzuat: { t: 'Güncel mevzuat', a: 'Vergi oranı, limit gibi bilgilerin saklandığı liste. Yapay zeka vergi cevaplarını buradan alır.' },
    },
  },

  'ai-egit': {
    baslik: 'Yapay Zekayı Eğit',
    ozet: 'Yapay zeka bazen yanlış anlayabilir. Burada ona "böyle sorulunca şöyle düşün" diye ders verirsin. Eklediğin ders hemen kullanılır. Yanlış bir ders olursa tek tıkla kapatırsın.',
    akis: ['Yanlış cevap görürsün', 'Dersi yazarsın', 'Ekle', 'Yapay zeka öğrenir'],
    adimlar: [
      { t: 'Ders ekle', a: '"Yeni ders ekle" kutusuna yapay zekaya sorulacak cümleyi ve doğru anlayışı yaz. Örnek: "Takastaki çekler" → "Elde sayılmaz, sadece Garanti Bankası\'na verilenleri listele."' },
      { t: 'Hemen çalışır', a: '"Dersi ekle"ye basınca yapay zeka o dersi bir sonraki soruda kullanır. Ayrıca onay gerekmez.' },
      { t: 'Yanlışsa kapat', a: 'Yanlış öğrettiğini fark edersen "Kapat" de. Silinmez, yapay zeka artık kullanmaz. İstersen sonra "Yeniden aç" dersin.' },
    ],
    ornekler: ['Takastaki çek = bankaya tahsile verilen, elde sayılmaz', 'Ciro dediğimde sadece ürün satışı', 'Kalkan Ambalaj = koli tedarikçisi'],
    dikkat: [
      'Ders yazarken rakam yazma. Rakamlar her zaman güncel kayıttan alınır; eski rakam yanlış sonuç verir.',
      'Kısa ve net yaz. "Ne zaman, ne yapsın" yeterli.',
      'Ders verme yetkisi bu menüden muhasebe yetkisi olanlarda var.',
    ],
    terimler: [
      { t: 'Aktif', a: 'Yapay zeka benzer sorularda bu dersi kullanıyor.' },
      { t: 'Kapalı', a: 'Durduruldu. Silinmedi, istenirse yeniden açılır.' },
    ],
  },

  'pos-tahsilat': {
    baslik: 'POS Tahsilatları',
    ozet: 'Kredi kartıyla (POS) yaptığın tahsilatların bankaya yatana kadar takibi. Bankaya geçmeyen, vadesi gelmemiş tutarı burada ve yapay zekada görürsün. Bu sayfa kasa, banka veya kâr-zarara dokunmaz.',
    akis: ['POS tahsilatı yapıldı', 'Buraya "bekliyor" yaz', 'Bankaya yatınca "Yattı"'],
    adimlar: [
      { t: 'Yeni tahsilat ekle', a: 'Müşteriyi cariden seç (ya da adını yaz), tarih ve tutarı gir, kaç günde yatacağını yaz (genelde 30). "Ekle"ye bas.' },
      { t: 'Bankaya yatınca işaretle', a: 'Bekleyenler listesinde ilgili satırda "Yattı"ya bas, yattığı tarihi yaz.' },
      { t: 'Excel al', a: 'Sağ üstteki "Excel indir"e bas. Muhasebe programındaki gibi Borç / Alacak / Bakiye ekstresi iner. Son bakiye bankaya geçmeyi bekleyen tutardır.' },
    ],
    dikkat: ['Beklenen yatış tarihi bir tahmindir; banka genelde 26-42 günde yatırıyor.', 'Vadesi geçtiği halde yatmayan tutarı bankaya sor.', 'Bu sayfa bilgi amaçlıdır; para bankaya girince banka hesabına ayrıca kaydedersin.'],
  },

  'kira-plani': {
    baslik: 'Kira Planı',
    ozet: 'Şirketin kirasını kime, hangi gün, ne kadar bankadan ne kadar elden ödediğini yazdığın yer. Yapay zeka "kira ödemelerimi nasıl yapıyorum" sorusunu buradan cevaplar. Yeni kira gelirse buraya eklersin, yapay zeka hemen bilir.',
    akis: ['Yeni kira ya da zam', 'Buraya yaz', 'Yapay zeka bilir'],
    adimlar: [
      { t: 'Yeni kira ekle', a: 'Üstteki kutuya ev sahibini, ayın kaçında ödendiğini, bankadan ve elden tutarları yaz, "Ekle"ye bas.' },
      { t: 'Zam olunca güncelle', a: 'Kiralar her yıl Ocak\'ta değişiyorsa ilgili ev sahibinin "Düzenle"sine bas, tutarları değiştir.' },
      { t: 'Kira bitince kapat', a: 'Sözleşme bittiyse "Kapat" de. Silinmez ama toplama ve yapay zeka cevabına girmez.' },
    ],
    dikkat: ['Burası sadece kira DÜZENİNİ gösterir. Gerçek ödemeleri Gelir/Gider ve Kasa/Banka sayfalarına ayrıca yazarsın.', 'Elden ödenen tutarlar için makbuz almayı unutma.'],
  },
}
