'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminTopBar from '@/components/admin/TopBar'
import { web } from '@/lib/web-data'
import { fmtN, fmtDate } from '@/lib/fmt'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { RotateCcw, PackageX, Clock, CheckCircle2 } from 'lucide-react'

const DURUM: Record<string, { l: string; tone: any }> = { bekliyor: { l: 'İade bekliyor', tone: 'amber' }, iade_edildi: { l: 'İade edildi', tone: 'blue' }, kredi_notu: { l: 'Kredi notu/iade faturası alındı', tone: 'green' }, degisim: { l: 'Yenisi ile değiştirildi', tone: 'green' }, kapali: { l: 'Kapatıldı', tone: 'muted' } }

export default function IadeRetPage() {
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [ham, setHam] = useState<Record<string, any>>({})
  const [cari, setCari] = useState<Record<string, any>>({})
  const [sip, setSip] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('acik')

  const yukle = useCallback(async () => {
    const [r, h, c, s] = await Promise.all([
      web.from('satinalma_ret_kayitlari').select('*').order('created_at', { ascending: false }).limit(2000),
      web.from('hammaddeler').select('id,ad,birim').limit(5000), web.from('cari_hesaplar').select('id,ad').limit(5000), web.from('satinalma_siparisleri').select('id,no').limit(5000),
    ])
    if (r.error) toast.show(r.error.message, true)
    setRows(r.data || []); setHam(Object.fromEntries((h.data || []).map((x: any) => [x.id, x]))); setCari(Object.fromEntries((c.data || []).map((x: any) => [x.id, x]))); setSip(Object.fromEntries((s.data || []).map((x: any) => [x.id, x]))); setLoading(false)
  }, []) // eslint-disable-line
  useEffect(() => { yukle() }, [yukle])

  async function durumDegis(r: any, durum: string) {
    const { error } = await web.from('satinalma_ret_kayitlari').update({ durum, updated_at: new Date().toISOString() }).eq('id', r.id)
    if (error) return toast.show(error.message, true); yukle()
  }
  const acik = (r: any) => r.durum === 'bekliyor'
  const liste = rows.filter(r => tab === 'hepsi' ? true : tab === 'acik' ? acik(r) : tab === 'ret' ? r.tur === 'ret' : r.tur === 'iade')
  const bekleyenTedarikci = useMemo(() => new Set(rows.filter(acik).map(r => r.tedarikci_id)).size, [rows])

  const cols: Col<any>[] = [
    { key: 'tarih', label: 'Tarih', width: 96, sort: r => r.created_at, render: r => fmtDate(r.created_at) },
    { key: 'tur', label: 'Tür', width: 80, sort: r => r.tur, render: r => <Badge tone={r.tur === 'ret' ? 'amber' : 'blue'}>{r.tur === 'ret' ? 'Ret' : 'İade'}</Badge> },
    { key: 'ham', label: 'Hammadde', sort: r => ham[r.hammadde_id]?.ad || '', render: r => <div><b>{ham[r.hammadde_id]?.ad || '—'}</b><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{r.neden || ''}</div></div> },
    { key: 'mik', label: 'Miktar', width: 110, align: 'right', sort: r => +r.miktar, render: r => `${fmtN(+r.miktar, 2)} ${ham[r.hammadde_id]?.birim || ''}` },
    { key: 'ted', label: 'Tedarikçi', sort: r => cari[r.tedarikci_id]?.ad || '', render: r => cari[r.tedarikci_id]?.ad || '—', hideSm: true },
    { key: 'sip', label: 'Sipariş', width: 120, sort: r => sip[r.siparis_id]?.no || '', render: r => sip[r.siparis_id]?.no || '—', hideSm: true },
    { key: 'du', label: 'Durum', width: 250, sort: r => r.durum, render: r => (
      <select className="adm-inp" style={{ fontSize: 12, padding: '4px 6px' }} value={r.durum} onChange={e => durumDegis(r, e.target.value)} onClick={e => e.stopPropagation()}>{Object.entries(DURUM).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select>) },
  ]

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="İade / Ret" />
      <Page>
        <PageHead title="Tedarikçi İade ve Ret Takibi" sub="Teslimde reddedilen ve sonradan iade edilen mallar; yerine yenisi / iade faturası gelene kadar takip edilir" actions={<Link href="/admin/dashboard/satinalma/siparisler" className="adm-btn-ghost" style={{ textDecoration: 'none' }}>Siparişler</Link>} />
        <KpiGrid min={180}>
          <Kpi label="Çözüm bekleyen" value={rows.filter(acik).length} Icon={Clock} color={rows.some(acik) ? 'var(--adm-amber)' : 'var(--adm-green)'} sub={`${bekleyenTedarikci} tedarikçide`} onClick={() => setTab('acik')} />
          <Kpi label="Ret" value={rows.filter(r => r.tur === 'ret').length} Icon={PackageX} color="var(--adm-red)" sub="teslimde reddedilen" onClick={() => setTab('ret')} />
          <Kpi label="İade" value={rows.filter(r => r.tur === 'iade').length} Icon={RotateCcw} color="var(--adm-blue)" sub="kabulden sonra iade" onClick={() => setTab('iade')} />
          <Kpi label="Çözüldü" value={rows.filter(r => !acik(r)).length} Icon={CheckCircle2} color="var(--adm-green)" />
        </KpiGrid>
        <div style={{ margin: '12px 0' }}><Tabs value={tab} onChange={setTab} tabs={[{ v: 'acik', l: 'Bekleyen', n: rows.filter(acik).length }, { v: 'ret', l: 'Ret', n: rows.filter(r => r.tur === 'ret').length }, { v: 'iade', l: 'İade', n: rows.filter(r => r.tur === 'iade').length }, { v: 'hepsi', l: 'Tümü', n: rows.length }]} /></div>
        <DataGrid rows={liste} cols={cols} rowKey={r => r.id} loading={loading} csvName="iade-ret" storageKey="iade-ret" searchText={r => `${ham[r.hammadde_id]?.ad || ''} ${cari[r.tedarikci_id]?.ad || ''} ${sip[r.siparis_id]?.no || ''} ${r.neden || ''}`} searchPlaceholder="Hammadde, tedarikçi, sipariş…" emptyTitle="Kayıt yok" emptySub="Teslim alırken “Reddedilen” miktar girildiğinde veya sipariş detayından iade yapıldığında burada görünür" />
        <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 10 }}>İade edilen mal için tedarikçiden iade faturası veya alacak dekontu isteyin ve Muhasebe → Faturalar’a işleyin; ardından durumu “Kredi notu/iade faturası alındı” yapın.</p>
      </Page>
      {toast.node}
    </div>
  )
}
