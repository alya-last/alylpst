import ExcelJS from 'exceljs'
import type { Rapor } from '@/lib/muhasebe-rapor'

async function kdvListeExcel(r: Rapor) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Alya Plastik — Muhasebe AI'; wb.created = new Date()
  const ws = wb.addWorksheet('İndirilecek KDV Listesi')
  const thin = { style: 'thin' as const }, border = { top: thin, left: thin, bottom: thin, right: thin }
  const font = { name: 'Arial', size: 10 }
  ws.getCell('H2').value = 'İNDİRİLECEK KDV LİSTESİ'; ws.getCell('H2').font = { ...font, bold: true, size: 12 }
  let rn = 4
  for (const b of r.bolumler) {
    if (rn > 4) { ws.getCell(rn, 1).value = b.baslik; ws.getCell(rn, 1).font = { ...font, bold: true }; rn++ }
    const h = ws.getRow(rn); b.kolonlar.forEach((k, i) => { const c = h.getCell(i + 1); c.value = k; c.font = { ...font, bold: true }; c.border = border; c.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } } })
    h.height = 54; rn++
    for (const s of b.satirlar) {
      const row = ws.getRow(rn++), toplam = s[4] === 'TOPLAM'
      s.forEach((v, i) => { const c = row.getCell(i + 1); c.value = v === '' ? null : v; c.font = { ...font, bold: toplam }; c.border = border; if (typeof v === 'number' && i >= 8) c.numFmt = '#,##0.00' })
    }
    rn += 2
  }
  ws.columns = [6, 13, 7, 14, 38, 14, 34, 14, 16, 14, 18, 16, 16, 12, 18].map(width => ({ width }))
  return wb.xlsx.writeBuffer()
}

export async function raporExcelBuffer(r: Rapor) {
  if (r.tip === 'kdv_liste') return kdvListeExcel(r)
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
