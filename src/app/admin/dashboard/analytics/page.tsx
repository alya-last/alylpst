'use client'
import { useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { web, webAll } from '@/lib/web-data'
import { fmtInt, fmtN } from '@/lib/fmt'
import { iso, pctDelta, CHART_COLORS } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Card, Tabs, Empty, Skeleton } from '@/components/admin/erp/ui'
import { TrendChart, Donut, BarList } from '@/components/admin/erp/charts'
import { Eye, Calendar, TrendingUp, MessageSquare, Percent, Globe, Database } from 'lucide-react'

const GUN = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
type Kv = { l: string | number; v: number }
const top = (arr: string[], n = 6) => { const m: Record<string, number> = {}; arr.forEach(a => { m[a] = (m[a] || 0) + 1 }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n) }

// Tüm hesaplar veritabanında (rpc_ziyaret_ozet) yapılır; tarayıcıya yalnızca özet gelir — milyonlarca ziyarette de anında açılır.
export default function AdminAnalyticsPage() {
  const [gun, setGun] = useState('30')
  const [o, setO] = useState<any | null>(null)
  const [hata, setHata] = useState('')
  const [leads, setLeads] = useState<any[]>([])
  useEffect(() => { webAll('contact_submissions', 'created_at,status,product,subject').then(setLeads) }, [])
  useEffect(() => {
    setO(null); setHata('')
    web.rpc('rpc_ziyaret_ozet', { p_days: gun === 'tumu' ? 3650 : +gun }).then(({ data, error }: any) => { if (error) setHata(error.message); else setO(data) })
  }, [gun])

  const n = gun === 'tumu' ? 3650 : +gun
  const lim = Date.now() - n * 86400000
  const curLeads = leads.filter(l => +new Date(l.created_at) >= lim)
  const seri = useMemo(() => {
    if (!o) return { labels: [] as string[], v: [] as number[] }
    const map = new Map<string, number>((o.gunluk || []).map((x: any) => [x.g, +x.v]))
    const len = Math.min(n, 60)
    const g = Array.from({ length: len }, (_, i) => { const t = new Date(); t.setDate(t.getDate() - (len - 1 - i)); return iso(t) })
    return { labels: g.map(x => `${x.slice(8)}.${x.slice(5, 7)}`), v: g.map(k => map.get(k) || 0) }
  }, [o, n])
  const saat = useMemo(() => Array.from({ length: 24 }, (_, h) => +((o?.saat || []).find((x: any) => +x.l === h)?.v || 0)), [o])
  const hgun = useMemo(() => GUN.map((_, i) => +((o?.haftagunu || []).find((x: any) => +x.l === i)?.v || 0)), [o])
  const toplam = +(o?.toplam || 0)
  const donusum = toplam ? (curLeads.length / toplam) * 100 : 0
  const yogun = saat.indexOf(Math.max(...saat))
  const ilkGun = o?.ilk_gun ? Math.max(1, Math.ceil((Date.now() - +new Date(o.ilk_gun)) / 86400000)) : 1
  const konular = top(curLeads.map(l => l.product || l.subject || 'Genel'))
  const kv = (a?: Kv[]) => (a || []).map(x => ({ label: String(x.l), value: +x.v }))

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Analitik" />
      <Page>
        <PageHead title="Web Sitesi Analitiği" sub={`Ziyaretçi trafiği, kaynaklar, cihazlar ve başvuru dönüşümü${o ? ` · toplam ${fmtInt(o.tumu)} ziyaret kaydı (hesaplar veritabanında)` : ''}`} actions={<Tabs value={gun} onChange={setGun} tabs={[{ v: '7', l: '7 gün' }, { v: '30', l: '30 gün' }, { v: '90', l: '90 gün' }, { v: 'tumu', l: 'Tümü' }]} />} />
        {hata && <div className="adm-card" style={{ padding: 14, marginBottom: 14, color: 'var(--adm-red)', fontSize: 13 }}>Analitik verisi alınamadı: {hata}</div>}
        {!o && !hata ? <KpiGrid>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="adm-kpi"><Skeleton h={10} w={80} /><Skeleton h={24} w={100} style={{ marginTop: 14 }} /></div>)}</KpiGrid> : o && <>
          <KpiGrid min={190}>
            <Kpi label="Ziyaret" value={fmtInt(toplam)} Icon={Eye} color="var(--adm-blue)" delta={gun === 'tumu' ? null : pctDelta(toplam, +o.onceki)} sub={gun === 'tumu' ? 'seçilen dönem' : 'önceki döneme göre'} spark={seri.v} />
            <Kpi label="Bugün" value={fmtInt(o.bugun)} Icon={Calendar} color="var(--adm-ac)" sub={`günlük ort. ${fmtN(toplam / Math.min(n, ilkGun), 1)}`} />
            <Kpi label="Başvuru" value={curLeads.length} Icon={MessageSquare} color="var(--adm-green)" sub="bu dönemde gelen" />
            <Kpi label="Dönüşüm" value={`%${fmtN(donusum, 2)}`} Icon={Percent} color="var(--adm-amber)" sub="başvuru / ziyaret" />
            <Kpi label="En Yoğun Saat" value={toplam ? `${String(yogun).padStart(2, '0')}:00` : '—'} Icon={TrendingUp} color="#8b5cf6" sub={toplam ? `${fmtInt(saat[yogun])} ziyaret` : ''} />
          </KpiGrid>

          {toplam === 0 ? <Card><Empty icon={<Globe size={34} />} title="Bu dönemde ziyaret verisi yok" sub="Farklı bir dönem seç veya siteye gelen ziyaretleri bekle." /></Card> : <>
            <Card title="Günlük Ziyaret" right={<span style={{ fontSize: 11.5, color: 'var(--adm-tx3)', display: 'inline-flex', gap: 5, alignItems: 'center' }}><Database size={12} />özet tablodan</span>} pad={16} style={{ marginBottom: 16 }}><TrendChart type="area" height={220} labels={seri.labels} series={[{ name: 'Ziyaret', color: '#2f7dd6', data: seri.v }]} format={v => fmtInt(v)} /></Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 16, marginBottom: 16 }}>
              <Card title="Saate Göre" pad={16}><TrendChart type="bar" height={180} labels={Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))} series={[{ name: 'Ziyaret', color: '#8b5cf6', data: saat }]} format={v => fmtInt(v)} /></Card>
              <Card title="Haftanın Günlerine Göre" pad={16}><TrendChart type="bar" height={180} labels={GUN} series={[{ name: 'Ziyaret', color: '#14b088', data: hgun }]} format={v => fmtInt(v)} /></Card>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 16, marginBottom: 16 }}>
              <Card title="En Çok Ziyaret Edilen Sayfalar" pad={18}><BarList items={kv(o.sayfalar)} format={v => fmtInt(v)} /></Card>
              <Card title="Trafik Kaynakları" pad={18}><BarList items={kv(o.kaynaklar)} color="var(--adm-green)" format={v => fmtInt(v)} /></Card>
              <Card title="Ülkeler" pad={18}><BarList items={kv(o.ulkeler)} color="#8b5cf6" format={v => fmtInt(v)} /></Card>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))', gap: 16 }}>
              <Card title="Cihaz" pad={18}><Donut size={150} data={kv(o.cihazlar).map((x, i) => ({ ...x, color: CHART_COLORS[i] }))} center={{ top: 'Ziyaret', bottom: fmtInt(toplam) }} /></Card>
              <Card title="Tarayıcı" pad={18}><Donut size={150} data={kv(o.tarayicilar).map((x, i) => ({ ...x, color: CHART_COLORS[i + 3] }))} center={{ top: 'Ziyaret', bottom: fmtInt(toplam) }} /></Card>
              <Card title="Başvuruların İlgi Alanı" pad={18}>{konular.length === 0 ? <Empty title="Bu dönemde başvuru yok" /> : <BarList items={konular.map(([l, v]) => ({ label: l, value: v }))} color="var(--adm-amber)" format={v => `${v} başvuru`} />}</Card>
            </div>
          </>}
        </>}
      </Page>
    </div>
  )
}
