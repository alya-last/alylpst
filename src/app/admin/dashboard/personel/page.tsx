'use client'
import { useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { Page, PageHead, Tabs, useToast } from '@/components/admin/erp/ui'
import BugunTab from '@/components/admin/personel/BugunTab'
import PersonelTab from '@/components/admin/personel/PersonelTab'
import PuantajTab from '@/components/admin/personel/PuantajTab'
import IzinTab from '@/components/admin/personel/IzinTab'
import UretimTab from '@/components/admin/personel/UretimTab'
import AyarTab from '@/components/admin/personel/AyarTab'
import BordroTab from '@/components/admin/personel/BordroTab'
import { useModuller } from '@/lib/use-moduller'

export default function PersonelPage() {
  const toast = useToast()
  const [tab, setTab] = useState('bugun')
  const { has, ready } = useModuller()
  const bordroYetkisi = !ready || has('bordro')
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Personel Giriş-Çıkış" />
      <Page>
        <PageHead title="Personel Giriş-Çıkış" sub="QR kart ile kapı kiosku · puantaj · izin · üretim verimliliği" />
        <Tabs value={tab} onChange={setTab} style={{ marginBottom: 16 }} tabs={[{ v: 'bugun', l: 'Bugün' }, { v: 'personel', l: 'Personel' }, { v: 'puantaj', l: 'Puantaj' }, { v: 'izin', l: 'İzin / Rapor' }, ...(bordroYetkisi ? [{ v: 'bordro', l: 'Bordro' }] : []), { v: 'uretim', l: 'Üretim Verimliliği' }, { v: 'ayar', l: 'Ayarlar' }]} />
        {tab === 'bugun' && <BugunTab toast={toast} />}
        {tab === 'personel' && <PersonelTab toast={toast} />}
        {tab === 'puantaj' && <PuantajTab toast={toast} />}
        {tab === 'izin' && <IzinTab toast={toast} />}
        {tab === 'bordro' && bordroYetkisi && <BordroTab toast={toast} />}
        {tab === 'uretim' && <UretimTab toast={toast} />}
        {tab === 'ayar' && <AyarTab toast={toast} />}
      </Page>
      {toast.node}
    </div>
  )
}
