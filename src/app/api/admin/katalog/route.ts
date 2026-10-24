import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { supabaseAdmin } from '@/lib/notify'

// Admin panelinden yüklenen PDF katalog (dijital flipbook, /katalog sayfasında gösterilir).
// Dosya büyük olabileceği için (birkaç MB - onlarca MB) bayt verisi bu route üzerinden GEÇMEZ
// (Vercel fonksiyon istek boyutu sınırına takılmasın diye): tarayıcı, burada üretilen imzalı bir
// yükleme adresine DOĞRUDAN Supabase Storage'a yükler. Tek bir global kayıt olduğu için (ürüne
// bağlı değil) settings.katalog'da tutulur — ürün 3D modellerindeki imza/kaydet akışıyla aynı desen.
export const BUCKET = 'katalog-dosyalari'
const MAX_BOYUT = 150 * 1024 * 1024 // 150MB

export async function POST(req: NextRequest) {
  const y = await modulGerekli(['yonetim']); if (y.hata) return y.hata
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const eylem = String(b.eylem || '')
  const admin = supabaseAdmin()

  if (eylem === 'imza') {
    const dosyaAdi = String(b.dosyaAdi || '')
    if (!/\.pdf$/i.test(dosyaAdi.trim())) return NextResponse.json({ error: 'Yalnızca PDF dosyası yüklenebilir.' }, { status: 400 })
    const boyut = Number(b.boyut) || 0
    if (boyut > MAX_BOYUT) return NextResponse.json({ error: 'Dosya çok büyük (150MB üstü).' }, { status: 400 })
    const yol = `katalog-${Date.now()}.pdf`
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(yol)
    if (error || !data) { console.error('[katalog][imza]', error?.message); return NextResponse.json({ error: 'Yükleme adresi oluşturulamadı.' }, { status: 502 }) }
    return NextResponse.json({ ok: true, path: data.path, token: data.token })
  }

  if (eylem === 'kaydet') {
    const yol = String(b.path || '')
    if (!/^katalog-\d+\.pdf$/.test(yol)) return NextResponse.json({ error: 'Geçersiz dosya yolu' }, { status: 400 })
    const boyut = Number(b.boyut) || undefined
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(yol)
    // Eski dosyayı al (silmek için) — depoda birikmesin
    const { data: eski } = await admin.from('settings').select('value').eq('key', 'katalog').maybeSingle()
    const eskiUrl: string | undefined = eski?.value?.url
    const deger = { url: pub.publicUrl, boyut, guncellenme: new Date().toISOString() }
    const { error } = await admin.from('settings').upsert({ key: 'katalog', value: deger })
    if (error) { console.error('[katalog][kaydet]', error.message); return NextResponse.json({ error: 'Ayar kaydedilemedi.' }, { status: 500 }) }
    if (eskiUrl && eskiUrl !== pub.publicUrl) {
      const eskiYol = eskiUrl.split(`/${BUCKET}/`)[1]
      if (eskiYol) await admin.storage.from(BUCKET).remove([eskiYol]).catch(() => {})
    }
    return NextResponse.json({ ok: true, deger })
  }

  return NextResponse.json({ error: 'Geçersiz eylem' }, { status: 400 })
}

export async function DELETE() {
  const y = await modulGerekli(['yonetim']); if (y.hata) return y.hata
  const admin = supabaseAdmin()
  const { data: eski } = await admin.from('settings').select('value').eq('key', 'katalog').maybeSingle()
  const eskiUrl: string | undefined = eski?.value?.url
  const { error } = await admin.from('settings').delete().eq('key', 'katalog')
  if (error) { console.error('[katalog][DELETE]', error.message); return NextResponse.json({ error: 'Ayar silinemedi.' }, { status: 500 }) }
  if (eskiUrl) {
    const eskiYol = eskiUrl.split(`/${BUCKET}/`)[1]
    if (eskiYol) await admin.storage.from(BUCKET).remove([eskiYol]).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
