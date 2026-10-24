'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { web, webAll } from '@/lib/web-data'
import { fmtInt } from '@/lib/fmt'
import { Page, PageHead, Kpi, KpiGrid, Modal, Field, FormGrid, Card, Empty, Badge, useToast } from '@/components/admin/erp/ui'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Tag, Package, FolderTree } from 'lucide-react'

const EMOJILER = ['🌿', '🪴', '🌱', '🧺', '📦', '🧴', '🛒', '🏠', '🍽️', '🧹', '🚿', '🧰', '💧', '🌸', '🔩', '🧊']
const slugla = (s: string) => s.toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function KategorilerPage() {
  const toast = useToast()
  const [items, setItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({ slug: '', name: '', icon: '🌿', sort_order: 1 })
  const [slugElle, setSlugElle] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([webAll('categories', '*', q => q.order('sort_order', { ascending: true })), webAll('products', 'id,category,name')])
    setItems(c); setProducts(p); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const sayi = useMemo(() => { const m: Record<string, number> = {}; products.forEach(p => { m[p.category] = (m[p.category] || 0) + 1 }); return m }, [products])
  const yetim = useMemo(() => Object.entries(sayi).filter(([slug]) => !items.some(c => c.slug === slug)), [sayi, items])

  const openNew = () => { setEditing(null); setSlugElle(false); setForm({ slug: '', name: '', icon: '🌿', sort_order: items.length + 1 }); setModal(true) }
  const openEdit = (c: any) => { setEditing(c); setSlugElle(true); setForm({ slug: c.slug, name: c.name, icon: c.icon || '🌿', sort_order: c.sort_order }); setModal(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (items.some(c => c.slug === form.slug && c.id !== editing?.id)) return toast.show('Bu slug zaten var', true)
    setBusy(true)
    try {
      const { error } = editing ? await web.from('categories').update({ ...form, sort_order: +form.sort_order }).eq('id', editing.id) : await web.from('categories').insert({ ...form, sort_order: +form.sort_order })
      if (error) throw new Error(error.message)
      // slug değiştiyse ürünlerdeki kategori de taşınır (yoksa ürünler kategorisiz kalır)
      if (editing && editing.slug !== form.slug && sayi[editing.slug]) {
        const { error: e2 } = await web.from('products').update({ category: form.slug }).eq('category', editing.slug)
        if (e2) throw new Error('Kategori kaydedildi ama ürünler taşınamadı: ' + e2.message)
      }
      setModal(false); toast.show(editing ? 'Kategori güncellendi' : 'Kategori eklendi'); load()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }
  async function sil(c: any) {
    if (sayi[c.slug]) return toast.show(`Bu kategoride ${sayi[c.slug]} ürün var — önce ürünleri taşı`, true)
    if (!confirm(`${c.name} kategorisi silinsin mi?`)) return
    const { error } = await web.from('categories').delete().eq('id', c.id)
    if (error) return toast.show(error.message, true)
    toast.show('Kategori silindi'); load()
  }
  async function tasi(i: number, yon: -1 | 1) {
    const a = items[i], b = items[i + yon]; if (!a || !b) return
    const ord = items.map((c, k) => ({ id: c.id, o: k + 1 })); ord[i].o = i + 1 + yon; ord[i + yon].o = i + 1
    setItems(l => { const n = [...l]; [n[i], n[i + yon]] = [n[i + yon], n[i]]; return n })
    for (const x of ord) await web.from('categories').update({ sort_order: x.o }).eq('id', x.id)
    load()
  }
  async function yetimOlustur(slug: string) {
    const { error } = await web.from('categories').insert({ slug, name: slug.replace(/-/g, ' ').replace(/^\w/, ch => ch.toUpperCase()), icon: '📦', sort_order: items.length + 1 })
    if (error) return toast.show(error.message, true)
    toast.show('Kategori oluşturuldu'); load()
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Kategori Yönetimi" />
      <Page maxWidth={980}>
        <PageHead title="Kategoriler" sub="Sitedeki ürün kategorileri — sıralama sitede menüye yansır" actions={<button className="adm-btn" onClick={openNew}><Plus size={14} />Yeni Kategori</button>} />
        <KpiGrid min={180}>
          <Kpi label="Kategori" value={items.length} Icon={FolderTree} color="var(--adm-ac)" sub={`${items.filter(c => !sayi[c.slug]).length} boş kategori`} />
          <Kpi label="Ürün" value={products.length} Icon={Package} color="var(--adm-blue)" sub={`kategori başına ort. ${items.length ? (products.length / items.length).toFixed(1) : 0}`} />
          <Kpi label="En Büyük Kategori" value={items.length ? items.reduce((m, c) => (sayi[c.slug] || 0) > (sayi[m.slug] || 0) ? c : m, items[0]).name : '—'} Icon={Tag} color="var(--adm-green)" sub={items.length ? `${fmtInt(Math.max(...items.map(c => sayi[c.slug] || 0)))} ürün` : ''} valueSize={17} />
        </KpiGrid>

        {yetim.length > 0 && (
          <div className="adm-card" style={{ padding: '11px 16px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', borderColor: 'var(--adm-amber)', flexWrap: 'wrap', fontSize: 13 }}>
            <span style={{ flex: 1 }}>Tanımsız kategoriye bağlı ürünler var: {yetim.map(([s, n]) => `${s} (${n})`).join(', ')}</span>
            {yetim.map(([s]) => <button key={s} className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => yetimOlustur(s)}><Plus size={12} />“{s}” oluştur</button>)}
          </div>
        )}

        <Card>
          {loading ? null : items.length === 0 ? <Empty icon={<FolderTree size={32} />} title="Kategori yok" action={<button className="adm-btn" onClick={openNew}><Plus size={14} />İlk kategoriyi ekle</button>} /> : items.map((c, i) => (
            <div key={c.id} className="adm-row" style={{ padding: '12px 18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button disabled={i === 0} onClick={() => tasi(i, -1)} style={{ border: 'none', background: 'none', color: 'var(--adm-tx3)', padding: 0, opacity: i === 0 ? 0.3 : 1 }}><ChevronUp size={15} /></button>
                <button disabled={i === items.length - 1} onClick={() => tasi(i, 1)} style={{ border: 'none', background: 'none', color: 'var(--adm-tx3)', padding: 0, opacity: i === items.length - 1 ? 0.3 : 1 }}><ChevronDown size={15} /></button>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>{c.icon || '📦'}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)', fontFamily: 'JetBrains Mono,monospace' }}>/{c.slug}</div></div>
              <Badge tone={sayi[c.slug] ? 'blue' : 'muted'}>{sayi[c.slug] || 0} ürün</Badge>
              <button className="adm-btn-ghost" style={{ padding: '5px 9px' }} onClick={() => openEdit(c)}><Pencil size={12} /></button>
              <button className="adm-btn-danger" style={{ padding: '5px 9px' }} onClick={() => sil(c)}><Trash2 size={12} /></button>
            </div>
          ))}
        </Card>
      </Page>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={save} width={480} title={editing ? 'Kategoriyi Düzenle' : 'Yeni Kategori'}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <FormGrid cols={1}>
          <Field label="Ad *"><input className="adm-inp" required autoFocus value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value, ...(slugElle ? {} : { slug: slugla(e.target.value) }) }))} /></Field>
          <Field label="Slug *" hint={editing && editing.slug !== form.slug && sayi[editing.slug] ? `Değişirse ${sayi[editing.slug]} ürünün kategorisi de taşınır. Site adresleri etkilenebilir.` : 'Sitedeki adres parçası'}><input className="adm-inp" required value={form.slug} onChange={e => { setSlugElle(true); setForm((f: any) => ({ ...f, slug: e.target.value })) }} style={{ fontFamily: 'JetBrains Mono,monospace' }} /></Field>
          <Field label="İkon"><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{EMOJILER.map(em => <button type="button" key={em} onClick={() => setForm((f: any) => ({ ...f, icon: em }))} style={{ width: 36, height: 36, borderRadius: 9, fontSize: 18, border: form.icon === em ? '2px solid var(--adm-ac)' : '1px solid var(--adm-bdr)', background: 'var(--adm-s1)' }}>{em}</button>)}<input className="adm-inp" style={{ width: 64, textAlign: 'center' }} value={form.icon} onChange={e => setForm((f: any) => ({ ...f, icon: e.target.value }))} /></div></Field>
        </FormGrid>
      </Modal>
      {toast.node}
    </div>
  )
}
