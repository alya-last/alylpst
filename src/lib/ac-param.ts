'use client'
import { useEffect, useRef } from 'react'

// Muhasebe Kontrolleri uyarılarından gelen bağlantılar (?ac=<kayıt id>) ilgili kaydı otomatik açar.
// ready: sayfa verisi yüklendiğinde true olmalı. fn bir kez çağrılır; parametre adres çubuğundan silinir.
export function useAcParam(ready: boolean, fn: (id: string) => void) {
  const yapildi = useRef(false)
  useEffect(() => {
    if (!ready || yapildi.current) return
    const id = new URLSearchParams(window.location.search).get('ac')
    if (!id) return
    yapildi.current = true
    fn(id)
    const u = new URL(window.location.href); u.searchParams.delete('ac'); window.history.replaceState(null, '', u.pathname + u.search)
  }) // eslint-disable-line react-hooks/exhaustive-deps
}
