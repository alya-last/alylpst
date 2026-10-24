'use client'
import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { Modal, Tabs } from '@/components/admin/erp/ui'

type Bolum = { v: string; l: string; icerik: (string | { b: string; t: string[] })[] }

// Muhasebeci için: panelin her muhasebe ekranının mantığı, işaret kuralları ve kayıtların birbirine etkisi.
const BOLUMLER: Bolum[] = [
  { v: 'genel', l: 'Genel mantık', icerik: [
    'Her kayıt üç yerden birine etki eder: CARİ bakiyesi, KASA/BANKA bakiyesi, ya da sadece GELİR-GİDER raporu. Hangisine etki ettiği aşağıdaki tabloda yazar.',
    { b: 'Cari bakiye işareti', t: [
      '+ (artı) = cari bize borçlu (alacağımız var). Müşteri satışı bakiyeyi artırır, tahsilat azaltır.',
      '− (eksi) = biz cariye borçluyuz. Tedarikçi alış faturası bakiyeyi eksiye çeker, ödeme eksiyi sıfıra yaklaştırır.',
    ] },
    { b: 'Hangi kayıt neye etki eder', t: [
      'Satış faturası (onaylı): cari +, ciro/KDV raporu, stok çıkışı.',
      'Alış faturası (onaylı): cari −, gider/KDV raporu, stok girişi.',
      'İade faturası (onaylı): cari − (satış iadesi bakiyeyi düşürür), stok girişi.',
      'Taslak fatura: hiçbir şeye etki etmez. Onaylanınca etki eder, iptal edilince geri alınır.',
      'Gelir kaydı + cari seçili: cari bakiyesi düşer (tahsilat). Kasa/banka seçiliyse hesap artar.',
      'Gider kaydı + cari seçili: cari bakiyesi artar (ödeme). Kasa/banka seçiliyse hesap azalır.',
      'Cari ve kasa seçilmemiş gelir/gider: sadece gelir-gider raporuna girer, bakiyeleri değiştirmez.',
      'Çek/Senet: portföye girerken bakiyeyi değiştirmez. Tahsil veya ödendi olarak işaretlendiğinde panel otomatik "Çek/Senet Tahsilatı" veya "Çek/Senet Ödemesi" gelir-gider kaydı açar. Cari ve kasa seçilirse bakiyeler o anda değişir. Ciro edilen çekte cari tahsilat ve ödeme birlikte kaydedilir.',
    ] },
    'Rapor dışı iç hareketler: Virman, Fatura Kapama, Bakiye Düzeltme, Açılış Bakiyesi, Kur Farkı. Bunlar kasa/banka bakiyesini değiştirir ama kâr-zarar raporlarına gelir/gider olarak girmez.',
  ] },
  { v: 'cari', l: 'Cari hesaplar', icerik: [
    'Cari kartındaki bakiye kutusu TL bakiyedir. Müşterinin USD veya EUR bakiyesi varsa ayrı kutuda gösterilir. Üzerine gelince güncel kurla TL karşılığı görünür.',
    'Müşteri ve tedarikçi aynı listede, tip alanıyla ayrılır. Muhasebe kodu (120.xx.xxx) eski programdaki hesap kodudur. Arama kutusu cari kodunu, muhasebe kodunu, adı, telefonu ve vergi no\'yu tanır.',
    { b: 'Ekstre', t: [
      'Ekstre yeni sistemdeki onaylı fatura ve işlemleri yürüyen bakiyeyle gösterir.',
      'Turuncu "Eski program" satırları eski programdan aktarılmış geçmiştir. Salt okunurdur, yürüyen bakiyeye ve güncel bakiyeye dahil değildir.',
      'Ekstre Yazdır ve CSV eski satırları da içerir. Yazdırmadaki "Güncel Bakiye" carinin gerçek bakiyesidir.',
    ] },
  ] },
  { v: 'eski', l: 'Eski programdan aktarım', icerik: [
    'Müşteri carileri eski programdan (CARİLER 120.xls) aktarıldı: 225 cari, muhasebe kodu 120.xx.xxx.',
    { b: 'Bakiyeler nasıl aktarıldı', t: [
      'Eski programda her cari için ayrı TL, USD ve EUR hesabı vardı ve TL tahsilatlar USD faturalarını kapatabiliyordu.',
      'Birden fazla gruplu 16 carinin bakiyesi tek TL tutarında netlendi. Sadece USD bakiyesi olanlar (ör. Ay Silikon) USD olarak kaldı.',
      'EUR bakiyelerinin EUR tutarı dosyada yoktu, sadece TL karşılığı vardı. Bu yüzden EUR gruplu üç cari TL olarak netlendi.',
      'Toplam TL bakiye 12.325.252,14 ₺, USD bakiye 8.358,75 $ olarak girildi. Dosyadaki 12.680.638,13 ₺ ile fark, USD-only carilerin eski tarihli kurla TL karşılığından gelir.',
    ] },
    { b: 'Geçmiş hareketler', t: [
      '1.163 satır cari ekstresinde "Eski program" etiketiyle görünür.',
      'Bu satırlar yeni faturalar tablosuna veya işlemlere kaydedilmedi. Sebep: gelir-gider kayıtlarında Ocak-Ağustos 2026 için aylık toplu satış geliri zaten var. Aynı satışları fatura ve tahsilat olarak da girmek ciroyu, KDV\'yi ve gelirleri iki kat gösterirdi.',
      'Eski programdaki alınan çeklerden vadesi gelmemiş 21 tanesi (9.406.499,24 ₺) Çek/Senet portföyüne alındı. Vadesi geçmiş 28 çek, durumu belli olmadığı için alınmadı.',
    ] },
  ] },
  { v: 'kasa', l: 'Kasa / Banka', icerik: [
    'Hesap bakiyesi = açılış bakiyesi hareketi + bu hesaba bağlı tüm gelir ve gider kayıtlarının toplamıdır. Bakiye elle değiştirilmez, düzeltme için "Bakiye Düzeltme" kullanılır. Bu işlem defterde iç hareket olarak görünür.',
    'Bir gelir/gider kaydında kasa veya banka hesabı seçilmemişse hesap bakiyesi değişmez. Bu yüzden Ocak-Ağustos 2026 toplu kayıtları hesap hareketlerinde görünmez. Bunlar sadece gelir-gider raporundadır.',
    'Hesabın para birimi USD veya EUR ise tutar o para biriminde tutulur ve TL karşılığı o günün kuruyla kaydedilir.',
    'Virman iki hesap arasındaki transferdir. Toplam kasa varlığını değiştirmez.',
  ] },
  { v: 'doviz', l: 'Döviz ve kur', icerik: [
    'Kurlar Kasa-Banka ekranındaki döviz kurları penceresinden elle girilir veya TCMB\'den çekilir. Desteklenen birimler: USD, EUR, RUB.',
    'Cari ekranındaki USD/EUR tutarların TL karşılığı güncel kurla hesaplanır. Bu bir tahmindir, muhasebe kaydı değildir. Kayıtlı TL değerleri işlem günündeki kurla saklanır.',
    'Dövizli faturayı kapatırken fatura kuru ile tahsilat kuru farklıysa panel farkı Kur Farkı Geliri veya Kur Farkı Gideri olarak ayrıca kaydeder. Bu kategoriler kâr-zarar raporlarına dahil edilmez.',
  ] },
  { v: 'kontrol', l: 'Kontrol listesi', icerik: [
    { b: 'Toplu düzenle', t: [
      'Cari, Fatura ve Gelir-Gider listelerinde satırları işaretleyin, "Toplu düzenle" ile aynı değeri hepsine atayın (ör. cari tipi, fiyat listesi, fatura vadesi, işlem kategorisi).',
      'Gelir-Gider listesinde "Hesaba / cariye ata" ile seçili işlemlere topluca kasa/banka hesabı veya cari atanır. Sistem eski hesaptan etkiyi geri alıp yenisine işler (gelir hesabı artırır, gider azaltır; cari bakiyesi de aynı kuralla). Yalnızca TL hesaplar seçilebilir.',
      'Tutar ve fatura durumu gibi alanlar toplu düzenlemede yoktur; bunlar tek tek kayıttan değiştirilir.',
    ] },
    { b: 'Ay sonunda kontrol edilecekler', t: [
      'Kasa/banka bakiyelerini gerçek banka ekstresiyle karşılaştırın, fark varsa Bakiye Düzeltme ile kaydedin ve not düşün.',
      'Cari bakiyesi ile ekstrenin son yürüyen bakiyesi, eski program geçmişi hariç, yeni dönem hareketleri için tutmalıdır.',
      'Taslakta kalan faturalar bakiyeyi etkilemez. Onaylanmamış fatura kalmadığından emin olun.',
      'Portföydeki çeklerin vadesi geçenleri tahsil, ciro veya karşılıksız olarak güncelleyin. Tahsil işlemi gelir kaydını otomatik açar.',
      'Cari ve kasa seçilmemiş gelir/gider kayıtları bakiyeyi değiştirmez. Gerçek bir tahsilat veya ödeme ise cari ve kasa seçerek girin.',
    ] },
  ] },
]

export default function MuhasebeRehberi() {
  const [acik, setAcik] = useState(false)
  const [tab, setTab] = useState('genel')
  const b = BOLUMLER.find(x => x.v === tab) || BOLUMLER[0]
  return (
    <>
      <button className="adm-btn-ghost" onClick={() => setAcik(true)} title="Muhasebe kayıtlarının birbirine etkisi, işaret kuralları, eski program aktarımı" style={{ marginRight: 8 }}>
        <HelpCircle size={14} />Muhasebe Rehberi
      </button>
      <Modal open={acik} onClose={() => setAcik(false)} title="Muhasebe Rehberi" width={760}>
        <Tabs value={tab} onChange={setTab} tabs={BOLUMLER.map(x => ({ v: x.v, l: x.l }))} />
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
