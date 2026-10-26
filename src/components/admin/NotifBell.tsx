'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const sb = createClient()
type Bil = { id: string; tur: string; modul: string; baslik: string; mesaj: string | null; link: string | null; created_at: string }

const IKON: Record<string, string> = {
  uretim_emri_acildi: '🏭', uretim_emri_bitti: '✅', uretim_emri_durdu: '⏸️',
  yeni_siparis: '🧾', teklif_kabul: '🤝', kritik_stok: '⚠️', yeni_basvuru: '✉️',
}

function once(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60) return 'şimdi'
  if (d < 3600) return `${Math.floor(d / 60)} dk önce`
  if (d < 86400) return `${Math.floor(d / 3600)} sa önce`
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
}

// Panel içi bildirim zili: üretim emri açıldı/bitti, yeni sipariş, teklif onayı, kritik stok, yeni başvuru.
// Kayıtlar veritabanı tetikleyicileriyle oluşur; kişi yalnızca yetkili olduğu modüllerin bildirimlerini görür (RLS).
export default function NotifBell() {
  const [liste, setListe] = useState<Bil[]>([])
  const [son, setSon] = useState<string | null>(null)
  const [hazir, setHazir] = useState(false)
  const [acik, setAcik] = useState(false)
  const kutu = useRef<HTMLDivElement>(null)

  const yukle = useCallback(async () => {
    try {
      const [b, o] = await Promise.all([
        sb.from('panel_bildirimleri').select('id,tur,modul,baslik,mesaj,link,created_at').order('created_at', { ascending: false }).limit(30),
        sb.from('panel_bildirim_okuma').select('son_okuma').maybeSingle(),
      ])
      if (b.error) return
      setListe((b.data as Bil[]) || [])
      // İlk kez kullanan kişiye eski kayıtlar "okunmamış" gibi yığılmasın
      let s = (o.data as any)?.son_okuma as string | undefined
      if (!s) { s = new Date().toISOString(); await sb.from('panel_bildirim_okuma').upsert({ son_okuma: s }, { onConflict: 'user_id' }) }
      setSon(s)
      setHazir(true)
    } catch { /* ağ hatası: sessizce atla, sonraki turda yeniden denenir */ }
  }, [])

  useEffect(() => {
    yukle()
    const t = setInterval(yukle, 30000)
    const f = () => { if (document.visibilityState === 'visible') yukle() }
    document.addEventListener('visibilitychange', f)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', f) }
  }, [yukle])

  useEffect(() => {
    if (!acik) return
    const k = (e: MouseEvent) => { if (kutu.current && !kutu.current.contains(e.target as Node)) setAcik(false) }
    document.addEventListener('mousedown', k)
    return () => document.removeEventListener('mousedown', k)
  }, [acik])

  async function okundu() {
    const simdi = new Date().toISOString()
    setSon(simdi)
    try { await sb.from('panel_bildirim_okuma').upsert({ son_okuma: simdi }, { onConflict: 'user_id' }) } catch { /* yoksay */ }
  }

  if (!hazir) return null
  const okunmamis = son ? liste.filter(x => x.created_at > son).length : 0
  return (
    <div ref={kutu} style={{ position: 'relative', marginRight: 8 }}>
      <button className="adm-btn-ghost" onClick={() => setAcik(a => !a)} title="Bildirimler" aria-label="Bildirimler" style={{ position: 'relative', padding: '5px 9px' }}>
        <Bell size={15} />
        {okunmamis > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 9, background: 'var(--adm-red)', color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{okunmamis > 9 ? '9+' : okunmamis}</span>}
      </button>
      {acik && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 340, maxWidth: 'calc(100vw - 24px)', background: 'var(--adm-s1)', border: '1px solid var(--adm-bdr2)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,.18)', zIndex: 150, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--adm-bdr)' }}>
            <b style={{ fontSize: 13 }}>Bildirimler</b>
            {okunmamis > 0 && <button className="adm-btn-ghost" onClick={okundu} style={{ marginLeft: 'auto', fontSize: 11.5, padding: '3px 8px' }}>Tümünü okundu say</button>}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {liste.length === 0 && <p style={{ margin: 0, padding: '22px 14px', fontSize: 12.5, color: 'var(--adm-tx3)', textAlign: 'center' }}>Henüz bildirim yok. Üretim emri açıldığında, sipariş geldiğinde veya stok azaldığında burada görünür.</p>}
            {liste.map(x => {
              const yeni = !!son && x.created_at > son
              const ic = (
                <div style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--adm-bdr)', background: yeni ? 'var(--adm-s2)' : 'transparent' }}>
                  <span style={{ fontSize: 17, lineHeight: '20px' }}>{IKON[x.tur] || '🔔'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: yeni ? 700 : 600, wordBreak: 'break-word' }}>{x.baslik}</div>
                    {x.mesaj && <div style={{ fontSize: 12, color: 'var(--adm-tx2)', marginTop: 2, wordBreak: 'break-word' }}>{x.mesaj}</div>}
                    <div style={{ fontSize: 11, color: 'var(--adm-tx3)', marginTop: 3 }}>{once(x.created_at)}</div>
                  </div>
                  {yeni && <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--adm-ac)', marginTop: 6, flex: 'none' }} />}
                </div>
              )
              return x.link && x.link.startsWith('/admin/') ? <a key={x.id} href={x.link} onClick={okundu} style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>{ic}</a> : <div key={x.id}>{ic}</div>
            })}
          </div>
        </div>
      )}
    </div>
  )
}
