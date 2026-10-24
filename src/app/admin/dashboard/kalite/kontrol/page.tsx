'use client'
import { useAcParam } from '@/lib/ac-param'
import { useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { createClient } from '@/lib/supabase/client'
import { fmtN, fmtInt, fmtDate, fmtDateTime, fmtPct } from '@/lib/fmt'
import { useUretim, byId, receteMaliyet } from '@/lib/uretim-utils'
import { sum, CHART_COLORS } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Card, Badge, Tabs, Drawer, Modal, Field, FormGrid, InfoRow, Divider, Empty, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { topluSilCalistir } from '@/lib/toplu-sil'
import { TrendChart, BarList } from '@/components/admin/erp/charts'
import TopluDuzenle from '@/components/admin/TopluDuzenle'
import { ListChecks, Plus, Pencil, Trash2, ShieldCheck, ShieldAlert, PackageX, Percent, ClipboardList, Flame, CheckCircle2 } from 'lucide-react'

const SONUC: Record<string, { l: string; tone: any }> = { uygun: { l: 'Uygun', tone: 'green' }, sartli_uygun: { l: 'Şartlı Uygun', tone: 'amber' }, red: { l: 'Red', tone: 'red' } }
const TIP: Record<string, string> = { giris_kontrol: 'Giriş Kontrol', proses_kontrol: 'Proses Kontrol', son_kontrol: 'Son Kontrol' }
const NEDENLER = ['Kısa atım', 'Çapak', 'Yanık / siyah nokta', 'Renk hatası', 'Çarpılma', 'Boyut hatası', 'Çizik / yüzey hatası', 'Kırık / çatlak', 'Ambalaj hatası']
const bos = { uretim_emri_id: '', urun_id: '', kontrol_tipi: 'son_kontrol', kontrol_edilen_adet: '', uygun_adet: '', red_adet: '0', red_nedeni: '', sonuc: 'uygun', notlar: '' }

// Red oranına göre önerilen sonuç
const oneri = (kontrol: number, red: number) => (red <= 0 ? 'uygun' : kontrol > 0 && (red / kontrol) * 100 <= 3 ? 'sartli_uygun' : 'red')
const hafta = (t: string) => { const d = new Date(t); const g = (d.getDay() + 6) % 7; d.setDate(d.getDate() - g); return d.toISOString().slice(0, 10) }

export default function KaliteKontrolPage() {
  const toast = useToast()
  const { d, loading, reload } = useUretim(['kalite', 'products', 'emirler', 'variants', 'receteler', 'receteKalemleri', 'hammaddeler'])
  const [tab, setTab] = useState('hepsi')
  const [tipF, setTipF] = useState('')
  const [detay, setDetay] = useState<any>(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(bos)
  const [sonucElle, setSonucElle] = useState(false)
  const [uid, setUid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toplu, setToplu] = useState<any[] | null>(null)
  useEffect(() => { createClient().auth.getUser().then(({ data }) => setUid(data.user?.id || null)).catch(() => {}) }, [])

  const urun = useMemo(() => byId(d.products), [d.products])
  const emir = useMemo(() => byId(d.emirler), [d.emirler])

  const liste = d.kalite.filter((k: any) => (tab === 'hepsi' || k.sonuc === tab) && (!tipF || k.kontrol_tipi === tipF))
  const kontrol = sum(d.kalite, (k: any) => k.kontrol_edilen_adet), uygun = sum(d.kalite, (k: any) => k.uygun_adet), red = sum(d.kalite, (k: any) => k.red_adet)
  const fpy = kontrol ? (uygun / kontrol) * 100 : 0, redOran = kontrol ? (red / kontrol) * 100 : 0
  const cnt = (s: string) => d.kalite.filter((k: any) => k.sonuc === s).length

  // Son kontrolü girilmemiş tamamlanan emirler
  const bekleyen = d.emirler.filter((e: any) => e.durum === 'tamamlandi' && +e.uretilen_miktar > 0 && !d.kalite.some((k: any) => k.uretim_emri_id === e.id && k.kontrol_tipi === 'son_kontrol'))

  // Haftalık FPY (son 12 hafta)
  const haftalik = useMemo(() => {
    const w: string[] = []; const t = new Date(); for (let i = 11; i >= 0; i--) { const x = new Date(t); x.setDate(x.getDate() - i * 7); w.push(hafta(x.toISOString())) }
    return w.map(k => { const r = d.kalite.filter((x: any) => x.tarih && hafta(x.tarih) === k); const kn = sum(r, (x: any) => x.kontrol_edilen_adet); return { k, fpy: kn ? (sum(r, (x: any) => x.uygun_adet) / kn) * 100 : null, kn } })
  }, [d.kalite])
  const fpySeri = (() => { let son = 0; return haftalik.map(h => { if (h.fpy != null) son = h.fpy; return son }) })()

  const nedenler = useMemo(() => { const m: Record<string, number> = {}; d.kalite.forEach((k: any) => { if (+k.red_adet > 0) m[k.red_nedeni || 'Belirtilmemiş'] = (m[k.red_nedeni || 'Belirtilmemiş'] || 0) + +k.red_adet }); return Object.entries(m).sort((a, b) => b[1] - a[1]) }, [d.kalite])
  const nedenToplam = sum(nedenler, x => x[1])
  const urunRed = useMemo(() => {
    const m: Record<string, { k: number; r: number }> = {}
    d.kalite.forEach((k: any) => { const u = k.urun_id || emir[k.uretim_emri_id]?.urun_id; if (!u) return; const o = (m[u] ||= { k: 0, r: 0 }); o.k += +k.kontrol_edilen_adet || 0; o.r += +k.red_adet || 0 })
    return Object.entries(m).filter(([, v]) => v.k > 0).map(([id, v]) => ({ label: urun[id]?.name || '—', value: (v.r / v.k) * 100, sub: `${fmtInt(v.r)}/${fmtInt(v.k)}` })).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [d.kalite, emir, urun])

  /* Form */
  const openNew = (pre: any = {}) => { setEditing(null); setSonucElle(false); setForm({ ...bos, ...pre }); setModal(true) }
  const openEdit = (k: any) => { setEditing(k); setSonucElle(true); setForm({ uretim_emri_id: k.uretim_emri_id || '', urun_id: k.urun_id || '', kontrol_tipi: k.kontrol_tipi, kontrol_edilen_adet: String(k.kontrol_edilen_adet ?? ''), uygun_adet: String(k.uygun_adet ?? ''), red_adet: String(k.red_adet ?? 0), red_nedeni: k.red_nedeni || '', sonuc: k.sonuc, notlar: k.notlar || '' }); setModal(true) }
  const emirSec = (id: string) => { const e = emir[id]; setForm((f: any) => ({ ...f, uretim_emri_id: id, urun_id: e?.urun_id || f.urun_id, ...(e && !f.kontrol_edilen_adet ? { kontrol_edilen_adet: String(e.uretilen_miktar), uygun_adet: String(e.uretilen_miktar), red_adet: '0' } : {}) })) }
  const adetDegis = (p: any) => setForm((f: any) => {
    const n = { ...f, ...p }
    const k = +n.kontrol_edilen_adet || 0
    if ('kontrol_edilen_adet' in p || 'uygun_adet' in p) n.red_adet = String(Math.max(k - (+n.uygun_adet || 0), 0))
    if ('red_adet' in p) n.uygun_adet = String(Math.max(k - (+n.red_adet || 0), 0))
    if (!sonucElle) n.sonuc = oneri(k, +n.red_adet || 0)
    return n
  })

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    const k = +form.kontrol_edilen_adet, u = +form.uygun_adet, r = +form.red_adet
    if (!(k > 0)) return toast.show('Kontrol edilen adet gerekli', true)
    if (u + r > k) return toast.show('Uygun + red adedi kontrol edilen adedi aşamaz', true)
    if (r > 0 && !form.red_nedeni.trim()) return toast.show('Red adedi varsa red nedeni gir', true)
    setBusy(true)
    const payload: any = { uretim_emri_id: form.uretim_emri_id || null, urun_id: form.urun_id || null, kontrol_tipi: form.kontrol_tipi, kontrol_edilen_adet: k, uygun_adet: u, red_adet: r, red_nedeni: form.red_nedeni.trim() || null, sonuc: form.sonuc, notlar: form.notlar || null }
    const res: any = editing ? await erp.from('kalite_kontrol_kayitlari').update(payload).eq('id', editing.id) : await erp.from('kalite_kontrol_kayitlari').insert({ ...payload, kontrol_eden_id: uid })
    setBusy(false)
    if (res?.error) return toast.show(res.error, true)
    setModal(false); toast.show(editing ? 'Kayıt güncellendi' : 'Kontrol kaydı eklendi'); await reload()
  }
  async function topluSil(sel: any[]): Promise<string | void> {
    const { silinen, hata } = await topluSilCalistir(sel, async (r: any) => (await erp.from('kalite_kontrol_kayitlari').delete().eq('id', r.id))?.error, 'kontrol kaydı')
    await reload(); setDetay(null)
    if (hata) return hata
    toast.show(`${silinen} kontrol kaydı silindi`)
  }
  async function del(k: any) {
    if (!confirm('Bu kontrol kaydı silinsin mi?')) return
    const r: any = await erp.from('kalite_kontrol_kayitlari').delete().eq('id', k.id)
    if (r?.error) return toast.show(r.error, true)
    toast.show('Kayıt silindi'); setDetay(null); reload()
  }

  // Red adedinden fire kaydı (+ isteğe bağlı stoktan düşüm)
  async function fireOlustur(k: any) {
    const e = emir[k.uretim_emri_id], uid2 = k.urun_id || e?.urun_id
    const v = d.variants.filter((x: any) => x.product_id === uid2).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))[0]
    const rec = e?.recete_id ? d.receteler.find((r: any) => r.id === e.recete_id) : null
    const bm = rec ? receteMaliyet(rec, d.receteKalemleri, d.hammaddeler).toplam : 0
    const stoktan = v ? confirm(`${fmtInt(k.red_adet)} adet red için FİRE KAYDI oluşturulacak.\n\nBitmiş ürün stoğundan (${v.name}) da düşülsün mü?\n(Üretim girişiyle stoğa girmiş ürünler için Tamam)`) : false
    setBusy(true)
    const r: any = await erp.from('fire_kayitlari').insert({ uretim_emri_id: k.uretim_emri_id || null, variant_id: v?.id || null, miktar: +k.red_adet, birim: 'adet', fire_nedeni: `Kalite red: ${k.red_nedeni || '—'}`, maliyet_etkisi: +(bm * +k.red_adet).toFixed(2), tarih: new Date().toISOString() })
    if (r?.error) { setBusy(false); return toast.show(r.error, true) }
    if (stoktan && v) await erp.from('stok_hareketleri').insert({ tip: 'fire', yon: 'cikis', variant_id: v.id, miktar: +k.red_adet, kaynak_tablo: 'fire_kayitlari', kaynak_id: r.data?.[0]?.id, aciklama: `Kalite red — ${k.red_nedeni || ''}` })
    setBusy(false); toast.show('Fire kaydı oluşturuldu')
  }

  const cols: Col<any>[] = [
    { key: 'tarih', label: 'Tarih', width: 112, sort: k => k.tarih, render: k => <span style={{ whiteSpace: 'nowrap' }}>{fmtDate(k.tarih)}</span> },
    { key: 'emir', label: 'Emir / Ürün', sort: k => emir[k.uretim_emri_id]?.no || '', render: k => { const e = emir[k.uretim_emri_id]; return <div><b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{e?.no || '—'}</b><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{urun[k.urun_id || e?.urun_id]?.name || ''}</div></div> } },
    { key: 'tip', label: 'Tip', sort: k => k.kontrol_tipi, render: k => TIP[k.kontrol_tipi], hideSm: true },
    { key: 'kontrol', label: 'Kontrol', align: 'right', sort: k => +k.kontrol_edilen_adet, render: k => fmtInt(k.kontrol_edilen_adet), total: rs => fmtInt(sum(rs, (k: any) => k.kontrol_edilen_adet)) },
    { key: 'uygun', label: 'Uygun', align: 'right', sort: k => +k.uygun_adet, render: k => <span style={{ color: 'var(--adm-green)', fontWeight: 600 }}>{fmtInt(k.uygun_adet)}</span>, total: rs => fmtInt(sum(rs, (k: any) => k.uygun_adet)), hideSm: true },
    { key: 'red', label: 'Red', align: 'right', sort: k => +k.red_adet, render: k => +k.red_adet ? <span style={{ color: 'var(--adm-red)', fontWeight: 700 }}>{fmtInt(k.red_adet)}</span> : <span style={{ color: 'var(--adm-tx3)' }}>0</span>, total: rs => fmtInt(sum(rs, (k: any) => k.red_adet)) },
    { key: 'oran', label: 'Red %', align: 'right', sort: k => (+k.kontrol_edilen_adet ? (+k.red_adet / +k.kontrol_edilen_adet) * 100 : 0), render: k => `%${fmtN(+k.kontrol_edilen_adet ? (+k.red_adet / +k.kontrol_edilen_adet) * 100 : 0, 1)}`, total: rs => { const kn = sum(rs, (k: any) => k.kontrol_edilen_adet); return `%${fmtN(kn ? (sum(rs, (k: any) => k.red_adet) / kn) * 100 : 0, 1)}` }, hideSm: true },
    { key: 'neden', label: 'Red Nedeni', sort: k => k.red_nedeni || '', render: k => k.red_nedeni || <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true },
    { key: 'sonuc', label: 'Sonuç', width: 120, sort: k => k.sonuc, render: k => <Badge tone={SONUC[k.sonuc]?.tone}>{SONUC[k.sonuc]?.l}</Badge> },
    { key: 'act', label: '', width: 80, align: 'right', render: k => <span style={{ display: 'inline-flex', gap: 4 }} onClick={e => e.stopPropagation()}><button className="adm-btn-ghost" style={{ padding: '4px 7px' }} onClick={() => openEdit(k)}><Pencil size={12} /></button><button className="adm-btn-danger" style={{ padding: '4px 7px' }} onClick={() => del(k)}><Trash2 size={12} /></button></span> },
  ]

  const dE = detay ? emir[detay.uretim_emri_id] : null

  useAcParam(!loading, id => { const k = d.kalite.find((x: any) => x.id === id); if (k) openEdit(k) })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Kalite Kontrol" />
      <Page>
        <PageHead title="Kalite Kontrol" sub="Giriş, proses ve son kontrol kayıtları · ilk geçiş oranı · red analizi" actions={<button className="adm-btn" onClick={() => openNew()}><Plus size={14} />Kontrol Kaydı Ekle</button>} />

        <KpiGrid min={180}>
          <Kpi label="İlk Geçiş Oranı (FPY)" value={fmtPct(fpy)} Icon={ShieldCheck} color={fpy >= 97 ? 'var(--adm-green)' : fpy >= 90 ? 'var(--adm-amber)' : 'var(--adm-red)'} sub="uygun adet / kontrol edilen" spark={fpySeri} />
          <Kpi label="Red Oranı" value={fmtPct(redOran)} Icon={Percent} color={redOran > 3 ? 'var(--adm-red)' : 'var(--adm-amber)'} sub={`${fmtN(kontrol ? (red / kontrol) * 1e6 : 0, 0)} PPM · ${fmtInt(red)} adet`} />
          <Kpi label="Toplam Kontrol" value={d.kalite.length} Icon={ClipboardList} color="var(--adm-blue)" sub={`${fmtInt(kontrol)} adet kontrol edildi`} />
          <Kpi label="Şartlı / Red Karar" value={`${cnt('sartli_uygun')} / ${cnt('red')}`} Icon={ShieldAlert} color={cnt('red') ? 'var(--adm-red)' : 'var(--adm-amber)'} sub="kayıt sayısı" />
          <Kpi label="Kontrol Bekleyen Emir" value={bekleyen.length} Icon={PackageX} color={bekleyen.length ? 'var(--adm-amber)' : 'var(--adm-green)'} sub="tamamlandı, son kontrolü yok" />
        </KpiGrid>

        {bekleyen.length > 0 && (
          <Card title={<><PackageX size={14} style={{ color: 'var(--adm-amber)' }} />Son kontrolü girilmemiş tamamlanan emirler</>} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 14 }}>
              {bekleyen.slice(0, 8).map((e: any) => <button key={e.id} className="adm-chip" onClick={() => openNew({ uretim_emri_id: e.id, urun_id: e.urun_id, kontrol_edilen_adet: String(e.uretilen_miktar), uygun_adet: String(e.uretilen_miktar), red_adet: '0' })}><b style={{ fontFamily: 'JetBrains Mono,monospace' }}>{e.no}</b> {urun[e.urun_id]?.name} · {fmtInt(e.uretilen_miktar)} adet <Plus size={11} /></button>)}
            </div>
          </Card>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,400px),1fr))', gap: 16, marginBottom: 16 }}>
          <Card title="Haftalık İlk Geçiş Oranı (12 hafta)" pad={16}><TrendChart type="area" height={190} labels={haftalik.map(h => fmtDate(h.k).slice(0, 5))} series={[{ name: 'FPY %', color: '#14b088', data: haftalik.map(h => h.fpy ?? 0) }]} format={n => `%${fmtN(n, 0)}`} /></Card>
          <Card title="Red Nedenleri (Pareto)" pad={18}>
            {nedenler.length === 0 ? <Empty icon={<CheckCircle2 size={28} />} title="Red kaydı yok" /> : <BarList items={nedenler.slice(0, 6).map(([l, v], i) => ({ label: l, value: v, color: CHART_COLORS[i], sub: `%${fmtN((v / nedenToplam) * 100, 0)}` }))} format={n => `${fmtInt(n)} adet`} />}
          </Card>
        </div>
        {urunRed.length > 0 && <Card title="Ürün Bazlı Red Oranı" pad={18} style={{ marginBottom: 16 }}><BarList items={urunRed} color="var(--adm-red)" format={n => `%${fmtN(n, 1)}`} /></Card>}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <Tabs value={tab} onChange={setTab} tabs={[{ v: 'hepsi', l: 'Tümü', n: d.kalite.length }, ...Object.entries(SONUC).map(([k, v]) => ({ v: k, l: v.l, n: cnt(k) }))]} />
          <Tabs value={tipF} onChange={setTipF} tabs={[{ v: '', l: 'Tüm tipler' }, ...Object.entries(TIP).map(([k, l]) => ({ v: k, l }))]} />
        </div>

        <DataGrid rows={liste} cols={cols} rowKey={k => k.id} loading={loading} onBulkDelete={topluSil} deleteNoun="kontrol kaydı" csvName="kalite-kontrol" storageKey="kalite" onRowClick={setDetay} activeKey={detay?.id}
          searchText={k => `${emir[k.uretim_emri_id]?.no || ''} ${urun[k.urun_id || emir[k.uretim_emri_id]?.urun_id]?.name || ''} ${k.red_nedeni || ''} ${k.notlar || ''}`} searchPlaceholder="Emir, ürün, red nedeni..." emptyTitle="Kontrol kaydı yok" selectable
          bulkActions={sel => <button className="adm-btn-ghost" style={{ padding: '3px 12px', fontSize: 12 }} onClick={() => setToplu(sel)}><ListChecks size={12} />Toplu düzenle</button>} />
      </Page>

      <Drawer open={!!detay} onClose={() => setDetay(null)} width={480}
        title={detay && <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{TIP[detay.kontrol_tipi]}<Badge tone={SONUC[detay.sonuc]?.tone}>{SONUC[detay.sonuc]?.l}</Badge></span>}
        sub={detay && fmtDateTime(detay.tarih)}
        footer={detay && <>
          {+detay.red_adet > 0 && <button className="adm-btn-ghost" disabled={busy} onClick={() => fireOlustur(detay)}><Flame size={13} />Fire kaydı oluştur</button>}
          <button className="adm-btn-ghost" onClick={() => openEdit(detay)}><Pencil size={13} />Düzenle</button><button className="adm-btn-danger" onClick={() => del(detay)}><Trash2 size={13} /></button></>}>
        {detay && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>Kontrol</div><b style={{ fontSize: 17, fontFamily: 'JetBrains Mono,monospace' }}>{fmtInt(detay.kontrol_edilen_adet)}</b></div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-green2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>Uygun</div><b style={{ fontSize: 17, fontFamily: 'JetBrains Mono,monospace', color: 'var(--adm-green)' }}>{fmtInt(detay.uygun_adet)}</b></div>
              <div style={{ padding: 12, borderRadius: 10, background: +detay.red_adet ? 'var(--adm-red2)' : 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>Red</div><b style={{ fontSize: 17, fontFamily: 'JetBrains Mono,monospace', color: +detay.red_adet ? 'var(--adm-red)' : undefined }}>{fmtInt(detay.red_adet)}</b></div>
            </div>
            <InfoRow k="Emir" v={dE?.no || '—'} />
            <InfoRow k="Ürün" v={urun[detay.urun_id || dE?.urun_id]?.name || '—'} />
            <InfoRow k="Red oranı" v={`%${fmtN(+detay.kontrol_edilen_adet ? (+detay.red_adet / +detay.kontrol_edilen_adet) * 100 : 0, 2)}`} />
            <InfoRow k="Red nedeni" v={detay.red_nedeni || '—'} />
            {detay.notlar && <><Divider label="Notlar" /><p style={{ fontSize: 12.5, color: 'var(--adm-tx2)', margin: 0, whiteSpace: 'pre-wrap' }}>{detay.notlar}</p></>}
          </div>
        )}
      </Drawer>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={save} width={640} title={editing ? 'Kontrol Kaydını Düzenle' : 'Yeni Kontrol Kaydı'}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <FormGrid>
          <Field label="Üretim emri"><select className="adm-inp" value={form.uretim_emri_id} onChange={e => emirSec(e.target.value)}><option value="">— Emirsiz (giriş kontrolü vb.) —</option>{d.emirler.map((e: any) => <option key={e.id} value={e.id}>{e.no} · {urun[e.urun_id]?.name}</option>)}</select></Field>
          <Field label="Ürün"><select className="adm-inp" value={form.urun_id} onChange={e => setForm((f: any) => ({ ...f, urun_id: e.target.value }))}><option value="">—</option>{d.products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Kontrol tipi"><select className="adm-inp" value={form.kontrol_tipi} onChange={e => setForm((f: any) => ({ ...f, kontrol_tipi: e.target.value }))}>{Object.entries(TIP).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Kontrol edilen adet *"><input type="number" min="1" className="adm-inp" required value={form.kontrol_edilen_adet} onChange={e => adetDegis({ kontrol_edilen_adet: e.target.value })} style={{ fontWeight: 700 }} /></Field>
          <Field label="Uygun adet"><input type="number" min="0" className="adm-inp" value={form.uygun_adet} onChange={e => adetDegis({ uygun_adet: e.target.value })} /></Field>
          <Field label="Red adet"><input type="number" min="0" className="adm-inp" value={form.red_adet} onChange={e => adetDegis({ red_adet: e.target.value })} /></Field>
          <Field label={`Red nedeni${+form.red_adet > 0 ? ' *' : ''}`}><input className="adm-inp" list="red-nedenleri" value={form.red_nedeni} onChange={e => setForm((f: any) => ({ ...f, red_nedeni: e.target.value }))} style={+form.red_adet > 0 && !form.red_nedeni ? { borderColor: 'var(--adm-red)' } : undefined} /><datalist id="red-nedenleri">{NEDENLER.map(n => <option key={n} value={n} />)}</datalist></Field>
          <Field label="Sonuç" hint={sonucElle ? 'Elle seçildi' : `Red oranına göre otomatik: %${fmtN(+form.kontrol_edilen_adet ? (+form.red_adet / +form.kontrol_edilen_adet) * 100 : 0, 1)}`}>
            <div style={{ display: 'flex', gap: 6 }}>{Object.entries(SONUC).map(([k, v]) => <button type="button" key={k} onClick={() => { setSonucElle(true); setForm((f: any) => ({ ...f, sonuc: k })) }} className={form.sonuc === k ? 'adm-btn' : 'adm-btn-ghost'} style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '6px 4px', background: form.sonuc === k ? (k === 'uygun' ? 'var(--adm-green)' : k === 'red' ? 'var(--adm-red)' : 'var(--adm-amber)') : undefined }}>{v.l}</button>)}</div>
          </Field>
          <Field label="Notlar" span={2}><textarea className="adm-inp" rows={2} value={form.notlar} onChange={e => setForm((f: any) => ({ ...f, notlar: e.target.value }))} /></Field>
        </FormGrid>
      </Modal>
      <TopluDuzenle rows={toplu} onClose={() => setToplu(null)} onDone={() => { setToplu(null); reload() }} client={erp as any} table="kalite_kontrol_kayitlari" fields={[
        { key: 'uretim_emri_id', label: 'Üretim emri', type: 'select', bosYapilabilir: true, options: d.emirler.map((e: any) => ({ v: e.id, l: `${e.no} · ${urun[e.urun_id]?.name || ''}` })) },
        { key: 'kontrol_tipi', label: 'Kontrol tipi', type: 'select', options: Object.entries(TIP).map(([v, l]) => ({ v, l })) },
        { key: 'red_nedeni', label: 'Red nedeni', type: 'text' },
      ]} />
      {toast.node}
    </div>
  )
}
