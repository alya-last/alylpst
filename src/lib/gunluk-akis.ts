import type { SupabaseClient } from '@supabase/supabase-js'

// "Dün / bugün ne oldu" akışı: yalnızca veritabanındaki gerçek kayıtlardan, kurallı üretilir (AI yok).
const TL = (n: number) => `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(n || 0))} ₺`
const ADET = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(n || 0))
const gunEkle = (t: string, n: number) => new Date(Date.parse(t + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const topla = (rows: any[], f: (r: any) => number) => rows.reduce((t, r) => t + (f(r) || 0), 0)

export async function gunlukAkis(sb: SupabaseClient, bugun: string, mod: 'sabah' | 'aksam'): Promise<{ baslik: string; satirlar: string[]; atlanan: string[] }> {
  const atlanan: string[] = []
  const al = async (ad: string, f: () => PromiseLike<{ data: any[] | null; error: any }>) => {
    try { const r = await f(); if (r.error) { atlanan.push(ad); return null } return r.data || [] } catch { atlanan.push(ad); return null }
  }
  const gun = mod === 'sabah' ? gunEkle(bugun, -1) : bugun        // raporlanan gün
  const ayBas = bugun.slice(0, 7) + '-01'
  const gunNo = +bugun.slice(8, 10)
  const oncAyBas = gunEkle(ayBas, -1).slice(0, 7) + '-01'
  const oncAyAyniGun = gunEkle(oncAyBas, gunNo - 1)
  const gunBas = `${gun}T00:00:00+03:00`, gunSon = `${gunEkle(gun, 1)}T00:00:00+03:00`
  const etiket = mod === 'sabah' ? 'Dün' : 'Bugün'

  const [fat, tahs, odeme, uretimEm, acikEm, sev, yeniSip, teslimBugun, kasa, ayFat, oncFat, teklif, uretimGiris] = await Promise.all([
    al('fatura', () => sb.from('faturalar').select('toplam').eq('tip', 'satis').in('durum', ['onaylandi', 'odendi']).eq('tarih', gun).limit(2000)),
    al('tahsilat', () => sb.from('islemler').select('tutar').eq('tip', 'gelir').eq('tarih', gun).limit(3000)),
    al('odeme', () => sb.from('islemler').select('tutar').eq('tip', 'gider').eq('tarih', gun).limit(3000)),
    al('is_emri_biten', () => sb.from('uretim_emirleri').select('no,uretilen_miktar,fire_miktar').eq('durum', 'tamamlandi').gte('bitis', gunBas).lt('bitis', gunSon).limit(500)),
    al('is_emri_acik', () => sb.from('uretim_emirleri').select('no,durum,bitis,planlanan_miktar,uretilen_miktar').in('durum', ['planlandi', 'beklemede', 'uretimde', 'durduruldu']).limit(500)),
    al('sevkiyat', () => sb.from('sevkiyatlar').select('toplam_urun_adedi,koli_sayisi').eq('tarih', gun).limit(500)),
    al('yeni_siparis', () => sb.from('satis_siparisleri').select('id').eq('tarih', gun).limit(500)),
    al('teslim', () => sb.from('satis_siparisleri').select('id').eq('teslim_tarihi', bugun).in('durum', ['beklemede', 'uretimde', 'kismen_hazir', 'hazir']).limit(500)),
    al('kasa', () => sb.from('kasa_banka_hesaplari').select('bakiye,para_birimi,aktif').limit(200)),
    al('ay_satis', () => sb.from('faturalar').select('toplam').eq('tip', 'satis').in('durum', ['onaylandi', 'odendi']).gte('tarih', ayBas).lte('tarih', bugun).limit(5000)),
    al('onc_ay_satis', () => sb.from('faturalar').select('toplam').eq('tip', 'satis').in('durum', ['onaylandi', 'odendi']).gte('tarih', oncAyBas).lte('tarih', oncAyAyniGun).limit(5000)),
    al('teklif', () => sb.from('teklifler').select('toplam').in('durum', ['gonderildi', 'beklemede']).limit(500)),
    al('uretim_giris', () => sb.from('uretim_girisleri').select('adet').eq('tarih', gun).limit(2000)),
  ])
  const s: string[] = []
  if (fat) s.push(`💰 ${etiket} kesilen satış faturası: ${fat.length} adet, ${TL(topla(fat, r => +r.toplam))}`)
  if (tahs && odeme) s.push(`🏦 ${etiket} tahsilat: ${TL(topla(tahs, r => +r.tutar))} • ödeme/gider: ${TL(topla(odeme, r => +r.tutar))}`)
  if (uretimEm) {
    const acik = acikEm || []
    const gec = acik.filter(e => e.bitis && e.bitis < `${bugun}T00:00:00+03:00` && e.durum !== 'durduruldu').length
    const dur = acik.filter(e => e.durum === 'durduruldu').length
    s.push(`🏭 ${etiket} tamamlanan iş emri: ${uretimEm.length}${uretimEm.length ? ` (${ADET(topla(uretimEm, r => +r.uretilen_miktar))} adet, fire ${ADET(topla(uretimEm, r => +r.fire_miktar))})` : ''} • açık iş emri: ${acik.length}${gec ? `, geciken: ${gec}` : ''}${dur ? `, durdurulan: ${dur}` : ''}`)
  }
  if (uretimGiris && uretimGiris.length) s.push(`📦 ${etiket} ÜRETİM depo girişi (Mikro): ${ADET(topla(uretimGiris, r => +r.adet))} adet`)
  if (sev) s.push(`🚚 ${etiket} sevkiyat: ${sev.length} sevkiyat${sev.length ? `, ${ADET(topla(sev, r => +r.toplam_urun_adedi))} adet, ${ADET(topla(sev, r => +r.koli_sayisi))} koli` : ''}`)
  if (yeniSip) s.push(`📝 ${etiket} gelen sipariş: ${yeniSip.length}${teslimBugun ? ` • bugün teslim tarihi gelen açık sipariş: ${teslimBugun.length}` : ''}`)
  if (kasa) {
    const tl = topla(kasa.filter(k => k.aktif !== false && (k.para_birimi || 'TRY') === 'TRY'), r => +r.bakiye)
    const dv = ['USD', 'EUR'].map(pb => ({ pb, t: topla(kasa.filter(k => k.aktif !== false && k.para_birimi === pb), r => +r.bakiye) })).filter(x => Math.abs(x.t) > 0.5)
    s.push(`💼 Kasa/banka: ${TL(tl)}${dv.map(x => ` • ${ADET(x.t)} ${x.pb}`).join('')}`)
  }
  if (ayFat) {
    const ay = topla(ayFat, r => +r.toplam), onc = oncFat ? topla(oncFat, r => +r.toplam) : 0
    const fark = onc > 0 ? ` (geçen ay aynı güne göre ${ay >= onc ? '+' : '−'}%${Math.abs(Math.round((ay - onc) / onc * 100))})` : ''
    s.push(`📈 Ay başından beri satış faturası: ${TL(ay)}${fark}`)
  }
  if (teklif && teklif.length) s.push(`📨 Yanıt bekleyen teklif: ${teklif.length} adet, ${TL(topla(teklif, r => +r.toplam))}`)
  return { baslik: mod === 'sabah' ? 'Sabah raporu' : 'Gün sonu raporu', satirlar: s, atlanan }
}
