// Panelde yeni başlayanlar için merkezi rehber içeriği (Yardım › Başlangıç Rehberi sayfası).
export type Modul = { id: string; baslik: string; menu: string; ne: string; adimlar: { t: string; a: string }[]; dikkat?: string[] }

export const ILK_GUN: { t: string; a: string }[] = [
  { t: 'Giriş yap', a: 'Sana verilen e-posta ve şifreyle panele gir. Şifreni kimseyle paylaşma; herkesin kendi hesabı var, yapılan her işlem adınla kaydedilir.' },
  { t: 'Şifreni değiştir', a: 'Sol menünün en altında adının olduğu kutuya tıkla, "Şifre değiştir"i seç. Sana verilen ilk şifreyi hemen kendi şifrenle değiştir. İstersen aynı yerden iki adımlı doğrulamayı da aç.' },
  { t: 'Menüyü tanı', a: 'Sol taraftaki menüde yalnızca senin yetkin olan bölümler görünür. Bir bölümü göremiyorsan yetkin yoktur; yöneticine söyle, kendin değiştiremezsin.' },
  { t: 'Günlük Özet\'e bak', a: 'Menüde "Genel › Günlük Özet": bugün dikkat etmen gerekenleri (vadesi geçen alacaklar, yaklaşan ödemeler, kritik stok, geciken siparişler) tek sayfada gösterir. Her sabah ilk bunu aç.' },
  { t: 'AI Asistan\'ı dene', a: 'Menüde "AI Asistan": yazarak ya da mikrofona basıp konuşarak soru sor. Örnek: "Bu ay gelir gider nasıl?" Sadece okur, hiçbir şeyi silmez veya değiştirmez, bu yüzden denemekten korkma.' },
  { t: 'Takılınca yardım kutusunu aç', a: 'Muhasebe sayfalarının üstünde "Bu sayfa ne işe yarar?" kutusu var: sade anlatım, adım adım ve kelime sözlüğü içerir. Her zaman oradan başla.' },
]

export const RUTIN: { zaman: string; isler: string[] }[] = [
  { zaman: 'Sabah (ilk 15 dakika)', isler: ['Günlük Özet\'i aç, kırmızı olanlara önce bak.', 'Muhasebe › Genel Bakış: kasa/banka ve yaklaşan vadeler.', 'Stok › Hammadde: kritik seviyedeki malzeme var mı?', 'Üretim › Üretim Emirleri: bugün çalışacak emirler.'] },
  { zaman: 'Gün içinde', isler: ['Para girdi/çıktıysa hemen kaydet (Gelir/Gider ya da faturadan Tahsilat/Ödeme). Akşama bırakma, unutulur.', 'Yeni sipariş gelince Satış Siparişleri\'ne gir; mal çıkınca Sevkiyat\'tan işle.', 'Müşteri bir şey sorarsa önce AI Asistan\'a sor (cari bakiyesi, son sipariş, ürün fiyatı).'] },
  { zaman: 'Akşam (kapanış)', isler: ['Bugün girmediğin işlem kaldı mı? (kasa, banka, fatura)', 'Banka Ekstresi geldiyse Muhasebe › Banka Ekstresi\'nden yükle ve eşleştir.', 'Yarın vadesi gelen çek/senet var mı? (Çek/Senet › 7 gün)'] },
  { zaman: 'Ay sonu', isler: ['Raporlar sayfasından aylık raporu al.', 'Banka ve kasa bakiyelerini gerçek hesapla karşılaştır; fark varsa yöneticine söyle.', 'Cari mutabakat: büyük bakiyeli müşteri ve tedarikçilerle bakiyeni teyit et.'] },
]

