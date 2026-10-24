'use client'
import { useAcParam } from '@/lib/ac-param'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { fmt, fmtK, fmtN, fmtInt, fmtDateTime } from '@/lib/fmt'
import { useUretim, byId, HAREKET_TIP } from '@/lib/uretim-utils'
import { Page, PageHead, Kpi, KpiGrid, Card, Badge, Tabs, Money, Drawer, Modal, Field, FormGrid, InfoRow, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col, type ServerMode } from '@/components/admin/erp/DataGrid'
import { TrendChart } from '@/components/admin/erp/charts'
import { Plus, ArrowDownCircle, ArrowUpCircle, Undo2, Activity, Coins, Package, Boxes, PenLine } from 'lucide-react'

const bos = { tur: 'hammadde', item: '', yon: 'giris', tip: 'manuel_duzeltme', miktar: '', depo: '', aciklama: '' }
const TIP_TONE: Record<string, any> = { uretim_giris: 'green', uretim_cikis: 'blue', satis: 'ac', satinalma: 'green', sevkiyat: 'ac', fire: 'red', sayim: 'amber', manuel_duzeltme: 'muted', iade: 'amber' }
const baslangic = (donem: string) => { if (donem === 'tumu') return null; const d = new Date(); if (donem === 'bugun') d.setHours(0, 0, 0, 0); else d.setDate(d.getDate() - +donem); return d.toISOString() }

