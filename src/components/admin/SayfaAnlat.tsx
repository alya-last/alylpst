'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { HelpCircle, X, Send } from 'lucide-react'
import { aiIstek } from '@/lib/ai-client'

// Her panel sayfasında sağ altta "Bu sayfayı anlat" düğmesi: yapay zekâ sayfanın ne işe yaradığını sade dille anlatır.
export default function SayfaAnlat() {
  const yol = usePathname() || ''
  const [acik, setAcik] = useState(false)
  const [yanit, setYanit] = useState('')
  const [yuk, setYuk] = useState(false)
  const [hata, setHata] = useState('')
  const [soru, setSoru] = useState('')
  const [son, setSon] = useState('')

  async function sor(s?: string) {
    setYuk(true); setHata('')
    try {
      const r = await aiIstek<{ yanit: string }>('sayfa_anlat', { yol, soru: s || '' })
      setYanit(r.yanit); setSon(yol + '|' + (s || ''))
    } catch (e: any) { setHata(e.message || 'Anlatılamadı') }
    setYuk(false)
  }
  function ac() {
    const yeni = !acik; setAcik(yeni)
    if (yeni && !yuk && son !== yol + '|') sor()
  }

  return (
    <>
      <button type="button" onClick={ac} aria-label="Bu sayfayı anlat" className="adm-sa-btn no-print">
        <HelpCircle size={18} /> <span>Bu sayfayı anlat</span>
      </button>
      {acik && (
        <div className="adm-sa-panel no-print" role="dialog" aria-label="Sayfa anlatımı">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <b style={{ fontSize: 14 }}>Bu sayfa ne işe yarar?</b>
            <button type="button" onClick={() => setAcik(false)} aria-label="Kapat" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--adm-tx2)' }}><X size={16} /></button>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '45vh', overflowY: 'auto', color: 'var(--adm-tx)' }}>
            {yuk ? 'Yapay zekâ anlatıyor…' : hata ? <span style={{ color: 'var(--adm-red, #dc2626)' }}>{hata}</span> : yanit}
          </div>
          <form onSubmit={e => { e.preventDefault(); const s = soru.trim(); if (s && !yuk) { sor(s); setSoru('') } }} style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <input value={soru} onChange={e => setSoru(e.target.value)} placeholder="Bu sayfayla ilgili sorun var mı?" aria-label="Soru" style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--adm-bdr)', background: 'var(--adm-s1)', color: 'var(--adm-tx)', fontSize: 13 }} />
            <button type="submit" disabled={yuk} className="adm-btn" aria-label="Sor"><Send size={14} /></button>
          </form>
        </div>
      )}
      <style>{`
        .adm-sa-btn { position: fixed; right: 18px; bottom: 18px; z-index: 30; display: inline-flex; align-items: center; gap: 7px; padding: 10px 15px; border-radius: 999px; border: none; cursor: pointer; background: var(--adm-ac); color: #fff; font-size: 13px; font-weight: 600; box-shadow: 0 6px 20px rgba(0,0,0,.25); }
        .adm-sa-panel { position: fixed; right: 18px; bottom: 70px; z-index: 31; width: min(380px, calc(100vw - 36px)); padding: 14px; border-radius: 14px; background: var(--adm-s1); border: 1px solid var(--adm-bdr); box-shadow: 0 12px 36px rgba(0,0,0,.3); }
        @media (max-width: 600px) { .adm-sa-btn span { display: none; } }
        @media print { .no-print { display: none !important; } }
      `}</style>
    </>
  )
}
