export const dynamic = 'force-static'
export function GET() {
  return Response.json({
    name: 'Alya Plastik Yönetim', short_name: 'Alya Admin', description: 'Alya Plastik yönetim paneli ve bildirimleri',
    id: '/admin/', start_url: '/admin/dashboard', scope: '/admin/', display: 'standalone',
    display_override: ['standalone', 'minimal-ui'], orientation: 'any', categories: ['business', 'productivity'],
    background_color: '#0f172a', theme_color: '#0f172a', lang: 'tr',
    icons: [
      { src: '/admin/ikon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/admin/ikon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/admin/ikon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Canlı Üretim', url: '/admin/dashboard/uretim/canli' },
      { name: 'Makineler', url: '/admin/dashboard/uretim/makine' },
      { name: 'Üretim Emirleri', url: '/admin/dashboard/uretim/emirler' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json' } })
}
