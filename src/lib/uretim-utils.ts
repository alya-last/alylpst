'use client'
import { useCallback, useEffect, useState } from 'react'
import { erp } from './erp-client'
import { muh } from './muhasebe-client'

// Üretim & kalite sayfalarının ortak veri yükleyicisi — sadece istenen veri kümelerini çeker.
const FETCH = {
  products:        () => muh.all('products', 'id,name,code,mekan'),
  variants:        () => muh.all('product_variants', 'id,product_id,name,color,size,stock,sort_order,hex,gorsel'),
  hammaddeler:     () => erp.all('hammaddeler', '*', q => q.order('ad', { ascending: true })),
  makineler:       () => erp.all('makineler', '*', q => q.order('ad', { ascending: true })),
  kaliplar:        () => erp.all('kaliplar', '*', q => q.order('ad', { ascending: true })),
  bakimlar:        () => erp.all('kalip_bakim_kayitlari', '*', q => q.order('tarih', { ascending: false })),
  receteler:       () => erp.all('urun_receteleri', '*', q => q.order('created_at', { ascending: false })),
  receteKalemleri: () => erp.all('recete_kalemleri'),
  emirler:         () => erp.all('uretim_emirleri', '*', q => q.order('created_at', { ascending: false })),
  // Son 400 gün (aylık/yıllık analizler için yeterli); daha eskisi için ilgili sunucu tarafı ekranlar/özetler kullanılır
  hareketler:      () => erp.all('uretim_hareketleri', '*', q => q.gte('tarih', new Date(Date.now() - 400 * 86400000).toISOString()).order('tarih', { ascending: false })),
  siparisler:      () => erp.all('satis_siparisleri', '*', q => q.order('created_at', { ascending: false })),
  siparisKalemleri:() => erp.all('satis_siparisi_kalemleri'),
  kalite:          () => erp.all('kalite_kontrol_kayitlari', '*', q => q.order('tarih', { ascending: false })),
  fire:            () => erp.all('fire_kayitlari', '*', q => q.order('tarih', { ascending: false })),
  cariler:         () => muh.all('cari_hesaplar', 'id,ad,tip'),
  depolar:         () => erp.all('depolar', '*', q => q.order('ad', { ascending: true })),
  // Yalnızca son 120 gün (güvenlik sınırı). Toplam/rezerve/sevk hesapları için aşağıdaki veritabanı görünümleri kullanılır.
  stokHareketleri: () => erp.all('stok_hareketleri', '*', q => q.gte('tarih', new Date(Date.now() - 120 * 86400000).toISOString()).order('tarih', { ascending: false })),
  rezerveRows:     () => erp.all('v_rezerve'),
  sevkRows:        () => erp.all('v_sevk_edilen'),
  tuketimRows:     () => erp.all('v_hammadde_tuketim'),
  baskiRows:       () => erp.all('v_kalip_baski'),
  depoOzet:        () => erp.all('v_depo_ozet'),
  lotlar:          () => erp.all('hammadde_lotlari', '*', q => q.order('giris_tarihi', { ascending: false })),
  satinalma:       () => erp.all('satinalma_siparisleri', '*', q => q.order('created_at', { ascending: false })),
  satinalmaKalemleri: () => erp.all('satinalma_siparisi_kalemleri'),
  sevkiyatlar:     () => erp.all('sevkiyatlar', '*', q => q.order('created_at', { ascending: false })),
  ihracat:         () => erp.all('ihracat_detaylari'),
  fiyatListeleri:  () => erp.all('fiyat_listeleri'),
  fiyatKalemleri:  () => erp.all('fiyat_listesi_kalemleri'),
  iskontolar:      () => erp.all('iskonto_kademeleri'),
  cariTam:         () => muh.all('cari_hesaplar', '*', q => q.order('ad', { ascending: true })),
}
export type UKey = keyof typeof FETCH

export function useUretim<K extends UKey>(keys: K[], pollMs = 0) {
  const [d, setD] = useState<Record<K, any[]>>(() => Object.fromEntries(keys.map(k => [k, []])) as any)
  const [loading, setLoading] = useState(true)
  const kk = keys.join(',')
  const reload = useCallback(async () => {
    const list = kk.split(',') as K[]
    const res = await Promise.all(list.map(k => FETCH[k]().catch(() => [])))
    setD(Object.fromEntries(list.map((k, i) => [k, res[i]])) as any); setLoading(false)
  }, [kk])
  useEffect(() => { reload() }, [reload])
  useEffect(() => { if (!pollMs) return; const t = setInterval(reload, pollMs); return () => clearInterval(t) }, [reload, pollMs])
  return { d, loading, reload }
}

export const byId = (list: any[]) => Object.fromEntries(list.map(x => [x.id, x]))

