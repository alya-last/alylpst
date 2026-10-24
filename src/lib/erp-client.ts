// ERP API client — tüm çağrılar /api/erp güvenli server-side proxy üzerinden (oturum kontrollü)
import { makeClient } from './query-client'
import { fmt, fmtN, fmtDate, fmtDateTime, csvDownload } from './fmt'

const base = makeClient('/api/erp')

export const erp = {
  ...base,
  fmt,
  fmtN,
  date: fmtDate,
  dateTime: fmtDateTime,
  exportCsv: (filename: string, rows: any[]) => {
    if (!rows.length) return
    const cols = Object.keys(rows[0]).filter(c => typeof rows[0][c] !== 'object')
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = '\uFEFF' + [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
  },
  csv: csvDownload,
}
