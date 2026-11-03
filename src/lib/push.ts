import { createPrivateKey, createSign } from 'node:crypto'
import { supabaseAdmin } from '@/lib/notify'

// Yalnızca yönetici (admin) cihazlarına web push. Mesaj içeriği push ile TAŞINMAZ (boş push gönderilir);
// servis çalışanı metni, kullanıcının kendi oturumuyla /api/admin/push'tan (RLS: yönetim) çeker.
// Ortam: VAPID_PUBLIC_KEY (ham P-256 açık anahtar, base64url), VAPID_PRIVATE_KEY (d, base64url), VAPID_SUBJECT (mailto:…)
export function pushAcikAnahtar() { return process.env.VAPID_PUBLIC_KEY || '' }

function b64u(b: Buffer | string) { return Buffer.from(b).toString('base64url') }

function vapidJwt(endpoint: string) {
  const pub = process.env.VAPID_PUBLIC_KEY!, d = process.env.VAPID_PRIVATE_KEY!
  const raw = Buffer.from(pub, 'base64url')
  const key = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d, x: b64u(raw.subarray(1, 33)), y: b64u(raw.subarray(33, 65)) }, format: 'jwk' })
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const body = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: process.env.VAPID_SUBJECT || 'mailto:info@alyaplastik.com' }))
  const sig = createSign('SHA256').update(`${head}.${body}`).sign({ key, dsaEncoding: 'ieee-p1363' })
  return `${head}.${body}.${b64u(sig)}`
}

export async function adminPushGonder(baslik: string, metin: string, url = '/admin/dashboard') {
  try {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return
    const sb = supabaseAdmin()
    const { error: e0 } = await sb.from('push_bildirimleri').insert({ baslik: baslik.slice(0, 120), metin: metin.slice(0, 400), url: url.startsWith('/admin/') ? url : '/admin/dashboard' })
    if (e0) throw e0
    const { data: abonelikler } = await sb.from('push_abonelikleri').select('id,endpoint').limit(200)
    await Promise.allSettled((abonelikler || []).map(async a => {
      try {
        const r = await fetch(a.endpoint, {
          method: 'POST',
          headers: { Authorization: `vapid t=${vapidJwt(a.endpoint)}, k=${process.env.VAPID_PUBLIC_KEY}`, TTL: '3600', Urgency: 'normal', 'Content-Length': '0' },
          signal: AbortSignal.timeout(8000),
        })
        if (r.status === 404 || r.status === 410) await sb.from('push_abonelikleri').delete().eq('id', a.id)
        else if (!r.ok) console.error('[push]', r.status)
      } catch (e) { console.error('[push] gönderim', (e as Error).message) }
    }))
  } catch (e) { console.error('[push] hata:', (e as Error).message) }
}
