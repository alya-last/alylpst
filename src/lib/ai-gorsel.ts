import { AiHata } from '@/lib/ai'
import { guvenliUrl } from '@/lib/mevzuat-takip'

// Ürün görselini AI ile yeniden tasarlar (OpenAI Images edit uçu — gpt-image-1).
// OPENAI_MODEL metin/görsel-analiz için kullanılır; görsel ÜRETİMİ ayrı bir model gerektirir.
export const IMAGE_MODEL = () => process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'

export const GORSEL_STIL = { studyo: 'Stüdyo', yasam: 'Yaşam alanı' } as const
export type GorselStil = keyof typeof GORSEL_STIL

const PROMPT: Record<GorselStil, string> = {
  studyo: 'Replace only the background of this product photo with a clean, professional e-commerce studio backdrop: soft neutral gradient, subtle ground shadow, high-end product photography lighting. Do NOT alter the product itself in any way — keep its exact shape, color, proportions, angle, texture, and every detail identical to the source image.',
  yasam: 'Replace only the background of this product photo by placing the product into a realistic, tasteful lifestyle setting appropriate for its everyday use (e.g. a home, garden, patio or workspace), with soft natural lighting, shot like a professional product photograph. Do NOT alter the product itself in any way — keep its exact shape, color, proportions, angle, texture, and every detail identical to the source image.',
}

/** Kaynak görseli (https URL) indirir, OpenAI'ye gönderir, sonucu base64 PNG olarak döner (henüz kaydetmez). */
export async function gorselTasarla(imageUrl: string, stil: GorselStil): Promise<string> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new AiHata('AI özelliği yapılandırılmamış (OPENAI_API_KEY tanımlı değil).', 503)
  if (!/^https:\/\//.test(imageUrl)) throw new AiHata('Görsel adresi https olmalı.', 400)
  if (!(stil in PROMPT)) throw new AiHata('Geçersiz stil.', 400)

  let kaynak: ArrayBuffer
  let kaynakTip = 'image/png'
  try {
    // SSRF koruması: yalnızca genel https adresleri, yönlendirme yok, indirmeden önce boyut kontrolü
    const hedef = guvenliUrl(imageUrl)
    if (!hedef) throw new Error('adres geçersiz')
    const r = await fetch(hedef, { signal: AbortSignal.timeout(15000), redirect: 'error' })
    if (!r.ok) throw new Error(String(r.status))
    if (Number(r.headers.get('content-length') || 0) > 15 * 1024 * 1024) throw new Error('çok büyük')
    kaynakTip = r.headers.get('content-type')?.split(';')[0] || kaynakTip
    kaynak = await r.arrayBuffer()
  } catch {
    throw new AiHata('Kaynak görsel indirilemedi.', 400)
  }
  if (kaynak.byteLength > 15 * 1024 * 1024) throw new AiHata('Kaynak görsel çok büyük (15MB üstü).', 400)
  if (!/^image\//.test(kaynakTip)) throw new AiHata('Kaynak dosya bir görsel değil.', 400)

  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const form = new FormData()
  form.append('model', IMAGE_MODEL())
  form.append('image', new Blob([kaynak], { type: kaynakTip }), 'kaynak.png')
  form.append('prompt', PROMPT[stil])
  form.append('size', '1024x1024')
  form.append('n', '1')

  let res: Response
  try {
    res = await fetch(`${base}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(50000) })
  } catch (e: any) {
    throw new AiHata(e?.name === 'TimeoutError' ? 'AI görsel üretimi zaman aşımına uğradı.' : 'AI servisine ulaşılamadı.', 504)
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    console.error('[ai-gorsel] OpenAI hata', res.status, t.slice(0, 500))
    if (res.status === 401) throw new AiHata('OpenAI API anahtarı geçersiz.', 502)
    if (res.status === 429) throw new AiHata('OpenAI kotası/istek limiti doldu, biraz sonra tekrar deneyin.', 429)
    throw new AiHata('Görsel üretimi başarısız oldu.', 502)
  }
  const j = await res.json().catch(() => null)
  const b64 = j?.data?.[0]?.b64_json
  if (!b64 || typeof b64 !== 'string') throw new AiHata('AI görsel döndürmedi.', 502)
  return b64
}
