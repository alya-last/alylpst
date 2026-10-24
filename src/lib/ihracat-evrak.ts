// İhracat evrakları (Proforma Invoice, Commercial Invoice, Packing List) için ortak tipler, etiketler ve hesaplar.
export type Tur = 'proforma' | 'commercial' | 'packing'
export type Dil = 'en' | 'tr'
export type Kalem = { aciklama: string; gtip: string; miktar: number; birim: string; fiyat: number; koli: number; net: number; brut: number; m3: number }
export type Veri = {
  belgeTarihi: string; referans: string; gecerlilik: string
  ihracatci: string; alici: string; bildirimTarafi: string
  incoterm: string; teslimYeri: string; odemeKosulu: string; paraBirimi: string
  mensei: string; yuklemeLimani: string; varisLimani: string; tasima: string; konteynerNo: string; isaretler: string
  navlun: number; sigorta: number; banka: string; notlar: string
  kalemler: Kalem[]
  palet: number; koliToplam: number; netToplam: number; brutToplam: number; m3Toplam: number   // kalem bazlı veri girilmediyse kullanılan elle toplamlar
}

export const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']
export const PARA = ['USD', 'EUR', 'GBP', 'TRY']
export const TUR_AD: Record<Tur, { tr: string; en: string; kisa: string }> = {
  proforma: { tr: 'Proforma Fatura', en: 'Proforma Invoice', kisa: 'PI' },
  commercial: { tr: 'Ticari Fatura', en: 'Commercial Invoice', kisa: 'CI' },
  packing: { tr: 'Çeki Listesi', en: 'Packing List', kisa: 'PL' },
}

export const bosKalem = (): Kalem => ({ aciklama: '', gtip: '', miktar: 1, birim: 'PCS', fiyat: 0, koli: 0, net: 0, brut: 0, m3: 0 })
export const bosVeri = (bugun: string): Veri => ({
  belgeTarihi: bugun, referans: '', gecerlilik: '', ihracatci: '', alici: '', bildirimTarafi: '',
  incoterm: 'EXW', teslimYeri: 'Istanbul, Türkiye', odemeKosulu: '', paraBirimi: 'USD',
  mensei: 'Türkiye', yuklemeLimani: '', varisLimani: '', tasima: '', konteynerNo: '', isaretler: '',
  navlun: 0, sigorta: 0, banka: '', notlar: '', kalemler: [bosKalem()],
  palet: 0, koliToplam: 0, netToplam: 0, brutToplam: 0, m3Toplam: 0,
})

const n = (x: any) => (Number.isFinite(+x) ? +x : 0)
export const yuvarla = (x: number, d = 2) => Math.round((x + Number.EPSILON) * 10 ** d) / 10 ** d
export const satirTutar = (k: Kalem) => yuvarla(n(k.miktar) * n(k.fiyat))

export function hesapla(v: Veri) {
  const altToplam = yuvarla(v.kalemler.reduce((t, k) => t + satirTutar(k), 0))
  const genel = yuvarla(altToplam + n(v.navlun) + n(v.sigorta))
  const kalemVar = v.kalemler.some(k => n(k.koli) || n(k.net) || n(k.brut) || n(k.m3))
  const topla = (f: (k: Kalem) => number, elle: number) => yuvarla(kalemVar ? v.kalemler.reduce((t, k) => t + f(k), 0) : n(elle), 3)
  return {
    altToplam, genel, miktar: yuvarla(v.kalemler.reduce((t, k) => t + n(k.miktar), 0), 3), kalemVar,
    koli: topla(k => n(k.koli), v.koliToplam), net: topla(k => n(k.net), v.netToplam), brut: topla(k => n(k.brut), v.brutToplam), m3: topla(k => n(k.m3), v.m3Toplam),
  }
}

/** Kaydedilmeden önce zorunlu alan / tutarlılık kontrolü. Boş liste = geçerli. */
export function dogrula(tur: Tur, v: Veri): string[] {
  const h: string[] = []
  if (!v.alici.trim()) h.push('Alıcı (consignee) bilgisi gerekli')
  if (!v.ihracatci.trim()) h.push('İhracatçı (exporter) bilgisi gerekli')
  if (!v.kalemler.some(k => k.aciklama.trim() && n(k.miktar) > 0)) h.push('En az bir dolu kalem gerekli')
  v.kalemler.forEach((k, i) => { if (k.aciklama.trim() && (n(k.miktar) <= 0 || n(k.fiyat) < 0)) h.push(`${i + 1}. kalemde miktar/fiyat geçersiz`) })
  if (tur !== 'packing') {
    if (v.kalemler.some(k => k.aciklama.trim() && n(k.fiyat) <= 0)) h.push('Fiyatı 0 olan kalem var (fiyatları döviz cinsinden girin)')
    if (!v.paraBirimi) h.push('Para birimi seçin')
  }
  if (tur === 'commercial') {
    if (v.kalemler.some(k => k.aciklama.trim() && !k.gtip.trim())) h.push('Ticari faturada her kalem için GTİP/HS kodu önerilir; eksik kalem var')
  }
  if (tur === 'packing') {
    const s = hesapla(v)
    if (s.brut > 0 && s.net > s.brut + 1e-9) h.push('Net ağırlık brüt ağırlıktan büyük olamaz')
  }
  return h
}

const L = {
  en: { firma: 'Exporter', alici: 'Consignee', bildirim: 'Notify Party', no: 'No', tarih: 'Date', ref: 'Order / PO Ref.', gecerlilik: 'Valid until', incoterm: 'Incoterms', odeme: 'Payment Terms', mensei: 'Country of Origin', yukleme: 'Port of Loading', varis: 'Port of Discharge', tasima: 'Transport', konteyner: 'Container No', isaret: 'Marks & Numbers', aciklama: 'Description of Goods', gtip: 'HS Code', miktar: 'Qty', birim: 'Unit', fiyat: 'Unit Price', tutar: 'Amount', alt: 'Subtotal', navlun: 'Freight', sigorta: 'Insurance', genel: 'TOTAL', koli: 'Cartons', net: 'Net Wt (kg)', brut: 'Gross Wt (kg)', m3: 'Volume (m³)', palet: 'Pallets', banka: 'Bank Details', not: 'Notes', imza: 'Authorized Signature', toplam: 'TOTAL', kalem: 'Item' },
  tr: { firma: 'İhracatçı', alici: 'Alıcı', bildirim: 'Bildirim Tarafı', no: 'No', tarih: 'Tarih', ref: 'Sipariş / PO No', gecerlilik: 'Geçerlilik', incoterm: 'Teslim Şekli (Incoterms)', odeme: 'Ödeme Koşulu', mensei: 'Menşei', yukleme: 'Yükleme Limanı', varis: 'Varış Limanı', tasima: 'Taşıma', konteyner: 'Konteyner No', isaret: 'İşaret ve Numaralar', aciklama: 'Mal Cinsi', gtip: 'GTİP', miktar: 'Miktar', birim: 'Birim', fiyat: 'Birim Fiyat', tutar: 'Tutar', alt: 'Ara Toplam', navlun: 'Navlun', sigorta: 'Sigorta', genel: 'GENEL TOPLAM', koli: 'Koli', net: 'Net Ağırlık (kg)', brut: 'Brüt Ağırlık (kg)', m3: 'Hacim (m³)', palet: 'Palet', banka: 'Banka Bilgileri', not: 'Notlar', imza: 'Yetkili İmza', toplam: 'TOPLAM', kalem: 'Kalem' },
}
export const etiket = (d: Dil) => L[d]
