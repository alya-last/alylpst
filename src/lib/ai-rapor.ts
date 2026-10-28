// Detaylı sabit raporlar: sık sorulan satış / stok / tahsilat / ihracat sorularını yapay zekanın serbest yorumuna bırakmadan,
// doğrudan kayıtlardan çok sayfalı Excel + kısa özet olarak üretir. Aynı soru her seferinde aynı rakamı verir; tek satırlık cevap verilmez.
// Saf fonksiyonlar (raporNiyeti, kodEslesir) scripts/ai-test.mts ile test edilebilir.
import type { SupabaseClient } from '@supabase/supabase-js'
import { excelKaydet, type Sayfa } from '@/lib/ai-excel'
import { araciCalistir, hamCalistir, bugunISO } from '@/lib/ai-admin'

type Mekan = 'ic' | 'dis' | 'hepsi'
export type RaporNiyet =
  | { tur: 'tahsilat'; mekan: Mekan }
  | { tur: 'stok'; mekan: Mekan }
  | { tur: 'satis'; mekan: Mekan }
  | { tur: 'urun'; kodlar: string[] }
  | { tur: 'hammadde'; mekan: Mekan }
  | { tur: 'ihr_tahsilat' }
  | { tur: 'ihr_rakam'; yil: number }
  | { tur: 'pos' }
  | { tur: 'kdv'; yil: number; ay: number }
  | { tur: 'odeme' }
  | { tur: 'ekstre'; arama: string; kod: string }
  | { tur: 'fiyat'; kod: string; arama: string }
type Hucre = string | number | null
type Sonuc = { yanit: string; araclar: string[] }

