'use client'
import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

// Bir tablo 20.000 satırlık istemci sınırını aşarsa, rakamlar sessizce yanlış çıkmasın diye uyarır.
export default function TruncationBanner() {
  const [tablolar, setTablolar] = useState<string[]>([])
  const [kapali, setKapali] = useState(false)
  useEffect(() => {
    const h = (e: Event) => { const t = (e as CustomEvent).detail?.table; if (t) setTablolar(l => (l.includes(t) ? l : [...l, t])) }
    window.addEventListener('adm:truncated', h); return () => window.removeEventListener('adm:truncated', h)
  }, [])
  if (!tablolar.length || kapali) return null
  return (
    <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 900, maxWidth: 560, width: 'calc(100% - 32px)', background: 'var(--adm-tx)', color: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 12px 36px rgba(0,0,0,.35)', display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.5 }}>
      <AlertTriangle size={17} style={{ color: '#f0a843', flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}><b>Veri çok büyük — sonuçlar eksik olabilir.</b><br />{tablolar.join(', ')} tablosu 20.000 satırı aştı; bu sayfadaki toplam/liste yalnızca ilk 20.000 kaydı kapsıyor. Filtreyi daraltın veya bu ekranın sunucu tarafı (sayfalı) sürümünü kullanın.</div>
      <button onClick={() => setKapali(true)} style={{ background: 'none', border: 'none', color: '#fff', padding: 2 }}><X size={15} /></button>
    </div>
  )
}
