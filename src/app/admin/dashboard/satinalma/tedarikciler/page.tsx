'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { fmt, fmtN, fmtDate } from '@/lib/fmt'
import { tedarikciIstatistik, gunFarki, MIN_VERI } from '@/lib/satinalma-istat'
import { useUretim, byId } from '@/lib/uretim-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Drawer, Card, Money, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { Building2, Truck, AlertTriangle, Coins, Plus, ExternalLink } from 'lucide-react'

const bugun = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)
const DURUM: Record<string, { l: string; tone: any }> = { beklemede: { l: 'Beklemede', tone: 'muted' }, onaylandi: { l: 'Onaylandı', tone: 'blue' }, yolda: { l: 'Yolda', tone: 'amber' }, teslim_alindi: { l: 'Teslim Alındı', tone: 'green' }, iptal: { l: 'İptal', tone: 'red' } }

export default function TedarikcilerPage() {
  const toast = useToast()
  const { d, loading } = useUretim(['satinalma', 'satinalmaKalemleri', 'hammaddeler', 'cariTam'])
  const [hareket, setHareket] = useState<any[]>([])
  const [secili, setSecili] = useState<string | null>(null)
  useEffect(() => { erp.all('stok_hareketleri', 'kaynak_id,tarih', (q: any) => q.eq('tip', 'satinalma').eq('yon', 'giris')).then(setHareket).catch(() => toast.show('Teslim tarihleri okunamadı', true)) }, []) // eslint-disable-line

  const ham = useMemo(() => byId(d.hammaddeler), [d.hammaddeler])
  const istat = useMemo(() => tedarikciIstatistik(d, hareket, bugun()), [d, hareket])

  const aktif = istat.find((x: any) => x.c.id === secili) || null
  const yorum = (x: any) => x.terminli < MIN_VERI ? { l: 'Yetersiz veri', tone: 'muted' as const } : x.oran >= 0.9 ? { l: 'Güvenilir', tone: 'green' as const } : x.oran >= 0.7 ? { l: 'Orta', tone: 'amber' as const } : { l: 'Riskli', tone: 'red' as const }

  const cols: Col<any>[] = [
    { key: 'ad', label: 'Tedarikçi', sort: x => x.c.ad, render: x => <div><b>{x.c.ad}</b><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{[x.c.kod, x.c.telefon, x.c.email].filter(Boolean).join(' · ')}</div></div> },
    { key: 'sayi', label: 'Sipariş', width: 80, align: 'right', sort: x => x.sayi, render: x => x.sayi },
    { key: 'acik', label: 'Açık', width: 70, align: 'right', sort: x => x.acik, render: x => x.acik ? <span style={{ color: x.geciken ? 'var(--adm-red)' : undefined, fontWeight: x.geciken ? 700 : 400 }}>{x.acik}{x.geciken ? ` (${x.geciken} geç)` : ''}</span> : '' },
    { key: 'tutar', label: 'Toplam alım', width: 130, align: 'right', sort: x => x.tutar, render: x => fmt(x.tutar) },
    { key: 'zam', label: 'Zamanında teslim', width: 140, align: 'right', sort: x => x.oran ?? -1, render: x => x.oran == null ? '—' : `%${fmtN(x.oran * 100, 0)} (${x.zamaninda}/${x.terminli})`, hideSm: true },
    { key: 'ter', label: 'Ort. termin', width: 100, align: 'right', sort: x => x.termin ?? 999, render: x => x.termin == null ? '—' : `${fmtN(x.termin, 1)} gün`, hideSm: true },
    { key: 'bak', label: 'Cari bakiye', width: 120, align: 'right', sort: x => +x.c.bakiye || 0, render: x => <Money v={+x.c.bakiye || 0} />, hideSm: true },
    { key: 'yor', label: 'Değerlendirme', width: 130, render: x => { const y = yorum(x); return <Badge tone={y.tone}>{y.l}</Badge> } },
  ]

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Tedarikçiler" />
      <Page>
        <PageHead title="Tedarikçi Performansı" sub="Cari hesaplardaki “Tedarikçi” kartları; sipariş ve teslim kayıtlarından hesaplanır"
          actions={<Link href="/admin/dashboard/muhasebe/cari" className="adm-btn-ghost" style={{ textDecoration: 'none' }}><ExternalLink size={13} />Tedarikçi ekle (Cari)</Link>} />
        <KpiGrid min={170}>
          <Kpi label="Tedarikçi" value={istat.length} Icon={Building2} color="var(--adm-blue)" sub={`${istat.filter((x: any) => x.sayi > 0).length} tanesiyle sipariş var`} />
          <Kpi label="Açık sipariş" value={istat.reduce((a: number, x: any) => a + x.acik, 0)} Icon={Truck} color="var(--adm-amber)" />
          <Kpi label="Geciken sipariş" value={istat.reduce((a: number, x: any) => a + x.geciken, 0)} Icon={AlertTriangle} color={istat.some((x: any) => x.geciken) ? 'var(--adm-red)' : 'var(--adm-green)'} />
          <Kpi label="Toplam alım" value={fmt(istat.reduce((a: number, x: any) => a + x.tutar, 0))} Icon={Coins} color="var(--adm-ac)" valueSize={18} />
        </KpiGrid>
        <div style={{ marginTop: 14 }}>
          <DataGrid rows={istat} cols={cols} rowKey={(x: any) => x.c.id} loading={loading} csvName="tedarikci-performans" storageKey="tedarikci-performans" onRowClick={(x: any) => setSecili(x.c.id)}
            searchText={(x: any) => `${x.c.kod || ''} ${x.c.ad} ${x.c.vergi_no || ''}`} searchPlaceholder="Tedarikçi kodu veya adı…" emptyTitle="Tedarikçi yok" emptySub="Muhasebe → Cari Hesaplar’da türü “Tedarikçi” olan bir kart ekleyin" />
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 10 }}>Zamanında teslim: son teslim tarihi beklenen teslimi geçmeyen tamamlanmış siparişlerin oranı. “Değerlendirme” en az {MIN_VERI} tamamlanmış ve tarihli sipariş olunca gösterilir; daha azında yorum yapılmaz.</p>
      </Page>

      <Drawer open={!!aktif} onClose={() => setSecili(null)} width={620} title={aktif?.c.ad} sub={aktif ? [aktif.c.kod, aktif.c.vergi_no && `VKN ${aktif.c.vergi_no}`, aktif.c.telefon, aktif.c.email].filter(Boolean).join(' · ') : ''}
        footer={aktif && <><Link href={`/admin/dashboard/satinalma/siparisler?yeni=${aktif.c.id}`} className="adm-btn" style={{ textDecoration: 'none' }}><Plus size={13} />Yeni sipariş</Link></>}>
        {aktif && <div style={{ padding: 20, display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge tone={yorum(aktif).tone}>{yorum(aktif).l}</Badge>
            <Badge tone="muted">{aktif.sayi} sipariş · {fmt(aktif.tutar)}</Badge>
            {aktif.oran != null && <Badge tone="blue">Zamanında %{fmtN(aktif.oran * 100, 0)}</Badge>}
            {aktif.termin != null && <Badge tone="blue">Ort. termin {fmtN(aktif.termin, 1)} gün</Badge>}
          </div>
          {aktif.c.adres && <div style={{ fontSize: 12.5, color: 'var(--adm-tx3)' }}>{aktif.c.adres}</div>}
          <Card title="Hammadde fiyat geçmişi" pad={0}>
            {Object.keys(aktif.fiyat).length === 0 ? <p style={{ margin: 0, padding: '12px 18px', fontSize: 12.5, color: 'var(--adm-tx3)' }}>Fiyatlı sipariş kaydı yok.</p> : Object.entries(aktif.fiyat).map(([hid, a]: any) => {
              const son = a[a.length - 1], onceki = a.length > 1 ? a[a.length - 2] : null, degisim = onceki ? ((son.fiyat - onceki.fiyat) / onceki.fiyat) * 100 : null
              return <div key={hid} className="adm-row" style={{ padding: '8px 18px', display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                <span style={{ flex: 1 }}><b>{ham[hid]?.ad || 'Hammadde'}</b><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{a.slice(-4).map((x: any) => fmtN(x.fiyat, 2)).join(' → ')}</div></span>
                <span>{fmt(son.fiyat)}</span>
                <span style={{ width: 70, textAlign: 'right', color: degisim == null ? 'var(--adm-tx3)' : degisim > 0 ? 'var(--adm-red)' : 'var(--adm-green)' }}>{degisim == null ? '—' : `${degisim > 0 ? '+' : ''}${fmtN(degisim, 1)}%`}</span>
              </div>
            })}
          </Card>
          <Card title="Siparişler" pad={0}>
            {aktif.siparisler.length === 0 ? <p style={{ margin: 0, padding: '12px 18px', fontSize: 12.5, color: 'var(--adm-tx3)' }}>Bu tedarikçiyle sipariş yok.</p> : aktif.siparisler.slice(0, 30).map((s: any) => (
              <div key={s.id} className="adm-row" style={{ padding: '8px 18px', display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                <b style={{ width: 110 }}>{s.no}</b><span style={{ width: 80, color: 'var(--adm-tx3)' }}>{fmtDate(s.tarih)}</span>
                <span style={{ flex: 1 }}><Badge tone={DURUM[s.durum]?.tone}>{DURUM[s.durum]?.l}</Badge>{s.geciken && <Badge tone="red" style={{ marginLeft: 6 }}>gecikti</Badge>}</span>
                <span style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{s.durum === 'teslim_alindi' && s.teslim && s.beklenen_teslim ? (s.teslim.slice(0, 10) <= s.beklenen_teslim ? 'zamanında' : `${gunFarki(s.beklenen_teslim, s.teslim)} gün geç`) : s.beklenen_teslim ? `bek. ${fmtDate(s.beklenen_teslim)}` : ''}</span>
                <span style={{ width: 110, textAlign: 'right' }}>{fmt(s.tutar)}</span>
              </div>))}
          </Card>
        </div>}
      </Drawer>
      {toast.node}
    </div>
  )
}
