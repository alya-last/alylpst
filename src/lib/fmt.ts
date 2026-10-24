export const fmt = (n: number, cur = 'TRY') => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cur }).format(n || 0)
export const fmtN = (n: number, d = 2) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0)
export const fmtInt = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n || 0)
// Büyük tutarlar için kısa gösterim: 1,2 Mn ₺ / 45 B ₺
export const fmtK = (n: number) => {
  const a = Math.abs(n || 0)
  if (a >= 1e6) return `${(n / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} Mn ₺`
  if (a >= 1e3) return `${(n / 1e3).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} B ₺`
  return fmt(n)
}
export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('tr-TR') : '-')
export const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('tr-TR') : '-')
export const fmtPct = (n: number) => `${(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}%`
export const todayISO = () => new Date().toISOString().split('T')[0]
export const daysBetween = (a: string | Date, b: string | Date = new Date()) => Math.floor((+new Date(b) - +new Date(a)) / 86400000)
export const csvDownload = (filename: string, rows: Record<string, any>[]) => {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = '\uFEFF' + [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}