export const MODULLER: Modul[] = [
  { id: 'muh-islem', baslik: 'Gelir / Gider kaydı', menu: 'Muhasebe › Gelir/Gider', ne: 'Faturasız para hareketlerini (kira, maaş, elektrik, nakit satış vb.) kaydedersin. Kasa/banka bakiyesi otomatik değişir.',
    adimlar: [{ t: 'Yeni kayıt aç', a: 'Sağ üstteki "Yeni" düğmesine bas.' }, { t: 'Türü seç', a: 'Gelir = para girdi, Gider = para çıktı.' }, { t: 'Doldur', a: 'Tutar, tarih, kategori ve paranın hangi kasa/bankaya girip çıktığını seç. Müşteri/tedarikçi ödemesiyse cariyi mutlaka seç.' }, { t: 'Kaydet', a: 'Kaydedince kasa/banka ve (cari seçtiysen) cari bakiye kendiliğinden güncellenir.' }],
    dikkat: ['Aynı parayı hem faturadan hem buradan girme, çift sayılır.', 'Yanlış girdiysen kaydı düzenlemek yerine yöneticine söyle; silme/düzeltme muhasebeyi bozabilir.'] },
  { id: 'muh-fatura', baslik: 'Faturalar', menu: 'Muhasebe › Faturalar', ne: 'Kestiğimiz (satış) ve bize gelen (alış) faturalar. Faturayı önce taslak hazırlarsın, kontrol edip onaylarsın.',
    adimlar: [{ t: 'Taslak oluştur', a: 'Yeni fatura de, müşteriyi/tedarikçiyi seç, kalemleri ve KDV\'yi gir.' }, { t: 'Kontrol et, onayla', a: 'Onaylayınca müşterinin borcu yazılır, stok düşer. Onaydan sonra değiştirmek zordur; önce iyice kontrol et.' }, { t: 'Parası gelince kapat', a: 'Faturaya tıkla, "Tahsilat" (satış) ya da "Ödeme" (alış) de. Kısmi ödeme de olur; tamamı ödenince fatura "Ödendi" olur.' }],
    dikkat: ['Vadesi geçmiş faturalar "Gecikmiş" sekmesinde toplanır; önce onları ara.'] },
  { id: 'muh-cari', baslik: 'Cari hesaplar (müşteri / tedarikçi)', menu: 'Muhasebe › Cari Hesaplar', ne: 'Her firmanın bize borcunu ya da bizim ona borcumuzu gösterir. Pozitif bakiye = firma bize borçlu, negatif = biz firmaya borçluyuz.',
    adimlar: [{ t: 'Firmayı bul', a: 'Üstteki aramaya ünvanı ya da cari kodunu yaz. İç mekan müşterileri 120.01/120.02, dış mekan müşterileri 120.03, tedarikçiler 320 ile başlar.' }, { t: 'Ekstreyi aç', a: 'Firmaya tıkla: tüm fatura, tahsilat ve ödemeleri tarih sırasıyla görürsün.' }, { t: 'Para aldıysan/verdiysen', a: 'Detaydaki Tahsilat (müşteriden aldık) ya da Ödeme (tedarikçiye verdik) düğmesiyle işle; bakiye otomatik düşer.' }],
    dikkat: ['Aynı firmayı iki kez açma. Önce ara, yoksa yeni cari aç.', 'Tahsilat listesi isteyince AI Asistan iç mekan ve dış mekanı ayrı ayrı verir.'] },
  { id: 'muh-kasa', baslik: 'Kasa / Banka ve Banka Ekstresi', menu: 'Muhasebe › Kasa/Banka, Banka Ekstresi', ne: 'Hangi kasada/bankada ne kadar para var. Banka ekstresini yükleyip panelle karşılaştırırsın.',
    adimlar: [{ t: 'Bakiyeye bak', a: 'Kasa/Banka sayfasında her hesabın güncel bakiyesi görünür (TL, USD, EUR ayrı).' }, { t: 'Ekstre yükle', a: 'Banka Ekstresi sayfasından bankadan indirdiğin Excel/PDF dosyasını yükle; satırlar listelenir.' }, { t: 'Eşleştir', a: 'Her satırı ilgili işleme/cariye bağla. Eşleşmeyen satırlar "eşleşmedi" olarak bekler.' }],
    dikkat: ['Panel bakiyesi ile banka bakiyesi farklıysa nedeni genelde işlenmemiş bir hareket ya da çift kayıttır. Kendin "bakiye düzeltme" yapma, yöneticine söyle.'] },
  { id: 'muh-cek', baslik: 'Çek / Senet', menu: 'Muhasebe › Çek/Senet', ne: 'Aldığımız ve verdiğimiz çek/senetlerin takibi: elimizde mi, bankada mı, birine verildi mi, vadesi ne zaman.',
    adimlar: [{ t: 'Yeni evrak', a: 'Çeki/senedi girerken tutar, vade, banka ve cariyi yaz.' }, { t: 'Vadesi gelince', a: '"Tahsil Et" de, para hangi hesaba girdiyse onu seç. Karşılıksız çıkarsa ilgili düğmeyi kullan.' }, { t: 'Takip', a: '"7 gün" ve "Vadesi geçmiş" sekmeleri önce bakman gerekenleri gösterir.' }] },
  { id: 'stok', baslik: 'Stok / Depo', menu: 'Stok / Depo › Depolar, Hammadde, Stok Hareketleri, Barkod', ne: 'Depodaki hammadde ve mamul miktarları. Her giriş ve çıkış bir "hareket" olarak kaydedilir.',
    adimlar: [{ t: 'Miktarı gör', a: 'Hammadde ve Depolar sayfalarında güncel miktar, kritik seviye altındakiler kırmızı görünür.' }, { t: 'Giriş/çıkış yap', a: 'Mal geldiğinde ya da kullanıldığında Stok Hareketleri\'nden işle. Telefondan hızlı yapmak için "Barkod ile İşlem"i kullan.' }, { t: 'Sayım farkı', a: 'Sayımda fark çıkarsa farkı kendin gizleme; yöneticine bildir.' }],
    dikkat: ['Fatura onaylanınca stok kendiliğinden düşer; ayrıca elle çıkış yapma.'] },
  { id: 'uretim', baslik: 'Üretim', menu: 'Üretim › Makineler, Kalıplar, Reçeteler, Ürün Maliyeti, Üretim Emirleri, Canlı Üretim', ne: 'Neyi, hangi makinede, ne kadar üreteceğimizi planlar ve maliyetini hesaplar.',
    adimlar: [{ t: 'Üretim emri aç', a: 'Üretim Emirleri\'nden ürünü, adedi ve makineyi seçerek emir oluştur. Reçete (BOM) hangi hammaddeden ne kadar harcanacağını belirler.' }, { t: 'Canlı takip', a: 'Canlı Üretim sayfası makinelerin anlık durumunu gösterir.' }, { t: 'Maliyet', a: 'Ürün Maliyeti sayfasında ürünü seç: hammadde + baskı + koli + etiket + genel gider = toplam. Kur ve hammadde fiyatı Ayarlar sekmesinde. AI Asistan\'a "X ürünün maliyeti ne" diye de sorabilirsin.' }],
    dikkat: ['Maliyet tablosunda değişiklik fiyatları etkiler; emin değilsen yöneticine sor.'] },
  { id: 'satis', baslik: 'Satış, teklif ve ihracat', menu: 'Satış / Lojistik › Satış Siparişleri, Fiyat Teklifleri, İhracat Evrakları', ne: 'Müşteri siparişleri, tekliflerin hazırlanması ve ihracat belgeleri.',
    adimlar: [{ t: 'Teklif hazırla', a: 'Fiyat Teklifleri\'nden müşteri ve ürünleri seç, fiyat listesinden fiyat otomatik gelir; teklifi PDF/görsel olarak paylaşabilirsin.' }, { t: 'Siparişe çevir', a: 'Müşteri onaylayınca Satış Siparişleri\'ne gir; stok ve üretim buna göre planlanır.' }, { t: 'İhracat evrakları', a: 'İhracat siparişinde fatura, çeki listesi gibi belgeleri İhracat Evrakları\'ndan hazırla.' }] },
  { id: 'satinalma', baslik: 'Satınalma', menu: 'Satış / Lojistik › Satınalma Siparişleri, Talepler/Teklifler, Tedarikçiler, İade/Ret', ne: 'Hammadde ve malzeme alımı: talep, teklif karşılaştırma, sipariş, iade.',
    adimlar: [{ t: 'Talep aç', a: 'Neye ihtiyaç var, ne kadar? Talepler/Teklifler\'e yaz.' }, { t: 'Teklifleri kıyasla', a: 'Tedarikçilerden gelen fiyatları yan yana karşılaştır.' }, { t: 'Siparişe çevir', a: 'En uygununu Satınalma Siparişi yap. Mal gelince stoğa gir; hatalı mal varsa İade/Ret\'ten işle.' }] },
  { id: 'sevkiyat', baslik: 'Sevkiyat', menu: 'Satış / Lojistik › Sevkiyat / İhracat', ne: 'Hazır malın müşteriye çıkışı, nakliye ve ihracat takibi.', adimlar: [{ t: 'Sevkiyat oluştur', a: 'İlgili siparişi seç, çıkacak miktarı gir.' }, { t: 'Durumu güncelle', a: 'Yola çıktı, teslim edildi gibi durumları işle; müşteriye bilgi verirken buradan bak.' }] },
  { id: 'kalite', baslik: 'Kalite ve fire', menu: 'Kalite & Bakım › Kalite Kontrol, Fire Yönetimi', ne: 'Üretilen ürünün kontrolü ve fire (kullanılamayan) kayıtları.', adimlar: [{ t: 'Kontrol kaydı', a: 'Partiyi kontrol edince sonucu (uygun/uygun değil) ve nedenini yaz.' }, { t: 'Fire kaydı', a: 'Ne kadar fire çıktığını ve nedenini (renk, çapak, kırık vb.) gir; hangi nedenin çok olduğunu raporlardan görürsün.' }] },
  { id: 'personel', baslik: 'Personel (puantaj)', menu: 'Personel › Giriş-Çıkış / Puantaj', ne: 'Çalışanların giriş-çıkış saatleri ve puantaj.', adimlar: [{ t: 'Günlük kayıt', a: 'Gelmeyen/geç gelen/fazla mesai yapanı o gün işle.' }, { t: 'Ay sonu', a: 'Puantajı kontrol et; maaş/bordro buna göre hazırlanır.' }], dikkat: ['Maaş ve kişisel bilgiler gizlidir; kimseyle paylaşma.'] },
  { id: 'site', baslik: 'Ürünler ve web sitesi', menu: 'Ürün Yönetimi, Site Yönetimi', ne: 'Web sitesindeki ürünler, kategoriler, görseller ve yazılar. Burada yaptığın değişiklik kısa süre sonra sitede görünür.',
    adimlar: [{ t: 'Ürün ekle/düzenle', a: 'Ürünler\'den ad, kod, kategori, iç/dış mekan bilgisini ve fotoğrafı gir. Fotoğrafsız ürün sitede görünmez.' }, { t: 'Yeni etiketi', a: 'Ürünü "Yeni" işaretlersen sitede turuncu YENİ rozeti alır.' }, { t: 'Siteyi kontrol et', a: 'Değişiklikten sonra siteyi açıp ürünün doğru göründüğünü bak (sayfa 5 dakikaya kadar gecikebilir).' }] },
]

