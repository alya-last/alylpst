// Muhasebe API client — tüm çağrılar server-side proxy (/api/muhasebe) üzerinden
import { makeClient } from './query-client'
import { fmt, fmtN, fmtDate, csvDownload } from './fmt'

const base = makeClient('/api/muhasebe')

function toCsv(rows: any[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0]).filter(c => typeof rows[0][c] !== 'object')
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
}

export const muh = {
  ...base,
  fmt,
  fmtN,
  date: fmtDate,
  exportCsv: (filename: string, rows: any[]) => {
    const csv = '\uFEFF' + toCsv(rows)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
  },
  csv: csvDownload,
}
