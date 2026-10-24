import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { supabaseAdmin } from '@/lib/notify'

// Admin panelinden yüklenen GERÇEK 3D model dosyaları (glb/gltf/obj/stl/fbx) — AI ile üretilmez,
// kullanıcı kendi ürettiği dosyayı yükler. Dosya büyük olabileceği için (birkaç MB - onlarca MB)
// bayt verisi bu route üzerinden GEÇMEZ (Vercel fonksiyon istek boyutu sınırına takılmasın diye):
// tarayıcı, burada üretilen imzalı bir yükleme adresine DOĞRUDAN Supabase Storage'a yükler.
export const BUCKET = 'urun-3d-modelleri'
export const IZINLI_UZANTILAR = ['glb', 'gltf', 'obj', 'stl', 'fbx'] as const
const MAX_BOYUT = 50 * 1024 * 1024 // 50MB

function uzantiCikar(ad: string): string | null {
  const m = /\.([a-zA-Z0-9]+)$/.exec(ad.trim())
  const u = m?.[1]?.toLowerCase() || null
  return u && (IZINLI_UZANTILAR as readonly string[]).includes(u) ? u : null
}

export async function POST(req: NextRequest) {
  const y = await modulGerekli(['yonetim']); if (y.hata) return y.hata
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const eylem = String(b.eylem || '')
  const urunId = String(b.urun_id || '')
  if (!/^[0-9a-f-]{36}$/.test(urunId)) return NextResponse.json({ error: 'Ürün geçersiz' }, { status: 400 })

  // Ürünün bu kullanıcıya görünür olduğunu kendi oturumuyla (RLS) doğrula
  const { data: urun } = await y.sb.from('products').select('id,model_3d_url').eq('id', urunId).maybeSingle()
  if (!urun) return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 })

  const admin = supabaseAdmin()

  if (eylem === 'imza') {
    const dosyaAdi = String(b.dosyaAdi || '')
    const uzanti = uzantiCikar(dosyaAdi)
    if (!uzanti) return NextResponse.json({ error: `Desteklenmeyen dosya türü. İzin verilenler: ${IZINLI_UZANTILAR.join(', ')}` }, { status: 400 })
    const boyut = Number(b.boyut) || 0
    if (boyut > MAX_BOYUT) return NextResponse.json({ error: 'Dosya çok büyük (50MB üstü).' }, { status: 400 })
    const yol = `${urunId}/${Date.now()}.${uzanti}`
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(yol)
    if (error || !data) { console.error('[urun-3d][imza]', error?.message); return NextResponse.json({ error: 'Yükleme adresi oluşturulamadı.' }, { status: 502 }) }
    return NextResponse.json({ ok: true, path: data.path, token: data.token })
  }

  if (eylem === 'kaydet') {
    const yol = String(b.path || '')
    if (!yol.startsWith(`${urunId}/`)) return NextResponse.json({ error: 'Geçersiz dosya yolu' }, { status: 400 })
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(yol)
    // Eski dosyayı sil (varsa) — depoda birikmesin
    const eskiUrl = urun.model_3d_url
    const { error } = await admin.from('products').update({ model_3d_url: pub.publicUrl, updated_at: new Date().toISOString() }).eq('id', urunId)
    if (error) { console.error('[urun-3d][kaydet]', error.message); return NextResponse.json({ error: 'Ürün güncellenemedi.' }, { status: 500 }) }
    if (eskiUrl) {
      const eskiYol = eskiUrl.split(`/${BUCKET}/`)[1]
      if (eskiYol) await admin.storage.from(BUCKET).remove([eskiYol]).catch(() => {})
    }
    return NextResponse.json({ ok: true, url: pub.publicUrl })
  }

  return NextResponse.json({ error: 'Geçersiz eylem' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const y = await modulGerekli(['yonetim']); if (y.hata) return y.hata
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const urunId = String(b.urun_id || '')
  if (!/^[0-9a-f-]{36}$/.test(urunId)) return NextResponse.json({ error: 'Ürün geçersiz' }, { status: 400 })
  const { data: urun } = await y.sb.from('products').select('id,model_3d_url').eq('id', urunId).maybeSingle()
  if (!urun) return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 })

  const admin = supabaseAdmin()
  const { error } = await admin.from('products').update({ model_3d_url: null, updated_at: new Date().toISOString() }).eq('id', urunId)
  if (error) { console.error('[urun-3d][DELETE]', error.message); return NextResponse.json({ error: 'Ürün güncellenemedi.' }, { status: 500 }) }
  if (urun.model_3d_url) {
    const eskiYol = urun.model_3d_url.split(`/${BUCKET}/`)[1]
    if (eskiYol) await admin.storage.from(BUCKET).remove([eskiYol]).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
