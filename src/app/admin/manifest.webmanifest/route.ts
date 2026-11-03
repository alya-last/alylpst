export const dynamic = 'force-static'
export function GET() {
  return Response.json({
    name: 'Alya Admin', short_name: 'Alya Admin', description: 'Alya Plastik yönetim bildirimleri',
    id: '/admin/', start_url: '/admin/dashboard', scope: '/admin/', display: 'standalone',
    background_color: '#0f172a', theme_color: '#0f172a', lang: 'tr',
    icons: [
      { src: '/admin/ikon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/admin/ikon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/admin/ikon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json' } })
}
