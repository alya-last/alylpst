import { AiHata } from '@/lib/ai'
import { guvenliUrl } from '@/lib/mevzuat-takip'

// Ürün görselini AI ile yeniden tasarlar (OpenAI Images edit uçu — gpt-image-1).
// OPENAI_MODEL metin/görsel-analiz için kullanılır; görsel ÜRETİMİ ayrı bir model gerektirir.
// gpt-image-1 OpenAI tarafından kapatıldı (23 Ekim 2026) — eski değer ortam değişkeninde kalmış olsa bile gpt-image-2 kullanılır.
export const IMAGE_MODEL = () => {
  const m = process.env.OPENAI_IMAGE_MODEL
  return m && m !== 'gpt-image-1' ? m : 'gpt-image-2'
}

export const GORSEL_STIL = { studyo: 'Stüdyo', yasam: 'Yaşam alanı' } as const
export type GorselStil = keyof typeof GORSEL_STIL

// Ortak kural: ürün piksel piksel aynı kalmalı; yalnızca çevresi değişir. Ürün kadrajın ana öznesi olmalı (küçük/uzak kalmasın).
const KORU = 'CRITICAL: The product in the photo must stay exactly the same object — identical silhouette, proportions, color, surface texture, rim, base, drainage holes, saucer and every molded detail. Do not redraw, restyle, recolor, resize, tilt, crop or duplicate it, and do not add or remove any part of it. Keep the whole product fully visible, centered, filling about 65–75% of the frame height, with its base resting naturally on a surface. No text, logos, watermarks, people or hands.'
const PROMPT: Record<GorselStil, string> = {
  studyo: `Keep this product photo exactly as is and replace ONLY the background with a clean, professional e-commerce studio backdrop: seamless soft light-grey to white gradient, a soft natural contact shadow under the product, even high-end product photography lighting. ${KORU}`,
  yasam: `Keep this product exactly as is and place it into a tasteful, realistic lifestyle scene suited to its use (bright home interior, patio or garden), with a softly blurred background, natural window light and a believable contact shadow. Only one simple, uncluttered setting; props must stay small, behind or beside the product and never overlap it. Photorealistic professional product photography, the product is the clear hero. ${KORU}`,
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
  form.append('quality', 'high')
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
