'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { muh } from '@/lib/muhasebe-client'
import { useAcParam } from '@/lib/ac-param'
import { fmt, fmtK, fmtDate, todayISO, daysBetween } from '@/lib/fmt'
import { sum } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Money, Modal, Field, FormGrid, Card, useToast } from '@/components/admin/erp/ui'
import Yardim from '@/components/admin/erp/Yardim'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { topluSilCalistir } from '@/lib/toplu-sil'
import { TrendChart } from '@/components/admin/erp/charts'
import { Plus, Pencil, Trash2, FileSignature, AlertTriangle, CalendarClock, ShieldAlert, Wallet, Repeat, Ban, CheckCircle2, Landmark } from 'lucide-react'

const DURUM: Record<string, { l: string; tone: any }> = {
  portfoyde: { l: 'Portföyde', tone: 'blue' }, tahsil_edildi: { l: 'Tahsil Edildi', tone: 'green' }, odendi: { l: 'Ödendi', tone: 'green' },
  karsiliksiz: { l: 'Karşılıksız', tone: 'red' }, ciro_edildi: { l: 'Ciro Edildi', tone: 'amber' }, iptal: { l: 'İptal', tone: 'muted' },
}
const RES: Record<string, string> = { resmi: '101 Resmi', gayri_resmi: '101 Gayrı Resmi' }
const bankadaMi = (c: any) => c.durum === 'ciro_edildi' && c.yon === 'alinan' && /takas|tahsile/i.test(c.aciklama || '')
const trTarih = (t: string) => String(t).slice(0, 10).split('-').reverse().join('.')
const bos = () => ({ tip: 'cek', yon: 'alinan', cari_id: '', no: '', banka: '', tutar: '', vade_tarihi: todayISO(), aciklama: '', resmiyet: '' })

