'use client'
import { useAcParam } from '@/lib/ac-param'
import { useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { fmt, fmtN, fmtDate } from '@/lib/fmt'
import { useUretim, byId, receteMaliyet } from '@/lib/uretim-utils'
import { sum } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Money, Drawer, Modal, Field, FormGrid, Divider, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { topluSilCalistir } from '@/lib/toplu-sil'
import { Donut } from '@/components/admin/erp/charts'
import TopluDuzenle from '@/components/admin/TopluDuzenle'
import { ListChecks, Plus, Pencil, Trash2, FlaskConical, Copy, Power, Coins, AlertTriangle, X } from 'lucide-react'

type Kalem = { hammadde_id: string; miktar: string; giris: string }
const bos = { urun_id: '', versiyon: '1', kalip_id: '', kavite_sayisi: '1', hedef_cevrim_suresi: '', hedef_fire_orani: '0', iscilik_maliyeti: '0', genel_gider_maliyeti: '0', amortisman_maliyeti: '0', notlar: '' }

export default function RecetePage() {
  const toast = useToast()
  const { d, loading, reload } = useUretim(['receteler', 'receteKalemleri', 'products', 'hammaddeler', 'kaliplar', 'emirler'])
  const [tab, setTab] = useState('aktif')
  const [detay, setDetay] = useState<any>(null)
  const [adet, setAdet] = useState('1000')
  const [modal, setModal] = useState<any>(null) // { mode: 'yeni'|'duzenle'|'versiyon', kaynak? }
  const [form, setForm] = useState<any>(bos)
  const [kalemler, setKalemler] = useState<Kalem[]>([{ hammadde_id: '', miktar: '', giris: '' }])
  const [busy, setBusy] = useState(false)
  const [toplu, setToplu] = useState<any[] | null>(null)

  const urun = useMemo(() => byId(d.products), [d.products])
  const kalip = useMemo(() => byId(d.kaliplar), [d.kaliplar])
  const hm = useMemo(() => byId(d.hammaddeler), [d.hammaddeler])
  const C = useMemo(() => Object.fromEntries(d.receteler.map((r: any) => [r.id, receteMaliyet(r, d.receteKalemleri, d.hammaddeler)])), [d])

  const liste = d.receteler.filter((r: any) => tab === 'hepsi' || (tab === 'aktif' ? r.aktif : !r.aktif))
  const aktifler = d.receteler.filter((r: any) => r.aktif)
  const eksik = aktifler.filter((r: any) => C[r.id]?.eksikMaliyet || !C[r.id]?.satirlar.length)
  const ortMaliyet = aktifler.length ? sum(aktifler, (r: any) => C[r.id].firedahil) / aktifler.length : 0

  /* Form yardımcıları */
  const sonrakiVersiyon = (urunId: string) => Math.max(0, ...d.receteler.filter((r: any) => r.urun_id === urunId).map((r: any) => +r.versiyon)) + 1
  function openYeni() { setForm(bos); setKalemler([{ hammadde_id: '', miktar: '', giris: '' }]); setModal({ mode: 'yeni' }) }
  function doldur(r: any, versiyon: number) {
    setForm({ urun_id: r.urun_id, versiyon: String(versiyon), kalip_id: r.kalip_id || '', kavite_sayisi: String(r.kavite_sayisi || 1), hedef_cevrim_suresi: r.hedef_cevrim_suresi ? String(r.hedef_cevrim_suresi) : '', hedef_fire_orani: String(r.hedef_fire_orani || 0), iscilik_maliyeti: String(r.iscilik_maliyeti || 0), genel_gider_maliyeti: String(r.genel_gider_maliyeti || 0), amortisman_maliyeti: String(r.amortisman_maliyeti || 0), notlar: r.notlar || '' })
    const ks = d.receteKalemleri.filter((k: any) => k.recete_id === r.id).map((k: any) => ({ hammadde_id: k.hammadde_id, miktar: String(k.miktar), giris: '' }))
    setKalemler(ks.length ? ks : [{ hammadde_id: '', miktar: '', giris: '' }])
  }
  const openDuzenle = (r: any) => { doldur(r, r.versiyon); setModal({ mode: 'duzenle', kaynak: r }) }
  const openVersiyon = (r: any) => { doldur(r, sonrakiVersiyon(r.urun_id)); setModal({ mode: 'versiyon', kaynak: r }) }

  // Miktar hammadde birimindedir (kg). Gram girilirse otomatik ÷1000
  const setKalem = (i: number, p: Partial<Kalem>) => setKalemler(ks => ks.map((k, j) => j === i ? { ...k, ...p } : k))
  const gercekMiktar = (k: Kalem) => { const m = +k.miktar || 0; return k.giris === 'gr' ? m / 1000 : m }
  const formMaliyet = kalemler.reduce((s, k) => s + gercekMiktar(k) * (+hm[k.hammadde_id]?.ortalama_maliyet || 0), 0)
  const formToplam = formMaliyet + (+form.iscilik_maliyeti || 0) + (+form.genel_gider_maliyeti || 0) + (+form.amortisman_maliyeti || 0)
  const saatlikKapasite = +form.hedef_cevrim_suresi > 0 ? ((+form.kavite_sayisi || 1) * 3600) / +form.hedef_cevrim_suresi : 0

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy || !modal) return
    const gecerli = kalemler.filter(k => k.hammadde_id && gercekMiktar(k) > 0)
    if (!gecerli.length) return toast.show('En az bir hammadde kalemi gir', true)
    if (new Set(gecerli.map(k => k.hammadde_id)).size !== gecerli.length) return toast.show('Aynı hammadde birden fazla satırda var', true)
    if (modal.mode !== 'duzenle' && d.receteler.some((r: any) => r.urun_id === form.urun_id && +r.versiyon === +form.versiyon)) return toast.show('Bu ürün için bu versiyon zaten var', true)
    setBusy(true)
    try {
      const payload: any = { urun_id: form.urun_id, versiyon: +form.versiyon, kalip_id: form.kalip_id || null, kavite_sayisi: Math.max(1, +form.kavite_sayisi || 1), hedef_cevrim_suresi: form.hedef_cevrim_suresi ? +form.hedef_cevrim_suresi : null, hedef_fire_orani: +form.hedef_fire_orani || 0, iscilik_maliyeti: +form.iscilik_maliyeti || 0, genel_gider_maliyeti: +form.genel_gider_maliyeti || 0, amortisman_maliyeti: +form.amortisman_maliyeti || 0, notlar: form.notlar || null }
      let id = modal.kaynak?.id
      if (modal.mode === 'duzenle') {
        const u: any = await erp.from('urun_receteleri').update(payload).eq('id', id); if (u?.error) throw new Error(u.error)
        for (const k of d.receteKalemleri.filter((k: any) => k.recete_id === id)) await erp.from('recete_kalemleri').delete().eq('id', k.id)
      } else {
        // yeni versiyon/reçete aktif olur, aynı ürünün diğer aktif reçeteleri pasife alınır
        for (const r of d.receteler.filter((r: any) => r.urun_id === form.urun_id && r.aktif)) await erp.from('urun_receteleri').update({ aktif: false }).eq('id', r.id)
        const r: any = await erp.from('urun_receteleri').insert({ ...payload, aktif: true }); if (r?.error) throw new Error(r.error)
        id = r.data?.[0]?.id
      }
      const k: any = await erp.from('recete_kalemleri').insert(gecerli.map(x => ({ recete_id: id, hammadde_id: x.hammadde_id, miktar: gercekMiktar(x), birim: hm[x.hammadde_id]?.birim || 'kg' })))
      if (k?.error) throw new Error(k.error)
      toast.show(modal.mode === 'duzenle' ? 'Reçete güncellendi' : modal.mode === 'versiyon' ? `v${form.versiyon} oluşturuldu ve aktif yapıldı` : 'Reçete oluşturuldu'); setModal(null); setDetay(null); await reload()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  async function aktifToggle(r: any) {
    if (!r.aktif) for (const x of d.receteler.filter((x: any) => x.urun_id === r.urun_id && x.aktif)) await erp.from('urun_receteleri').update({ aktif: false }).eq('id', x.id)
    const u: any = await erp.from('urun_receteleri').update({ aktif: !r.aktif }).eq('id', r.id)
    if (u?.error) return toast.show(u.error, true)
    toast.show(r.aktif ? 'Reçete pasife alındı' : `v${r.versiyon} aktif yapıldı`); await reload(); setDetay((x: any) => x?.id === r.id ? { ...x, aktif: !r.aktif } : x)
  }
  async function topluSil(sel: any[]): Promise<string | void> {
    const { silinen, hata } = await topluSilCalistir(sel, async (r: any) => (await erp.from('urun_receteleri').delete().eq('id', r.id))?.error, 'reçete')
    await reload(); setDetay(null)
    if (hata) return hata
    toast.show(`${silinen} reçete silindi`)
  }
  async function del(r: any) {
    const kul = d.emirler.filter((e: any) => e.recete_id === r.id).length
    if (!confirm(`${urun[r.urun_id]?.name} v${r.versiyon} silinsin mi?${kul ? `\n\n${kul} üretim emri bu reçeteyi kullanıyor; emirlerde reçete boş kalır ve hammadde tüketimi yapılmaz.` : ''}`)) return
    const x: any = await erp.from('urun_receteleri').delete().eq('id', r.id)
    if (x?.error) return toast.show(x.error, true)
    toast.show('Reçete silindi'); setDetay(null); reload()
  }

  const cols: Col<any>[] = [
    { key: 'urun', label: 'Ürün', sort: r => urun[r.urun_id]?.name || '', render: r => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--adm-ac2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FlaskConical size={15} style={{ color: 'var(--adm-ac)' }} /></div><div><div style={{ fontWeight: 600 }}>{urun[r.urun_id]?.name || '—'}</div><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>v{r.versiyon} · {C[r.id]?.satirlar.length} kalem</div></div></div> },
    { key: 'kalip', label: 'Kalıp / Kavite', sort: r => kalip[r.kalip_id]?.ad || '', render: r => <div>{kalip[r.kalip_id]?.ad || <span style={{ color: 'var(--adm-tx3)' }}>Kalıpsız</span>}<div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{r.kavite_sayisi} kavite</div></div>, hideSm: true },
    { key: 'cevrim', label: 'Çevrim', align: 'right', sort: r => +r.hedef_cevrim_suresi || 0, render: r => r.hedef_cevrim_suresi ? `${r.hedef_cevrim_suresi} sn` : '—', hideSm: true },
    { key: 'fire', label: 'Hedef Fire', align: 'right', sort: r => +r.hedef_fire_orani || 0, render: r => `%${fmtN(+r.hedef_fire_orani || 0, 1)}`, hideSm: true },
    { key: 'ham', label: 'Hammadde', align: 'right', sort: r => C[r.id]?.hammadde, render: r => <span>{fmt(C[r.id]?.hammadde)}{C[r.id]?.eksikMaliyet && <AlertTriangle size={12} style={{ color: 'var(--adm-amber)', marginLeft: 4, verticalAlign: -2 }} />}</span>, csv: r => C[r.id]?.hammadde },
    { key: 'top', label: 'Birim Maliyet', align: 'right', sort: r => C[r.id]?.firedahil, render: r => <Money v={C[r.id]?.firedahil} />, csv: r => C[r.id]?.firedahil },
    { key: 'durum', label: 'Durum', width: 90, sort: r => (r.aktif ? 0 : 1), render: r => <Badge tone={r.aktif ? 'green' : 'muted'}>{r.aktif ? 'Aktif' : 'Pasif'}</Badge> },
  ]

  const dc = detay ? C[detay.id] : null
  const nAdet = Math.max(+adet || 0, 0)
  const uretilebilir = dc?.satirlar.length ? Math.floor(Math.min(...dc.satirlar.map((s: any) => (+s.miktar > 0 ? s.stok / +s.miktar : Infinity)))) : 0

  useAcParam(!loading, id => { const r = d.receteler.find((x: any) => x.id === id); if (r) openDuzenle(r) })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="BOM / Üretim Reçeteleri" />
      <Page>
        <PageHead title="Ürün Reçeteleri (BOM)" sub="Hammadde tüketimi, birim maliyet, versiyon yönetimi" actions={<button className="adm-btn" onClick={openYeni}><Plus size={14} />Reçete Oluştur</button>} />
        <KpiGrid min={190}>
          <Kpi label="Toplam Reçete" value={d.receteler.length} Icon={FlaskConical} color="var(--adm-ac)" sub={`${aktifler.length} aktif`} />
          <Kpi label="Ort. Birim Maliyet" value={fmt(ortMaliyet)} Icon={Coins} color="var(--adm-green)" sub="aktif reçeteler, fire dahil" />
          <Kpi label="Maliyeti Eksik" value={eksik.length} Icon={AlertTriangle} color={eksik.length ? 'var(--adm-amber)' : 'var(--adm-green)'} sub={eksik.length ? 'hammadde maliyeti girilmemiş' : 'Tümü hesaplanabilir'} />
          <Kpi label="Ürünü Reçetesiz" value={d.products.filter((p: any) => !aktifler.some((r: any) => r.urun_id === p.id)).length} Icon={FlaskConical} color="var(--adm-blue)" sub={`${d.products.length} üründen`} />
        </KpiGrid>
        <div style={{ marginBottom: 12 }}><Tabs value={tab} onChange={setTab} tabs={[{ v: 'aktif', l: 'Aktif', n: aktifler.length }, { v: 'pasif', l: 'Pasif / Eski', n: d.receteler.length - aktifler.length }, { v: 'hepsi', l: 'Tümü', n: d.receteler.length }]} /></div>

        <DataGrid rows={liste} cols={cols} rowKey={r => r.id} loading={loading} onBulkDelete={topluSil} deleteNoun="reçete" deleteNote="Reçeteyi kullanan üretim emirlerinde reçete boş kalır ve hammadde tüketimi yapılmaz." csvName="receteler" storageKey="receteler" onRowClick={setDetay} activeKey={detay?.id} selectable bulkActions={(sel) => <button className="adm-btn-ghost" style={{ padding: '3px 12px', fontSize: 12 }} onClick={() => setToplu(sel)}><ListChecks size={12} />Toplu düzenle</button>}
          searchText={r => `${urun[r.urun_id]?.name || ''} v${r.versiyon}`} searchPlaceholder="Ürün ara..." emptyTitle="Reçete yok" emptySub="Reçete Oluştur ile ürün için hammadde listesi tanımla; üretim emri bu reçeteye göre stoktan düşer." />
      </Page>

      <Drawer open={!!detay} onClose={() => setDetay(null)} width={600}
        title={detay && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{urun[detay.urun_id]?.name} <span style={{ color: 'var(--adm-tx3)', fontWeight: 500 }}>v{detay.versiyon}</span><Badge tone={detay.aktif ? 'green' : 'muted'}>{detay.aktif ? 'Aktif' : 'Pasif'}</Badge></span>}
        sub={detay && `${kalip[detay.kalip_id]?.ad || 'Kalıpsız'} · ${detay.kavite_sayisi} kavite${detay.hedef_cevrim_suresi ? ` · ${detay.hedef_cevrim_suresi} sn` : ''} · ${fmtDate(detay.created_at)}`}
        footer={detay && <>
          <button className="adm-btn-danger" onClick={() => del(detay)}><Trash2 size={13} /></button>
          <button className="adm-btn-ghost" onClick={() => aktifToggle(detay)}><Power size={13} />{detay.aktif ? 'Pasife al' : 'Aktif yap'}</button>
          <button className="adm-btn-ghost" onClick={() => openVersiyon(detay)}><Copy size={13} />Yeni versiyon</button>
          <button className="adm-btn" onClick={() => openDuzenle(detay)}><Pencil size={13} />Düzenle</button></>}>
        {detay && dc && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Birim maliyet</div><Money v={dc.toplam} size={16} /></div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Fire dahil</div><Money v={dc.firedahil} size={16} /><div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>hedef %{fmtN(+detay.hedef_fire_orani || 0, 1)}</div></div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Stoktan üretilebilir</div><b style={{ fontSize: 16, fontFamily: 'JetBrains Mono,monospace' }}>{dc.satirlar.length ? uretilebilir.toLocaleString('tr-TR') : '—'}</b><div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>adet</div></div>
            </div>
            {dc.eksikMaliyet && <div style={{ padding: 10, borderRadius: 9, background: 'var(--adm-amber2)', fontSize: 12, color: 'var(--adm-amber)', marginBottom: 14, display: 'flex', gap: 8 }}><AlertTriangle size={14} />Bazı hammaddelerin ortalama maliyeti 0 — maliyet eksik hesaplanıyor. Stok → Hammadde sayfasından gir.</div>}
            <Divider label="Maliyet dağılımı" />
            <Donut size={150} data={[{ label: 'Hammadde', value: dc.hammadde, color: '#e55f28' }, { label: 'İşçilik', value: dc.iscilik, color: '#2f7dd6' }, { label: 'Genel gider', value: dc.genel, color: '#c9821c' }, { label: 'Amortisman', value: dc.amort, color: '#8b5cf6' }].filter(x => x.value > 0)} center={{ top: 'Birim', bottom: fmt(dc.toplam) }} />
            <Divider label="Hammadde kalemleri" />
            <table className="adm-tbl compact"><thead><tr><th>Hammadde</th><th style={{ textAlign: 'right' }}>Miktar</th><th style={{ textAlign: 'right' }}>Birim ₺</th><th style={{ textAlign: 'right' }}>Tutar</th><th style={{ textAlign: 'right' }}>Pay</th></tr></thead>
              <tbody>{dc.satirlar.map((s: any) => <tr key={s.id}><td>{s.ad}</td><td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono,monospace' }}>{fmtN(s.miktar, 3)} {s.birim}</td><td style={{ textAlign: 'right' }}>{s.birimMaliyet ? fmt(s.birimMaliyet) : <span style={{ color: 'var(--adm-amber)' }}>—</span>}</td><td style={{ textAlign: 'right' }}>{fmt(s.tutar)}</td><td style={{ textAlign: 'right', color: 'var(--adm-tx3)' }}>%{dc.hammadde ? fmtN((s.tutar / dc.hammadde) * 100, 0) : 0}</td></tr>)}</tbody></table>

            <Divider label="Hammadde ihtiyaç hesabı" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12.5 }}>
              <input type="number" className="adm-inp" style={{ width: 120 }} value={adet} onChange={e => setAdet(e.target.value)} /><span>adet üretmek için (fire dahil %{fmtN(+detay.hedef_fire_orani || 0, 1)})</span>
            </div>
            {dc.satirlar.map((s: any) => {
              const gerekli = s.miktar * nAdet * (1 + (+detay.hedef_fire_orani || 0) / 100), acik = Math.max(gerekli - s.stok, 0)
              return <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5, borderBottom: '1px dashed var(--adm-bdr)' }}><span>{s.ad}</span><span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{fmtN(gerekli, 1)} {s.birim} <span style={{ color: acik ? 'var(--adm-red)' : 'var(--adm-green)' }}>· stok {fmtN(s.stok, 1)}{acik ? ` (eksik ${fmtN(acik, 1)})` : ' ✓'}</span></span></div>
            })}
            {detay.notlar && <><Divider label="Not" /><p style={{ fontSize: 12.5, color: 'var(--adm-tx2)', margin: 0, whiteSpace: 'pre-wrap' }}>{detay.notlar}</p></>}
          </div>
        )}
      </Drawer>

      <Modal open={!!modal} onClose={() => setModal(null)} onSubmit={save} width={820} title={modal?.mode === 'duzenle' ? 'Reçeteyi Düzenle' : modal?.mode === 'versiyon' ? 'Yeni Versiyon' : 'Yeni Reçete'}
        footer={<>
          <span style={{ marginRight: 'auto', fontSize: 13 }}>Hammadde {fmt(formMaliyet)} · Toplam <b style={{ color: 'var(--adm-green)', fontSize: 15 }}>{fmt(formToplam)}</b> / adet</span>
          <button type="button" className="adm-btn-ghost" onClick={() => setModal(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>{busy ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
        <FormGrid cols={4}>
          <Field label="Ürün *" span={2}><select className="adm-inp" required disabled={modal?.mode !== 'yeni'} value={form.urun_id} onChange={e => setForm((f: any) => ({ ...f, urun_id: e.target.value, versiyon: String(sonrakiVersiyon(e.target.value)) }))}><option value="">Seçin</option>{d.products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Versiyon"><input type="number" min="1" className="adm-inp" value={form.versiyon} onChange={e => setForm((f: any) => ({ ...f, versiyon: e.target.value }))} /></Field>
          <Field label="Kavite"><input type="number" min="1" className="adm-inp" value={form.kavite_sayisi} onChange={e => setForm((f: any) => ({ ...f, kavite_sayisi: e.target.value }))} /></Field>
          <Field label="Kalıp" span={2}><select className="adm-inp" value={form.kalip_id} onChange={e => { const k = kalip[e.target.value]; setForm((f: any) => ({ ...f, kalip_id: e.target.value, kavite_sayisi: k ? String(k.kavite_sayisi || 1) : f.kavite_sayisi })) }}><option value="">Kalıpsız</option>{d.kaliplar.map((k: any) => <option key={k.id} value={k.id}>{k.ad} ({k.kavite_sayisi} kav.)</option>)}</select></Field>
          <Field label="Hedef çevrim (sn)" hint={saatlikKapasite ? `≈ ${fmtN(saatlikKapasite, 0)} adet/saat` : undefined}><input type="number" step="0.1" className="adm-inp" value={form.hedef_cevrim_suresi} onChange={e => setForm((f: any) => ({ ...f, hedef_cevrim_suresi: e.target.value }))} /></Field>
          <Field label="Hedef fire %"><input type="number" step="0.1" min="0" max="90" className="adm-inp" value={form.hedef_fire_orani} onChange={e => setForm((f: any) => ({ ...f, hedef_fire_orani: e.target.value }))} /></Field>
          <Field label="İşçilik ₺/adet"><input type="number" step="0.0001" min="0" className="adm-inp" value={form.iscilik_maliyeti} onChange={e => setForm((f: any) => ({ ...f, iscilik_maliyeti: e.target.value }))} /></Field>
          <Field label="Genel gider ₺/adet"><input type="number" step="0.0001" min="0" className="adm-inp" value={form.genel_gider_maliyeti} onChange={e => setForm((f: any) => ({ ...f, genel_gider_maliyeti: e.target.value }))} /></Field>
          <Field label="Amortisman ₺/adet"><input type="number" step="0.0001" min="0" className="adm-inp" value={form.amortisman_maliyeti} onChange={e => setForm((f: any) => ({ ...f, amortisman_maliyeti: e.target.value }))} /></Field>
        </FormGrid>

        <Divider label="Hammadde kalemleri (1 adet için)" />
        <table className="adm-tbl compact"><thead><tr><th>Hammadde</th><th style={{ width: 130 }}>Miktar</th><th style={{ width: 90 }}>Birim</th><th style={{ width: 110, textAlign: 'right' }}>Maliyet</th><th style={{ width: 30 }} /></tr></thead>
          <tbody>{kalemler.map((k, i) => {
            const h = hm[k.hammadde_id]; const kgMi = (h?.birim || '').toLowerCase() === 'kg'
            return <tr key={i}>
              <td><select className="adm-inp" style={{ padding: '6px 8px', fontSize: 12.5 }} value={k.hammadde_id} onChange={e => setKalem(i, { hammadde_id: e.target.value, giris: '' })}><option value="">Seçin</option>{d.hammaddeler.filter((x: any) => x.kullanim !== 'kullanilmiyor' || x.id === k.hammadde_id).map((x: any) => <option key={x.id} value={x.id}>{x.ad} ({x.birim})</option>)}</select></td>
              <td><input type="number" step="0.0001" min="0" className="adm-inp" style={{ padding: '6px 8px', fontSize: 12.5 }} value={k.miktar} onChange={e => setKalem(i, { miktar: e.target.value })} /></td>
              <td>{kgMi ? <select className="adm-inp" style={{ padding: '6px 6px', fontSize: 12.5 }} value={k.giris || 'kg'} onChange={e => setKalem(i, { giris: e.target.value })}><option value="kg">kg</option><option value="gr">gr</option></select> : <span style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>{h?.birim || '—'}</span>}</td>
              <td style={{ textAlign: 'right' }}><Money v={gercekMiktar(k) * (+h?.ortalama_maliyet || 0)} bold={false} size={12} /></td>
              <td><button type="button" disabled={kalemler.length === 1} onClick={() => setKalemler(ks => ks.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--adm-red)' }}><X size={14} /></button></td></tr>
          })}</tbody></table>
        <button type="button" className="adm-btn-ghost" style={{ marginTop: 10, fontSize: 12 }} onClick={() => setKalemler(ks => [...ks, { hammadde_id: '', miktar: '', giris: '' }])}><Plus size={12} />Kalem Ekle</button>
        <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', margin: '10px 0 0' }}>Miktarlar hammaddenin stok birimiyle (örn. kg) saklanır — stoktan düşüm ve maliyet buna göre yapılır. Kg’lık hammaddede “gr” seçersen otomatik ÷1000 çevrilir (35 gr = 0,035 kg).</p>
        <div style={{ marginTop: 12 }}><Field label="Notlar"><textarea className="adm-inp" rows={2} value={form.notlar} onChange={e => setForm((f: any) => ({ ...f, notlar: e.target.value }))} /></Field></div>
      </Modal>
      <TopluDuzenle rows={toplu} onClose={() => setToplu(null)} onDone={() => { setToplu(null); reload() }} client={erp} table="urun_receteleri" fields={[
        { key: 'kalip_id', label: 'Kalıp', type: 'select', bosYapilabilir: true, options: d.kaliplar.map((k: any) => ({ v: k.id, l: k.ad })) },
        { key: 'hedef_cevrim_suresi', label: 'Hedef çevrim süresi (sn)', type: 'number' },
        { key: 'hedef_fire_orani', label: 'Hedef fire oranı', type: 'number' },
        { key: 'iscilik_maliyeti', label: 'İşçilik maliyeti', type: 'number' },
        { key: 'genel_gider_maliyeti', label: 'Genel gider maliyeti', type: 'number' },
        { key: 'amortisman_maliyeti', label: 'Amortisman maliyeti', type: 'number' },
      ]} />
      {toast.node}
    </div>
  )
}
