// TCMB günlük kur XML'i (https://www.tcmb.gov.tr/kurlar/today.xml) — döviz SATIŞ kuru (ForexSelling) kullanılır.
export type TcmbKur = { USD?: number; EUR?: number; RUB?: number; tarih?: string }

export function tcmbCozumle(xml: string): TcmbKur {
  const out: TcmbKur = {}
  const tarih = /<Tarih_Date[^>]*\sTarih="([^"]+)"/.exec(xml)?.[1] || /<Tarih_Date[^>]*\sDate="([^"]+)"/.exec(xml)?.[1]
  if (tarih) out.tarih = tarih
  for (const kod of ['USD', 'EUR', 'RUB'] as const) {
    const blok = new RegExp(`<Currency[^>]*\\sKod="${kod}"[^>]*>([\\s\\S]*?)</Currency>`).exec(xml)?.[1]
    const v = blok && /<ForexSelling>\s*([0-9.,]+)\s*<\/ForexSelling>/.exec(blok)?.[1]
    const n = v ? Number(v.replace(',', '.')) : NaN
    if (n > 0 && n < 10000) out[kod] = n
  }
  return out
}
