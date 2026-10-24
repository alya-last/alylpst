import type { SupabaseClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'

// "Yıllık satışlar" dosyasının düzeni: Stok kodu | Stok ismi | Satış miktarı | Birimi | Stok adedi | (her ay: adet + satış belge değeri) | Toplam belge değeri.
// Satışlar satis_adetleri'nden, stok adedi satis_kod_stok'tan gelir; kullanıcının oturumu (RLS) ile okunur.
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
export type Mekan = 'dis' | 'ic'
type Satir = { kod: string; ad: string; birim: string; stok: number; adet: number[]; tutar: number[] }

async function hepsi(q: (bas: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const out: any[] = []
  for (let bas = 0; bas < 20000; bas += 1000) {
    const r = await q(bas); if (r.error) throw new Error(r.error.message)
    out.push(...(r.data || [])); if ((r.data || []).length < 1000) break
  }
  return out
}

export async function satisTablosu(sb: SupabaseClient, mekan: Mekan, yil = 2026) {
  const [satis, stok] = await Promise.all([
    hepsi(b => sb.from('satis_adetleri').select('kod,ad,ay,adet,tutar').eq('yil', yil).eq('mekan', mekan).order('id').range(b, b + 999)),
    hepsi(b => sb.from('satis_kod_stok').select('kod,ad,birim,stok').eq('mekan', mekan).order('kod').range(b, b + 999)),
  ])
  const son = Math.max(9, ...satis.map(s => +s.ay || 0)), map = new Map<string, Satir>()
  const al = (kod: string, ad: string): Satir => {
    const k = String(kod).trim(); let s = map.get(k)
    if (!s) { s = { kod: k, ad: String(ad || '').replace(/\s+/g, ' ').trim(), birim: 'ADET', stok: 0, adet: Array(12).fill(0), tutar: Array(12).fill(0) }; map.set(k, s) }
    return s
  }
  for (const x of stok) { const s = al(x.kod, x.ad); s.ad = String(x.ad || s.ad).replace(/\s+/g, ' ').trim(); s.birim = x.birim || 'ADET'; s.stok = +x.stok || 0 }
  for (const x of satis) { const s = al(x.kod, x.ad), i = (+x.ay || 1) - 1; s.adet[i] += +x.adet || 0; s.tutar[i] += +x.tutar || 0 }
  const satirlar = [...map.values()].sort((a, b) => (a.kod < b.kod ? -1 : a.kod > b.kod ? 1 : 0))
  return { satirlar, son: Math.min(12, son) }
}

export async function satisExcelBuffer(sb: SupabaseClient, mekanlar: Mekan[], yil = 2026) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Alya Plastik'; wb.created = new Date()
  for (const mekan of mekanlar) {
    const { satirlar, son } = await satisTablosu(sb, mekan, yil)
    const ws = wb.addWorksheet(mekan === 'dis' ? 'Dış Mekan' : 'İç Mekan', { views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] })
    const baslik = ['Stok kodu', 'Stok ismi', 'Satış miktarı', 'Birimi', 'Stok adedi']
    for (let i = 0; i < son; i++) baslik.push(AYLAR[i], `${AYLAR[i]} satış belge`)
    baslik.push('TÜM AYLAR TOP.SAT. BELG.DEĞ')
    const h = ws.addRow(baslik); h.height = 30
    h.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2F2B' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true } })
    const r2 = (n: number) => Math.round(n * 100) / 100
    const topA = Array(son).fill(0), topT = Array(son).fill(0); let topAdet = 0, topStok = 0, topTutar = 0
    for (const s of satirlar) {
      const adetT = s.adet.slice(0, son).reduce((t, v) => t + v, 0), tutarT = s.tutar.slice(0, son).reduce((t, v) => t + v, 0)
      const r = [s.kod, s.ad, adetT, s.birim, s.stok]
      for (let i = 0; i < son; i++) { r.push(s.adet[i], r2(s.tutar[i])); topA[i] += s.adet[i]; topT[i] += s.tutar[i] }
      r.push(r2(tutarT)); topAdet += adetT; topStok += s.stok; topTutar += tutarT
      ws.addRow(r)
    }
    const t: (string | number)[] = ['', '', topAdet, '', topStok]
    for (let i = 0; i < son; i++) t.push(topA[i], r2(topT[i]))
    t.push(r2(topTutar))
    const tr = ws.addRow(t); tr.font = { bold: true }
    tr.eachCell(c => { c.border = { top: { style: 'thin' } } })
    ws.getColumn(1).width = 14; ws.getColumn(2).width = 52; ws.getColumn(3).width = 14; ws.getColumn(4).width = 9; ws.getColumn(5).width = 12
    for (let c = 6; c <= baslik.length; c++) { ws.getColumn(c).width = c === baslik.length ? 22 : 14; ws.getColumn(c).numFmt = '#,##0.##' }
    ws.getColumn(3).numFmt = '#,##0'; ws.getColumn(5).numFmt = '#,##0'
  }
  return wb.xlsx.writeBuffer()
}
