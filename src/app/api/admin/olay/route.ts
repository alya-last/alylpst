import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { istemciIp, oranSiniri } from '@/lib/rate-limit'
import { ISTEMCI_OLAYLARI, yoneticiOlayi, type Olay } from '@/lib/olay'

// Tarayıcıda yapılan (sunucudan geçmeyen) hesap değişikliklerini bildirir: şifre değişti, 2FA açıldı/kapandı.
// Kimlik oturumdan alınır (istemci başka biri adına olay üretemez); yalnızca beyaz listedeki olaylar kabul edilir.
export async function POST(req: NextRequest) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 })
  if (!(await oranSiniri(`olay:${user.id}`, 10, 3600, false))) return NextResponse.json({ error: 'Çok fazla istek' }, { status: 429 })
  let b: any; try { b = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  if (!ISTEMCI_OLAYLARI.includes(b?.olay)) return NextResponse.json({ error: 'Geçersiz olay' }, { status: 400 })
  await yoneticiOlayi(user.email || user.id, b.olay as Olay, '', istemciIp(req))
  return NextResponse.json({ ok: true })
}
