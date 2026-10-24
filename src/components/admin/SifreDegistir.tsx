'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal, Field } from '@/components/admin/erp/ui'

import { MIN_SIFRE, sifreKontrol, sizdirilmisMi, SIZDIRILMIS_HATA } from '@/lib/sifre-kurali'

// Oturumdaki kullanıcının kendi şifresini değiştirmesi. Güvenlik için mevcut şifre yeniden doğrulanır;
// değişiklikten sonra diğer cihazlardaki oturumlar kapatılır.
export default function SifreDegistir({ open, onClose, email }: { open: boolean; onClose: () => void; email: string }) {
  const [mevcut, setMevcut] = useState('')
  const [yeni, setYeni] = useState('')
  const [yeni2, setYeni2] = useState('')
  const [hata, setHata] = useState('')
  const [tamam, setTamam] = useState(false)
  const [busy, setBusy] = useState(false)

  const kapat = () => { setMevcut(''); setYeni(''); setYeni2(''); setHata(''); setTamam(false); onClose() }

  async function kaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    setHata('')
    const kural = sifreKontrol(yeni); if (kural) return setHata(kural)
    if (yeni !== yeni2) return setHata('Yeni şifreler eşleşmiyor.')
    if (yeni === mevcut) return setHata('Yeni şifre mevcut şifreyle aynı olamaz.')
    setBusy(true)
    if (await sizdirilmisMi(yeni)) { setBusy(false); return setHata(SIZDIRILMIS_HATA) }
    const sb = createClient()
    const dogrula = await sb.auth.signInWithPassword({ email, password: mevcut })
    if (dogrula.error) { setBusy(false); return setHata('Mevcut şifre hatalı.') }
    const { error } = await sb.auth.updateUser({ password: yeni })
    if (error) { setBusy(false); return setHata(error.message.includes('weak') || error.message.includes('Password') ? 'Bu şifre kabul edilmedi (çok zayıf veya bilinen bir şifre olabilir).' : 'Şifre değiştirilemedi, tekrar deneyin.') }
    await sb.auth.signOut({ scope: 'others' }).catch(() => {}) // diğer cihazlardaki oturumları kapat
    fetch('/api/admin/olay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ olay: 'sifre_degisti' }) }).catch(() => {})
    setBusy(false); setTamam(true)
  }

  return (
    <Modal open={open} onClose={kapat} onSubmit={tamam ? undefined : kaydet} width={420} title="Şifre Değiştir"
      footer={tamam
        ? <button type="button" className="adm-btn" onClick={kapat}>Tamam</button>
        : <><button type="button" className="adm-btn-ghost" onClick={kapat}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Şifreyi Değiştir'}</button></>}>
      {tamam ? (
        <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>Şifren güncellendi. Diğer cihazlardaki oturumların kapatıldı; bir sonraki girişte yeni şifreni kullan.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Mevcut şifre"><input type="password" className="adm-inp" autoFocus required autoComplete="current-password" value={mevcut} onChange={e => setMevcut(e.target.value)} /></Field>
          <Field label="Yeni şifre" hint={`En az ${MIN_SIFRE} karakter, harf ve rakam; 123456 gibi kolay şifreler kabul edilmez`}><input type="password" className="adm-inp" required autoComplete="new-password" value={yeni} onChange={e => setYeni(e.target.value)} /></Field>
          <Field label="Yeni şifre (tekrar)"><input type="password" className="adm-inp" required autoComplete="new-password" value={yeni2} onChange={e => setYeni2(e.target.value)} /></Field>
          {hata && <p style={{ color: 'var(--adm-red)', fontSize: 12.5, margin: 0 }}>⚠ {hata}</p>}
        </div>
      )}
    </Modal>
  )
}
