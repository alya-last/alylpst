// Detaylı sabit raporlar: sık sorulan satış / stok / tahsilat / ihracat sorularını yapay zekanın serbest yorumuna bırakmadan,
// doğrudan kayıtlardan çok sayfalı Excel + kısa özet olarak üretir. Aynı soru her seferinde aynı rakamı verir; tek satırlık cevap verilmez.
// Saf fonksiyonlar (raporNiyeti, kodEslesir) scripts/ai-test.mts ile test edilebilir.
import type { SupabaseClient } from '@supabase/supabase-js'
import { excelKaydet, type Sayfa } from '@/lib/ai-excel'
import { araciCalistir, hamCalistir, bugunISO } from '@/lib/ai-admin'
import { aiJson, veriBlok } from '@/lib/ai'

type Mekan = 'ic' | 'dis' | 'hepsi'
export type RaporNiyet =
  | { tur: 'tahsilat'; mekan: Mekan }
  | { tur: 'stok'; mekan: Mekan }
  | { tur: 'satis'; mekan: Mekan }
  | { tur: 'urun'; kodlar: string[] }
  | { tur: 'urun_ad'; arama: string } // ürün KODU yok, ürün ADI var ("line saksı satışlarım"): satış dosyasındaki adlardan kodlar bulunup 'urun' raporu verilir
  | { tur: 'hammadde'; mekan: Mekan }
  | { tur: 'hm_stok'; grup: HmGrup; arama: string } // hammadde / boya / koli / etiket DEPO STOĞU ("hammaddelerim neler", "boya stoğu", "koli stokları")
  | { tur: 'boya_kg'; kg: number; oran: number } // verilen hammadde kg × boya oranı
  | { tur: 'boya_kullanim'; mekan: Mekan; oran: number; kaynak?: 'stok' } // satılan iç mekan ürünlerin hammaddesi × boya oranı (varsayılan %2); dış mekanda boya yok
  | { tur: 'stok_kg'; mekan: Mekan } // eldeki MAMUL stoğun içindeki hammadde ağırlığı (stok adedi × ürün gramajı)
  | { tur: 'hm_alis'; arama: string; hareket: boolean } // hammadde ALIŞLARI / stok hareketleri (stok_hareketleri tablosu): "moblen hammadde alışlarım"
  | { tur: 'ihr_tahsilat' }
  | { tur: 'ihr_rakam'; yil: number }
  | { tur: 'pos' }
  | { tur: 'kdv'; yil: number; ay: number }
  | { tur: 'odeme' }
  | { tur: 'ekstre'; arama: string; kod: string }
  | { tur: 'fiyat'; kod: string; arama: string }
type HmGrup = 'hepsi' | 'hammadde' | 'boya' | 'koli' | 'etiket'
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