// Stok defteri milyonlarca satır olabilir: liste v_stok_defteri üzerinden sunucuda sayfalanır, toplamlar rpc_stok_defteri_ozet ile hesaplanır.
export default function StokHareketleriPage() {
  const toast = useToast()
  const { d } = useUretim(['hammaddeler', 'variants', 'products', 'depolar'])
  const [tur, setTur] = useState('hepsi')
  const [yon, setYon] = useState('')
  const [tip, setTip] = useState('')
  const [depoF, setDepoF] = useState('')
  const [donem, setDonem] = useState('30')
  const [detay, setDetay] = useState<any>(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(bos)
  const [busy, setBusy] = useState(false)
  const [surum, setSurum] = useState(0)
  const [ozet, setOzet] = useState<any>(null)

  const urun = useMemo(() => byId(d.products), [d.products])
  const depo = useMemo(() => byId(d.depolar), [d.depolar])

  const filtre = useCallback((q: any) => {
    if (tur !== 'hepsi') q = q.eq('tur', tur)
    if (yon) q = q.eq('yon', yon)
    if (tip) q = q.eq('tip', tip)
    if (depoF) q = q.eq('depo_id', depoF)
    const b = baslangic(donem); if (b) q = q.gte('tarih', b)
    return q
  }, [tur, yon, tip, depoF, donem])

  // Özet KPI'lar + 30 günlük seri — veritabanında hesaplanır
  useEffect(() => {
    setOzet(null)
    erp.rpc('rpc_stok_defteri_ozet', { p_tur: tur === 'hepsi' ? null : tur, p_yon: yon || null, p_tip: tip || null, p_depo: depoF || null, p_from: baslangic(donem) }).then(setOzet).catch(() => setOzet({ adet: 0, giris: 0, cikis: 0, manuel: 0, toplam_kayit: 0, seri: [] }))
  }, [tur, yon, tip, depoF, donem, surum])

  const server: ServerMode<any> = {
    deps: [tur, yon, tip, depoF, donem, surum],
    fetch: ({ page, size, q, sort }) => erp.page('v_stok_defteri', '*', { build: filtre, search: q, searchIn: ['kalem_ad', 'aciklama', 'kaynak_ad'], sort: sort || { key: 'tarih', dir: 'desc' }, tieBreak: 'id', page, size, total: donem === 'tumu' && tur === 'hepsi' && !yon && !tip && !depoF && !q ? 'estimated' : 'exact' }),
  }

  const seri = useMemo(() => {
    const g = Array.from({ length: 30 }, (_, i) => { const t = new Date(); t.setDate(t.getDate() - (29 - i)); return t.toISOString().slice(0, 10) })
    const m = new Map<string, any>((ozet?.seri || []).map((x: any) => [x.g, x]))
    return { labels: g.map(x => x.slice(8) + '.' + x.slice(5, 7)), giris: g.map(k => +(m.get(k)?.giris || 0)), cikis: g.map(k => +(m.get(k)?.cikis || 0)) }
  }, [ozet])

  const kalemler = form.tur === 'hammadde' ? d.hammaddeler.filter((h: any) => h.aktif !== false).map((h: any) => ({ id: h.id, ad: `${h.ad} (${fmtN(h.mevcut_stok, 1)} ${h.birim})` })) : d.variants.map((v: any) => ({ id: v.id, ad: `${[urun[v.product_id]?.name, v.name].filter(Boolean).join(' · ')} (${v.stock})` }))

  async function kaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    const m = +form.miktar
    if (!form.item || !(m > 0)) return toast.show('Kalem ve miktar gerekli', true)
    setBusy(true)
    const r: any = await erp.from('stok_hareketleri').insert({ tip: form.tip, yon: form.yon, ...(form.tur === 'hammadde' ? { hammadde_id: form.item } : { variant_id: form.item }), miktar: m, depo_id: form.depo || null, kaynak_tablo: 'manuel', aciklama: form.aciklama || null })
    setBusy(false)
    if (r?.error) return toast.show(r.error, true)
    setModal(false); toast.show('Hareket kaydedildi'); setSurum(v => v + 1)
  }
  async function tersKayit(m: any) {
    if (!confirm(`${m.kalem_ad}: ${m.yon === 'giris' ? '+' : '-'}${fmtN(m.miktar, 2)} hareketi için ters kayıt oluşturulsun mu?\n(Kayıt silinmez; karşı yönde yeni bir hareket eklenir.)`)) return
    const r: any = await erp.from('stok_hareketleri').insert({ tip: m.tip === 'sayim' ? 'sayim' : 'manuel_duzeltme', yon: m.yon === 'giris' ? 'cikis' : 'giris', ...(m.hammadde_id ? { hammadde_id: m.hammadde_id } : { variant_id: m.variant_id }), miktar: m.miktar, depo_id: m.depo_id, kaynak_tablo: 'manuel', aciklama: `Ters kayıt — ${m.aciklama || HAREKET_TIP[m.tip]}` })
    if (r?.error) return toast.show(r.error, true)
    toast.show('Ters kayıt eklendi'); setDetay(null); setSurum(v => v + 1)
  }

  const cols: Col<any>[] = [
    { key: 'tarih', sortKey: 'tarih', label: 'Tarih', width: 132, render: m => <span style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDateTime(m.tarih)}</span>, csv: m => m.tarih },
    { key: 'ad', sortKey: 'kalem_ad', label: 'Kalem', render: m => <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{m.tur === 'hammadde' ? <Boxes size={14} style={{ color: 'var(--adm-ac)', flexShrink: 0 }} /> : <Package size={14} style={{ color: 'var(--adm-blue)', flexShrink: 0 }} />}<span style={{ fontWeight: 600 }}>{m.kalem_ad}</span></div>, csv: m => m.kalem_ad },
    { key: 'tip', sortKey: 'tip', label: 'Tip', render: m => <Badge tone={TIP_TONE[m.tip]}>{HAREKET_TIP[m.tip]}</Badge>, csv: m => HAREKET_TIP[m.tip] },
    { key: 'miktar', sortKey: 'signed', label: 'Miktar', align: 'right', render: m => <b style={{ fontFamily: 'JetBrains Mono,monospace', color: +m.signed > 0 ? 'var(--adm-green)' : 'var(--adm-red)' }}>{+m.signed > 0 ? '+' : ''}{fmtN(+m.signed, m.birim === 'adet' ? 0 : 2)} <span style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--adm-tx3)' }}>{m.birim}</span></b>, csv: m => m.signed },
    { key: 'deger', sortKey: 'deger', label: 'Değer', align: 'right', render: m => +m.deger ? <Money v={+m.deger} tone="auto" bold={false} /> : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, csv: m => m.deger, hideSm: true },
    { key: 'kaynak', sortKey: 'kaynak_ad', label: 'Kaynak', render: m => <span style={{ fontSize: 12, color: 'var(--adm-tx2)' }}>{m.kaynak_ad}</span>, csv: m => m.kaynak_ad, hideSm: true },
    { key: 'depo', label: 'Depo', render: m => depo[m.depo_id]?.ad || '—', csv: m => depo[m.depo_id]?.ad || '', hidden: true },
    { key: 'aciklama', sortKey: 'aciklama', label: 'Açıklama', render: m => <span style={{ color: 'var(--adm-tx3)', fontSize: 12 }}>{m.aciklama || ''}</span>, csv: m => m.aciklama, hideSm: true },
  ]

  useAcParam(true, id => { erp.from('v_stok_defteri').select('*').eq('id', id).limit(1).then((r: any) => { const m = r?.data?.[0]; if (m) setDetay(m) }).catch(() => {}) })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Stok Hareketleri" />
      <Page>
        <PageHead title="Stok Defteri" sub="Hammadde ve mamul stok hareketleri — sunucu tarafında sayfalanır, milyonlarca kayıtta da hızlıdır" actions={<button className="adm-btn" onClick={() => { setForm(bos); setModal(true) }}><Plus size={14} />Manuel Hareket</button>} />

        <KpiGrid min={180}>
          <Kpi label="Hareket (filtreli)" value={ozet ? fmtInt(ozet.adet) : '…'} Icon={Activity} color="var(--adm-ac)" sub={ozet ? `${fmtInt(ozet.toplam_kayit)} toplam kayıt` : ''} />
          <Kpi label="Giriş Değeri" value={ozet ? fmtK(+ozet.giris) : '…'} Icon={ArrowDownCircle} color="var(--adm-green)" sub="maliyet üzerinden" />
          <Kpi label="Çıkış Değeri" value={ozet ? fmtK(+ozet.cikis) : '…'} Icon={ArrowUpCircle} color="var(--adm-red)" />
          <Kpi label="Net Değer" value={ozet ? fmtK(+ozet.giris - +ozet.cikis) : '…'} Icon={Coins} color="var(--adm-blue)" />
          <Kpi label="Manuel / Sayım" value={ozet ? fmtInt(ozet.manuel) : '…'} Icon={PenLine} color="var(--adm-amber)" sub="elle girilen düzeltmeler" />
        </KpiGrid>

        <Card title="Son 30 Gün — Günlük Giriş / Çıkış Değeri" pad={16} style={{ marginBottom: 16 }}>
          <TrendChart type="bar" height={180} labels={seri.labels} series={[{ name: 'Giriş', color: '#14b088', data: seri.giris }, { name: 'Çıkış', color: '#e14b4b', data: seri.cikis }]} />
        </Card>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <Tabs value={tur} onChange={setTur} tabs={[{ v: 'hepsi', l: 'Tümü' }, { v: 'hammadde', l: 'Hammadde' }, { v: 'mamul', l: 'Mamul' }]} />
          <Tabs value={yon} onChange={setYon} tabs={[{ v: '', l: 'Giriş + Çıkış' }, { v: 'giris', l: 'Giriş' }, { v: 'cikis', l: 'Çıkış' }]} />
          <Tabs value={donem} onChange={setDonem} tabs={[{ v: 'bugun', l: 'Bugün' }, { v: '7', l: '7 gün' }, { v: '30', l: '30 gün' }, { v: 'tumu', l: 'Tümü' }]} />
        </div>

        <DataGrid rows={[]} server={server} cols={cols} rowKey={m => m.id} csvName="stok-hareketleri" storageKey="stokhareket-srv" pageSizes={[50, 100, 250, 500]} onRowClick={setDetay} activeKey={detay?.id}
          searchPlaceholder="Kalem, açıklama, kaynak..."
          filters={<><select className="adm-sel" value={tip} onChange={e => setTip(e.target.value)}><option value="">Tüm tipler</option>{Object.entries(HAREKET_TIP).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select className="adm-sel" value={depoF} onChange={e => setDepoF(e.target.value)}><option value="">Tüm depolar</option>{d.depolar.map((x: any) => <option key={x.id} value={x.id}>{x.ad}</option>)}</select></>}
          emptyTitle="Hareket bulunamadı" footerNote={<span>· KPI'lar arama metnini içermez · Değer = miktar × hareket maliyeti (yoksa ort. maliyet)</span>} />
      </Page>

      <Drawer open={!!detay} onClose={() => setDetay(null)} width={440} title={detay && <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{detay.kalem_ad}<Badge tone={TIP_TONE[detay.tip]}>{HAREKET_TIP[detay.tip]}</Badge></span>} sub={detay && fmtDateTime(detay.tarih)}
        footer={detay && <button className="adm-btn-ghost" onClick={() => tersKayit(detay)}><Undo2 size={13} />Ters kayıt oluştur</button>}>
        {detay && <div style={{ padding: 20 }}>
          <div style={{ textAlign: 'center', padding: '6px 0 16px' }}><b style={{ fontSize: 30, fontFamily: 'JetBrains Mono,monospace', color: +detay.signed > 0 ? 'var(--adm-green)' : 'var(--adm-red)' }}>{+detay.signed > 0 ? '+' : ''}{fmtN(+detay.signed, detay.birim === 'adet' ? 0 : 3)} {detay.birim}</b></div>
          <InfoRow k="Tür" v={detay.tur === 'hammadde' ? 'Hammadde' : 'Mamul (ürün)'} /><InfoRow k="Kaynak" v={detay.kaynak_ad} /><InfoRow k="Depo" v={depo[detay.depo_id]?.ad || '—'} />
          <InfoRow k="Birim maliyet" v={+detay.birim_maliyet ? fmt(detay.birim_maliyet) : '—'} /><InfoRow k="Değer" v={+detay.deger ? fmt(Math.abs(+detay.deger)) : '—'} /><InfoRow k="Açıklama" v={detay.aciklama || '—'} />
          <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 14 }}>Defter kayıtları silinmez. Hatalı bir hareketi “ters kayıt” ile düzeltirsin; bakiye otomatik doğru hale gelir.</p>
        </div>}
      </Drawer>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={kaydet} width={520} title="Manuel Stok Hareketi"
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>{[['hammadde', 'Hammadde', Boxes], ['mamul', 'Mamul (ürün)', Package]].map(([k, l, I]: any) => <button type="button" key={k} onClick={() => setForm((f: any) => ({ ...f, tur: k, item: '' }))} className={form.tur === k ? 'adm-btn' : 'adm-btn-ghost'} style={{ flex: 1, justifyContent: 'center' }}><I size={14} />{l}</button>)}</div>
        <FormGrid>
          <Field label="Kalem *" span={2}><select className="adm-inp" required value={form.item} onChange={e => setForm((f: any) => ({ ...f, item: e.target.value }))}><option value="">Seçin</option>{kalemler.map((k: any) => <option key={k.id} value={k.id}>{k.ad}</option>)}</select></Field>
          <Field label="Yön"><div style={{ display: 'flex', gap: 6 }}>{[['giris', 'Giriş'], ['cikis', 'Çıkış']].map(([k, l]) => <button type="button" key={k} onClick={() => setForm((f: any) => ({ ...f, yon: k }))} className={form.yon === k ? 'adm-btn' : 'adm-btn-ghost'} style={{ flex: 1, justifyContent: 'center', background: form.yon === k ? (k === 'giris' ? 'var(--adm-green)' : 'var(--adm-red)') : undefined }}>{l}</button>)}</div></Field>
          <Field label="Miktar *"><input type="number" step="0.001" min="0" required className="adm-inp" value={form.miktar} onChange={e => setForm((f: any) => ({ ...f, miktar: e.target.value }))} style={{ fontWeight: 700 }} /></Field>
          <Field label="Tip"><select className="adm-inp" value={form.tip} onChange={e => setForm((f: any) => ({ ...f, tip: e.target.value }))}>{['manuel_duzeltme', 'sayim', 'fire', 'iade'].map(t => <option key={t} value={t}>{HAREKET_TIP[t]}</option>)}</select></Field>
          <Field label="Depo"><select className="adm-inp" value={form.depo} onChange={e => setForm((f: any) => ({ ...f, depo: e.target.value }))}><option value="">—</option>{d.depolar.map((x: any) => <option key={x.id} value={x.id}>{x.ad}</option>)}</select></Field>
          <Field label="Açıklama" span={2}><input className="adm-inp" value={form.aciklama} onChange={e => setForm((f: any) => ({ ...f, aciklama: e.target.value }))} /></Field>
        </FormGrid>
      </Modal>
      {toast.node}
    </div>
  )
}
