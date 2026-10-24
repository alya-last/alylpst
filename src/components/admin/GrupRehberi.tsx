'use client'
import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { Modal, Tabs } from '@/components/admin/erp/ui'
import { GRUPLAR, type GrupId } from '@/lib/kontrol-gruplar'

type Bolum = { v: string; l: string; icerik: (string | { b: string; t: string[] })[] }

const UYARI_BOLUMU: Bolum = { v: 'kontrol', l: 'Uyarılar', icerik: [
  'Üst çubuktaki "N uyarı" düğmesi bu menü grubunun otomatik kontrolleridir. Pencere açıldığında ve her 5 dakikada bir yenilenir; sorun yoksa "Kontroller temiz" yazar.',
  { b: 'Renkler', t: ['Kırmızı HATA: veriler birbiriyle çelişiyor, hemen düzeltilmeli (ör. stok hareketle uyuşmuyor).', 'Sarı UYARI: geciken ya da eksik kalan iş (ör. teslim tarihi geçmiş sipariş).', 'Mavi BİLGİ: tamamlanırsa raporlar daha doğru olur (ör. boş depo/tedarikçi alanı).'] },
  { b: 'Toplu düzenle', t: ['Listelerde satırların solundaki kutuları işaretleyin, üstte çıkan "Toplu düzenle" düğmesine basın.', 'Değiştirmek istediğiniz alanın kutusunu işaretleyip yeni değeri seçin (ör. tüm seçili hammaddelere aynı depo ya da tedarikçi); işaretlemediğiniz alanlar değişmez.', 'Stok miktarı, tutar, cari/kasa gibi bakiyeyi etkileyen alanlar toplu düzenlemede yoktur; onlar tek tek kayıttan değiştirilir.'] },
  'Bir uyarının kayıtlarını açıp "Aç ve düzelt" dediğinizde ilgili sayfa o kaydı doğrudan açar; düzelttiğinizde uyarı bir sonraki yenilemede kaybolur.',
] }

