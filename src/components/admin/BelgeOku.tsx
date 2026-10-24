'use client'
import { useRef, useState } from 'react'
import { ScanText } from 'lucide-react'
import { aiIstek } from '@/lib/ai-client'
import { belgeDataUrl } from '@/lib/belge-dosya'

export type BelgeSonuc = {
  belge_tipi: string; satici: string; belge_no: string; tarih: string; para_birimi: string
  kalemler: { aciklama: string; miktar: number | null; birim: string; birim_fiyat: number | null; kdv_orani: number | null; toplam: number | null }[]
  ara_toplam: number | null; kdv_tutari: number | null; genel_toplam: number | null; notlar: string; guven: 'yuksek' | 'orta' | 'dusuk'
}

// Fatura/irsaliye fotoğrafı veya PDF'inden AI ile veri çıkarır. Sonuç yalnızca forma doldurulur; kaydı kullanıcı onaylar.
export default function BelgeOku({ onSonuc, onHata }: { onSonuc: (b: BelgeSonuc) => void; onHata: (m: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function sec(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      const dosya = await belgeDataUrl(f)
      const r = await aiIstek<{ sonuc: BelgeSonuc }>('belge_oku', { dosya })
      onSonuc(r.sonuc)
    } catch (err: any) { onHata(err.message || 'Belge okunamadı') }
    setBusy(false)
  }

  return (
    <>
      <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} disabled={busy} onClick={() => ref.current?.click()}><ScanText size={13} />{busy ? 'Belge okunuyor…' : 'Belgeden oku (AI)'}</button>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={sec} style={{ display: 'none' }} />
    </>
  )
}
