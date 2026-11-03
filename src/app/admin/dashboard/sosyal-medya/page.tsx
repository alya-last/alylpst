'use client'
import { useEffect, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { Page, PageHead, Tabs, useToast } from '@/components/admin/erp/ui'
import { web } from '@/lib/web-data'
import UreticiTab from '@/components/admin/sosyal/UreticiTab'
import TakvimTab from '@/components/admin/sosyal/TakvimTab'
import OnayModal from '@/components/admin/sosyal/OnayModal'
import SesliAsistan from '@/components/admin/SesliAsistan'

export default function SosyalMedyaPage() {
  const toast = useToast()
  const [tab, setTab] = useState('uretici')
  const [yenile, setYenile] = useState(0)
  const [onay, setOnay] = useState<any>(null)
  const [urunler, setUrunler] = useState<any[]>([])
  useEffect(() => { web.from('products').select('id,name').order('name').limit(1500).then(({ data }) => setUrunler(data || [])) }, [])
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Sosyal Medya" />
      <Page>
        <PageHead title="Sosyal Medya" sub="Yapay zeka içerik ve görsel hazırlar · siz zamanı onaylarsınız · zamanı gelince otomatik paylaşılır" />
        <SesliAsistan birim="sosyal" baslik="Sesli Sosyal Medya Asistanı" />
        <Tabs value={tab} onChange={setTab} style={{ marginBottom: 16 }} tabs={[{ v: 'uretici', l: 'İçerik Üretici (AI)' }, { v: 'takvim', l: 'Takvim' }]} />
        {tab === 'uretici' && <UreticiTab toast={toast} onOnay={setOnay} onKaydedildi={() => setYenile(n => n + 1)} />}
        {tab === 'takvim' && <TakvimTab toast={toast} yenile={yenile} />}
      </Page>
      {onay && <OnayModal r={onay} urunler={urunler} toast={toast} onKapat={() => setOnay(null)} onBitti={() => { setOnay(null); setYenile(n => n + 1) }} />}
      {toast.node}
    </div>
  )
}
