'use client'

export default function GlobalHata({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, textAlign: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22 }}>Bir sorun oluştu</h1>
          <p style={{ opacity: 0.7 }}>Lütfen sayfayı yenileyin.</p>
          <button onClick={() => reset()} style={{ padding: '8px 18px', borderRadius: 8, cursor: 'pointer' }}>Tekrar dene</button>
        </div>
      </body>
    </html>
  )
}
