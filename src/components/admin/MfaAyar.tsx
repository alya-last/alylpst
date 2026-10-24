'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal, Badge } from '@/components/admin/erp/ui'
import { ShieldCheck } from 'lucide-react'

type Faktor = { id: string; status: string; friendly_name?: string | null }
const bildir = (olay: string) => { fetch('/api/admin/olay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ olay }) }).catch(() => {}) }

// Oturumdaki kullanıcının kendi iki adımlı doğrulamasını (TOTP: Google/Microsoft Authenticator, Authy, 1Password vb.) açıp kapatması.
export default function MfaAyar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [yuk, setYuk] = useState(true)
  const [faktor, setFaktor] = useState<Faktor | null>(null)   // doğrulanmış faktör
  const [kurulum, setKurulum] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [kod, setKod] = useState('')
  const [hata, setHata] = useState('')
  const [tamam, setTamam] = useState('')
  const [busy, setBusy] = useState(false)

  const yukle = useCallback(async () => {
    setYuk(true); setHata('')
    const { data, error } = await createClient().auth.mfa.listFactors()
    if (error) setHata('Doğrulama durumu okunamadı.')
    setFaktor((data?.totp || []).find(f => f.status === 'verified') || null); setYuk(false)
  }, [])
  useEffect(() => { if (open) { setKurulum(null); setKod(''); setTamam(''); yukle() } }, [open, yukle])

  async function baslat() {
    if (busy) return; setBusy(true); setHata(''); setTamam('')
    const sb = createClient()
    // Yarım kalmış (doğrulanmamış) eski denemeleri temizle
    const { data: l } = await sb.auth.mfa.listFactors()
    for (const f of (l?.all || []).filter(x => x.status === 'unverified')) await sb.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', issuer: 'Alya Plastik', friendlyName: `Panel ${new Date().toLocaleDateString('tr-TR')}` })
    setBusy(false)
    if (error || !data) return setHata(error?.message.includes('enabled') ? 'İki adımlı doğrulama Supabase projesinde kapalı görünüyor.' : 'Kurulum başlatılamadı, tekrar deneyin.')
    setKurulum({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }
  async function dogrulaKur(e: React.FormEvent) {
    e.preventDefault(); if (busy || !kurulum) return
    if (!/^\d{6}$/.test(kod)) return setHata('6 haneli kodu girin.')
    setBusy(true); setHata('')
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: kurulum.id, code: kod })
    setBusy(false)
    if (error) { setKod(''); return setHata('Kod hatalı veya süresi dolmuş. Uygulamadaki güncel kodu girin.') }
    setKurulum(null); setKod(''); setTamam('İki adımlı doğrulama açıldı. Bir sonraki girişte şifrenizden sonra uygulamadaki 6 haneli kod istenecek.'); bildir('mfa_acildi'); yukle()
  }
  async function kapat(e: React.FormEvent) {
    e.preventDefault(); if (busy || !faktor) return
    if (!/^\d{6}$/.test(kod)) return setHata('Kapatmak için güncel 6 haneli kodu girin.')
    setBusy(true); setHata('')
    const sb = createClient()
    const v = await sb.auth.mfa.challengeAndVerify({ factorId: faktor.id, code: kod })
    if (v.error) { setBusy(false); setKod(''); return setHata('Kod hatalı veya süresi dolmuş.') }
    const { error } = await sb.auth.mfa.unenroll({ factorId: faktor.id })
    setBusy(false); setKod('')
    if (error) return setHata('Kapatılamadı, tekrar deneyin.')
    setTamam('İki adımlı doğrulama kapatıldı.'); bildir('mfa_kapandi'); yukle()
  }

  return (
    <Modal open={open} onClose={onClose} width={440} title="İki Adımlı Doğrulama" footer={<button type="button" className="adm-btn-ghost" onClick={onClose}>Kapat</button>}>
      {yuk ? <p style={{ fontSize: 13, color: 'var(--adm-tx3)' }}>Yükleniyor…</p> : (
        <div style={{ display: 'grid', gap: 12, fontSize: 13.5, lineHeight: 1.6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><ShieldCheck size={16} /><b>Durum:</b> {faktor ? <Badge tone="green">Açık</Badge> : <Badge tone="amber">Kapalı</Badge>}</div>
          {tamam && <p style={{ margin: 0, color: 'var(--adm-green)' }}>✓ {tamam}</p>}
          {hata && <p style={{ margin: 0, color: 'var(--adm-red)' }}>⚠ {hata}</p>}

          {!faktor && !kurulum && <>
            <p style={{ margin: 0 }}>Şifrenizi bir başkası öğrense bile panele giremez: girişte telefonunuzdaki uygulamadan 6 haneli bir kod da istenir. Yönetici hesapları için önerilir.</p>
            <p style={{ margin: 0, color: 'var(--adm-tx3)', fontSize: 12.5 }}>Önce telefonunuza bir doğrulayıcı uygulama kurun (Google Authenticator, Microsoft Authenticator, Authy veya 1Password).</p>
            <button type="button" className="adm-btn" disabled={busy} onClick={baslat}>{busy ? 'Hazırlanıyor…' : 'Etkinleştir'}</button>
          </>}

          {kurulum && <form onSubmit={dogrulaKur} style={{ display: 'grid', gap: 10 }}>
            <p style={{ margin: 0 }}>1. Uygulamada <b>hesap ekle</b> deyip bu QR kodu okutun.</p>
            <div style={{ textAlign: 'center', background: '#fff', padding: 10 }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={kurulum.qr} alt="QR" width={190} height={190} style={{ display: 'inline-block' }} /></div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--adm-tx3)' }}>QR okutamıyorsanız anahtarı elle girin: <code style={{ userSelect: 'all', wordBreak: 'break-all' }}>{kurulum.secret}</code></p>
            <p style={{ margin: 0 }}>2. Uygulamada görünen 6 haneli kodu yazın:</p>
            <input className="adm-inp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus placeholder="123456" value={kod} onChange={e => setKod(e.target.value.replace(/\D/g, ''))} style={{ letterSpacing: 6, textAlign: 'center', fontSize: 18 }} />
            <div style={{ display: 'flex', gap: 8 }}><button type="button" className="adm-btn-ghost" onClick={async () => { await createClient().auth.mfa.unenroll({ factorId: kurulum.id }).catch(() => {}); setKurulum(null); setKod(''); setHata('') }}>Vazgeç</button><button className="adm-btn" disabled={busy || kod.length !== 6}>{busy ? 'Doğrulanıyor…' : 'Doğrula ve aç'}</button></div>
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--adm-amber)' }}>Telefonunuzu kaybederseniz tam yetkili bir yönetici doğrulamanızı Kullanıcılar sayfasından sıfırlayabilir; bunun için yedek bir tam yetkili yönetici hesabınız bulunsun.</p>
          </form>}

          {faktor && <form onSubmit={kapat} style={{ display: 'grid', gap: 8 }}>
            <p style={{ margin: 0 }}>Kapatmak için uygulamadaki güncel kodu girin:</p>
            <input className="adm-inp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={kod} onChange={e => setKod(e.target.value.replace(/\D/g, ''))} style={{ letterSpacing: 6, textAlign: 'center', fontSize: 18 }} />
            <button className="adm-btn-danger" disabled={busy || kod.length !== 6}>{busy ? 'Kapatılıyor…' : 'İki adımlı doğrulamayı kapat'}</button>
          </form>}
        </div>)}
    </Modal>
  )
}
