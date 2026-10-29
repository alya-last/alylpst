import type { SupabaseClient } from '@supabase/supabase-js'

// Aylık gelir tablosu (kullanıcının Excel şablonu): SATIŞLAR | MASRAFLAR, ÜRETİM MALİYETİ, SATIŞLARIN MALİYETİ, CİRO, DİĞER GELİRLER, KAR-ZARAR.
// Veri `islemler` kayıtlarından okunur; tüm toplamlar burada deterministik hesaplanır. AI rakam üretmez.

export type GTKalem = { ad: string; tutar: number }
export type GelirTablosu = {
  yil: number; ay: number; baslik: string
  satislar: GTKalem[]; netSatis: number
  masraflar: GTKalem[]; masrafToplam: number
  uretim: GTKalem[]; uretimToplam: number
  satisMaliyeti: number; ciro: number
  digerGelirler: GTKalem[]; digerToplam: number
  karZarar: number; kayit: number
}

export const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const r2 = (n: number) => Math.round(n * 100) / 100
const pad = (n: number) => String(n).padStart(2, '0')
const nrm = (v: string) => String(v || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/\s+/g, ' ').trim()

// Şablondaki satır sırası (anahtar sözcük → sıra). Listede olmayan kalemler tutara göre sona eklenir.
const MASRAF_SIRA = ['kira', 'elektrik', 'aidat', 'personel', 'yemek', 'isletme gider', 'is guvenligi', 'isyeri hekim', 'forklif', 'gumruk', 's.m.m|^smm', 'akaryakit', 'nakliye giderleri$', 'nakliye giderleri-bursa|bursa', 'konaklama', 'haberlesme', 'm.tasitlar|arac muayene', 'tamir bakim giderleri', 'kalip tamir', 'makina|makine', 'arac tamir', 'iski|su giderleri', 'kargo', 'kirtasiye', 'fuar', 'market', 'banka', 'genel uretim', 'insaat', 'numune', 'rotasyon satis', 'pazarlama', 'gkkp', 'stopaj', 'sgk']
const URETIM_SIRA = ['moblen', 'boya', 'poset', 'koli', 'rotasyon ham', 'etiket', 'granur', 'kristal']
const sirala = (liste: GTKalem[], sira: string[]) => {
  const rank = (k: GTKalem) => { const a = nrm(k.ad); const i = sira.findIndex(p => new RegExp(p).test(a)); return i < 0 ? 999 : i }
  return [...liste].sort((a, b) => rank(a) - rank(b) || b.tutar - a.tutar)
}

export function ayParse(ay: string): { yil: number; ay: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ay || ''); if (!m || +m[2] < 1 || +m[2] > 12) return null
  return { yil: +m[1], ay: +m[2] }
}

