'use client'
import { useEffect, useState } from 'react'

// "Uygulamayı yükle" düğmesi: Android/Chrome'da doğrudan kurar, iPhone'da ekleme yolunu gösterir. Kuruluysa görünmez.
export default function UygulamaYukle() {
  const [ev, setEv] = useState<any>(null)
  const [ios, setIos] = useState(false)
  const [ac, setAc] = useState(false)
  useEffect(() => {
    const kurulu = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    if (kurulu) return
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    const h = (e: Event) => { e.preventDefault(); setEv(e) }
    window.addEventListener('beforeinstallprompt', h)
    window.addEventListener('appinstalled', () => setEv(null))
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])
  if (!ev && !ios) return null
  return (
    <>
      <button className="adm-btn" title="Uygulamayı yükle" onClick={async () => { if (ev) { ev.prompt(); await ev.userChoice; setEv(null) } else setAc(a => !a) }} style={{marginRight:6}}>📲 Uygulamayı yükle</button>
      {ac && <div role="dialog" style={{position:'fixed',top:60,right:12,zIndex:1000,background:'#fff',color:'#0f172a',padding:14,borderRadius:10,boxShadow:'0 8px 30px rgba(0,0,0,.25)',maxWidth:280,fontSize:14}}>
        iPhone'da: Safari'de alttaki <b>Paylaş</b> düğmesine, sonra <b>Ana Ekrana Ekle</b>'ye dokunun.
        <div style={{textAlign:'right',marginTop:8}}><button className="adm-btn" onClick={() => setAc(false)}>Tamam</button></div>
      </div>}
    </>
  )
}
