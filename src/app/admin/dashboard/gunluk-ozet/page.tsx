'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AdminTopBar from '@/components/admin/TopBar'
import { Page, PageHead, Card, Badge, Empty, useToast } from '@/components/admin/erp/ui'
import { RefreshCw, Send, CheckCircle2, Settings } from 'lucide-react'

const TON: Record<string, { tone: any; renk: string }> = { kirmizi: { tone: 'red', renk: 'var(--adm-red)' }, sari: { tone: 'amber', renk: 'var(--adm-amber)' }, bilgi: { tone: 'blue', renk: 'var(--adm-blue)' } }

export default function GunlukOzetPage() {
  const toast = useToast()
  const [o, setO] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const yukle = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/gunluk-ozet', { cache: 'no-store' }); const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Özet alınamadı'); setO(j)
    } catch (e: any) { toast.show(e.message, true) }
    setLoading(false)
  }, []) // eslint-disable-line
  useEffect(() => { yukle() }, [yukle])

  async function gonder() {
    if (busy || !confirm('Özet, Bildirimler sayfasında tanımlı alıcılara şimdi gönderilsin mi?')) return
    setBusy(true)
    try {
      const r = await fetch('/api/admin/gunluk-ozet', { method: 'POST' }); const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Gönderilemedi'); toast.show('Özet gönderildi')
    } catch (e: any) { toast.show(e.message, true) }
    setBusy(false)
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Günlük Özet" />
      <Page maxWidth={960}>
        <PageHead title="Günlük Özet" sub="Dikkat gerektiren işler — her sabah 08:30'da (Pzt–Cmt) alıcılara da gönderilir"
          actions={<><Link href="/admin/dashboard/bildirimler" className="adm-btn-ghost" style={{ textDecoration: 'none' }}><Settings size={13} />Alıcılar</Link><button className="adm-btn-ghost" onClick={yukle} disabled={loading}><RefreshCw size={13} />Yenile</button><button className="adm-btn" onClick={gonder} disabled={busy}><Send size={13} />Şimdi gönder</button></>} />
        {loading && !o ? <p style={{ color: 'var(--adm-tx3)' }}>Hazırlanıyor…</p> : !o ? null : o.bolumler.length === 0 ? (
          <Empty icon={<CheckCircle2 size={28} />} title="Dikkat gerektiren madde yok" sub="Vadesi geçen alacak/ödeme, çek-senet, kritik stok, geciken sipariş ve yanıt bekleyen başvuru bulunmuyor" />
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {o.bolumler.map((b: any) => (
              <Card key={b.anahtar} title={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Badge tone={TON[b.ton].tone}>{b.sayi}</Badge>{b.baslik}</span>}>
                <div style={{ fontSize: 13, color: TON[b.ton].renk, fontWeight: 600 }}>{b.ozet}</div>
                {b.satirlar.length > 0 && <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>{b.satirlar.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>}
              </Card>))}
          </div>)}
        {o?.atlanan?.length > 0 && <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 14 }}>Yetkiniz olmadığı için bazı bölümler bu görünümde yer almıyor ({o.atlanan.join(', ')}). Gönderilen özet tüm veriyi kapsar.</p>}
        <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 10 }}>Özet yalnızca kayıtlardan hesaplanır: onaylı ve vadesi geçmiş ödenmemiş faturalar, 7 gün içindeki çek/senet ve vadeler, kritik stok, teslim tarihini geçen siparişler, 24 saatten eski yanıtsız başvurular.</p>
      </Page>
      {toast.node}
    </div>
  )
}
