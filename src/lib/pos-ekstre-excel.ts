import ExcelJS from 'exceljs'
import type { PosSatir } from '@/lib/pos-ekstre'

const gt = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`

// Muhasebe programındaki "pos kredi kart" ekstresiyle aynı sütunlar + beklenen yatış ve durum.
export async function posEkstreBuffer(p: { satirlar: PosSatir[]; borc: number; alacak: number; bakiye: number }) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Alya Plastik'; wb.created = new Date()
  const ws = wb.addWorksheet('pos kredi kart')
  const h = ws.addRow(['TARİH', 'EVRAK TİPİ', 'CİNSİ', 'VADE GÜN', 'B/A', 'ANA DÖVİZ BORÇ', 'ANA DÖVİZ ALACAK', 'ANA DÖVİZ BORÇ BAKİYE', 'KARŞI HESAP İSMİ', 'BEKLENEN YATIŞ', 'DURUM'])
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  h.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2F2B' } } })
  for (const s of p.satirlar) {
    const r = ws.addRow([gt(s.tarih), s.evrak, s.cinsi, s.vade_gun, s.ba, s.borc || 0, s.alacak || 0, s.bakiye, s.karsi, s.beklenen_yatis ? gt(s.beklenen_yatis) : '', s.durum])
    if (s.durum === 'Bekliyor') r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4D6' } } })
  }
  const t = ws.addRow(['TOPLAM', '', '', '', '', p.borc, p.alacak, p.bakiye, 'Bankaya geçmeyi bekleyen', '', '']); t.font = { bold: true }
  for (const c of ['F', 'G', 'H']) ws.getColumn(c).numFmt = '#,##0.00'
  ws.columns.forEach((c, i) => { c.width = [12, 26, 18, 10, 8, 16, 16, 20, 46, 16, 10][i] || 14 })
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  return wb.xlsx.writeBuffer()
}
