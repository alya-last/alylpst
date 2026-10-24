import { AiHata } from '@/lib/ai'
import { guvenliUrl } from '@/lib/mevzuat-takip'

// Ürün fotoğrafından AI ile "360° döner galeri" kareleri üretir (OpenAI Images edit — gpt-image-1).
// Not: Bu gerçek bir 3D model/mesh DEĞİLDİR — kaynak fotoğraftan, farklı açılardan çekilmiş gibi görünen
// karelerin AI ile türetilmesidir (üretici görüntü modeli gerçek arka yüzü "görmez", makul biçimde tahmin eder).
// Tek fotoğraftan gerçek 3D model üretimi çok daha yavaş/pahalı ve güvenilirliği düşüktür; bu yüzden
// müşteri tarafında "sürükle-döndür" izlenimi veren bu pratik yaklaşım tercih edilmiştir.
export const IMAGE_MODEL_360 = () => process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'

// Kare sayısı: çok fazlası hem maliyeti hem de tek istekte toplam süreyi arttırır (Vercel Hobby: 60sn fonksiyon sınırı).
// Kareler yine de PARALEL üretildiği için (bkz. Promise.allSettled altta) toplam süre kare sayısıyla değil,
// en yavaş tekil karenin süresiyle sınırlıdır — ama daha fazla eşzamanlı istek, OpenAI tarafında kuyruklanma/limit
// riskini de arttırır; bu yüzden 16 kare seçeneği "daha yavaş/başarısızlık riski biraz daha yüksek" olarak işaretlenir.
export type KareSayisi = 4 | 8 | 16
export type KareAcisi = number

/** Kare sayısına göre eşit aralıklı açı listesi üretir (0°, 360/n, 2*360/n, ...). */
export const kareAcilariUret = (n: KareSayisi): KareAcisi[] => Array.from({ length: n }, (_, i) => Math.round((i * 360) / n * 10) / 10)

/** Herhangi bir açı için doğal dilde (İngilizce) tutarlı bir kamera-konumu tarifi üretir. */
function aciTanimla(derece: KareAcisi): string {
  const d = ((derece % 360) + 360) % 360
  if (d === 0) return 'directly from the front'
  if (d === 180) return 'rotated 180 degrees on a turntable, directly from the back'
  const sagdanMi = d < 180
  const etkin = sagdanMi ? d : 360 - d
  const konum = etkin === 90 ? 'a direct side view' : etkin < 90 ? 'a three-quarter front view' : 'a three-quarter back view'
  return `rotated ${etkin} degrees to the ${sagdanMi ? 'right' : 'left'} on a turntable, ${konum}`
}

const promptUret = (acisi: KareAcisi) =>
  `This is a product photography turntable sequence. Show the SAME physical product as if the camera had walked around it and it is now seen ${aciTanimla(acisi)}, sitting in the exact same spot on a clean neutral studio turntable background with soft consistent lighting and a subtle ground shadow. ` +
  `Keep the product's exact shape, proportions, color, material, texture and every design detail completely consistent with the source photo — only the viewing angle changes. If a side or back cannot be seen in the source photo, infer a plausible, consistent continuation of the same product's design. Do not add any other objects, text, or watermarks.`

async function karateUret(kaynak: ArrayBuffer, kaynakTip: string, acisi: KareAcisi, key: string, base: string): Promise<string> {
  const form = new FormData()
  form.append('model', IMAGE_MODEL_360())
  form.append('image', new Blob([kaynak], { type: kaynakTip }), 'kaynak.png')
  form.append('prompt', promptUret(acisi))
  form.append('size', '1024x1024')
  form.append('n', '1')

  let res: Response
  try {
    res = await fetch(`${base}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(45000) })
  } catch (e: any) {
    throw new AiHata(e?.name === 'TimeoutError' ? `360° kare (${acisi}°) zaman aşımına uğradı.` : `360° kare (${acisi}°) için AI servisine ulaşılamadı.`, 504)
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    console.error('[ai-360] OpenAI hata', acisi, res.status, t.slice(0, 500))
    if (res.status === 401) throw new AiHata('OpenAI API anahtarı geçersiz.', 502)
    if (res.status === 429) throw new AiHata('OpenAI kotası/istek limiti doldu, biraz sonra tekrar deneyin.', 429)
    throw new AiHata(`360° kare (${acisi}°) üretimi başarısız oldu.`, 502)
  }
  const j = await res.json().catch(() => null)
  const b64 = j?.data?.[0]?.b64_json
  if (!b64 || typeof b64 !== 'string') throw new AiHata(`AI 360° kare (${acisi}°) döndürmedi.`, 502)
  return b64
}

export type Gorunum360Sonuc = { kareler: string[]; istenenKareSayisi: number; basarisiz: number }

/** Kaynak görseli indirir, seçilen açı sayısı kadar kareyi PARALEL üretir (Vercel süre sınırı nedeniyle). Kaydetmez.
 *  Bazı kareler başarısız olursa (zaman aşımı, geçici hata) tüm işlemi iptal ETMEZ — başarılı kareleri döndürür;
 *  yarıdan azı başarılıysa hata verir. */
export async function gorunum360Uret(imageUrl: string, kareSayisi: KareSayisi = 8): Promise<Gorunum360Sonuc> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new AiHata('AI özelliği yapılandırılmamış (OPENAI_API_KEY tanımlı değil).', 503)
  if (!/^https:\/\//.test(imageUrl)) throw new AiHata('Görsel adresi https olmalı.', 400)

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
  const acilar = kareAcilariUret(kareSayisi)
  // 0° kareyi tekrar üretmek yerine kaynak görselin kendisini ilk kare olarak kullanıyoruz (tutarlılık + maliyet).
  const digerleri = acilar.filter(a => a !== 0)
  // allSettled: tek bir karenin zaman aşımına uğraması/başarısız olması tüm galeriyi iptal etmesin —
  // başarılı kareler açıya göre sıralanıp döndürülür, kaynak görsel her zaman ilk kare olur.
  const sonuclar = await Promise.allSettled(digerleri.map(a => karateUret(kaynak, kaynakTip, a, key, base)))
  const basariliListe: { aci: number; b64: string }[] = []
  let basarisiz = 0
  sonuclar.forEach((s, i) => {
    if (s.status === 'fulfilled') basariliListe.push({ aci: digerleri[i], b64: s.value })
    else { basarisiz++; console.error('[ai-360] kare başarısız', digerleri[i], s.reason?.message || s.reason) }
  })
  if (basariliListe.length < Math.ceil(digerleri.length / 2)) {
    throw new AiHata(`360° karelerin çoğu üretilemedi (${basarisiz}/${digerleri.length} başarısız), lütfen tekrar deneyin.`, 502)
  }
  basariliListe.sort((a, b) => a.aci - b.aci)
  const ilkKareB64 = Buffer.from(kaynak).toString('base64')
  return { kareler: [ilkKareB64, ...basariliListe.map(b => b.b64)], istenenKareSayisi: kareSayisi, basarisiz }
}
