'use client'
import { useState } from 'react'
import { aiIstek } from '@/lib/ai-client'

/** Cevabın altındaki "Doğru / Yanlış" geri bildirimi. "Yanlış"ta açıklama alanı açılır; kayıt ai_soru_kayit tablosuna işlenir. */
export default function YanlisDugme({ id }: { id?: string | null }) {
  const [durum, setDurum] = useState<'yanlis' | 'dogru' | null>(null)
  const [acik, setAcik] = useState(false)
  const [not, setNot] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState(false)
  if (!id) return null
  async function gonder(d: 'yanlis' | 'dogru') {
    setYukleniyor(true); setHata(false)
    try { await aiIstek('geri_bildirim', { id, durum: d, not: d === 'yanlis' ? not.trim() || undefined : undefined }); setDurum(d); setAcik(false) } catch { setHata(true) }
    setYukleniyor(false)
  }
  if (durum) return <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)', marginTop: 4 }}>{durum === 'yanlis' ? 'Yanlış olarak işaretlendi, notun kaydedildi.' : 'Teşekkürler.'}</div>
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', gap: 8, fontSize: 10.5 }}>
        <button type="button" className="adm-btn-ghost" style={{ padding: '2px 8px', fontSize: 10.5 }} disabled={yukleniyor} onClick={() => gonder('dogru')}>👍 Doğru</button>
        <button type="button" className="adm-btn-ghost" style={{ padding: '2px 8px', fontSize: 10.5, ...(acik ? { outline: '1px solid var(--adm-ac)' } : {}) }} disabled={yukleniyor} onClick={() => setAcik(a => !a)}>👎 Yanlış</button>
        {hata && <span style={{ color: 'var(--adm-tx3)' }}>Kaydedilemedi, tekrar dene</span>}
      </div>
      {acik && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, maxWidth: 420 }}>
          <textarea className="adm-inp" rows={3} maxLength={1000} autoFocus value={not} onChange={e => setNot(e.target.value)}
            placeholder="Sorun ne? Örn: iç ve dış mekan ayrı yazmıyor, Ekim rakamı yanlış, Excel'deki ile tutmuyor…" style={{ resize: 'vertical', fontSize: 12 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="adm-btn" style={{ padding: '3px 12px', fontSize: 11.5 }} disabled={yukleniyor || !not.trim()} onClick={() => gonder('yanlis')}>{yukleniyor ? 'Gönderiliyor…' : 'Gönder'}</button>
            <button type="button" className="adm-btn-ghost" style={{ padding: '3px 12px', fontSize: 11.5 }} disabled={yukleniyor} onClick={() => { setAcik(false); setNot('') }}>Vazgeç</button>
          </div>
        </div>
      )}
    </div>
  )
}