/** Soru kelimeleri arasından cari ünvanında gerçekten geçenlerle (kelime başı) eşleştirir; "ekstresini", "excel" gibi fazlalıklar elenir. */
function cariEsle(cl: any[], kel: string[]): any[] {
  const ad = (c: any) => nrm(c.ad).split(' ')
  const gecen = kel.filter(w => w.length >= 3 && cl.some((c: any) => ad(c).some(x => x.startsWith(w))))
  if (!gecen.length) return []
  return cl.filter((c: any) => gecen.every(w => ad(c).some(x => x.startsWith(w))))
}
/** Soru bu sabit raporlardan birine uyuyor mu? Emin değilse null (yapay zekaya bırakılır). */
export function raporNiyeti(soru: string): RaporNiyet | null {
  const t = nrm(soru).replace(/\bham{1,2}[ae]dde/g, 'hammadde') // yazım hataları: hammedde, hamadde
  if (!t || t.split(' ').length > 40) return null
  if (/neden|niye|\byorum\w*|karsilastir|tahmin|oner|kar zarar|maliyet|senaryo|kur farki/.test(t)) return null
  const dis = /\bdis ?mekan/.test(t), ic = /\bic ?mekan/.test(t)
  const mekan: Mekan = dis && !ic ? 'dis' : ic && !dis ? 'ic' : 'hepsi'
  const mekanVar = dis || ic
  if (/ihracat/.test(t)) {
    if (/tahsil|alacak|bakiye|borc|odeme/.test(t)) return { tur: 'ihr_tahsilat' }
    if (/rakam|ne kadar|usd|dolar|euro|\btl\b|satis|ciro|toplam|donem|kac/.test(t)) return { tur: 'ihr_rakam', yil: +(/\b(20\d\d)\b/.exec(t)?.[1] || 0) || +bugunISO().slice(0, 4) }
    return null
  }
  if (/tedarikci|satici|borclarimiz|odeyecegimiz|odenecek(ler)?\b|ne kadar borcumuz|borcumuz (var|ne)/.test(t) && /borc|odeme|odenecek|liste|bakiye|ekstre/.test(t) && !/kdv|fatura|cek|senet|maas|personel/.test(t)) return { tur: 'odeme' }
  if (/ekstre|extre|ekstra|hesap (dokum|hareket|ozet)|hareketleri|carisi|cari hesabi|\bcari\b.{0,12}\b(excel|dokum|detay|hareket)|\b(excel|dokum)\b.{0,12}\bcari\b/.test(t) && !/banka|kasa|\bk ?karti|kredi kart|\bpos\b|tahsilat|stok/.test(t) && !(/kdv/.test(t) && !/carisi|cari hesab|ekstre|extre/.test(t))) {
    const kod = /\b(120|320)\.\d{2}\.\d{3}[a-z]?\b/.exec(String(soru))?.[0] || ''
    const arama = t.replace(/\b(120|320) \d{2} \d{3}[a-z]?\b/g, ' ').replace(/\b(ekstre\w*|extre\w*|ekstra\w*|istermisin|ister|misin|cari\w*|hesab\w*|hesap\w*|dokum\w*|excel\w*|hareket(leri|lerini)?|ozet(i)?|excel|ver|al|cikar|goster|lazim|listesi|liste|detayli|detay|tum|icin|ile|ve|bir|bana|olarak|dis mekan|ic mekan|tl|nin|nın)\b/g, ' ').replace(/\s+/g, ' ').trim()
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
  const bkg = /(\d[\d.,]*)\s*(kg|kilo|ton)\b/.exec(soru.toLowerCase().replace(/ı/g, 'i'))
  if (bkg && /boya|masterbatch/.test(t) && !/stok|stog|depo\w*|satis|satil|alis|alim|fiyat|maliyet/.test(t)) {
    const sayi = +bkg[1].replace(/\./g, '').replace(',', '.'), kg = bkg[2] === 'ton' ? sayi * 1000 : sayi
    const om = /%\s*(\d+(?:[.,]\d+)?)|\b0 (\d+)\b/.exec(t), o = om ? (om[2] ? +('0.' + om[2]) : +om[1].replace(',', '.')) : 2
    if (kg > 0) return { tur: 'boya_kg', kg, oran: (o < 1 ? o * 100 : o) / 100 }
  }
  const boyaOran = () => { const om = /%\s*(\d+(?:[.,]\d+)?)|\b0 (\d+)\b|oran\w*\s*(\d+(?:[.,]\d+)?)(?! \d)/.exec(t), o = om ? (om[2] ? +('0.' + om[2]) : +(om[1] || om[3]).replace(',', '.')) : 2; return (o < 1 ? o * 100 : o) / 100 }
  // Stoktaki (depodaki) ürünlerin boyası: stok adedi × gramaj × oran
  if (/boya|masterbatch/.test(t) && /\b(stok\w*|stog\w*|depo\w*)\b/.test(t) && /kullan|tuket|sarf|harca|gitti|hesapla|icer|icinde|ne kadar boya|kac kg boya/.test(t) && !/alis|alim|fiyat|maliyet|minimum|kritik/.test(t)) return { tur: 'boya_kullanim', mekan: mekan === 'dis' ? 'dis' : 'ic', oran: boyaOran(), kaynak: 'stok' }
  if (/boya|masterbatch/.test(t) && /kullan|tuket|sarf|harca|gitti|gider/.test(t) && !/stok|stog|alis|alim|fiyat|maliyet/.test(t)) {
    const om = /%\s*(\d+(?:[.,]\d+)?)|\b0 (\d+)\b|oran\w*\s*(\d+(?:[.,]\d+)?)(?! \d)/.exec(t), o = om ? (om[2] ? +('0.' + om[2]) : +(om[1] || om[3]).replace(',', '.')) : 2
    return { tur: 'boya_kullanim', mekan, oran: (o < 1 ? o * 100 : o) / 100 }
  }
  const hma = hmAlisNiyeti(t)
  if (hma) return hma
  const hmn = hmStokNiyeti(t, kodlar)
  if (hmn) return hmn
  if (/hammadde/.test(t)) return /stok|stog|depo|kalan/.test(t) ? null : { tur: 'hammadde', mekan }
  if (/tahsilat|alacak listesi|alacaklar[iı]m|bakiyesi olan|kimden ne tahsil/.test(t) && !/\bcek\b|\bsenet\b/.test(t)) return { tur: 'tahsilat', mekan }
  if (/\b(stok\w*|stog\w*|depo\w*)\b/.test(t) && mekanVar && !/hammadde|boya|koli|ambalaj|kritik|minimum/.test(t)) return { tur: 'stok', mekan }
  if (/sat(mis|tim|ti|is|ilan|tik)|satis|ciro/.test(t) && mekanVar) return { tur: 'satis', mekan }
  // Ürün ADI ile satış/müşteri sorusu (kod yok): "line saksı satışlarımı müşteri detaylı excel ver"
  if (!kodlar.length && /sat(mis|tim|ti|is|ilan|tik)|satis|adet|ne kadar|ciro|musteri/.test(t) && !/stok|stog|recete|maliyet|hammadde|fiyat|tahsilat|bakiye|borc|kdv|fatura/.test(t) && /saksi|sepet|sandik|casa|selesi|kova|firca|deterjanlik|banyo seti|camasir|set\b|\b(line|polo|cornet|efes|venus|tripot|ufo|kozalak|somon|kale|ordek|kordon|guvec|ahsap|dantel|orgu|kapakli|kaktus|3d|cesme|kemer|milas|datca|kosk|arajman|gondol|armut|vitrin|turuva|cit|lotte)\b/.test(t)) return { tur: 'urun_ad', arama: t }
  return null
}

/** "moblen hammadde alışlarım", "granür alışları", "moblen stok hareketleri": hammaddenin giriş (alış) / hareket geçmişi. */
function hmAlisNiyeti(t: string): RaporNiyet | null {
  const alis = /\b(alim|alis|aldi|satin ?al|giris)\w*/.test(t)
  const hrk = /hareket/.test(t)
  if (!(alis || hrk)) return null
  if (!/hammadde|ham madde|moblen|granur|granul|copolimer|kopolimer|compakt|kompakt|kristal|rotasyon|\bpp\b|polipropilen|boya|\bkoli|etiket/.test(t)) return null
  if (/sat(mis|tim|ti|is|ilan|tik)|satis|ciro|musteri|tahsilat|bakiye|borc|kdv|fatura|recete|maliyet|teklif|ekstre|cari|ihracat|urun/.test(t) && !/hammadde/.test(t)) return null
  const GEN = /^(hammadde\w*|ham|madde\w*|alis\w*|alim\w*|aldi\w*|satin\w*|satinalma\w*|giris\w*|hareket\w*|stok\w*|stog\w*|liste\w*|excel\w*|ver|bana|goster\w*|tum\w*|neler|nelerim|ne|kadar|kac|icin|ile|ve|bir|bu|ay|aylik|2026|detay\w*|dokum\w*|bilgi\w*|olan|bizim|benim|ekim|bugune|kadar)$/
  const ara = t.split(' ').filter(w => (w.length >= 3 || w === 'pp') && !GEN.test(w) && !/^(misin|musun|musunuz|lutfen|rica|eder|edermisin|istiyorum|isterim)$/.test(w)).join(' ')
  return { tur: 'hm_alis', arama: ara, hareket: hrk && !alis }
}

/** "hammaddelerim neler", "boya stoğu", "yeşil boya var mı", "line koli kaç adet" gibi DEPO stoğu soruları (satış/fiyat/maliyet/reçete soruları değil). */
function hmStokNiyeti(t: string, kodlar: string[]): RaporNiyet | null {
  const varHm = /hammadde|ham madde|granur|granul|copolimer|kopolimer|compakt|kompakt|moblen|kristal|rotasyon/.test(t)
  const varBoya = /boya|masterbatch|kont\b/.test(t)
  const varKoli = /\bkoli|karton/.test(t)
  const varEtiket = /etiket|ambalaj|strec|poset|bant\b/.test(t)
  if (!(varHm || varBoya || varKoli || varEtiket)) return null
  const mk = /\bdis ?mekan/.test(t) && !/\bic ?mekan/.test(t) ? 'dis' : /\bic ?mekan/.test(t) && !/\bdis ?mekan/.test(t) ? 'ic' : 'hepsi'
  if (varHm && /\bkg\b|kilo|agirlik|ton\b|kac|ne kadar/.test(t) && (/mekan/.test(t) || /urun|mamul|saksi/.test(t)) && /stok|stog|elimde|kalan|depoda/.test(t) && !/kullan|tuket|sarf|sat(mis|tim|ti|is|ilan|tik)|satis/.test(t)) return { tur: 'stok_kg', mekan: mk as Mekan }
  if (/sat(mis|tim|ti|is|ilan|tik)|satis|ciro|musteri|tahsilat|bakiye|borc|kdv|fatura|recete|maliyet|fiyat|teklif|alis|alin|siparis|tedarik|firma|ihracat|uretim|kullan|tuket|sarf/.test(t)) return null
  if (/koli ?(ici|m3|hacim|olcu|agirlik|kg\b)|konteyner|adet ?\/ ?koli|kolide/.test(t)) return null
  if (kodlar.length && !/stok|stog|kac|var mi|kalan|elimde/.test(t)) return null
  if (!/neler|nelerim|stok|stog|kalan|elimde|var mi|kac|ne kadar|liste|excel|durum|depo|mevcut|goster|ver\b/.test(t)) return null
  const grup: HmGrup = (varHm ? 1 : 0) + (varBoya ? 1 : 0) + (varKoli ? 1 : 0) + (varEtiket ? 1 : 0) > 1 ? 'hepsi' : varBoya ? 'boya' : varKoli ? 'koli' : varEtiket ? 'etiket' : 'hammadde'
  // Arama: gruba ait olmayan, ayırt edici kelimeler (renk / ürün adı / kod no) — "yeşil boya", "line koli", "polo koli"
  const GEN = /^(kald\w*|hammadde\w*|ham|madde\w*|boya\w*|koli\w*|etiket\w*|ambalaj\w*|stok\w*|stog\w*|neler\w*|nedir|ne|kadar|kac\w*|var|mi|mu|kalan|elimde\w*|liste\w*|excel\w*|durum\w*|depo\w*|mevcut|goster\w*|ver|bana|bu|su|tum\w*|hepsi\w*|icin|ile|ve|bir|kg|adet|simdi|su an|an|olan|bizim|benim|tl|karton|masterbatch|kont|aly-?\w*|alyg-?\w*)$/
  const ara = t.split(' ').filter(w => w.length >= 2 && !GEN.test(w) && !/^a[yl]{2,3}g?-?\d/.test(w)).join(' ')
  const num = kodlar.map(k => k.replace(/^ALYG?-/, '').replace(/\D+$/, ''))
  return { tur: 'hm_stok', grup, arama: [ara, ...num].filter(Boolean).join(' ') }
}

const URUN_AD_DURAK =/^(satis\w*|sat\w*|musteri\w*|detay\w*|excel\w*|ver\w*|bana|ne|kadar|kac|adet\w*|ciro\w*|liste\w*|tum\w*|icin|ile|ve|bir|olarak|tl|hangi|goster\w*|cikar\w*|lazim|isterim|ister\w*|rapor\w*|dokum\w*|toplam\w*|aylik|yillik|bu|yil|ekim|2026|nin|nun|ait)$/
/** Satış dosyasındaki ürün adlarından, soruda geçen ürün adına uyan ana kodları bulur ("line saksı" → ALY-421…424). Emin değilse boş döner. */
async function urunAdindanKodlar(sb: SupabaseClient, arama: string): Promise<string[]> {
  const rows = await sayfala(sb, 'satis_adetleri', 'kod,ad')
  const urunler = new Map<string, string>()
  for (const x of rows) { const k = anaKod(x.kod); if (k && !urunler.has(k)) urunler.set(k, nrm(String(x.ad || '').replace(/^\s*ALYG?\s*-?\s*[\dA-Z/]+\s+/i, ''))) }
  const tum = [...urunler.values()]
  // "cornet ve efes saksı": ürün serileri "ve"/"," ile ayrılırsa her seri ayrı eşleşir, kodlar birleşir
  const gruplar = nrm(arama).split(/\s(?:ve|ile)\s|,/).map(g => g.trim()).filter(Boolean)
  const ortak = gruplar.length > 1 ? (gruplar[gruplar.length - 1].match(/\b(saksi\w*|sepet\w*|sandik\w*)\b/g) || []) : []
  const sonuc = new Set<string>()
  for (const g of gruplar.length ? gruplar : [arama]) {
    const kel = [...g.split(' '), ...(gruplar.length > 1 ? ortak : [])].filter(w => (w.length >= 3 || /^\d[a-z]$/.test(w)) && !URUN_AD_DURAK.test(w))
    const gecen = kel.filter(w => tum.some(ad => ad.split(' ').some(x => x.startsWith(w))))
    if (!gecen.length) continue
    const bulunan = [...urunler.entries()].filter(([, ad]) => gecen.every(w => ad.split(' ').some(x => x.startsWith(w)))).map(([k]) => k)
    // Çok geniş eşleşme (ör. sadece "saksı") yanlış rapor verir: belirsizse yapay zekaya bırak
    if (bulunan.length > 0 && bulunan.length <= 40 && gecen.some(w => !/^(saksi\w*|sepet\w*|sandik\w*|set\w*)$/.test(w))) bulunan.forEach(k => sonuc.add(k))
  }
  return [...sonuc].sort()
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

/* Muhasebe programındaki ürün adları (kod → ad). Panel/site adları farklı olabilir; raporlarda muhasebe adı esas. Listede olmayan kodda panel adı kalır. */
const MUH_AD: Record<string, string> = {
  'ALY-101': '3D SAKSI NO:1 0.70 LT', 'ALY-131': 'SOMON SAKSI NO:1 0,70 LT', 'ALY-201': 'VENÜS SAKSI NO:1 0.75 LT', 'ALY-221': 'VENÜS MENEKŞE SAKSI NO:1 0.43 LT',
  'ALY-333': 'DANTEL SEPET', 'ALY-334': 'MİNİ SEPET', 'ALY-341': 'ÖRGÜ SEPET', 'ALY-342': 'KAPAKLI SEPET', 'ALY-351': 'CASA NO:1',
  'ALY-405': 'KOZALAK SAKSI NO:1 0,75 LT', 'ALY-421': 'LİNE SAKSI NO:1 1,1 LT', 'ALY-501': 'AHŞAP DESENLİ SAKSI NO:1 0,50 LT',
  'ALY-511': 'KALE SAKSI NO:1 1,3 LT', 'ALY-601': 'UFO SAKSI NO:1 2 LT', 'ALY-641': 'TRİPOT SAKSI NO:1 0,70 LT', 'ALY-651': 'POLO SAKSI NO:1 2,2 LT',
  'ALY-700': 'MİNİ EFES SAKSI 28 LT', 'ALY-906': 'CORNET SAKSI NO:1 12 LT', 'ALY-955': "ÖRDEK SAKSI 4'LÜ SET",
  'ALYG-01': 'ÇEŞME (YUVARLAK) SAKSI NO:1 28 LT', 'ALYG-02': 'ÇEŞME (YUVARLAK) SAKSI NO:2 70 LT', 'ALYG-03': 'ÇEŞME (YUVARLAK) SAKSI NO:3 130 LT', 'ALYG-04': 'ÇEŞME (YUVARLAK) SAKSI NO:4 310 LT',
  'ALYG-05': 'KEMER (KARE) SAKSI NO:1 35 LT', 'ALYG-06': 'KEMER (KARE) SAKSI NO:2 75 LT', 'ALYG-07': 'MİLAS (DİKDÖRTGEN) SAKSI NO:1 90 LT', 'ALYG-08': 'MİLAS (DİKDÖRTGEN) SAKSI NO:2 225 LT',
  'ALYG-09': 'DATÇA (AÇILI) SAKSI NO:1 55 LT', 'ALYG-10': 'DATÇA (AÇILI) SAKSI NO:2 99 LT', 'ALYG-11': 'KÖŞK (DİKDÖRTGEN) SAKSI', 'ALYG-12': 'ARAJMAN SAKSI NO:1 20 LT',
  'ALYG-13': 'ARAJMAN SAKSI NO:2 50 LT', 'ALYG-14': 'ARAJMAN SAKSI NO:3 73 LT', 'ALYG-15': 'ARAJMAN SAKSI NO:4 200 LT', 'ALYG-16': 'GONDOL SAKSI NO:1 28 LT', 'ALYG-17': 'GONDOL SAKSI NO:2 60 LT',
  // Panelde tek kodla tanımlı, muhasebede başka kodlarla (ALY-10/xx, 231-232, 409-411, 121-122, 20/xx) kayıtlı ürünler
  'ALY-110': 'KORDON AYAKLI SAKSI', 'ALY-900': 'GÜVEÇ AYAKLI SAKSI', 'ALY-212': 'KOZALAK KRİSTAL SAKSI', 'ALY-441': 'VENÜS ASKILI BALKON SAKSI', 'ALY-555': 'KOZALAK KAKTÜS SAKSI',
  'ALY-711': '3D KİRLİ ÇAMAŞIR SEPETİ', 'ALY-2002': '3D ÇAMAŞIR SELESİ', 'ALY-2003': '3D ÇÖP KOVASI', 'ALY-2004': '3D DETERJANLIK', 'ALY-2005': '3D KLOZET FIRÇASI', 'ALY-2006': "3D 5'Lİ BANYO SETİ",
  'ALYG-18': 'ARMUT SAKSI 165 LT', 'ALYG-19': 'VİTRİN SAKSI NO:1 110 LT', 'ALYG-20': 'VİTRİN SAKSI NO:2 200 LT', 'ALYG-21': 'TURUVA SAKSI 54 LT', 'ALYG-22': 'ÇİT SAKSI', 'ALYG-24': 'LOTTE SAKSI',
}
const muhAd = (kod: string, ad: string) => MUH_AD[String(kod || '').toUpperCase()] || ad

/* ─────────────── Mamul stok (iç / dış mekan) ─────────────── */
async function stok(sb: SupabaseClient, mekan: Mekan): Promise<Sonuc> {
  const j = json(await hamCalistir(() => araciCalistir(sb, 'stok_durumu', { tur: 'mamul', ...(mekan !== 'hepsi' ? { mekan } : {}) })))
  const SANDIK: Record<string, [string, string]> = { 'sandik no 1': ['ALY-300', 'SANDIK NO:1'], 'sandik no 2': ['ALY-301', 'SANDIK NO:2'], 'sandik no 3': ['ALY-302', 'SANDIK NO:3'], 'sandik 3 lu set': ['ALY-303', 'SANDIK 3 LÜ SET'], 'sandik no 1 eko': ['ALY-310', 'SANDIK NO:1 EKO'], 'sandik no 2 eko': ['ALY-311', 'SANDIK NO:2 EKO'], 'sandik no 3 eko': ['ALY-312', 'SANDIK NO:3 EKO'], 'sandik 3 lu set eko': ['ALY-313', 'SANDIK 3 LÜ SET EKO'] }
  const urunler: any[] = []
  for (const u0 of (j.mamul?.urunler || []) as any[]) {
    const u = { ...u0, urun: muhAd(u0.kod, u0.urun) }
    if (String(u.kod).toUpperCase() !== 'ALY-502') { urunler.push(u); continue }
    // Panelde sandıklar ALY-502 altında varyant; muhasebede kendi kodlarıyla (ALY-300…313) ayrı ürün
    const kalan: any[] = []
    for (const v of (u.varyantlar || [])) {
      const e = SANDIK[nrm(String(v.ad))]
      if (e) urunler.push({ ...u, kod: e[0], urun: e[1], toplam_adet: +v.adet || 0, varyantlar: [{ ad: e[1], adet: +v.adet || 0 }] })
      else kalan.push(v)
    }
    if (kalan.length) urunler.push({ ...u, toplam_adet: kalan.reduce((t, x) => t + (+x.adet || 0), 0), varyantlar: kalan })
  }
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
    { ad: 'Ürün Stok', sutunlar: ['Sıra', 'Ürün Kodu', 'Ürün', 'Mekan', 'Varyant sayısı', 'Toplam Adet', 'Pay %'], satirlar: urunSat },
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
    Promise.all(kodlar.map(k => sayfala(sb, 'satis_cari', 'ay,cari_adi,kod,adet,tutar,ihracat', q => q.ilike('kod', k + '%')).catch(() => []))),
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
  // Müşteri × ürün özeti ve müşteri/ürün/ay detayı (onaylı düzen: müşteri tutara göre azalan, ürün başına adet sütunu, toplam satırı)
  const pv: Record<string, { ih: boolean; a: Record<string, number>; t: number; ia: number; it: number; ay: Set<number> }> = {}
  const dm = new Map<string, { cari: string; ih: boolean; kod: string; ay: number; a: number; t: number }>()
  kodlar.forEach((kod, i) => {
    for (const x of ms[i] as any[]) {
      if (!kodEslesir(x.kod, kod)) continue
      const a = +x.adet || 0, t = +x.tutar || 0, p = pv[x.cari_adi] = pv[x.cari_adi] || { ih: false, a: {}, t: 0, ia: 0, it: 0, ay: new Set<number>() }
      p.ih = p.ih || !!x.ihracat; p.a[kod] = (p.a[kod] || 0) + a; p.t += t; p.ay.add(+x.ay); if (a < 0 || t < 0) { p.ia += a; p.it += t }
      const key = `${x.cari_adi}|${String(x.kod).toUpperCase()}|${x.ay}`, d = dm.get(key) || { cari: x.cari_adi, ih: !!x.ihracat, kod: String(x.kod).toUpperCase(), ay: +x.ay, a: 0, t: 0 }
      d.a += a; d.t += t; dm.set(key, d)
    }
  })
  const pvSirali = Object.entries(pv).sort((a, b) => b[1].t - a[1].t), pvT = pvSirali.reduce((s, [, v]) => s + v.t, 0)
  const musOz: Hucre[][] = pvSirali.map(([m, v]) => [m, v.ih ? 'İhracat' : 'İç piyasa', ...kodlar.map(k => r2(v.a[k] || 0)), r2(Object.values(v.a).reduce((s, x) => s + x, 0)), r2(v.t), pvT ? r2(v.t / pvT * 100) : 0, r2(v.ia), r2(v.it), v.ay.size])
  if (musOz.length) musOz.push(['TOPLAM', '', ...kodlar.map(k => r2(pvSirali.reduce((s, [, v]) => s + (v.a[k] || 0), 0))), r2(pvSirali.reduce((s, [, v]) => s + Object.values(v.a).reduce((q, x) => q + x, 0), 0)), r2(pvT), 100, r2(pvSirali.reduce((s, [, v]) => s + v.ia, 0)), r2(pvSirali.reduce((s, [, v]) => s + v.it, 0)), null])
  const musDetay: Hucre[][] = [...dm.values()].sort((a, b) => a.cari.localeCompare(b.cari, 'tr') || a.kod.localeCompare(b.kod) || a.ay - b.ay).map(d => [d.cari, d.ih ? 'İhracat' : 'İç piyasa', d.kod, AYLAR[d.ay - 1] || String(d.ay), r2(d.a), r2(d.t), d.a ? r2(d.t / d.a) : 0])
  if (ozet.length > 1) ozet.push(['', 'TOPLAM', '', r2(gAdet), gAdet ? r2(gTutar / gAdet) : 0, r2(gTutar), '', '', null])
  const sayfalar: Sayfa[] = [
    { ad: 'Özet', sutunlar: ['Ürün Kodu', 'Ürün', 'Mekan', 'Satılan Adet', 'Birim Fiyat (TL)', 'Tutar (TL)', 'İlk Satış Ayı', 'Son Satış Ayı', 'Güncel Stok (adet)'], satirlar: ozet },
    { ad: 'Aylık Adet', sutunlar: ['Ürün Kodu', 'Ürün', ...aySut, 'Toplam'], satirlar: aAdet },
    { ad: 'Aylık Tutar', sutunlar: ['Ürün Kodu', 'Ürün', ...aySut, 'Toplam (TL)'], satirlar: aTutar },
  ]
  if (renk.length > aAdet.length) sayfalar.push({ ad: 'Renk Kırılımı', sutunlar: ['Kod', 'Ürün', 'Renk', 'Adet', 'Birim Fiyat (TL)', 'Tutar (TL)'], satirlar: renk })
  if (musOz.length) sayfalar.push({ ad: 'Müşteri Özeti', sutunlar: ['Müşteri', 'Tür', ...kodlar.map(k => `${k} Adet`), 'Toplam Adet', 'Toplam Tutar (TL)', 'Pay %', 'İade Adet', 'İade TL', 'Sipariş Ayı Sayısı'], satirlar: musOz })
  if (musDetay.length) sayfalar.push({ ad: 'Müşteri Aylık Detay', sutunlar: ['Müşteri', 'Tür', 'Kod', 'Ay', 'Net Adet', 'Net Tutar (TL)', 'Birim Fiyat (TL)'], satirlar: musDetay })
  if (ozet.length > 1) govde.push('', `GENEL TOPLAM: ${AD(gAdet)} adet — ${TL(gTutar)} TL`)
  if (mus.length) { govde.push('', 'EN ÇOK ALAN MÜŞTERİLER:'); mus.slice(0, 8).forEach((m, i) => govde.push(`${i + 1}. ${m[0]} · ${m[1]}: ${AD(+(m[2] as number))} adet — ${TL(+(m[3] as number))} TL`)) }
  if (bulunamayan.length) govde.push('', `Satış kaydı bulunamayan kod: ${bulunamayan.join(', ')}`)
  govde.push('', `Not: Satış dosyası ${AYLAR[sonAy - 1]} ayına kadardır (KDV hariç, iadeler düşülmüş değil; iade ayrı sütunda).`)
  return bitir(sb, `Ürün satış ${kodlar.join(' ')}`, sayfalar, govde, ['rapor_urun_satis'])
}

/* ─────────────── Hammadde / boya / koli / etiket DEPO stoğu ─────────────── */
function hmGrupu(h: { kod: string; ad: string }): HmGrup | 'diger' {
  const k = String(h.kod || '').replace(/\s+/g, '').toUpperCase(), a = nrm(h.ad)
  if (k.startsWith('15002') || /kont boya|kod boya|masterbatch/.test(a) || k === 'HM-BOYA') return 'boya'
  if (k.startsWith('15001') || /^HM-/.test(k)) return 'hammadde'
  if (k.startsWith('73001') || k === 'AM-KOLI') return 'koli'
  if (k.startsWith('7304') || k.startsWith('7305') || k === 'AM-ETIKET') return 'etiket'
  return 'diger' // streç, poşet, koli bandı
}
const HM_NOT: Record<string, string> = {
  'HM-PP': 'Moblen (PP) — muhasebe stok kartı kalan miktarı (29.10.2026: 91.400 kg)',
  'HM-ROTASYON': 'Eksi bakiye: giriş (alış) kaydı eksik, sayım gerekir',
  '730 04': 'Etiket alış toplamı (genel), tek tek etiket stoğu değil — toplama katılmadı',
  'AM-ETIKET': 'Genel etiket sayacı, ürün bazında stok değil — toplama katılmadı',
}
const HM_TOPLAMA_DISI = new Set(['730 04', 'AM-ETIKET'])
async function hmStok(sb: SupabaseClient, grup: HmGrup, arama: string): Promise<Sonuc | null> {
  const rows = (await sayfala(sb, 'hammaddeler', 'kod,ad,birim,mevcut_stok,min_stok,aktif,kullanim,ortalama_maliyet')) as any[]
  const kel = nrm(arama).split(' ').filter(Boolean)
  const eslesir = (h: any) => kel.every(w => /^\d+$/.test(w) ? String(h.kod).replace(/\s+/g, '').endsWith(w) : nrm(h.ad + ' ' + h.kod).split(' ').some(x => x.startsWith(w)))
  const hepsi = rows.filter(h => h.aktif !== false && eslesir(h)).map(h => ({ ...h, g: hmGrupu(h), stok: +h.mevcut_stok || 0, kul: h.kullanim === 'kullanilmiyor' }))
  const secili = hepsi.filter(h => grup === 'hepsi' || h.g === grup || (grup === 'etiket' && h.g === 'diger'))
  if (!secili.length) return null
  const BASLIK: Record<string, string> = { hammadde: 'Hammadde', boya: 'Boya (kont/masterbatch)', koli: 'Koli', etiket: 'Etiket ve diğer ambalaj', diger: 'Streç / poşet / bant' }
  const gruplar = (['hammadde', 'boya', 'koli', 'etiket', 'diger'] as const).filter(g => secili.some(h => h.g === g))
  const topla = (l: any[]) => r2(l.filter(h => !h.kul && !HM_TOPLAMA_DISI.has(String(h.kod))).reduce((t, h) => t + h.stok, 0))
  const siraGrup = (l: any[]) => [...l].sort((a, b) => Number(a.kul) - Number(b.kul) || b.stok - a.stok || String(a.ad).localeCompare(String(b.ad), 'tr'))
  const satirlar = (l: any[]): Hucre[][] => siraGrup(l).map((h, i) => [i + 1, h.kod, h.ad, h.birim, h.stok, h.kul ? 'Kullanılmıyor (eski kalan)' : h.stok < 0 ? 'EKSİ stok' : h.stok === 0 ? 'Stok yok' : 'Var', HM_NOT[String(h.kod)] || ''])
  const sut = ['Sıra', 'Kod', 'Ad', 'Birim', 'Stok', 'Durum', 'Not']
  const sayfalar: Sayfa[] = [{ ad: 'Özet', sutunlar: ['Grup', 'Kalem sayısı', 'Stoklu kalem', 'Toplam stok', 'Birim', 'Not'], satirlar: gruplar.map(g => {
    const l = secili.filter(h => h.g === g)
    return [BASLIK[g], l.length, l.filter(h => h.stok > 0).length, topla(l), g === 'hammadde' || g === 'boya' ? 'kg' : 'adet', 'Kullanılmayan ve toplama dahil olmayan satırlar hariç']
  }) }]
  for (const g of gruplar) sayfalar.push({ ad: BASLIK[g].replace(/[^A-Za-zÇĞİÖŞÜçğıöşü ]/g, '').slice(0, 28).trim(), sutunlar: sut, satirlar: satirlar(secili.filter(h => h.g === g)) })
  const govde = [`HAMMADDE / BOYA / KOLİ / ETİKET DEPO STOĞU (${bugunISO()})${arama ? ` — "${arama}"` : ''}`, '']
  for (const g of gruplar) {
    const l = secili.filter(h => h.g === g), br = g === 'hammadde' || g === 'boya' ? 'kg' : 'adet', st = l.filter(h => h.stok > 0 && !h.kul)
    govde.push(`${BASLIK[g].toUpperCase()}: ${AD(topla(l))} ${br} (${st.length} kalemde stok var, ${l.length} kalem)`)
    siraGrup(l).filter(h => h.stok !== 0 && !h.kul).slice(0, g === 'hammadde' ? 12 : 8).forEach((h, i) => govde.push(`${i + 1}. ${h.ad}: ${h.stok.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${h.birim}${HM_NOT[String(h.kod)] ? ' ⚠ ' + HM_NOT[String(h.kod)] : ''}`))
    if (st.length > (g === 'hammadde' ? 12 : 8)) govde.push(`… ${st.length - (g === 'hammadde' ? 12 : 8)} kalem daha (Excel'de)`)
    const kl = l.filter(h => h.kul && h.stok > 0); if (kl.length) govde.push(`Üretimde kullanılmayan eski kalan: ${kl.length} kalem, ${AD(kl.reduce((t, h) => t + h.stok, 0))} ${br} (toplama dahil değil)`)
    govde.push('')
  }
  return bitir(sb, `Hammadde boya koli etiket stok${arama ? ' ' + arama : ''}`, sayfalar, govde.slice(0, -1), ['rapor_hammadde_stok'])
}

/** Eldeki mamul stoğun hammadde ağırlığı: stok adedi × ürün reçete gramajı. */
async function stokKg(sb: SupabaseClient, mekan: Mekan): Promise<Sonuc | null> {
  const [ps, vs, rs] = await Promise.all([sayfala(sb, 'products', 'id,name,code,mekan'), sayfala(sb, 'product_variants', 'product_id,stock'), sayfala(sb, 'urun_receteleri', 'id,urun_id,aktif')])
  const rk = await sayfala(sb, 'recete_kalemleri', 'recete_id,miktar')
  const kgR = new Map<string, number>(); for (const k of rk) kgR.set(k.recete_id, (kgR.get(k.recete_id) || 0) + (+k.miktar || 0))
  const gr = new Map<string, number[]>(); for (const r of rs.filter((x: any) => x.aktif !== false)) { const kg = kgR.get(r.id) || 0; if (kg > 0) gr.set(r.urun_id, [...(gr.get(r.urun_id) || []), kg]) }
  const st = new Map<string, number>(); for (const v of vs) st.set(v.product_id, (st.get(v.product_id) || 0) + (+v.stock || 0))
  const satir = ps.filter((p: any) => (mekan === 'hepsi' || p.mekan === mekan) && (st.get(p.id) || 0) !== 0).map((p: any) => {
    const g = gr.get(p.id) || [], ort = g.length ? g.reduce((t, x) => t + x, 0) / g.length : 0, adet = st.get(p.id) || 0
    return { kod: p.code, ad: muhAd(p.code, p.name), mekan: p.mekan, adet, gramaj: r2(ort), kg: r2(adet * ort), coklu: g.length > 1, yok: !g.length }
  }).sort((a: any, b: any) => b.kg - a.kg)
  if (!satir.length) return null
  const adet = satir.reduce((t: number, x: any) => t + x.adet, 0), kg = satir.reduce((t: number, x: any) => t + x.kg, 0), yok = satir.filter((x: any) => x.yok), coklu = satir.filter((x: any) => x.coklu)
  const ad = mekan === 'hepsi' ? 'İç + dış mekan' : mekanAd(mekan)
  const sayfalar: Sayfa[] = [
    { ad: 'Özet', sutunlar: ['Alan', 'Değer'], satirlar: [['Kapsam', ad], ['Stoklu ürün sayısı', satir.length], ['Toplam stok (adet)', adet], ['Stoktaki ürünlerin hammadde ağırlığı (kg)', r2(kg)], ['Ton', r2(kg / 1000)], ['Gramajı tanımsız ürün', yok.length], ['Birden çok reçeteli (ortalama gramaj) ürün', coklu.length], ['Hesap', 'stok adedi × ürün reçete gramajı (kg/adet)'], ['Rapor tarihi', bugunISO()]] },
    { ad: 'Ürün Detay', sutunlar: ['Sıra', 'Kod', 'Ürün', 'Mekan', 'Stok adet', 'Gramaj kg/adet', 'Hammadde kg', 'Not'], satirlar: [...satir.map((x: any, i: number) => [i + 1, x.kod, x.ad, mekanAd(x.mekan), x.adet, x.gramaj || null, x.kg, x.yok ? 'Gramaj tanımsız' : x.coklu ? 'Birden çok reçete: ortalama gramaj' : '']), ['', '', 'TOPLAM', '', adet, null, r2(kg), '']] },
  ]
  const govde = [`${ad.toUpperCase()} STOĞUNDAKİ ÜRÜNLERİN HAMMADDESİ (${bugunISO()}) — ${AD(adet)} adet stok → ${TL(kg)} kg (${TL(kg / 1000)} ton) hammadde`, '', 'Hesap: stok adedi × ürün reçete gramajı.']
  satir.slice(0, 8).forEach((x: any, i: number) => govde.push(`${i + 1}. ${x.ad}: ${AD(x.adet)} adet × ${x.gramaj} kg = ${TL(x.kg)} kg`))
  if (yok.length) govde.push('', `Dikkat: ${yok.length} üründe gramaj tanımsız, hesaba katılmadı.`)
  if (coklu.length) govde.push('', `Not: ${coklu.length} ürünün birden çok boyutu/reçetesi var, ortalama gramaj kullanıldı (yaklaşık).`)
  return bitir(sb, `${ad} stok hammadde ağırlığı`, sayfalar, govde, ['rapor_stok_hammadde'])
}

const TIPAD: Record<string, string> = { satinalma: 'Satın alma', uretim_cikis: 'Üretim çıkışı', uretim_giris: 'Üretim girişi', sevkiyat: 'Sevkiyat', sayim: 'Sayım / devir', manuel_duzeltme: 'Manuel düzeltme', iade: 'İade', fire: 'Fire', satis: 'Satış' }
const hmCari = (ac: string) => { const m = /^Muhasebe stok kartı \([^)]*\) - (.*)$/.exec(String(ac || '')); return (m ? m[1] : String(ac || '')).split(' | ')[0].trim() }
async function hmAlis(sb: SupabaseClient, arama: string, hareketMi: boolean): Promise<Sonuc | null> {
  const hm = (await sayfala(sb, 'hammaddeler', 'id,kod,ad,birim,mevcut_stok')) as any[]
  const kel = nrm(arama).split(' ').filter(Boolean)
  const hedef = hm.filter(h => !kel.length || kel.every(w => nrm(h.ad + ' ' + h.kod).split(' ').some(x => x.startsWith(w))))
  const idler = new Map(hedef.map(h => [h.id, h]))
  const hr = (await sayfala(sb, 'stok_hareketleri', 'hammadde_id,tarih,tip,yon,miktar,birim_maliyet,aciklama')).filter((x: any) => idler.has(x.hammadde_id))
  if (!hr.length) return null
  hr.sort((a: any, b: any) => String(a.tarih).localeCompare(String(b.tarih)))
  const alislar = hr.filter((x: any) => x.tip === 'satinalma' && x.yon === 'giris')
  const tut = (x: any) => (+x.miktar || 0) * (+x.birim_maliyet || 0)
  const adlar = [...new Set(hr.map((x: any) => idler.get(x.hammadde_id).ad))]
  const tek = adlar.length === 1
  // Cari bazlı özet
  const cm = new Map<string, { n: number; kg: number; tl: number; fyKg: number }>()
  for (const x of alislar) { const c = hmCari(x.aciklama) || '—', o = cm.get(c) || { n: 0, kg: 0, tl: 0, fyKg: 0 }; o.n++; o.kg += +x.miktar || 0; o.tl += tut(x); o.fyKg += +x.birim_maliyet > 0 ? +x.miktar || 0 : 0; cm.set(c, o) }
  const topKg = alislar.reduce((t: number, x: any) => t + (+x.miktar || 0), 0), topTl = alislar.reduce((t: number, x: any) => t + tut(x), 0), fyKg = alislar.filter((x: any) => +x.birim_maliyet > 0).reduce((t: number, x: any) => t + (+x.miktar || 0), 0)
  const bak = new Map<string, number>()
  const hrk: Hucre[][] = hr.map((x: any) => { const ad = idler.get(x.hammadde_id).ad, d = (x.yon === 'giris' ? 1 : -1) * (+x.miktar || 0), b = r2((bak.get(ad) || 0) + d); bak.set(ad, b); return [String(x.tarih).slice(0, 10), ad, TIPAD[x.tip] || x.tip, hmCari(x.aciklama), x.yon === 'giris' ? +x.miktar || 0 : null, x.yon === 'cikis' ? +x.miktar || 0 : null, +x.birim_maliyet > 0 ? +x.birim_maliyet : null, +x.birim_maliyet > 0 ? r2(tut(x)) : null, b, String(x.aciklama || '')] })
  const sayfalar: Sayfa[] = [
    { ad: 'Özet', sutunlar: ['Alan', 'Değer'], satirlar: [['Hammadde', tek ? adlar[0] : `${adlar.length} kalem`], ['Alış (satın alma) sayısı', alislar.length], ['Toplam alınan miktar (kg)', r2(topKg)], ['Fiyatlı alışların tutarı (TL, KDV hariç)', r2(topTl)], ['Fiyatlı alışlarda ort. birim fiyat (TL/kg)', fyKg ? r2(topTl / fyKg) : 0], ['Fiyatsız alış (ödünç/numune vb.) kg', r2(topKg - fyKg)], ['Güncel stok (kg)', r2(hedef.filter(h => hr.some((x: any) => x.hammadde_id === h.id)).reduce((t, h) => t + (+h.mevcut_stok || 0), 0))], ['Rapor tarihi', bugunISO()]] },
    { ad: 'Cari Bazlı Alışlar', sutunlar: ['Cari / Kaynak', 'Alış sayısı', 'Miktar kg', 'Tutar TL', 'Ort. fiyat TL/kg'], satirlar: [...cm.entries()].sort((a, b) => b[1].kg - a[1].kg).map(([c, o]) => [c, o.n, r2(o.kg), r2(o.tl), o.fyKg ? r2(o.tl / o.fyKg) : null]) },
    { ad: 'Alışlar', sutunlar: ['Tarih', 'Hammadde', 'Cari / Kaynak', 'Miktar kg', 'Birim fiyat TL', 'Tutar TL', 'Açıklama'], satirlar: alislar.map((x: any) => [String(x.tarih).slice(0, 10), idler.get(x.hammadde_id).ad, hmCari(x.aciklama), +x.miktar || 0, +x.birim_maliyet > 0 ? +x.birim_maliyet : null, +x.birim_maliyet > 0 ? r2(tut(x)) : null, String(x.aciklama || '')]) },
    { ad: 'Tüm Stok Hareketleri', sutunlar: ['Tarih', 'Hammadde', 'Hareket', 'Cari / Kaynak', 'Giren kg', 'Çıkan kg', 'Birim fiyat TL', 'Tutar TL', 'Kalan stok kg', 'Açıklama'], satirlar: hrk },
  ]
  const govde = [`${tek ? adlar[0].toUpperCase() : 'HAMMADDE'} ${hareketMi ? 'STOK HAREKETLERİ' : 'ALIŞLARI'} (${bugunISO()})`, '', `Alış: ${alislar.length} kayıt, ${AD(topKg)} kg · fiyatlı kısım ${TL(topTl)} TL (ort. ${fyKg ? TL(topTl / fyKg) : '—'} TL/kg)`]
  for (const [c, o] of [...cm.entries()].sort((a, b) => b[1].kg - a[1].kg).slice(0, 8)) govde.push(`• ${c}: ${AD(o.kg)} kg${o.fyKg ? ` · ${TL(o.tl)} TL` : ' · fiyatsız (ödünç/numune)'}`)
  const alisBaslik = alislar.length - fyKg > 0 && alislar.some((x: any) => !(+x.birim_maliyet > 0)) ? 'Not: fiyatsız girişler ödünç/numune olabilir, tutara katılmadı.' : ''
  if (alisBaslik) govde.push('', alisBaslik)
  return bitir(sb, `${tek ? adlar[0] : 'Hammadde'} ${hareketMi ? 'stok hareketleri' : 'alışları'}`, sayfalar, govde, ['rapor_hammadde_alis'])
}

/* ─────────────── Boya kullanımı (iç mekan, satılan ürünlerin hammaddesi × oran) ─────────────── */
async function boyaStok(sb: SupabaseClient, oran: number): Promise<Sonuc> {
  const [ps, rs, rk, ge, st] = await Promise.all([sayfala(sb, 'products', 'id,code'), sayfala(sb, 'urun_receteleri', 'id,urun_id,aktif,notlar'), sayfala(sb, 'recete_kalemleri', 'recete_id,miktar'), sayfala(sb, 'gramaj_ek', 'kod,kg'), sayfala(sb, 'satis_kod_stok', 'kod,ad,stok,mekan')])
  const kod = new Map<string, string>(ps.map((p: any) => [p.id, p.code])), kgR = new Map<string, number>()
  for (const k of rk) kgR.set(k.recete_id, (kgR.get(k.recete_id) || 0) + (+k.miktar || 0))
  const gl = new Map<string, number[]>()
  for (const r of rs.filter((x: any) => x.aktif !== false)) { const kg = kgR.get(r.id) || 0; if (kg <= 0) continue; const k = /\[([^\]]+)\]/.exec(r.notlar || '')?.[1] || kod.get(r.urun_id); if (k) gl.set(k, [...(gl.get(k) || []), kg]) }
  const gr = new Map<string, number>(); for (const [k, v] of gl) gr.set(k, v.reduce((a, b) => a + b, 0) / v.length)
  for (const g of ge) if (!gr.has(g.kod) && +g.kg > 0) gr.set(g.kod, +g.kg)
  const satir = st.filter((x: any) => x.mekan === 'ic' && +x.stok !== 0).map((x: any) => { const g = gr.get(x.kod) ?? gr.get(String(x.kod).replace(/[A-ZÇĞİÖŞÜ]+$/, '')) ?? 0, adet = +x.stok || 0; return { kod: x.kod, ad: x.ad, adet, g, hm: adet * g } })
  if (!satir.length) return { yanit: 'İç mekan stoğu bulunamadı.', araclar: ['rapor_boya_stok'] }
  satir.sort((a: any, b: any) => b.hm - a.hm)
  const adet = satir.reduce((t: number, x: any) => t + x.adet, 0), kg = satir.reduce((t: number, x: any) => t + x.hm, 0), boya = kg * oran, yp = r2(oran * 100), yok = satir.filter((x: any) => !x.g)
  const sayfalar: Sayfa[] = [
    { ad: 'Özet', sutunlar: ['Alan', 'Değer'], satirlar: [['Kapsam', 'İç mekan depo stoğu (dış mekanda boya kullanılmaz)'], ['Stok (adet)', adet], ['Boya oranı', `%${yp} (hammadde ağırlığının)`], ['Hesap', 'stok adedi × ürün gramajı = hammadde kg; hammadde kg × oran = boya kg'], ['Toplam hammadde (kg)', r2(kg)], ['Hesaplanan boya (kg)', r2(boya)], ['Boya (ton)', r2(boya / 1000)], ['Gramajı tanımsız stok (adet)', yok.reduce((t: number, x: any) => t + x.adet, 0)], ['Rapor tarihi', bugunISO()], ['Not', 'Tahmini hesaptır; satış bazlı değil, depodaki ürünlere göredir.']] },
    { ad: 'Ürün Detay', sutunlar: ['Sıra', 'Kod', 'Ürün', 'Stok adet', 'Gramaj (kg/adet)', 'Hammadde (kg)', `Boya kg (%${yp})`], satirlar: [...satir.map((x: any, i: number) => [i + 1, x.kod, x.ad, x.adet, x.g ? r2(x.g) : null, r2(x.hm), r2(x.hm * oran)]), ['', '', 'TOPLAM', adet, null, r2(kg), r2(boya)]] },
  ]
  const govde = [`İÇ MEKAN STOĞUNDAKİ ÜRÜNLERİN BOYASI (tahmini, %${yp}, ${bugunISO()})`, '', `${AD(adet)} adet stok → ${TL(kg)} kg hammadde → ${TL(boya)} kg (${TL(boya / 1000)} ton) boya`, 'Hesap: stok adedi × ürün gramajı × boya oranı. Satış bazlı değil, depodaki ürünlere göredir. Dış mekanda boya kullanılmaz.']
  satir.slice(0, 8).forEach((x: any, i: number) => govde.push(`${i + 1}. ${x.ad}: ${AD(x.adet)} adet → ${TL(x.hm * oran)} kg boya`))
  if (yok.length) govde.push('', `Dikkat: ${yok.length} üründe gramaj tanımsız, hesaba girmedi.`)
  return bitir(sb, `İç mekan stok boyası %${yp}`, sayfalar, govde, ['rapor_boya_stok'])
}

