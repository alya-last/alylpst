'use client'
import { useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { web } from '@/lib/web-data'
import { Page, PageHead, Card, useToast } from '@/components/admin/erp/ui'
import Yardim from '@/components/admin/erp/Yardim'
import { HafizaSekme } from '@/components/admin/AiHafiza'
import { GraduationCap, Plus } from 'lucide-react'

export default function AiEgitPage() {
  const toast = useToast()
  const [soru, setSoru] = useState('')
  const [dogru, setDogru] = useState('')
  const [busy, setBusy] = useState(false)
  const [yenile, setYenile] = useState(0)
  async function ekle(e: React.FormEvent) {
    e.preventDefault()
    if (soru.trim().length < 3 || dogru.trim().length < 5) { toast.show('Soru ve doğru anlayışı yazın', true); return }
    setBusy(true)
    const { error } = await web.from('ai_hafiza').insert({ soru: soru.trim().slice(0, 1000), dogru_cevap: dogru.trim().slice(0, 1500), durum: 'aktif' })
    setBusy(false)
    if (error) { toast.show(error.message, true); return }
    setSoru(''); setDogru(''); setYenile(n => n + 1); toast.show('Ders eklendi, yapay zeka artık kullanıyor.')
  }
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Yapay Zekayı Eğit" />
      <Page>
        <PageHead title="Yapay Zekayı Eğit" sub="Yapay zekaya Alya'nın işleyişini öğret: yanlış anladığı soruları düzelt. Eklenen ders hemen kullanılır, yanlışsa tek tıkla kapatılır." />
        <Yardim sayfa="ai-egit" />
        <Card>
          <form onSubmit={ekle} style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}><GraduationCap size={16} />Yeni ders ekle</div>
            <label style={{ fontSize: 12.5, fontWeight: 600 }}>Yapay zekaya sorulacak soru (ya da kelime)</label>
            <input className="adm-inp" value={soru} onChange={e => setSoru(e.target.value)} maxLength={1000} placeholder='Örnek: "Takastaki çekler"' />
            <label style={{ fontSize: 12.5, fontWeight: 600 }}>Doğru anlayış nedir? (rakam yazmayın)</label>
            <textarea className="adm-inp" rows={3} value={dogru} onChange={e => setDogru(e.target.value)} maxLength={1500} placeholder="Örnek: Takastakiler bankaya tahsile verilenlerdir, elde sayılmaz. Sadece Garanti Bankası'na verilenleri listele." />
            <div><button className="adm-btn" type="submit" disabled={busy}><Plus size={14} />Dersi ekle</button></div>
          </form>
        </Card>
        <div style={{ height: 16 }} />
        <HafizaSekme key={yenile} />
      </Page>
    </div>
  )
}
