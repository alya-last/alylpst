'use client'
import { useCallback, useEffect, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { web } from '@/lib/web-data'
import { fmtInt, fmtDateTime, todayISO } from '@/lib/fmt'
import { iso } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Tabs, Badge, Card, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col, type ServerMode } from '@/components/admin/erp/DataGrid'
import { Eye, Calendar, Globe, Smartphone, Archive, Database } from 'lucide-react'

const SIRALAMA: Record<string, string> = { zaman: 'visited_at', sayfa: 'page', kaynak: 'kaynak', ulke: 'country', cihaz: 'cihaz', tarayici: 'tarayici' }

// Ham log sunucu tarafında sayfalanır (milyonlarca satır olsa da tarayıcıya yalnızca görünen sayfa gelir).
export default function ZiyaretcilerPage() {
  const toast = useToast()
  const [donem, setDonem] = useState('7')
  const [cihazF, setCihazF] = useState('')
  const [ozet, setOzet] = useState<any>(null)
  const [surum, setSurum] = useState(0)
  const [temizleniyor, setTemizleniyor] = useState<string | null>(null)

  const yukleOzet = useCallback(() => { web.rpc('rpc_ziyaret_ozet', { p_days: 30 }).then(({ data }: any) => setOzet(data)) }, [])
  useEffect(() => { yukleOzet() }, [yukleOzet, surum])

  const server: ServerMode<any> = {
    deps: [donem, cihazF, surum],
    fetch: async ({ page, size, q, sort }) => {
      const bugun = todayISO()
      const filtresiz = donem === 'tumu' && !cihazF && !q
      let s: any = web.from('site_visits').select('id,visited_at,page,referrer,country,cihaz,tarayici,kaynak', { count: filtresiz ? 'estimated' : 'exact' })
      if (donem === 'bugun') s = s.eq('gun', bugun)
      else if (donem !== 'tumu') { const d = new Date(); d.setDate(d.getDate() - (+donem - 1)); s = s.gte('gun', iso(d)) }
      if (cihazF) s = s.eq('cihaz', cihazF)
      const term = q.replace(/[,()%*\\:]/g, ' ').trim()
      if (term) { const t = term.replace(/[,()%*\\]/g, ' ').trim(); if (t) s = s.or(`page.ilike.%${t}%,kaynak.ilike.%${t}%,country.ilike.%${t}%`) }
      s = s.order(sort ? sort.key : 'visited_at', { ascending: sort ? sort.dir === 'asc' : false }).order('id', { ascending: false }).range(page * size, page * size + size - 1)
      const { data, count, error } = await s
      if (error) throw new Error(error.message)
      return { rows: data || [], total: count ?? (data || []).length }
    },
  }

  async function temizle() {
    if (!confirm('45 günden eski ham ziyaret kayıtları günlük özete çevrilip silinecek.\nAnalitik grafikleri etkilenmez (özetler korunur). Devam edilsin mi?')) return
    let silinen = 0, kalan = 1, tur = 0
    try {
      while (kalan > 0 && tur < 400) {
        setTemizleniyor(`${fmtInt(silinen)} kayıt özetlendi...`)
        const { data, error } = await web.rpc('rpc_ziyaret_arsivle', { p_gun: 45, p_batch_gun: 3 })
        if (error) throw new Error(error.message)
        silinen += +data.silinen_ham; kalan = +data.kalan; tur++
        if (+data.silinen_ham === 0 && kalan > 0) break
      }
      toast.show(`${fmtInt(silinen)} ham kayıt özetlenip temizlendi`)
    } catch (e: any) { toast.show(e.message, true) }
    setTemizleniyor(null); setSurum(v => v + 1)
  }

  const cols: Col<any>[] = [
    { key: 'zaman', sortKey: 'visited_at', label: 'Zaman', width: 150, render: r => <span style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDateTime(r.visited_at)}</span> },
    { key: 'sayfa', sortKey: 'page', label: 'Sayfa', render: r => <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{r.page || '/'}</span>, csv: r => r.page },
    { key: 'kaynak', sortKey: 'kaynak', label: 'Kaynak', render: r => r.kaynak === 'Doğrudan' ? <Badge tone="muted">Doğrudan</Badge> : r.kaynak, csv: r => r.kaynak, hideSm: true },
    { key: 'ulke', sortKey: 'country', label: 'Ülke', render: r => r.country || '—', csv: r => r.country, hideSm: true },
    { key: 'cihaz', sortKey: 'cihaz', label: 'Cihaz', render: r => <Badge tone={r.cihaz === 'Mobil' ? 'blue' : 'muted'}>{r.cihaz}</Badge>, csv: r => r.cihaz },
    { key: 'tarayici', sortKey: 'tarayici', label: 'Tarayıcı', render: r => r.tarayici, csv: r => r.tarayici, hideSm: true },
  ]
  void SIRALAMA

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Ziyaretçiler" />
      <Page>
        <PageHead title="Ziyaret Kayıtları" sub="Ham ziyaret günlüğü — sunucu tarafında sayfalanır, filtrelenir ve aranır" />
        <KpiGrid min={180}>
          <Kpi label="Bugün" value={ozet ? fmtInt(ozet.bugun) : '…'} Icon={Calendar} color="var(--adm-ac)" />
          <Kpi label="Son 30 Gün" value={ozet ? fmtInt(ozet.toplam) : '…'} Icon={Eye} color="var(--adm-blue)" />
          <Kpi label="Toplam Ziyaret" value={ozet ? fmtInt(ozet.tumu) : '…'} Icon={Globe} color="var(--adm-green)" sub="ham + arşivlenmiş özet" />
          <Kpi label="Mobil Oranı (30g)" value={ozet && +ozet.toplam ? `%${Math.round((+ozet.mobil / +ozet.toplam) * 100)}` : '—'} Icon={Smartphone} color="#8b5cf6" sub={ozet ? `${fmtInt(ozet.mobil)} mobil ziyaret` : ''} />
        </KpiGrid>

        <Card style={{ marginBottom: 14 }}>
          <div style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
            <Database size={16} style={{ color: 'var(--adm-tx3)' }} />
            <span style={{ flex: 1, minWidth: 240, color: 'var(--adm-tx2)' }}><b>Veri saklama:</b> Ham kayıtlar büyüdükçe 45 günden eskileri günlük özete çevrilip silinebilir; analitik grafikleri korunur, veritabanı hafif kalır.</span>
            <button className="adm-btn-ghost" disabled={!!temizleniyor} onClick={temizle}><Archive size={13} />{temizleniyor || 'Eski kayıtları özetle ve temizle'}</button>
          </div>
        </Card>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <Tabs value={donem} onChange={setDonem} tabs={[{ v: 'bugun', l: 'Bugün' }, { v: '7', l: '7 gün' }, { v: '30', l: '30 gün' }, { v: 'tumu', l: 'Tümü' }]} />
          <Tabs value={cihazF} onChange={setCihazF} tabs={[{ v: '', l: 'Tüm cihazlar' }, { v: 'Masaüstü', l: 'Masaüstü' }, { v: 'Mobil', l: 'Mobil' }, { v: 'Tablet', l: 'Tablet' }]} />
        </div>
        <DataGrid rows={[]} server={server} cols={cols} rowKey={r => r.id} csvName="ziyaretler" storageKey="ziyaret-srv" pageSizes={[50, 100, 250, 500]} searchPlaceholder="Sayfa, kaynak, ülke..." emptyTitle="Ziyaret kaydı yok" emptySub="Seçilen dönemde ham kayıt bulunamadı (eski kayıtlar özete çevrilmiş olabilir)." footerNote={<span>· Tüm zamanlarda toplam sayı tahminidir</span>} />
      </Page>
      {toast.node}
    </div>
  )
}
