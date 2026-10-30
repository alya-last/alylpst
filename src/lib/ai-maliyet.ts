import type { SupabaseClient } from '@supabase/supabase-js'
import { hesapla, hmTlKg, num, type MAyar, type MHammadde, type MMakine, type MUrun } from '@/lib/maliyet'

// Yapay zekâ için ürün maliyet araçları. Panel sayfasıyla AYNI hesap fonksiyonunu (hesapla) kullanır.
// Kullanıcının kendi oturumuyla çalışır: maliyet tabloları yalnızca "uretim" yetkisine açıktır (RLS).

const nrm = (v: unknown) => String(v ?? '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').trim()
const r2 = (x: number) => Math.round(x * 100) / 100
const r4 = (x: number) => Math.round(x * 10000) / 10000

async function yukle(sb: SupabaseClient) {
  const [u, h, m, a] = await Promise.all([
    sb.from('maliyet_urun').select('*').eq('aktif', true).order('sira').limit(500),
    sb.from('maliyet_hammadde').select('*').limit(100),
    sb.from('maliyet_makine').select('*').limit(50),
    sb.from('maliyet_ayar').select('*').eq('id', 1).maybeSingle(),
  ])
  for (const r of [u, h, m, a]) if (r.error) throw new Error(r.error.message)
  if (!a.data) throw new Error('Maliyet ayarı bulunamadı veya bu kullanıcının maliyet yetkisi yok')
  const ay: MAyar = { kur_usd: num(a.data.kur_usd), eur_parite: num(a.data.eur_parite), genel_gider_pct: num(a.data.genel_gider_pct), kdv_pct: num(a.data.kdv_pct), kdv_dahil: !!a.data.kdv_dahil }
  return { urunler: (u.data || []) as MUrun[], hms: (h.data || []) as MHammadde[], mks: (m.data || []) as MMakine[], ay }
}

const ozet = (u: MUrun, s: ReturnType<typeof hesapla>) => ({
  kod: u.kod, urun: u.ad, gram: s.gram, maliyet_tl: r2(s.toplam), maliyet_usd: r2(s.usd), maliyet_eur: r2(s.eur),
  liste_usd: s.liste || null, kar_yuzde: s.kar === null ? null : r2(s.kar * 100), marj_yuzde: s.marj === null ? null : r2(s.marj * 100),
})