const REHBERLER: Record<GrupId, Bolum[]> = {
  stok: [
    { v: 'genel', l: 'Genel mantık', icerik: [
      'Stok iki yerde tutulur: HAMMADDE/AMBALAJ stoğu (hammaddeler tablosu) ve ÜRÜN stoğu (ürün varyantlarının "stok" alanı).',
      'Stok sayısı elle yazılmaz; her değişiklik bir STOK HAREKETİ kaydıdır (giriş/çıkış). Hareket kaydedilince ilgili stok otomatik artar ya da azalır. Bu yüzden stok her zaman hareket toplamına eşit olmalıdır — uyuşmazsa "Stok hareketlerle uyuşmuyor" hatası çıkar.',
      { b: 'Hareket tipleri', t: [
        'Satın alma: tedarikçiden teslim alınan hammadde (giriş).',
        'Üretim girişi: üretim kaydıyla ürün stoğuna eklenen adet (giriş).',
        'Üretim çıkışı: üretimde reçeteye göre düşen hammadde (çıkış, fire dahil).',
        'Satış/Sevkiyat: müşteriye giden ürün (çıkış). Sevkiyat iptal edilirse ters hareket yazılır.',
        'Fire: Kalite > Fire ekranından girilen kayıp (çıkış); fire silinirse geri giriş yazılır.',
        'Sayım / Manuel düzeltme: fiziksel sayım farkı için; açıklama yazın.',
        'İade: tedarikçiye iade (çıkış) veya müşteri iadesi (giriş).',
      ] },
    ] },
    { v: 'hammadde', l: 'Hammadde', icerik: [
      'Min stok: bunun altına düşünce uyarı çıkar; satın alma talebi açın. Max stok: aşılırsa bilgi uyarısı verir.',
      'Ortalama maliyet reçete ve ürün maliyetini besler; 0 bırakılırsa maliyet eksik hesaplanır (uyarı çıkar).',
      'Depo ve tedarikçi seçimi raporlama ve otomatik satın alma önerisi içindir.',
      'Lot: Lot takibi yaptığınız hammaddede lot miktarları toplamı stoğa eşit olmalıdır.',
    ] },
    { v: 'urun', l: 'Ürün stoğu & barkod', icerik: [
      'Ürün stoğu her varyant (renk/ebat) için ayrı tutulur. Satış siparişinde ürün stoğu yeterliyse "karşılanan", yetmeyen kısım "üretim gereken" olarak işaretlenir.',
      'Barkod: depoda ve sevkiyatta okutma içindir. Barkod sayfasından toplu üretilebilir; barkodsuz varyantlar bilgi uyarısı olarak listelenir.',
    ] },
    UYARI_BOLUMU,
  ],
  uretim: [
    { v: 'genel', l: 'Genel mantık', icerik: [
      'Akış: Reçete (ürünün hammadde listesi + kalıp + hedef çevrim/fire) → Üretim emri → Üretim hareketleri (vardiya girişleri) → Tamamlandı.',
      { b: 'Üretim hareketi girince otomatik olanlar', t: [
        'Emirdeki üretilen miktar ve fire miktarı artar.',
        'Ürün stoğuna üretilen adet kadar GİRİŞ yazılır.',
        'Reçetedeki her hammadde için miktar × (üretilen + fire) kadar hammadde stoğundan ÇIKIŞ yazılır.',
      ] },
      'Bu yüzden emirde reçete seçmeden üretim girerseniz hammadde stoğu düşmez; "Reçetesiz üretim emri" uyarısı bunun için vardır.',
    ] },
    { v: 'emir', l: 'Üretim emirleri', icerik: [
      { b: 'Durumlar', t: ['Planlandı → Üretimde → Tamamlandı (ya da Durduruldu / İptal).', 'Üretimde olan emre makine atanmalıdır; makine de "Üretimde" görünür.', 'Tamamlanan emirde bitiş tarihi dolu olmalı ve üretilen miktar planlanana ulaşmalıdır; ulaşmıyorsa uyarı çıkar.'] },
      'Fire oranı reçetedeki hedef fire oranından (%) yüksekse uyarı verilir.',
      '7 günden uzun süre durdurulmuş emir makine ve kalıbı bloke eder; devam ettirin ya da iptal edin.',
    ] },
    { v: 'makine', l: 'Makine & kalıp', icerik: [
      { b: 'Makine durumları', t: ['Müsait, Üretimde, Bakımda, Arızalı, Durduruldu.', 'Arızalı/bakımdaki makinede üretimde emir olmamalıdır.'] },
      { b: 'Kalıp', t: ['Sonraki bakım tarihi geçince uyarı çıkar; bakımı kalıp kartından kaydedin (son bakım güncellenir).', 'Arızalı/bakımdaki kalıp üretimde olan bir emirde kullanılamaz.', 'Kalıp, reçeteye bağlanınca kavite ve çevrim hesapları çalışır.'] },
    ] },
    { v: 'recete', l: 'Reçete', icerik: [
      'Bir ürünün aynı anda yalnızca BİR aktif reçetesi olmalıdır; yeni versiyon açınca eskisini pasife alın.',
      'Reçetede en az bir hammadde kalemi bulunmalıdır.',
      'Hedef çevrim süresi, kalıp ve işçilik/genel gider maliyetleri girilirse verimlilik ve birim maliyet doğru hesaplanır; girilmemişse bilgi uyarısı çıkar.',
    ] },
    UYARI_BOLUMU,
  ],
  satis: [
    { v: 'genel', l: 'Genel mantık', icerik: [
      'Satış akışı: Teklif → (kabul) Satış siparişi → Üretim/stok karşılama → Sevkiyat → Fatura (Muhasebe).',
      'Satın alma akışı: Talep → (onay) Satın alma siparişi → Yolda → Teslim alma (hammadde stoğuna giriş + isteğe bağlı alış faturası) → Ret/İade.',
    ] },
    { v: 'siparis', l: 'Satış siparişi & teklif', icerik: [
      'Sipariş kalemi kaydedilirken ürün stoğu kontrol edilir: yeten kısım "karşılanan", kalanı "üretim gereken" olur.',
      { b: 'Sipariş durumları', t: ['Beklemede → Üretimde → Kısmen hazır → Hazır → Sevk edildi → Tamamlandı (İptal).', 'Teslim tarihi geçmiş ve sevk edilmemiş siparişler uyarı olarak listelenir.'] },
      'Teklif: Taslak → Gönderildi → Kabul/Red. Geçerlilik süresi dolan gönderilmiş teklifler uyarı verir; kabul edilen teklif siparişe dönüştürülmelidir.',
      'Teklif toplamı = ara toplam + KDV olmalıdır.',
    ] },
    { v: 'sevkiyat', l: 'Sevkiyat & ihracat', icerik: [
      { b: 'Sevkiyat', t: ['Durumlar: Hazırlanıyor → Yola çıktı → Teslim edildi (İptal).', 'Sevkiyat, ürün stoğundan çıkış hareketi yazar; iptal edilirse ters hareket yazılır.', 'Siparişe bağlı olmayan, tarihi geçmiş ya da 10 günden uzun süre yolda kalan sevkiyatlar uyarı verir.', 'Brüt ağırlık net ağırlıktan küçük olamaz.'] },
      'İhracat evrakları (Proforma, Packing List, Commercial Invoice) bir satış siparişine bağlanmalıdır; toplamı 0 olan evrak uyarı verir.',
    ] },
    { v: 'satinalma', l: 'Satın alma', icerik: [
      'Sipariş onayı: Ayarlar\'da onay limiti açıksa limiti aşan sipariş yalnızca onay yetkisi olan yönetici tarafından onaylanabilir; onaylayan ve tarih otomatik kaydedilir.',
      'Teslim alma: gelen miktar kalem bazında girilir; fazla gelen (siparişin %10\'undan fazla) engellenir. Eksik teslimli "teslim alındı" siparişler uyarı verir.',
      'Ret/İade: kusurlu gelen malın sonucu (iade edildi, kredi notu, değişim) 7 günden uzun süre bekliyorsa uyarı çıkar.',
      'Beklenen teslim tarihi geçen siparişler uyarı olarak listelenir; tedarikçiyi arayın.',
    ] },
    UYARI_BOLUMU,
  ],
  kalite: [
    { v: 'genel', l: 'Genel mantık', icerik: [
      'Kalite iki kayıt türüyle izlenir: KONTROL kayıtları (giriş, proses, son kontrol) ve FİRE kayıtları.',
      'Her kayıt mümkünse bir üretim emrine bağlanmalıdır; böylece emir bazında red ve fire oranı hesaplanır.',
    ] },
    { v: 'kontrol', l: 'Kalite kontrol', icerik: [
      { b: 'Kurallar', t: ['Uygun adet + red adet = kontrol edilen adet olmalıdır.', '"Uygun" sonuçta red adet olmamalı; "Red" sonuçta red adet sıfır olmamalıdır.', 'Red adedi varsa red nedeni yazılmalıdır (iyileştirme ve tedarikçi değerlendirmesi için).', 'Red oranı %10\'u aşan kontroller sarı uyarı olarak çıkar.', 'Kontrolü yapan kişi seçilirse izlenebilirlik sağlanır.'] },
    ] },
    { v: 'fire', l: 'Fire', icerik: [
      'Fire kaydı girilince ilgili hammadde/ürün stoğundan otomatik ÇIKIŞ hareketi yazılır; fire silinirse geri giriş yazılır.',
      'Fire nedeni, hammadde/ürün ve maliyet etkisi doldurulursa fire analizi ve maliyet raporları doğru çalışır.',
      'Miktarı 0 ya da negatif fire kaydı hata olarak listelenir.',
    ] },
    { v: 'bakim', l: 'Bakım', icerik: [
      'Kalıp bakım tarihi geçince ve makine arızalı/bakımda bekleyince bu gruptan da uyarı çıkar (Üretim > Kalıp / Makine sayfalarından düzeltilir).',
      'Bakım yapıldığında kalıp kartından bakım kaydı ekleyin; "son bakım" ve "sonraki bakım" tarihleri güncellenir.',
    ] },
    UYARI_BOLUMU,
  ],
}

