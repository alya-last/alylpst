'use client'

// Beklenmeyen bir hata olduğunda teknik ayrıntıyı (yığın izi, sorgu vb.) ziyaretçiye göstermez.
export default function Hata({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Bir sorun oluştu</h1>
        <p style={{ opacity: 0.7, marginBottom: 16 }}>Sayfa şu an açılamadı. Lütfen tekrar deneyin.</p>
        <button onClick={() => reset()} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid currentColor', background: 'transparent', cursor: 'pointer' }}>Tekrar dene</button>
      </div>
    </div>
  )
}
