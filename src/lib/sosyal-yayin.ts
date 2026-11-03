import crypto from 'crypto'
import { AiHata } from '@/lib/ai'
import { guvenliUrl } from '@/lib/mevzuat-takip'
import { IMAGE_MODEL } from '@/lib/ai-gorsel'

// Sosyal medya: ChatGPT (OpenAI Images) ile görsel üretimi ve Upload-Post ile LinkedIn / Instagram paylaşımı.
// Gizli değerler yalnızca Vercel ortam değişkenlerindedir: OPENAI_API_KEY, UPLOADPOST_API_KEY, UPLOADPOST_USER.

export const FORMAT = { kare: '1024x1024', dikey: '1024x1536', linkedin: '1536x1024' } as const
export type SosyalFormat = keyof typeof FORMAT
export const FORMAT_AD: Record<SosyalFormat, string> = { kare: 'Kare 1:1 (Instagram)', dikey: 'Dikey 4:5 (Instagram)', linkedin: 'Yatay (LinkedIn)' }

const KORU = 'CRITICAL: The product in the reference photo must stay exactly the same object — identical silhouette, proportions, color, surface texture, rim, base and every molded detail. Do not redraw, recolor or restyle the product itself; only change what is around it.'
const GENEL = 'Photorealistic, professional B2B marketing photo for a global audience. Do NOT put any text, letters, numbers, logos, watermarks or captions inside the image.'

export const uploadPostHazir = () => !!process.env.UPLOADPOST_API_KEY && !!process.env.UPLOADPOST_USER

