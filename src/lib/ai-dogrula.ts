// Model cevabındaki büyük sayıların kaynağını denetler: sistem istemi, konuşma ve araç sonuçlarında geçmeyen sayı "doğrulanamadı" sayılır.
function sayilar(metin: string): number[] {
  const out: number[] = []
  for (const t of metin.matchAll(/\d[\d.,]*/g)) {
    let s = t[0].replace(/[.,]+$/, '')
    if (!s) continue
    const hasDot = s.includes('.'), hasCom = s.includes(',')
    let v: number
    if (hasDot && hasCom) {
      const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ','
      v = parseFloat(s.split(dec === '.' ? ',' : '.').join('').replace(dec, '.'))
    } else if (hasDot || hasCom) {
      const sep = hasDot ? '.' : ','
      const parts = s.split(sep)
      v = parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3 && parts[0] !== '0')
        ? parseFloat(parts.join('')) : parseFloat(parts.join('.'))
    } else v = parseFloat(s)
    if (Number.isFinite(v)) out.push(v)
  }
  return out
}

export function dogrulanamayanSayilar(yanit: string, kaynak: string): string[] {
  const var_ = new Set<number>()
  for (const v of sayilar(kaynak)) { var_.add(Math.round(v)); var_.add(Math.floor(v)); var_.add(Math.ceil(v)) }
  const yok: string[] = []
  for (const t of yanit.matchAll(/\d[\d.,]*/g)) {
    const [v] = sayilar(t[0])
    if (v === undefined || Math.abs(v) < 1000) continue
    if (Number.isInteger(v) && v >= 1900 && v <= 2100) continue
    const r = Math.round(v)
    if (var_.has(r) || var_.has(r - 1) || var_.has(r + 1)) continue
    yok.push(t[0].replace(/[.,]+$/, ''))
  }
  return [...new Set(yok)].slice(0, 10)
}
