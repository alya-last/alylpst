import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { oranSiniri } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/notify'
import { uploadPostGonder, uploadPostHazir } from '@/lib/sosyal-yayin'

export const maxDuration = 60
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// GET → Upload-Post bağlantısı yapılandırıldı mı?
export async function GET() {
  const y = await modulGerekli(['sosyal', 'yonetim']); if (y.hata) return y.hata
  return NextResponse.json({ hazir: uploadPostHazir() })
}

// POST {id} → onaylanan gönderiyi Upload-Post ile LinkedIn / Instagram'da yayınlar; başarılıysa "Paylaşıldı" işaretler.
export async function POST(req: NextRequest) {
  const y = await modulGerekli(['sosyal', 'yonetim']); if (y.hata) return y.hata
  if (!uploadPostHazir()) return NextResponse.json({ error: 'Upload-Post bağlantısı henüz yapılandırılmamış (UPLOADPOST_API_KEY, UPLOADPOST_USER).' }, { status: 503 })
  if (!(await oranSiniri(`sosyalyayin:${y.user.id}`, 30, 3600, false))) return NextResponse.json({ error: 'Saatlik paylaşım sınırına ulaşıldı.' }, { status: 429 })
  let b: any; try { b = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  const id = String(b?.id || ''); if (!ID.test(id)) return NextResponse.json({ error: 'id geçersiz' }, { status: 400 })
  const { data: r } = await y.sb.from('sosyal_gonderiler').select('id,baslik,platform,metin,hashtagler,durum,gorsel_yol,notlar').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Gönderi bulunamadı' }, { status: 404 })
  if (r.durum === 'paylasildi') return NextResponse.json({ error: 'Bu gönderi zaten paylaşılmış.' }, { status: 409 })
  if (r.platform !== 'linkedin' && r.platform !== 'instagram') return NextResponse.json({ error: 'Yalnızca LinkedIn ve Instagram paylaşımı destekleniyor.' }, { status: 400 })
  const etiket = (r.hashtagler || []).map((h: string) => '#' + h).join(' '), tam = etiket ? `${r.metin}\n\n${etiket}` : r.metin
  const sb = supabaseAdmin()
  let gorsel: Buffer | null = null
  if (r.gorsel_yol) {
    const { data, error } = await sb.storage.from('sosyal-gorseller').download(r.gorsel_yol)
    if (error || !data) return NextResponse.json({ error: 'Kayıtlı görsel okunamadı, yeniden üretin.' }, { status: 500 })
    gorsel = Buffer.from(await data.arrayBuffer())
  }
  const s = await uploadPostGonder({ platform: r.platform, metin: tam, baslik: r.baslik, gorsel })
  const simdi = new Date().toISOString(), z = simdi.slice(0, 16).replace('T', ' ')
  if (!s.ok) {
    await y.sb.from('sosyal_gonderiler').update({ notlar: [r.notlar, `[${z}] Paylaşım hatası: ${s.hata}`].filter(Boolean).join('\n').slice(-1000), updated_at: simdi }).eq('id', id)
    return NextResponse.json({ error: s.hata }, { status: 502 })
  }
  if (s.bekliyor) {
    await y.sb.from('sosyal_gonderiler').update({ yayin_sonuc: { request_id: s.requestId, zaman: simdi }, notlar: [r.notlar, `[${z}] Upload-Post arka planda işliyor (${s.requestId}). Sonucu Upload-Post panelinden doğrulayın.`].filter(Boolean).join('\n').slice(-1000), updated_at: simdi }).eq('id', id)
    return NextResponse.json({ ok: true, bekliyor: true, mesaj: 'Upload-Post paylaşımı arka planda işliyor. Birkaç dakika sonra Upload-Post panelinden doğrulayın.' })
  }
  await y.sb.from('sosyal_gonderiler').update({ durum: 'paylasildi', paylasim_url: s.url || null, yayin_sonuc: { zaman: simdi, url: s.url || null }, updated_at: simdi }).eq('id', id)
  return NextResponse.json({ ok: true, url: s.url || null })
}
