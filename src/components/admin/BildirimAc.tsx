'use client'
import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'

function anahtarDizi(b64: string) { const p = '='.repeat((4 - b64.length % 4) % 4); const r = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)) }

/** Bu cihazda yönetici push bildirimlerini açar/kapatır (yalnızca yönetim yetkisi olanlarda görünür). */
export default function BildirimAc() {
  const [durum, setDurum] = useState<'yok' | 'kapali' | 'acik' | 'reddedildi'>('yok')
  const [mesaj, setMesaj] = useState('')
  useEffect(() => {
    (async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
        const r = await fetch('/api/admin/push'); if (!r.ok) return   // yönetim yetkisi yoksa 403: düğme hiç görünmez
        if (Notification.permission === 'denied') { setDurum('reddedildi'); return }
        const reg = await navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' })
        const s = await reg.pushManager.getSubscription()
        setDurum(s && Notification.permission === 'granted' ? 'acik' : 'kapali')
      } catch { /* sessiz */ }
    })()
  }, [])
  if (durum === 'yok') return null
  async function ac() {
    try {
      const izin = await Notification.requestPermission(); if (izin !== 'granted') { setDurum('reddedildi'); return }
      const { anahtar } = await (await fetch('/api/admin/push')).json()
      if (!anahtar) { setMesaj('Sunucuda bildirim anahtarı tanımlı değil.'); return }
      const reg = await navigator.serviceWorker.ready
      const s = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: anahtar === '' ? undefined : anahtarDizi(anahtar) })
      const r = await fetch('/api/admin/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: s.endpoint }) })
      if (!r.ok) throw new Error()
      setDurum('acik'); setMesaj('Açıldı. Test gönderiliyor…')
      await fetch('/api/admin/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true }) })
    } catch { setMesaj('Bildirim açılamadı.') }
  }
  async function kapat() {
    try {
      const reg = await navigator.serviceWorker.ready; const s = await reg.pushManager.getSubscription()
      if (s) { await fetch('/api/admin/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: s.endpoint }) }); await s.unsubscribe() }
      setDurum('kapali'); setMesaj('')
    } catch { setMesaj('Kapatılamadı.') }
  }
  return (
    <button type="button" className="adm-btn-ghost" title={mesaj || (durum === 'reddedildi' ? 'Tarayıcı ayarlarından bildirim iznini açın' : durum === 'acik' ? 'Bu cihazda bildirimler açık (kapatmak için tıkla)' : 'Bu cihazda bildirimleri aç')}
      onClick={() => durum === 'acik' ? kapat() : durum === 'kapali' ? ac() : undefined}
      style={{ padding: '4px 8px', opacity: durum === 'acik' ? 1 : .6 }}>
      <BellRing size={15} />
    </button>
  )
}
