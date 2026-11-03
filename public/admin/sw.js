// Alya Admin — yalnızca bildirim servis çalışanı (önbellek/çevrimdışı yok)
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let b = { baslik: 'Alya Admin', metin: 'Yeni bildirim var.', url: '/admin/dashboard' }
    try { const r = await fetch('/api/admin/push?son=1', { credentials: 'same-origin' }); if (r.ok) { const j = await r.json(); if (j.bildirim) b = j.bildirim } } catch (_) {}
    await self.registration.showNotification(b.baslik, { body: b.metin, icon: '/admin/ikon-192.png', badge: '/admin/ikon-192.png', data: { url: b.url || '/admin/dashboard' }, tag: 'alya-admin' })
  })())
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/admin/dashboard'
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of list) { if (c.url.includes('/admin/') && 'focus' in c) { await c.focus(); if ('navigate' in c) try { await c.navigate(url) } catch (_) {} return } }
    await self.clients.openWindow(url)
  })())
})
