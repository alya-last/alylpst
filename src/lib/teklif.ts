// Fiyat teklifi ortak tipler ve hesaplar. Sunucudaki rpc_teklif_kaydet ile AYNI yuvarlama kuralı: her satır 2 ondalığa yuvarlanır.
// kod/koli_*: fiyat listesinden seçilen kalemin ürün kodu ve koli bilgisi (teklife kopyalanır; sonradan liste değişse de teklif değişmez)
export type TKalem = { variant_id: string; urun_adi: string; aciklama: string; miktar: number; birim: string; birim_fiyat: number; iskonto_yuzde: number; kod?: string; koli_ici_adet?: number | null; koli_m3?: number | null; koli_kg?: number | null }
export type Dil = 'tr' | 'en'
export const PARA = ['TRY', 'USD', 'EUR', 'GBP', 'RUB']
/** Fiyat listesi (proforma) satırı: fiyat USD'dir. */
export type ListeUrun = { id: string; kod: string; ad_tr: string; ad_en: string | null; koli_ici_adet: number | null; konteyner_40hc: number | null; olcu: string | null; koli_m3: number | null; koli_kg: number | null; usd_fiyat: number; tl_fiyat?: number | null; aktif: boolean }
export const listeEtiket = (u: ListeUrun, dil: Dil) => `${u.kod} · ${dil === 'en' && u.ad_en ? u.ad_en : u.ad_tr}`
/** Liste fiyatı teklifin para birimine çevrilir: USD → aynen, TRY → USD × kur, diğerleri → otomatik fiyat yok (null). */
/** TL teklifte ürünün elle girilmiş TL liste fiyatı (tl) varsa o kullanılır, yoksa USD × kur. */
export function listeFiyatiPara(usd: number, para: string, kur: number, tl?: number | null): number | null {
  if (para === 'USD') return yuvarla(+usd, 4)
  if (para === 'TRY' && tl != null && +tl > 0) return yuvarla(+tl, 2)
  if (para === 'TRY' && +kur > 0) return yuvarla(+usd * +kur, 2)
  return null
}
/** İskonto: müşteriye özel % ile miktar kademesinden YÜKSEK olanı uygulanır (üst üste binmez). */
export function iskontoBul(cariYuzde: number, kademeler: { min_miktar: number | string; iskonto_yuzdesi: number | string; aktif?: boolean }[], miktar: number): number {
  const kademe = Math.max(0, ...kademeler.filter(k => k.aktif !== false && +k.min_miktar <= miktar).map(k => +k.iskonto_yuzdesi))
  return Math.min(100, Math.max(+cariYuzde || 0, kademe))
}
/** Kalem listeden geldiyse koli/m³/kg toplamı (koli adedi yukarı yuvarlanır). */
export function koliOzet(kalemler: TKalem[]) {
  let koli = 0, m3 = 0, kg = 0, eksik = 0
  for (const k of kalemler) {
    if (!k.urun_adi.trim()) continue
    if (!k.koli_ici_adet || !(+k.miktar > 0)) { eksik++; continue }
    const n = Math.ceil(+k.miktar / k.koli_ici_adet)
    koli += n; m3 += n * (+k.koli_m3 || 0); kg += n * (+k.koli_kg || 0)
  }
  return { koli, m3: yuvarla(m3, 3), kg: yuvarla(kg, 1), eksik }
}
export const DURUM: Record<string, { l: string; tone: 'muted' | 'blue' | 'green' | 'red' | 'amber' }> = {
  taslak: { l: 'Taslak', tone: 'muted' }, gonderildi: { l: 'Gönderildi', tone: 'blue' }, kabul: { l: 'Kabul edildi', tone: 'green' }, red: { l: 'Reddedildi', tone: 'red' }, iptal: { l: 'İptal', tone: 'muted' },
}
export const bosKalem = (): TKalem => ({ variant_id: '', urun_adi: '', aciklama: '', miktar: 1, birim: 'adet', birim_fiyat: 0, iskonto_yuzde: 0 })
export const yuvarla = (x: number, d = 2) => Math.round((x + Number.EPSILON) * 10 ** d) / 10 ** d
export const satirNet = (k: TKalem) => yuvarla((+k.miktar || 0) * (+k.birim_fiyat || 0) * (1 - (+k.iskonto_yuzde || 0) / 100))
export function teklifHesapla(kalemler: TKalem[], kdvOrani: number) {
  const ara = yuvarla(kalemler.reduce((t, k) => t + satirNet(k), 0)), kdv = yuvarla(ara * (+kdvOrani || 0) / 100)
  return { ara, kdv, toplam: yuvarla(ara + kdv) }
}
export const gunEkle = (t: string, n: number) => new Date(Date.parse(t + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
export const bugunTR = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)

/** Gönderilmiş teklifin geçerlilik durumu (kayıt durumu değişmez, yalnızca gösterim). */
export function gecerlilikDurumu(t: { durum: string; gecerlilik: string | null }, bugun = bugunTR()): 'doldu' | 'yakinda' | null {
  if (t.durum !== 'gonderildi' || !t.gecerlilik) return null
  if (t.gecerlilik < bugun) return 'doldu'
  return t.gecerlilik <= gunEkle(bugun, 3) ? 'yakinda' : null
}

export function dogrula(f: { musteri_adi: string; kalemler: TKalem[]; para_birimi: string; gecerlilik: string; tarih: string }): string[] {
  const h: string[] = []
  if (!f.musteri_adi.trim()) h.push('Müşteri adı gerekli')
  const dolu = f.kalemler.filter(k => k.urun_adi.trim())
  if (!dolu.length) h.push('En az bir kalem gerekli')
  dolu.forEach((k, i) => {
    if (!(+k.miktar > 0)) h.push(`${i + 1}. kalemde miktar 0'dan büyük olmalı`)
    if (!(+k.birim_fiyat >= 0)) h.push(`${i + 1}. kalemde fiyat geçersiz`)
    if (+k.iskonto_yuzde < 0 || +k.iskonto_yuzde > 100) h.push(`${i + 1}. kalemde iskonto 0–100 arasında olmalı`)
  })
  if (dolu.some(k => +k.birim_fiyat === 0)) h.push('Fiyatı 0 olan kalem var')
  if (f.gecerlilik && f.gecerlilik < f.tarih) h.push('Geçerlilik tarihi teklif tarihinden önce olamaz')
  return h
}

const L = {
  tr: { baslik: 'FİYAT TEKLİFİ', no: 'Teklif No', tarih: 'Tarih', gecerlilik: 'Geçerlilik', sayin: 'Sayın', urun: 'Ürün / Hizmet', miktar: 'Miktar', birim: 'Birim', fiyat: 'Birim Fiyat', isk: 'İskonto', tutar: 'Tutar', ara: 'Ara Toplam', kdv: 'KDV', toplam: 'GENEL TOPLAM', kosul: 'Koşullar', imza: 'Yetkili İmza', gecer: 'Bu teklif belirtilen tarihe kadar geçerlidir.', koliIci: 'adet/koli', koli: 'Toplam koli', hacim: 'Toplam hacim', agirlik: 'Toplam ağırlık' },
  en: { baslik: 'QUOTATION', no: 'Quotation No', tarih: 'Date', gecerlilik: 'Valid until', sayin: 'To', urun: 'Description', miktar: 'Qty', birim: 'Unit', fiyat: 'Unit Price', isk: 'Disc.', tutar: 'Amount', ara: 'Subtotal', kdv: 'VAT', toplam: 'TOTAL', kosul: 'Terms', imza: 'Authorized Signature', gecer: 'This quotation is valid until the date stated above.', koliIci: 'pcs/box', koli: 'Total boxes', hacim: 'Total volume', agirlik: 'Total weight' },
}
export const etiket = (d: Dil) => L[d]

const paraStr = (n: number, pb: string) => `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)} ${pb}`
/** E-posta gövdesi olarak kopyalanabilir düz metin. */
export function epostaMetni(t: { no: string; musteri_adi: string; para_birimi: string; kdv_orani: number; gecerlilik: string | null; kosullar: string | null; dil: Dil }, kalemler: TKalem[], firma: string): string {
  const s = teklifHesapla(kalemler, t.kdv_orani), tr = t.dil === 'tr'
  const tarih = (d: string) => d.split('-').reverse().join('.')
  const satirlar = kalemler.filter(k => k.urun_adi.trim()).map(k => `- ${k.urun_adi}: ${k.miktar} ${k.birim} × ${paraStr(k.birim_fiyat, t.para_birimi)}${k.iskonto_yuzde ? ` (${tr ? 'iskonto' : 'discount'} %${k.iskonto_yuzde})` : ''} = ${paraStr(satirNet(k), t.para_birimi)}`)
  return tr
    ? `Sayın ${t.musteri_adi},\n\nTalebiniz doğrultusunda hazırladığımız ${t.no} numaralı fiyat teklifimiz aşağıdadır (PDF ektedir):\n\n${satirlar.join('\n')}\n\nAra toplam: ${paraStr(s.ara, t.para_birimi)}\nKDV (%${t.kdv_orani}): ${paraStr(s.kdv, t.para_birimi)}\nGenel toplam: ${paraStr(s.toplam, t.para_birimi)}\n${t.gecerlilik ? `\nTeklifimiz ${tarih(t.gecerlilik)} tarihine kadar geçerlidir.\n` : ''}${t.kosullar ? `\nKoşullar:\n${t.kosullar}\n` : ''}\nSorularınız için bize ulaşabilirsiniz.\n\nSaygılarımızla,\n${firma}`
    : `Dear ${t.musteri_adi},\n\nPlease find our quotation ${t.no} below (PDF attached):\n\n${satirlar.join('\n')}\n\nSubtotal: ${paraStr(s.ara, t.para_birimi)}\nVAT (${t.kdv_orani}%): ${paraStr(s.kdv, t.para_birimi)}\nTotal: ${paraStr(s.toplam, t.para_birimi)}\n${t.gecerlilik ? `\nThis quotation is valid until ${tarih(t.gecerlilik)}.\n` : ''}${t.kosullar ? `\nTerms:\n${t.kosullar}\n` : ''}\nPlease do not hesitate to contact us.\n\nBest regards,\n${firma}`
}