const nrm = (v: unknown) => String(v ?? '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[?!.,;:()"']/g, ' ').replace(/\s+/g, ' ').trim()
const r2 = (n: number) => Math.round(n * 100) / 100
const TL = (n: number) => r2(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const AD = (n: number) => Math.round(n).toLocaleString('tr-TR')
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const mekanAd = (m: string) => (m === 'dis' || m === 'dış mekan' ? 'Dış mekan' : m === 'ic' || m === 'iç mekan' ? 'İç mekan' : m || '')

/** "ayl-101", "aly-132", "ALYG-01" gibi kodları (yazım hatalarıyla) ALY-101 / ALYG-01 biçimine getirir. */
export function kodlariBul(soru: string): string[] {
  const t = nrm(soru), out: string[] = []
  for (const m of t.matchAll(/(?<![a-z])(a[yl]{2,3}g?)\s*-?\s*(\d{1,4}(?:\/\d{1,2})?[a-z]{0,2})(?![a-z0-9])/g)) {
    const kod = `${m[1].endsWith('g') ? 'ALYG' : 'ALY'}-${m[2].toUpperCase()}`
    if (!out.includes(kod)) out.push(kod)
  }
  return out.slice(0, 8)
}
/** Satış dosyasındaki kod, istenen koda uyar mı? (ALYG-01 → ALYG-01A/B/BJ/G/K renk ekleri dahil; ALY-132 ≠ ALY-1320) */
export const kodEslesir = (kod: string, ist: string) => { const k = String(kod || '').toUpperCase().trim(); return k === ist || (k.startsWith(ist) && /^[A-Z]{1,3}$/.test(k.slice(ist.length))) }
const anaKod = (kod: string) => String(kod || '').toUpperCase().trim().replace(/^((?:ALYG|ALY)-\d+)[A-Z]{1,3}$/, '$1')
const RENK_SON = /\s+(ANTRASİT|ANTARASİT|ANTASİT|ANTRASIT|BEYAZ|BEJ|GRİ|GRI|KAPİÇİNO|KAPUÇİNO|KAPUCİNO|KAPICINO|SİYAH|SIYAH|KREM|YEŞİL|MAVİ|KIRMIZI|TURUNCU|SARI|MOR|PEMBE|KAHVE|KAHVERENGİ)$/i
const renksiz = (ad: string) => String(ad || '').replace(/\s+/g, ' ').trim().replace(RENK_SON, '')
const renkAdi = (ad: string) => { const m = RENK_SON.exec(String(ad || '').trim()); return m ? m[1].toLocaleUpperCase('tr') : '' }

/** Soru bu sabit raporlardan birine uyuyor mu? Emin değilse null (yapay zekaya bırakılır). */
export function raporNiyeti(soru: string): RaporNiyet | null {
  const t = nrm(soru)
  if (!t || t.split(' ').length > 40) return null
  if (/neden|niye|yorum|karsilastir|tahmin|oner|kar zarar|maliyet|senaryo|kur farki/.test(t)) return null
  const dis = /\bdis ?mekan/.test(t), ic = /\bic ?mekan/.test(t)
  const mekan: Mekan = dis && !ic ? 'dis' : ic && !dis ? 'ic' : 'hepsi'
  const mekanVar = dis || ic
  if (/ihracat/.test(t)) {
    if (/tahsil|alacak|bakiye|borc|odeme/.test(t)) return { tur: 'ihr_tahsilat' }
    if (/rakam|ne kadar|usd|dolar|euro|\btl\b|satis|ciro|toplam|donem|kac/.test(t)) return { tur: 'ihr_rakam', yil: +(/\b(20\d\d)\b/.exec(t)?.[1] || 0) || +bugunISO().slice(0, 4) }
    return null
  }
  if (/tedarikci|satici|borclarimiz|odeyecegimiz|odenecek(ler)?\b|ne kadar borcumuz|borcumuz (var|ne)/.test(t) && /borc|odeme|odenecek|liste|bakiye|ekstre/.test(t) && !/kdv|fatura|cek|senet|maas|personel/.test(t)) return { tur: 'odeme' }
  if (/ekstre|hesap (dokum|hareket|ozet)|hareketleri|carisi|cari hesabi|\bcari\b.{0,12}\b(excel|dokum|detay|hareket)|\b(excel|dokum)\b.{0,12}\bcari\b/.test(t) && !/banka|kasa|\bk ?karti|kredi kart|\bpos\b|tahsilat|stok|kdv/.test(t)) {
    const kod = /\b(120|320)\.\d{2}\.\d{3}[a-z]?\b/.exec(String(soru))?.[0] || ''
    const arama = t.replace(/\b(120|320) \d{2} \d{3}[a-z]?\b/g, ' ').replace(/\b(ekstre(si)?|ekstreyi|cari(si|nin|yi)?|hesap(i|in)?|dokumu|dokum|hareket(leri|lerini)?|ozet(i)?|excel|ver|al|cikar|goster|lazim|listesi|liste|detayli|detay|tum|icin|ile|ve|bir|bana|olarak|dis mekan|ic mekan|tl|nin|nın)\b/g, ' ').replace(/\s+/g, ' ').trim()
    if (kod || arama.length >= 2) return { tur: 'ekstre', arama, kod }
  }
  if (/(alis|satis|gelen|giden)? ?fatura(lar)?.{0,15}(liste|excel|dokum)|fatura listesi|(alis|satis) fatura/.test(t) && !/stok|kalem/.test(t)) {
    const AY0 = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'], i0 = AY0.findIndex(a => t.includes(a)), b0 = bugunISO()
    return { tur: 'kdv', yil: +(/\b(20\d\d)\b/.exec(t)?.[1] || 0) || +b0.slice(0, 4), ay: i0 >= 0 ? i0 + 1 : +b0.slice(5, 7) }
  }
  if (/yuklen|indirilecek kdv|kdv (listesi|detay|dokum|raporu)|kdv.{0,12}liste|liste.{0,12}kdv/.test(t) && !/hesaplanan kdv (orani|nedir)/.test(t)) {
    const AY = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik']
    const ayI = AY.findIndex(a => t.includes(a))
    const bg = bugunISO()
    return { tur: 'kdv', yil: +(/\b(20\d\d)\b/.exec(t)?.[1] || 0) || +bg.slice(0, 4), ay: ayI >= 0 ? ayI + 1 : +bg.slice(5, 7) }
  }
  if (/\bk ?karti|kredi kart|\bpos\b/.test(t) && /tahsilat|liste|yat|bekle|ne kadar|rakam|excel/.test(t)) return { tur: 'pos' }
  const kodlar0 = kodlariBul(soru)
  if (kodlar0.length === 1 && /fiyat|kactan|kaca |kac tl|birim f|brim f|\bbirim\b|\bbrim\b/.test(t) && !/stok|recete|maliyet|alis fiyat/.test(t)) {
    const arama = t.split(' ').filter(w => w.length >= 3 && !/^a[yl]{2,3}g?-?\d/.test(w) && !/^\d+[a-z]{0,2}$/.test(w) && !/^(aly|alyg|aylg|saksi|saksisi|brim|birim|fiyati|fiyat|fiyatlari|kactan|kaca|kac|satmisim|satmisiz|satmistik|sattim|sattik|satildi|satis|firma|firmasina|firmasi|firmaya|firmanin|musteri|musteriye|musterisine|musterinin|cari|carisine|ne|kadar|ver|excel|liste|listesi|icin|ile|ve|bir|bana|olarak|tl|kdv|hangi|son|ilk|nekadar|bakalim|diyecek|soyle|goster|nin|nun)$/.test(w)).join(' ')
    return { tur: 'fiyat', kod: kodlar0[0], arama }
  }
  const kodlar = kodlariBul(soru)
  if (kodlar.length && /sat|adet|ne kadar|rakam|kac|ciro/.test(t) && !/stok|recete|maliyet/.test(t)) return { tur: 'urun', kodlar }
  if (/hammadde/.test(t)) return /stok|stog|depo|kalan/.test(t) ? null : { tur: 'hammadde', mekan }
  if (/tahsilat|alacak listesi|alacaklar[iı]m|bakiyesi olan|kimden ne tahsil/.test(t) && !/\bcek\b|\bsenet\b/.test(t)) return { tur: 'tahsilat', mekan }
  if (/\b(stok|stoku|stogu|depo)\b/.test(t) && mekanVar && !/hammadde|boya|koli|ambalaj|kritik|minimum/.test(t)) return { tur: 'stok', mekan }
  if (/sat(mis|tim|ti|is|ilan|tik)|satis|ciro/.test(t) && mekanVar) return { tur: 'satis', mekan }
  return null
}

async function sayfala(sb: SupabaseClient, tablo: string, kolon: string, f?: (q: any) => any): Promise<any[]> {
  const out: any[] = []
  for (let bas = 0; bas < 30000; bas += 1000) {
    let q: any = sb.from(tablo).select(kolon).order('id').range(bas, bas + 999)
    if (f) q = f(q)
    const r = await q
    if (r.error) throw new Error(r.error.message)
    out.push(...(r.data || []))
    if ((r.data || []).length < 1000) break
  }
  return out
}
const json = (s: string) => { let j: any; try { j = JSON.parse(s) } catch { throw new Error('Araç çıktısı okunamadı') } if (typeof j === 'string' || j?.hata) throw new Error(typeof j === 'string' ? j : String(j.hata)); return j }
const topSat = (sat: Hucre[][], idx: number[], etiket: [number, string]): Hucre[] => { const r: Hucre[] = sat[0].map(() => ''); r[etiket[0]] = etiket[1]; for (const i of idx) r[i] = r2(sat.reduce((t, x) => t + (+(x[i] as number) || 0), 0)); return r }

async function bitir(sb: SupabaseClient, baslik: string, sayfalar: Sayfa[], govde: string[], araclar: string[]): Promise<Sonuc> {
  const k = await excelKaydet(sb, baslik, sayfalar)
  return { yanit: [...govde, '', `Tüm detaylar Excel'de (${k.sayfalar.map(s => `${s.ad}: ${s.satir} satır`).join(' · ')}):`, k.yol].join('\n'), araclar }
}

/* ─────────────── Tahsilat listesi (iç / dış mekan ayrı) ─────────────── */
async function tahsilat(sb: SupabaseClient, mekan: Mekan): Promise<Sonuc> {
  const j = json(await hamCalistir(() => araciCalistir(sb, 'cari_mekan_ekstre', { mekan, sadece_bakiyeli: true })))
  const cariler: any[] = j.cariler || []
  const sayfalar: Sayfa[] = [], govde: string[] = [], ozet: Hucre[][] = []
  for (const m of (mekan === 'hepsi' ? ['dış mekan', 'iç mekan'] : [mekan === 'dis' ? 'dış mekan' : 'iç mekan'])) {
    const u = cariler.filter(x => x.mekan === m)
    const al = u.filter(x => x.tl_bakiye > 0.5).sort((a, b) => b.tl_bakiye - a.tl_bakiye)
    const toplam = al.reduce((t, x) => t + x.tl_bakiye, 0)
    let kum = 0
    const sat: Hucre[][] = al.map(x => [x.cari_kodu, x.unvan, r2(x.tl_bakiye), r2(+x.tl_borc || 0), r2(+x.tl_alacak || 0), x.tl_bakiye > 0 ? r2(x.tl_bakiye) : 0, x.tl_bakiye < 0 ? r2(-x.tl_bakiye) : 0])
    if (sat.length) sat.push(topSat(sat, [2, 3, 4, 5, 6], [1, 'TOPLAM']))
    sayfalar.push({ ad: `Tahsilat ${mekanAd(m)}`, sutunlar: ['Cari kodu', 'Unvan', 'Tahsil edilecek TL', 'Borç', 'Alacak', 'Borç bakiye', 'Alacak bakiye'], satirlar: sat, sari: 3 })
    const analiz: Hucre[][] = al.map((x, i) => { kum += x.tl_bakiye; return [i + 1, x.cari_kodu, x.unvan, r2(x.tl_bakiye), toplam ? r2(x.tl_bakiye / toplam * 100) : 0, toplam ? r2(kum / toplam * 100) : 0, x.usd_bakiye || null, x.eur_bakiye || null] })
    if (analiz.length) { const tr = topSat(analiz, [3], [2, 'TOPLAM']); tr[0] = ''; analiz.push(tr) }
    if (analiz.length) sayfalar.push({ ad: `Analiz ${mekanAd(m)}`, sutunlar: ['Sıra', 'Cari kodu', 'Unvan', 'Tahsil edilecek TL', 'Pay %', 'Kümülatif %', 'USD bakiye', 'EUR bakiye'], satirlar: analiz })
    const dv = u.filter(x => x.usd_bakiye > 0.5 || x.eur_bakiye > 0.5)
    if (dv.length) sayfalar.push({ ad: `Döviz alacak ${mekanAd(m)}`, sutunlar: ['Cari Kodu', 'Ünvan', 'USD Bakiye', 'EUR Bakiye'], satirlar: dv.map(x => [x.cari_kodu, x.unvan, x.usd_bakiye, x.eur_bakiye]) })
    const bz = u.filter(x => x.tl_bakiye < -0.5).sort((a, b) => a.tl_bakiye - b.tl_bakiye)
    if (bz.length) sayfalar.push({ ad: `Biz borçluyuz ${mekanAd(m)}`, sutunlar: ['Cari Kodu', 'Ünvan', 'Şirketin Borcu (TL)'], satirlar: bz.map(x => [x.cari_kodu, x.unvan, r2(-x.tl_bakiye)]) })
    const ilk5 = al.slice(0, 5).reduce((t, x) => t + x.tl_bakiye, 0)
    ozet.push([mekanAd(m), al.length, r2(toplam), al.length ? r2(toplam / al.length) : 0, al[0] ? al[0].unvan : '', al[0] ? al[0].tl_bakiye : 0, toplam ? r2(ilk5 / toplam * 100) : 0, r2(bz.reduce((t, x) => t - x.tl_bakiye, 0)), dv.reduce((t, x) => t + Math.max(0, x.usd_bakiye || 0), 0) || null, dv.reduce((t, x) => t + Math.max(0, x.eur_bakiye || 0), 0) || null])
    govde.push(`${mekanAd(m).toUpperCase()} TAHSİLAT LİSTESİ — ${al.length} müşteri, toplam ${TL(toplam)} TL`)
    al.slice(0, 12).forEach((x, i) => govde.push(`${i + 1}. ${x.unvan} — ${TL(x.tl_bakiye)} TL`))
    if (al.length > 12) govde.push(`… ve ${al.length - 12} müşteri daha (tamamı Excel'de)`)
    if (dv.length) govde.push(`Döviz alacağı olanlar: ${dv.map(x => `${x.unvan} ${x.usd_bakiye > 0.5 ? TL(x.usd_bakiye) + ' USD' : ''}${x.eur_bakiye > 0.5 ? TL(x.eur_bakiye) + ' EUR' : ''}`).join('; ')}`)
    govde.push('')
  }
  sayfalar.unshift({ ad: 'Özet', sutunlar: ['Mekan', 'Borçlu Müşteri Sayısı', 'Toplam Tahsil Edilecek (TL)', 'Ortalama (TL)', 'En Büyük Borçlu', 'En Büyük Tutar (TL)', 'İlk 5\'in Payı %', 'Şirketin Borcu Olanların Toplamı (TL)', 'USD Alacak', 'EUR Alacak'], satirlar: ozet })
  govde.push('Not: İç mekan (120.01/02) ve dış mekan (120.03) ayrı listelenir, karıştırılmaz. Bakiye > 0 = müşteri bize borçlu. USD/EUR TL ile toplanmaz.')
  return bitir(sb, `Tahsilat listesi ${mekan === 'hepsi' ? 'iç ve dış mekan' : mekanAd(mekan === 'dis' ? 'dis' : 'ic').toLowerCase()}`, sayfalar, govde, ['rapor_tahsilat'])
}

/* ─────────────── Mamul stok (iç / dış mekan) ─────────────── */
async function stok(sb: SupabaseClient, mekan: Mekan): Promise<Sonuc> {
  const j = json(await hamCalistir(() => araciCalistir(sb, 'stok_durumu', { tur: 'mamul', ...(mekan !== 'hepsi' ? { mekan } : {}) })))
  const urunler: any[] = j.mamul?.urunler || []
  const sirali = [...urunler].sort((a, b) => b.toplam_adet - a.toplam_adet)
  const toplam = sirali.reduce((t, x) => t + (+x.toplam_adet || 0), 0)
  const stoklu = sirali.filter(x => x.toplam_adet > 0), eksi = sirali.filter(x => x.toplam_adet < 0)
  const varSat: Hucre[][] = []
  for (const u of sirali) for (const v of (u.varyantlar || [])) varSat.push([u.kod, u.urun, mekanAd(u.mekan), v.ad, +v.adet || 0])
  varSat.push(['', 'TOPLAM', '', '', r2(varSat.reduce((t, x) => t + (+(x[4] as number) || 0), 0))])
  const urunSat: Hucre[][] = sirali.map((u, i) => [i + 1, u.kod, u.urun, mekanAd(u.mekan), (u.varyantlar || []).length, +u.toplam_adet || 0, toplam ? r2((+u.toplam_adet || 0) / toplam * 100) : 0])
  if (urunSat.length) urunSat.push(['', '', 'TOPLAM', '', null, toplam, null])
  const sayfalar: Sayfa[] = [
    { ad: 'Özet', sutunlar: ['Alan', 'Değer'], satirlar: [['Kapsam', mekan === 'hepsi' ? 'İç + dış mekan' : mekanAd(mekan)], ['Ürün sayısı', sirali.length], ['Stoklu ürün sayısı', stoklu.length], ['Stoksuz (0) ürün sayısı', sirali.length - stoklu.length - eksi.length], ['Eksi stoklu ürün sayısı', eksi.length], ['Toplam mamul stok (adet)', toplam], ['Rapor tarihi', bugunISO()]] },
    { ad: 'Ürün Stok', sutunlar: ['Sıra', 'Ürün Kodu', 'Ürün', 'Mekan', 'Varyant (stoklu)', 'Toplam Adet', 'Pay %'], satirlar: urunSat },
    { ad: 'Renk Ebat Detay', sutunlar: ['Ürün Kodu', 'Ürün', 'Mekan', 'Renk / Ebat', 'Adet'], satirlar: varSat },
  ]
  const govde = [`${mekan === 'hepsi' ? 'İÇ + DIŞ MEKAN' : mekanAd(mekan).toUpperCase()} MAMUL STOK (${bugunISO()}) — toplam ${AD(toplam)} adet, ${stoklu.length} üründe stok var (${sirali.length} üründen)`, '']
  stoklu.slice(0, 15).forEach((x, i) => govde.push(`${i + 1}. ${x.kod} ${x.urun}: ${AD(x.toplam_adet)} adet`))
  if (stoklu.length > 15) govde.push(`… ${stoklu.length - 15} ürün daha (Excel'de renk/ebat kırılımıyla)`)
  if (eksi.length) govde.push('', `Dikkat: ${eksi.length} üründe eksi stok var (${eksi.slice(0, 5).map(x => `${x.kod}: ${AD(x.toplam_adet)}`).join(', ')}) — sayım/giriş eksik olabilir.`)
  return bitir(sb, `${mekan === 'hepsi' ? 'İç ve dış mekan' : mekanAd(mekan)} mamul stok`, sayfalar, govde, ['rapor_stok'])
}

/* ─────────────── Satış (yıl başından bu yana; iç / dış mekan) ─────────────── */
async function satis(sb: SupabaseClient, mekan: Mekan): Promise<Sonuc> {
  const [rows, must] = await Promise.all([
    sayfala(sb, 'satis_adetleri', 'ay,kod,ad,mekan,adet,tutar', q => (mekan !== 'hepsi' ? q.eq('mekan', mekan) : q)),
    hamCalistir(() => araciCalistir(sb, 'musteri_satis', { mekan })).then(json).catch(() => null),
  ])
  let ciro: any = null
  let stokU: any[] = []
  try { stokU = (json(await hamCalistir(() => araciCalistir(sb, 'stok_durumu', { tur: 'mamul', ...(mekan !== 'hepsi' ? { mekan } : {}) }))).mamul?.urunler) || [] } catch { /* stok sütunu boş kalır */ }
  try { ciro = json(await araciCalistir(sb, 'mekan_satis', { bas: `${bugunISO().slice(0, 4)}-01-01`, bit: bugunISO() })) } catch { /* muhasebe ciro eklenemez */ }
  if (!rows.length) return { yanit: 'Satış dosyasında bu kapsam için kayıt bulunamadı.', araclar: ['rapor_satis'] }
  const sonAy = Math.max(...rows.map(x => +x.ay || 0))
  const ayList = Array.from({ length: sonAy }, (_, i) => i + 1)
  const toplamAdet = rows.reduce((t, x) => t + (+x.adet || 0), 0), toplamTutar = rows.reduce((t, x) => t + (+x.tutar || 0), 0)
  // Aylık
  const ay: Record<number, { a: number; t: number }> = {}
  for (const x of rows) { const k = ay[+x.ay] = ay[+x.ay] || { a: 0, t: 0 }; k.a += +x.adet || 0; k.t += +x.tutar || 0 }
  const ciroAy: Record<number, number> = {}
  for (const x of (ciro?.aylik || [])) { const n = +String(x.ay).slice(5, 7); ciroAy[n] = (ciroAy[n] || 0) + (mekan === 'ic' ? x.ic_mekan : mekan === 'dis' ? x.dis_mekan : x.ic_mekan + x.dis_mekan) }
  const aylikSat: Hucre[][] = ayList.map(n => [AYLAR[n - 1], r2(ay[n]?.a || 0), r2(ay[n]?.t || 0), ay[n]?.a ? r2(ay[n].t / ay[n].a) : 0, ciro ? r2(ciroAy[n] || 0) : null])
  aylikSat.push(['TOPLAM', r2(toplamAdet), r2(toplamTutar), toplamAdet ? r2(toplamTutar / toplamAdet) : 0, ciro ? r2(Object.values(ciroAy).reduce((t, x) => t + x, 0)) : null])
  // Ürün bazlı (renksiz ana kod) ve kod/renk detayı
  type G = { kod: string; ad: string; mekan: string; adet: number; tutar: number; enCok: number; ay: number[]; tay: number[] }
  const ana: Record<string, G> = {}, kodlu: Record<string, G> = {}
  for (const x of rows) {
    const n = +x.ay, a = +x.adet || 0, t = +x.tutar || 0
    for (const [map, key] of [[ana, anaKod(x.kod) + '|' + x.mekan], [kodlu, String(x.kod).toUpperCase() + '|' + x.mekan]] as const) {
      const g = map[key] = map[key] || { kod: map === ana ? anaKod(x.kod) : String(x.kod).toUpperCase(), ad: '', mekan: x.mekan, adet: 0, tutar: 0, enCok: -1, ay: ayList.map(() => 0), tay: ayList.map(() => 0) }
      g.adet += a; g.tutar += t; g.ay[n - 1] = (g.ay[n - 1] || 0) + a; g.tay[n - 1] = (g.tay[n - 1] || 0) + t
      if (a > g.enCok) { g.enCok = a; g.ad = map === ana ? renksiz(x.ad) : String(x.ad || '').replace(/\s+/g, ' ').trim() }
    }
  }
  const sirala = (m: Record<string, G>) => Object.values(m).filter(g => g.adet || g.tutar).sort((a, b) => b.tutar - a.tutar)
  const anaL = sirala(ana), kodL = sirala(kodlu)
  const urunSat: Hucre[][] = anaL.map((g, i) => [i + 1, g.kod, g.ad, mekanAd(g.mekan), r2(g.adet), g.adet ? r2(g.tutar / g.adet) : 0, r2(g.tutar), toplamTutar ? r2(g.tutar / toplamTutar * 100) : 0])
  urunSat.push(['', '', 'TOPLAM', '', r2(toplamAdet), toplamAdet ? r2(toplamTutar / toplamAdet) : 0, r2(toplamTutar), 100])
  const kodSat: Hucre[][] = kodL.map(g => [g.kod, g.ad, renkAdi(g.ad), mekanAd(g.mekan), r2(g.adet), g.adet ? r2(g.tutar / g.adet) : 0, r2(g.tutar)])
  const matris = (alan: 'ay' | 'tay'): Hucre[][] => { const s: Hucre[][] = anaL.map(g => [g.kod, g.ad, mekanAd(g.mekan), ...g[alan].map(r2), r2(g[alan].reduce((t, x) => t + x, 0))]); if (s.length) s.push(topSat(s, ayList.map((_, i) => i + 3).concat([ayList.length + 3]), [1, 'TOPLAM'])); return s }
  const aySut = ayList.map(n => AYLAR[n - 1])
  // Muhasebe programı çıktısıyla aynı düzen: Stok kodu | Stok ismi | Satış miktarı | Birimi | Stok adedi | her ay (adet + satış belge) | TÜM AYLAR
  const rnk = (v: string) => nrm(v).replace(/antarasit|antasit|antrasit/g, 'antrasit').replace(/kapucino|kapicino|kapucino/g, 'kapicino')
  const stokBul = (kod: string, ad: string): number | null => {
    const u = stokU.find(x => String(x.kod).toUpperCase() === anaKod(kod))
    if (!u) return null
    const r = rnk(renkAdi(ad))
    const vs: any[] = u.varyantlar || []
    const e = r ? vs.filter(v => rnk(String(v.ad)).includes(r)) : vs
    return e.length ? r2(e.reduce((t, v) => t + (+v.adet || 0), 0)) : 0
  }
  const liste = Object.values(kodlu).sort((a, b) => a.kod.localeCompare(b.kod, 'tr', { numeric: true }))
  const listeSut = ['Stok kodu', 'Stok ismi', 'Satış miktarı', 'Birimi', 'Stok adedi', ...ayList.flatMap(n => [AYLAR[n - 1], `${AYLAR[n - 1]} satış belge`]), 'TÜM AYLAR TOP.SAT.BELG.DEĞ']
  const listeSat: Hucre[][] = liste.map(g => [g.kod, g.ad, r2(g.adet), 'ADET', stokBul(g.kod, g.ad), ...ayList.flatMap((_, i) => [r2(g.ay[i] || 0), r2(g.tay[i] || 0)]), r2(g.tutar)])
  if (listeSat.length) listeSat.push(topSat(listeSat, [2, 4, ...ayList.flatMap((_, i) => [5 + i * 2, 6 + i * 2]), 5 + ayList.length * 2], [0, 'TOPLAM']))
  const sayfalar: Sayfa[] = [
    { ad: 'Satış Listesi', sutunlar: listeSut, satirlar: listeSat },
    { ad: 'Özet', sutunlar: ['Alan', 'Değer'], satirlar: [
      ['Kapsam', mekan === 'hepsi' ? 'İç + dış mekan' : mekanAd(mekan)], ['Dönem', `${bugunISO().slice(0, 4)} Ocak – ${AYLAR[sonAy - 1]} (satış dosyası ${AYLAR[sonAy - 1]} ayına kadar)`],
      ['Satılan adet', r2(toplamAdet)], ['Satış tutarı (TL, KDV hariç)', r2(toplamTutar)], ['Ortalama birim fiyat (TL)', toplamAdet ? r2(toplamTutar / toplamAdet) : 0], ['Ürün sayısı', anaL.length],
      ...(must ? [['Müşteri sayısı', must.musteri_sayisi], ['İade tutarı (TL)', must.genel?.iade_tl]] as Hucre[][] : []),
      ...(ciro ? [['Muhasebe ciro: Ürün Satışı (TL)', r2(Object.values(ciroAy).reduce((t, x) => t + x, 0))]] as Hucre[][] : []),
    ] },
    { ad: 'Aylık', sutunlar: ['Ay', 'Adet', 'Tutar (TL)', 'Ort. Birim Fiyat (TL)', 'Muhasebe Ciro (TL)'], satirlar: aylikSat },
    { ad: 'Ürün Bazlı', sutunlar: ['Sıra', 'Ürün Kodu', 'Ürün', 'Mekan', 'Adet', 'Birim Fiyat (TL)', 'Tutar (TL)', 'Pay %'], satirlar: urunSat },
    { ad: 'Renk Kod Detay', sutunlar: ['Kod', 'Ürün (renkli)', 'Renk', 'Mekan', 'Adet', 'Birim Fiyat (TL)', 'Tutar (TL)'], satirlar: kodSat },
    { ad: 'Ürün x Ay Adet', sutunlar: ['Ürün Kodu', 'Ürün', 'Mekan', ...aySut, 'Toplam'], satirlar: matris('ay') },
    { ad: 'Ürün x Ay Tutar', sutunlar: ['Ürün Kodu', 'Ürün', 'Mekan', ...aySut, 'Toplam'], satirlar: matris('tay') },
  ]
  if (must?.musteriler?.length) sayfalar.push({ ad: 'Müşteri Bazlı', sutunlar: ['Müşteri', 'Satış Adet', 'İade Adet', 'Net Adet', 'Satış TL', 'İade TL', 'Net TL'], satirlar: must.musteriler.map((m: any) => [m.musteri, m.satis_adet, m.iade_adet, m.net_adet, m.satis_tl, m.iade_tl, m.net_tl]) })
  const ad = mekan === 'hepsi' ? 'İç + dış mekan' : mekanAd(mekan)
  const govde = [
    `${ad.toUpperCase()} SATIŞ — ${bugunISO().slice(0, 4)} Ocak–${AYLAR[sonAy - 1]} (satış dosyası): ${AD(toplamAdet)} adet, ${TL(toplamTutar)} TL (KDV hariç)`,
    ciro ? `Muhasebe ciro (Ürün Satışı, ${ad}): ${TL(Object.values(ciroAy).reduce((t, x) => t + x, 0))} TL — satış dosyasından farklı olabilir (tahakkuk/zamanlama).` : '',
    '', 'AYLIK:', ...ayList.map(n => `• ${AYLAR[n - 1]}: ${AD(ay[n]?.a || 0)} adet — ${TL(ay[n]?.t || 0)} TL`), '',
    'EN ÇOK SATAN 10 ÜRÜN (tutara göre):', ...anaL.slice(0, 10).map((g, i) => `${i + 1}. ${g.kod} ${g.ad}: ${AD(g.adet)} adet — ${TL(g.tutar)} TL`),
    ...(must?.musteriler?.length ? ['', 'EN BÜYÜK 5 MÜŞTERİ (net):', ...must.musteriler.slice(0, 5).map((m: any, i: number) => `${i + 1}. ${m.musteri}: ${TL(m.net_tl)} TL`)] : []),
  ].filter((x, i, a) => x !== '' || a[i - 1] !== '')
  return bitir(sb, `${ad} satış ${bugunISO().slice(0, 4)}`, sayfalar, govde, ['rapor_satis'])
}

/* ─────────────── Belirli ürün kodları (ör. ALYG-01, ALY-101, ALY-102) ─────────────── */
async function urunSatis(sb: SupabaseClient, kodlar: string[]): Promise<Sonuc> {
  const [rows, ms] = await Promise.all([
    sayfala(sb, 'satis_adetleri', 'ay,kod,ad,mekan,adet,tutar'),
    Promise.all(kodlar.map(k => sayfala(sb, 'satis_cari', 'ay,cari_adi,kod,adet,tutar', q => q.ilike('kod', k + '%')).catch(() => []))),
  ])
  const sonAy = Math.max(1, ...rows.map(x => +x.ay || 0)), ayList = Array.from({ length: sonAy }, (_, i) => i + 1), aySut = ayList.map(n => AYLAR[n - 1])
  const ozet: Hucre[][] = [], aAdet: Hucre[][] = [], aTutar: Hucre[][] = [], renk: Hucre[][] = [], mus: Hucre[][] = [], govde: string[] = [], bulunamayan: string[] = []
  const stokRows: any[] = await Promise.resolve(sb.from('products').select('id,code').then((r: any) => r.data || [])).catch(() => [])
  const varRows: any[] = await Promise.resolve(sb.from('product_variants').select('product_id,stock').limit(6000).then((r: any) => r.data || [])).catch(() => [])
  let gAdet = 0, gTutar = 0
  kodlar.forEach((kod, i) => {
    const u = rows.filter(x => kodEslesir(x.kod, kod))
    if (!u.length) { bulunamayan.push(kod); return }
    const adet = u.reduce((t, x) => t + (+x.adet || 0), 0), tutar = u.reduce((t, x) => t + (+x.tutar || 0), 0)
    gAdet += adet; gTutar += tutar
    const ad = renksiz(u.sort((a, b) => (+b.adet || 0) - (+a.adet || 0))[0].ad), ays = u.map(x => +x.ay)
    const stokAdet = varRows.filter(v => stokRows.some(p => p.id === v.product_id && String(p.code).toUpperCase() === kod)).reduce((t, v) => t + (+v.stock || 0), 0)
    const ma = ayList.map(n => r2(u.filter(x => +x.ay === n).reduce((t, x) => t + (+x.adet || 0), 0))), mt = ayList.map(n => r2(u.filter(x => +x.ay === n).reduce((t, x) => t + (+x.tutar || 0), 0)))
    ozet.push([kod, ad, mekanAd(u[0].mekan), r2(adet), adet ? r2(tutar / adet) : 0, r2(tutar), AYLAR[Math.min(...ays) - 1], AYLAR[Math.max(...ays) - 1], stokAdet || null])
    aAdet.push([kod, ad, ...ma, r2(adet)]); aTutar.push([kod, ad, ...mt, r2(tutar)])
    const kk = [...new Set(u.map(x => String(x.kod).toUpperCase()))].sort()
    for (const k of kk) { const z = u.filter(x => String(x.kod).toUpperCase() === k), a = z.reduce((t, x) => t + (+x.adet || 0), 0), t = z.reduce((s, x) => s + (+x.tutar || 0), 0); renk.push([k, String(z[0].ad).replace(/\s+/g, ' ').trim(), renkAdi(z[0].ad) || '—', r2(a), a ? r2(t / a) : 0, r2(t)]) }
    const mm: Record<string, { a: number; t: number; ia: number; it: number }> = {}
    for (const x of ms[i] as any[]) if (kodEslesir(x.kod, kod)) { const k = mm[x.cari_adi] = mm[x.cari_adi] || { a: 0, t: 0, ia: 0, it: 0 }; const a = +x.adet || 0, t = +x.tutar || 0; k.a += a; k.t += t; if (a < 0 || t < 0) { k.ia += a; k.it += t } }
    Object.entries(mm).sort((a, b) => b[1].t - a[1].t).forEach(([m, v]) => mus.push([kod, m, r2(v.a), r2(v.t), r2(v.ia), r2(v.it)]))
    govde.push(`${kod} ${ad}${renk.length > 1 && kk.length > 1 ? ` (${kk.length} renk)` : ''}: ${AD(adet)} adet — ${TL(tutar)} TL (ort. ${TL(adet ? tutar / adet : 0)} TL/adet), ${AYLAR[Math.min(...ays) - 1]}–${AYLAR[Math.max(...ays) - 1]} arası`)
  })
  if (!ozet.length) return { yanit: `${kodlar.join(', ')} kodlu ürün için satış kaydı bulunamadı. Kod yazımını kontrol edin (satış dosyasında renk ekli kodlar var: ALYG-01A, ALYG-01BJ gibi).`, araclar: ['rapor_urun_satis'] }
  if (ozet.length > 1) ozet.push(['', 'TOPLAM', '', r2(gAdet), gAdet ? r2(gTutar / gAdet) : 0, r2(gTutar), '', '', null])
  const sayfalar: Sayfa[] = [
    { ad: 'Özet', sutunlar: ['Ürün Kodu', 'Ürün', 'Mekan', 'Satılan Adet', 'Birim Fiyat (TL)', 'Tutar (TL)', 'İlk Satış Ayı', 'Son Satış Ayı', 'Güncel Stok (adet)'], satirlar: ozet },
    { ad: 'Aylık Adet', sutunlar: ['Ürün Kodu', 'Ürün', ...aySut, 'Toplam'], satirlar: aAdet },
    { ad: 'Aylık Tutar', sutunlar: ['Ürün Kodu', 'Ürün', ...aySut, 'Toplam (TL)'], satirlar: aTutar },
  ]
  if (renk.length > aAdet.length) sayfalar.push({ ad: 'Renk Kırılımı', sutunlar: ['Kod', 'Ürün', 'Renk', 'Adet', 'Birim Fiyat (TL)', 'Tutar (TL)'], satirlar: renk })
  if (mus.length) sayfalar.push({ ad: 'Müşteriler', sutunlar: ['Ürün Kodu', 'Müşteri', 'Net Adet', 'Net Tutar (TL)', 'İade Adet', 'İade TL'], satirlar: mus })
  if (ozet.length > 1) govde.push('', `GENEL TOPLAM: ${AD(gAdet)} adet — ${TL(gTutar)} TL`)
  if (mus.length) { govde.push('', 'EN ÇOK ALAN MÜŞTERİLER:'); mus.slice(0, 8).forEach((m, i) => govde.push(`${i + 1}. ${m[0]} · ${m[1]}: ${AD(+(m[2] as number))} adet — ${TL(+(m[3] as number))} TL`)) }
  if (bulunamayan.length) govde.push('', `Satış kaydı bulunamayan kod: ${bulunamayan.join(', ')}`)
  govde.push('', `Not: Satış dosyası ${AYLAR[sonAy - 1]} ayına kadardır (KDV hariç, iadeler düşülmüş değil; iade ayrı sütunda).`)
  return bitir(sb, `Ürün satış ${kodlar.join(' ')}`, sayfalar, govde, ['rapor_urun_satis'])
}

/* ─────────────── Satıştan hammadde kullanımı ─────────────── */
async function hammadde(sb: SupabaseClient, mekan: Mekan): Promise<Sonuc> {
  const j = json(await hamCalistir(() => araciCalistir(sb, 'satis_hammadde', { mekan })))
  const { jsonTablolar } = await import('@/lib/ai-excel')
  const ur: any[] = j.urunler || [], yok: any[] = j.gramaji_olmayan_urunler || []
  const sayfalar: Sayfa[] = []
  const ozetSat: Hucre[][] = []
  const govde = [`SATILAN ÜRÜNLERİN HAMMADDE KULLANIMI — ${j.donem}`, '']
  for (const m of (mekan === 'hepsi' ? ['dış mekan', 'iç mekan'] : [mekan === 'dis' ? 'dış mekan' : 'iç mekan'])) {
    const u = ur.filter(x => x.mekan === m).sort((a, b) => b.hammadde_kg - a.hammadde_kg), y = yok.filter(x => x.mekan === m)
    const kg = u.reduce((t, x) => t + x.hammadde_kg, 0), adet = u.reduce((t, x) => t + x.adet, 0)
    const sat: Hucre[][] = u.map((x, i) => [i + 1, x.urun, x.adet, x.gramaj_kg, x.hammadde_kg, kg ? r2(x.hammadde_kg / kg * 100) : 0, x.tutar_tl])
    for (const x of y) sat.push(['', `${x.urun} (gramajı yok)`, x.adet, null, null, null, x.tutar_tl])
    sat.push(['', 'TOPLAM', r2(sat.reduce((t, x) => t + (+(x[2] as number) || 0), 0)), null, r2(kg), 100, r2(sat.reduce((t, x) => t + (+(x[6] as number) || 0), 0))])
    sayfalar.push({ ad: `Ürün ${mekanAd(m)}`, sutunlar: ['Sıra', 'Ürün', 'Satış Adedi', 'Gramaj (kg)', 'Hammadde (kg)', 'Pay %', 'Tutar (TL)'], satirlar: sat })
    ozetSat.push([mekanAd(m), r2(adet), r2(kg), r2(kg / 1000), y.length, r2(y.reduce((t, x) => t + x.adet, 0))])
    govde.push(`${mekanAd(m).toUpperCase()}: ${AD(adet)} adet satış → ${TL(kg)} kg (${TL(kg / 1000)} ton) hammadde${y.length ? ` (+${y.length} üründe gramaj tanımsız)` : ''}`)
    u.slice(0, 10).forEach((x, i) => govde.push(`${i + 1}. ${x.urun}: ${AD(x.adet)} adet × ${x.gramaj_kg} kg = ${TL(x.hammadde_kg)} kg`))
    govde.push('')
  }
  sayfalar.unshift({ ad: 'Özet', sutunlar: ['Mekan', 'Satılan Adet', 'Hammadde (kg)', 'Hammadde (ton)', 'Gramajı Tanımsız Ürün', 'Onların Adedi'], satirlar: ozetSat })
  const ekstra = jsonTablolar(j).filter(s => /aylik|ay/i.test(s.ad) && !/urun|ozet|özet/i.test(s.ad))
  sayfalar.push(...ekstra.slice(0, 2))
  govde.push('Not: Bu, SATILAN ürünlerin ağırlığıdır (adet × reçete gramajı); fire ve stoka üretim dahil değildir. Satış dosyası Eylül ayına kadardır.')
  return bitir(sb, `Satışa göre hammadde ${mekan === 'hepsi' ? 'iç ve dış mekan' : mekanAd(mekan).toLowerCase()}`, sayfalar, govde, ['rapor_hammadde'])
}

/* ─────────────── İhracat: tahsil edilmeyen (açık bakiyeli) müşteriler ─────────────── */
async function ihracatTahsilat(sb: SupabaseClient): Promise<Sonuc> {
  const [cl, ih] = await Promise.all([
    sb.from('cari_hesaplar').select('id,ad,muhasebe_kodu,bakiye,bakiye_usd,bakiye_eur').like('muhasebe_kodu', '120.20%').limit(1000).then((r: any) => { if (r.error) throw new Error(r.error.message); return r.data as any[] }),
    sb.from('ihracat_gecmis').select('defter_yili,fatura_tarihi,fatura_no,miktar,para_birimi,tutar,tl_tutar,unvan').order('fatura_tarihi').limit(1000).then((r: any) => (r.data || []) as any[]),
  ])
  const acik = (x: any) => Math.abs(+x.bakiye) > 0.5 || Math.abs(+x.bakiye_usd) > 0.5 || Math.abs(+x.bakiye_eur) > 0.5
  const alacak = cl.filter(x => acik(x) && (+x.bakiye > 0.5 || +x.bakiye_usd > 0.5 || +x.bakiye_eur > 0.5)).sort((a, b) => (+b.bakiye_usd + +b.bakiye_eur * 1.1 + +b.bakiye / 40) - (+a.bakiye_usd + +a.bakiye_eur * 1.1 + +a.bakiye / 40))
  const borc = cl.filter(x => acik(x) && (+x.bakiye < -0.5 || +x.bakiye_usd < -0.5 || +x.bakiye_eur < -0.5) && !alacak.includes(x))
  const fat = (ad: string) => ih.filter(r => nrm(r.unvan) === nrm(ad))
  const son = (ad: string) => { const f = fat(ad); return f.length ? f[f.length - 1] : null }
  const yil = +bugunISO().slice(0, 4)
  const sat: Hucre[][] = alacak.map((x, i) => { const s = son(x.ad), f26 = fat(x.ad).filter(r => r.defter_yili === yil); return [i + 1, x.muhasebe_kodu, x.ad, +x.bakiye_usd > 0.5 ? +x.bakiye_usd : null, +x.bakiye_eur > 0.5 ? +x.bakiye_eur : null, +x.bakiye > 0.5 ? +x.bakiye : null, s ? s.fatura_tarihi : '', s ? s.fatura_no : '', s ? `${TL(+s.tutar)} ${s.para_birimi}` : '', f26.length, r2(f26.filter(r => r.para_birimi === 'USD').reduce((t, r) => t + (+r.tutar || 0), 0)) || null] })
  if (sat.length) sat.push(topSat(sat, [3, 4, 5], [2, 'TOPLAM']).map((v, i) => (i === 0 ? '' : v)))
  const bsat: Hucre[][] = borc.map(x => [x.muhasebe_kodu, x.ad, +x.bakiye_usd < -0.5 ? -x.bakiye_usd : null, +x.bakiye_eur < -0.5 ? -x.bakiye_eur : null, +x.bakiye < -0.5 ? -x.bakiye : null])
  const tUsd = alacak.reduce((t, x) => t + Math.max(0, +x.bakiye_usd), 0), tEur = alacak.reduce((t, x) => t + Math.max(0, +x.bakiye_eur), 0), tTl = alacak.reduce((t, x) => t + Math.max(0, +x.bakiye), 0)
  const sayfalar: Sayfa[] = [
    { ad: 'Özet', sutunlar: ['Alan', 'Değer'], satirlar: [['Tahsil edilmemiş bakiyeli ihracat müşterisi', alacak.length], ['Toplam USD alacak', r2(tUsd)], ['Toplam EUR alacak', r2(tEur)], ['Toplam TL alacak', r2(tTl)], ['Bakiyesi bizim aleyhimize (avans/fazla ödeme) müşteri', borc.length], ['Rapor tarihi', bugunISO()]] },
    { ad: 'Tahsil Edilecek', sutunlar: ['Sıra', 'Cari Kodu', 'Müşteri', 'USD Bakiye', 'EUR Bakiye', 'TL Bakiye', 'Son Fatura Tarihi', 'Son Fatura No', 'Son Fatura Tutarı', `${yil} Fatura Adedi`, `${yil} Fatura (USD)`], satirlar: sat },
  ]
  if (bsat.length) sayfalar.push({ ad: 'Bakiyesi Eksi', sutunlar: ['Cari Kodu', 'Müşteri', 'USD (şirket borçlu)', 'EUR (şirket borçlu)', 'TL (şirket borçlu)'], satirlar: bsat })
  const govde = [`İHRACAT — TAHSİL EDİLMEMİŞ BAKİYELER (cari hesap 120.20): ${alacak.length} müşteri`, `Toplam: ${TL(tUsd)} USD${tEur ? ` + ${TL(tEur)} EUR` : ''}${tTl ? ` + ${TL(tTl)} TL` : ''}`, '']
  alacak.forEach((x, i) => govde.push(`${i + 1}. ${x.ad} — ${[+x.bakiye_usd > 0.5 ? TL(+x.bakiye_usd) + ' USD' : '', +x.bakiye_eur > 0.5 ? TL(+x.bakiye_eur) + ' EUR' : '', +x.bakiye > 0.5 ? TL(+x.bakiye) + ' TL' : ''].filter(Boolean).join(' + ')}${son(x.ad) ? ` (son fatura ${son(x.ad).fatura_tarihi})` : ''}`))
  if (borc.length) govde.push('', `Bakiyesi eksi (bizim borcumuz/avans): ${borc.map(x => `${x.ad} ${[+x.bakiye_usd < -0.5 ? TL(-x.bakiye_usd) + ' USD' : '', +x.bakiye_eur < -0.5 ? TL(-x.bakiye_eur) + ' EUR' : ''].filter(Boolean).join(' ')}`).join('; ')}`)
  govde.push('', 'Not: Cari bakiyedir (fatura tek tek ödemeyle eşleştirilmez). ±0,5 altındaki kuruş farkları listelenmedi.')
  return bitir(sb, 'İhracat tahsil edilmemiş bakiyeler', sayfalar, govde, ['rapor_ihracat_tahsilat'])
}

/* ─────────────── İhracat rakamları (USD / EUR / TL) ─────────────── */
async function ihracatRakam(sb: SupabaseClient, yil: number): Promise<Sonuc> {
  const rows: any[] = await sb.from('ihracat_gecmis').select('defter_yili,fatura_tarihi,fatura_no,miktar,para_birimi,tutar,beyan_tutar_usd,kur,tl_tutar,unvan').order('fatura_tarihi').limit(1000).then((r: any) => { if (r.error) throw new Error(r.error.message); return r.data })
  const u = rows.filter(r => r.defter_yili === yil)
  if (!u.length) return { yanit: `${yil} için ihracat kaydı bulunamadı.`, araclar: ['rapor_ihracat'] }
  const pb = (l: any[], c: string) => r2(l.filter(r => r.para_birimi === c).reduce((t, r) => t + (+r.tutar || 0), 0)), tl = (l: any[]) => r2(l.reduce((t, r) => t + (+r.tl_tutar || 0), 0)), adet = (l: any[]) => r2(l.reduce((t, r) => t + (+r.miktar || 0), 0))
  const ay: Record<string, any[]> = {}, mus: Record<string, any[]> = {}
  for (const r of u) { (ay[String(r.fatura_tarihi).slice(0, 7)] ||= []).push(r); (mus[r.unvan] ||= []).push(r) }
  const satir = (k: string, l: any[]): Hucre[] => [k, l.length, adet(l), pb(l, 'USD') || null, pb(l, 'EUR') || null, pb(l, 'TRY') || null, tl(l)]
  const aySat = Object.entries(ay).sort().map(([k, l]) => satir(`${AYLAR[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`, l)); aySat.push(satir('TOPLAM', u))
  const musSat = Object.entries(mus).sort((a, b) => tl(b[1]) - tl(a[1])).map(([k, l]) => satir(k, l)); musSat.push(satir('TOPLAM', u))
  const yilSat = [...new Set(rows.map(r => r.defter_yili))].sort().map(y => satir(String(y), rows.filter(r => r.defter_yili === y)))
  const sayfalar: Sayfa[] = [
    { ad: 'Özet', sutunlar: ['Alan', 'Değer'], satirlar: [['Dönem (defter yılı)', yil], ['İlk fatura', u[0].fatura_tarihi], ['Son fatura', u[u.length - 1].fatura_tarihi], ['Fatura sayısı', u.length], ['Toplam adet', adet(u)], ['Toplam USD', pb(u, 'USD')], ['Toplam EUR', pb(u, 'EUR')], ['Toplam TL cinsi', pb(u, 'TRY')], ['Toplam TL karşılığı (gümrük beyan kuruyla)', tl(u)], ['Müşteri/ülke sayısı', Object.keys(mus).length]] },
    { ad: 'Aylık', sutunlar: ['Ay', 'Fatura', 'Adet', 'USD', 'EUR', 'TL (cins)', 'TL Karşılığı'], satirlar: aySat },
    { ad: 'Müşteri', sutunlar: ['Müşteri', 'Fatura', 'Adet', 'USD', 'EUR', 'TL (cins)', 'TL Karşılığı'], satirlar: musSat },
    { ad: 'Fatura Detay', sutunlar: ['Tarih', 'Fatura No', 'Müşteri', 'Miktar', 'Para Birimi', 'Tutar', 'Kur', 'TL Karşılığı'], satirlar: u.map(r => [r.fatura_tarihi, r.fatura_no, r.unvan, +r.miktar || 0, r.para_birimi, +r.tutar || 0, r.kur ? +r.kur : null, r2(+r.tl_tutar || 0)]) },
    { ad: 'Yıllar', sutunlar: ['Yıl', 'Fatura', 'Adet', 'USD', 'EUR', 'TL (cins)', 'TL Karşılığı'], satirlar: yilSat },
  ]
  const govde = [
    `${yil} İHRACAT (defter yılı, ${u.length} fatura, son kayıt ${u[u.length - 1].fatura_tarihi}):`,
    `• USD: ${TL(pb(u, 'USD'))}`, `• EUR: ${TL(pb(u, 'EUR'))}`, `• TL cinsi faturalar: ${TL(pb(u, 'TRY'))}`, `• Toplam TL karşılığı (gümrük beyan kuruyla): ${TL(tl(u))} TL`, `• Toplam adet: ${AD(adet(u))}`, '',
    'EN BÜYÜK MÜŞTERİLER:', ...musSat.slice(0, 5).map((m, i) => `${i + 1}. ${m[0]}: ${TL(+(m[6] as number))} TL${m[3] ? ` (${TL(+(m[3] as number))} USD)` : ''}${m[4] ? ` (${TL(+(m[4] as number))} EUR)` : ''}`),
    '', 'Not: USD, EUR ve TL ayrı para birimleridir, birbirine eklenmez; TL karşılığı gümrük beyan kuru içindir. Kambio (kur farkı) takip edilmez.',
  ]
  return bitir(sb, `İhracat ${yil}`, sayfalar, govde, ['rapor_ihracat'])
}

/** Soru sabit rapora uyuyorsa Excel + özet üretir; uymuyorsa ya da hata olursa null (yapay zekaya devredilir). */
/* ─────────────── K. kartı (POS) tahsilatları ─────────────── */
async function posRapor(sb: SupabaseClient): Promise<Sonuc> {
  const [rows, cariler] = await Promise.all([
    sayfala(sb, 'pos_tahsilat', 'tarih,musteri,cari_id,tutar,ekstre_vade_gun,beklenen_tarih,durum,yatis_tarihi,kaynak'),
    sayfala(sb, 'cari_hesaplar', 'id,ad,muhasebe_kodu'),
  ])
  if (!rows.length) return { yanit: 'Kayıtlı k.kartı (POS) tahsilatı yok.', araclar: ['rapor_pos'] }
  const cm = new Map(cariler.map((c: any) => [c.id, c]))
  const bg = bugunISO()
  const sirali = [...rows].sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)))
  const top = (l: any[]) => r2(l.reduce((t, x) => t + (+x.tutar || 0), 0))
  const yat = sirali.filter(x => x.durum === 'yatti'), bek = sirali.filter(x => x.durum === 'bekliyor'), bagsiz = sirali.filter(x => !x.cari_id)
  const gun = (x: string, y: string) => Math.round((Date.parse(String(x).slice(0, 10)) - Date.parse(String(y).slice(0, 10))) / 86400000)
  const satir = (x: any): Hucre[] => { const c: any = x.cari_id ? cm.get(x.cari_id) : null; return [x.tarih, x.musteri, c?.ad || 'CARİYE BAĞLI DEĞİL', c?.muhasebe_kodu || '', r2(+x.tutar || 0), x.durum === 'yatti' ? 'Bankaya yattı' : 'Bankada bekliyor', x.yatis_tarihi || '', x.durum === 'yatti' && x.yatis_tarihi ? gun(x.yatis_tarihi, x.tarih) : x.durum === 'bekliyor' ? gun(bg, x.tarih) : null] }
  const sut = ['Tahsilat Tarihi', 'Müşteri (ekstre)', 'Cari Hesap', 'Muhasebe Kodu', 'Tutar (TL)', 'Durum', 'Bankaya Yatış', 'Gün (yatış / bekleme)']
  const tab = (l: any[]): Hucre[][] => { const r = l.map(satir); if (r.length) r.push(['', 'TOPLAM', '', '', top(l), '', '', null]); return r }
  const mus: Record<string, { ad: string; n: number; t: number; b: number }> = {}
  for (const x of sirali) { const c: any = x.cari_id ? cm.get(x.cari_id) : null, ad = c?.ad || x.musteri; const k = mus[ad] = mus[ad] || { ad, n: 0, t: 0, b: 0 }; k.n++; k.t += +x.tutar || 0; if (x.durum === 'bekliyor') k.b += +x.tutar || 0 }
  const musL = Object.values(mus).sort((a, b) => b.t - a.t)
  const ay: Record<string, { n: number; t: number }> = {}
  for (const x of sirali) { const k = ay[String(x.tarih).slice(0, 7)] = ay[String(x.tarih).slice(0, 7)] || { n: 0, t: 0 }; k.n++; k.t += +x.tutar || 0 }
  const sayfalar: Sayfa[] = [
    { ad: 'Özet', sutunlar: ['Alan', 'Değer'], satirlar: [['Toplam k.kartı tahsilatı (TL)', top(sirali)], ['Tahsilat adedi', sirali.length], ['Bankaya yatan (TL)', top(yat)], ['Yatan adet', yat.length], ['Bankada bekleyen (TL)', top(bek)], ['Bekleyen adet', bek.length], ['Cariye bağlı olmayan adet', bagsiz.length], ['Rapor tarihi', bg]] },
    { ad: 'Tüm Tahsilatlar', sutunlar: sut, satirlar: tab(sirali) },
    { ad: 'Bankada Bekleyen', sutunlar: sut, satirlar: tab(bek) },
    { ad: 'Bankaya Yatan', sutunlar: sut, satirlar: tab(yat) },
    { ad: 'Müşteri Bazlı', sutunlar: ['Müşteri / Cari', 'Adet', 'Toplam (TL)', 'Bankada Bekleyen (TL)'], satirlar: musL.map(m => [m.ad, m.n, r2(m.t), r2(m.b)]) },
    { ad: 'Aylık', sutunlar: ['Ay', 'Adet', 'Tutar (TL)'], satirlar: Object.keys(ay).sort().map(k => [k, ay[k].n, r2(ay[k].t)]) },
  ]
  if (bagsiz.length) sayfalar.push({ ad: 'Cariye Bağlı Olmayan', sutunlar: sut, satirlar: tab(bagsiz) })
  const govde = [`K.KARTI (POS) TAHSİLATLARI — toplam ${TL(top(sirali))} TL, ${sirali.length} işlem`, `• Bankaya yatan: ${TL(top(yat))} TL (${yat.length} adet)`, `• Bankada bekleyen: ${TL(top(bek))} TL (${bek.length} adet)`, bagsiz.length ? `• Cariye bağlı olmayan: ${bagsiz.length} adet` : '', '', 'BANKADA BEKLEYENLER:', ...bek.slice(0, 15).map(x => `• ${String(x.tarih).slice(0, 10)} ${x.musteri}: ${TL(+x.tutar)} TL (${gun(bg, x.tarih)} gündür)`)].filter((x, i, a) => x !== '' || a[i - 1] !== '')
  return bitir(sb, 'K.kartı tahsilatları', sayfalar, govde, ['rapor_pos'])
}