export const AI_ORNEK: { k: string; sorular: string[] }[] = [
  { k: 'Para ve muhasebe', sorular: ['Bu ay gelir ve gider durumu nasıl?', 'Garanti hesabında şu an ne kadar var?', 'Vadesi geçmiş faturalar neler?', 'Dış mekan tahsilat listesi ver.', 'İç mekan tahsilat listesini Excel olarak ver.'] },
  { k: 'Müşteri / tedarikçi', sorular: ['Eko Garden\'ın bakiyesi ne kadar?', 'Doğa Polimer\'e ne ödedik, borcumuz kaldı mı?', 'En çok borcu olan 10 müşteri kim?'] },
  { k: 'Maliyet ve fiyat', sorular: ['Çeşme saksı 28L\'nin maliyeti nedir?', 'Dolar 55 olsa ve hammadde %10 artsa maliyet ne olur?', 'Kârlılığı en düşük 5 ürün hangisi?'] },
  { k: 'Stok, üretim, sipariş', sorular: ['Kritik seviyedeki stoklar neler?', 'Açık siparişler ve termini yaklaşanlar', 'Üretimdeki emirlerin durumu'] },
]

export const AI_IPUCU: string[] = [
  'Yazarak ya da mikrofona basıp konuşarak sorabilirsin.',
  'Ne istediğini net söyle: "Dış mekan tahsilat listesi" gibi. Belirsizse AI sana bir pencere açıp soru sorar; seçeneği tıklaman yeterli.',
  'AI yalnızca okur. Kayıt ekleyemez, silemez, bakiye değiştiremez. Bir şeyi değiştirmek için ilgili sayfayı kullan.',
  'Verdiği rakamı önemli bir işte kullanacaksan ilgili sayfadan da bir kez kontrol et.',
  '"Excel olarak ver" dersen indirilebilir dosya hazırlar.',
]