export async function gelirTablosuVeri(sb: SupabaseClient, yil: number, ay: number): Promise<GelirTablosu> {
  const son = new Date(Date.UTC(yil, ay, 0)).getUTCDate()
  const { data, error } = await sb.from('islemler').select('tip,kategori,tutar,aciklama').gte('tarih', `${yil}-${pad(ay)}-01`).lte('tarih', `${yil}-${pad(ay)}-${pad(son)}`).limit(5000)
  if (error) throw new Error(`Veri okunamadı: ${error.message}`)
  const OZEL = /virman|kapama|bakiye|a[çc][ıi]l[ıi][şs]|kur fark/i
  const satislar = new Map<string, number>(), masraflar = new Map<string, number>(), uretim = new Map<string, number>(), diger = new Map<string, number>()
  const ekle = (m: Map<string, number>, ad: string, t: number) => m.set(ad, r2((m.get(ad) || 0) + t))
  let kayit = 0
  for (const x of (data || []) as any[]) {
    const kat = String(x.kategori || ''), t = +x.tutar || 0
    if (OZEL.test(kat) || !t) continue
    // "[Aylık tablo] Ocak 2026 - KİRA GİDERLERİ" biçimindeki aktarım kayıtları kalem adıyla, diğerleri kategori adıyla gösterilir
    const aktarim = /^\[Aylık tablo\][^-]*-\s*(.+)$/.exec(String(x.aciklama || '')), ad = (aktarim ? aktarim[1] : kat).trim()
    kayit++
    if (x.tip === 'gelir') { if (kat === 'Ürün Satışı') ekle(satislar, aktarim ? ad : 'ÜRÜN SATIŞLARI', t); else ekle(diger, ad, t) }
    else if (x.tip === 'gider') { if (kat === 'Kullanılan Malzeme' || /\[Üretim\]/.test(String(x.aciklama || ''))) ekle(uretim, ad, t); else ekle(masraflar, ad, t) }
  }
  const dizi = (m: Map<string, number>) => [...m.entries()].map(([ad, tutar]) => ({ ad, tutar }))
  const sat = dizi(satislar).sort((a, b) => (/^i[cç]/i.test(nrm(b.ad)) ? 1 : 0) - (/^i[cç]/i.test(nrm(a.ad)) ? 1 : 0) || b.tutar - a.tutar)
  const mas = sirala(dizi(masraflar), MASRAF_SIRA), uret = sirala(dizi(uretim), URETIM_SIRA), dg = dizi(diger).sort((a, b) => b.tutar - a.tutar)
  const top = (l: GTKalem[]) => r2(l.reduce((t, x) => t + x.tutar, 0))
  const netSatis = top(sat), masrafToplam = top(mas), uretimToplam = top(uret), digerToplam = top(dg), satisMaliyeti = r2(masrafToplam + uretimToplam)
  return { yil, ay, baslik: `ALYA PLASTİK ${yil} ${AY_ADLARI[ay - 1].toLocaleUpperCase('tr-TR')} GELİR TABLOSU`, satislar: sat, netSatis, masraflar: mas, masrafToplam, uretim: uret, uretimToplam, satisMaliyeti, ciro: netSatis, digerGelirler: dg, digerToplam, karZarar: r2(netSatis + digerToplam - satisMaliyeti), kayit }
}

export const TL = (n: number) => (Math.round(n * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Şablondaki düzende düz satır listesi (Excel ve rapor bölümü için). */
export function gelirTablosuSatirlar(v: GelirTablosu): (string | number)[][] {
  const s: (string | number)[][] = [['SATIŞLAR', '']]
  v.satislar.forEach(x => s.push([x.ad, x.tutar])); s.push(['NET SATIŞLAR', v.netSatis])
  s.push(['MASRAFLAR', '']); v.masraflar.forEach(x => s.push([x.ad, x.tutar]))
  s.push(['ÜRETİMDE KULLANILAN MALZEME', '']); v.uretim.forEach(x => s.push([x.ad, x.tutar]))
  s.push(['MASRAFLAR', v.masrafToplam], ['ÜRETİM MALİYETİ', v.uretimToplam], ['SATIŞLARIN MALİYETİ', v.satisMaliyeti], ['CİRO', v.ciro])
  v.digerGelirler.forEach(x => s.push([`DİĞER GELİRLER: ${x.ad.replace(/^D[İI]GER GEL[İI]RLER\s*/i, '')}`.replace(/:\s*$/, ''), x.tutar]))
  s.push(['KAR-ZARAR', v.karZarar])
  return s
}

const xe = (t: string) => String(t).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] as string))

