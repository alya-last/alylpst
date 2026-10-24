'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sifreKontrol, sizdirilmisMi, SIZDIRILMIS_HATA } from '@/lib/sifre-kurali'

export default function ResetPasswordPage() {
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    // Supabase, e-postadaki bağlantıdan gelen recovery token'ı otomatik olarak
    // oturuma işler (@supabase/ssr) — burada sadece oturumun kurulmasını bekliyoruz.
    const sb = createClient()
    sb.auth.getSession().then(({ data }) => { setHasSession(!!data.session); setReady(true) })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    const kural = sifreKontrol(pass); if (kural) { setErr(kural); return }
    if (pass !== pass2) { setErr('Şifreler eşleşmiyor.'); return }
    setLoading(true)
    if (await sizdirilmisMi(pass)) { setLoading(false); setErr(SIZDIRILMIS_HATA); return }
    const { error } = await createClient().auth.updateUser({ password: pass })
    setLoading(false)
    if (error) setErr('Bir hata oluştu, bağlantının süresi dolmuş olabilir. Tekrar deneyin.')
    else setOk(true)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--adm-bg)', padding:16 }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--adm-tx)', letterSpacing:'-.3px', margin:0 }}>Yeni Şifre Belirle</h1>
        </div>

        {ok ? (
          <div className="adm-card" style={{ padding:28, textAlign:'center' }}>
            <p style={{fontSize:13,color:'var(--adm-tx)',marginBottom:16}}>Şifren güncellendi.</p>
            <a href="/admin/login" className="adm-btn" style={{justifyContent:'center'}}>Giriş Yap</a>
          </div>
        ) : !ready ? (
          <p style={{textAlign:'center',fontSize:12.5,color:'var(--adm-tx3)'}}>Yükleniyor...</p>
        ) : !hasSession ? (
          <div className="adm-card" style={{ padding:28, textAlign:'center' }}>
            <p style={{fontSize:13,color:'var(--adm-tx)',marginBottom:16}}>Bu bağlantı geçersiz veya süresi dolmuş. Giriş sayfasından &quot;Şifremi unuttum&quot; ile yeni bağlantı isteyin.</p>
            <a href="/admin/login" className="adm-btn" style={{justifyContent:'center'}}>Giriş Sayfası</a>
          </div>
        ) : (
          <form onSubmit={submit} className="adm-card" style={{ padding:28 }}>
            <div style={{ marginBottom:16 }}>
              <label className="adm-label">Yeni Şifre</label>
              <input type="password" className="adm-inp" value={pass} onChange={e=>setPass(e.target.value)} placeholder="En az 12 karakter, harf ve rakam" required />
            </div>
            <div style={{ marginBottom:20 }}>
              <label className="adm-label">Yeni Şifre (Tekrar)</label>
              <input type="password" className="adm-inp" value={pass2} onChange={e=>setPass2(e.target.value)} required />
            </div>
            {err && <p style={{ color:'var(--adm-red)', fontSize:12.5, marginBottom:14, textAlign:'center' }}>{err}</p>}
            <button type="submit" className="adm-btn" disabled={loading} style={{ width:'100%', justifyContent:'center', padding:'10px 0' }}>
              {loading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
