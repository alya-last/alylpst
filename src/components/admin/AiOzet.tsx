'use client'
import { useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { Card, useToast } from '@/components/admin/erp/ui'
import { aiIstek } from '@/lib/ai-client'

// Dashboard için isteğe bağlı AI özeti. Otomatik çalışmaz (maliyet): butona basınca üretilir.
export default function AiOzet() {
  const toast = useToast()
  const [ozet, setOzet] = useState('')
  const [loading, setLoading] = useState(false)
  const [zaman, setZaman] = useState('')

  async function uret() {
    setLoading(true)
    try {
      const r = await aiIstek<{ ozet: string }>('ozet')
      setOzet(r.ozet); setZaman(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }))
    } catch (e: any) { toast.show(e.message, true) }
    setLoading(false)
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <Card title={<><Sparkles size={14} style={{ color: 'var(--adm-ac)' }} />AI Durum Özeti</>}
        right={<button className="adm-btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={uret} disabled={loading}>{ozet ? <RefreshCw size={12} /> : <Sparkles size={12} />}{loading ? 'Hazırlanıyor…' : ozet ? 'Yenile' : 'Özet oluştur'}</button>} pad={ozet ? 16 : 0}>
        {ozet
          ? <><div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.65 }}>{ozet}</div><p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--adm-tx3)' }}>Yetkili olduğun modüllerin verisinden yapay zeka ile üretildi ({zaman}). Kararlardan önce ilgili ekranlardan doğrula.</p></>
          : <p style={{ margin: 0, padding: '14px 18px', fontSize: 12.5, color: 'var(--adm-tx3)' }}>Finans, stok, üretim, sipariş ve site verilerinden kısa bir yönetici özeti hazırlar.</p>}
      </Card>
      {toast.node}
    </div>
  )
}
