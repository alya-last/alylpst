import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { oranSiniri } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/notify'
import { uploadPostGonder, uploadPostHazir, uploadPostIptal } from '@/lib/sosyal-yayin'

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
  const { data: r } = await y.sb.from('sosyal_gonderiler').select('id,baslik,platform,metin,hashtagler,durum,gorsel_yol,notlar,planlanan_tarih,planlanan_saat,yayin_sonuc').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Gönderi bulunamadı' }, { status: 404 })
  if (r.durum === 'paylasildi') return NextResponse.json({ error: 'Bu gönderi zaten paylaşılmış.' }, { status: 409 })
  const simdi0 = new Date().toISOString()
  if (b?.iptal === true) {
    const job = (r.yayin_sonuc as any)?.job_id
    if (r.durum !== 'zamanlandi' || !job) return NextResponse.json({ error: 'Zamanlanmış bir paylaşım yok.' }, { status: 400 })
    const i = await uploadPostIptal(String(job))
    if (!i.ok) return NextResponse.json({ error: `Zamanlama iptal edilemedi: ${i.hata}` }, { status: 502 })
    await y.sb.from('sosyal_gonderiler').update({ durum: 'taslak', yayin_sonuc: null, updated_at: simdi0 }).eq('id', id)
    return NextResponse.json({ ok: true, iptal: true })
  }
  if (r.durum === 'zamanlandi') return NextResponse.json({ error: 'Bu gönderi zaten zamanlanmış. Önce zamanlamayı iptal edin.' }, { status: 409 })
  const zamanla = b?.zamanla === true
  let zaman: { tarih: string; saat: string } | undefined
  if (zamanla) {
    const tarih = String(r.planlanan_tarih || ''), saat = String(r.planlanan_saat || '10:00')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return NextResponse.json({ error: 'Zamanlamak için gönderiye bir tarih verin.' }, { status: 400 })
    if (Date.parse(`${tarih}T${saat}:00+03:00`) < Date.now() + 5 * 60000) return NextResponse.json({ error: 'Tarih/saat geçmişte veya çok yakın. İleri bir zaman seçin.' }, { status: 400 })
    zaman = { tarih, saat }
  }
  if (r.platform !== 'linkedin' && r.platform !== 'instagram') return NextResponse.json({ error: 'Yalnızca LinkedIn ve Instagram paylaşımı destekleniyor.' }, { status: 400 })
  const etiket = (r.hashtagler || []).map((h: string) => '#' + h).join(' '), tam = etiket ? `${r.metin}\n\n${etiket}` : r.metin
  const sb = supabaseAdmin()
  let gorsel: Buffer | null = null
  if (r.gorsel_yol) {
    const { data, error } = await sb.storage.from('sosyal-gorseller').download(r.gorsel_yol)
    if (error || !data) return NextResponse.json({ error: 'Kayıtlı görsel okunamadı, yeniden üretin.' }, { status: 500 })
    gorsel = Buffer.from(await data.arrayBuffer())
  }
  const s = await uploadPostGonder({ platform: r.platform, metin: tam, baslik: r.baslik, gorsel, zaman })
  const simdi = new Date().toISOString(), z = simdi.slice(0, 16).replace('T', ' ')
  if (!s.ok) {
    await y.sb.from('sosyal_gonderiler').update({ notlar: [r.notlar, `[${z}] Paylaşım hatası: ${s.hata}`].filter(Boolean).join('\n').slice(-1000), updated_at: simdi }).eq('id', id)
    return NextResponse.json({ error: s.hata }, { status: 502 })
  }
  if (s.zamanlandi) {
    await y.sb.from('sosyal_gonderiler').update({ durum: 'zamanlandi', yayin_sonuc: { job_id: s.jobId, tarih: zaman?.tarih, saat: zaman?.saat, zaman: simdi }, updated_at: simdi }).eq('id', id)
    return NextResponse.json({ ok: true, zamanlandi: true, mesaj: `Onaylandı: ${zaman?.tarih.split('-').reverse().join('.')} ${zaman?.saat} (İstanbul) tarihinde kendiliğinden paylaşılacak.` })
  }
  if (s.bekliyor) {
    await y.sb.from('sosyal_gonderiler').update({ yayin_sonuc: { request_id: s.requestId, zaman: simdi }, notlar: [r.notlar, `[${z}] Upload-Post arka planda işliyor (${s.requestId}). Sonucu Upload-Post panelinden doğrulayın.`].filter(Boolean).join('\n').slice(-1000), updated_at: simdi }).eq('id', id)
    return NextResponse.json({ ok: true, bekliyor: true, mesaj: 'Upload-Post paylaşımı arka planda işliyor. Birkaç dakika sonra Upload-Post panelinden doğrulayın.' })
  }
  await y.sb.from('sosyal_gonderiler').update({ durum: 'paylasildi', paylasim_url: s.url || null, yayin_sonuc: { zaman: simdi, url: s.url || null }, updated_at: simdi }).eq('id', id)
  return NextResponse.json({ ok: true, url: s.url || null })
}
