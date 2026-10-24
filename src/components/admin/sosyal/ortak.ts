export type Platform = 'linkedin' | 'instagram' | 'facebook'
export const PLATFORM: Record<Platform, { l: string; renk: string; limit: number }> = {
  linkedin: { l: 'LinkedIn', renk: '#0a66c2', limit: 3000 },
  instagram: { l: 'Instagram', renk: '#c13584', limit: 2200 },
  facebook: { l: 'Facebook', renk: '#1877f2', limit: 63206 },
}
export const DURUM: Record<string, { l: string; tone: any }> = { taslak: { l: 'Taslak', tone: 'muted' }, planlandi: { l: 'Planlandı', tone: 'blue' }, paylasildi: { l: 'Paylaşıldı', tone: 'green' } }
export const AMAC: Record<string, string> = { urun: 'Ürün tanıtımı', ihracat: 'İhracat', uretim: 'Üretim ve kalite', kurumsal: 'Kurumsal / tecrübe', ozel_siparis: 'Özel sipariş', fuar: 'Duyuru (fuar / katalog)' }
export const bugunTR = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)
export const gunEkle = (t: string, n: number) => new Date(Date.parse(t + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
export const tarihTR = (t: string) => t ? t.split('-').reverse().join('.') : ''
export const etiketMetni = (h: string[]) => (h || []).map(x => '#' + x).join(' ')
export const tamMetin = (metin: string, h: string[]) => h?.length ? `${metin}\n\n${etiketMetni(h)}` : metin
/** Hashtag girdisini temizler: "#Saksı, plastik saksi" → ['saksı','plastik','saksi'] */
export const etiketAyikla = (s: string) => Array.from(new Set(s.split(/[\s,]+/).map(x => x.replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase()).filter(Boolean))).slice(0, 15)
/** Bir sonraki paylaşım günü: salı/perşembe (B2B için haftada 2), verilen tarihten sonra */
export function sonrakiGun(sonra: string) {
  let t = gunEkle(sonra, 1)
  for (let i = 0; i < 8; i++) { const d = new Date(t + 'T00:00:00Z').getUTCDay(); if (d === 2 || d === 4) return t; t = gunEkle(t, 1) }
  return t
}
export async function panoyaKopyala(s: string) {
  try { await navigator.clipboard.writeText(s); return true } catch { return false }
}
