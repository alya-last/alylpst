// Ürün maliyet hesabı — tek yerde. Panel sayfası ve yapay zekâ aynı fonksiyonu kullanır.
// Formül özeti (Excel "ÜRÜN MALİYET 2026 Ocak–Eylül" ile birebir uyumlu):
//   hammadde = Σ (parça gramı × hammadde TL/kg ÷ 1000) + ek
//   baskı    = Σ katsayı × makine saat ücreti ÷ (3600 ÷ çevrim sn) ÷ kalıp göz
//   maliyet  = hammadde + baskı + koli + etiket
//   toplam   = maliyet × (1 + genel gider %)   [+ KDV, ayarda "KDV dahil" açıksa]
//   USD      = toplam ÷ kur

export type MAyar = { kur_usd: number; eur_parite: number; genel_gider_pct: number; kdv_pct: number; kdv_dahil: boolean }
export type MHammadde = { id?: string; kod: string; ad: string; usd_kg: number | null; ek_tl: number; sabit_tl_kg: number | null }
export type MMakine = { id?: string; ton: string; saat_ucreti: number }
export type MParca = { ad: string; gram: number; hm: string }
export type MBaski = { ad: string; goz: number; cevrim: number; ton: string; coef: number; saat?: number | null; sabit_tl?: number | null } // saat: bu ürüne özel saat ücreti (boşsa makinenin genel ücreti); sabit_tl: baskı maliyeti elle yazılmışsa doğrudan TL (makine hesabı yapılmaz)
export type MUrun = {
  id: string; kod: string; ad: string; litre: string | null; seri: string | null
  parcalar: MParca[]; baski: MBaski[]
  ek_tl: number; koli_tl: number; etiket_tl: number; liste_usd: number
  excel_maliyet_tl: number | null; aktif: boolean
  genel_gider_pct?: number | null // boşsa genel ayardaki oran
}

export const num = (v: any) => (v === null || v === undefined || v === '' || isNaN(+v) ? 0 : +v)

/** Hammaddenin güncel TL/kg değeri: USD ise kurla çarpılıp ek eklenir, değilse sabit TL. */
export function hmTlKg(h: MHammadde | undefined, kur: number): number {
  if (!h) return 0
  if (h.usd_kg !== null && h.usd_kg !== undefined) return num(h.usd_kg) * kur + num(h.ek_tl)
  return num(h.sabit_tl_kg)
}

export type Satir = { grup: string; ad: string; formul: string; tl: number }

export function hesapla(u: MUrun, ay: MAyar, hms: MHammadde[], mks: MMakine[]) {
  const hmMap = Object.fromEntries(hms.map(h => [h.kod, h]))
  const mkMap = Object.fromEntries(mks.map(m => [m.ton, m]))
  const satirlar: Satir[] = []
  let hammadde = 0, gram = 0
  for (const p of u.parcalar || []) {
    const tlkg = hmTlKg(hmMap[p.hm], ay.kur_usd)
    const tl = num(p.gram) * tlkg / 1000
    hammadde += tl; gram += num(p.gram)
    satirlar.push({ grup: 'Hammadde', ad: `${p.ad} (${hmMap[p.hm]?.ad || p.hm})`, formul: `${num(p.gram)} gr × ${tlkg.toFixed(2)} TL/kg ÷ 1000`, tl })
  }
  if (num(u.ek_tl)) { hammadde += num(u.ek_tl); satirlar.push({ grup: 'Hammadde', ad: 'Ek hammadde / sabit', formul: 'elle girilen sabit tutar', tl: num(u.ek_tl) }) }
  let baski = 0
  for (const b of u.baski || []) {
    if (num(b.sabit_tl) > 0) { baski += num(b.sabit_tl); satirlar.push({ grup: 'Baskı', ad: `${b.ad} · sabit`, formul: 'elle girilen sabit baskı tutarı', tl: num(b.sabit_tl) }); continue }
    const saat = num(b.saat) > 0 ? num(b.saat) : num(mkMap[b.ton]?.saat_ucreti)
    const sureAdet = num(b.cevrim) > 0 ? num(b.cevrim) / 3600 : 0 // saat / baskı
    const tl = num(b.goz) > 0 ? num(b.coef) * saat * sureAdet / num(b.goz) : 0
    baski += tl
    satirlar.push({ grup: 'Baskı', ad: `${b.ad} · ${b.ton}`, formul: `${num(b.coef) !== 1 ? num(b.coef) + ' × ' : ''}${saat} TL/saat${num(b.saat) > 0 ? ' (ürüne özel)' : ''} × ${b.cevrim} sn ÷ 3600 ÷ ${b.goz} göz`, tl })
  }
  const koli = num(u.koli_tl), etiket = num(u.etiket_tl)
  satirlar.push({ grup: 'Ambalaj', ad: 'Koli', formul: 'ürün başına', tl: koli }, { grup: 'Ambalaj', ad: 'Etiket', formul: 'ürün başına', tl: etiket })
  const maliyet = hammadde + baski + koli + etiket
  const ggPct = u.genel_gider_pct !== null && u.genel_gider_pct !== undefined && (u.genel_gider_pct as any) !== '' ? num(u.genel_gider_pct) : num(ay.genel_gider_pct)
  const genelGider = maliyet * ggPct / 100
  const kdvHaric = maliyet + genelGider
  const kdv = kdvHaric * num(ay.kdv_pct) / 100
  const toplam = ay.kdv_dahil ? kdvHaric + kdv : kdvHaric
  const usd = ay.kur_usd > 0 ? toplam / ay.kur_usd : 0
  const eur = ay.eur_parite > 0 ? usd / ay.eur_parite : 0
  const liste = num(u.liste_usd)
  const kar = usd > 0 && liste > 0 ? (liste - usd) / usd : null   // maliyet üzerine % (Excel'deki "KAR")
  const marj = liste > 0 ? (liste - usd) / liste : null           // satış fiyatı üzerinden %
  return { satirlar, gram, hammadde, baski, koli, etiket, maliyet, genelGider, kdvHaric, kdv, toplam, usd, eur, liste, kar, marj }
}