/** Yönergeden görsel üretir (kaynak ürün fotoğrafı varsa onu referans alır). PNG baytları döner. */
export async function sosyalGorselUret(yonerge: string, format: SosyalFormat, kaynakUrl?: string | null): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new AiHata('AI özelliği yapılandırılmamış (OPENAI_API_KEY tanımlı değil).', 503)
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const prompt = `${yonerge.trim()}\n\n${kaynakUrl ? KORU + '\n' : ''}${GENEL}`
  let res: Response
  try {
    if (kaynakUrl) {
      const hedef = guvenliUrl(kaynakUrl)
      if (!hedef) throw new AiHata('Ürün görsel adresi geçersiz.', 400)
      const r = await fetch(hedef, { signal: AbortSignal.timeout(15000), redirect: 'error' })
      if (!r.ok) throw new AiHata(`Ürün görseli indirilemedi (${r.status}).`, 400)
      const tip = r.headers.get('content-type')?.split(';')[0] || 'image/png'
      if (!/^image\//.test(tip)) throw new AiHata('Ürün görseli bir resim değil.', 400)
      const buf = await r.arrayBuffer()
      if (buf.byteLength > 15 * 1024 * 1024) throw new AiHata('Ürün görseli çok büyük.', 400)
      const form = new FormData()
      form.append('model', IMAGE_MODEL()); form.append('prompt', prompt); form.append('size', FORMAT[format]); form.append('quality', 'medium'); form.append('n', '1')
      form.append('image', new Blob([buf], { type: tip }), `urun.${tip === 'image/jpeg' ? 'jpg' : tip === 'image/webp' ? 'webp' : 'png'}`)
      res = await fetch(`${base}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(55000) })
    } else {
      res = await fetch(`${base}/images/generations`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: IMAGE_MODEL(), prompt, size: FORMAT[format], quality: 'medium', n: 1 }), signal: AbortSignal.timeout(55000) })
    }
  } catch (e: any) {
    if (e instanceof AiHata) throw e
    throw new AiHata(e?.name === 'TimeoutError' ? 'AI görsel üretimi zaman aşımına uğradı, tekrar deneyin.' : 'AI servisine ulaşılamadı.', 504)
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    console.error('[sosyal-gorsel] OpenAI hata', res.status, t.slice(0, 400))
    let ayrinti = ''; try { ayrinti = String(JSON.parse(t)?.error?.message || '').slice(0, 200) } catch { /* yoksay */ }
    if (res.status === 429) throw new AiHata('OpenAI istek limiti doldu, biraz sonra tekrar deneyin.', 429)
    throw new AiHata(`Görsel üretimi başarısız (${res.status}${ayrinti ? ': ' + ayrinti : ''})`, 502)
  }
  const j: any = await res.json().catch(() => null)
  const b64 = j?.data?.[0]?.b64_json
  if (typeof b64 !== 'string' || !b64) throw new AiHata('AI görsel döndürmedi.', 502)
  return Buffer.from(b64, 'base64')
}

export type YayinSonuc = { ok: boolean; url?: string | null; bekliyor?: boolean; requestId?: string; zamanlandi?: boolean; jobId?: string; hata?: string }

/** Upload-Post'a tek platform için gönderir. Idempotency-Key ile aynı içeriğin çift paylaşımı engellenir. */
export async function uploadPostGonder(o: { platform: 'linkedin' | 'instagram'; metin: string; baslik: string; gorsel: Buffer | null; zaman?: { tarih: string; saat: string } }): Promise<YayinSonuc> {
  const key = process.env.UPLOADPOST_API_KEY, user = process.env.UPLOADPOST_USER
  if (!key || !user) return { ok: false, hata: 'Upload-Post yapılandırılmamış (UPLOADPOST_API_KEY, UPLOADPOST_USER).' }
  if (o.platform === 'instagram' && !o.gorsel) return { ok: false, hata: 'Instagram paylaşımı için görsel gerekli.' }
  const form = new FormData()
  form.append('user', user); form.append('platform[]', o.platform); form.append('title', o.metin)
  if (o.platform === 'linkedin') { form.append('description', o.metin); form.append('linkedin_title', o.baslik.slice(0, 200)) }
  if (o.zaman) { form.append('scheduled_date', `${o.zaman.tarih}T${o.zaman.saat}:00`); form.append('timezone', 'Europe/Istanbul') }
  if (o.gorsel) form.append('photos[]', new Blob([new Uint8Array(o.gorsel)], { type: 'image/png' }), 'gorsel.png')
  const idem = crypto.createHash('sha256').update(`${o.platform}|${o.zaman ? o.zaman.tarih + 'T' + o.zaman.saat : ''}|${o.metin}|${o.gorsel ? crypto.createHash('sha256').update(o.gorsel).digest('hex') : ''}`).digest('hex').slice(0, 48)
  let res: Response
  try {
    res = await fetch(`https://api.upload-post.com/api/${o.gorsel ? 'upload_photos' : 'upload_text'}`, { method: 'POST', headers: { Authorization: `Apikey ${key}`, 'Idempotency-Key': idem }, body: form, signal: AbortSignal.timeout(58000) })
  } catch (e: any) {
    return { ok: false, hata: e?.name === 'TimeoutError' ? 'Upload-Post yanıt vermedi. Paylaşılmış olabilir: Upload-Post panelini kontrol edin, sonra tekrar denemeyin.' : 'Upload-Post’a ulaşılamadı.' }
  }
  const j: any = await res.json().catch(() => null)
  if (!res.ok || !j || j.success === false) {
    const msg = String(j?.message || j?.error || `HTTP ${res.status}`).slice(0, 240)
    return { ok: false, hata: res.status === 429 ? `Upload-Post aylık limiti doldu (${msg})` : res.status === 401 ? 'Upload-Post API anahtarı geçersiz.' : msg }
  }
  if (j.job_id && !j.results) return { ok: true, zamanlandi: true, jobId: String(j.job_id).slice(0, 120) }
  if (j.request_id && !j.results) return { ok: true, bekliyor: true, requestId: String(j.request_id).slice(0, 80) }
  const r = j.results?.[o.platform]
  if (!r) return { ok: false, hata: 'Upload-Post sonucu okunamadı.' }
  if (r.skipped) return { ok: false, hata: `${o.platform === 'linkedin' ? 'LinkedIn' : 'Instagram'} hesabı Upload-Post profilinde bağlı değil.` }
  if (r.success === false) return { ok: false, hata: String(r.error || r.message || 'Paylaşım başarısız').slice(0, 240) }
  const url = typeof r.url === 'string' && /^https:\/\/[^\s]+$/.test(r.url) ? r.url.slice(0, 500) : null
  return { ok: true, url }
}

/** Zamanlanmış (henüz yayınlanmamış) paylaşımı Upload-Post'ta iptal eder. */
export async function uploadPostIptal(jobId: string): Promise<{ ok: boolean; hata?: string }> {
  const key = process.env.UPLOADPOST_API_KEY
  if (!key) return { ok: false, hata: 'Upload-Post yapılandırılmamış.' }
  if (!/^[\w-]{3,120}$/.test(jobId)) return { ok: false, hata: 'İş kimliği geçersiz.' }
  try {
    const res = await fetch(`https://api.upload-post.com/api/uploadposts/schedule/${encodeURIComponent(jobId)}`, { method: 'DELETE', headers: { Authorization: `Apikey ${key}` }, signal: AbortSignal.timeout(20000) })
    if (res.ok) return { ok: true }
    const j: any = await res.json().catch(() => null)
    return { ok: false, hata: String(j?.message || j?.error || `HTTP ${res.status}`).slice(0, 200) }
  } catch { return { ok: false, hata: 'Upload-Post’a ulaşılamadı.' } }
}