/** maliyet_hesapla: ürün adı/kodu + isteğe bağlı senaryo (kur, hammadde fiyatı, gram, genel gider, liste fiyatı). */
export async function maliyetHesapla(sb: SupabaseClient, a: Record<string, any>): Promise<unknown> {
  const { urunler, hms, mks, ay } = await yukle(sb)
  const ar = nrm(a.urun)
  if (!ar) throw new Error('urun boş')
  const terimler = ar.split(/\s+/).filter(Boolean)
  const bulunan = urunler.filter(u => { const m = nrm(`${u.kod} ${u.ad} ${u.litre || ''} ${u.seri || ''}`); return terimler.every(t => m.includes(t)) })
  if (!bulunan.length) return { sonuc: 'Maliyet tablosunda eşleşen ürün yok', not: 'Maliyet tablosunda Kordon/Güveç dahil tüm ürünler var (Excel 2026 Ocak–Eylül maliyet dosyasına göre). Ürün adı/kodunu farklı yazarak dene.' }
  const secilen = bulunan.slice(0, 6)

  // Senaryo: geçici değişiklikler (kaydedilmez)
  const senAy: MAyar = { ...ay }
  const varsayim: string[] = []
  if (num(a.kur_usd) > 0) { senAy.kur_usd = num(a.kur_usd); varsayim.push(`kur ${a.kur_usd}`) }
  if (a.genel_gider_pct !== undefined && a.genel_gider_pct !== null) { senAy.genel_gider_pct = num(a.genel_gider_pct); varsayim.push(`genel gider %${a.genel_gider_pct}`) }
  if (typeof a.kdv_dahil === 'boolean') { senAy.kdv_dahil = a.kdv_dahil; varsayim.push(a.kdv_dahil ? 'KDV dahil' : 'KDV hariç') }
  let senHms = hms
  if (a.hammadde_degisim_yuzde !== undefined && a.hammadde_degisim_yuzde !== null) {
    const k = 1 + num(a.hammadde_degisim_yuzde) / 100
    senHms = hms.map(h => ({ ...h, usd_kg: h.usd_kg === null ? null : num(h.usd_kg) * k, sabit_tl_kg: h.sabit_tl_kg === null ? null : num(h.sabit_tl_kg) * k }))
    varsayim.push(`hammadde fiyatları %${a.hammadde_degisim_yuzde}`)
  }

  const cikti = secilen.map(u0 => {
    let u = u0
    const yerel: string[] = []
    if (num(a.gram_carpan) > 0 && num(a.gram_carpan) !== 1) { u = { ...u, parcalar: u.parcalar.map(p => ({ ...p, gram: num(p.gram) * num(a.gram_carpan) })) }; yerel.push(`gram ×${a.gram_carpan}`) }
    if (num(a.liste_usd) > 0) { u = { ...u, liste_usd: num(a.liste_usd) }; yerel.push(`liste ${a.liste_usd} USD`) }
    const bugun = hesapla(u0, ay, hms, mks)
    const sen = hesapla(u, senAy, senHms, mks)
    const degisti = varsayim.length > 0 || yerel.length > 0
    const kalem = (s: typeof sen) => ({ hammadde_tl: r2(s.hammadde), baski_tl: r2(s.baski), koli_tl: r2(s.koli), etiket_tl: r2(s.etiket), genel_gider_tl: r2(s.genelGider), kdv_tl: senAy.kdv_dahil ? r2(s.kdv) : 0 })
    return {
      ...ozet(u0, bugun),
      kalemler_tl: kalem(bugun),
      parcalar: u0.parcalar.map(p => ({ parca: p.ad, gram: num(p.gram), hammadde: p.hm, tl_kg: r2(hmTlKg(hms.find(h => h.kod === p.hm), ay.kur_usd)) })),
      baski: u0.baski.map(b => ({ parca: b.ad, makine: b.ton, cevrim_sn: num(b.cevrim), goz: num(b.goz) })),
      senaryo: degisti ? { varsayim: [...varsayim, ...yerel], ...ozet(u, sen), fark_tl: r2(sen.toplam - bugun.toplam), fark_usd: r2(sen.usd - bugun.usd), kalemler_tl: kalem(sen) } : undefined,
    }
  })
  return {
    ayar: { kur_usd: ay.kur_usd, eur_parite: ay.eur_parite, genel_gider_pct: ay.genel_gider_pct, kdv_dahil: ay.kdv_dahil },
    formul: 'maliyet = hammadde (gram × TL/kg ÷ 1000) + baskı (makine saat ücreti × çevrim ÷ 3600 ÷ göz) + koli + etiket; toplam = maliyet × (1 + genel gider %); USD = toplam ÷ kur. kâr % = (liste − USD maliyet) ÷ USD maliyet; marj % = (liste − maliyet) ÷ liste.',
    eslesen_urun_sayisi: bulunan.length,
    urunler: cikti,
    not: 'Liste fiyatı yoksa kâr/marj null gelir; ürün listede olmasa da (ör. Efes, Cornet) "yok" demek yerine bu tabloda bulunmadığını söyle.',
  }
}

/** maliyet_liste: tüm ürünlerin maliyet/kâr tablosu (sıralı). */
export async function maliyetListe(sb: SupabaseClient, a: Record<string, any>): Promise<unknown> {
  const { urunler, hms, mks, ay } = await yukle(sb)
  const ar = nrm(a.arama)
  let satir = urunler.filter(u => !ar || ar.split(/\s+/).every(t => nrm(`${u.kod} ${u.ad}`).includes(t))).map(u => ozet(u, hesapla(u, ay, hms, mks)))
  const sirala = a.siralama === 'maliyet' ? 'maliyet_usd' : a.siralama === 'marj_artan' ? 'marj_yuzde' : 'kar_yuzde'
  const yon = a.siralama === 'marj_artan' || a.siralama === 'kar_artan' ? 1 : -1
  satir = satir.sort((x: any, y: any) => ((x[sirala] ?? -1e9) - (y[sirala] ?? -1e9)) * yon)
  const kl = satir.filter(s => s.kar_yuzde !== null)
  return {
    ayar: { kur_usd: ay.kur_usd, genel_gider_pct: ay.genel_gider_pct, kdv_dahil: ay.kdv_dahil },
    urun_sayisi: satir.length,
    ortalama_kar_yuzde: kl.length ? r2(kl.reduce((t, s) => t + (s.kar_yuzde as number), 0) / kl.length) : null,
    en_dusuk_kar: [...kl].sort((x, y) => (x.kar_yuzde as number) - (y.kar_yuzde as number)).slice(0, 5).map(s => `${s.kod} ${s.urun} %${s.kar_yuzde}`),
    urunler: satir.slice(0, Math.min(num(a.adet) || 60, 120)),
    not: 'Kâr % = maliyet üzerine; marj % = satış fiyatı üzerine. Tutarlar KDV hariçtir (ayar kdv_dahil değilse).',
  }
}
