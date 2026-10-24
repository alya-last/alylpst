import { daysBetween } from './fmt'

// Kur farkı / kapama kayıtları gibi kâr-zarar dışı muhasebe hareketleri
export const NON_PNL = ['Virman', 'Fatura Kapama', 'Bakiye Düzeltme', 'Açılış Bakiyesi', 'Kur Farkı Geliri', 'Kur Farkı Gideri']
export const isPnl = (i: any) => !NON_PNL.includes(i.kategori)

export const CHART_COLORS = ['#e55f28', '#2f7dd6', '#14b088', '#c9821c', '#8b5cf6', '#e14b4b', '#06b6d4', '#84cc16', '#ec4899', '#64748b']

const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export type Donem = 'bu_ay' | 'gecen_ay' | '3ay' | 'yil' | 'tumu'
export const DONEMLER: { v: Donem; l: string }[] = [
  { v: 'bu_ay', l: 'Bu Ay' }, { v: 'gecen_ay', l: 'Geçen Ay' }, { v: '3ay', l: 'Son 3 Ay' }, { v: 'yil', l: 'Bu Yıl' }, { v: 'tumu', l: 'Tümü' },
]

export function donemAralik(d: Donem) {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth()
  const som = (yy: number, mm: number) => new Date(yy, mm, 1)
  const eom = (yy: number, mm: number) => new Date(yy, mm + 1, 0)
  switch (d) {
    case 'bu_ay':    return { from: iso(som(y, m)), to: iso(n), pFrom: iso(som(y, m - 1)), pTo: iso(eom(y, m - 1)) }
    case 'gecen_ay': return { from: iso(som(y, m - 1)), to: iso(eom(y, m - 1)), pFrom: iso(som(y, m - 2)), pTo: iso(eom(y, m - 2)) }
    case '3ay':      return { from: iso(som(y, m - 2)), to: iso(n), pFrom: iso(som(y, m - 5)), pTo: iso(eom(y, m - 3)) }
    case 'yil':      return { from: `${y}-01-01`, to: iso(n), pFrom: `${y - 1}-01-01`, pTo: `${y - 1}-${pad(m + 1)}-${pad(n.getDate())}` }
    default:         return { from: null as string | null, to: null as string | null, pFrom: null as string | null, pTo: null as string | null }
  }
}
export const inRange = (t: string | null | undefined, from: string | null, to: string | null) => !!t && (!from || t >= from) && (!to || t <= to)

export function sonAylar(n = 12) {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)
    return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: d.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }) }
  })
}
export const ayAnahtar = (t: string) => t.slice(0, 7)

export const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + (+f(r) || 0), 0)
export const pctDelta = (cur: number, prev: number) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : cur ? 100 : 0)

// Faturada kalan (tahsil edilmemiş/ödenmemiş) tutar
export const kalanTutar = (f: any) => Math.max((+f.toplam || 0) - (+f.odenen_tutar || 0), 0)
export const acikFatura = (f: any) => f.durum === 'onaylandi'

// Yaşlandırma kovaları: vadesi geçmiş gün sayısına göre
export const AGING = [
  { k: 'guncel', l: 'Vadesi gelmedi', color: '#14b088' },
  { k: 'd30', l: '1–30 gün', color: '#c9821c' },
  { k: 'd60', l: '31–60 gün', color: '#e55f28' },
  { k: 'd90', l: '61–90 gün', color: '#e14b4b' },
  { k: 'd90p', l: '90+ gün', color: '#8b1d1d' },
]
export function agingKova(f: any) {
  const ref = f.vade || f.tarih
  const gec = daysBetween(ref, new Date())
  return gec <= 0 ? 'guncel' : gec <= 30 ? 'd30' : gec <= 60 ? 'd60' : gec <= 90 ? 'd90' : 'd90p'
}
export function agingBuckets(faturalar: any[]) {
  const out: Record<string, number> = { guncel: 0, d30: 0, d60: 0, d90: 0, d90p: 0 }
  faturalar.forEach(f => { out[agingKova(f)] += kalanTutar(f) })
  return AGING.map(a => ({ label: a.l, value: out[a.k], color: a.color }))
}
