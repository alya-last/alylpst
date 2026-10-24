'use client'
import { useAcParam } from '@/lib/ac-param'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { muh } from '@/lib/muhasebe-client'
import { fmtN, fmtDateTime } from '@/lib/fmt'
import { Page, PageHead, Card, Kpi, KpiGrid, Badge, Empty, Modal, Field, FormGrid, useToast } from '@/components/admin/erp/ui'
import {
  ScanLine, Boxes, Package, ArrowDownCircle, ArrowUpCircle, ClipboardCheck, Camera, Trash2, Plus, Minus, AlertTriangle,
  Volume2, VolumeX, Link2, History, Save, Search, Zap,
} from 'lucide-react'

type Mode = 'giris' | 'cikis' | 'sayim'
type Item = { id: string; pid?: string; tip: 'variant' | 'hammadde'; ad: string; kod?: string; barkod?: string; birim: string; stok: number; min?: number; ondalik: boolean }
type Line = { key: string; item: Item; miktar: number }

const MODES: { v: Mode; l: string; k: string; Icon: any; color: string; help: string }[] = [
  { v: 'giris', l: 'Stok Girişi', k: 'F1', Icon: ArrowDownCircle, color: 'var(--adm-green)', help: 'Okutulan her ürün stoğa eklenir' },
  { v: 'cikis', l: 'Stok Çıkışı', k: 'F2', Icon: ArrowUpCircle, color: 'var(--adm-red)', help: 'Okutulan her ürün stoktan düşer' },
  { v: 'sayim', l: 'Sayım', k: 'F3', Icon: ClipboardCheck, color: 'var(--adm-blue)', help: 'Saydığın miktar sistem stoğunun yerine yazılır, fark otomatik hareket olur' },
]

