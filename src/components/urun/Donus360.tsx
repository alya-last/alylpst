'use client'
import { useRef, useState } from 'react'

// Sürükle/dokun ile kareler arasında geçiş yaparak "360° döner ürün" izlenimi veren basit görüntüleyici.
// Kareler AI ile üretilmiş bir dizi görsel URL'sidir (gerçek 3D model değildir).
export default function Donus360({ kareler, alt, className, style }: { kareler: string[]; alt: string; className?: string; style?: React.CSSProperties }) {
  const [i, setI] = useState(0)
  const surukluyorRef = useRef(false)
  const sonXRef = useRef(0)
  const birikimRef = useRef(0)
  const n = kareler.length
  const ADIM = 14 // px başına bir kare

  const basla = (x: number) => { surukluyorRef.current = true; sonXRef.current = x; birikimRef.current = 0 }
  const hareket = (x: number) => {
    if (!surukluyorRef.current) return
    const dx = x - sonXRef.current
    sonXRef.current = x
    birikimRef.current += dx
    while (birikimRef.current > ADIM) { setI(v => (v - 1 + n) % n); birikimRef.current -= ADIM }
    while (birikimRef.current < -ADIM) { setI(v => (v + 1) % n); birikimRef.current += ADIM }
  }
  const bitir = () => { surukluyorRef.current = false }

  if (!n) return null
  return (
    <div
      className={className}
      style={{ position: 'relative', cursor: n > 1 ? 'grab' : 'default', touchAction: 'pan-y', userSelect: 'none', ...style }}
      onMouseDown={e => basla(e.clientX)}
      onMouseMove={e => hareket(e.clientX)}
      onMouseUp={bitir}
      onMouseLeave={bitir}
      onTouchStart={e => basla(e.touches[0].clientX)}
      onTouchMove={e => hareket(e.touches[0].clientX)}
      onTouchEnd={bitir}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={kareler[i]} alt={alt} draggable={false} className="w-full h-full object-contain" style={{ pointerEvents: 'none' }} />
      {n > 1 && (
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', fontSize: 11, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 10px', borderRadius: 999, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          360° — sürükleyerek döndür
        </div>
      )}
    </div>
  )
}
