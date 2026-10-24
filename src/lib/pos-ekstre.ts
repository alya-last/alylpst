// POS (müşteri kredi kartı) tahsilatlarını muhasebe programındaki ekstre biçiminde (Borç / Alacak / Bakiye) döker.
// Borç = POS'tan tahsilat yapıldı (bankaya henüz geçmedi), Alacak = bankaya yattı. Son bakiye = bankaya geçmeyi bekleyen tutar.
export type PosKayit = { tarih: string; musteri: string; tutar: number | string; ekstre_vade_gun: number | null; beklenen_tarih: string; durum: string; yatis_tarihi: string | null }
export type PosSatir = {
  tarih: string; evrak: string; cinsi: string; vade_gun: number | null; ba: 'Borç' | 'Alacak'
  borc: number; alacak: number; bakiye: number; karsi: string; beklenen_yatis: string | null; durum: string
}
export const POS_BANKA = 'GARANTİ BBVA BANKASI A.Ş.'
const r2 = (n: number) => Math.round(n * 100) / 100
const g = (s: string) => String(s).slice(0, 10)

export function posEkstre(kayitlar: PosKayit[]): { satirlar: PosSatir[]; borc: number; alacak: number; bakiye: number } {
  const ev: { t: string; sira: number; s: Omit<PosSatir, 'bakiye'> }[] = []
  kayitlar.forEach((k, i) => {
    const tutar = r2(+k.tutar || 0)
    ev.push({ t: g(k.tarih), sira: 0, s: { tarih: g(k.tarih), evrak: 'Tahsilat makbuzu', cinsi: 'Müşt.kredi kartı', vade_gun: k.ekstre_vade_gun ?? null, ba: 'Borç', borc: tutar, alacak: 0, karsi: k.musteri.trim(), beklenen_yatis: k.durum === 'bekliyor' ? g(k.beklenen_tarih) : null, durum: k.durum === 'yatti' ? 'Yattı' : 'Bekliyor' } })
    if (k.durum === 'yatti' && k.yatis_tarihi) ev.push({ t: g(k.yatis_tarihi), sira: 1, s: { tarih: g(k.yatis_tarihi), evrak: 'Bankaya gelen havale fişi', cinsi: 'Nakit', vade_gun: 0, ba: 'Alacak', borc: 0, alacak: tutar, karsi: POS_BANKA, beklenen_yatis: null, durum: 'Yattı' } })
  })
  ev.sort((a, b) => a.t.localeCompare(b.t) || a.sira - b.sira)
  let bak = 0
  const satirlar = ev.map(e => { bak = r2(bak + e.s.borc - e.s.alacak); return { ...e.s, bakiye: bak } })
  const borc = r2(satirlar.reduce((t, s) => t + s.borc, 0)), alacak = r2(satirlar.reduce((t, s) => t + s.alacak, 0))
  return { satirlar, borc, alacak, bakiye: r2(borc - alacak) }
}
