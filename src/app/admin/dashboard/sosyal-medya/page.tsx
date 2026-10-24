'use client'
import { useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { Page, PageHead, Tabs, useToast } from '@/components/admin/erp/ui'
import UreticiTab from '@/components/admin/sosyal/UreticiTab'
import TakvimTab from '@/components/admin/sosyal/TakvimTab'
import GorselTab from '@/components/admin/sosyal/GorselTab'
import SesliAsistan from '@/components/admin/SesliAsistan'

export default function SosyalMedyaPage() {
  const toast = useToast()
  const [tab, setTab] = useState('uretici')
  const [urunId, setUrunId] = useState('')
  const [yenile, setYenile] = useState(0)
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Sosyal Medya" />
      <Page>
        <PageHead title="Sosyal Medya" sub="B2B içerik üretimi · paylaşım takvimi · görsel şablonları" />
        <SesliAsistan birim="sosyal" baslik="Sesli Sosyal Medya Asistanı" />
        <Tabs value={tab} onChange={setTab} style={{ marginBottom: 16 }} tabs={[{ v: 'uretici', l: 'İçerik Üretici (AI)' }, { v: 'takvim', l: 'Takvim' }, { v: 'gorsel', l: 'Görsel Şablonlar' }]} />
        {tab === 'uretici' && <UreticiTab toast={toast} onGorsel={id => { setUrunId(id); setTab('gorsel') }} onKaydedildi={() => setYenile(n => n + 1)} />}
        {tab === 'takvim' && <TakvimTab toast={toast} yenile={yenile} />}
        {tab === 'gorsel' && <GorselTab toast={toast} urunId={urunId} setUrunId={setUrunId} />}
      </Page>
      {toast.node}
    </div>
  )
}
