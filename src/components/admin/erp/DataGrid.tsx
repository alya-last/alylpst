'use client'
import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Download, Columns3, Rows3, ChevronLeft, ChevronRight, Inbox, AlertTriangle, Trash2 } from 'lucide-react'
import { SearchBox, Skeleton, Empty, Modal } from './ui'
import { csvDownload } from '@/lib/fmt'

// Türkçe harf farkını yok sayan arama: "BERİNVEST" ile "BERINVEST", "şirket" ile "SIRKET" aynı kabul edilir (İ/ı/I karışıklığı yüzünden kayıt bulunamıyordu)
const aramaKatla = (t: string) => String(t ?? '').replace(/İ/g, 'i').replace(/I/g, 'i').toLocaleLowerCase('tr').replace(/i̇/g, 'i').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')

export type Col<T> = {
  key: string
  label: string
  width?: number | string
  align?: 'left' | 'right' | 'center'
  sort?: (r: T) => any            // istemci modunda sıralama değeri
  sortKey?: string                // sunucu modunda sıralanacak kolon adı
  render?: (r: T) => ReactNode
  total?: (rows: T[]) => ReactNode // alt toplam satırı (yalnızca istemci modu)
  csv?: (r: T) => any              // CSV çıktısı
  hidden?: boolean                 // varsayılan gizli
  hideSm?: boolean                 // mobilde gizle
}

// Sunucu modu: satırlar/sıralama/arama/sayfalama veritabanında yapılır; tarayıcıya sadece görünen sayfa gelir
export type ServerMode<T> = {
  fetch: (p: { page: number; size: number; q: string; sort: { key: string; dir: 'asc' | 'desc' } | null }) => Promise<{ rows: T[]; total: number }>
  deps?: any[]        // değişince yeniden çeker (filtreler, sürüm)
  exportMax?: number  // CSV'de en fazla kaç satır (varsayılan 20.000)
}

