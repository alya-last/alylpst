import ExcelJS from 'exceljs'

type Fuar = { id: string; yil: number; ad: string; tarih: string | null; tur: string | null; maliyet_tl: number | null; katilim_tutar: number | null; para_birimi: string | null; destek_tutar: number | null; destek_durum: string | null; destek_gelis_tarihi: string | null }
type Odeme = { fuar_id: string; tarih: string; tutar: number; para_birimi: string }

const gt = (d?: string | null) => (d ? `${String(d).slice(8, 10)}.${String(d).slice(5, 7)}.${String(d).slice(0, 4)}` : '')
const DURUM: Record<string, string> = { alindi: 'Alındı', bekliyor: 'Bekliyor', yok: 'Teşvik yok', bilinmiyor: 'Kayıt yok' }
const TUR: Record<string, string> = { yurt_ici: 'Yurt içi', yurt_disi: 'Yurt dışı', pazar_arastirmasi: 'Pazar araştırması' }
const dolgu = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } })
const TL = '#,##0.00'

// Sade fuar listesi: yıl başlıkları, her fuar tek satır, yıl sonunda toplam. Döviz bedelleri TL ile toplanmaz.
export async function fuarBuffer(fuarlar: Fuar[], odemeler: Odeme[]) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Alya Plastik'; wb.created = new Date()
  const ws = wb.addWorksheet('Fuarlar', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] })
  const basliklar = ['Fuar', 'Tür', 'Tarih', 'Maliyet (TL)', 'Katılım bedeli', 'Ödenen', 'Kalan', 'Destek (TL)', 'Destek durumu', 'Destek geliş tarihi', 'Net maliyet (TL)']
  const genis = [38, 16, 12, 16, 16, 16, 16, 16, 15, 17, 17]
  ws.columns = genis.map(width => ({ width }))
  const h = ws.addRow(basliklar); h.height = 24
  h.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = dolgu('FF2B2F2B'); c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true } })
  const r2 = (n: number) => Math.round(n * 100) / 100
  const yillar = [...new Set(fuarlar.map(f => f.yil))].sort()
  for (const y of yillar) {
    const l = fuarlar.filter(f => f.yil === y)
    const b = ws.addRow([`${y}`]); b.height = 22; ws.mergeCells(b.number, 1, b.number, basliklar.length)
    b.getCell(1).font = { bold: true, size: 12 }; b.getCell(1).fill = dolgu('FFE8EEE6'); b.getCell(1).alignment = { vertical: 'middle' }
    for (const f of l) {
      const o = odemeler.filter(x => x.fuar_id === f.id), pb = f.para_birimi || 'TL', kayit = o.length > 0
      const odenen = o.filter(x => x.para_birimi === pb).reduce((t, x) => t + (+x.tutar || 0), 0)
      const alinan = f.destek_durum === 'alindi' ? +(f.destek_tutar || 0) : 0
      const r = ws.addRow([
        f.ad, TUR[f.tur || ''] || '', gt(f.tarih), f.maliyet_tl == null ? '' : +f.maliyet_tl,
        f.katilim_tutar == null ? '' : `${(+f.katilim_tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${pb}`,
        kayit ? `${odenen.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${pb}` : 'ödeme kaydı yok',
        kayit && f.katilim_tutar != null ? `${r2(+f.katilim_tutar - odenen).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${pb}` : '',
        f.destek_tutar == null ? '' : +f.destek_tutar, DURUM[f.destek_durum || ''] || '', gt(f.destek_gelis_tarihi),
        f.maliyet_tl == null ? '' : r2(+f.maliyet_tl - alinan),
      ])
      r.eachCell(c => { c.alignment = { vertical: 'middle', horizontal: 'left' }; c.border = { bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } } } })
      for (const k of [4, 8, 11]) { r.getCell(k).numFmt = TL; r.getCell(k).alignment = { vertical: 'middle', horizontal: 'right' } }
      if (f.destek_durum === 'bekliyor') r.getCell(9).fill = dolgu('FFFFF4D6')
      if (f.destek_durum === 'alindi') r.getCell(9).fill = dolgu('FFE3F4E1')
      if (!kayit && f.katilim_tutar != null) r.getCell(6).font = { italic: true, color: { argb: 'FF8A8A8A' } }
    }
    const al = l.filter(f => f.destek_durum === 'alindi'), bk = l.filter(f => f.destek_durum === 'bekliyor')
    const mal = l.reduce((t, f) => t + (+(f.maliyet_tl || 0)), 0), dal = al.reduce((t, f) => t + (+(f.destek_tutar || 0)), 0), dbk = bk.reduce((t, f) => t + (+(f.destek_tutar || 0)), 0)
    const t = ws.addRow([`${y} toplamı`, '', '', r2(mal), '', '', '', r2(dal + dbk), `Alınan ${r2(dal).toLocaleString('tr-TR')} · Bekleyen ${r2(dbk).toLocaleString('tr-TR')}`, '', r2(mal - dal)])
    t.font = { bold: true }; t.eachCell(c => { c.border = { top: { style: 'thin' } } })
    for (const k of [4, 8, 11]) t.getCell(k).numFmt = TL
    ws.addRow([])
  }
  const wo = wb.addWorksheet('Ödemeler', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] })
  wo.columns = [{ width: 38 }, { width: 8 }, { width: 14 }, { width: 18 }, { width: 10 }]
  const ho = wo.addRow(['Fuar', 'Yıl', 'Ödeme tarihi', 'Tutar', 'Para']); ho.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = dolgu('FF2B2F2B') })
  for (const x of odemeler.slice().sort((p, q) => String(p.tarih).localeCompare(String(q.tarih)))) {
    const f = fuarlar.find(z => z.id === x.fuar_id); if (!f) continue
    const r = wo.addRow([f.ad, f.yil, gt(x.tarih), +x.tutar, x.para_birimi]); r.getCell(4).numFmt = TL
  }
  return wb.xlsx.writeBuffer()
}
