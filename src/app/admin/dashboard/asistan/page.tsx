'use client'
import ExcelDugmeleri from '@/components/admin/ExcelLinkleri'
import { useEffect, useRef, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { Page, PageHead, Card, useToast } from '@/components/admin/erp/ui'
import { aiIstek } from '@/lib/ai-client'
import { Send, Sparkles, Trash2 } from 'lucide-react'
import SesliAsistan from '@/components/admin/SesliAsistan'

type Msg = { role: 'user' | 'assistant'; content: string; araclar?: string[] }
type Soru = { metin: string; secenekler: string[] }

const ONERILER = [
  'Bu ay gelir ve gider durumu nasıl, geçen aya göre?',
  'Vadesi geçmiş faturalar ve yaşlandırma durumu',
  'Kritik seviyedeki stoklar neler?',
  'Açık siparişler ve termini yaklaşanlar',
  'Üretimdeki emirlerin durumu',
  'Son 7 günde site ziyareti nasıl?',
  'Güncel dolar/euro kuru ne, genel olarak yorumun ne?',
]

export default function AsistanPage() {
  const toast = useToast()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [girdi, setGirdi] = useState('')
  const [loading, setLoading] = useState(false)
  const [soru, setSoru] = useState<Soru | null>(null)   // yapay zekânın takıldığı yerde sorduğu popup
  const [serbest, setSerbest] = useState('')
  const alt = useRef<HTMLDivElement>(null)
  useEffect(() => { alt.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, loading])

  function cevapla(c: string) { setSoru(null); sor(c) }

  async function sor(metin: string) {
    const q = metin.trim(); if (!q || loading) return
    const yeni: Msg[] = [...msgs, { role: 'user', content: q }]
    setMsgs(yeni); setGirdi(''); setLoading(true)
    try {
      const r = await aiIstek<{ yanit: string; araclar: string[]; soru?: Soru }>('asistan', { mesajlar: yeni.map(m => ({ role: m.role, content: m.content })) })
      setMsgs(m => [...m, { role: 'assistant', content: r.yanit, araclar: r.araclar }])
      if (r.soru) { setSerbest(''); setSoru(r.soru) }
    } catch (e: any) { toast.show(e.message, true); setMsgs(yeni.slice(0, -1)); setGirdi(q) }
    setLoading(false)
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="AI Asistan" />
      <Page>
        <PageHead title="Veri Asistanı" sub="İşletme verilerini (muhasebe, satış, stok, üretim...) Türkçe sor, yorumunu iste; güncel döviz kuru ve genel ekonomi konularında da görüş verir. Yalnızca okur; yetkin olmayan verilere erişemez. Cevaplar yapay zeka ile üretilir, önemli kararlardan önce ilgili ekrandan doğrula."
          actions={msgs.length > 0 && <button className="adm-btn-ghost" onClick={() => setMsgs([])}><Trash2 size={13} />Temizle</button>} />
        <SesliAsistan />
        <Card pad={0}>
          <div style={{ minHeight: 320, maxHeight: 'calc(100vh - 340px)', overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {msgs.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 520 }}>
                <Sparkles size={28} style={{ color: 'var(--adm-ac)' }} />
                <p style={{ fontSize: 13.5, color: 'var(--adm-tx3)', margin: '10px 0 16px' }}>Bir soru yaz veya örneklerden birini seç:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>{ONERILER.map(o => <button key={o} className="adm-chip" onClick={() => sor(o)}>{o}</button>)}</div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: 'min(720px, 90%)' }}>
                <div style={{ padding: '10px 14px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.65, whiteSpace: 'pre-wrap', background: m.role === 'user' ? 'var(--adm-ac)' : 'var(--adm-s2)', color: m.role === 'user' ? '#fff' : 'var(--adm-tx)' }}>{m.content}{m.role !== 'user' && <ExcelDugmeleri metin={m.content} />}</div>
                {m.araclar && m.araclar.length > 0 && <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)', marginTop: 4 }}>Kaynak: {Array.from(new Set(m.araclar)).join(', ')}</div>}
              </div>
            ))}
            {loading && <div style={{ alignSelf: 'flex-start', fontSize: 12.5, color: 'var(--adm-tx3)' }}>Veriler sorgulanıyor…</div>}
            <div ref={alt} />
          </div>
          <form onSubmit={e => { e.preventDefault(); sor(girdi) }} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--adm-bdr)' }}>
            <input className="adm-inp" value={girdi} onChange={e => setGirdi(e.target.value)} maxLength={1500} placeholder="Örn. Bu ay en çok ne sattık?" disabled={loading} />
            <button className="adm-btn" type="submit" disabled={loading || !girdi.trim()}><Send size={14} />Sor</button>
          </form>
        </Card>
      </Page>
      {toast.node}
      {soru && <div role="dialog" aria-modal="true" onClick={() => setSoru(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--adm-s1, var(--adm-bg))', border: '1px solid var(--adm-bdr)', borderRadius: 16, padding: 20, width: 'min(480px, 100%)', boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--adm-ac)', fontWeight: 700, marginBottom: 8 }}><Sparkles size={14} />Asistan bir şey soruyor</div>
          <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 14px', lineHeight: 1.5 }}>{soru.metin}</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {soru.secenekler.map(o => <button key={o} className="adm-btn-ghost" style={{ justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal' }} onClick={() => cevapla(o)}>{o}</button>)}
          </div>
          <form onSubmit={e => { e.preventDefault(); if (serbest.trim()) cevapla(serbest) }} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input className="adm-inp" value={serbest} onChange={e => setSerbest(e.target.value)} maxLength={300} placeholder="Başka bir cevap yaz…" />
            <button className="adm-btn" type="submit" disabled={!serbest.trim()}><Send size={14} /></button>
          </form>
          <div style={{ textAlign: 'right', marginTop: 10 }}><button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setSoru(null)}>Vazgeç</button></div>
        </div>
      </div>}
    </div>
  )
}
