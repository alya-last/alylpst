'use client'
import { useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { web } from '@/lib/web-data'
import { erp } from '@/lib/erp-client'
import { useUretim, byId, rezerveMap } from '@/lib/uretim-utils'
import { fmt, fmtInt } from '@/lib/fmt'
import { sum } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Modal, Field, FormGrid, Card, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { topluSilCalistir } from '@/lib/toplu-sil'
import { Plus, Pencil, Trash2, Layers, Package, ClipboardCheck, Wand2, AlertTriangle, Boxes, ImagePlus, RotateCcw } from 'lucide-react'
import { aiIstek } from '@/lib/ai-client'

const GORSEL_STIL = { studyo: 'Stüdyo', yasam: 'Yaşam alanı' } as const
type GorselStil = keyof typeof GORSEL_STIL

const RENKLER = [['Beyaz', '#ffffff'], ['Siyah', '#0b0e0b'], ['Kırmızı', '#f25757'], ['Mavi', '#4ea8f0'], ['Yeşil', '#22d3a0'], ['Sarı', '#f0d043'], ['Turuncu', '#e55f28'], ['Gri', '#9090a8'], ['Kahverengi', '#8b5a2b'], ['Antrasit', '#3a3f47'], ['Şeffaf', '#e6f0f5'],
  // Eski sitede (alyaplastik.com) ürün renk fotoğraflarından gelen ek renk adları/kodları.
  ['Bej', '#e7ceb2'], ['Mint Yeşili', '#a2c4c9'], ['Buz Mavisi', '#caeaff'], ['Mürdüm', '#37154e'], ['Lila', '#8e7cc3'],
  ['Sütlü Kahve', '#b48457'], ['Kum', '#b48457'], ['Haki', '#777522'], ['Bordo', '#a10000'], ['Lacivert', '#191970'],
  ['Koyu Yeşil', '#013220'], ['Fildişi', '#e8e5dd'], ['Açık Bej', '#efe3cb'], ['Kırık Beyaz', '#f5f5f0'], ['Krem', '#f5edd6'], ['Pembe', '#ffc6c6']]
const RENK_HEX: Record<string, string> = Object.fromEntries(RENKLER.map(([ad, hex]) => [ad.toLowerCase(), hex]))
const renkHex = (ad: string) => RENK_HEX[(ad || '').toLowerCase()]
const bos = { product_id: '', name: '', color: '', hex: '', gorsel: '', size: '', barkod: '', sort_order: '0', acilis: '' }

export default function AdminVaryantlarPage() {
  const toast = useToast()
  const { d, loading, reload } = useUretim(['variants', 'products', 'rezerveRows', 'fiyatKalemleri', 'fiyatListeleri', 'hammaddeler'])
  const [tab, setTab] = useState('hepsi')
  const [urunF, setUrunF] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(bos)
  const [sayim, setSayim] = useState<any>(null)
  const [uret, setUret] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [varyantAi, setVaryantAi] = useState<{ v: any; stil: GorselStil; b64: string | null; busy: boolean } | null>(null)
  const [topluVaryantAi, setTopluVaryantAi] = useState<{
    stil: GorselStil; varyantlar: any[]; clear: () => void; asama: 'ayar' | 'uretim' | 'onay'; calisiyor: boolean
    durum: Record<string, 'bekliyor' | 'isleniyor' | 'tamam' | 'hata'>; sonuc: Record<string, string>; secili: Record<string, boolean>
  } | null>(null)

  const urun = useMemo(() => byId(d.products), [d.products])
  const rez = useMemo(() => rezerveMap(d.rezerveRows), [d.rezerveRows])
  const varsListe = d.fiyatListeleri.find((l: any) => l.varsayilan)?.id
  const rows = useMemo(() => d.variants.map((v: any) => ({ ...v, urunAd: urun[v.product_id]?.name || '—', urunKod: urun[v.product_id]?.code, rezerve: rez[v.id] || 0, fiyat: d.fiyatKalemleri.find((k: any) => k.variant_id === v.id && k.fiyat_listesi_id === varsListe)?.fiyat })), [d, urun, rez, varsListe])
  const varyantsiz = d.products.filter((p: any) => !d.variants.some((v: any) => v.product_id === p.id))
  const liste = rows.filter((v: any) => (!urunF || v.product_id === urunF) && (tab === 'hepsi' || (tab === 'tukenen' ? +v.stock <= 0 : tab === 'barkodsuz' ? !v.barkod : tab === 'acik' ? v.stock - v.rezerve < 0 : true)))
  const barkodVar = (b: string, haric?: string) => !!b && (d.variants.some((v: any) => v.barkod === b && v.id !== haric) || d.hammaddeler.some((h: any) => h.barkod === b))

  const openNew = (pid = '') => { setEditing(null); setForm({ ...bos, product_id: pid || urunF }); setModal(true) }
  const openEdit = (v: any) => { setEditing(v); setForm({ product_id: v.product_id, name: v.name, color: v.color || '', hex: v.hex || '', gorsel: v.gorsel || '', size: v.size || '', barkod: v.barkod || '', sort_order: String(v.sort_order || 0), acilis: '' }); setModal(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (!form.product_id) return toast.show('Ürün seç', true)
    if (barkodVar(form.barkod, editing?.id)) return toast.show('Bu barkod başka bir varyant/hammaddede kayıtlı', true)
    if (d.variants.some((v: any) => v.id !== editing?.id && v.product_id === form.product_id && v.name.toLowerCase() === form.name.trim().toLowerCase() && (v.color || '') === form.color && (v.size || '') === form.size)) return toast.show('Bu ürün için aynı varyant zaten var', true)
    setBusy(true)
    try {
      const p: any = { product_id: form.product_id, name: form.name.trim(), color: form.color || null, hex: form.hex || null, gorsel: form.gorsel || null, size: form.size || null, barkod: form.barkod || null, sort_order: +form.sort_order || 0 }
      if (editing) { const { error } = await web.from('product_variants').update(p).eq('id', editing.id); if (error) throw new Error(error.message) }
      else {
        const { data, error } = await web.from('product_variants').insert({ ...p, stock: 0 }).select(); if (error) throw new Error(error.message)
        const ac = +form.acilis
        if (ac > 0 && data?.[0]) await erp.from('stok_hareketleri').insert({ tip: 'manuel_duzeltme', yon: 'giris', variant_id: data[0].id, miktar: ac, kaynak_tablo: 'manuel', aciklama: 'Açılış stoğu' })
      }
      setModal(false); toast.show(editing ? 'Varyant güncellendi' : 'Varyant eklendi'); await reload()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }
  async function topluSil(sel: any[]): Promise<string | void> {
    const { silinen, hata } = await topluSilCalistir(sel, async (r: any) => (+r.stock !== 0 ? `${r.urunAd} — ${r.name}: stoğu var, önce sayımla sıfırla` : (await web.from('product_variants').delete().eq('id', r.id)).error?.message), 'varyant')
    reload()
    if (hata) return hata
    toast.show(`${silinen} varyant silindi`)
  }
  async function sil(v: any) {
    const kc: any = await erp.from('satis_siparisi_kalemleri').select('id', { count: 'exact', head: true }).eq('variant_id', v.id)
    const kul = kc?.count || 0
    if (+v.stock !== 0) return toast.show(`Stoğu ${fmtInt(v.stock)} — önce sayım ile sıfırla`, true)
    if (kul && !confirm(`Bu varyant ${kul} sipariş kaleminde geçiyor; silinirse kalemlerde varyant bağı kalkar. Devam?`)) return
    if (!kul && !confirm(`${v.urunAd} — ${v.name} silinsin mi?`)) return
    const { error } = await web.from('product_variants').delete().eq('id', v.id)
    if (error) return toast.show(error.message, true)
    toast.show('Varyant silindi'); reload()
  }
  async function sayimKaydet(e: React.FormEvent) {
    e.preventDefault(); if (!sayim || busy) return
    const yeni = +sayim.miktar, fark = yeni - (+sayim.v.stock || 0)
    if (!fark) return toast.show('Sayım sistem stoğuyla aynı', true)
    setBusy(true)
    const r: any = await erp.from('stok_hareketleri').insert({ tip: 'sayim', yon: fark > 0 ? 'giris' : 'cikis', variant_id: sayim.v.id, miktar: Math.abs(fark), kaynak_tablo: 'manuel', aciklama: sayim.not || 'Sayım düzeltmesi' })
    setBusy(false)
    if (r?.error) return toast.show(r.error, true)
    setSayim(null); toast.show('Stok düzeltildi'); reload()
  }
  async function standartOlustur(ps: any[]) {
    setBusy(true)
    for (const p of ps) await web.from('product_variants').insert({ product_id: p.id, name: 'Standart', stock: 0, sort_order: 0 })
    setBusy(false); toast.show(`${ps.length} ürüne “Standart” varyant eklendi`); reload()
  }
  // Renk × beden matrisi
  async function matrisOlustur(e: React.FormEvent) {
    e.preventDefault(); if (!uret?.product_id) return
    const renkler: string[] = uret.renkler.length ? uret.renkler : ['']
    const bedenler: string[] = uret.bedenler.split(',').map((s: string) => s.trim()).filter(Boolean); if (!bedenler.length) bedenler.push('')
    const yeni: any[] = []; let sira = d.variants.filter((v: any) => v.product_id === uret.product_id).length
    renkler.forEach(r => bedenler.forEach(b => {
      const ad = [r, b].filter(Boolean).join(' / ') || 'Standart'
      if (!d.variants.some((v: any) => v.product_id === uret.product_id && (v.color || '') === r && (v.size || '') === b)) yeni.push({ product_id: uret.product_id, name: ad, color: r || null, hex: r ? renkHex(r) || null : null, size: b || null, stock: 0, sort_order: sira++ })
    }))
    if (!yeni.length) return toast.show('Tüm kombinasyonlar zaten mevcut', true)
    setBusy(true); const { error } = await web.from('product_variants').insert(yeni); setBusy(false)
    if (error) return toast.show(error.message, true)
    setUret(null); toast.show(`${yeni.length} varyant oluşturuldu`); reload()
  }

  // AI: tek bir varyantın renk fotoğrafını yeniden tasarla (yalnızca arka plan değişir, renk/şekil korunur)
  function varyantAiAc(v: any) {
    if (!v.gorsel) return toast.show('Bu varyantın önce bir fotoğrafı olmalı', true)
    varyantAiUretIcin(v, 'studyo')
  }
  async function varyantAiUretIcin(v: any, stil: GorselStil) {
    setVaryantAi({ v, stil, b64: null, busy: true })
    try {
      const r: any = await aiIstek('urun_gorsel_tasarim', { url: v.gorsel, stil })
      setVaryantAi({ v, stil, b64: r.b64, busy: false })
    } catch (e: any) { toast.show(e.message, true); setVaryantAi(null) }
  }
  async function varyantAiKaydet() {
    if (!varyantAi?.b64) return
    setBusy(true)
    try {
      await aiIstek('varyant_gorsel_kaydet', { variant_id: varyantAi.v.id, b64: varyantAi.b64 })
      setVaryantAi(null); toast.show('Varyant fotoğrafı güncellendi'); reload()
    } catch (e: any) { toast.show(e.message, true) }
    setBusy(false)
  }

  // AI: toplu — seçili varyantların (fotoğrafı olanların) hepsi sırayla yeniden tasarlanır, önce önizleme ızgarası gösterilir
  function topluVaryantAiAc(sel: any[], clear: () => void) {
    const varyantlar = sel.filter(v => v.gorsel)
    if (!varyantlar.length) return toast.show('Seçili varyantların hiçbirinde fotoğraf yok', true)
    setTopluVaryantAi({ stil: 'studyo', varyantlar, clear, asama: 'ayar', calisiyor: false, durum: {}, sonuc: {}, secili: {} })
  }
  async function topluVaryantAiUret() {
    setTopluVaryantAi(t => t && { ...t, asama: 'uretim', calisiyor: true })
    const t0 = topluVaryantAi; if (!t0) return
    let limitDoldu = false
    for (const v of t0.varyantlar) {
      if (limitDoldu) break
      setTopluVaryantAi(t => t && { ...t, durum: { ...t.durum, [v.id]: 'isleniyor' } })
      try {
        const r: any = await aiIstek('urun_gorsel_tasarim', { url: v.gorsel, stil: t0.stil })
        setTopluVaryantAi(t => t && { ...t, durum: { ...t.durum, [v.id]: 'tamam' }, sonuc: { ...t.sonuc, [v.id]: r.b64 }, secili: { ...t.secili, [v.id]: true } })
      } catch (e: any) {
        setTopluVaryantAi(t => t && { ...t, durum: { ...t.durum, [v.id]: 'hata' } })
        if (/saatlik sınır/i.test(e.message || '')) { limitDoldu = true; toast.show('Saatlik AI görsel sınırına ulaşıldı — kalan varyantlar işlenmedi, bir saat sonra tekrar deneyebilirsin.', true) }
      }
    }
    setTopluVaryantAi(t => t && { ...t, asama: 'onay', calisiyor: false })
  }
  async function topluVaryantAiKaydet() {
    if (!topluVaryantAi) return
    const secilenler = topluVaryantAi.varyantlar.filter(v => topluVaryantAi.durum[v.id] === 'tamam' && topluVaryantAi.secili[v.id])
    if (!secilenler.length) return toast.show('Kaydedilecek fotoğraf seçmedin', true)
    setTopluVaryantAi(t => t && { ...t, calisiyor: true })
    let basarili = 0, hatali = 0
    for (const v of secilenler) {
      try { await aiIstek('varyant_gorsel_kaydet', { variant_id: v.id, b64: topluVaryantAi.sonuc[v.id] }); basarili++ }
      catch { hatali++ }
    }
    toast.show(hatali ? `${basarili} varyant güncellendi, ${hatali} tanesi kaydedilemedi` : `${basarili} varyantın fotoğrafı güncellendi`, !!hatali)
    topluVaryantAi.clear(); setTopluVaryantAi(null); reload()
  }

  const cols: Col<any>[] = [
    { key: 'urun', label: 'Ürün', sort: v => v.urunAd, render: v => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{urun[v.product_id]?.image_url ? <img src={urun[v.product_id].image_url} alt="" style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 7, background: 'var(--adm-s2)', padding: 2 }} /> : <Package size={16} style={{ color: 'var(--adm-tx3)' }} />}<div><div style={{ fontWeight: 600 }}>{v.urunAd}</div><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{v.urunKod}</div></div></div> },
    { key: 'ad', label: 'Varyant', sort: v => v.name, render: v => <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {v.gorsel ? <img src={v.gorsel} alt="" style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 5, background: 'var(--adm-s2)', border: '1px solid var(--adm-bdr2)' }} />
        : v.color && <i style={{ width: 12, height: 12, borderRadius: 6, border: '1px solid var(--adm-bdr2)', background: v.hex || renkHex(v.color) || '#ccc', display: 'inline-block' }} />}
      {v.name}{v.size && <Badge tone="muted">{v.size}</Badge>}</div> },
    { key: 'barkod', label: 'Barkod', sort: v => v.barkod || '', render: v => v.barkod ? <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{v.barkod}</span> : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true },
    { key: 'stok', label: 'Stok', align: 'right', sort: v => +v.stock, render: v => <b style={{ fontFamily: 'JetBrains Mono,monospace', color: +v.stock <= 0 ? 'var(--adm-red)' : undefined }}>{fmtInt(v.stock)}</b>, total: rs => fmtInt(sum(rs, (v: any) => v.stock)) },
    { key: 'rez', label: 'Rezerve', align: 'right', sort: v => v.rezerve, render: v => v.rezerve ? <span style={{ color: 'var(--adm-amber)', fontWeight: 600 }}>{fmtInt(v.rezerve)}</span> : '—', hideSm: true },
    { key: 'serbest', label: 'Satılabilir', align: 'right', sort: v => v.stock - v.rezerve, render: v => <b style={{ fontFamily: 'JetBrains Mono,monospace', color: v.stock - v.rezerve < 0 ? 'var(--adm-red)' : 'var(--adm-green)' }}>{fmtInt(v.stock - v.rezerve)}</b>, hideSm: true },
    { key: 'fiyat', label: 'Fiyat', align: 'right', sort: v => +v.fiyat || 0, render: v => v.fiyat != null ? fmt(v.fiyat) : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true },
    { key: 'act', label: '', width: 150, align: 'right', render: v => <span style={{ display: 'inline-flex', gap: 4 }}>
      {v.gorsel && <button className="adm-btn-ghost" style={{ padding: '4px 8px' }} title="AI ile stüdyoya çevir" onClick={() => varyantAiAc(v)}><ImagePlus size={12} /></button>}
      <button className="adm-btn-ghost" style={{ padding: '4px 8px' }} title="Sayım / stok düzelt" onClick={() => setSayim({ v, miktar: String(v.stock), not: '' })}><ClipboardCheck size={12} /></button>
      <button className="adm-btn-ghost" style={{ padding: '4px 8px' }} onClick={() => openEdit(v)}><Pencil size={12} /></button><button className="adm-btn-danger" style={{ padding: '4px 8px' }} onClick={() => sil(v)}><Trash2 size={12} /></button></span> },
  ]

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Ürün Varyantları" />
      <Page>
        <PageHead title="Stok Varyantları" sub="Renk / beden / model bazlı mamul stoğu — stok hareketleri defter üzerinden yönetilir" actions={<><button className="adm-btn-ghost" onClick={() => setUret({ product_id: urunF, renkler: [], bedenler: '' })}><Wand2 size={14} />Renk × Beden Üret</button><button className="adm-btn" onClick={() => openNew()}><Plus size={14} />Varyant Ekle</button></>} />
        <KpiGrid min={180}>
          <Kpi label="Varyant" value={d.variants.length} Icon={Layers} color="var(--adm-ac)" sub={`${d.products.length - varyantsiz.length}/${d.products.length} ürün kapsanıyor`} />
          <Kpi label="Toplam Stok" value={fmtInt(sum(d.variants, (v: any) => v.stock))} Icon={Boxes} color="var(--adm-green)" sub="mamul (adet)" />
          <Kpi label="Tükenen" value={d.variants.filter((v: any) => +v.stock <= 0).length} Icon={AlertTriangle} color="var(--adm-red)" sub="stok ≤ 0" onClick={() => setTab('tukenen')} />
          <Kpi label="Varyantsız Ürün" value={varyantsiz.length} Icon={Package} color={varyantsiz.length ? 'var(--adm-amber)' : 'var(--adm-green)'} sub="stok takip edilemiyor" />
          <Kpi label="Barkodsuz" value={d.variants.filter((v: any) => !v.barkod).length} Icon={Layers} color="var(--adm-blue)" sub="barkod terminali için gerekli" onClick={() => setTab('barkodsuz')} />
        </KpiGrid>

        {varyantsiz.length > 0 && (
          <Card title={<><AlertTriangle size={14} style={{ color: 'var(--adm-amber)' }} />Varyantı olmayan ürünler ({varyantsiz.length})</>} right={<button className="adm-btn" style={{ padding: '4px 12px', fontSize: 12 }} disabled={busy} onClick={() => standartOlustur(varyantsiz)}><Wand2 size={12} />Hepsine “Standart” varyant ekle</button>} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 14 }}>{varyantsiz.map((p: any) => <button key={p.id} className="adm-chip" onClick={() => openNew(p.id)}>{p.name}<Plus size={11} /></button>)}</div>
          </Card>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <Tabs value={tab} onChange={setTab} tabs={[{ v: 'hepsi', l: 'Tümü', n: d.variants.length }, { v: 'tukenen', l: 'Tükenen', n: d.variants.filter((v: any) => +v.stock <= 0).length }, { v: 'acik', l: 'Karşılanamayan', n: rows.filter((v: any) => v.stock - v.rezerve < 0).length }, { v: 'barkodsuz', l: 'Barkodsuz', n: d.variants.filter((v: any) => !v.barkod).length }]} />
          <select className="adm-sel" value={urunF} onChange={e => setUrunF(e.target.value)}><option value="">Tüm ürünler</option>{d.products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </div>
        <DataGrid rows={liste} cols={cols} rowKey={v => v.id} loading={loading} onBulkDelete={topluSil} deleteNoun="varyant" deleteNote="Stoğu sıfır olmayan varyantlar atlanır. Sipariş kaleminde geçen varyantlarda kalemdeki varyant bağı kalkar." csvName="varyantlar" storageKey="varyantlar" searchText={v => `${v.urunAd} ${v.urunKod || ''} ${v.name} ${v.barkod || ''}`} searchPlaceholder="Ürün, varyant, barkod..." emptyTitle="Varyant bulunamadı" selectable
          bulkActions={(sel, clear) => <button className="adm-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => topluVaryantAiAc(sel, clear)}><ImagePlus size={12} />AI ile Stüdyoya Çevir</button>}
          footerNote={<span>· Stok değişikliği için sayım (✓) düğmesini kullan; hareket defterine yazılır</span>} />
      </Page>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={save} width={560} title={editing ? 'Varyantı Düzenle' : 'Yeni Varyant'}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <FormGrid>
          <Field label="Ürün *" span={2}><select className="adm-inp" required disabled={!!editing} value={form.product_id} onChange={e => setForm((f: any) => ({ ...f, product_id: e.target.value }))}><option value="">Seçin</option>{d.products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Varyant adı *"><input className="adm-inp" required value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Standart / Beyaz / 5 lt" /></Field>
          <Field label="Beden / boyut"><input className="adm-inp" value={form.size} onChange={e => setForm((f: any) => ({ ...f, size: e.target.value }))} /></Field>
          <Field label="Renk" span={2}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="adm-inp" value={form.color} onChange={e => setForm((f: any) => ({ ...f, color: e.target.value, hex: renkHex(e.target.value) || f.hex }))} placeholder="Seç veya yaz" style={{ flex: 1 }} />
              <input type="color" value={form.hex || '#cccccc'} onChange={e => setForm((f: any) => ({ ...f, hex: e.target.value }))} title="Hex kodu" style={{ width: 38, height: 34, padding: 2, border: '1px solid var(--adm-bdr2)', borderRadius: 6, background: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{RENKLER.map(([ad, hex]) => <button type="button" key={ad} onClick={() => setForm((f: any) => ({ ...f, color: ad, hex }))} title={ad} style={{ width: 22, height: 22, borderRadius: 11, background: hex, border: form.color === ad ? '2px solid var(--adm-ac)' : '1px solid var(--adm-bdr2)' }} />)}</div>
          </Field>
          <Field label="Görsel (renk fotoğrafı URL'i)" span={2} hint="Bu renkteki gerçek ürün fotoğrafının linki — ürün sayfasında renk seçilince gösterilir">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {form.gorsel && <img src={form.gorsel} alt="" style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 6, background: 'var(--adm-s2)', border: '1px solid var(--adm-bdr2)' }} />}
              <input className="adm-inp" value={form.gorsel} onChange={e => setForm((f: any) => ({ ...f, gorsel: e.target.value }))} placeholder="https://..." style={{ flex: 1 }} />
            </div>
          </Field>
          <Field label="Barkod" hint={barkodVar(form.barkod, editing?.id) ? 'Bu barkod kullanımda' : undefined}><input className="adm-inp" value={form.barkod} onChange={e => setForm((f: any) => ({ ...f, barkod: e.target.value }))} style={barkodVar(form.barkod, editing?.id) ? { borderColor: 'var(--adm-red)' } : undefined} /></Field>
          <Field label="Sıra"><input type="number" className="adm-inp" value={form.sort_order} onChange={e => setForm((f: any) => ({ ...f, sort_order: e.target.value }))} /></Field>
          {!editing && <Field label="Açılış stoğu (adet)" span={2} hint="Defterde ‘Açılış stoğu’ hareketi olarak yazılır"><input type="number" min="0" className="adm-inp" value={form.acilis} onChange={e => setForm((f: any) => ({ ...f, acilis: e.target.value }))} /></Field>}
        </FormGrid>
      </Modal>

      <Modal open={!!sayim} onClose={() => setSayim(null)} onSubmit={sayimKaydet} width={440} title={sayim && `${sayim.v.urunAd} — ${sayim.v.name}: Sayım`}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setSayim(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Stoğu Düzelt</button></>}>
        {sayim && <FormGrid cols={1}>
          <Field label="Sayılan adet" hint={`Sistem: ${fmtInt(sayim.v.stock)} → fark ${fmtInt((+sayim.miktar || 0) - (+sayim.v.stock || 0))}`}><input type="number" min="0" required autoFocus className="adm-inp" value={sayim.miktar} onChange={e => setSayim((s: any) => ({ ...s, miktar: e.target.value }))} style={{ fontSize: 17, fontWeight: 700 }} /></Field>
          <Field label="Not"><input className="adm-inp" value={sayim.not} onChange={e => setSayim((s: any) => ({ ...s, not: e.target.value }))} placeholder="Sayım tarihi, sebep..." /></Field>
        </FormGrid>}
      </Modal>

      <Modal open={!!uret} onClose={() => setUret(null)} onSubmit={matrisOlustur} width={520} title="Renk × Beden Varyant Üretici"
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setUret(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}><Wand2 size={13} />Oluştur</button></>}>
        {uret && <FormGrid cols={1}>
          <Field label="Ürün *"><select className="adm-inp" required value={uret.product_id} onChange={e => setUret((u: any) => ({ ...u, product_id: e.target.value }))}><option value="">Seçin</option>{d.products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Renkler (birden fazla seç)"><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{RENKLER.map(([ad, hex]) => <button type="button" key={ad} className={`adm-chip ${uret.renkler.includes(ad) ? 'on' : ''}`} onClick={() => setUret((u: any) => ({ ...u, renkler: u.renkler.includes(ad) ? u.renkler.filter((x: string) => x !== ad) : [...u.renkler, ad] }))}><i style={{ width: 10, height: 10, borderRadius: 5, background: hex as string, border: '1px solid var(--adm-bdr2)', display: 'inline-block' }} />{ad}</button>)}</div></Field>
          <Field label="Bedenler / boyutlar" hint="Virgülle ayır: 3 lt, 5 lt, 10 lt"><input className="adm-inp" value={uret.bedenler} onChange={e => setUret((u: any) => ({ ...u, bedenler: e.target.value }))} /></Field>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--adm-tx3)' }}>{uret.renkler.length || 1} renk × {uret.bedenler.split(',').filter((s: string) => s.trim()).length || 1} beden = <b>{(uret.renkler.length || 1) * (uret.bedenler.split(',').filter((s: string) => s.trim()).length || 1)}</b> varyant (mevcut olanlar atlanır).</p>
        </FormGrid>}
      </Modal>

      <Modal open={!!varyantAi} onClose={() => setVaryantAi(null)} width={640} title="AI ile Renk Fotoğrafını Stüdyoya Çevir"
        footer={<>
          <button type="button" className="adm-btn-ghost" onClick={() => setVaryantAi(null)}>{varyantAi?.b64 ? 'Vazgeç' : 'İptal'}</button>
          {varyantAi?.b64 && <button type="button" className="adm-btn-ghost" disabled={varyantAi.busy} onClick={() => varyantAiUretIcin(varyantAi.v, varyantAi.stil)}><RotateCcw size={13} />Tekrar Dene</button>}
          {varyantAi?.b64 ? <button type="button" className="adm-btn" disabled={busy} onClick={varyantAiKaydet}>{busy ? 'Kaydediliyor…' : 'Bu Fotoğrafı Kullan'}</button>
            : <button type="button" className="adm-btn" disabled={varyantAi?.busy} onClick={() => varyantAi && varyantAiUretIcin(varyantAi.v, varyantAi.stil)}><Wand2 size={13} />{varyantAi?.busy ? 'Oluşturuluyor…' : 'Oluştur'}</button>}
        </>}>
        <p style={{ fontSize: 12, color: 'var(--adm-tx3)', margin: '0 0 12px' }}>Ürünün rengi/şekli değişmez, yalnızca arka plan AI ile yeniden oluşturulur. Sonucu onaylarsan bu varyantın fotoğrafı olarak kaydedilir ve ürün sayfasındaki renk seçicide görünür.</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {(Object.keys(GORSEL_STIL) as GorselStil[]).map(s => (
            <button key={s} type="button" className={varyantAi?.stil === s ? 'adm-chip on' : 'adm-chip'} disabled={varyantAi?.busy} onClick={() => varyantAi && varyantAiUretIcin(varyantAi.v, s)}>{GORSEL_STIL[s]}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', minHeight: 260 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--adm-tx3)', marginBottom: 6 }}>Mevcut</div>
            {varyantAi?.v.gorsel && <img src={varyantAi.v.gorsel} alt="" style={{ width: 220, height: 220, objectFit: 'contain', borderRadius: 12, background: 'var(--adm-s2)', padding: 8 }} />}
          </div>
          <div style={{ fontSize: 20, color: 'var(--adm-tx3)' }}>→</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--adm-tx3)', marginBottom: 6 }}>AI önerisi</div>
            {varyantAi?.busy ? <div style={{ width: 220, height: 220, borderRadius: 12, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--adm-tx3)' }}>Oluşturuluyor…</div>
              : varyantAi?.b64 ? <img src={`data:image/png;base64,${varyantAi.b64}`} alt="" style={{ width: 220, height: 220, objectFit: 'contain', borderRadius: 12, background: 'var(--adm-s2)', padding: 8 }} />
              : <div style={{ width: 220, height: 220, borderRadius: 12, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImagePlus size={26} style={{ color: 'var(--adm-tx3)' }} /></div>}
          </div>
        </div>
      </Modal>

      <Modal open={!!topluVaryantAi} onClose={() => { if (!topluVaryantAi?.calisiyor) topluVaryantAi?.clear(); setTopluVaryantAi(null) }} width={720} title={`AI ile Toplu Stüdyo Çevirimi${topluVaryantAi ? ` — ${topluVaryantAi.varyantlar.length} varyant` : ''}`}
        footer={<>
          <button type="button" className="adm-btn-ghost" disabled={topluVaryantAi?.calisiyor} onClick={() => { topluVaryantAi?.clear(); setTopluVaryantAi(null) }}>{topluVaryantAi?.asama === 'onay' ? 'Vazgeç' : 'İptal'}</button>
          {topluVaryantAi?.asama === 'ayar' && <button type="button" className="adm-btn" onClick={topluVaryantAiUret}><Wand2 size={13} />{topluVaryantAi.varyantlar.length} Varyant İçin Oluştur</button>}
          {topluVaryantAi?.asama === 'onay' && <button type="button" className="adm-btn" disabled={topluVaryantAi.calisiyor} onClick={topluVaryantAiKaydet}>{topluVaryantAi.calisiyor ? 'Kaydediliyor…' : `Seçilenleri Kaydet (${topluVaryantAi.varyantlar.filter(v => topluVaryantAi.durum[v.id] === 'tamam' && topluVaryantAi.secili[v.id]).length})`}</button>}
        </>}>
        {topluVaryantAi?.asama === 'ayar' && <>
          <p style={{ fontSize: 12, color: 'var(--adm-tx3)', margin: '0 0 12px', lineHeight: 1.55 }}>Seçili {topluVaryantAi.varyantlar.length} varyantın fotoğrafı sırayla AI ile yeniden tasarlanacak (yalnızca arka plan değişir, renk/şekil korunur). Üretim bitince önce önizleme ızgarasını göreceksin — hiçbir fotoğraf bu ekranda otomatik kaydedilmez.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {(Object.keys(GORSEL_STIL) as GorselStil[]).map(s => (
              <button key={s} type="button" className={topluVaryantAi.stil === s ? 'adm-chip on' : 'adm-chip'} onClick={() => setTopluVaryantAi(t => t && { ...t, stil: s })}>{GORSEL_STIL[s]}</button>
            ))}
          </div>
        </>}
        {(topluVaryantAi?.asama === 'uretim' || topluVaryantAi?.asama === 'onay') && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, maxHeight: 440, overflow: 'auto' }}>
            {topluVaryantAi.varyantlar.map(v => {
              const d = topluVaryantAi.durum[v.id]
              const secili = !!topluVaryantAi.secili[v.id]
              return (
                <div key={v.id} onClick={() => d === 'tamam' && setTopluVaryantAi(t => t && { ...t, secili: { ...t.secili, [v.id]: !t.secili[v.id] } })}
                  style={{ border: `2px solid ${d === 'tamam' && secili ? 'var(--adm-ac)' : 'transparent'}`, borderRadius: 10, padding: 4, cursor: d === 'tamam' ? 'pointer' : 'default', opacity: d === 'hata' ? 0.5 : 1 }}>
                  <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {d === 'tamam' ? <img src={`data:image/png;base64,${topluVaryantAi.sonuc[v.id]}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                      : d === 'isleniyor' ? <span style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>Oluşturuluyor…</span>
                      : d === 'hata' ? <span style={{ fontSize: 11, color: 'var(--adm-red)' }}>Hata</span>
                      : <img src={v.gorsel} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4, opacity: 0.5 }} />}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.urunAd} — {v.name}</div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>
      {toast.node}
    </div>
  )
}