export const SOZLUK: { t: string; a: string }[] = [
  { t: 'Cari', a: 'Müşteri ya da tedarikçi hesabı. Bir firmayla aramızdaki borç-alacak defteri.' },
  { t: 'Bakiye', a: 'Bir hesabın güncel durumu. Cari için pozitif: firma bize borçlu; negatif: biz firmaya borçluyuz.' },
  { t: 'Tahsilat', a: 'Müşteriden para almak.' },
  { t: 'Ödeme', a: 'Tedarikçiye ya da bir kuruma para vermek.' },
  { t: 'Vade', a: 'Ödemenin/tahsilatın son günü.' },
  { t: 'Alacak / Borç', a: 'Alacak: başkasından alacağımız para. Borç: başkasına ödememiz gereken para.' },
  { t: 'Takas', a: 'Çekin bankaya tahsile verilmesi; vadesinde banka parasını hesabımıza yatırır.' },
  { t: 'Mutabakat', a: 'Panel ile gerçek (banka, cari ekstresi) rakamların karşılaştırılıp eşitlenmesi.' },
  { t: 'BOM / Reçete', a: 'Bir ürünü üretmek için gereken hammadde listesi ve miktarları.' },
  { t: 'Fire', a: 'Üretimde kullanılamayan, çöpe giden miktar.' },
  { t: 'Hammadde', a: 'Üretimde kullanılan plastik granül gibi ham malzeme.' },
  { t: 'İç mekan / Dış mekan', a: 'Ürün ve müşteri grupları. Dış mekan: bahçe, teras, peyzaj. İç mekan: salon, balkon, ev.' },
  { t: 'KDV', a: 'Katma değer vergisi. Faturada ayrı satır olarak görünür.' },
]