async function boyaKullanim(sb: SupabaseClient, mekan: Mekan, oran: number): Promise<Sonuc> {
  if (mekan === 'dis') return { yanit: 'Dış mekan ürünlerinde boya kullanılmıyor, bu yüzden dış mekan için boya hesabı yapmıyorum. İç mekan boya kullanımını sorabilirsiniz.', araclar: ['rapor_boya'] }
  const j = json(await hamCalistir(() => araciCalistir(sb, 'satis_hammadde', { mekan: 'ic' })))
  const ur = ((j.urunler || []) as any[]).filter(x => x.mekan === 'iç mekan').sort((a, b) => b.hammadde_kg - a.hammadde_kg), yok = ((j.gramaji_olmayan_urunler || []) as any[]).filter(x => x.mekan === 'iç mekan')
  const kg = ur.reduce((t, x) => t + x.hammadde_kg, 0), adet = ur.reduce((t, x) => t + x.adet, 0), boya = kg * oran, yp = r2(oran * 100)
  const sat: Hucre[][] = ur.map((x, i) => [i + 1, x.urun, x.adet, x.gramaj_kg, r2(x.hammadde_kg), r2(x.hammadde_kg * oran), kg ? r2(x.hammadde_kg / kg * 100) : 0])
  sat.push(['', 'TOPLAM', adet, null, r2(kg), r2(boya), 100])
  const sayfalar: Sayfa[] = [
    { ad: 'Özet', sutunlar: ['Alan', 'Değer'], satirlar: [['Kapsam', 'İç mekan (dış mekanda boya kullanılmaz)'], ['Dönem', String(j.donem || '')], ['Boya oranı', `%${yp} (hammadde ağırlığının)`], ['Hesap', 'satış adedi × ürün gramajı = hammadde kg; hammadde kg × oran = boya kg'], ['Gramajı olan satış (adet)', adet], ['Toplam hammadde (kg)', r2(kg)], ['Hesaplanan boya (kg)', r2(boya)], ['Boya (ton)', r2(boya / 1000)], ['Gramajı tanımsız satış (adet)', r2(yok.reduce((t, x) => t + (+x.adet || 0), 0))], ['Not', 'Tahmini hesaptır: gerçek boya kullanımı kayıtlı değil. Renk dağılımı satış kaydındaki ürün adından çıkarılamaz.']] },
    { ad: 'Ürün Detay', sutunlar: ['Sıra', 'Ürün', 'Satış adedi', 'Gramaj (kg/adet)', 'Hammadde (kg)', `Boya kg (%${yp})`, 'Hammadde payı %'], satirlar: sat },
  ]
  const govde = [`İÇ MEKAN BOYA KULLANIMI (tahmini, %${yp}) — ${j.donem}`, '', `${AD(adet)} adet satış → ${TL(kg)} kg hammadde → ${TL(boya)} kg (${TL(boya / 1000)} ton) boya`, 'Hesap: satış adedi × ürün gramajı × boya oranı. Dış mekanda boya kullanılmaz, dahil değildir.']
  ur.slice(0, 8).forEach((x, i) => govde.push(`${i + 1}. ${x.urun}: ${AD(x.adet)} adet → ${TL(x.hammadde_kg * oran)} kg boya`))
  if (yok.length) govde.push('', `Dikkat: ${yok.length} üründe gramaj tanımsız (${AD(yok.reduce((t, x) => t + (+x.adet || 0), 0))} adet), hesaba girmedi.`)
  govde.push('', 'Not: Tahmini hesaptır; gerçek boya kullanımı kayıtlı değildir.')
  return bitir(sb, `İç mekan boya kullanımı %${yp}`, sayfalar, govde, ['rapor_boya_kullanim'])
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
  else { const kel = arama.split(' ').filter(w => w.length >= 2); aday = kel.length ? cariEsle(cl, kel) : [] }
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
    cariler = cariEsle(allCl, kel)
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

/** Yapay zeka "excel_olustur(arac: cari_ekstre)" dediğinde ham döküm yerine onaylı ekstre Excel'i üretilsin. */
export async function ekstreYaniti(sb: SupabaseClient, arama: string): Promise<Sonuc | null> {
  const kod = /\b(120|320)\.\d{2}\.\d{3}[a-z]?\b/.exec(String(arama))?.[0] || ''
  const a = nrm(arama).replace(/\b(ekstre\w*|extre\w*|cari\w*|hesap\w*|excel\w*|ver|liste\w*)\b/g, ' ').replace(/\s+/g, ' ').trim()
  if (!kod && a.length < 2) return null
  try { return await ekstreRapor(sb, a, kod) } catch (e: any) { console.error('[ai-rapor] ekstreYaniti', e?.message); return null }
}

/** Sabit kalıplar (regex) soruyu tanımazsa: yapay zeka yalnızca "hangi hazır rapor?" diye sınıflandırır; rakamı/dosyayı yine sabit rapor üretir. */
async function niyetSinifla(soru: string): Promise<RaporNiyet | null> {
  const t = nrm(soru)
  if (!/excel|liste|rapor|ekstre|extre|fiyat|sat(mis|tim|ti|is)|tahsilat|alacak|bakiye|stok|kdv|ihracat|borc|k ?karti|\bpos\b|cari|hesap|dokum/.test(t) || t.split(' ').length > 40) return null
  const schema = { type: 'object', additionalProperties: false, required: ['tur', 'mekan', 'firma', 'urun_kodu', 'yil', 'ay'], properties: {
    tur: { type: 'string', enum: ['tahsilat', 'stok', 'satis', 'urun_satis', 'hammadde', 'ihracat_tahsilat', 'ihracat_rakam', 'kredi_karti', 'kdv', 'tedarikci_borc', 'cari_ekstre', 'urun_fiyat', 'yok'] },
    mekan: { type: 'string', enum: ['ic', 'dis', 'hepsi'] }, firma: { type: 'string' }, urun_kodu: { type: 'string' }, yil: { type: 'integer' }, ay: { type: 'integer' } } }
  const r = await aiJson<{ tur: string; mekan: Mekan; firma: string; urun_kodu: string; yil: number; ay: number }>([
    { role: 'system', content: `Sınıflandırıcısın. Kullanıcının sorusu şu hazır raporlardan birine uyuyorsa tur olarak onu seç, uymuyorsa "yok":
tahsilat = iç/dış mekan müşterilerinden tahsil edilecek (bakiyesi olan) cari listesi; stok = ürün/mamul stok listesi; satis = iç/dış mekan satış listesi (adet, tutar); urun_satis = tek ürün kodunun (ALY-xxx) toplam satışı;
hammadde = satışa göre hammadde kullanımı; ihracat_tahsilat = ihracat müşterilerinden alacak; ihracat_rakam = ihracat satış rakamı; kredi_karti = k.kartı/POS tahsilatları; kdv = aylık KDV/yüklenilen KDV/fatura listesi;
tedarikci_borc = tedarikçilere borçlarımız; cari_ekstre = TEK firmanın cari ekstresi/hesap dökümü/cari excel'i (firma alanına firma adını yaz); urun_fiyat = bir ürün kodunu (ALY-xxx) bir firmaya KAÇ TL birim fiyatla sattık (urun_kodu ve firma yaz).
Emin değilsen "yok". Alanlar bilinmiyorsa mekan="hepsi", metinler "", sayılar 0. Yazım hatalarını (extre=ekstre, brim=birim) tolere et. Bugün ${bugunISO()}.` },
    { role: 'user', content: veriBlok('soru', soru) }], 'rapor_niyeti', schema, { maxTokens: 150, timeoutMs: 12000 })
  const mk = r.mekan === 'ic' || r.mekan === 'dis' ? r.mekan : 'hepsi'
  const firma = nrm(r.firma || '').replace(/\b(firmasi\w*|musteri\w*|cari\w*)\b/g, ' ').replace(/\s+/g, ' ').trim()
  const kod = kodlariBul(r.urun_kodu || soru)
  switch (r.tur) {
    case 'tahsilat': return { tur: 'tahsilat', mekan: mk }
    case 'stok': return mk === 'hepsi' ? null : { tur: 'stok', mekan: mk }
    case 'satis': return mk === 'hepsi' ? null : { tur: 'satis', mekan: mk }
    case 'urun_satis': return kod.length ? { tur: 'urun', kodlar: kod } : { tur: 'urun_ad', arama: nrm(soru) }
    case 'hammadde': return { tur: 'hammadde', mekan: mk }
    case 'ihracat_tahsilat': return { tur: 'ihr_tahsilat' }
    case 'ihracat_rakam': return { tur: 'ihr_rakam', yil: r.yil > 2000 ? r.yil : +bugunISO().slice(0, 4) }
    case 'kredi_karti': return { tur: 'pos' }
    case 'kdv': return { tur: 'kdv', yil: r.yil > 2000 ? r.yil : +bugunISO().slice(0, 4), ay: r.ay >= 1 && r.ay <= 12 ? r.ay : +bugunISO().slice(5, 7) }
    case 'tedarikci_borc': return { tur: 'odeme' }
    case 'cari_ekstre': return firma.length >= 2 ? { tur: 'ekstre', arama: firma, kod: /\b(120|320)\.\d{2}\.\d{3}[a-z]?\b/.exec(soru)?.[0] || '' } : null
    case 'urun_fiyat': return kod.length ? { tur: 'fiyat', kod: kod[0], arama: firma } : null
    default: return null
  }
}

export async function detayliRapor(sb: SupabaseClient, soru: string, izinli: Set<string>): Promise<Sonuc | null> {
  let n = raporNiyeti(soru)
  if (!n) { try { n = await niyetSinifla(soru) } catch (e: any) { console.error('[ai-rapor] sinifla', e?.message) } }
  if (!n) return null
  const gerek: Record<RaporNiyet['tur'], string[]> = { tahsilat: ['cari_mekan_ekstre'], stok: ['stok_durumu'], satis: ['urun_satis', 'musteri_satis'], urun: ['urun_satis'], urun_ad: ['urun_satis'], hammadde: ['satis_hammadde'], hm_stok: [], hm_alis: [], stok_kg: [], boya_kullanim: [], boya_kg: [], ihr_tahsilat: ['ihracat_gecmis'], ihr_rakam: ['ihracat_gecmis'], pos: ['pos_bekleyen'], kdv: ['kdv_ozet'], odeme: ['cari_ara'], ekstre: [], fiyat: [] }
  if (n.tur === 'ekstre' ? !(izinli.has('cari_ara') || izinli.has('cari_ekstre') || izinli.has('cari_mekan_ekstre')) : !gerek[n.tur].every(a => izinli.has(a))) return null
  try {
    switch (n.tur) {
      case 'tahsilat': return await tahsilat(sb, n.mekan)
      case 'stok': return await stok(sb, n.mekan)
      case 'satis': return await satis(sb, n.mekan)
      case 'urun': return await urunSatis(sb, n.kodlar)
      case 'urun_ad': { const kk = await urunAdindanKodlar(sb, n.arama); return kk.length ? await urunSatis(sb, kk) : null }
      case 'hammadde': {
        // "4.451 adette kaç kg hammadde kullandın": soruda adet verilmiş ve bu adet eldeki stokla aynıysa, satış değil STOK ağırlığı kastedilmiştir
        const no = /(\d{1,3}(?:[.,]\d{3})+|\d{3,7})\s*adet/.exec(nrm(soru))?.[1]?.replace(/[.,]/g, '')
        if (no) {
          const [ps, vs] = await Promise.all([sayfala(sb, 'products', 'id,mekan'), sayfala(sb, 'product_variants', 'product_id,stock')])
          const tp = (m: string) => { const idler = new Set(ps.filter((p: any) => m === 'hepsi' || p.mekan === m).map((p: any) => p.id)); return vs.filter((v: any) => idler.has(v.product_id)).reduce((t: number, v: any) => t + (+v.stock || 0), 0) }
          const eslesen = (['dis', 'ic', 'hepsi'] as const).find(m => tp(m) === +no)
          if (eslesen) return await stokKg(sb, eslesen)
        }
        return await hammadde(sb, n.mekan)
      }
      case 'hm_stok': return await hmStok(sb, n.grup, n.arama)
      case 'boya_kg': { const b = n.kg * n.oran, yp = r2(n.oran * 100); return { yanit: `${AD(n.kg)} kg hammadde × %${yp} boya oranı = ${TL(b)} kg (${TL(b / 1000)} ton) boya.\nHesap: hammadde kg × oran. Tahmini hesaptır, gerçek boya kullanımı kayıtlı değildir. Dış mekanda boya kullanılmaz.`, araclar: ['rapor_boya_kg'] } }
      case 'boya_kullanim': return n.kaynak === 'stok' && n.mekan !== 'dis' ? await boyaStok(sb, n.oran) : await boyaKullanim(sb, n.mekan, n.oran)
      case 'stok_kg': return await stokKg(sb, n.mekan)
      case 'hm_alis': return await hmAlis(sb, n.arama, n.hareket)
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