export default function GrupRehberi({ grup }: { grup: GrupId }) {
  const [acik, setAcik] = useState(false)
  const bol = REHBERLER[grup]
  const [tab, setTab] = useState(bol[0].v)
  const b = bol.find(x => x.v === tab) || bol[0]
  return (
    <>
      <button className="adm-btn-ghost" onClick={() => setAcik(true)} title={`${GRUPLAR[grup].ad} nasıl çalışır`} style={{ marginRight: 8 }}>
        <HelpCircle size={14} />Rehber
      </button>
      <Modal open={acik} onClose={() => setAcik(false)} title={`${GRUPLAR[grup].ad} Rehberi`} width={760}>
        <Tabs value={tab} onChange={setTab} tabs={bol.map(x => ({ v: x.v, l: x.l }))} />
        <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6, color: 'var(--adm-tx2)' }}>
          {b.icerik.map((x, i) => typeof x === 'string'
            ? <p key={i} style={{ margin: '0 0 10px' }}>{x}</p>
            : <div key={i} style={{ margin: '0 0 12px' }}>
                <div style={{ fontWeight: 700, color: 'var(--adm-tx)', marginBottom: 4 }}>{x.b}</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>{x.t.map((t, j) => <li key={j} style={{ marginBottom: 3 }}>{t}</li>)}</ul>
              </div>)}
        </div>
      </Modal>
    </>
  )
}