export const SORUN: { s: string; c: string }[] = [
  { s: 'Menüde bir bölümü göremiyorum.', c: 'Yetkin o bölüme tanımlı değildir. Yöneticine söyle, kendin açamazsın.' },
  { s: 'Bir rakam yanlış görünüyor.', c: 'Sayfayı yenile (Ctrl+F5). Hâlâ yanlışsa hangi sayfada, hangi rakam olduğunu not alıp yöneticine bildir; kendin "düzeltme" kaydı girme.' },
  { s: 'Yanlış bir kayıt girdim.', c: 'Panikleme. Hangi kayıt, hangi tarih ve tutar olduğunu not alıp yöneticine söyle. Kaydı silmek bakiyeleri bozabileceği için yetkili düzeltir.' },
  { s: 'Banka bakiyesi ile panel uyuşmuyor.', c: 'Genelde işlenmemiş bir banka hareketi ya da çift kayıt vardır. Banka Ekstresi sayfasından eşleşmeyen satırlara bak.' },
  { s: 'AI Asistan cevap vermedi ya da hata verdi.', c: 'Soruyu daha kısa ve net yaz, tekrar dene. Sürerse yöneticine haber ver.' },
  { s: 'Web sitesinde değişikliğim görünmüyor.', c: 'Site 5 dakikaya kadar gecikmeli güncellenir. Sonra Ctrl+F5 ile yenile.' },
  { s: 'Şifremi unuttum.', c: 'Giriş ekranından şifre sıfırlamayı kullan ya da yöneticinden yeni şifre iste.' },
]

export const ALTIN: { y: boolean; m: string }[] = [
  { y: true, m: 'Her para hareketini aynı gün kaydet.' },
  { y: true, m: 'Müşteri/tedarikçi ödemesinde cariyi mutlaka seç.' },
  { y: true, m: 'Emin değilsen sor: önce AI Asistan, sonra yöneticin.' },
  { y: false, m: 'Şifreni kimseyle paylaşma, başkasının hesabıyla girme.' },
  { y: false, m: 'Aynı işlemi iki yerden (fatura + gelir/gider) girme.' },
  { y: false, m: 'Bakiye düzeltme, silme gibi işleri yetkili olmadan yapma.' },
  { y: false, m: 'Müşteri, maaş ve fiyat bilgilerini panel dışına taşıma.' },
]