/* ─────────────── KDV listesi (yüklenilen / indirilecek + hesaplanan) ─────────────── */
async function kdvRapor(sb: SupabaseClient, yil: number, ay: number): Promise<Sonuc> {
  const bas = `${yil}-${String(ay).padStart(2, '0')}-01`, bit = new Date(Date.UTC(yil, ay, 0)).toISOString().slice(0, 10)
  const rows = await sayfala(sb, 'v_faturalar_liste', 'id,no,tip,durum,tarih,cari_ad,ara_toplam,kdv_orani,kdv_tutari,toplam,para_birimi,notlar', q => q.gte('tarih', bas).lte('tarih', bit))
  const gecerli = (x: any) => x.durum === 'onaylandi' || x.durum === 'odendi'
  const alis = rows.filter(x => x.tip === 'alis' && gecerli(x)).sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)))
  const taslakAlis = rows.filter(x => x.tip === 'alis' && x.durum === 'taslak')
  const satis = rows.filter(x => x.tip === 'satis' && gecerli(x)).sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)))
  const iade = rows.filter(x => x.tip === 'iade' && gecerli(x)).sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)))
  const t = (l: any[], k: string) => r2(l.reduce((a, x) => a + (+x[k] || 0), 0))
  const ayAd = AYLAR[ay - 1]
  const satir = (x: any): Hucre[] => [String(x.tarih).slice(0, 10), x.no, x.cari_ad || '', r2(+x.ara_toplam || 0), +x.kdv_orani || 0, r2(+x.kdv_tutari || 0), r2(+x.toplam || 0), x.durum === 'odendi' ? 'Ödendi' : x.durum === 'onaylandi' ? 'Onaylı' : x.durum, x.para_birimi && x.para_birimi !== 'TRY' ? x.para_birimi : '']
  const sut = ['Fatura tarihi', 'Fatura no', 'Cari / Satıcı', 'Matrah (KDV hariç)', 'KDV oranı %', 'KDV tutarı', 'Toplam', 'Durum', 'Döviz']
  const tab = (l: any[]): Hucre[][] => { const r = l.map(satir); if (r.length) r.push(['TOPLAM', '', '', t(l, 'ara_toplam'), null, t(l, 'kdv_tutari'), t(l, 'toplam'), '', '']); return r }
  const oranlar = (l: any[]) => { const m: Record<string, { n: number; a: number; k: number }> = {}; for (const x of l) { const o = String(+x.kdv_orani || 0); const g = m[o] = m[o] || { n: 0, a: 0, k: 0 }; g.n++; g.a += +x.ara_toplam || 0; g.k += +x.kdv_tutari || 0 } return Object.keys(m).sort((a, b) => +a - +b).map(o => [+o, m[o].n, r2(m[o].a), r2(m[o].k)] as Hucre[]) }
  const ind = t(alis, 'kdv_tutari'), hes = r2(t(satis, 'kdv_tutari') - t(iade, 'kdv_tutari'))
  const sayfalar: Sayfa[] = [
    { ad: 'Özet', sutunlar: ['Alan', 'Değer'], satirlar: [['Dönem', `${ayAd} ${yil}`], ['İndirilecek (yüklenilen) KDV — alış faturaları (TL)', ind], ['Alış fatura adedi', alis.length], ['Alış matrahı (TL)', t(alis, 'ara_toplam')], ['Hesaplanan KDV — satış (TL)', t(satis, 'kdv_tutari')], ['İade KDV (TL)', t(iade, 'kdv_tutari')], ['Net hesaplanan KDV (satış − iade) (TL)', hes], ['Ödenecek (+) / Devreden (−) KDV (TL)', r2(hes - ind)], ['Taslak alış faturası (KDV\'ye dahil değil)', taslakAlis.length]] },
    { ad: 'İndirilecek KDV (Alış)', sutunlar: sut, satirlar: tab(alis) },
    { ad: 'KDV Oranına Göre (Alış)', sutunlar: ['KDV oranı %', 'Fatura adedi', 'Matrah', 'KDV tutarı'], satirlar: oranlar(alis) },
    { ad: 'Hesaplanan KDV (Satış)', sutunlar: sut, satirlar: tab(satis) },
    { ad: 'İade Faturaları', sutunlar: sut, satirlar: tab(iade) },
  ]
  if (taslakAlis.length) sayfalar.push({ ad: 'Taslak Alış (dahil değil)', sutunlar: sut, satirlar: tab(taslakAlis) })
  if (!alis.length && !satis.length) return { yanit: `${ayAd} ${yil} döneminde onaylı fatura kaydı bulunamadı.`, araclar: ['rapor_kdv'] }
  const top = [...alis].sort((a, b) => (+b.kdv_tutari || 0) - (+a.kdv_tutari || 0)).slice(0, 10)
  const govde = [`${ayAd.toUpperCase()} ${yil} KDV — indirilecek (yüklenilen) KDV: ${TL(ind)} TL (${alis.length} alış faturası, matrah ${TL(t(alis, 'ara_toplam'))} TL)`, `Hesaplanan KDV (satış − iade): ${TL(hes)} TL`, `${hes - ind >= 0 ? 'Ödenecek KDV' : 'Devreden KDV'}: ${TL(Math.abs(hes - ind))} TL`, '', 'EN YÜKSEK KDV\'Lİ 10 ALIŞ FATURASI:', ...top.map((x, i) => `${i + 1}. ${String(x.tarih).slice(0, 10)} ${x.no} ${x.cari_ad || ''}: ${TL(+x.kdv_tutari || 0)} TL`)]
  if (taslakAlis.length) govde.push('', `Not: ${taslakAlis.length} taslak alış faturası KDV'ye dahil edilmedi (ayrı sayfada).`)
  govde.push('Not: Faturalar fatura tarihine göre; döviz faturaları ayrı işaretlidir.')
  return bitir(sb, `${ayAd} ${yil} KDV listesi`, sayfalar, govde, ['rapor_kdv'])
}