/** Şablona benzeyen görüntü (SVG): sol SATIŞLAR, sağ MASRAFLAR (sarı), altta kırmızı toplamlar. */
export function gelirTablosuSvg(v: GelirTablosu): string {
  const W = 1340, RH = 24, X1 = 640, X2 = 664, TOP = 48
  type Sat = { l: string; t?: number; k?: 'sari' | 'duz' | 'kirmizi' | 'kalin' | 'baslik' }
  const sag: Sat[] = [
    ...v.masraflar.map(x => ({ l: x.ad, t: x.tutar, k: 'sari' as const })),
    ...v.uretim.map(x => ({ l: x.ad, t: x.tutar, k: 'duz' as const })),
    { l: 'MASRAFLAR', t: v.masrafToplam, k: 'kirmizi' }, { l: 'ÜRETİM MALİYETİ', t: v.uretimToplam, k: 'kirmizi' }, { l: 'SATIŞLARIN MALİYETİ', t: v.satisMaliyeti, k: 'kirmizi' }, { l: 'CİRO', t: v.ciro, k: 'kalin' },
    ...(v.digerGelirler.length ? v.digerGelirler.map(x => ({ l: x.ad, t: x.tutar, k: 'duz' as const })) : [{ l: 'DİĞER GELİRLER', k: 'duz' as const }]),
    { l: 'KAR-ZARAR', t: v.karZarar, k: 'kalin' },
  ]
  const sol: Sat[] = v.satislar.map(x => ({ l: x.ad.replace(/ SATIŞLAR$/i, ' SATIŞLAR'), t: x.tutar, k: 'duz' as const }))
  const netIdx = v.masraflar.length + v.uretim.length
  const n = Math.max(sag.length, netIdx + 1), H = TOP + RH * (n + 1) + 2
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`
  o += `<text x="${W / 2}" y="34" font-size="28" font-weight="bold" text-anchor="middle">${xe(v.baslik)}</text>`
  const hat = (y: number) => `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#000" stroke-width="1"/>`
  o += hat(TOP)
  const metin = (x: number, y: number, s: string, kalin = false, renk = '#000', sagaYasla = false) => `<text x="${x}" y="${y + 17}" font-size="17" ${kalin ? 'font-weight="bold"' : ''} fill="${renk}" ${sagaYasla ? 'text-anchor="end"' : ''}>${xe(s)}</text>`
  o += metin(X1 / 2, TOP, 'SATIŞLAR', true).replace('<text ', '<text text-anchor="middle" ') + metin((X2 + W) / 2, TOP, 'MASRAFLAR', true).replace('<text ', '<text text-anchor="middle" ')
  for (let i = 0; i <= n; i++) o += hat(TOP + RH * (i + 1))
  o += `<line x1="0" y1="${TOP}" x2="0" y2="${H - 2}" stroke="#000"/><line x1="${X1}" y1="${TOP}" x2="${X1}" y2="${H - 2}" stroke="#000"/><line x1="${X2}" y1="${TOP}" x2="${X2}" y2="${H - 2}" stroke="#000"/><line x1="${W - 1}" y1="${TOP}" x2="${W - 1}" y2="${H - 2}" stroke="#000"/>`
  const kisalt = (s: string, m: number) => (s.length > m ? s.slice(0, m - 1) + '…' : s)
  sag.forEach((x, i) => {
    const y = TOP + RH * (i + 1), kalin = x.k === 'kirmizi' || x.k === 'kalin', renk = x.k === 'kirmizi' ? '#e00000' : '#000'
    if (x.k === 'sari') o += `<rect x="${X2 + 1}" y="${y + 1}" width="${W - X2 - 2}" height="${RH - 1}" fill="#ffff00"/>`
    o += metin(X2 + 3, y, kisalt(x.l, 58), x.k === 'kalin' || x.k === 'kirmizi') + (typeof x.t === 'number' ? metin(W - 6, y, TL(x.t), kalin, renk, true) : '')
  })
  sol.forEach((x, i) => { const y = TOP + RH * (i + 1); o += metin(4, y, kisalt(x.l, 44)) + metin(X1 - 4, y, TL(x.t || 0), false, '#000', true) })
  const yn = TOP + RH * (netIdx + 1)
  o += metin(4, yn, 'NET SATIŞLAR', true) + metin(X1 - 4, yn, TL(v.netSatis), true, '#e00000', true)
  return o + '</svg>'
}