export function DataGrid<T>({
  rows = [], cols, rowKey, loading, searchText, searchPlaceholder, filters, actions, pageSizes = [25, 50, 100, 250],
  onRowClick, activeKey, selectable, bulkActions, onBulkDelete, deleteNoun = 'kayıt', deleteNote, csvName, emptyTitle = 'Kayıt bulunamadı', emptySub, defaultSort, storageKey, rowStyle, title, footerNote, server,
}: {
  rows?: T[]; cols: Col<T>[]; rowKey: (r: T) => string; loading?: boolean
  searchText?: (r: T) => string; searchPlaceholder?: string
  filters?: ReactNode; actions?: ReactNode
  pageSizes?: number[]; onRowClick?: (r: T) => void; activeKey?: string | null
  selectable?: boolean; bulkActions?: (sel: T[], clear: () => void) => ReactNode
  // Toplu silme: verilirse satır seçimi otomatik açılır, seçim çubuğuna onaylı "Sil" butonu eklenir.
  // Fonksiyon silme işlemini yapar; hata varsa mesaj döndürür (başarıda boş/undefined). Bitince liste yenilenmelidir.
  onBulkDelete?: (sel: T[]) => Promise<string | void> | string | void
  deleteNoun?: string
  deleteNote?: ReactNode   // silme onay penceresinde ek uyarı (ör. "bakiyeler geri alınır")
  csvName?: string; emptyTitle?: string; emptySub?: string
  defaultSort?: { key: string; dir: 'asc' | 'desc' }; storageKey?: string
  rowStyle?: (r: T) => CSSProperties | undefined; title?: ReactNode; footerNote?: ReactNode
  server?: ServerMode<T>
}) {
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [sort, setSort] = useState(defaultSort || null)
  const [page, setPage] = useState(0)
  const [ps, setPs] = useState(pageSizes[0])
  const [compact, setCompact] = useState(false)
  const [hiddenCols, setHiddenCols] = useState<string[]>(cols.filter(c => c.hidden).map(c => c.key))
  const [colMenu, setColMenu] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [delOpen, setDelOpen] = useState(false)
  const [delBusy, setDelBusy] = useState(false)
  const [delErr, setDelErr] = useState('')
  const [allOpen, setAllOpen] = useState(false)
  const [allTxt, setAllTxt] = useState('')
  const [allBusy, setAllBusy] = useState(false)
  const [allErr, setAllErr] = useState('')
  // Satır seçimi tüm listelerde varsayılan açık (toplu indirme için); kapatmak için selectable={false}
  const canSelect = selectable !== false
  // sunucu modu durumu
  const [srvRows, setSrvRows] = useState<T[]>([])
  const [srvTotal, setSrvTotal] = useState(0)
  const [srvLoading, setSrvLoading] = useState(!!server)
  const [srvErr, setSrvErr] = useState('')
  const reqId = useRef(0)
  const depsKey = JSON.stringify(server?.deps ?? [])

  useEffect(() => { const t = setTimeout(() => setDq(q), server ? 350 : 180); return () => clearTimeout(t) }, [q, server])
  useEffect(() => {
    if (!storageKey) return
    try {
      const s = JSON.parse(localStorage.getItem('grid:' + storageKey) || 'null')
      if (s) { if (s.ps) setPs(s.ps); if (typeof s.compact === 'boolean') setCompact(s.compact); if (s.hiddenCols) setHiddenCols(s.hiddenCols) }
    } catch {}
  }, [storageKey])
  useEffect(() => {
    if (!storageKey) return
    try { localStorage.setItem('grid:' + storageKey, JSON.stringify({ ps, compact, hiddenCols })) } catch {}
  }, [storageKey, ps, compact, hiddenCols])
  useEffect(() => { setPage(0) }, [dq, rows.length, ps, depsKey])

  // Sunucudan sayfa çek
  useEffect(() => {
    if (!server) return
    const id = ++reqId.current
    setSrvLoading(true); setSrvErr('')
    server.fetch({ page, size: ps, q: dq, sort }).then(r => {
      if (id !== reqId.current) return
      setSrvRows(r.rows); setSrvTotal(r.total); setSrvLoading(false)
    }).catch(e => { if (id === reqId.current) { setSrvErr(e?.message || 'Veri alınamadı'); setSrvLoading(false) } })
  }, [server ? page : 0, ps, dq, sort, depsKey]) // eslint-disable-line

  const visCols = cols.filter(c => !hiddenCols.includes(c.key))

  const filtered = useMemo(() => {
    if (server) return srvRows
    let r = rows
    if (dq && searchText) { const t = aramaKatla(dq); r = r.filter(x => aramaKatla(searchText(x)).includes(t)) }
    if (sort) {
      const c = cols.find(c => c.key === sort.key)
      if (c?.sort) {
        const f = c.sort, d = sort.dir === 'asc' ? 1 : -1
        r = [...r].sort((a, b) => {
          const x = f(a), y = f(b)
          if (x == null && y == null) return 0
          if (x == null) return 1
          if (y == null) return -1
          return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'tr')) * d
        })
      }
    }
    return r
  }, [rows, dq, sort, cols, searchText, server, srvRows])

  const total = server ? srvTotal : filtered.length
  const pages = Math.max(1, Math.ceil(total / ps))
  const cur = Math.min(page, pages - 1)
  const pageRows = server ? srvRows : filtered.slice(cur * ps, cur * ps + ps)
  // İstemci modunda seçim sayfalar arası geçerlidir (filtrelenmiş tüm satırlar); sunucu modunda yalnızca yüklü sayfa
  const selRows = (server ? pageRows : filtered).filter(r => sel.has(rowKey(r)))
  const allOnPage = pageRows.length > 0 && pageRows.every(r => sel.has(rowKey(r)))
  const canSelectAll = !server && allOnPage && filtered.length > pageRows.length && selRows.length < filtered.length

  async function runBulkDelete() {
    if (!onBulkDelete || delBusy) return
    const rowsToDelete = selRows
    if (!rowsToDelete.length) { setDelOpen(false); return }
    setDelBusy(true); setDelErr('')
    try {
      const err = await onBulkDelete(rowsToDelete)
      if (err) { setDelErr(String(err)); setDelBusy(false); return }
      setSel(new Set()); setDelOpen(false)
    } catch (e: any) {
      setDelErr(e?.message || 'Silme sırasında hata oluştu')
    }
    setDelBusy(false)
  }
  // Listedeki TÜM kayıtları sil (arama/filtreden bağımsız); "sil" yazılı onay ister
  async function tumunuSil() {
    if (!onBulkDelete || allBusy || allTxt.trim().toLocaleLowerCase('tr-TR') !== 'sil') return
    setAllBusy(true); setAllErr('')
    try {
      let hepsi: T[] = rows
      if (server) {
        hepsi = []
        const max = server.exportMax ?? 20000
        for (let p = 0; hepsi.length < max; p++) {
          const r = await server.fetch({ page: p, size: 1000, q: '', sort: null })
          hepsi.push(...r.rows)
          if (r.rows.length < 1000) break
        }
      }
      if (!hepsi.length) { setAllOpen(false); setAllBusy(false); return }
      const err = await onBulkDelete(hepsi)
      if (err) { setAllErr(String(err)); setAllBusy(false); return }
      setSel(new Set()); setAllOpen(false); setAllTxt('')
    } catch (e: any) { setAllErr(e?.message || 'Silme sırasında hata oluştu') }
    setAllBusy(false)
  }
  const hasTotals = !server && visCols.some(c => c.total)
  const isLoading = server ? srvLoading : loading
  const sortable = (c: Col<T>) => (server ? !!c.sortKey : !!c.sort)

  const toggleSort = (c: Col<T>) => {
    if (!sortable(c)) return
    const key = server ? c.sortKey! : c.key
    setSort(s => !s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null)
  }
  const sortActive = (c: Col<T>) => sort?.key === (server ? c.sortKey : c.key)

  async function exportCsv() {
    let data: T[] = filtered
    if (server) {
      const max = server.exportMax ?? 20000; data = []
      for (let p = 0; p * 1000 < Math.min(max, srvTotal); p++) {
        const r = await server.fetch({ page: p, size: 1000, q: dq, sort }); data.push(...r.rows); if (r.rows.length < 1000) break
      }
    }
    const out = data.map(r => Object.fromEntries(visCols.filter(c => c.csv || c.sort).map(c => [c.label, c.csv ? c.csv(r) : c.sort!(r)])))
    csvDownload((csvName || 'liste') + '.csv', out)
  }

  // Seçili satırları CSV olarak indir (görünür sütunlar, listedeki CSV ile aynı biçim)
  function exportSelected() {
    if (!selRows.length) return
    const out = selRows.map(r => Object.fromEntries(visCols.filter(c => c.csv || c.sort).map(c => [c.label, c.csv ? c.csv(r) : c.sort!(r)])))
    if (!out.length || !Object.keys(out[0]).length) return
    csvDownload((csvName || 'liste') + '-secilenler.csv', out)
  }

  const toolbar = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--adm-bdr)' }}>
      {title && <b style={{ fontSize: 13.5, marginRight: 4 }}>{title}</b>}
      {(searchText || server) && <SearchBox value={q} onChange={setQ} placeholder={searchPlaceholder || 'Ara...'} width={230} />}
      {filters}
      <div style={{ flex: 1 }} />
      {actions}
      <div style={{ position: 'relative' }}>
        <button className="adm-btn-ghost" style={{ padding: '6px 9px' }} title="Sütunlar" onClick={() => setColMenu(v => !v)}><Columns3 size={14} /></button>
        {colMenu && (
          <>
            <div onClick={() => setColMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div style={{ position: 'absolute', right: 0, top: 36, zIndex: 41, background: 'var(--adm-s1)', border: '1px solid var(--adm-bdr2)', borderRadius: 10, padding: 8, minWidth: 180, boxShadow: '0 10px 30px rgba(0,0,0,.18)' }}>
              {cols.map(c => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', fontSize: 12.5, borderRadius: 6 }}>
                  <input type="checkbox" checked={!hiddenCols.includes(c.key)} onChange={e => setHiddenCols(h => e.target.checked ? h.filter(k => k !== c.key) : [...h, c.key])} />{c.label || c.key}
                </label>
              ))}
            </div>
          </>
        )}
      </div>
      <button className="adm-btn-ghost" style={{ padding: '6px 9px' }} title="Satır yoğunluğu" onClick={() => setCompact(v => !v)}><Rows3 size={14} /></button>
      {csvName && <button className="adm-btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={exportCsv} disabled={!total} title={server ? `En fazla ${(server.exportMax ?? 20000).toLocaleString('tr-TR')} satır` : undefined}><Download size={13} />CSV</button>}
      {canSelect && onBulkDelete && <button className="adm-btn-danger" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => { setAllErr(''); setAllTxt(''); setAllOpen(true) }} disabled={!total} title="Bu listedeki tüm kayıtları sil"><Trash2 size={13} />Tüm verileri sil</button>}
    </div>
  )

  return (
    <div className="adm-card" style={{ overflow: 'visible' }}>
      {toolbar}
      {canSelect && selRows.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'var(--adm-ac2)', fontSize: 12.5, borderBottom: '1px solid var(--adm-bdr)', flexWrap: 'wrap' }}>
          <b style={{ color: 'var(--adm-ac)' }}>{selRows.length} kayıt seçili</b>
          {canSelectAll && <button className="adm-btn-ghost" style={{ padding: '3px 9px', fontSize: 11.5 }} onClick={() => setSel(new Set(filtered.map(rowKey)))}>Listedeki {filtered.length} kaydın tamamını seç</button>}
          <button className="adm-btn-ghost" style={{ padding: '3px 12px', fontSize: 12 }} onClick={exportSelected}><Download size={12} />Seçilenleri indir (CSV)</button>
          {bulkActions?.(selRows, () => setSel(new Set()))}
          {onBulkDelete && <button className="adm-btn-danger" style={{ padding: '3px 12px', fontSize: 12 }} onClick={() => { setDelErr(''); setDelOpen(true) }}><Trash2 size={12} />Seçilenleri sil</button>}
          <button className="adm-btn-ghost" style={{ padding: '3px 9px', fontSize: 11.5, marginLeft: 'auto' }} onClick={() => setSel(new Set())}>Seçimi temizle</button>
        </div>
      )}
      {onBulkDelete && (
        <Modal open={delOpen} onClose={() => { if (!delBusy) setDelOpen(false) }} width={460} title={`${selRows.length} ${deleteNoun} silinsin mi?`}
          onSubmit={e => { e.preventDefault(); runBulkDelete() }}
          footer={<><button type="button" className="adm-btn-ghost" disabled={delBusy} onClick={() => setDelOpen(false)}>Vazgeç</button><button type="submit" className="adm-btn-danger" disabled={delBusy || !selRows.length}><Trash2 size={13} />{delBusy ? 'Siliniyor…' : `${selRows.length} ${deleteNoun} kalıcı sil`}</button></>}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>Seçilen <b>{selRows.length}</b> {deleteNoun} kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>
          {deleteNote && <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--adm-tx3)' }}>{deleteNote}</p>}
          {delErr && <div style={{ marginTop: 12, padding: '9px 12px', fontSize: 12.5, color: 'var(--adm-red)', background: 'var(--adm-red2)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}><AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} /><span>{delErr}</span></div>}
        </Modal>
      )}
      {onBulkDelete && (
        <Modal open={allOpen} onClose={() => { if (!allBusy) setAllOpen(false) }} width={460} title={`Tüm ${deleteNoun} silinsin mi?`}
          onSubmit={e => { e.preventDefault(); tumunuSil() }}
          footer={<><button type="button" className="adm-btn-ghost" disabled={allBusy} onClick={() => setAllOpen(false)}>Vazgeç</button><button type="submit" className="adm-btn-danger" disabled={allBusy || allTxt.trim().toLocaleLowerCase('tr-TR') !== 'sil'}><Trash2 size={13} />{allBusy ? 'Siliniyor…' : `Tüm ${deleteNoun} kalıcı sil`}</button></>}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>Bu listedeki <b>tüm {total.toLocaleString('tr-TR')} {deleteNoun}</b> (arama ve filtreden bağımsız) kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>
          {deleteNote && <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--adm-tx3)' }}>{deleteNote}</p>}
          <p style={{ margin: '12px 0 6px', fontSize: 12.5 }}>Onaylamak için <b>sil</b> yazın:</p>
          <input className="adm-input" style={{ width: '100%' }} value={allTxt} onChange={e => setAllTxt(e.target.value)} disabled={allBusy} autoComplete="off" autoFocus />
          {allErr && <div style={{ marginTop: 12, padding: '9px 12px', fontSize: 12.5, color: 'var(--adm-red)', background: 'var(--adm-red2)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}><AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} /><span>{allErr}</span></div>}
        </Modal>
      )}
      {srvErr && <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--adm-red)', background: 'var(--adm-red2)', display: 'flex', gap: 8, alignItems: 'center' }}><AlertTriangle size={14} />{srvErr}</div>}
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 290px)', minHeight: 120 }}>
        <table className={`adm-tbl ${compact ? 'compact' : ''}`}>
          <thead>
            <tr>
              {canSelect && <th style={{ width: 36 }}><input type="checkbox" checked={allOnPage} onChange={e => setSel(s => { const n = new Set(s); pageRows.forEach(r => e.target.checked ? n.add(rowKey(r)) : n.delete(rowKey(r))); return n })} /></th>}
              {visCols.map(c => (
                <th key={c.key} className={`${sortable(c) ? 'sortable' : ''} ${c.hideSm ? 'adm-hide-sm' : ''}`} style={{ width: c.width, textAlign: c.align || 'left' }} onClick={() => toggleSort(c)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {c.label}
                    {sortable(c) && (sortActive(c) ? (sort!.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={11} style={{ opacity: .35 }} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (!server || srvRows.length === 0)
              ? Array.from({ length: 6 }).map((_, i) => <tr key={i}>{canSelect && <td />}{visCols.map(c => <td key={c.key}><Skeleton h={12} w={`${50 + ((i * 13 + c.key.length * 7) % 40)}%`} /></td>)}</tr>)
              : pageRows.map(r => {
                const k = rowKey(r)
                return (
                  <tr key={k} className={`${onRowClick ? 'clickable' : ''} ${activeKey === k ? 'active' : ''}`} style={{ ...rowStyle?.(r), ...(server && srvLoading ? { opacity: .55 } : {}) }} onClick={() => onRowClick?.(r)}>
                    {canSelect && <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.has(k)} onChange={e => setSel(s => { const n = new Set(s); if (e.target.checked) n.add(k); else n.delete(k); return n })} /></td>}
                    {visCols.map(c => <td key={c.key} className={c.hideSm ? 'adm-hide-sm' : ''} style={{ textAlign: c.align || 'left' }}>{c.render ? c.render(r) : String(c.sort?.(r) ?? '')}</td>)}
                  </tr>
                )
              })}
          </tbody>
          {hasTotals && !isLoading && filtered.length > 0 && (
            <tfoot>
              <tr>
                {canSelect && <td />}
                {visCols.map((c, i) => <td key={c.key} className={c.hideSm ? 'adm-hide-sm' : ''} style={{ textAlign: c.align || 'left' }}>{c.total ? c.total(filtered) : i === 0 ? `Toplam (${filtered.length})` : ''}</td>)}
              </tr>
            </tfoot>
          )}
        </table>
        {!isLoading && !srvErr && total === 0 && <Empty icon={<Inbox size={30} />} title={emptyTitle} sub={emptySub ?? (dq ? 'Aramayı değiştirmeyi dene' : undefined)} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: '1px solid var(--adm-bdr)', fontSize: 12, color: 'var(--adm-tx3)', flexWrap: 'wrap' }}>
        <span>{server ? `${total.toLocaleString('tr-TR')} kayıt` : filtered.length === rows.length ? `${rows.length} kayıt` : `${filtered.length} / ${rows.length} kayıt`}</span>
        {footerNote}
        <div style={{ flex: 1 }} />
        <select className="adm-sel" value={ps} onChange={e => setPs(+e.target.value)}>{pageSizes.map(n => <option key={n} value={n}>{n} / sayfa</option>)}</select>
        <button className="adm-btn-ghost" style={{ padding: '3px 7px' }} disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft size={14} /></button>
        <span style={{ minWidth: 56, textAlign: 'center' }}>{cur + 1} / {pages.toLocaleString('tr-TR')}</span>
        <button className="adm-btn-ghost" style={{ padding: '3px 7px' }} disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><ChevronRight size={14} /></button>
      </div>
    </div>
  )
}
