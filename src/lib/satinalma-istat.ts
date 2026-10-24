// Tedarikçi performans hesabı (saf fonksiyon). Girdi: siparişler, kalemler, cariler, teslim (stok girişi) hareketleri.
export const gunFarki = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000)
export const MIN_VERI = 3   // güvenilirlik yorumu için en az tamamlanmış ve tarihli sipariş

export function tedarikciIstatistik(d: { satinalma: any[]; satinalmaKalemleri: any[]; cariTam: any[] }, hareket: { kaynak_id: string; tarih: string }[], bugun: string) {
  const kalemBy: Record<string, any[]> = {}; d.satinalmaKalemleri.forEach(k => (kalemBy[k.siparis_id] ||= []).push(k))
  const sonTeslim: Record<string, string> = {}   // kalem id → son teslim zamanı
  hareket.forEach(h => { if (h.kaynak_id && (!sonTeslim[h.kaynak_id] || h.tarih > sonTeslim[h.kaynak_id])) sonTeslim[h.kaynak_id] = h.tarih })
  const sip = d.satinalma.filter(s => s.tedarikci_id).map(s => {
    const kur = +s.kur || 1   // döviz siparişleri TL'ye çevrilerek toplanır
    const ks = (kalemBy[s.id] || []).map(k => ({ ...k, birim_fiyat: (+k.birim_fiyat || 0) * kur })), tutar = ks.reduce((a, k) => a + (+k.miktar || 0) * (+k.birim_fiyat || 0), 0)
    const t = ks.map(k => sonTeslim[k.id]).filter(Boolean).sort()
    const teslim: string | null = t.length ? t[t.length - 1] : null
    const acik = ['beklemede', 'onaylandi', 'yolda'].includes(s.durum)
    return { ...s, ks, tutar, teslim, acik, geciken: acik && !!s.beklenen_teslim && s.beklenen_teslim < bugun }
  })
  const by: Record<string, any[]> = {}; sip.forEach(s => (by[s.tedarikci_id] ||= []).push(s))
  return d.cariTam.filter(c => c.tip === 'tedarikci').map(c => {
    const l = by[c.id] || [], gecerli = l.filter(s => s.durum !== 'iptal')
    const bitmis = gecerli.filter(s => s.durum === 'teslim_alindi' && s.teslim)
    const terminli = bitmis.filter(s => s.beklenen_teslim)
    const zamaninda = terminli.filter(s => s.teslim!.slice(0, 10) <= s.beklenen_teslim).length
    const termin = bitmis.length ? bitmis.reduce((a, s) => a + gunFarki(s.tarih, s.teslim!), 0) / bitmis.length : null
    const fiyat: Record<string, { tarih: string; fiyat: number; no: string }[]> = {}
    gecerli.forEach(s => s.ks.forEach((k: any) => { if (k.hammadde_id && +k.birim_fiyat > 0) (fiyat[k.hammadde_id] ||= []).push({ tarih: s.tarih, fiyat: +k.birim_fiyat, no: s.no }) }))
    Object.values(fiyat).forEach(a => a.sort((x, y) => x.tarih.localeCompare(y.tarih)))
    return {
      c, siparisler: l, sayi: gecerli.length, acik: gecerli.filter(s => s.acik).length, geciken: gecerli.filter(s => s.geciken).length,
      tutar: gecerli.reduce((a, s) => a + s.tutar, 0), bitmis: bitmis.length, terminli: terminli.length, zamaninda,
      oran: terminli.length ? zamaninda / terminli.length : null as number | null, termin, fiyat,
    }
  })
}
export type TedarikciIstat = ReturnType<typeof tedarikciIstatistik>[number]