export default function CekSenetPage() {
  const toast = useToast()
  const [list, setList] = useState<any[]>([])
  const [cariler, setCariler] = useState<any[]>([])
  const [kasalar, setKasalar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('portfoy')
  const [yonF, setYonF] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(bos())
  const [islem, setIslem] = useState<any>(null) // { rows, tur: 'tahsil'|'ciro', kasa, cari, tarih }
  const [takas, setTakas] = useState<any>(null) // { rows, banka, tarih } — bankaya tahsile/takasa verme (nakit hareketi yok)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [c, cr, k] = await Promise.all([
      muh.all('cek_senet', '*', q => q.order('vade_tarihi', { ascending: true })),
      muh.all('cari_hesaplar', 'id,ad,tip'), muh.all('kasa_banka_hesaplari', 'id,ad,tip,aktif,para_birimi'),
    ])
    setList(c); setCariler(cr); setKasalar(k.filter((x: any) => x.aktif !== false && (x.para_birimi || 'TRY') === 'TRY')); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const bugun = todayISO()
  const gun = (c: any) => daysBetween(bugun, c.vade_tarihi) // + = vadeye kalan gün, − = geçmiş
  const cariAd = useMemo(() => Object.fromEntries(cariler.map(c => [c.id, c.ad])), [cariler])

  const portfoy = list.filter(c => c.durum === 'portfoyde')
  const alinan = portfoy.filter(c => c.yon === 'alinan'), verilen = portfoy.filter(c => c.yon === 'verilen')
  const resmiA = alinan.filter(c => c.resmiyet === 'resmi'), gayriA = alinan.filter(c => c.resmiyet === 'gayri_resmi'), belirsizA = alinan.filter(c => !c.resmiyet)
  const yaklasan = portfoy.filter(c => gun(c) >= 0 && gun(c) <= 7)
  const gecmis = portfoy.filter(c => gun(c) < 0)
  const karsiliksiz = list.filter(c => c.durum === 'karsiliksiz')
  const bankada = list.filter(c => bankadaMi(c) && c.vade_tarihi >= bugun)

  // Vade dağılımı (portföy)
  const buckets = [
    { l: 'Geçmiş', t: (d: number) => d < 0 }, { l: '0–7 gün', t: (d: number) => d >= 0 && d <= 7 }, { l: '8–30 gün', t: (d: number) => d > 7 && d <= 30 },
    { l: '31–60 gün', t: (d: number) => d > 30 && d <= 60 }, { l: '61–90 gün', t: (d: number) => d > 60 && d <= 90 }, { l: '90+ gün', t: (d: number) => d > 90 },
  ]
  const vadeData = buckets.map(b => ({ a: sum(alinan.filter(c => b.t(gun(c))), c => c.tutar), v: sum(verilen.filter(c => b.t(gun(c))), c => c.tutar) }))

  const filtered = list.filter(c => {
    if (yonF && c.yon !== yonF) return false
    switch (tab) {
      case 'portfoy': return c.durum === 'portfoyde'
      case 'yaklasan': return c.durum === 'portfoyde' && gun(c) >= 0 && gun(c) <= 7
      case 'gecmis': return c.durum === 'portfoyde' && gun(c) < 0
      case 'bankada': return bankadaMi(c) && c.vade_tarihi >= bugun
      case 'kapali': return ['tahsil_edildi', 'odendi', 'ciro_edildi'].includes(c.durum)
      case 'karsiliksiz': return c.durum === 'karsiliksiz'
      default: return true
    }
  })

  /* CRUD */
  useAcParam(!loading, id => { const c = list.find((x: any) => x.id === id); if (c) openEdit(c) })
  const openNew = () => { setEditing(null); setForm(bos()); setModal(true) }
  const openEdit = (c: any) => { setEditing(c); setForm({ tip: c.tip, yon: c.yon, cari_id: c.cari_id || '', no: c.no || '', banka: c.banka || '', tutar: String(c.tutar), vade_tarihi: c.vade_tarihi, aciklama: c.aciklama || '', resmiyet: c.resmiyet || '' }); setModal(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (!(+form.tutar > 0)) { toast.show('Tutar gerekli', true); return }
    if (form.no && list.some(c => c.no === form.no && c.banka === form.banka && c.id !== editing?.id) && !confirm('Aynı numara ve bankada başka kayıt var. Yine de kaydedilsin mi?')) return
    if (form.yon === 'alinan' && !form.resmiyet) { toast.show('Alınan çek için 101 Resmi / 101 Gayrı Resmi seç', true); return }
    setBusy(true)
    const payload = { ...form, tutar: +form.tutar, cari_id: form.cari_id || null, resmiyet: form.resmiyet || null }
    const r: any = editing ? await muh.from('cek_senet').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id) : await muh.from('cek_senet').insert(payload)
    setBusy(false)
    if (r?.error) { toast.show(r.error, true); return }
    setModal(false); toast.show(editing ? 'Kayıt güncellendi' : 'Kayıt eklendi'); load()
  }
  async function topluSil(sel: any[]): Promise<string | void> {
    const { silinen, hata } = await topluSilCalistir(sel, async (r: any) => (await muh.from('cek_senet').delete().eq('id', r.id))?.error, 'çek/senet')
    load()
    if (hata) return hata
    toast.show(`${silinen} çek/senet silindi`)
  }
  async function del(c: any) {
    if (!confirm(`${c.tip === 'cek' ? 'Çek' : 'Senet'} ${c.no || ''} silinsin mi?`)) return
    await muh.from('cek_senet').delete().eq('id', c.id); toast.show('Silindi'); load()
  }
  async function durum(rows: any[], d: string) {
    for (const r of rows) await muh.from('cek_senet').update({ durum: d, updated_at: new Date().toISOString() }).eq('id', r.id)
    toast.show(`${rows.length} kayıt: ${DURUM[d].l}`); load()
  }

  /* Tahsil / Ödeme / Ciro */
  function openIslem(rows: any[], tur: 'tahsil' | 'ciro') {
    setIslem({ rows, tur, kasa: kasalar[0]?.id || '', cari: '', tarih: todayISO() })
  }
  async function islemOnayla(e: React.FormEvent) {
    e.preventDefault(); if (busy || !islem) return
    setBusy(true)
    try {
      for (const r of islem.rows) {
        const ad = `${r.tip === 'cek' ? 'Çek' : 'Senet'} ${r.no || ''}${r.banka ? ' — ' + r.banka : ''}${r.resmiyet ? ' [' + RES[r.resmiyet] + ']' : ''}`
        if (islem.tur === 'tahsil') {
          const gelir = r.yon === 'alinan'
          const x: any = await muh.from('islemler').insert({ tip: gelir ? 'gelir' : 'gider', tutar: r.tutar, kategori: gelir ? 'Çek/Senet Tahsilatı' : 'Çek/Senet Ödemesi', aciklama: ad, tarih: islem.tarih, cari_id: r.cari_id || null, kasa_hesap_id: islem.kasa || null, odeme_yontemi: 'cek' })
          if (x?.error) throw new Error(x.error)
          await muh.from('cek_senet').update({ durum: gelir ? 'tahsil_edildi' : 'odendi', updated_at: new Date().toISOString() }).eq('id', r.id)
        } else {
          // Ciro: alınan çek/senet bir tedarikçiye ödeme olarak devredilir → müşteri tahsilatı + tedarikçi ödemesi (nakit hareketi yok)
          if (!islem.cari) throw new Error('Ciro edilecek tedarikçiyi seç')
          const a: any = await muh.from('islemler').insert({ tip: 'gelir', tutar: r.tutar, kategori: 'Çek/Senet Tahsilatı', aciklama: `${ad} (ciro edildi)`, tarih: islem.tarih, cari_id: r.cari_id || null, odeme_yontemi: 'cek' })
          if (a?.error) throw new Error(a.error)
          const b: any = await muh.from('islemler').insert({ tip: 'gider', tutar: r.tutar, kategori: 'Çek/Senet Ödemesi', aciklama: `${ad} (ciro)`, tarih: islem.tarih, cari_id: islem.cari, odeme_yontemi: 'cek' })
          if (b?.error) throw new Error(b.error)
          await muh.from('cek_senet').update({ durum: 'ciro_edildi', updated_at: new Date().toISOString(), aciklama: `${r.aciklama ? r.aciklama + ' · ' : ''}Ciro: ${cariAd[islem.cari]} (${trTarih(islem.tarih)})` }).eq('id', r.id)
        }
      }
      toast.show(islem.tur === 'tahsil' ? 'Tahsilat/ödeme işlendi' : 'Ciro işlendi'); setIslem(null); load()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  /* Bankaya takas / tahsile verme: çek hâlâ bizim alacağımız ama fiziksel olarak bankada; nakit hareketi YOKTUR (tahsil olunca 'Tahsil oldu' ile işlenir) */
  async function takasOnayla(e: React.FormEvent) {
    e.preventDefault(); if (busy || !takas) return
    const banka = String(takas.banka || '').trim(); if (!banka) { toast.show('Banka adı gerekli', true); return }
    setBusy(true)
    for (const r of takas.rows) await muh.from('cek_senet').update({ durum: 'ciro_edildi', updated_at: new Date().toISOString(), aciklama: `${r.aciklama ? r.aciklama + ' · ' : ''}Ciro: ${banka} takas (çıkış ${trTarih(takas.tarih)})` }).eq('id', r.id)
    setBusy(false); toast.show(`${takas.rows.length} kayıt bankaya takasa verildi`); setTakas(null); load()
  }

  const cols: Col<any>[] = [
    {
      key: 'vade', label: 'Vade', width: 150, sort: c => c.vade_tarihi, render: c => {
        const g = gun(c), acik = c.durum === 'portfoyde'
        return <div><div style={{ fontWeight: 600 }}>{fmtDate(c.vade_tarihi)}</div>{acik && <div style={{ fontSize: 11, color: g < 0 ? 'var(--adm-red)' : g <= 7 ? 'var(--adm-amber)' : 'var(--adm-tx3)', fontWeight: g <= 7 ? 700 : 400 }}>{g < 0 ? `${-g} gün geçmiş` : g === 0 ? 'Bugün' : `${g} gün kaldı`}</div>}</div>
      },
    },
    { key: 'tip', label: 'Tür', width: 80, sort: c => c.tip, render: c => <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><FileSignature size={13} style={{ color: 'var(--adm-tx3)' }} />{c.tip === 'cek' ? 'Çek' : 'Senet'}</span> },
    { key: 'yon', label: 'Yön', width: 90, sort: c => c.yon, render: c => <Badge tone={c.yon === 'alinan' ? 'green' : 'red'}>{c.yon === 'alinan' ? 'Alınan' : 'Verilen'}</Badge> },
    { key: 'no', label: 'No / Banka', sort: c => c.no || '', render: c => <div><div style={{ fontWeight: 600, fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{c.no || '—'}</div><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{c.banka || ''}{c.resmiyet && <span style={{ marginLeft: 6, fontWeight: 700, color: c.resmiyet === 'resmi' ? 'var(--adm-green)' : 'var(--adm-amber)' }}>{RES[c.resmiyet]}</span>}</div></div> },
    { key: 'cari', label: 'Cari', sort: c => cariAd[c.cari_id] || '', render: c => cariAd[c.cari_id] || <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true },
    { key: 'tutar', label: 'Tutar', align: 'right', sort: c => +c.tutar, render: c => <Money v={+c.tutar} tone={c.yon === 'alinan' ? 'green' : 'red'} />, total: rs => <Money v={sum(rs, c => (c.yon === 'alinan' ? 1 : -1) * c.tutar)} tone="auto" /> },
    { key: 'durum', label: 'Durum', width: 120, sort: c => c.durum, render: c => <Badge tone={DURUM[c.durum]?.tone}>{DURUM[c.durum]?.l}</Badge> },
    {
      key: 'act', label: '', width: 190, align: 'right', render: c => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {c.durum === 'portfoyde' && <>
            <button className="adm-btn" style={{ padding: '4px 10px', fontSize: 11.5, background: c.yon === 'alinan' ? 'var(--adm-green)' : 'var(--adm-red)' }} onClick={() => openIslem([c], 'tahsil')}>{c.yon === 'alinan' ? 'Tahsil Et' : 'Öde'}</button>
            {c.yon === 'alinan' && <button className="adm-btn-ghost" style={{ padding: '4px 8px' }} title="Tedarikçiye ciro et" onClick={() => openIslem([c], 'ciro')}><Repeat size={12} /></button>}
            {c.yon === 'alinan' && <button className="adm-btn-ghost" style={{ padding: '4px 8px' }} title="Bankaya takasa / tahsile ver" onClick={() => setTakas({ rows: [c], banka: 'Garanti Bankası', tarih: todayISO() })}><Landmark size={12} /></button>}
            <button className="adm-btn-ghost" style={{ padding: '4px 8px' }} title="Karşılıksız" onClick={() => confirm('Karşılıksız çıktı olarak işaretlensin mi?') && durum([c], 'karsiliksiz')}><Ban size={12} /></button>
          </>}
          {bankadaMi(c) && c.durum === 'ciro_edildi' && <button className="adm-btn" style={{ padding: '4px 10px', fontSize: 11.5, background: 'var(--adm-green)' }} title="Banka tahsil etti" onClick={() => openIslem([c], 'tahsil')}>Tahsil oldu</button>}
          <button className="adm-btn-ghost" style={{ padding: '4px 8px' }} onClick={() => openEdit(c)}><Pencil size={12} /></button>
          <button className="adm-btn-danger" style={{ padding: '4px 8px' }} onClick={() => del(c)}><Trash2 size={12} /></button>
        </span>),
    },
  ]

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Çek / Senet Takibi" />
      <Page>
        <PageHead title="Çek & Senet Portföyü" sub="Vade takibi, tahsilat, ciro ve karşılıksız yönetimi" actions={<button className="adm-btn" onClick={openNew}><Plus size={14} />Çek/Senet Ekle</button>} />

        <Yardim sayfa="cek-senet" sekme={tab} />
        <KpiGrid min={190}>
          <Kpi label="Tahsil Edilecek" value={fmtK(sum(alinan, c => c.tutar))} Icon={Wallet} color="var(--adm-green)" sub={`${alinan.length} alınan çek/senet`} />
          <Kpi label="101 Resmi (portföy)" value={fmtK(sum(resmiA, c => c.tutar))} Icon={Wallet} color="var(--adm-green)" sub={`${resmiA.length} alınan çek/senet`} />
          <Kpi label="101 Gayrı Resmi (portföy)" value={fmtK(sum(gayriA, c => c.tutar))} Icon={Wallet} color="var(--adm-amber)" sub={`${gayriA.length} alınan${belirsizA.length ? ` · ${belirsizA.length} adet R/G seçilmemiş (${fmtK(sum(belirsizA, c => c.tutar))})` : ''}`} />
          <Kpi label="Bankada Tahsilde" value={fmtK(sum(bankada, c => c.tutar))} Icon={Landmark} color="var(--adm-blue, #3b82f6)" sub={`${bankada.length} evrak (takas)`} onClick={() => setTab('bankada')} />
          <Kpi label="Ödenecek" value={fmtK(sum(verilen, c => c.tutar))} Icon={Wallet} color="var(--adm-red)" sub={`${verilen.length} verilen çek/senet`} />
          <Kpi label="7 Gün İçinde" value={yaklasan.length} Icon={CalendarClock} color="var(--adm-amber)" sub={fmtK(sum(yaklasan, c => (c.yon === 'alinan' ? 1 : -1) * c.tutar)) + ' net'} onClick={() => setTab('yaklasan')} />
          <Kpi label="Vadesi Geçmiş" value={gecmis.length} Icon={AlertTriangle} color={gecmis.length ? 'var(--adm-red)' : 'var(--adm-green)'} sub={gecmis.length ? fmtK(sum(gecmis, c => c.tutar)) : 'Gecikme yok'} onClick={() => setTab('gecmis')} />
          <Kpi label="Karşılıksız" value={karsiliksiz.length} Icon={ShieldAlert} color={karsiliksiz.length ? 'var(--adm-red)' : 'var(--adm-green)'} sub={karsiliksiz.length ? fmtK(sum(karsiliksiz, c => c.tutar)) : 'Kayıt yok'} onClick={() => setTab('karsiliksiz')} />
        </KpiGrid>

        <Card title="Vade Dağılımı (portföy)" pad={16} style={{ marginBottom: 16 }}>
          <TrendChart type="bar" height={190} labels={buckets.map(b => b.l)} series={[{ name: 'Tahsil edilecek', color: '#14b088', data: vadeData.map(d => d.a) }, { name: 'Ödenecek', color: '#e14b4b', data: vadeData.map(d => d.v) }]} />
        </Card>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <Tabs value={tab} onChange={setTab} tabs={[
            { v: 'portfoy', l: 'Portföyde', n: portfoy.length }, { v: 'yaklasan', l: '7 gün', n: yaklasan.length }, { v: 'gecmis', l: 'Vadesi geçmiş', n: gecmis.length },
            { v: 'bankada', l: 'Bankada', n: bankada.length }, { v: 'kapali', l: 'Kapananlar' }, { v: 'karsiliksiz', l: 'Karşılıksız', n: karsiliksiz.length }, { v: 'hepsi', l: 'Tümü', n: list.length },
          ]} />
          <Tabs value={yonF} onChange={setYonF} tabs={[{ v: '', l: 'Alınan + Verilen' }, { v: 'alinan', l: 'Alınan' }, { v: 'verilen', l: 'Verilen' }]} />
        </div>

        <DataGrid rows={filtered} cols={cols} rowKey={c => c.id} loading={loading} onBulkDelete={topluSil} deleteNoun="çek/senet" csvName="cek-senet" storageKey="ceksenet" defaultSort={{ key: 'vade', dir: 'asc' }}
          searchText={c => `${c.no || ''} ${c.banka || ''} ${cariAd[c.cari_id] || ''} ${c.tutar}`} searchPlaceholder="No, banka, cari, tutar..."
          selectable bulkActions={(sel, clear) => {
            const acik = sel.filter(s => s.durum === 'portfoyde')
            const alinanAcik = acik.filter(s => s.yon === 'alinan'), bk = sel.filter(s => bankadaMi(s))
            return (acik.length || bk.length) ? <span style={{ display: 'inline-flex', gap: 6 }}>
              {acik.length > 0 && <button className="adm-btn" style={{ padding: '3px 12px', fontSize: 12, background: 'var(--adm-green)' }} onClick={() => { openIslem(acik, 'tahsil'); clear() }}><CheckCircle2 size={12} />{acik.length} kaydı toplu tahsil/öde</button>}
              {alinanAcik.length > 0 && <button className="adm-btn-ghost" style={{ padding: '3px 12px', fontSize: 12 }} onClick={() => { setTakas({ rows: alinanAcik, banka: 'Garanti Bankası', tarih: todayISO() }); clear() }}><Landmark size={12} />{alinanAcik.length} kaydı bankaya takasa ver</button>}
              {bk.length > 0 && <button className="adm-btn" style={{ padding: '3px 12px', fontSize: 12, background: 'var(--adm-green)' }} onClick={() => { openIslem(bk, 'tahsil'); clear() }}>{bk.length} bankadakini tahsil oldu işle</button>}
            </span> : null
          }}
          emptyTitle="Bu görünümde kayıt yok" />
      </Page>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={save} title={editing ? 'Kaydı Düzenle' : 'Yeni Çek / Senet'} width={560}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 6 }}>{[['cek', 'Çek'], ['senet', 'Senet']].map(([k, l]) => <button key={k} type="button" onClick={() => setForm((f: any) => ({ ...f, tip: k }))} className={form.tip === k ? 'adm-btn' : 'adm-btn-ghost'} style={{ flex: 1, justifyContent: 'center' }}>{l}</button>)}</div>
          <div style={{ display: 'flex', gap: 6 }}>{[['alinan', 'Alınan'], ['verilen', 'Verilen']].map(([k, l]) => <button key={k} type="button" onClick={() => setForm((f: any) => ({ ...f, yon: k }))} className={form.yon === k ? 'adm-btn' : 'adm-btn-ghost'} style={{ flex: 1, justifyContent: 'center', background: form.yon === k ? (k === 'alinan' ? 'var(--adm-green)' : 'var(--adm-red)') : undefined }}>{l}</button>)}</div>
        </div>
        <FormGrid>
          <Field label="Tutar (₺) *"><input type="number" step="0.01" min="0" required autoFocus className="adm-inp" value={form.tutar} onChange={e => setForm((f: any) => ({ ...f, tutar: e.target.value }))} style={{ fontSize: 16, fontWeight: 700 }} /></Field>
          <Field label="Vade Tarihi *"><input type="date" required className="adm-inp" value={form.vade_tarihi} onChange={e => setForm((f: any) => ({ ...f, vade_tarihi: e.target.value }))} /></Field>
          <Field label="Çek / Senet No"><input className="adm-inp" value={form.no} onChange={e => setForm((f: any) => ({ ...f, no: e.target.value }))} /></Field>
          <Field label="Banka"><input className="adm-inp" value={form.banka} onChange={e => setForm((f: any) => ({ ...f, banka: e.target.value }))} /></Field>
          {form.yon === 'alinan' && <Field label="Hesap (101) *"><select className="adm-inp" value={form.resmiyet} onChange={e => setForm((f: any) => ({ ...f, resmiyet: e.target.value }))}><option value="">— Seç —</option><option value="resmi">101 Resmi (R)</option><option value="gayri_resmi">101 Gayrı Resmi (G)</option></select></Field>}
          <Field label="Cari" span={2}><select className="adm-inp" value={form.cari_id} onChange={e => setForm((f: any) => ({ ...f, cari_id: e.target.value }))}><option value="">— Seçilmedi —</option>{cariler.map(c => <option key={c.id} value={c.id}>{c.ad}</option>)}</select></Field>
          <Field label="Açıklama" span={2}><input className="adm-inp" value={form.aciklama} onChange={e => setForm((f: any) => ({ ...f, aciklama: e.target.value }))} /></Field>
        </FormGrid>
      </Modal>

      <Modal open={!!islem} onClose={() => setIslem(null)} onSubmit={islemOnayla} width={500}
        title={islem && (islem.tur === 'ciro' ? 'Çeki Ciro Et' : `${islem.rows.length > 1 ? `${islem.rows.length} kayıt` : (islem.rows[0].yon === 'alinan' ? 'Tahsilat' : 'Ödeme')} — Onay`)}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setIslem(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Onayla</button></>}>
        {islem && (
          <FormGrid cols={1}>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)', fontSize: 12.5 }}>
              {islem.rows.slice(0, 4).map((r: any) => <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>{r.tip === 'cek' ? 'Çek' : 'Senet'} {r.no || ''} · {cariAd[r.cari_id] || '—'}</span><b>{fmt(r.tutar)}</b></div>)}
              {islem.rows.length > 4 && <div style={{ color: 'var(--adm-tx3)' }}>+ {islem.rows.length - 4} kayıt daha</div>}
              <div style={{ borderTop: '1px dashed var(--adm-bdr2)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}><span>Toplam</span><b>{fmt(sum(islem.rows, (r: any) => r.tutar))}</b></div>
            </div>
            {islem.tur === 'tahsil'
              ? <Field label="Kasa / Banka" hint="Tutar bu hesaba işlenir"><select className="adm-inp" required value={islem.kasa} onChange={e => setIslem((i: any) => ({ ...i, kasa: e.target.value }))}><option value="">Seçin</option>{kasalar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}</select></Field>
              : <Field label="Ciro edilecek tedarikçi" hint="Nakit hareketi olmaz; tedarikçi borcu düşer, müşteri tahsilatı kaydedilir"><select className="adm-inp" required value={islem.cari} onChange={e => setIslem((i: any) => ({ ...i, cari: e.target.value }))}><option value="">Seçin</option>{cariler.filter(c => c.tip !== 'musteri').map(c => <option key={c.id} value={c.id}>{c.ad}</option>)}</select></Field>}
            <Field label="İşlem Tarihi"><input type="date" className="adm-inp" value={islem.tarih} onChange={e => setIslem((i: any) => ({ ...i, tarih: e.target.value }))} /></Field>
          </FormGrid>
        )}
      </Modal>
      <Modal open={!!takas} onClose={() => setTakas(null)} onSubmit={takasOnayla} width={480} title="Bankaya Takasa / Tahsile Ver"
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setTakas(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Onayla</button></>}>
        {takas && (
          <FormGrid cols={1}>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)', fontSize: 12.5 }}>
              {takas.rows.slice(0, 4).map((r: any) => <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>{r.tip === 'cek' ? 'Çek' : 'Senet'} {r.no || ''} · {cariAd[r.cari_id] || '—'}</span><b>{fmt(r.tutar)}</b></div>)}
              {takas.rows.length > 4 && <div style={{ color: 'var(--adm-tx3)' }}>+ {takas.rows.length - 4} kayıt daha</div>}
              <div style={{ borderTop: '1px dashed var(--adm-bdr2)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}><span>Toplam</span><b>{fmt(sum(takas.rows, (r: any) => r.tutar))}</b></div>
            </div>
            <Field label="Banka" hint="Nakit hareketi olmaz; çek 'Bankada' sekmesine geçer, banka tahsil edince 'Tahsil oldu' ile kapatılır"><input className="adm-inp" required value={takas.banka} onChange={e => setTakas((t: any) => ({ ...t, banka: e.target.value }))} /></Field>
            <Field label="Çıkış Tarihi"><input type="date" className="adm-inp" value={takas.tarih} onChange={e => setTakas((t: any) => ({ ...t, tarih: e.target.value }))} /></Field>
          </FormGrid>
        )}
      </Modal>
      {toast.node}
    </div>
  )
}