/* ─────────────── Tedarikçi borçları (ödenecekler) ─────────────── */
async function odemeRapor(sb: SupabaseClient): Promise<Sonuc> {
  const cl = (await sayfala(sb, 'cari_hesaplar', 'id,ad,muhasebe_kodu,tip,bakiye,bakiye_usd,bakiye_eur')).filter((c: any) => c.tip === 'tedarikci' || String(c.muhasebe_kodu || '').startsWith('320'))
  const ids = new Set(cl.map((c: any) => c.id)), top: Record<string, { b: number; a: number }> = {}
  for (const h of await sayfala(sb, 'cari_eski_hareketler', 'cari_id,grup,tl_borc,tl_alacak', q => q.eq('grup', 'TL'))) if (ids.has(h.cari_id)) { const k = top[h.cari_id] = top[h.cari_id] || { b: 0, a: 0 }; k.b += +h.tl_borc || 0; k.a += +h.tl_alacak || 0 }
  const borclu = cl.filter((c: any) => (+c.bakiye || 0) < -0.5).sort((a: any, b: any) => (+a.bakiye) - (+b.bakiye))
  const alacakli = cl.filter((c: any) => (+c.bakiye || 0) > 0.5).sort((a: any, b: any) => (+b.bakiye) - (+a.bakiye))
  const satir = (c: any): Hucre[] => { const b = +c.bakiye || 0, h = top[c.id] || { b: 0, a: 0 }; return [c.muhasebe_kodu || '', c.ad, r2(Math.abs(b)), r2(h.b), r2(h.a), b > 0 ? r2(b) : 0, b < 0 ? r2(-b) : 0] }
  const tab = (l: any[]): Hucre[][] => { const r = l.map(satir); if (r.length) r.push(topSat(r, [2, 3, 4, 5, 6], [1, 'TOPLAM'])); return r }
  const sut = ['Cari kodu', 'Unvan', 'Ödenecek TL', 'Borç', 'Alacak', 'Borç bakiye', 'Alacak bakiye']
  const dv = cl.filter((c: any) => Math.abs(+c.bakiye_usd || 0) > 0.5 || Math.abs(+c.bakiye_eur || 0) > 0.5)
  const toplam = r2(borclu.reduce((t: number, c: any) => t - (+c.bakiye || 0), 0))
  const sayfalar: Sayfa[] = [
    { ad: 'Özet', sutunlar: ['Alan', 'Değer'], satirlar: [['Şirketin borçlu olduğu tedarikçi sayısı', borclu.length], ['Toplam ödenecek (TL)', toplam], ['Tedarikçiden alacağımız olan sayısı', alacakli.length], ['Tedarikçilerden alacağımız toplam (TL)', r2(alacakli.reduce((t: number, c: any) => t + (+c.bakiye || 0), 0))], ['Döviz bakiyeli tedarikçi sayısı', dv.length], ['Rapor tarihi', bugunISO()]] },
    { ad: 'Ödenecekler', sutunlar: sut, satirlar: tab(borclu), sari: 3 },
    { ad: 'Bizim Alacağımız', sutunlar: sut, satirlar: tab(alacakli), sari: 3 },
  ]
  if (dv.length) sayfalar.push({ ad: 'Döviz Bakiyeler', sutunlar: ['Cari kodu', 'Unvan', 'USD bakiye', 'EUR bakiye'], satirlar: dv.map((c: any) => [c.muhasebe_kodu || '', c.ad, r2(+c.bakiye_usd || 0), r2(+c.bakiye_eur || 0)]) })
  const govde = [`TEDARİKÇİ BORÇLARI (ödenecekler) — ${borclu.length} tedarikçi, toplam ${TL(toplam)} TL`, '', ...borclu.slice(0, 12).map((c: any, i: number) => `${i + 1}. ${c.ad} — ${TL(-(+c.bakiye))} TL`), borclu.length > 12 ? `… ve ${borclu.length - 12} tedarikçi daha (tamamı Excel'de)` : '', alacakli.length ? `Ayrıca ${alacakli.length} tedarikçide bizim alacağımız var (Excel'de ayrı sayfa).` : '', 'Not: Bakiye < 0 = şirket tedarikçiye borçlu. USD/EUR TL ile toplanmaz.'].filter((x, i, a) => x !== '' || a[i - 1] !== '')
  return bitir(sb, 'Tedarikçi borçları (ödenecekler)', sayfalar, govde, ['rapor_odeme'])
}

