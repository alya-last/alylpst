import crypto from 'crypto'

// n8n entegrasyonu ortak yardımcıları. Gizli değerler yalnızca Vercel ortam değişkenlerinde tutulur ve yönler ayrıdır:
//   N8N_SOSYAL_API_TOKEN        : n8n → bu site (Authorization: Bearer)
//   N8N_SOSYAL_WEBHOOK_URL/SECRET: bu site → n8n (x-alya-secret)
// (Mevcut WhatsApp bildirimlerinin N8N_WEBHOOK_SECRET değeriyle karışmaz.)
const sha = (s: string) => crypto.createHash('sha256').update(s).digest()

/** Authorization: Bearer <secret> başlığını zamanlama saldırısına dayanıklı biçimde doğrular. */
export function n8nYetkili(authorization: string | null, secret: string | undefined = process.env.N8N_SOSYAL_API_TOKEN): 'ok' | 'yok' | 'kapali' {
  if (!secret || secret.length < 32) return 'kapali'
  const m = /^Bearer (.+)$/.exec(authorization || '')
  if (!m) return 'yok'
  return crypto.timingSafeEqual(sha(m[1]), sha(secret)) ? 'ok' : 'yok'
}

export type SosyalSatir = { id: string; baslik: string; platform: string; metin: string; hashtagler: string[] | null; planlanan_tarih: string | null; durum: string; urun_id: string | null; notlar?: string | null }
export type UrunKisa = { name: string; image_url: string | null; images: string[] | null } | null

/** n8n'in doğrudan kullanacağı düz yapı. tam_metin = metin + hashtagler (paylaşıma hazır). */
export function gonderiPaketi(r: SosyalSatir, urun: UrunKisa) {
  const etiketler = (r.hashtagler || []).map(h => '#' + h)
  const gorsel = [urun?.image_url, ...(urun?.images || [])].find(u => typeof u === 'string' && /^https:\/\//.test(u)) || null
  return {
    id: r.id, baslik: r.baslik, platform: r.platform, planlanan_tarih: r.planlanan_tarih, durum: r.durum,
    metin: r.metin, hashtagler: etiketler, tam_metin: etiketler.length ? `${r.metin}\n\n${etiketler.join(' ')}` : r.metin,
    urun_adi: urun?.name ?? null, gorsel_url: gorsel,
  }
}

/** Giden webhook adresi: yalnızca https, IP adresi/localhost/iç ağ adı yasak (SSRF önlemi). */
export function guvenliWebhookUrl(u: string | undefined): URL | null {
  if (!u) return null
  let x: URL; try { x = new URL(u) } catch { return null }
  const h = x.hostname.toLowerCase()
  if (x.protocol !== 'https:' || x.username || x.password) return null
  if (h === 'localhost' || !h.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':') || /\.(local|internal|lan|localhost)$/.test(h)) return null
  return x
}
