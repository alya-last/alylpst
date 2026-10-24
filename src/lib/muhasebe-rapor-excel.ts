import ExcelJS from 'exceljs'
import type { Rapor } from '@/lib/muhasebe-rapor'

export async function raporExcelBuffer(r: Rapor) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Alya Plastik — Muhasebe AI'; wb.created = new Date()
  const ws = wb.addWorksheet('Rapor')
  ws.addRow([r.baslik]).font = { bold: true, size: 14 }
  ws.addRow([`Dönem: ${r.bas} – ${r.bit}`, `Oluşturma: ${r.olusturma.slice(0, 16).replace('T', ' ')} UTC`]).font = { color: { argb: 'FF666666' } }
  ws.addRow([])
  let enGenis = 8
  for (const b of r.bolumler) {
    ws.addRow([b.baslik]).font = { bold: true, size: 12 }
    const h = ws.addRow(b.kolonlar); h.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    h.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2F2B' } } })
    for (const s of b.satirlar) {
      const row = ws.addRow(s)
      row.eachCell((c, i) => { if (typeof c.value === 'number') c.numFmt = Number.isInteger(c.value) ? '#,##0' : '#,##0.00'; if (b.sayisalKolonlar?.includes(i - 1)) c.alignment = { horizontal: 'right' } })
    }
    enGenis = Math.max(enGenis, b.kolonlar.length)
    ws.addRow([])
  }
  ws.addRow(['Notlar']).font = { bold: true, size: 12 }
  for (const n of r.notlar) ws.addRow([n]).font = { italic: true, color: { argb: 'FF666666' } }
  ws.columns = Array.from({ length: enGenis }, (_, i) => ({ width: i === 0 ? 46 : 20 }))
  return wb.xlsx.writeBuffer()
}