/* ─────────────── Cari ekstresi: Borç | Alacak | Borç bakiye | Alacak bakiye (yürüyen), dış mekanda yalnızca TL ─────────────── */
async function ekstreRapor(sb: SupabaseClient, arama: string, kod: string): Promise<Sonuc | null> {
  const cl = await sayfala(sb, 'cari_hesaplar', 'id,ad,muhasebe_kodu,vergi_no,bakiye,bakiye_usd,bakiye_eur')
  let aday: any[]
  if (kod) aday = cl.filter((c: any) => String(c.muhasebe_kodu || '').toUpperCase().startsWith(kod.toUpperCase()))
  else { const kel = arama.split(' ').filter(w => w.length >= 2); aday = kel.length ? cl.filter((c: any) => { const a = nrm(c.ad); return kel.every(w => a.includes(w)) }) : [] }
  if (!aday.length) return null
  // Aynı firmanın G / alt hesapları (036 + 036G) tek ekstrede birleşir
  const ana = (k: string) => String(k || '').replace(/[A-Za-z]$/, '')
  const kodlar = new Set(aday.map((c: any) => ana(c.muhasebe_kodu)))
  if (kodlar.size > 1) return { yanit: `"${arama || kod}" için birden fazla cari buldum, hangisi?\n` + aday.slice(0, 10).map((c: any) => `• ${c.muhasebe_kodu || ''} ${c.ad}`).join('\n') + '\nKod veya daha uzun ünvanla tekrar sor (örn. "120.03.045 ekstresi").', araclar: ['rapor_ekstre'] }
  const c = aday[0], dis = String(c.muhasebe_kodu || '').startsWith('120.03')
  const hr = (await sayfala(sb, 'cari_eski_hareketler', 'grup,tarih,sira,evrak_no,evrak_cinsi,vade,aciklama,tl_borc,tl_alacak,usd_borc,usd_alacak,eur_borc,eur_alacak,nakil', q => q.in('cari_id', aday.map((x: any) => x.id)))).sort((a: any, b: any) => String(a.tarih).localeCompare(String(b.tarih)) || (+a.sira || 0) - (+b.sira || 0))
  const tl = hr.filter((x: any) => !x.grup || x.grup === 'TL')
  let run = 0, tb = 0, ta = 0
  const vadeGun = (v: any, t: any) => { const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(v || '').trim()); if (!m) return ''; return Math.round((Date.UTC(+m[3], +m[2] - 1, +m[1]) - Date.parse(String(t).slice(0, 10))) / 86400000) }
  const sat: Hucre[][] = tl.map((x: any) => { const b = +x.tl_borc || 0, a = +x.tl_alacak || 0; run = r2(run + b - a); tb += b; ta += a; return [String(x.tarih).slice(0, 10), x.evrak_no || '', x.nakil ? 'DEVİR' : (x.evrak_cinsi || ''), x.vade || '', vadeGun(x.vade, x.tarih), x.aciklama || '', x.nakil ? '' : (b > 0 ? 'Borç' : a > 0 ? 'Alacak' : ''), r2(b), r2(a), run > 0 ? run : 0, run < 0 ? -run : 0] })
  sat.push(['TOPLAM', '', '', '', '', '', '', r2(tb), r2(ta), run > 0 ? run : 0, run < 0 ? -run : 0])
  const sut = ['Tarih', 'Evrak no', 'Evrak cinsi', 'Vade', 'Vade gün', 'Açıklama', 'B/A', 'Borç', 'Alacak', 'Borç bakiye', 'Alacak bakiye']
  const guncel = r2(aday.reduce((t: number, x: any) => t + (+x.bakiye || 0), 0))
  const sayfalar: Sayfa[] = [
    { ad: 'Özet', sutunlar: ['Alan', 'Değer'], satirlar: [['Cari', c.ad], ['Cari kodu', c.muhasebe_kodu || ''], ['Vergi no', c.vergi_no || ''], ['Toplam borç (TL)', r2(tb)], ['Toplam alacak (TL)', r2(ta)], ['Hareket sayısı', tl.length], [guncel >= 0 ? 'Bakiye (müşteri bize borçlu, TL)' : 'Bakiye (biz borçluyuz, TL)', r2(Math.abs(guncel))], ['Ekstre ile sistem bakiyesi', Math.abs(run - guncel) < 0.02 ? 'Tutuyor' : `FARK VAR (ekstre ${TL(run)} / sistem ${TL(guncel)})`]] },
    { ad: 'Ekstre', sutunlar: sut, satirlar: sat, sari: 7 },
  ]
  if (!dis) for (const [g, ad, bk, ak] of [['USD', 'USD hareketleri', 'usd_borc', 'usd_alacak'], ['EUR', 'EUR hareketleri', 'eur_borc', 'eur_alacak']] as const) {
    const d = hr.filter((x: any) => x.grup === g); if (!d.length) continue
    let rn = 0
    const rows: Hucre[][] = d.map((x: any) => { const b = +x[bk] || 0, a = +x[ak] || 0; rn = r2(rn + b - a); return [String(x.tarih).slice(0, 10), x.evrak_no || '', x.evrak_cinsi || '', x.aciklama || '', r2(b), r2(a), rn > 0 ? rn : 0, rn < 0 ? -rn : 0] })
    sayfalar.push({ ad, sutunlar: ['Tarih', 'Evrak no', 'Evrak cinsi', 'Açıklama', `${g} borç`, `${g} alacak`, `${g} borç bakiye`, `${g} alacak bakiye`], satirlar: rows, sari: 4 })
  }
  const son = tl.slice(-12)
  const govde = [`${c.ad} (${c.muhasebe_kodu || ''}) — CARİ EKSTRESİ (TL)`, `Toplam borç ${TL(tb)} TL · toplam alacak ${TL(ta)} TL · ${run >= 0 ? 'Borç bakiye (müşteri bize borçlu)' : 'Alacak bakiye (biz borçluyuz)'}: ${TL(Math.abs(run))} TL`, Math.abs(run - guncel) < 0.02 ? 'Ekstre toplamı sistem bakiyesiyle tutuyor.' : `DİKKAT: ekstre ${TL(run)} ile sistem bakiyesi ${TL(guncel)} farklı.`, '', 'SON HAREKETLER:', ...son.map((x: any) => `• ${String(x.tarih).slice(0, 10)} ${x.evrak_cinsi || (x.nakil ? 'Devir' : '')}${x.evrak_no ? ' ' + x.evrak_no : ''}: ${+x.tl_borc ? 'Borç ' + TL(+x.tl_borc) : 'Alacak ' + TL(+x.tl_alacak)} TL`)]
  if (dis) govde.push('', 'Not: Dış mekan carileri TL çalışır; USD/EUR sütunu yok.')
  return bitir(sb, `${c.ad} ekstresi`, sayfalar, govde, ['rapor_ekstre'])
}

