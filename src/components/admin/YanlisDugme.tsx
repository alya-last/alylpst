'use client'
import { useState } from 'react'
import { aiIstek } from '@/lib/ai-client'

/** Cevabın altındaki "Yanlış / Doğru" geri bildirimi — kayıt ai_soru_kayit tablosuna işlenir. */
export default function YanlisDugme({ id }: { id?: string | null }) {
  const [durum, setDurum] = useState<'yanlis' | 'dogru' | null>(null)
  const [hata, setHata] = useState(false)
  if (!id) return null
  async function gonder(d: 'yanlis' | 'dogru') {
    let not: string | undefined
    if (d === 'yanlis') { const n = window.prompt('Neresi yanlış? (isteğe bağlı kısa not)'); if (n === null) return; not = n || undefined }
    try { await aiIstek('geri_bildirim', { id, durum: d, not }); setDurum(d); setHata(false) } catch { setHata(true) }
  }
  if (durum) return <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)', marginTop: 4 }}>{durum === 'yanlis' ? 'Yanlış olarak işaretlendi, incelenecek.' : 'Teşekkürler.'}</div>
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10.5 }}>
      <button type="button" className="adm-btn-ghost" style={{ padding: '2px 8px', fontSize: 10.5 }} onClick={() => gonder('dogru')}>👍 Doğru</button>
      <button type="button" className="adm-btn-ghost" style={{ padding: '2px 8px', fontSize: 10.5 }} onClick={() => gonder('yanlis')}>👎 Yanlış</button>
      {hata && <span style={{ color: 'var(--adm-tx3)' }}>Kaydedilemedi</span>}
    </div>
  )
}
