'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { muh } from '@/lib/muhasebe-client'
import { fmt, fmtN } from '@/lib/fmt'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Modal, Field, FormGrid, Card, Empty, useToast } from '@/components/admin/erp/ui'
import Yardim from '@/components/admin/erp/Yardim'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { Plus, Copy, Trash2, Pencil, Star, Tag, Percent, Upload, Package, Users2, BadgePercent } from 'lucide-react'

const bosListe = { ad: '', aciklama: '', varsayilan: false }

function PriceCell({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  return (
    <input key={String(value)} type="number" step="0.01" min="0" className="adm-inp" defaultValue={value ?? ''} placeholder="—"
      style={{ width: 120, textAlign: 'right', padding: '5px 9px', fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, fontSize: 12.5 }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      onBlur={e => { const t = e.target.value.trim(); const n = t === '' ? null : +t; if ((n ?? null) !== (value ?? null)) onSave(n) }} />
  )
}

export default function FiyatListeleriPage() {
  const toast = useToast()
  const [listeler, setListeler] = useState<any[]>([])
  const [kalemler, setKalemler] = useState<any[]>([])
  const [variants, setVariants] = useState<any[]>([])
  const [kademeler, setKademeler] = useState<any[]>([])
  const [cariler, setCariler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sec, setSec] = useState<string | null>(null)
  const [tab, setTab] = useState('hepsi')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(bosListe)
  const [toplu, setToplu] = useState<any>(null)
  const [kopya, setKopya] = useState<any>(null)
  const [kForm, setKForm] = useState({ min_miktar: '', iskonto_yuzdesi: '', aciklama: '' })
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const [l, k, v, p, ik, c] = await Promise.all([
      erp.from('fiyat_listeleri').select('*').order('ad', { ascending: true }), erp.all('fiyat_listesi_kalemleri'),
      muh.all('product_variants', 'id,product_id,name,color,size,stock,barkod'), muh.all('products', 'id,name,code'),
      erp.from('iskonto_kademeleri').select('*').order('min_miktar', { ascending: true }), muh.all('cari_hesaplar', 'id,fiyat_listesi_id'),
    ])
    const pm: Record<string, any> = {}; p.forEach((x: any) => pm[x.id] = x)
    setListeler(l.data || []); setKalemler(k); setKademeler(ik.data || []); setCariler(c)
    setVariants(v.map((x: any) => ({ ...x, label: [pm[x.product_id]?.name, x.name, x.color, x.size].filter(Boolean).filter((a, i, arr) => arr.indexOf(a) === i).join(' · ') || x.name, kod: pm[x.product_id]?.code })))
    setLoading(false); setSec(s => s || (l.data || []).find((x: any) => x.varsayilan)?.id || l.data?.[0]?.id || null)
  }, [])
  useEffect(() => { load() }, [load])

  const liste = listeler.find(l => l.id === sec)
  const varsayilan = listeler.find(l => l.varsayilan)
  const fiyatMap = useMemo(() => {
    const m: Record<string, Record<string, any>> = {}
    kalemler.forEach(k => { (m[k.fiyat_listesi_id] ||= {})[k.variant_id] = k })
    return m
  }, [kalemler])
  const secMap = (sec && fiyatMap[sec]) || {}
  const defMap = (varsayilan && fiyatMap[varsayilan.id]) || {}

  const satirlar = variants.filter(v => tab === 'hepsi' || (tab === 'fiyatli' ? secMap[v.id] : !secMap[v.id]))
  const fiyatli = variants.filter(v => secMap[v.id]).length
  const kullananCari = (id: string) => cariler.filter(c => c.fiyat_listesi_id === id).length

  async function fiyatKaydet(v: any, n: number | null) {
    if (!sec) return
    const mevcut = secMap[v.id]
    let r: any
    if (n == null || n <= 0) { if (!mevcut) return; r = await erp.from('fiyat_listesi_kalemleri').delete().eq('id', mevcut.id) }
    else if (mevcut) r = await erp.from('fiyat_listesi_kalemleri').update({ fiyat: n }).eq('id', mevcut.id)
    else r = await erp.from('fiyat_listesi_kalemleri').insert({ fiyat_listesi_id: sec, variant_id: v.id, fiyat: n })
    if (r?.error) return toast.show(r.error, true)
    const yeni = await erp.all('fiyat_listesi_kalemleri'); setKalemler(yeni)
    toast.show(n == null || n <= 0 ? 'Fiyat kaldırıldı' : `${v.label}: ${fmt(n)}`)
  }

  async function topluUygula(e: React.FormEvent) {
    e.preventDefault(); if (busy || !toplu || !sec) return
    const y = +toplu.yuzde; if (!y) return toast.show('Yüzde gir', true)
    setBusy(true)
    const hedef = toplu.rows.length ? toplu.rows : variants.filter(v => secMap[v.id])
    for (const v of hedef) {
      const k = secMap[v.id]; if (!k) continue
      let n = +k.fiyat * (1 + y / 100)
      const r = +toplu.yuvarla; if (r > 0) n = Math.round(n / r) * r
      await erp.from('fiyat_listesi_kalemleri').update({ fiyat: +n.toFixed(2) }).eq('id', k.id)
    }
    setKalemler(await erp.all('fiyat_listesi_kalemleri')); setBusy(false); setToplu(null); toast.show(`${hedef.length} ürüne %${y} uygulandı`)
  }

  async function csvAktar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !sec) return
    const lines = (await f.text()).replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim())
    let ok = 0, yok = 0
    setBusy(true)
    for (const l of lines) {
      const d = l.includes(';') ? ';' : ','; const [ad, fy] = l.split(d).map(x => x.trim().replace(/^"|"$/g, ''))
      const n = parseFloat((fy || '').replace(/\./g, '').replace(',', '.')) || parseFloat(fy)
      if (!n || isNaN(n)) continue
      const v = variants.find(x => x.barkod === ad || x.label.toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr') || x.kod === ad)
      if (!v) { yok++; continue }
      const mevcut = secMap[v.id]
      if (mevcut) await erp.from('fiyat_listesi_kalemleri').update({ fiyat: n }).eq('id', mevcut.id); else await erp.from('fiyat_listesi_kalemleri').insert({ fiyat_listesi_id: sec, variant_id: v.id, fiyat: n })
      ok++
    }
    setBusy(false); if (fileRef.current) fileRef.current.value = ''
    setKalemler(await erp.all('fiyat_listesi_kalemleri')); toast.show(`${ok} fiyat içe aktarıldı${yok ? `, ${yok} ürün eşleşmedi` : ''}`, ok === 0)
  }

  async function kaydetListe(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true)
    try {
      if (form.varsayilan) for (const l of listeler.filter(x => x.varsayilan && x.id !== editing?.id)) await erp.from('fiyat_listeleri').update({ varsayilan: false }).eq('id', l.id)
      const r: any = editing ? await erp.from('fiyat_listeleri').update(form).eq('id', editing.id) : await erp.from('fiyat_listeleri').insert({ ...form, aktif: true })
      if (r?.error) throw new Error(r.error)
      if (!editing && r.data?.[0]?.id) setSec(r.data[0].id)
      setModal(false); toast.show(editing ? 'Liste güncellendi' : 'Liste oluşturuldu'); await load()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }
  async function varsayilanYap(l: any) {
    for (const x of listeler.filter(x => x.varsayilan)) await erp.from('fiyat_listeleri').update({ varsayilan: false }).eq('id', x.id)
    await erp.from('fiyat_listeleri').update({ varsayilan: true }).eq('id', l.id); toast.show(`${l.ad} varsayılan yapıldı`); load()
  }
  async function listeSil(l: any) {
    const n = kullananCari(l.id)
    if (!confirm(`${l.ad} listesi ve içindeki tüm fiyatlar silinsin mi?${n ? `\n\n${n} cari bu listeyi kullanıyor.` : ''}`)) return
    const r: any = await erp.from('fiyat_listeleri').delete().eq('id', l.id)
    if (r?.error) return toast.show(r.error, true)
    if (sec === l.id) setSec(null); toast.show('Liste silindi'); load()
  }
  async function kopyala(e: React.FormEvent) {
    e.preventDefault(); if (busy || !kopya) return; setBusy(true)
    const r: any = await erp.from('fiyat_listeleri').insert({ ad: kopya.ad, aciklama: `${kopya.kaynak.ad} listesinden kopyalandı`, varsayilan: false, aktif: true })
    const id = r.data?.[0]?.id
    if (id) {
      const y = +kopya.yuzde || 0
      const satirlar = kalemler.filter(k => k.fiyat_listesi_id === kopya.kaynak.id).map(k => ({ fiyat_listesi_id: id, variant_id: k.variant_id, fiyat: +(+k.fiyat * (1 + y / 100)).toFixed(2) }))
      if (satirlar.length) await erp.from('fiyat_listesi_kalemleri').insert(satirlar)
      setSec(id)
    }
    setBusy(false); setKopya(null); toast.show('Liste kopyalandı'); load()
  }

  async function kademeEkle(e: React.FormEvent) {
    e.preventDefault()
    const r: any = await erp.from('iskonto_kademeleri').insert({ min_miktar: +kForm.min_miktar, iskonto_yuzdesi: +kForm.iskonto_yuzdesi, aciklama: kForm.aciklama || null, aktif: true })
    if (r?.error) return toast.show(r.error, true)
    setKForm({ min_miktar: '', iskonto_yuzdesi: '', aciklama: '' }); toast.show('Kademe eklendi'); load()
  }

  const cols: Col<any>[] = [
    { key: 'urun', label: 'Ürün / Varyant', sort: v => v.label, render: v => <div><div style={{ fontWeight: 600 }}>{v.label}</div><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{v.kod || v.barkod || ''}</div></div> },
    { key: 'stok', label: 'Stok', align: 'right', width: 80, sort: v => +v.stock, render: v => <span style={{ color: +v.stock <= 0 ? 'var(--adm-red)' : undefined }}>{v.stock}</span>, hideSm: true },
    { key: 'fiyat', label: `Fiyat (${liste?.ad || ''})`, align: 'right', width: 150, sort: v => secMap[v.id]?.fiyat ?? null, render: v => <PriceCell value={secMap[v.id] ? +secMap[v.id].fiyat : null} onSave={n => fiyatKaydet(v, n)} />, csv: v => secMap[v.id]?.fiyat ?? '' },
    { key: 'kdv', label: 'KDV Dahil (%20)', align: 'right', sort: v => (secMap[v.id] ? +secMap[v.id].fiyat * 1.2 : null), render: v => secMap[v.id] ? <span style={{ color: 'var(--adm-tx2)' }}>{fmt(+secMap[v.id].fiyat * 1.2)}</span> : '—', hideSm: true },
    ...(varsayilan && sec !== varsayilan.id ? [{
      key: 'fark', label: `Varsayılana göre`, align: 'right' as const, sort: (v: any) => (secMap[v.id] && defMap[v.id] ? (+secMap[v.id].fiyat / +defMap[v.id].fiyat - 1) * 100 : null),
      render: (v: any) => { if (!secMap[v.id] || !defMap[v.id]) return <span style={{ color: 'var(--adm-tx3)' }}>—</span>; const p = (+secMap[v.id].fiyat / +defMap[v.id].fiyat - 1) * 100; return <span style={{ fontWeight: 700, color: p < 0 ? 'var(--adm-red)' : p > 0 ? 'var(--adm-green)' : 'var(--adm-tx3)' }}>{p > 0 ? '+' : ''}{fmtN(p, 1)}%</span> },
    }] : []),
  ]

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Fiyat Listeleri" />
      <Page>
        <PageHead title="Fiyatlandırma" sub="Müşteri gruplarına özel fiyat listeleri ve miktar kademeli iskontolar"
          actions={<button className="adm-btn" onClick={() => { setEditing(null); setForm(bosListe); setModal(true) }}><Plus size={14} />Yeni Liste</button>} />

        <Yardim sayfa="fiyat-listeleri" />
        {!loading && listeler.length === 0 ? (
          <Card><Empty icon={<Tag size={34} />} title="Henüz fiyat listesi yok" sub="Örn. “Perakende”, “Bayi”, “İhracat” listeleri oluşturup cariye ata; fatura keserken fiyat otomatik gelir." action={<button className="adm-btn" onClick={() => { setForm(bosListe); setModal(true) }}><Plus size={14} />İlk Listeyi Oluştur</button>} /></Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16 }} className="fl-grid">
            <style>{`@media(min-width:1000px){.fl-grid{grid-template-columns:290px minmax(0,1fr)!important}}`}</style>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {listeler.map(l => {
                const on = sec === l.id, n = kalemler.filter(k => k.fiyat_listesi_id === l.id).length
                return (
                  <div key={l.id} onClick={() => { setSec(l.id); setTab('hepsi') }} className="adm-card" style={{ padding: 14, cursor: 'pointer', borderColor: on ? 'var(--adm-ac)' : undefined, boxShadow: on ? '0 0 0 3px var(--adm-ac2)' : undefined }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ flex: 1, fontSize: 13.5 }}>{l.ad}</b>{l.varsayilan && <Badge tone="green"><Star size={10} style={{ marginRight: 3 }} />Varsayılan</Badge>}
                    </div>
                    {l.aciklama && <div style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 3 }}>{l.aciklama}</div>}
                    <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--adm-tx3)', margin: '9px 0' }}><span><Package size={11} style={{ verticalAlign: -1 }} /> {n}/{variants.length} ürün</span><span><Users2 size={11} style={{ verticalAlign: -1 }} /> {kullananCari(l.id)} cari</span></div>
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      {!l.varsayilan && <button className="adm-btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => varsayilanYap(l)}><Star size={11} />Varsayılan</button>}
                      <button className="adm-btn-ghost" style={{ padding: '3px 8px' }} title="Kopyala" onClick={() => setKopya({ kaynak: l, ad: `${l.ad} (kopya)`, yuzde: '' })}><Copy size={11} /></button>
                      <button className="adm-btn-ghost" style={{ padding: '3px 8px' }} onClick={() => { setEditing(l); setForm({ ad: l.ad, aciklama: l.aciklama || '', varsayilan: !!l.varsayilan }); setModal(true) }}><Pencil size={11} /></button>
                      <button className="adm-btn-danger" style={{ padding: '3px 8px' }} onClick={() => listeSil(l)}><Trash2 size={11} /></button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ minWidth: 0 }}>
              {liste && (
                <>
                  <KpiGrid min={170}>
                    <Kpi label="Ürün / Varyant" value={variants.length} Icon={Package} color="var(--adm-blue)" sub="katalogda" />
                    <Kpi label="Fiyatı Girilen" value={fiyatli} Icon={Tag} color="var(--adm-green)" sub={`%${variants.length ? Math.round((fiyatli / variants.length) * 100) : 0} kapsama`} />
                    <Kpi label="Fiyatsız" value={variants.length - fiyatli} Icon={Tag} color={variants.length - fiyatli ? 'var(--adm-amber)' : 'var(--adm-green)'} sub="bu listede" onClick={() => setTab('fiyatsiz')} />
                    <Kpi label="Kullanan Cari" value={kullananCari(liste.id)} Icon={Users2} color="var(--adm-ac)" sub={liste.varsayilan ? 'listesiz cariler de kullanır' : 'cari hesap'} />
                  </KpiGrid>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
                    <Tabs value={tab} onChange={setTab} tabs={[{ v: 'hepsi', l: 'Tümü', n: variants.length }, { v: 'fiyatli', l: 'Fiyatlı', n: fiyatli }, { v: 'fiyatsiz', l: 'Fiyatsız', n: variants.length - fiyatli }]} />
                  </div>
                  <DataGrid rows={satirlar} cols={cols} rowKey={v => v.id} loading={loading} csvName={`fiyat-listesi-${liste.ad}`} storageKey="fiyatlar" title={liste.ad}
                    searchText={v => `${v.label} ${v.kod || ''} ${v.barkod || ''}`} searchPlaceholder="Ürün, kod, barkod..." selectable
                    bulkActions={(sel) => <button className="adm-btn" style={{ padding: '3px 12px', fontSize: 12 }} onClick={() => setToplu({ rows: sel, yuzde: '', yuvarla: '0' })}><Percent size={12} />Seçililere % uygula</button>}
                    actions={<>
                      <button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setToplu({ rows: [], yuzde: '', yuvarla: '0' })} disabled={!fiyatli}><Percent size={13} />Tümüne % uygula</button>
                      <button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={13} />CSV Al</button>
                      <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={csvAktar} />
                    </>}
                    emptyTitle="Ürün yok" emptySub="Önce Ürünler → Varyantlar'dan stok varyantı ekle" footerNote={<span>· Fiyatı hücreye yaz, Enter/başka yere tıkla → otomatik kaydolur</span>} />
                </>
              )}

              <div style={{ marginTop: 16 }}>
                <Card title={<><BadgePercent size={14} />Miktar Kademeli İskonto</>} right={<span style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>Satış faturasında miktara göre birim fiyata otomatik uygulanır</span>}>
                  {kademeler.length === 0 ? <Empty title="Kademe tanımlı değil" sub="Örn. 100 adet ve üzeri %5" /> : (
                    <table className="adm-tbl"><thead><tr><th>Minimum miktar</th><th>İskonto</th><th>Açıklama</th><th style={{ width: 40 }} /></tr></thead>
                      <tbody>{kademeler.map(k => (
                        <tr key={k.id}><td><b>{fmtN(k.min_miktar, 0)}+</b> adet</td><td><Badge tone="green">%{k.iskonto_yuzdesi}</Badge></td><td style={{ color: 'var(--adm-tx3)' }}>{k.aciklama || '—'}</td>
                          <td><button className="adm-btn-danger" style={{ padding: '3px 8px' }} onClick={async () => { await erp.from('iskonto_kademeleri').delete().eq('id', k.id); load() }}><Trash2 size={11} /></button></td></tr>))}</tbody></table>
                  )}
                  <form onSubmit={kademeEkle} style={{ display: 'flex', gap: 8, padding: 14, borderTop: '1px solid var(--adm-bdr)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <Field label="Min. miktar"><input type="number" required className="adm-inp" style={{ width: 120 }} value={kForm.min_miktar} onChange={e => setKForm(f => ({ ...f, min_miktar: e.target.value }))} /></Field>
                    <Field label="İskonto %"><input type="number" step="0.1" required className="adm-inp" style={{ width: 110 }} value={kForm.iskonto_yuzdesi} onChange={e => setKForm(f => ({ ...f, iskonto_yuzdesi: e.target.value }))} /></Field>
                    <div style={{ flex: 1, minWidth: 160 }}><Field label="Açıklama"><input className="adm-inp" value={kForm.aciklama} onChange={e => setKForm(f => ({ ...f, aciklama: e.target.value }))} /></Field></div>
                    <button type="submit" className="adm-btn"><Plus size={13} />Kademe Ekle</button>
                  </form>
                </Card>
              </div>
            </div>
          </div>
        )}
      </Page>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={kaydetListe} width={460} title={editing ? 'Listeyi Düzenle' : 'Yeni Fiyat Listesi'}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <FormGrid cols={1}>
          <Field label="Liste Adı *"><input className="adm-inp" required autoFocus value={form.ad} onChange={e => setForm((f: any) => ({ ...f, ad: e.target.value }))} placeholder="Bayi Fiyatları" /></Field>
          <Field label="Açıklama"><input className="adm-inp" value={form.aciklama} onChange={e => setForm((f: any) => ({ ...f, aciklama: e.target.value }))} /></Field>
          <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}><input type="checkbox" checked={form.varsayilan} onChange={e => setForm((f: any) => ({ ...f, varsayilan: e.target.checked }))} />Varsayılan liste (listesi olmayan cariler bunu kullanır)</label>
        </FormGrid>
      </Modal>

      <Modal open={!!toplu} onClose={() => setToplu(null)} onSubmit={topluUygula} width={440} title="Toplu Fiyat Güncelle"
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setToplu(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Uygula</button></>}>
        {toplu && <FormGrid cols={1}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-tx3)' }}>{toplu.rows.length ? `${toplu.rows.length} seçili ürün` : `${liste?.ad} listesindeki ${fiyatli} fiyatlı ürün`} için mevcut fiyatlar değiştirilir.</p>
          <Field label="Değişim % (artış +, indirim −)"><input type="number" step="0.1" required autoFocus className="adm-inp" value={toplu.yuzde} onChange={e => setToplu((t: any) => ({ ...t, yuzde: e.target.value }))} placeholder="örn. 12 veya -5" /></Field>
          <Field label="Yuvarlama"><select className="adm-inp" value={toplu.yuvarla} onChange={e => setToplu((t: any) => ({ ...t, yuvarla: e.target.value }))}><option value="0">Yok (kuruşlu)</option><option value="0.05">0,05 ₺'ye</option><option value="0.5">0,50 ₺'ye</option><option value="1">1 ₺'ye</option><option value="5">5 ₺'ye</option></select></Field>
        </FormGrid>}
      </Modal>

      <Modal open={!!kopya} onClose={() => setKopya(null)} onSubmit={kopyala} width={440} title="Listeyi Kopyala"
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setKopya(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kopyala</button></>}>
        {kopya && <FormGrid cols={1}>
          <Field label="Yeni Liste Adı"><input className="adm-inp" required value={kopya.ad} onChange={e => setKopya((k: any) => ({ ...k, ad: e.target.value }))} /></Field>
          <Field label="Fiyatlara % uygula (opsiyonel)" hint="Örn. bayi listesi için −20"><input type="number" step="0.1" className="adm-inp" value={kopya.yuzde} onChange={e => setKopya((k: any) => ({ ...k, yuzde: e.target.value }))} /></Field>
        </FormGrid>}
      </Modal>
      {toast.node}
    </div>
  )
}