/* ─────────────── Ürün birim satış fiyatı: hangi faturada, hangi firmaya, kaçtan satılmış ─────────────── */
async function fiyatRapor(sb: SupabaseClient, kod: string, arama: string): Promise<Sonuc | null> {
  const num = (/\d+/.exec(kod) || [''])[0]
  if (!num) return null
  const kel = arama.split(' ').filter(w => w.length >= 2)
  let cariler: any[] = []
  const allCl = await sayfala(sb, 'cari_hesaplar', 'id,ad,muhasebe_kodu')
  if (kel.length) {
    cariler = allCl.filter((c: any) => { const a = nrm(c.ad); return kel.every(w => a.includes(w)) })
    if (!cariler.length) return { yanit: `"${arama}" adında bir cari bulamadım. Firma adını başka yazıp tekrar sor (örn. "okko" ya da cari kodu).`, araclar: ['rapor_fiyat'] }
  }
  const kal = (await sayfala(sb, 'fatura_kalemleri', 'fatura_id,urun_adi,miktar,birim_fiyat,kdv_orani,toplam', q => q.ilike('urun_adi', `%${num}%`))).filter((k: any) => {
    const m = /(ALYG?)\s*-?\s*(\d+[A-Z]{0,2})/.exec(String(k.urun_adi || '').toUpperCase().replace(/İ/g, 'I'))
    return !!m && kodEslesir(`${m[1]}-${m[2]}`, kod)
  })
  if (!kal.length) return { yanit: `${kod} kodlu ürün hiçbir faturada geçmiyor.`, araclar: ['rapor_fiyat'] }
  const ids = [...new Set(kal.map((k: any) => k.fatura_id))]
  const fat: any[] = []
  for (let i = 0; i < ids.length; i += 150) fat.push(...await sayfala(sb, 'faturalar', 'id,no,tip,tarih,durum,cari_id,para_birimi,kdv_dahil', q => q.in('id', ids.slice(i, i + 150))))
  const fm = new Map(fat.map((f: any) => [f.id, f]))
  const cid = new Set(cariler.map((c: any) => c.id))
  const cm = new Map(allCl.map((c: any) => [c.id, c]))
  const satir = kal.map((k: any) => ({ k, f: fm.get(k.fatura_id) })).filter(x => x.f && x.f.tip === 'satis' && x.f.durum !== 'iptal' && x.f.durum !== 'taslak' && (!cid.size || cid.has(x.f.cari_id)))
    .sort((a, b) => String(a.f.tarih).localeCompare(String(b.f.tarih)))
  if (!satir.length) return { yanit: `${kod} ürünü${cariler.length ? ' ' + cariler[0].ad + ' için' : ''} satış faturasında bulunamadı.`, araclar: ['rapor_fiyat'] }
  const rows: Hucre[][] = satir.map(({ k, f }) => { const c: any = cm.get(f.cari_id); return [String(f.tarih).slice(0, 10), f.no || '', c?.ad || '', k.urun_adi || '', +k.miktar || 0, +k.birim_fiyat || 0, f.para_birimi || 'TRY', f.kdv_dahil ? 'KDV dahil' : 'KDV hariç', +k.kdv_orani || 0, r2(+k.toplam || (+k.miktar || 0) * (+k.birim_fiyat || 0))] })
  const toplamAdet = r2(satir.reduce((t, x) => t + (+x.k.miktar || 0), 0))
  const fiyatlar = [...new Set(satir.map(x => `${r2(+x.k.birim_fiyat || 0)}|${x.f.para_birimi || 'TRY'}`))]
  const pb = (x: string) => { const [f, b] = x.split('|'); return `${TL(+f)} ${b === 'TRY' ? 'TL' : b}` }
  const son = satir[satir.length - 1], ilk = satir[0]
  rows.push(['TOPLAM', '', '', '', toplamAdet, '', '', '', '', r2(rows.reduce((t, r) => t + (+(r[9] as number) || 0), 0))])
  const mus = new Map<string, { adet: number; tutar: number; fiyat: Set<string> }>()
  for (const { k, f } of satir) { const ad = (cm.get(f.cari_id) as any)?.ad || '?'; const m = mus.get(ad) || { adet: 0, tutar: 0, fiyat: new Set<string>() }; m.adet += +k.miktar || 0; m.tutar += (+k.miktar || 0) * (+k.birim_fiyat || 0); m.fiyat.add(String(r2(+k.birim_fiyat || 0))); mus.set(ad, m) }
  const musRows: Hucre[][] = [...mus.entries()].sort((a, b) => b[1].adet - a[1].adet).map(([ad, m]) => [ad, r2(m.adet), m.adet ? r2(m.tutar / m.adet) : 0, [...m.fiyat].join(' / ')])
  const ad = String(satir[0].k.urun_adi || kod)
  const govde = [`${ad} — birim satış fiyatı${cariler.length ? ' · ' + cariler[0].ad : ''}`, `${satir.length} faturada toplam ${TL(toplamAdet)} adet satılmış.`, fiyatlar.length === 1 ? `Hep aynı fiyattan: ${pb(fiyatlar[0])} (${ilk.f.kdv_dahil ? 'KDV dahil' : 'KDV hariç'}).` : `Fiyatlar: ${fiyatlar.map(pb).join(', ')}. Son fiyat ${pb(`${r2(+son.k.birim_fiyat || 0)}|${son.f.para_birimi || 'TRY'}`)}.`, '', ...satir.slice(-12).map(({ k, f }) => `• ${String(f.tarih).slice(0, 10)} ${f.no}: ${TL(+k.miktar || 0)} adet × ${TL(+k.birim_fiyat || 0)} ${f.para_birimi === 'TRY' || !f.para_birimi ? 'TL' : f.para_birimi}`)]
  return bitir(sb, `${kod} birim fiyat${cariler.length ? ' ' + cariler[0].ad : ''}`, [
    { ad: 'Fatura satırları', sutunlar: ['Tarih', 'Fatura no', 'Cari', 'Ürün', 'Adet', 'Birim fiyat', 'Para birimi', 'KDV', 'KDV oranı %', 'Satır tutarı'], satirlar: rows },
    { ad: 'Müşteriye göre', sutunlar: ['Cari', 'Adet', 'Ortalama birim fiyat', 'Fiyat(lar)'], satirlar: musRows },
  ], govde, ['rapor_fiyat'])
}

