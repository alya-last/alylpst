import { muh } from '@/lib/muhasebe-client'

// Kasa/banka hesapları TRY, USD, EUR veya RUB olabilir. Hesabın bakiyesi KENDİ para biriminde tutulur; işlemin `tutar` alanı her zaman
// TL karşılığıdır (raporlar ve cari bakiye buna göre çalışır), `doviz_tutari` + `kur` ise döviz hesabındaki gerçek tutardır.
export const PB = ['TRY', 'USD', 'EUR', 'RUB'] as const
export type Pb = (typeof PB)[number]
export const PB_AD: Record<Pb, string> = { TRY: 'Türk Lirası (₺)', USD: 'ABD Doları ($)', EUR: 'Euro (€)', RUB: 'Rus Rublesi (₽)' }
export const PB_SIM: Record<Pb, string> = { TRY: '₺', USD: '$', EUR: '€', RUB: '₽' }
export const kasaPb = (k: any): Pb => (k?.para_birimi === 'USD' || k?.para_birimi === 'EUR' || k?.para_birimi === 'RUB' ? k.para_birimi : 'TRY')
export const trKasa = (k: any) => kasaPb(k) === 'TRY'
const yuvarla = (n: number) => Math.round(n * 100) / 100

/** doviz_kurlari tablosundan güncel kurlar ({TRY:1, USD?, EUR?, RUB?}). */
export async function kurlariYukle(): Promise<Record<string, number>> {
  const rows = await muh.all('doviz_kurlari', '*').catch(() => [])
  const o: Record<string, number> = { TRY: 1 }
  for (const r of rows) if (+r.kur > 0) o[r.para_birimi] = +r.kur
  return o
}

/** Bir kasa hareketi için insert alanları. tutarKasa: hesabın KENDİ para biriminde tutar; kur: 1 döviz = ? TL. */
export function islemAlan(kasa: any, tutarKasa: number, kur?: number): { tutar: number; doviz_tutari?: number; kur?: number } {
  if (kasaPb(kasa) === 'TRY') return { tutar: yuvarla(tutarKasa) }
  if (!(kur && kur > 0)) throw new Error(`${kasaPb(kasa)} için kur gerekli (Kasa/Banka → Döviz Kurları)`)
  return { tutar: yuvarla(tutarKasa * kur), doviz_tutari: yuvarla(tutarKasa), kur }
}

export const paraGoster = (n: number, pb: string = 'TRY') => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: pb }).format(n || 0)
