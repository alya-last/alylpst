// Tedarikçi faturası ↔ satınalma siparişi karşılaştırması. Saf ve deterministik: AI yalnızca faturayı okur, eşleştirme kararı kurallıdır.
export type FKalem = { urun_adi: string; miktar: number; birim_fiyat: number; kdv_orani: number }
export type SKalem = { ad: string; miktar: number; teslim: number; birim_fiyat: number }
export type OtoFatura = { id: string; no: string; durum: string; toplam: number; ara_toplam: number; kdv_orani: number }
export type Aday = { id: string; no: string; tarih: string; durum: string; kalemler: SKalem[]; teslimTarihi?: string | null; otoFatura?: OtoFatura | null; bagliFaturalar?: { no: string; durum: string }[] }
export type KalemSonuc = { fatura: FKalem; siparis: SKalem | null; ad: number; uyarilar: string[] }
export type Sonuc = {
  aday: Aday; puan: number; siparisTutar: number; teslimTutar: number; karsilastirilan: number; fark: number; farkYuzde: number | null
  seviye: 'uyumlu' | 'kucuk' | 'buyuk'; kalemler: KalemSonuc[]; eksik: SKalem[]; uyarilar: string[]
}

const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' }
export const norm = (s: string) => (s || '').toLocaleLowerCase('tr-TR').replace(/[çğıöşüâîû]/g, c => TR[c]).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
/** İki ürün adının benzerliği (0-1): ortak anlamlı kelimeler / küçük kümenin boyutu. */
export function adSkoru(a: string, b: string) {
  const ta = new Set(norm(a).split(' ').filter(t => t.length >= 3)), tb = new Set(norm(b).split(' ').filter(t => t.length >= 3))
  if (!ta.size || !tb.size) return 0
  let ort = 0; ta.forEach(t => { if (tb.has(t)) ort++ })
  return ort / Math.min(ta.size, tb.size)
}
const gun = (t: string) => Date.parse(t.slice(0, 10) + 'T00:00:00Z') / 86400000
const yuzde = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null)
const para = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)

export function karsilastir(f: { araToplam: number; tarih: string; kalemler: FKalem[]; paraBirimi?: string }, a: Aday): Sonuc {
  const siparisTutar = a.kalemler.reduce((t, k) => t + k.miktar * k.birim_fiyat, 0)
  const teslimTutar = a.kalemler.reduce((t, k) => t + k.teslim * k.birim_fiyat, 0)
  const karsilastirilan = teslimTutar > 0 ? teslimTutar : siparisTutar     // fatura teslim alınan mala karşılık gelmelidir
  const fark = f.araToplam - karsilastirilan, farkYuzde = yuzde(f.araToplam, karsilastirilan)
  const mutlak = farkYuzde == null ? 100 : Math.abs(farkYuzde)
  const seviye: Sonuc['seviye'] = mutlak <= 1 ? 'uyumlu' : mutlak <= 5 ? 'kucuk' : 'buyuk'
  const uyarilar: string[] = []

  const kalemler: KalemSonuc[] = f.kalemler.map(fk => {
    let en: SKalem | null = null, enSkor = 0
    a.kalemler.forEach(sk => { const s = adSkoru(fk.urun_adi, sk.ad); if (s > enSkor) { enSkor = s; en = sk } })
    const u: string[] = []
    if (!en || enSkor < 0.34) { u.push('Siparişte bu kaleme benzer bir hammadde yok'); return { fatura: fk, siparis: null, ad: enSkor, uyarilar: u } }
    const sk = en as SKalem
    if (fk.miktar > sk.teslim + 1e-9) u.push(`Faturadaki miktar (${fk.miktar}) teslim alınandan (${sk.teslim}) fazla — teslim alınmamış mal için ödeme yapılmasın`)
    else if (fk.miktar < sk.teslim - 1e-9) u.push(`Faturadaki miktar (${fk.miktar}) teslim alınandan (${sk.teslim}) az — kalan için ayrı fatura beklenir`)
    const fy = yuzde(fk.birim_fiyat, sk.birim_fiyat)
    if (fy != null && Math.abs(fy) > 2) u.push(`Birim fiyat siparişten %${Math.abs(fy).toFixed(1)} ${fy > 0 ? 'yüksek' : 'düşük'} (${para(fk.birim_fiyat)} / sipariş ${para(sk.birim_fiyat)})`)
    return { fatura: fk, siparis: sk, ad: enSkor, uyarilar: u }
  })
  const eslesenler = new Set(kalemler.map(k => k.siparis).filter(Boolean))
  const eksik = a.kalemler.filter(sk => sk.teslim > 0 && !eslesenler.has(sk))

  if (f.paraBirimi && f.paraBirimi !== 'TRY') uyarilar.push('Fatura döviz cinsinden; tutar kurla TL’ye çevrilerek karşılaştırıldı')
  if (seviye === 'buyuk') uyarilar.push(`Fatura tutarı (KDV hariç) ${para(f.araToplam)}; siparişin karşılaştırılan tutarı ${para(karsilastirilan)} (fark ${fark > 0 ? '+' : ''}${para(fark)})`)
  if (teslimTutar === 0) uyarilar.push('Bu siparişte henüz teslim alınan mal yok; fatura sipariş tutarıyla karşılaştırıldı')
  if (eksik.length) uyarilar.push(`Teslim alınan ama faturada görünmeyen kalem: ${eksik.map(k => k.ad).join(', ')}`)
  const oto = a.otoFatura
  if (oto && ['onaylandi', 'odendi'].includes(oto.durum)) uyarilar.push(`Bu sipariş için sistemin teslim sırasında oluşturduğu ${oto.no} faturası (${para(oto.toplam)}) zaten onaylı ve cari borca işlenmiş. Gerçek faturayı da onaylarsanız aynı alış İKİ KEZ yazılır.`)
  if (a.bagliFaturalar?.some(b => b.durum !== 'iptal')) uyarilar.push(`Bu siparişe bağlı başka fatura var: ${a.bagliFaturalar!.filter(b => b.durum !== 'iptal').map(b => b.no).join(', ')}`)

  // Puan (0-100): tutar 60, tarih 20, kalem adı 20
  const tutarP = seviye === 'uyumlu' ? 60 : seviye === 'kucuk' ? 35 : mutlak <= 15 ? 15 : 0
  const ref = a.teslimTarihi || a.tarih, dg = Math.abs(gun(f.tarih) - gun(ref))
  const tarihP = dg <= 30 ? 20 : dg <= 90 ? 10 : 0
  const adP = kalemler.length ? (kalemler.filter(k => k.siparis).length / kalemler.length) * 20 : 0
  return { aday: a, puan: Math.round(tutarP + tarihP + adP), siparisTutar, teslimTutar, karsilastirilan, fark, farkYuzde, seviye, kalemler, eksik, uyarilar }
}

/** Adayları puana göre sıralar; işlem görmemiş (iptal) siparişler dışarıda bırakılır. */
export function eslestir(f: Parameters<typeof karsilastir>[0], adaylar: Aday[]) {
  return adaylar.filter(a => a.durum !== 'iptal').map(a => karsilastir(f, a)).sort((x, y) => y.puan - x.puan)
}
