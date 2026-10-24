'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'
import { web } from '@/lib/web-data'

type Kart = { id: string; ad_soyad: string; sicil_no: string; departman: string | null; qr: string }

function Kartlar() {
  const sp = useSearchParams()
  const [kartlar, setKartlar] = useState<Kart[] | null>(null)
  const [hata, setHata] = useState('')
  useEffect(() => {
    (async () => {
      const ids = (sp.get('ids') || '').split(',').filter(x => /^[0-9a-f-]{36}$/.test(x)).slice(0, 200)
      if (!ids.length) { setHata('Kart seçilmedi.'); return }
      const { data, error } = await web.from('personel').select('id,ad_soyad,sicil_no,departman,qr_token').in('id', ids).order('ad_soyad')
      if (error) { setHata(error.message); return }
      setKartlar(await Promise.all((data || []).map(async (p: any) => ({ id: p.id, ad_soyad: p.ad_soyad, sicil_no: p.sicil_no, departman: p.departman, qr: await QRCode.toDataURL('ALYA1:' + p.qr_token, { margin: 1, width: 300, errorCorrectionLevel: 'M' }) }))))
    })()
  }, [sp])

  if (hata) return <p style={{ padding: 24 }}>{hata}</p>
  if (!kartlar) return <p style={{ padding: 24 }}>Hazırlanıyor…</p>
  return (
    <div style={{ background: '#fff', color: '#000', minHeight: '100vh', padding: 16, fontFamily: 'Arial, sans-serif' }}>
      <style>{`@media print { .no-print { display: none !important } body { background: #fff } @page { margin: 8mm } } .kart { width: 85.6mm; height: 54mm; border: 1px solid #000; display: flex; gap: 4mm; padding: 4mm; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid; align-items: center }`}</style>
      <div className="no-print" style={{ marginBottom: 12 }}><button onClick={() => window.print()} style={{ padding: '8px 16px', fontSize: 14 }}>Yazdır</button> <span style={{ fontSize: 12, marginLeft: 8 }}>{kartlar.length} kart · Kart boyutu 85,6×54 mm. QR gizli değer içerir; yalnızca sahibine verin.</span></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4mm' }}>
        {kartlar.map(k => (
          <div key={k.id} className="kart">
            <img src={k.qr} alt="" style={{ width: '40mm', height: '40mm' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, letterSpacing: '.12em', color: '#c2410c', fontWeight: 700 }}>ALYA PLASTİK</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, wordBreak: 'break-word' }}>{k.ad_soyad}</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Sicil: {k.sicil_no}</div>
              {k.departman && <div style={{ fontSize: 10, color: '#444' }}>{k.departman}</div>}
              <div style={{ fontSize: 8, color: '#666', marginTop: 8 }}>Personel giriş-çıkış kartı</div>
            </div>
          </div>))}
      </div>
    </div>
  )
}
export default function KartlarPage() { return <Suspense fallback={null}><Kartlar /></Suspense> }
