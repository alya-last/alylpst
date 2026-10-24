'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Oturum başına bir kez ziyaret kaydı gönderir (admin sayfaları hariç).
export default function VisitTracker() {
  const pathname = usePathname()
  useEffect(() => {
    if (pathname.startsWith('/admin') || pathname.startsWith('/kiosk')) return
    try {
      if (sessionStorage.getItem('alya_visit')) return
      sessionStorage.setItem('alya_visit', '1')
    } catch {}
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: pathname, referrer: document.referrer }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])
  return null
}