export async function detayliRapor(sb: SupabaseClient, soru: string, izinli: Set<string>): Promise<Sonuc | null> {
  const n = raporNiyeti(soru)
  if (!n) return null
  const gerek: Record<RaporNiyet['tur'], string[]> = { tahsilat: ['cari_mekan_ekstre'], stok: ['stok_durumu'], satis: ['urun_satis', 'musteri_satis'], urun: ['urun_satis'], hammadde: ['satis_hammadde'], ihr_tahsilat: ['ihracat_gecmis'], ihr_rakam: ['ihracat_gecmis'], pos: ['pos_bekleyen'], kdv: ['kdv_ozet'], odeme: ['cari_ara'], ekstre: [], fiyat: [] }
  if (n.tur === 'ekstre' ? !(izinli.has('cari_ara') || izinli.has('cari_ekstre') || izinli.has('cari_mekan_ekstre')) : !gerek[n.tur].every(a => izinli.has(a))) return null
  try {
    switch (n.tur) {
      case 'tahsilat': return await tahsilat(sb, n.mekan)
      case 'stok': return await stok(sb, n.mekan)
      case 'satis': return await satis(sb, n.mekan)
      case 'urun': return await urunSatis(sb, n.kodlar)
      case 'hammadde': return await hammadde(sb, n.mekan)
      case 'ihr_tahsilat': return await ihracatTahsilat(sb)
      case 'ihr_rakam': return await ihracatRakam(sb, n.yil)
      case 'pos': return await posRapor(sb)
      case 'kdv': return await kdvRapor(sb, n.yil, n.ay)
      case 'odeme': return await odemeRapor(sb)
      case 'ekstre': return await ekstreRapor(sb, n.arama, n.kod)
      case 'fiyat': return await fiyatRapor(sb, n.kod, n.arama)
    }
  } catch (e: any) {
    console.error('[ai-rapor]', n.tur, e?.message)
    if (n.tur === 'ekstre') return { yanit: `Cari ekstresi hazırlanırken hata oluştu (${String(e?.message || e).slice(0, 160)}). Eski/yanlış rakam vermemek için dosya üretmedim.`, araclar: ['rapor_ekstre'] }
    return null
  }
}