export default function BarkodPage() {
  const toast = useToast()
  const [catalog, setCatalog] = useState<Item[]>([])
  const [depolar, setDepolar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('giris')
  const [lines, setLines] = useState<Line[]>([])
  const [input, setInput] = useState('')
  const [note, setNote] = useState('')
  const [depo, setDepo] = useState('')
  const [negOk, setNegOk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sound, setSound] = useState(true)
  const [hata, setHata] = useState('')
  const [unknown, setUnknown] = useState<string | null>(null)
  const [camOpen, setCamOpen] = useState(false)
  const [recent, setRecent] = useState<any[]>([])
  const [prodBarkod, setProdBarkod] = useState<{ barkod: string; product_id: string; ad: string }[]>([])
  const [lastScan, setLastScan] = useState<{ ad: string; ts: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const audio = useRef<AudioContext | null>(null)

  const beep = useCallback((ok: boolean) => {
    if (!sound) return
    try {
      audio.current = audio.current || new (window.AudioContext || (window as any).webkitAudioContext)()
      const c = audio.current, o = c.createOscillator(), g = c.createGain()
      o.frequency.value = ok ? 1040 : 200; o.type = ok ? 'sine' : 'square'
      g.gain.setValueAtTime(0.08, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (ok ? 0.12 : 0.3))
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + (ok ? 0.12 : 0.3))
    } catch {}
  }, [sound])

  const load = useCallback(async () => {
    const [pv, prods, ham, dep, mov] = await Promise.all([
      muh.from('product_variants').select('id,product_id,name,color,size,stock,barkod'),
      muh.from('products').select('id,code,name,barkod'),
      erp.from('hammaddeler').select('id,kod,ad,birim,mevcut_stok,min_stok,barkod,aktif'),
      erp.from('depolar').select('id,ad').order('ad', { ascending: true }),
      erp.from('stok_hareketleri').select('*').eq('kaynak_tablo', 'barkod').order('created_at', { ascending: false }).limit(40),
    ])
    const pmap: Record<string, any> = {}; (prods.data || []).forEach((p: any) => pmap[p.id] = p)
    const items: Item[] = [
      ...(pv.data || []).map((v: any): Item => {
        const p = pmap[v.product_id]
        const nm = [p?.name, v.name, v.color, v.size].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(' · ')
        return { id: v.id, pid: v.product_id, tip: 'variant', ad: nm || v.name, kod: p?.code, barkod: v.barkod || undefined, birim: 'adet', stok: +v.stock || 0, ondalik: false }
      }),
      ...(ham.data || []).filter((h: any) => h.aktif !== false).map((h: any): Item => ({
        id: h.id, tip: 'hammadde', ad: h.ad, kod: h.kod, barkod: h.barkod || undefined, birim: h.birim || 'kg', stok: +h.mevcut_stok || 0, min: +h.min_stok || 0, ondalik: true,
      })),
    ]
    setCatalog(items); setDepolar(dep.data || []); setRecent(mov.data || []); setLoading(false)
    // ürün seviyesinde barkod — tek varyantlıysa o varyanta eşlenir
    setProdBarkod((prods.data || []).filter((p: any) => p.barkod).map((p: any) => ({ barkod: p.barkod, product_id: p.id, ad: p.name })))
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { inputRef.current?.focus() }, [mode, loading])

  const byKey = useMemo(() => Object.fromEntries(catalog.map(i => [i.tip + i.id, i])), [catalog])
  const kritik = catalog.filter(i => i.tip === 'hammadde' && i.min && i.stok <= i.min)

  const addItem = useCallback((item: Item, qty = 1) => {
    setLines(ls => {
      const ix = ls.findIndex(l => l.item.tip === item.tip && l.item.id === item.id)
      if (ix >= 0) { const n = [...ls]; n[ix] = { ...n[ix], miktar: +(n[ix].miktar + qty).toFixed(3) }; return n }
      return [{ key: item.tip + item.id, item, miktar: qty }, ...ls]
    })
    setLastScan({ ad: item.ad, ts: Date.now() }); setHata(''); setUnknown(null); beep(true)
  }, [beep])

  const process = useCallback((raw: string) => {
    let code = raw.trim(); if (!code) return
    let qty = 1
    const m = code.match(/^(\d+(?:[.,]\d+)?)\*(.+)$/)     // 12*8690000000000  → 12 adet
    if (m) { qty = +m[1].replace(',', '.'); code = m[2].trim() }
    const lc = code.toLocaleLowerCase('tr')
    const exact = catalog.find(i => i.barkod === code) || catalog.find(i => i.kod?.toLocaleLowerCase('tr') === lc)
    if (exact) { addItem(exact, qty); return }
    const pb = prodBarkod.find(p => p.barkod === code)
    if (pb) {
      const cand = catalog.filter(i => i.tip === 'variant' && i.pid === pb.product_id)
      if (cand.length === 1) { addItem(cand[0], qty); return }
      setHata(cand.length ? `“${pb.ad}” ürününün ${cand.length} varyantı var — aşağıdan varyantı seç` : `“${pb.ad}” ürününün stok varyantı yok. Önce Ürünler → Varyantlar'dan varyant ekle.`)
      setInput(pb.ad); beep(false); return
    }
    // sadece rakamsa ve uzunsa → kayıtsız barkod; değilse isim araması olarak bırak
    if (/^\d{6,}$/.test(code)) { setUnknown(code); setHata(''); beep(false) }
    else { const hits = catalog.filter(i => i.ad.toLocaleLowerCase('tr').includes(lc)); if (hits.length === 1) addItem(hits[0], qty); else { setHata(hits.length ? '' : 'Eşleşen ürün bulunamadı'); if (!hits.length) beep(false) } }
  }, [catalog, addItem, beep, prodBarkod])

  function submit(e: React.FormEvent) { e.preventDefault(); process(input); setInput('') }

  const suggestions = useMemo(() => {
    const t = input.trim().toLocaleLowerCase('tr').replace(/^\d+(?:[.,]\d+)?\*/, '')
    if (t.length < 2 || /^\d{8,}$/.test(t)) return []
    return catalog.filter(i => i.ad.toLocaleLowerCase('tr').includes(t) || i.kod?.toLocaleLowerCase('tr').includes(t) || i.barkod?.includes(t)).slice(0, 7)
  }, [input, catalog])

  // Kayıtsız barkodu mevcut bir kaleme ata
  async function barkodAta(item: Item) {
    if (!unknown) return
    const r: any = item.tip === 'variant'
      ? await muh.from('product_variants').update({ barkod: unknown }).eq('id', item.id)
      : await erp.from('hammaddeler').update({ barkod: unknown }).eq('id', item.id)
    if (r?.error) { toast.show('Atama başarısız: ' + r.error, true); return }
    const kod = unknown
    setCatalog(c => c.map(i => i.tip === item.tip && i.id === item.id ? { ...i, barkod: kod } : i))
    addItem({ ...item, barkod: kod }); toast.show(`${kod} barkodu “${item.ad}” kaydına atandı`); setUnknown(null)
  }

  const setQty = (key: string, v: number) => setLines(ls => ls.map(l => l.key === key ? { ...l, miktar: Math.max(0, v) } : l))
  const rm = (key: string) => setLines(ls => ls.filter(l => l.key !== key))

  // Kaydedilecek hareketler
  const plan = lines.map(l => {
    const fark = mode === 'sayim' ? +(l.miktar - l.item.stok).toFixed(3) : mode === 'giris' ? l.miktar : -l.miktar
    const sonra = mode === 'sayim' ? l.miktar : +(l.item.stok + fark).toFixed(3)
    return { l, fark, sonra, eksi: sonra < 0, dusuk: !!l.item.min && sonra <= (l.item.min || 0) }
  })
  const eksiVar = plan.some(p => p.eksi)
  const yapilacak = plan.filter(p => p.fark !== 0)

  async function kaydet() {
    if (!yapilacak.length) { toast.show('Kaydedilecek stok değişimi yok', true); return }
    if (eksiVar && !negOk) { toast.show('Eksi stoğa düşen kalem var — düzelt ya da “eksi stoğa izin ver” işaretle', true); return }
    setSaving(true)
    const rows = yapilacak.map(p => ({
      tip: mode === 'sayim' ? 'sayim' : 'manuel_duzeltme',
      yon: p.fark > 0 ? 'giris' : 'cikis',
      miktar: Math.abs(p.fark),
      ...(p.l.item.tip === 'variant' ? { variant_id: p.l.item.id } : { hammadde_id: p.l.item.id, ...(depo ? { depo_id: depo } : {}) }),
      kaynak_tablo: 'barkod',
      aciklama: `Barkod terminali — ${MODES.find(m => m.v === mode)!.l}${note ? ` · ${note}` : ''}`,
    }))
    const r: any = await erp.from('stok_hareketleri').insert(rows)
    setSaving(false)
    if (r?.error) { toast.show('Kayıt başarısız: ' + r.error, true); return }
    toast.show(`${rows.length} kalem işlendi`)
    setLines([]); setNote(''); setNegOk(false); await load(); inputRef.current?.focus()
  }

  // Klavye kısayolları
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); setMode('giris') }
      else if (e.key === 'F2') { e.preventDefault(); setMode('cikis') }
      else if (e.key === 'F3') { e.preventDefault(); setMode('sayim') }
      else if (e.key === 'F9' || (e.ctrlKey && e.key === 'Enter')) { e.preventDefault(); kaydet() }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  })

  const cur = MODES.find(m => m.v === mode)!
  const todayMov = recent.filter(r => new Date(r.created_at).toDateString() === new Date().toDateString())
  const toplamAdet = lines.reduce((s, l) => s + l.miktar, 0)

  useAcParam(!loading, id => { const it = catalog.find(i => i.tip === 'variant' && i.id === id); if (it) addItem(it) })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Barkod Terminali" />
      <Page>
        <PageHead title="Hızlı Stok Terminali" sub="El terminali, USB barkod okuyucu veya kamera ile toplu giriş / çıkış / sayım"
          actions={<>
            <button className="adm-btn-ghost" onClick={() => setSound(s => !s)} title="Ses">{sound ? <Volume2 size={14} /> : <VolumeX size={14} />}</button>
            <button className="adm-btn-ghost" onClick={() => setCamOpen(true)}><Camera size={14} />Kamerayla Tara</button>
          </>} />

        <KpiGrid min={170}>
          <Kpi label="Sepetteki Kalem" value={lines.length} sub={`${fmtN(toplamAdet, 0)} birim`} Icon={ScanLine} color="var(--adm-ac)" />
          <Kpi label="Bugün Terminal İşlemi" value={todayMov.length} sub="stok hareketi" Icon={Zap} color="var(--adm-blue)" />
          <Kpi label="Kritik Stok" value={kritik.length} sub={kritik.length ? kritik.slice(0, 2).map(k => k.ad).join(', ') : 'Sorun yok'} Icon={AlertTriangle} color={kritik.length ? 'var(--adm-red)' : 'var(--adm-green)'} />
          <Kpi label="Katalog" value={catalog.length} sub={`${catalog.filter(c => c.barkod).length} barkodlu kalem`} Icon={Boxes} color="var(--adm-green)" />
        </KpiGrid>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16 }} className="brk-grid">
          <style>{`@media(min-width:1000px){.brk-grid{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)!important}}`}</style>

          {/* SOL: tarama + sepet */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <div className="adm-card" style={{ padding: 16, borderColor: cur.color }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {MODES.map(m => (
                  <button key={m.v} onClick={() => setMode(m.v)} style={{
                    flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                    border: `1.5px solid ${mode === m.v ? m.color : 'var(--adm-bdr)'}`, background: mode === m.v ? m.color : 'var(--adm-s1)', color: mode === m.v ? '#fff' : 'var(--adm-tx2)', transition: 'all .12s',
                  }}><m.Icon size={16} />{m.l}<span className="adm-kbd" style={{ opacity: .8, background: 'transparent', color: 'inherit', borderColor: 'currentColor' }}>{m.k}</span></button>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--adm-tx3)', margin: '0 0 10px' }}>{cur.help}. Miktar için <span className="adm-kbd">12*barkod</span> yazabilirsin.</p>
              <form onSubmit={submit} style={{ position: 'relative' }}>
                <ScanLine size={18} style={{ position: 'absolute', left: 14, top: 15, color: cur.color }} />
                <input ref={inputRef} className="adm-inp" autoFocus autoComplete="off" value={input} onChange={e => { setInput(e.target.value); setHata('') }}
                  placeholder="Barkod okut, ürün kodu ya da ürün adı yaz — Enter"
                  style={{ paddingLeft: 42, fontSize: 16, height: 48, fontFamily: 'JetBrains Mono, monospace', borderColor: hata ? 'var(--adm-red)' : undefined }} />
                {suggestions.length > 0 && (
                  <div style={{ position: 'absolute', left: 0, right: 0, top: 54, zIndex: 20, background: 'var(--adm-s1)', border: '1px solid var(--adm-bdr2)', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,.16)', overflow: 'hidden' }}>
                    {suggestions.map(s => (
                      <button type="button" key={s.tip + s.id} onClick={() => { addItem(s); setInput(''); inputRef.current?.focus() }}
                        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '9px 14px', border: 'none', background: 'transparent', fontFamily: 'inherit', textAlign: 'left', borderBottom: '1px solid var(--adm-bdr)' }}>
                        {s.tip === 'variant' ? <Package size={14} style={{ color: 'var(--adm-ac)' }} /> : <Boxes size={14} style={{ color: 'var(--adm-blue)' }} />}
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{s.ad}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{s.kod || s.barkod || ''}</span>
                        <Badge tone="muted">{fmtN(s.stok, s.ondalik ? 2 : 0)} {s.birim}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </form>
              {hata && <p style={{ color: 'var(--adm-red)', fontSize: 12.5, margin: '10px 0 0' }}>{hata}</p>}
              {lastScan && Date.now() - lastScan.ts < 4000 && <p style={{ color: 'var(--adm-green)', fontSize: 12.5, margin: '10px 0 0' }}>✓ {lastScan.ad} eklendi</p>}

              {unknown && (
                <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: 'var(--adm-amber2)', border: '1px solid var(--adm-amber)' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--adm-amber)', display: 'flex', alignItems: 'center', gap: 6 }}><Link2 size={14} />Kayıtsız barkod: <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{unknown}</span></p>
                  <p style={{ fontSize: 12, color: 'var(--adm-tx2)', margin: '4px 0 10px' }}>Bu barkodu mevcut bir ürün/hammaddeye ata; bir daha okutunca otomatik bulunur.</p>
                  <UnknownPicker catalog={catalog} onPick={barkodAta} onCancel={() => setUnknown(null)} />
                </div>
              )}
            </div>

            <Card title={<><ScanLine size={14} />Sepet ({lines.length})</>} right={lines.length > 0 && <button className="adm-btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setLines([])}><Trash2 size={12} />Temizle</button>}>
              {lines.length === 0 ? <Empty icon={<ScanLine size={32} />} title="Sepet boş" sub="Barkod okut ya da yukarıdan ürün ara" /> : (
                <div style={{ overflow: 'auto' }}>
                  <table className="adm-tbl">
                    <thead><tr><th>Kalem</th><th style={{ textAlign: 'right' }}>Mevcut</th><th style={{ textAlign: 'center', width: 160 }}>{mode === 'sayim' ? 'Sayılan' : 'Miktar'}</th><th style={{ textAlign: 'right' }}>Sonra</th><th style={{ width: 36 }} /></tr></thead>
                    <tbody>
                      {plan.map(({ l, fark, sonra, eksi, dusuk }) => (
                        <tr key={l.key} style={eksi ? { background: 'var(--adm-red2)' } : undefined}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {l.item.tip === 'variant' ? <Package size={14} style={{ color: 'var(--adm-ac)' }} /> : <Boxes size={14} style={{ color: 'var(--adm-blue)' }} />}
                              <div><div style={{ fontWeight: 600 }}>{l.item.ad}</div><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{l.item.kod || l.item.barkod}</div></div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono,monospace' }}>{fmtN(l.item.stok, l.item.ondalik ? 2 : 0)} {l.item.birim}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                              <button className="adm-btn-ghost" style={{ padding: '4px 7px' }} onClick={() => setQty(l.key, l.miktar - 1)}><Minus size={12} /></button>
                              <input type="number" step={l.item.ondalik ? '0.001' : '1'} className="adm-inp" value={l.miktar} onChange={e => setQty(l.key, +e.target.value)} style={{ width: 74, textAlign: 'center', padding: '5px 6px', fontWeight: 700 }} />
                              <button className="adm-btn-ghost" style={{ padding: '4px 7px' }} onClick={() => setQty(l.key, l.miktar + 1)}><Plus size={12} /></button>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, color: eksi ? 'var(--adm-red)' : 'var(--adm-tx)' }}>{fmtN(sonra, l.item.ondalik ? 2 : 0)}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: fark > 0 ? 'var(--adm-green)' : fark < 0 ? 'var(--adm-red)' : 'var(--adm-tx3)' }}>{fark > 0 ? '+' : ''}{fmtN(fark, l.item.ondalik ? 2 : 0)}</div>
                            {(eksi || dusuk) && <Badge tone={eksi ? 'red' : 'amber'}>{eksi ? 'Eksi stok' : 'Kritik seviye'}</Badge>}
                          </td>
                          <td><button onClick={() => rm(l.key)} style={{ background: 'none', border: 'none', color: 'var(--adm-tx3)' }}><Trash2 size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: 16, borderTop: '1px solid var(--adm-bdr)', display: 'grid', gap: 12 }}>
                    <FormGrid>
                      <Field label="Not / Referans (opsiyonel)"><input className="adm-inp" value={note} onChange={e => setNote(e.target.value)} placeholder="İrsaliye no, sayım tarihi..." /></Field>
                      <Field label="Depo (hammadde için)">
                        <select className="adm-inp" value={depo} onChange={e => setDepo(e.target.value)}><option value="">Belirtme</option>{depolar.map((d: any) => <option key={d.id} value={d.id}>{d.ad}</option>)}</select>
                      </Field>
                    </FormGrid>
                    {eksiVar && <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: 'var(--adm-red)' }}><input type="checkbox" checked={negOk} onChange={e => setNegOk(e.target.checked)} />Eksi stoğa düşen kalemler var — yine de işle</label>}
                    <button className="adm-btn" onClick={kaydet} disabled={saving || !yapilacak.length} style={{ justifyContent: 'center', padding: '12px 0', fontSize: 14, background: cur.color }}>
                      <Save size={15} />{saving ? 'İşleniyor...' : `${yapilacak.length} kalemi işle`} <span className="adm-kbd" style={{ background: 'transparent', color: '#fff', borderColor: '#fff8' }}>F9</span>
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* SAĞ: geçmiş + kritik */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {kritik.length > 0 && (
              <Card title={<><AlertTriangle size={14} style={{ color: 'var(--adm-red)' }} />Kritik Stok</>}>
                {kritik.slice(0, 6).map(k => (
                  <div key={k.id} className="adm-row" style={{ padding: '9px 16px' }}>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{k.ad}</span>
                    <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono,monospace', color: 'var(--adm-red)', fontWeight: 700 }}>{fmtN(k.stok)} / {fmtN(k.min || 0)} {k.birim}</span>
                    <button className="adm-btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => { setMode('giris'); addItem(k, 1) }}>Girişe ekle</button>
                  </div>
                ))}
              </Card>
            )}
            <Card title={<><History size={14} />Terminal Geçmişi</>} right={<span style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>son 40 hareket</span>}>
              {recent.length === 0 ? <Empty icon={<History size={28} />} title="Henüz terminal işlemi yok" /> : (
                <div style={{ maxHeight: 520, overflow: 'auto' }}>
                  {recent.map((r: any) => {
                    const it = r.variant_id ? byKey['variant' + r.variant_id] : byKey['hammadde' + r.hammadde_id]
                    return (
                      <div key={r.id} className="adm-row" style={{ padding: '10px 16px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: r.yon === 'giris' ? 'var(--adm-green2)' : 'var(--adm-red2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {r.yon === 'giris' ? <ArrowDownCircle size={14} style={{ color: 'var(--adm-green)' }} /> : <ArrowUpCircle size={14} style={{ color: 'var(--adm-red)' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it?.ad || 'Silinmiş kalem'}</div>
                          <div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{fmtDateTime(r.created_at)}{r.tip === 'sayim' ? ' · sayım' : ''}</div>
                        </div>
                        <b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13, color: r.yon === 'giris' ? 'var(--adm-green)' : 'var(--adm-red)' }}>{r.yon === 'giris' ? '+' : '-'}{fmtN(r.miktar, 0)}</b>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </Page>

      <CameraModal open={camOpen} onClose={() => setCamOpen(false)} onCode={c => process(c)} />
      {toast.node}
    </div>
  )
}

function UnknownPicker({ catalog, onPick, onCancel }: { catalog: Item[]; onPick: (i: Item) => void; onCancel: () => void }) {
  const [q, setQ] = useState('')
  const res = q.length < 1 ? catalog.filter(c => !c.barkod).slice(0, 6) : catalog.filter(c => c.ad.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')) || c.kod?.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))).slice(0, 8)
  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Search size={13} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--adm-tx3)' }} />
        <input className="adm-inp" style={{ paddingLeft: 32 }} placeholder="Atanacak ürün / hammadde ara..." value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {res.map(r => <button key={r.tip + r.id} className="adm-chip" onClick={() => onPick(r)}>{r.tip === 'variant' ? <Package size={12} /> : <Boxes size={12} />}{r.ad}</button>)}
        {res.length === 0 && <span style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>Sonuç yok</span>}
        <button className="adm-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={onCancel}>Vazgeç</button>
      </div>
    </div>
  )
}

// Tarayıcı içi kamera ile barkod okuma (BarcodeDetector destekleyen tarayıcılar: Chrome/Edge/Android)
function CameraModal({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (c: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!open) return
    let stream: MediaStream | null = null, raf = 0, stop = false, last = '', lastT = 0
    ;(async () => {
      const BD = (window as any).BarcodeDetector
      if (!BD) { setErr('Bu tarayıcı kamerayla barkod okumayı desteklemiyor. Chrome/Edge (Android veya masaüstü) kullan ya da USB okuyucuya geç.'); return }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (video.current) { video.current.srcObject = stream; await video.current.play() }
        const det = new BD({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'itf'] })
        const tick = async () => {
          if (stop) return
          try {
            const codes = await det.detect(video.current!)
            const c = codes[0]?.rawValue
            if (c && (c !== last || Date.now() - lastT > 2000)) { last = c; lastT = Date.now(); onCode(c) }
          } catch {}
          raf = requestAnimationFrame(tick)
        }
        tick()
      } catch { setErr('Kamera açılamadı. Tarayıcıdan kamera iznini kontrol et.') }
    })()
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); setErr('') }
  }, [open, onCode])
  return (
    <Modal open={open} onClose={onClose} title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Camera size={16} />Kamerayla Barkod Oku</span>} width={520}
      footer={<button className="adm-btn-ghost" onClick={onClose}>Kapat</button>}>
      {err ? <p style={{ color: 'var(--adm-red)', fontSize: 13 }}>{err}</p> : (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
          <video ref={video} playsInline muted style={{ width: '100%', display: 'block', maxHeight: 360, objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: '30% 12%', border: '2px solid var(--adm-ac)', borderRadius: 10, boxShadow: '0 0 0 999px rgba(0,0,0,.35)' }} />
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--adm-tx3)', marginTop: 10 }}>Okunan her barkod sepete eklenir. İşin bitince kapat.</p>
    </Modal>
  )
}