/* ───── Durum tanımları ───── */
export const MAKINE_DURUM: Record<string, { l: string; tone: any; color: string }> = {
  musait: { l: 'Müsait', tone: 'green', color: 'var(--adm-green)' }, uretimde: { l: 'Üretimde', tone: 'blue', color: 'var(--adm-blue)' },
  bakimda: { l: 'Bakımda', tone: 'amber', color: 'var(--adm-amber)' }, arizali: { l: 'Arızalı', tone: 'red', color: 'var(--adm-red)' }, durduruldu: { l: 'Durduruldu', tone: 'muted', color: 'var(--adm-tx3)' },
}
export const KALIP_DURUM: Record<string, { l: string; tone: any; color: string }> = {
  uretimde: { l: 'Üretimde', tone: 'blue', color: 'var(--adm-blue)' }, hazir: { l: 'Hazır', tone: 'green', color: 'var(--adm-green)' }, depoda: { l: 'Depoda', tone: 'muted', color: 'var(--adm-tx3)' },
  bakimda: { l: 'Bakımda', tone: 'amber', color: 'var(--adm-amber)' }, arizali: { l: 'Arızalı', tone: 'red', color: 'var(--adm-red)' },
}
export const EMIR_DURUM: Record<string, { l: string; tone: any; color: string }> = {
  planlandi: { l: 'Planlandı', tone: 'muted', color: 'var(--adm-tx3)' }, uretimde: { l: 'Üretimde', tone: 'blue', color: 'var(--adm-blue)' }, durduruldu: { l: 'Durduruldu', tone: 'amber', color: 'var(--adm-amber)' },
  tamamlandi: { l: 'Tamamlandı', tone: 'green', color: 'var(--adm-green)' }, iptal: { l: 'İptal', tone: 'red', color: 'var(--adm-red)' },
}

/* ───── Hesaplar ───── */
export const yuzde = (a: number, b: number) => (b > 0 ? Math.min(100, (a / b) * 100) : 0)
export const fireOrani = (uretilen: number, fire: number) => (uretilen + fire > 0 ? (fire / (uretilen + fire)) * 100 : 0)

// Kalıp baskı sayısı (v_kalip_baski satırından): { toplam, bakimdanBeri }
export function kalipBaski(kalipId: string, baskiRows: any[]) {
  const r = baskiRows.find(x => x.kalip_id === kalipId)
  return { toplam: +r?.baski_toplam || 0, bakimdanBeri: +r?.baski_bakimdan_beri || 0 }
}

// Reçete maliyeti — miktarlar hammadde biriminde (kg) tutulur, ortalama_maliyet de aynı birimdedir
export function receteMaliyet(r: any, kalemler: any[], hammaddeler: any[]) {
  const hm = byId(hammaddeler)
  const satirlar = kalemler.filter(k => k.recete_id === r.id).map(k => {
    const h = hm[k.hammadde_id]; const bm = +h?.ortalama_maliyet || 0
    return { ...k, ad: h?.ad || '—', birimMaliyet: bm, tutar: (+k.miktar || 0) * bm, stok: +h?.mevcut_stok || 0, hBirim: h?.birim }
  })
  const hammadde = satirlar.reduce((s, x) => s + x.tutar, 0)
  const iscilik = +r.iscilik_maliyeti || 0, genel = +r.genel_gider_maliyeti || 0, amort = +r.amortisman_maliyeti || 0
  const toplam = hammadde + iscilik + genel + amort
  const fire = Math.min(+r.hedef_fire_orani || 0, 90) / 100
  return { satirlar, hammadde, iscilik, genel, amort, toplam, firedahil: fire ? toplam / (1 - fire) : toplam, eksikMaliyet: satirlar.some(x => !x.birimMaliyet) }
}

// Bir emrin reçetesine göre kalan üretim için hammadde ihtiyacı
export function emirIhtiyac(e: any, kalemler: any[], hammaddeler: any[], adet?: number) {
  const hm = byId(hammaddeler)
  const kalan = adet ?? Math.max((+e.planlanan_miktar || 0) - (+e.uretilen_miktar || 0), 0)
  return kalemler.filter(k => k.recete_id === e.recete_id).map(k => {
    const h = hm[k.hammadde_id]
    return { hammadde_id: k.hammadde_id, ad: h?.ad, birim: h?.birim, gerekli: (+k.miktar || 0) * kalan, stok: +h?.mevcut_stok || 0 }
  })
}

export const varyantEtiket = (v: any, products: Record<string, any>) =>
  [products[v.product_id]?.name, v.name, v.color, v.size].filter(Boolean).filter((a, i, arr) => arr.indexOf(a) === i).join(' · ') || v.name

/* ───── Stok / sipariş yardımcıları ───── */
export const SIPARIS_ACIK = ['beklemede', 'uretimde', 'kismen_hazir', 'hazir']

// Sevk edilen miktar (veritabanı görünümü v_sevk_edilen satırlarından): { [variant_id]: adet }
export function sevkEdilen(siparisId: string, sevkRows: any[]) {
  const out: Record<string, number> = {}
  sevkRows.filter(r => r.siparis_id === siparisId).forEach(r => { out[r.variant_id] = (out[r.variant_id] || 0) + (+r.adet || 0) })
  return out
}

// Açık siparişlerde henüz sevk edilmemiş (rezerve) miktar (v_rezerve satırlarından): { [variant_id]: adet }
export function rezerveMap(rows: any[]) {
  const out: Record<string, number> = {}
  rows.forEach(r => { out[r.variant_id] = (out[r.variant_id] || 0) + (+r.rezerve || 0) })
  return out
}

// Bir hammaddenin son 30 gündeki günlük ortalama tüketimi (v_hammadde_tuketim satırlarından)
export function gunlukTuketim(hammaddeId: string, tuketimRows: any[]) {
  return (+tuketimRows.find(r => r.hammadde_id === hammaddeId)?.toplam_30g || 0) / 30
}

export const HAREKET_TIP: Record<string, string> = {
  uretim_giris: 'Üretim Girişi', uretim_cikis: 'Üretim Çıkışı', satis: 'Satış', satinalma: 'Satınalma', sevkiyat: 'Sevkiyat', fire: 'Fire', sayim: 'Sayım', manuel_duzeltme: 'Manuel Düzeltme', iade: 'İade',
}
