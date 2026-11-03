import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { pushAcikAnahtar, adminPushGonder } from '@/lib/push'

// Yalnızca yönetim yetkisi olan kullanıcılar. Tüm okuma/yazma kullanıcının kendi oturumuyla (RLS) yapılır.
export async function GET(req: NextRequest) {
  const y = await modulGerekli(['yonetim']); if (y.hata) return y.hata
  if (req.nextUrl.searchParams.get('son')) {
    const { data } = await y.sb.from('push_bildirimleri').select('baslik,metin,url,created_at').gte('created_at', new Date(Date.now() - 10 * 60000).toISOString()).order('created_at', { ascending: false }).limit(1)
    return NextResponse.json({ bildirim: data?.[0] || null })
  }
  const { data: abone } = await y.sb.from('push_abonelikleri').select('id', { count: 'exact', head: false }).limit(1)
  return NextResponse.json({ anahtar: pushAcikAnahtar(), abone: (abone?.length || 0) > 0 })
}

export async function POST(req: NextRequest) {
  const y = await modulGerekli(['yonetim']); if (y.hata) return y.hata
  let b: any; try { b = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  if (b?.test) { await adminPushGonder('Alya Admin', 'Test bildirimi: bildirimler bu cihazda çalışıyor.'); return NextResponse.json({ ok: true }) }
  const endpoint = typeof b?.endpoint === 'string' ? b.endpoint : ''
  if (!endpoint.startsWith('https://') || endpoint.length > 1000) return NextResponse.json({ error: 'Geçersiz abonelik' }, { status: 400 })
  const { error } = await y.sb.from('push_abonelikleri').upsert({ user_id: y.user.id, endpoint, cihaz: String(req.headers.get('user-agent') || '').slice(0, 200) }, { onConflict: 'endpoint' })
  if (error) return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const y = await modulGerekli(['yonetim']); if (y.hata) return y.hata
  let b: any; try { b = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  if (typeof b?.endpoint !== 'string') return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  await y.sb.from('push_abonelikleri').delete().eq('endpoint', b.endpoint)
  return NextResponse.json({ ok: true })
}
